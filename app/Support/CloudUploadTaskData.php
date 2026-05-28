<?php

namespace App\Support;

use App\Models\CloudTask;

class CloudUploadTaskData
{
    /**
     * @return array{
     *     id: int,
     *     connection_id: int,
     *     name: string,
     *     type: string,
     *     status: string,
     *     status_value: int,
     *     target_path: string,
     *     payload: array<string, mixed>,
     *     progress: int,
     *     uploaded_chunks_count: int,
     *     total_chunks: int,
     *     result: array<string, mixed>|null,
     *     error_message: string|null,
     *     uploaded_chunks: array<int, int>,
     *     updated_at: string|null
     * }
     */
    public static function fromTask(CloudTask $task): array
    {
        $payload = $task->payload ?? [];
        $uploadedChunksCount = (int) ($payload['uploaded_chunks_count'] ?? 0);
        $totalChunks = (int) ($payload['total_chunks'] ?? 0);

        return [
            'id' => $task->id,
            'connection_id' => $task->cloud_connection_id,
            'name' => $task->name,
            'type' => str($task->type->key)->lower()->toString(),
            'status' => str($task->status->key)->lower()->toString(),
            'status_value' => $task->status->value,
            'target_path' => $task->target_path,
            'payload' => $payload,
            'progress' => self::progress($uploadedChunksCount, $totalChunks),
            'uploaded_chunks_count' => $uploadedChunksCount,
            'total_chunks' => $totalChunks,
            'result' => $task->result,
            'error_message' => $task->error_message,
            'uploaded_chunks' => self::uploadedChunks($task),
            'updated_at' => $task->updated_at?->toJSON(),
        ];
    }

    /**
     * @return array<int, int>
     */
    private static function uploadedChunks(CloudTask $task): array
    {
        if (! $task->relationLoaded('chunks')) {
            return [];
        }

        return $task->chunks
            ->pluck('index')
            ->map(fn (int $index): int => $index)
            ->values()
            ->all();
    }

    private static function progress(int $uploadedChunksCount, int $totalChunks): int
    {
        if ($totalChunks === 0) {
            return 0;
        }

        return (int) floor(($uploadedChunksCount / $totalChunks) * 100);
    }
}
