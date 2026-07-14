<?php

namespace App\Http\Controllers;

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Jobs\UploadCloudTaskFileJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CloudUploadTaskChunkController extends Controller
{
    public function __construct(private readonly CloudUploadTaskBroadcaster $broadcaster) {}

    public function store(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');
        abort_if($task->cloud_connection_id !== $connection->id || $task->user_id !== $request->user()->id, 404);
        abort_if($task->type !== CloudTaskType::Upload, 404);

        if (($task->payload['upload_mode'] ?? 'backend') === 'direct') {
            throw ValidationException::withMessages([
                'chunk' => 'This upload task uses direct upload and does not accept backend chunks.',
            ]);
        }

        if (! in_array($task->status, [CloudTaskStatus::Pending, CloudTaskStatus::Uploading, CloudTaskStatus::Paused], true)) {
            throw ValidationException::withMessages([
                'chunk' => 'This upload task can no longer receive chunks.',
            ]);
        }

        // Prefer the size negotiated when the task was created; fall back to global config.
        $chunkSize = (int) ($task->payload['chunk_size'] ?? config('cloud-storage.uploads.chunk_size', 5242880));
        $maxKb = (int) ceil($chunkSize / 1024);

        $validated = $request->validate([
            'chunk' => ['required', 'file', "max:{$maxKb}"],
            'index' => ['required', 'integer', 'min:0'],
            'checksum' => ['nullable', 'string', 'max:128'],
        ]);

        $index = (int) $validated['index'];
        $chunk = $request->file('chunk');

        if ($chunk === null || ! $chunk->isValid()) {
            throw ValidationException::withMessages([
                'chunk' => 'Chunk upload failed.',
            ]);
        }

        $totalChunks = (int) ($task->payload['total_chunks'] ?? 0);

        if ($totalChunks < 1 || $index >= $totalChunks) {
            throw ValidationException::withMessages([
                'index' => 'Chunk index is invalid.',
            ]);
        }

        if ($chunkSize > 0 && $index < $totalChunks - 1 && $chunk->getSize() !== $chunkSize) {
            throw ValidationException::withMessages([
                'chunk' => 'Chunk size is invalid.',
            ]);
        }

        $path = $this->chunkPath($task, $index);
        Storage::disk($this->tempDiskName())->putFileAs(dirname($path), $chunk, basename($path));

        DB::transaction(function () use ($task, $index, $chunk, $validated): void {
            $lockedTask = CloudTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();

            if (! in_array($lockedTask->status, [CloudTaskStatus::Pending, CloudTaskStatus::Uploading, CloudTaskStatus::Paused], true)) {
                throw ValidationException::withMessages([
                    'chunk' => 'This upload task can no longer receive chunks.',
                ]);
            }

            $lockedTask->chunks()->updateOrCreate([
                'index' => $index,
            ], [
                'size' => (int) $chunk->getSize(),
                'checksum' => $validated['checksum'] ?? null,
            ]);

            $uploadedChunksCount = $lockedTask->chunks()->count();
            $payload = $lockedTask->payload;
            $payload['uploaded_chunks_count'] = $uploadedChunksCount;
            $totalChunks = (int) ($payload['total_chunks'] ?? 0);

            if ($uploadedChunksCount >= $totalChunks && $totalChunks > 0) {
                if (! in_array($lockedTask->status, [CloudTaskStatus::Queued, CloudTaskStatus::Processing, CloudTaskStatus::Completed], true)) {
                    $lockedTask->forceFill([
                        'status' => CloudTaskStatus::Queued,
                        'payload' => $payload,
                        'queued_at' => now(),
                    ])->save();

                    UploadCloudTaskFileJob::dispatch($lockedTask->id)->afterCommit();
                }

                return;
            }

            if ($lockedTask->status !== CloudTaskStatus::Paused) {
                $lockedTask->forceFill([
                    'status' => CloudTaskStatus::Uploading,
                    'payload' => $payload,
                    'started_at' => $lockedTask->started_at ?? now(),
                ])->save();
            } else {
                $lockedTask->forceFill(['payload' => $payload])->save();
            }
        });

        $task->refresh()->load('chunks');

        if ($task->status === CloudTaskStatus::Queued) {
            $this->broadcaster->broadcastStatus($task);
        } else {
            $this->broadcaster->broadcastProgressIfNeeded($task);
        }

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    private function chunkPath(CloudTask $task, int $index): string
    {
        return trim((string) config('cloud-storage.uploads.temp_path', 'cloud-task-uploads'), '/').'/'.$task->id."/{$index}.part";
    }

    private function tempDiskName(): string
    {
        return (string) config('cloud-storage.uploads.temp_disk', 'local');
    }
}
