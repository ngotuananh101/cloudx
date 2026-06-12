<?php

use App\Enums\CloudProvider;
use App\Enums\CloudTaskStatus;
use App\Jobs\CompleteS3MultipartUploadJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use App\Services\CloudStorage\S3\S3Presigner;
use Illuminate\Support\Facades\Queue;

it('stores direct upload mode on created upload task', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
        'credentials' => [
            'provider_preset' => 'aws',
            'access_key_id' => 'access-key',
            'secret_access_key' => 'secret-key',
            'region' => 'us-east-1',
            'bucket' => 'cloudx-bucket',
        ],
    ]);

    $response = $this->actingAs($user)->postJson(route('connections.upload-tasks.store', $connection), [
        'path' => 'documents',
        'filename' => 'proposal.pdf',
        'mime_type' => 'application/pdf',
        'size' => 1024,
        'chunk_size' => 1024,
        'upload_mode' => 'direct',
    ]);

    $response->assertOk();
    expect(CloudTask::query()->sole()->payload['upload_mode'])->toBe('direct');
});

it('initializes direct multipart upload metadata', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
    ]);
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'payload' => [
            'filename' => 'proposal.pdf',
            'mime_type' => 'application/pdf',
            'size' => 1024,
            'chunk_size' => 1024,
            'total_chunks' => 1,
            'uploaded_chunks_count' => 0,
            'upload_mode' => 'direct',
        ],
    ]);

    $presigner = Mockery::mock(S3Presigner::class);
    $presigner->shouldReceive('initiateMultipartUpload')
        ->once()
        ->andReturn('upload-id-1');
    $this->app->instance(S3Presigner::class, $presigner);

    $response = $this->actingAs($user)
        ->postJson(route('connections.upload-tasks.direct.init', [$connection, $task]));

    $response->assertOk();

    $task->refresh();

    expect($task->payload['s3_multipart']['upload_id'])->toBe('upload-id-1')
        ->and($task->payload['s3_multipart']['key'])->toBe('proposal.pdf');
});

it('stores etag for completed direct upload part', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
    ]);
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'payload' => [
            'filename' => 'proposal.pdf',
            'mime_type' => 'application/pdf',
            'size' => 2048,
            'chunk_size' => 1024,
            'total_chunks' => 2,
            'uploaded_chunks_count' => 0,
            'upload_mode' => 'direct',
            's3_multipart' => [
                'upload_id' => 'upload-id-1',
                'key' => 'proposal.pdf',
                'parts' => [],
            ],
        ],
    ]);

    $response = $this->actingAs($user)
        ->postJson(route('connections.upload-tasks.direct.parts.done', [$connection, $task, 'partNumber' => 1]), [
            'etag' => 'etag-1',
        ]);

    $response->assertOk();

    expect($task->refresh()->payload['s3_multipart']['parts'])->toBe([
        ['ETag' => 'etag-1', 'PartNumber' => 1],
    ]);
});

it('queues multipart completion when all direct parts are uploaded', function () {
    Queue::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
    ]);
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'payload' => [
            'filename' => 'proposal.pdf',
            'mime_type' => 'application/pdf',
            'size' => 2048,
            'chunk_size' => 1024,
            'total_chunks' => 2,
            'uploaded_chunks_count' => 2,
            'upload_mode' => 'direct',
            's3_multipart' => [
                'upload_id' => 'upload-id-1',
                'key' => 'proposal.pdf',
                'parts' => [
                    ['ETag' => 'etag-1', 'PartNumber' => 1],
                    ['ETag' => 'etag-2', 'PartNumber' => 2],
                ],
            ],
        ],
    ]);

    $response = $this->actingAs($user)
        ->postJson(route('connections.upload-tasks.direct.complete', [$connection, $task]));

    $response->assertOk();
    expect($task->refresh()->status->is(CloudTaskStatus::Queued()))->toBeTrue();
    Queue::assertPushed(CompleteS3MultipartUploadJob::class);
});
