<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloudUploadTaskController extends Controller
{
    public function __construct(private readonly CloudUploadTaskBroadcaster $broadcaster) {}

    public function index(Request $request, CloudConnection $connection): JsonResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');

        $tasks = $connection->tasks()
            ->where('type', CloudTaskType::Upload)
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (CloudTask $task): array => CloudUploadTaskData::fromTask($task))
            ->all();

        return response()->json(['tasks' => $tasks]);
    }

    public function store(Request $request, CloudConnection $connection): JsonResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');

        $validated = $request->validate([
            'path' => ['nullable', 'string', 'max:2048'],
            'filename' => ['required', 'string', 'max:255'],
            'mime_type' => ['nullable', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.config('cloud-storage.uploads.max_file_size')],
            'chunk_size' => ['required', 'integer', 'min:1024', 'max:'.config('cloud-storage.uploads.chunk_size')],
            'upload_mode' => ['nullable', 'string', 'in:backend,direct'],
        ]);

        $filename = trim((string) $validated['filename']);

        if ($filename === '' || str_contains($filename, '/') || str_contains($filename, '\\') || str_contains($filename, '..')) {
            throw ValidationException::withMessages([
                'filename' => 'Filename is invalid.',
            ]);
        }

        $size = (int) $validated['size'];
        $chunkSize = (int) $validated['chunk_size'];
        $totalChunks = (int) ceil($size / $chunkSize);
        $uploadMode = (string) ($validated['upload_mode'] ?? 'backend');

        if ($uploadMode === 'direct' && ! $connection->provider === CloudProvider::AWS_S3) {
            throw ValidationException::withMessages([
                'upload_mode' => 'Direct upload is only available for S3 connections.',
            ]);
        }

        $task = CloudTask::query()->create([
            'user_id' => $request->user()->id,
            'cloud_connection_id' => $connection->id,
            'type' => CloudTaskType::Upload(),
            'status' => CloudTaskStatus::Pending(),
            'target_path' => trim((string) ($validated['path'] ?? ''), '/'),
            'name' => $filename,
            'payload' => [
                'filename' => $filename,
                'mime_type' => $validated['mime_type'] ?? null,
                'size' => $size,
                'chunk_size' => $chunkSize,
                'total_chunks' => $totalChunks,
                'uploaded_chunks_count' => 0,
                'upload_mode' => $uploadMode,
            ],
        ]);

        $this->broadcaster->broadcastStatus($task);

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    public function show(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);

        return response()->json(CloudUploadTaskData::fromTask($task->load('chunks')));
    }

    public function pause(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);

        if ($task->status->in([CloudTaskStatus::Pending(), CloudTaskStatus::Uploading()])) {
            $task->forceFill(['status' => CloudTaskStatus::Paused()])->save();
            $this->broadcaster->broadcastStatus($task);
        }

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    public function resume(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);

        if ($task->status->is(CloudTaskStatus::Paused())) {
            $task->forceFill(['status' => CloudTaskStatus::Uploading()])->save();
            $this->broadcaster->broadcastStatus($task);
        }

        return response()->json(CloudUploadTaskData::fromTask($task->load('chunks')));
    }

    public function destroy(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);

        [$task, $wasCancelled] = DB::transaction(function () use ($task): array {
            $lockedTask = CloudTask::query()
                ->whereKey($task->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedTask->status->in([
                CloudTaskStatus::Pending(),
                CloudTaskStatus::Uploading(),
                CloudTaskStatus::Paused(),
                CloudTaskStatus::Queued(),
            ])) {
                return [$lockedTask->load('chunks'), false];
            }

            $lockedTask->forceFill([
                'status' => CloudTaskStatus::Cancelled(),
                'cancelled_at' => now(),
            ])->save();

            return [$lockedTask->refresh()->load('chunks'), true];
        });

        if ($wasCancelled) {
            $this->broadcaster->broadcastStatus($task);
        }

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    private function authorizeTask(Request $request, CloudConnection $connection, CloudTask $task): void
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');
        abort_if($task->cloud_connection_id !== $connection->id || $task->user_id !== $request->user()->id, 404);
        abort_if(! $task->type->is(CloudTaskType::Upload()), 404);
    }
}
