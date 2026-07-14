<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Jobs\RemoteUploadCloudTaskFileJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Services\CloudStorage\RemoteUploadHeaders;
use App\Services\CloudStorage\RemoteUploadUrlGuard;
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloudUploadTaskController extends Controller
{
    private const UNAUTHORIZED_ACTION = 'Unauthorized action.';

    public function __construct(
        private readonly CloudUploadTaskBroadcaster $broadcaster,
        private readonly RemoteUploadHeaders $remoteUploadHeaders,
        private readonly RemoteUploadUrlGuard $remoteUploadUrlGuard,
    ) {}

    public function index(Request $request, CloudConnection $connection): JsonResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, self::UNAUTHORIZED_ACTION);

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
        abort_if($connection->user_id !== $request->user()->id, 403, self::UNAUTHORIZED_ACTION);

        $validated = $request->validate([
            'path' => ['nullable', 'string', 'max:2048'],
            'filename' => ['required_unless:upload_mode,remote', 'nullable', 'string', 'max:255'],
            'mime_type' => ['nullable', 'string', 'max:255'],
            'size' => ['required_unless:upload_mode,remote', 'nullable', 'integer', 'min:1', 'max:'.config('cloud-storage.uploads.max_file_size')],
            'chunk_size' => ['required_unless:upload_mode,remote', 'nullable', 'integer', 'min:1024', 'max:'.config('cloud-storage.uploads.chunk_size')],
            'upload_mode' => ['nullable', 'string', 'in:backend,direct,remote'],
            'url' => ['required_if:upload_mode,remote', 'nullable', 'url', 'max:4096'],
            'headers' => ['nullable', 'array'],
            'headers.*.name' => ['nullable', 'string'],
            'headers.*.value' => ['nullable', 'string'],
        ]);

        $uploadMode = (string) ($validated['upload_mode'] ?? 'backend');
        $filename = trim((string) ($validated['filename'] ?? ''));

        if ($uploadMode === 'remote') {
            return $this->storeRemoteUploadTask($request, $connection, $validated, $filename);
        }

        $this->ensureValidFilename($filename);

        $size = (int) $validated['size'];
        $chunkSize = (int) $validated['chunk_size'];
        $totalChunks = (int) ceil($size / $chunkSize);

        if ($uploadMode === 'direct' && $connection->provider !== CloudProvider::AWS_S3) {
            throw ValidationException::withMessages([
                'upload_mode' => 'Direct upload is only available for S3 connections.',
            ]);
        }

        $task = CloudTask::query()->create([
            'user_id' => $request->user()->id,
            'cloud_connection_id' => $connection->id,
            'type' => CloudTaskType::Upload,
            'status' => CloudTaskStatus::Pending,
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

        if (in_array($task->status, [CloudTaskStatus::Pending, CloudTaskStatus::Uploading], true)) {
            $task->forceFill(['status' => CloudTaskStatus::Paused])->save();
            $this->broadcaster->broadcastStatus($task);
        }

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    public function resume(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);

        if ($task->status === CloudTaskStatus::Paused) {
            $task->forceFill(['status' => CloudTaskStatus::Uploading])->save();
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

            if (! in_array($lockedTask->status, [
                CloudTaskStatus::Pending,
                CloudTaskStatus::Uploading,
                CloudTaskStatus::Paused,
                CloudTaskStatus::Queued,
            ], true)) {
                return [$lockedTask->load('chunks'), false];
            }

            $lockedTask->forceFill([
                'status' => CloudTaskStatus::Cancelled,
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
        abort_if($connection->user_id !== $request->user()->id, 403, self::UNAUTHORIZED_ACTION);
        abort_if($task->cloud_connection_id !== $connection->id || $task->user_id !== $request->user()->id, 404);
        abort_if($task->type !== CloudTaskType::Upload, 404);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function storeRemoteUploadTask(Request $request, CloudConnection $connection, array $validated, string $filename): JsonResponse
    {
        $url = (string) $validated['url'];
        $headers = $this->remoteUploadHeaders->normalize($validated['headers'] ?? null);

        $this->remoteUploadUrlGuard->validate($url);

        if ($filename === '') {
            $filename = $this->filenameFromUrl($url);
        }

        $this->ensureValidFilename($filename);

        $task = CloudTask::query()->create([
            'user_id' => $request->user()->id,
            'cloud_connection_id' => $connection->id,
            'type' => CloudTaskType::Upload,
            'status' => CloudTaskStatus::Queued,
            'target_path' => trim((string) ($validated['path'] ?? ''), '/'),
            'name' => $filename,
            'payload' => [
                'filename' => $filename,
                'mime_type' => $validated['mime_type'] ?? null,
                'size' => 0,
                'chunk_size' => 1,
                'total_chunks' => 1,
                'uploaded_chunks_count' => 0,
                'upload_mode' => 'remote',
                'remote_host' => parse_url($url, PHP_URL_HOST),
                'remote_headers_count' => count($headers),
            ],
            'secret_payload' => [
                'url' => $url,
                'headers' => $headers,
            ],
            'queued_at' => now(),
        ]);

        RemoteUploadCloudTaskFileJob::dispatch($task->id)->afterCommit();
        $this->broadcaster->broadcastStatus($task);

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    private function ensureValidFilename(string $filename): void
    {
        if ($filename === '' || str_contains($filename, '/') || str_contains($filename, '\\') || str_contains($filename, '..')) {
            throw ValidationException::withMessages([
                'filename' => 'Filename is invalid.',
            ]);
        }
    }

    private function filenameFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH);
        $basename = is_string($path) ? basename(rawurldecode($path)) : '';

        if ($basename === '' || $basename === '.' || $basename === '/') {
            return 'remote-upload';
        }

        return mb_substr($basename, 0, 255);
    }
}
