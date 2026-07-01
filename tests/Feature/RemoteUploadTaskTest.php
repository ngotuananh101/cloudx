<?php

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Jobs\RemoteUploadCloudTaskFileJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\RemoteUploadUrlGuard;
use App\Support\CloudUploadTaskBroadcaster;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

it('creates a queued remote upload task without exposing headers', function () {
    Queue::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();

    $urlGuard = Mockery::mock(RemoteUploadUrlGuard::class);
    $urlGuard->shouldReceive('validate')
        ->once()
        ->with('https://files.example.com/archive.zip')
        ->andReturnNull();
    $this->app->instance(RemoteUploadUrlGuard::class, $urlGuard);

    $response = $this->actingAs($user)->postJson(route('connections.upload-tasks.store', $connection), [
        'path' => 'imports',
        'filename' => 'archive.zip',
        'url' => 'https://files.example.com/archive.zip',
        'headers' => [
            ['name' => 'Authorization', 'value' => 'Bearer secret-token'],
        ],
        'upload_mode' => 'remote',
    ]);

    $response->assertOk()
        ->assertJsonPath('status', 'queued')
        ->assertJsonPath('payload.upload_mode', 'remote')
        ->assertJsonPath('payload.remote_host', 'files.example.com')
        ->assertJsonPath('payload.remote_headers_count', 1)
        ->assertJsonMissing(['remote_url' => 'https://files.example.com/archive.zip'])
        ->assertJsonMissing(['headers' => ['Authorization' => 'Bearer secret-token']]);

    $task = CloudTask::query()->sole();

    expect($task->type)->toBe(CloudTaskType::Upload)
        ->and($task->status)->toBe(CloudTaskStatus::Queued)
        ->and($task->secret_payload['url'])->toBe('https://files.example.com/archive.zip')
        ->and($task->secret_payload['headers']['Authorization'])->toBe('Bearer secret-token');

    Queue::assertPushed(RemoteUploadCloudTaskFileJob::class);
});

it('uses the remote URL filename when no custom filename is provided', function () {
    Queue::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();

    $urlGuard = Mockery::mock(RemoteUploadUrlGuard::class);
    $urlGuard->shouldReceive('validate')
        ->once()
        ->with('https://files.example.com/reports/monthly%20summary.pdf')
        ->andReturnNull();
    $this->app->instance(RemoteUploadUrlGuard::class, $urlGuard);

    $this->actingAs($user)->postJson(route('connections.upload-tasks.store', $connection), [
        'path' => 'reports',
        'url' => 'https://files.example.com/reports/monthly%20summary.pdf',
        'upload_mode' => 'remote',
    ])->assertOk();

    expect(CloudTask::query()->sole()->name)->toBe('monthly summary.pdf');
});

it('rejects unsafe custom remote upload headers', function () {
    Queue::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();

    $this->actingAs($user)->postJson(route('connections.upload-tasks.store', $connection), [
        'url' => 'https://files.example.com/archive.zip',
        'headers' => [
            ['name' => 'Host', 'value' => 'internal.test'],
        ],
        'upload_mode' => 'remote',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('headers.0.name');
});

it('rejects private remote upload URLs', function () {
    Queue::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();

    $this->actingAs($user)->postJson(route('connections.upload-tasks.store', $connection), [
        'filename' => 'secret.txt',
        'url' => 'http://127.0.0.1/secret.txt',
        'upload_mode' => 'remote',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('url');
});

it('downloads a remote file and writes it to the cloud disk', function () {
    Storage::fake('local');
    config()->set('cloud-storage.uploads.temp_disk', 'local');
    config()->set('cloud-storage.uploads.temp_path', 'testing-remote-upload');

    Http::preventStrayRequests();
    Http::fake([
        'files.example.com/archive.zip' => Http::response('remote-content', 200, [
            'Content-Length' => '14',
        ]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'status' => CloudTaskStatus::Queued,
        'target_path' => 'imports',
        'name' => 'archive.zip',
        'payload' => [
            'filename' => 'archive.zip',
            'size' => 0,
            'chunk_size' => 1,
            'total_chunks' => 1,
            'uploaded_chunks_count' => 0,
            'upload_mode' => 'remote',
            'remote_host' => 'files.example.com',
        ],
        'secret_payload' => [
            'url' => 'https://files.example.com/archive.zip',
            'headers' => [
                'Authorization' => 'Bearer secret-token',
            ],
        ],
    ]);

    $urlGuard = Mockery::mock(RemoteUploadUrlGuard::class);
    $urlGuard->shouldReceive('validate')
        ->once()
        ->with('https://files.example.com/archive.zip')
        ->andReturnNull();

    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('writeStream')
        ->once()
        ->with('imports/archive.zip', Mockery::on(function ($stream): bool {
            return is_resource($stream) && stream_get_contents($stream) === 'remote-content';
        }));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('disk')
        ->once()
        ->with(Mockery::on(fn (CloudConnection $cloudConnection): bool => $cloudConnection->is($connection)))
        ->andReturn($disk);
    $this->app->instance(CloudStorageManager::class, $manager);

    $cache = Mockery::mock(CloudStorageCache::class);
    $cache->shouldReceive('flushFolder')->once();
    $cache->shouldReceive('flushQuota')->once();

    (new RemoteUploadCloudTaskFileJob($task->id))->handle($cache, new CloudUploadTaskBroadcaster, $urlGuard);

    $task->refresh();

    expect($task->status)->toBe(CloudTaskStatus::Completed)
        ->and($task->result['path'])->toBe('imports/archive.zip')
        ->and($task->payload['size'])->toBe(14)
        ->and($task->payload['uploaded_chunks_count'])->toBe(1);

    Http::assertSentCount(2);
    Storage::disk('local')->assertMissing('testing-remote-upload/remote-'.$task->id.'.download');
});
