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
use Illuminate\Support\Facades\DB;
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

        $task = DB::transaction(function () use ($task, $partNumber, $validated): CloudTask {
            $lockedTask = CloudTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();

            $this->assertTaskAcceptsParts($lockedTask);

            $payload = $lockedTask->payload;
            $multipart = $payload['s3_multipart'] ?? null;

            if (! is_array($multipart)) {
                throw ValidationException::withMessages([
                    'task' => 'Multipart upload has not been initialized.',
                ]);
            }

            $partsByNumber = [];

            foreach ($multipart['parts'] ?? [] as $part) {
                if (! is_array($part)) {
                    continue;
                }

                $number = (int) ($part['PartNumber'] ?? 0);

                if ($number > 0) {
                    $partsByNumber[$number] = $part;
                }
            }

            $partsByNumber[$partNumber] = [
                'ETag' => $validated['etag'],
                'PartNumber' => $partNumber,
            ];

            ksort($partsByNumber);

            $payload['upload_mode'] = 'direct';
            $payload['uploaded_chunks_count'] = count($partsByNumber);
            $payload['s3_multipart'] = [
                ...$multipart,
                'parts' => array_values($partsByNumber),
            ];

            $lockedTask->forceFill([
                'status' => CloudTaskStatus::Uploading,
                'payload' => $payload,
                'started_at' => $lockedTask->started_at ?? now(),
            ])->save();

            return $lockedTask;
        });

        $task->refresh()->load('chunks');
        $this->broadcaster->broadcastProgressIfNeeded($task);

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    public function complete(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);
        $this->ensureS3Connection($connection);

        $task = DB::transaction(function () use ($task): CloudTask {
            $lockedTask = CloudTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();

            $this->assertTaskAcceptsParts($lockedTask);

            $payload = $lockedTask->payload;
            $multipart = $payload['s3_multipart'] ?? null;
            $totalChunks = (int) ($payload['total_chunks'] ?? 0);
            $parts = is_array($multipart) ? ($multipart['parts'] ?? []) : [];

            if (! is_array($multipart) || empty($multipart['upload_id']) || empty($multipart['key'])) {
                throw ValidationException::withMessages([
                    'task' => 'Multipart upload has not been initialized.',
                ]);
            }

            if (! is_array($parts) || count($parts) !== $totalChunks || $totalChunks < 1) {
                throw ValidationException::withMessages([
                    'task' => 'Upload parts are still missing.',
                ]);
            }

            $numbers = collect($parts)
                ->map(fn (array $part): int => (int) ($part['PartNumber'] ?? 0))
                ->sort()
                ->values()
                ->all();

            $expected = range(1, $totalChunks);

            if ($numbers !== $expected) {
                throw ValidationException::withMessages([
                    'task' => 'Upload parts are incomplete or out of order.',
                ]);
            }

            $lockedTask->forceFill([
                'status' => CloudTaskStatus::Queued,
                'queued_at' => now(),
            ])->save();

            return $lockedTask;
        });

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

        if (! in_array($task->status, [
            CloudTaskStatus::Completed,
            CloudTaskStatus::Failed,
            CloudTaskStatus::Cancelled,
        ], true)) {
            $task->forceFill([
                'status' => CloudTaskStatus::Cancelled,
                'cancelled_at' => now(),
            ])->save();
            $this->broadcaster->broadcastStatus($task);
        }

        return response()->json(CloudUploadTaskData::fromTask($task));
    }

    private function assertTaskAcceptsParts(CloudTask $task): void
    {
        if (! in_array($task->status, [
            CloudTaskStatus::Pending,
            CloudTaskStatus::Uploading,
            CloudTaskStatus::Paused,
        ], true)) {
            throw ValidationException::withMessages([
                'task' => 'This upload task can no longer accept parts.',
            ]);
        }
    }

    private function authorizeTask(Request $request, CloudConnection $connection, CloudTask $task): void
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');
        abort_if($task->cloud_connection_id !== $connection->id || $task->user_id !== $request->user()->id, 404);
    }

    private function ensureS3Connection(CloudConnection $connection): void
    {
        if ($connection->provider !== CloudProvider::AWS_S3) {
            abort(422, 'Direct upload is only available for S3 connections.');
        }
    }
}
