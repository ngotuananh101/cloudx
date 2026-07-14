<?php

namespace App\Jobs;

use App\Enums\ActivityAction;
use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Exceptions\MultipartUploadException;
use App\Models\CloudTask;
use App\Services\ActivityLogger;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\S3\S3Presigner;
use App\Support\CloudUploadTaskBroadcaster;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Throwable;

class CompleteS3MultipartUploadJob implements ShouldQueue
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

    public function handle(
        CloudStorageCache $cache,
        CloudUploadTaskBroadcaster $broadcaster,
        S3Presigner $presigner,
        ActivityLogger $activityLogger,
    ): void {
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
            $multipart = $payload['s3_multipart'] ?? null;

            if (! is_array($multipart) || empty($multipart['upload_id']) || empty($multipart['key'])) {
                throw new MultipartUploadException('Multipart upload payload is invalid.');
            }

            $presigner->completeMultipartUpload(
                $task->connection,
                (string) $multipart['key'],
                (string) $multipart['upload_id'],
                $multipart['parts'] ?? [],
            );

            $task->forceFill([
                'status' => CloudTaskStatus::Completed,
                'result' => ['path' => $multipart['key']],
                'completed_at' => now(),
            ])->save();
            $broadcaster->broadcastStatus($task);

            $cache->flushFolder($task->connection, $task->target_path);
            $cache->flushQuota($task->connection);

            $filename = (string) ($payload['filename'] ?? $task->name);
            $activityLogger->log(
                user: $task->user,
                action: ActivityAction::FileUploaded,
                subjectName: $filename,
                targetName: $task->target_path === '' ? '/' : $task->target_path,
                connection: $task->connection,
            );
        } catch (Throwable $exception) {
            if ($this->attempts() >= $this->tries) {
                $this->markFailed($task, $exception->getMessage(), $broadcaster);
            } else {
                $task->forceFill([
                    'status' => CloudTaskStatus::Queued,
                    'error_message' => $exception->getMessage(),
                ])->save();
                $broadcaster->broadcastStatus($task);
            }

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $task = CloudTask::query()->find($this->taskId);

        if ($task === null || ! in_array($task->status, [CloudTaskStatus::Processing, CloudTaskStatus::Queued], true)) {
            return;
        }

        $this->markFailed(
            $task,
            $exception?->getMessage() ?? 'Multipart upload job failed.',
            app(CloudUploadTaskBroadcaster::class),
        );
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
}
