<?php

namespace App\Jobs;

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Models\CloudTask;
use App\Services\CloudStorage\CloudStorageCache;
use App\Support\CloudUploadTaskBroadcaster;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class UploadCloudTaskFileJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 1200;

    public function __construct(public int $taskId) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(CloudStorageCache $cache, CloudUploadTaskBroadcaster $broadcaster): void
    {
        $task = DB::transaction(function (): ?CloudTask {
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

        if ($task === null) {
            return;
        }

        $task->load('connection');
        $broadcaster->broadcastStatus($task);

        try {
            $payload = $task->payload;
            $filename = (string) ($payload['filename'] ?? $task->name);
            $targetPath = trim($task->target_path, '/') === '' ? $filename : trim($task->target_path, '/').'/'.$filename;

            if (($payload['upload_mode'] ?? 'backend') === 'direct') {
                $task->forceFill([
                    'status' => CloudTaskStatus::Completed,
                    'result' => ['path' => $targetPath],
                    'completed_at' => now(),
                ])->save();
                $broadcaster->broadcastStatus($task);
                $cache->flushFolder($task->connection, $task->target_path);
                $cache->flushQuota($task->connection);

                return;
            }

            $totalChunks = (int) ($payload['total_chunks'] ?? 0);

            if ($totalChunks < 1 || $filename === '') {
                throw new RuntimeException('Upload task payload is invalid.');
            }

            if ($task->chunks()->count() !== $totalChunks) {
                throw new RuntimeException('Upload task is missing chunks.');
            }

            $tempPath = $this->mergedTempPath($task);
            $tempDisk = Storage::disk($this->tempDiskName());
            $stream = fopen('php://temp', 'w+');

            if ($stream === false) {
                throw new RuntimeException('Could not create upload merge stream.');
            }

            for ($index = 0; $index < $totalChunks; $index++) {
                $chunkPath = $this->chunkPath($task, $index);

                if (! $tempDisk->exists($chunkPath)) {
                    throw new RuntimeException("Upload chunk {$index} is missing.");
                }

                $chunkStream = $tempDisk->readStream($chunkPath);

                if ($chunkStream === false) {
                    throw new RuntimeException("Could not read upload chunk {$index}.");
                }

                stream_copy_to_stream($chunkStream, $stream);
                if (is_resource($chunkStream)) {
                    fclose($chunkStream);
                }
            }

            rewind($stream);
            $tempDisk->put($tempPath, $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }

            $uploadStream = $tempDisk->readStream($tempPath);

            if ($uploadStream === false) {
                throw new RuntimeException('Could not read merged upload file.');
            }

            $task->connection->getDisk()->writeStream($targetPath, $uploadStream);
            if (is_resource($uploadStream)) {
                fclose($uploadStream);
            }

            $task->forceFill([
                'status' => CloudTaskStatus::Completed,
                'result' => ['path' => $targetPath],
                'completed_at' => now(),
            ])->save();
            $broadcaster->broadcastStatus($task);

            $this->deleteTempFiles($task, $totalChunks, $tempPath);
            $cache->flushFolder($task->connection, $task->target_path);
            $cache->flushQuota($task->connection);
        } catch (Throwable $exception) {
            $task->forceFill([
                'status' => CloudTaskStatus::Failed,
                'error_message' => $exception->getMessage(),
                'failed_at' => now(),
            ])->save();
            $broadcaster->broadcastStatus($task);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $task = CloudTask::query()->find($this->taskId);

        if ($task === null || ! $task->status === CloudTaskStatus::Processing) {
            return;
        }

        $task->forceFill([
            'status' => CloudTaskStatus::Failed,
            'error_message' => $exception?->getMessage() ?? 'Upload job failed.',
            'failed_at' => now(),
        ])->save();

        app(CloudUploadTaskBroadcaster::class)->broadcastStatus($task);
    }

    private function deleteTempFiles(CloudTask $task, int $totalChunks, string $tempPath): void
    {
        $tempDisk = Storage::disk($this->tempDiskName());

        for ($index = 0; $index < $totalChunks; $index++) {
            $tempDisk->delete($this->chunkPath($task, $index));
        }

        $tempDisk->delete($tempPath);
    }

    private function chunkPath(CloudTask $task, int $index): string
    {
        return $this->taskPath($task)."/{$index}.part";
    }

    private function mergedTempPath(CloudTask $task): string
    {
        return $this->taskPath($task).'/merged.bin';
    }

    private function taskPath(CloudTask $task): string
    {
        return trim((string) config('cloud-storage.uploads.temp_path', 'cloud-task-uploads'), '/').'/'.$task->id;
    }

    private function tempDiskName(): string
    {
        return (string) config('cloud-storage.uploads.temp_disk', 'local');
    }
}
