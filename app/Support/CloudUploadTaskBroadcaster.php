<?php

namespace App\Support;

use App\Events\CloudUploadTaskUpdated;
use App\Models\CloudTask;
use Illuminate\Support\Facades\DB;

class CloudUploadTaskBroadcaster
{
    public function broadcastStatus(CloudTask $task): void
    {
        try {
            CloudUploadTaskUpdated::dispatch($task->refresh());
        } catch (\Illuminate\Broadcasting\BroadcastException $e) {
            // Ignore broadcast exceptions to prevent upload failures
            \Illuminate\Support\Facades\Log::warning('Broadcast failed for task ' . $task->id . ': ' . $e->getMessage());
        }
    }

    public function broadcastProgressIfNeeded(CloudTask $task): void
    {
        $shouldBroadcast = DB::transaction(function () use ($task): bool {
            $lockedTask = CloudTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $payload = $lockedTask->payload ?? [];
            $totalChunks = (int) ($payload['total_chunks'] ?? 0);
            $uploadedChunksCount = (int) ($payload['uploaded_chunks_count'] ?? 0);

            if ($totalChunks < 1) {
                return false;
            }

            $progress = (int) floor(($uploadedChunksCount / $totalChunks) * 100);
            $progressBoundary = $progress === 100 ? 100 : $progress - ($progress % 5);
            $lastBroadcastProgress = (int) ($payload['last_broadcast_progress'] ?? 0);

            if ($progressBoundary <= $lastBroadcastProgress) {
                return false;
            }

            $payload['last_broadcast_progress'] = $progressBoundary;

            $lockedTask->forceFill(['payload' => $payload])->save();

            return true;
        });

        if (! $shouldBroadcast) {
            return;
        }

        try {
            CloudUploadTaskUpdated::dispatch($task->refresh());
        } catch (\Illuminate\Broadcasting\BroadcastException $e) {
            \Illuminate\Support\Facades\Log::warning('Broadcast progress failed for task ' . $task->id . ': ' . $e->getMessage());
        }
    }
}
