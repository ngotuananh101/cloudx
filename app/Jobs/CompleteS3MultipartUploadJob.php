<?php

namespace App\Jobs;

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Models\CloudTask;
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
    ): void {
        $task = DB::transaction(function (): ?CloudTask {
            $task = CloudTask::query()
                ->whereKey($this->taskId)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $task->type === CloudTaskType::Upload || ! $task->status === CloudTaskStatus::Queued) {
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
                throw new \RuntimeException('Multipart upload payload is invalid.');
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
}
