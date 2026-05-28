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
     *     target_path: string,
     *     status: string,
     *     progress: int,
     *     uploaded_chunks_count: int,
     *     total_chunks: int,
     *     error_message: string|null
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
            'target_path' => $task->target_path,
            'status' => str($task->status->key)->lower()->toString(),
            'progress' => self::progress($uploadedChunksCount, $totalChunks),
            'uploaded_chunks_count' => $uploadedChunksCount,
            'total_chunks' => $totalChunks,
            'error_message' => $task->error_message,
        ];
    }

    private static function progress(int $uploadedChunksCount, int $totalChunks): int
    {
        if ($totalChunks === 0) {
            return 0;
        }

        return (int) floor(($uploadedChunksCount / $totalChunks) * 100);
    }
}
