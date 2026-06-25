<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\CloudTaskStatus;
use App\Jobs\CompleteS3MultipartUploadJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Services\CloudStorage\S3\S3Presigner;
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CloudUploadDirectCompleteController extends Controller
{
    public function __construct(
        private readonly CloudUploadTaskBroadcaster $broadcaster,
        private readonly S3Presigner $presigner,
    ) {}

    public function partDone(Request $request, CloudConnection $connection, CloudTask $task, int $partNumber): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);
        $this->ensureS3Connection($connection);

        $validated = $request->validate([
            'etag' => ['required', 'string', 'max:1024'],
        ]);

        $payload = $task->payload;
        $multipart = $payload['s3_multipart'] ?? null;

        if (! is_array($multipart)) {
            throw ValidationException::withMessages([
                'task' => 'Multipart upload has not been initialized.',
            ]);
        }

        $parts = collect($multipart['parts'] ?? [])
            ->reject(fn (array $part): bool => (int) ($part['PartNumber'] ?? 0) === $partNumber)
            ->values()
            ->all();

        $parts[] = [
            'ETag' => $validated['etag'],
            'PartNumber' => $partNumber,
        ];

        $payload['upload_mode'] = 'direct';
        $payload['uploaded_chunks_count'] = count($parts);
        $payload['s3_multipart'] = [
            ...$multipart,
            'parts' => $parts,
        ];

        $task->forceFill([
            'status' => CloudTaskStatus::Uploading,
            'payload' => $payload,
            'started_at' => $task->started_at ?? now(),
        ])->save();

        $task->refresh()->load('chunks');
        $this->broadcaster->broadcastProgressIfNeeded($task);

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    public function complete(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);
        $this->ensureS3Connection($connection);

        $payload = $task->payload;
        $multipart = $payload['s3_multipart'] ?? null;
        $totalChunks = (int) ($payload['total_chunks'] ?? 0);
        $uploadedChunksCount = (int) ($payload['uploaded_chunks_count'] ?? 0);

        if (! is_array($multipart) || empty($multipart['upload_id']) || empty($multipart['key'])) {
            throw ValidationException::withMessages([
                'task' => 'Multipart upload has not been initialized.',
            ]);
        }

        if ($uploadedChunksCount !== $totalChunks) {
            throw ValidationException::withMessages([
                'task' => 'Upload parts are still missing.',
            ]);
        }

        $task->forceFill([
            'status' => CloudTaskStatus::Queued,
            'queued_at' => now(),
        ])->save();

        CompleteS3MultipartUploadJob::dispatch($task->id)->afterCommit();
        $this->broadcaster->broadcastStatus($task);

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    public function abort(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);
        $this->ensureS3Connection($connection);

        $multipart = $task->payload['s3_multipart'] ?? null;

        if (is_array($multipart) && ! empty($multipart['upload_id']) && ! empty($multipart['key'])) {
            $this->presigner->abortMultipartUpload(
                $connection,
                (string) $multipart['key'],
                (string) $multipart['upload_id'],
            );
        }

        $task->forceFill([
            'status' => CloudTaskStatus::Cancelled,
            'cancelled_at' => now(),
        ])->save();
        $this->broadcaster->broadcastStatus($task);

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    private function authorizeTask(Request $request, CloudConnection $connection, CloudTask $task): void
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');
        abort_if($task->cloud_connection_id !== $connection->id || $task->user_id !== $request->user()->id, 404);
    }

    private function ensureS3Connection(CloudConnection $connection): void
    {
        if (! $connection->provider === CloudProvider::AWS_S3) {
            abort(422, 'Direct upload is only available for S3 connections.');
        }
    }
}
