<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Services\CloudStorage\S3\S3Presigner;
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CloudUploadPresignController extends Controller
{
    public function __construct(
        private readonly S3Presigner $presigner,
        private readonly CloudUploadTaskBroadcaster $broadcaster,
    ) {}

    public function init(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);
        $this->ensureS3Connection($connection);

        $payload = $task->payload;
        $filename = (string) ($payload['filename'] ?? $task->name);
        $uploadId = $this->presigner->initiateMultipartUpload(
            $connection,
            $this->targetPath($task, $filename),
            $payload['mime_type'] ?? null,
        );

        $payload['upload_mode'] = 'direct';
        $payload['s3_multipart'] = [
            'upload_id' => $uploadId,
            'key' => $this->targetPath($task, $filename),
            'parts' => [],
        ];

        $task->forceFill([
            'payload' => $payload,
        ])->save();

        $this->broadcaster->broadcastStatus($task);

        return response()->json([
            'task' => CloudUploadTaskData::fromTask($task->fresh('chunks')),
            'multipart' => $payload['s3_multipart'],
        ]);
    }

    public function part(Request $request, CloudConnection $connection, CloudTask $task): JsonResponse
    {
        $this->authorizeTask($request, $connection, $task);
        $this->ensureS3Connection($connection);

        $validated = $request->validate([
            'part_number' => ['required', 'integer', 'min:1', 'max:10000'],
        ]);

        $multipart = $task->payload['s3_multipart'] ?? null;

        if (! is_array($multipart) || empty($multipart['upload_id']) || empty($multipart['key'])) {
            throw ValidationException::withMessages([
                'task' => 'Multipart upload has not been initialized.',
            ]);
        }

        return response()->json([
            'url' => $this->presigner->presignUploadPart(
                $connection,
                (string) $multipart['key'],
                (string) $multipart['upload_id'],
                (int) $validated['part_number'],
            ),
        ]);
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

    private function targetPath(CloudTask $task, string $filename): string
    {
        return trim($task->target_path, '/') === '' ? $filename : trim($task->target_path, '/').'/'.$filename;
    }
}
