<?php

namespace App\Jobs;

use App\Enums\ActivityAction;
use App\Enums\CloudProvider;
use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Exceptions\CloudUploadException;
use App\Models\CloudTask;
use App\Services\ActivityLogger;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\RemoteUploadUrlGuard;
use App\Support\CloudUploadTaskBroadcaster;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

class RemoteUploadCloudTaskFileJob implements ShouldQueue
{
    use Queueable;

    private const REMOTE_FILE_TOO_LARGE = 'Remote file exceeds the allowed size.';

    public int $tries = 3;

    public int $timeout = 1500;

    public function __construct(public int $taskId) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(
        CloudStorageCache $cache,
        CloudUploadTaskBroadcaster $broadcaster,
        RemoteUploadUrlGuard $urlGuard,
        ActivityLogger $activityLogger,
    ): void {
        $task = $this->claimQueuedTask();

        if ($task === null) {
            return;
        }

        $task->load('connection');
        $broadcaster->broadcastStatus($task);

        try {
            $this->processRemoteUpload($task, $cache, $broadcaster, $urlGuard, $activityLogger);
        } catch (Throwable $exception) {
            $task->refresh();
            Storage::disk($this->tempDiskName())->delete($this->tempPath($task));

            if ($task->status === CloudTaskStatus::Cancelled) {
                return;
            }

            $task->connection?->handleApiException($exception);
            $this->requeueOrFail($task, $exception->getMessage(), $broadcaster);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $task = CloudTask::query()->find($this->taskId);

        if ($task === null || ! in_array($task->status, [CloudTaskStatus::Processing, CloudTaskStatus::Queued], true)) {
            return;
        }

        Storage::disk($this->tempDiskName())->delete($this->tempPath($task));

        $this->markFailed(
            $task,
            $exception?->getMessage() ?? 'Remote upload job failed.',
            app(CloudUploadTaskBroadcaster::class),
        );
    }

    private function claimQueuedTask(): ?CloudTask
    {
        return DB::transaction(function (): ?CloudTask {
            $task = CloudTask::query()
                ->whereKey($this->taskId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($task->type !== CloudTaskType::Upload || $task->status !== CloudTaskStatus::Queued) {
                return null;
            }

            $task->forceFill([
                'status' => CloudTaskStatus::Processing,
                'processing_at' => now(),
                'error_message' => null,
            ])->save();

            return $task;
        });
    }

    private function processRemoteUpload(
        CloudTask $task,
        CloudStorageCache $cache,
        CloudUploadTaskBroadcaster $broadcaster,
        RemoteUploadUrlGuard $urlGuard,
        ActivityLogger $activityLogger,
    ): void {
        $payload = $task->payload;
        $url = (string) ($task->secret_payload['url'] ?? $payload['remote_url'] ?? '');
        $filename = (string) ($payload['filename'] ?? $task->name);
        $headers = $task->secret_payload['headers'] ?? [];

        if ($url === '' || $filename === '' || ! is_array($headers)) {
            throw new CloudUploadException('Remote upload task payload is invalid.');
        }

        $urlGuard->validate($url);
        $pinnedIp = $urlGuard->resolveIpForUrl($url);

        $targetPath = $task->connection?->provider === CloudProvider::TELEGRAM
            ? $filename
            : (trim($task->target_path, '/') === '' ? $filename : trim($task->target_path, '/').'/'.$filename);
        $tempPath = $this->tempPath($task);
        $absoluteTempPath = $this->absoluteTempPath($tempPath);

        $this->ensureRemoteFileIsAllowed($url, $headers, $urlGuard, $pinnedIp);
        $this->downloadRemoteFile($task, $url, $headers, $absoluteTempPath, $urlGuard, $pinnedIp);

        $downloadedSize = filesize($absoluteTempPath);

        if ($downloadedSize === false || $downloadedSize < 1) {
            throw new CloudUploadException('Remote file is empty or could not be read.');
        }

        if ($downloadedSize > $this->maxFileSize()) {
            throw new CloudUploadException(self::REMOTE_FILE_TOO_LARGE);
        }

        $this->assertNotCancelled($task);
        $this->writeDownloadedFile($task, $targetPath, $absoluteTempPath);

        $payload['size'] = $downloadedSize;
        $payload['uploaded_chunks_count'] = 1;
        $payload['total_chunks'] = 1;

        $task->forceFill([
            'status' => CloudTaskStatus::Completed,
            'payload' => $payload,
            'result' => ['path' => $targetPath],
            'completed_at' => now(),
        ])->save();
        $broadcaster->broadcastStatus($task);

        Storage::disk($this->tempDiskName())->delete($tempPath);
        $cache->flushFolder($task->connection, $task->target_path);
        $cache->flushQuota($task->connection);

        $activityLogger->log(
            user: $task->user,
            action: ActivityAction::FileUploaded,
            subjectName: $filename,
            targetName: $task->target_path === '' ? '/' : $task->target_path,
            connection: $task->connection,
        );
    }

    private function writeDownloadedFile(CloudTask $task, string $targetPath, string $absoluteTempPath): void
    {
        $uploadStream = fopen($absoluteTempPath, 'rb');

        if ($uploadStream === false) {
            throw new CloudUploadException('Could not open downloaded remote file.');
        }

        $task->connection->getDisk()->writeStream($targetPath, $uploadStream);

        if (is_resource($uploadStream)) {
            fclose($uploadStream);
        }
    }

    private function requeueOrFail(CloudTask $task, string $message, CloudUploadTaskBroadcaster $broadcaster): void
    {
        if ($this->attempts() >= $this->tries) {
            $this->markFailed($task, $message, $broadcaster);

            return;
        }

        $task->forceFill([
            'status' => CloudTaskStatus::Queued,
            'error_message' => $message,
        ])->save();
        $broadcaster->broadcastStatus($task);
    }

    private function markFailed(CloudTask $task, string $message, CloudUploadTaskBroadcaster $broadcaster): void
    {
        $task->forceFill([
            'status' => CloudTaskStatus::Failed,
            'error_message' => $message,
            'failed_at' => now(),
        ])->save();

        $broadcaster->broadcastStatus($task);
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function ensureRemoteFileIsAllowed(string $url, array $headers, RemoteUploadUrlGuard $urlGuard, ?string $pinnedIp = null): void
    {
        $response = $this->request($headers, $urlGuard, $url, $pinnedIp)
            ->head($urlGuard->substituteHostWithIp($url, $pinnedIp ?? ''));

        if ($response->failed() && ! in_array($response->status(), [405, 501], true)) {
            $response->throw();
        }

        $contentLength = (int) $response->header('Content-Length');

        if ($contentLength > $this->maxFileSize()) {
            throw new CloudUploadException(self::REMOTE_FILE_TOO_LARGE);
        }
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function downloadRemoteFile(
        CloudTask $task,
        string $url,
        array $headers,
        string $absoluteTempPath,
        RemoteUploadUrlGuard $urlGuard,
        ?string $pinnedIp = null,
    ): void {
        $pinnedUrl = $pinnedIp !== null ? $urlGuard->substituteHostWithIp($url, $pinnedIp) : $url;
        $maxFileSize = $this->maxFileSize();
        $lastChecked = time();

        $response = $this->request($headers, $urlGuard, $url, $pinnedIp)
            ->withOptions([
                'progress' => function (int $downloadTotal, int $downloadedBytes) use ($absoluteTempPath, $maxFileSize, $task, &$lastChecked): void {
                    if ($downloadedBytes > $maxFileSize) {
                        if (is_file($absoluteTempPath)) {
                            unlink($absoluteTempPath);
                        }

                        throw new CloudUploadException(self::REMOTE_FILE_TOO_LARGE);
                    }

                    $now = time();
                    if ($now - $lastChecked >= 3) { // throttle to 3 seconds
                        $lastChecked = $now;
                        $this->assertNotCancelled($task);
                    }
                },
            ])
            ->sink($absoluteTempPath)
            ->get($pinnedUrl)
            ->throw();

        $contentLength = (int) $response->header('Content-Length');

        if ($contentLength > $maxFileSize) {
            if (is_file($absoluteTempPath)) {
                unlink($absoluteTempPath);
            }

            throw new CloudUploadException(self::REMOTE_FILE_TOO_LARGE);
        }
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function request(array $headers, RemoteUploadUrlGuard $urlGuard, string $url, ?string $pinnedIp = null): PendingRequest
    {
        $requestHeaders = $headers;

        if ($pinnedIp !== null) {
            $originalHost = (string) (parse_url($url, PHP_URL_HOST) ?? '');
            $pinnedUrl = $urlGuard->substituteHostWithIp($url, $pinnedIp);

            if ($originalHost !== '') {
                $requestHeaders['Host'] = $originalHost;
            }
        } else {
            $pinnedUrl = $url;
        }

        $pinnedIpForRedirect = $pinnedIp;

        return Http::withHeaders($requestHeaders)
            ->connectTimeout((int) config('cloud-storage.remote_upload.connect_timeout', 10))
            ->timeout((int) config('cloud-storage.remote_upload.timeout', 1200))
            ->retry([1000, 5000, 10000], 0, fn (Throwable $exception): bool => $exception instanceof ConnectionException
                || ($exception instanceof RequestException && $exception->response->serverError()))
            ->withOptions([
                'allow_redirects' => [
                    'max' => (int) config('cloud-storage.remote_upload.max_redirects', 3),
                    'on_redirect' => function ($request, $response, $uri) use ($urlGuard, &$pinnedIpForRedirect): void {
                        $redirectUrl = (string) $uri;
                        $urlGuard->resolveIpForUrl($redirectUrl);
                        $pinnedIpForRedirect = $urlGuard->resolveIpForUrl($redirectUrl);
                    },
                ],
            ]);
    }

    private function assertNotCancelled(CloudTask $task): void
    {
        $task->refresh();

        if ($task->status === CloudTaskStatus::Cancelled) {
            throw new CloudUploadException('Upload was cancelled.');
        }
    }

    private function tempPath(CloudTask $task): string
    {
        return trim((string) config('cloud-storage.uploads.temp_path', 'cloud-task-uploads'), '/').'/remote-'.$task->id.'.download';
    }

    private function absoluteTempPath(string $tempPath): string
    {
        $disk = Storage::disk($this->tempDiskName());
        $directory = dirname($tempPath);

        if (! $disk->exists($directory)) {
            $disk->makeDirectory($directory);
        }

        $absolutePath = $disk->path($tempPath);
        $absoluteDirectory = dirname($absolutePath);

        if (! is_dir($absoluteDirectory)) {
            mkdir($absoluteDirectory, 0755, true);
        }

        return $absolutePath;
    }

    private function maxFileSize(): int
    {
        return (int) config('cloud-storage.remote_upload.max_file_size', config('cloud-storage.uploads.max_file_size'));
    }

    private function tempDiskName(): string
    {
        return (string) config('cloud-storage.uploads.temp_disk', 'local');
    }
}
