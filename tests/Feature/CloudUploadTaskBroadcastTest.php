<?php

use App\Enums\CloudTaskStatus;
use App\Events\CloudUploadTaskUpdated;
use App\Jobs\UploadCloudTaskFileJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\CloudStorageManager;
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
use Illuminate\Broadcasting\BroadcastController;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Queue\Jobs\FakeJob;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Pusher\Pusher;

const BROADCAST_AUTH_ROUTE = '/testing/broadcasting/auth';

it('authorizes users to subscribe to their cloud task channel', function () {
    config()->set('broadcasting.default', 'reverb');
    config()->set('broadcasting.connections.reverb.key', 'testing');
    config()->set('broadcasting.connections.reverb.secret', 'testing');
    config()->set('broadcasting.connections.reverb.app_id', 'testing');
    app(BroadcastManager::class)->forgetDrivers();
    Route::post(BROADCAST_AUTH_ROUTE, '\\'.BroadcastController::class.'@authenticate')
        ->middleware('web');

    Broadcast::connection('reverb')->setPusher(new class extends Pusher
    {
        public function __construct()
        {
            // No-op stub for Pusher authorization in feature tests.
        }

        public function authorizeChannel(string $channel, string $socket_id, ?string $custom_data = null): string
        {
            return json_encode(['auth' => "testing:{$channel}:{$socket_id}"]);
        }
    });

    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    Broadcast::channel('users.{userId}.cloud-tasks', function ($user, $userId): bool {
        if (! is_numeric($userId)) {
            return false;
        }

        return (int) $user->id === (int) $userId;
    });

    $this->actingAs($user)
        ->postJson(BROADCAST_AUTH_ROUTE, [
            'socket_id' => '123.456',
            'channel_name' => "private-users.{$user->id}.cloud-tasks",
        ])
        ->assertOk();

    $this->actingAs($otherUser)
        ->postJson(BROADCAST_AUTH_ROUTE, [
            'socket_id' => '123.456',
            'channel_name' => "private-users.{$user->id}.cloud-tasks",
        ])
        ->assertForbidden();
});

it('serializes uploaded chunk indexes when the chunks relation is loaded', function () {
    $task = CloudTask::factory()->upload()->create();
    $task->chunks()->createMany([
        ['index' => 0, 'size' => 100, 'checksum' => null],
        ['index' => 1, 'size' => 100, 'checksum' => 'checksum-1'],
        ['index' => 2, 'size' => 50, 'checksum' => 'checksum-2'],
    ]);

    expect(CloudUploadTaskData::fromTask($task)['uploaded_chunks'])->toBe([]);
    expect(CloudUploadTaskData::fromTask($task->load('chunks'))['uploaded_chunks'])->toBe([0, 1, 2]);
});

it('broadcasts upload task snapshots on the users cloud task channel', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'target_path' => 'documents',
        'name' => 'proposal.pdf',
        'payload' => [
            'filename' => 'proposal.pdf',
            'mime_type' => 'application/pdf',
            'size' => 1_000,
            'chunk_size' => 100,
            'total_chunks' => 10,
            'uploaded_chunks_count' => 3,
        ],
    ]);

    $event = new CloudUploadTaskUpdated($task->refresh());

    expect($event->broadcastOn())->toEqual([new PrivateChannel("users.{$user->id}.cloud-tasks")]);
    expect($event->broadcastAs())->toBe('CloudUploadTaskUpdated');
    expect($event->broadcastWith())->toMatchArray([
        'id' => $task->id,
        'connection_id' => $connection->id,
        'name' => 'proposal.pdf',
        'type' => 'upload',
        'target_path' => 'documents',
        'status' => 'pending',
        'status_value' => 1,
        'payload' => [
            'filename' => 'proposal.pdf',
            'mime_type' => 'application/pdf',
            'size' => 1_000,
            'chunk_size' => 100,
            'total_chunks' => 10,
            'uploaded_chunks_count' => 3,
        ],
        'progress' => 30,
        'uploaded_chunks_count' => 3,
        'total_chunks' => 10,
        'result' => null,
        'error_message' => null,
        'uploaded_chunks' => [],
        'updated_at' => $task->updated_at?->toJSON(),
    ]);
});

it('broadcasts upload progress only when a five percent boundary changes', function () {
    $task = CloudTask::factory()->upload()->create([
        'payload' => [
            'total_chunks' => 100,
            'uploaded_chunks_count' => 4,
            'last_broadcast_progress' => 0,
        ],
    ]);
    $broadcaster = new CloudUploadTaskBroadcaster;

    Event::fake([CloudUploadTaskUpdated::class]);

    $broadcaster->broadcastProgressIfNeeded($task);

    Event::assertNotDispatched(CloudUploadTaskUpdated::class);
    expect($task->refresh()->payload['last_broadcast_progress'])->toBe(0);

    $task->forceFill([
        'payload' => [
            ...$task->payload,
            'uploaded_chunks_count' => 5,
        ],
    ])->save();

    $broadcaster->broadcastProgressIfNeeded($task);

    Event::assertDispatched(CloudUploadTaskUpdated::class, function (CloudUploadTaskUpdated $event) use ($task): bool {
        return $event->task->is($task) && $event->task->payload['last_broadcast_progress'] === 5;
    });
    expect($task->refresh()->payload['last_broadcast_progress'])->toBe(5);
});

it('does not repeat a completed progress broadcast after reaching one hundred percent', function () {
    $task = CloudTask::factory()->upload()->create([
        'payload' => [
            'total_chunks' => 100,
            'uploaded_chunks_count' => 100,
            'last_broadcast_progress' => 100,
        ],
    ]);
    $broadcaster = new CloudUploadTaskBroadcaster;

    Event::fake([CloudUploadTaskUpdated::class]);

    $broadcaster->broadcastProgressIfNeeded($task);

    Event::assertNotDispatched(CloudUploadTaskUpdated::class);
    expect($task->refresh()->payload['last_broadcast_progress'])->toBe(100);
});

it('broadcasts every explicit upload task status update', function () {
    $task = CloudTask::factory()->upload()->create([
        'payload' => [
            'total_chunks' => 100,
            'uploaded_chunks_count' => 4,
            'last_broadcast_progress' => 0,
        ],
    ]);
    $broadcaster = new CloudUploadTaskBroadcaster;

    Event::fake([CloudUploadTaskUpdated::class]);

    $broadcaster->broadcastStatus($task);

    Event::assertDispatched(CloudUploadTaskUpdated::class, function (CloudUploadTaskUpdated $event) use ($task): bool {
        return $event->task->is($task);
    });
});

it('does not start processing after a queued upload task is cancelled', function () {
    $task = CloudTask::factory()->upload()->create([
        'status' => CloudTaskStatus::Cancelled,
        'cancelled_at' => now(),
    ]);

    $cache = Mockery::mock(CloudStorageCache::class);
    $cache->shouldNotReceive('flushFolder');
    $cache->shouldNotReceive('flushQuota');

    Event::fake([CloudUploadTaskUpdated::class]);

    (new UploadCloudTaskFileJob($task->id))->handle($cache, new CloudUploadTaskBroadcaster, new ActivityLogger);

    expect($task->refresh()->status === CloudTaskStatus::Cancelled)->toBeTrue()
        ->and($task->processing_at)->toBeNull();

    Event::assertNotDispatched(CloudUploadTaskUpdated::class);
});

it('marks an upload task as failed when provider upload fails', function () {
    config()->set('cloud-storage.uploads.temp_disk', 'local');
    config()->set('cloud-storage.uploads.temp_path', 'testing-cloud-task-uploads');

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'status' => CloudTaskStatus::Queued,
        'target_path' => 'documents',
        'name' => 'proposal.pdf',
        'payload' => [
            'filename' => 'proposal.pdf',
            'total_chunks' => 1,
        ],
    ]);
    $task->chunks()->create([
        'index' => 0,
        'size' => 12,
        'checksum' => null,
    ]);

    Storage::disk('local')->put('testing-cloud-task-uploads/'.$task->id.'/0.part', 'file-content');

    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('writeStream')
        ->once()
        ->andThrow(new RuntimeException('cURL error 60: SSL certificate problem'));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('disk')
        ->once()
        ->with(Mockery::on(fn (CloudConnection $cloudConnection): bool => $cloudConnection->is($connection)))
        ->andReturn($disk);
    $this->app->instance(CloudStorageManager::class, $manager);

    $cache = Mockery::mock(CloudStorageCache::class);
    $cache->shouldNotReceive('flushFolder');
    $cache->shouldNotReceive('flushQuota');

    Event::fake([CloudUploadTaskUpdated::class]);

    // Simulate the final attempt so the job marks Failed instead of requeueing.
    $job = new UploadCloudTaskFileJob($task->id);
    $fakeJob = new FakeJob;
    $fakeJob->attempts = $job->tries;
    $job->setJob($fakeJob);

    expect(fn () => $job->handle($cache, new CloudUploadTaskBroadcaster, new ActivityLogger))
        ->toThrow(RuntimeException::class, 'cURL error 60');

    $task->refresh();

    expect($task->status === CloudTaskStatus::Failed)->toBeTrue()
        ->and($task->error_message)->toBe('cURL error 60: SSL certificate problem')
        ->and($task->failed_at)->not->toBeNull();

    Event::assertDispatched(CloudUploadTaskUpdated::class, function (CloudUploadTaskUpdated $event) use ($task): bool {
        return $event->task->is($task)
            && $event->task->status === CloudTaskStatus::Failed;
    });

    Storage::disk('local')->deleteDirectory('testing-cloud-task-uploads');
});

it('does not cancel an upload task after processing starts', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'status' => CloudTaskStatus::Processing,
        'processing_at' => now(),
    ]);

    Event::fake([CloudUploadTaskUpdated::class]);

    $this->actingAs($user)
        ->deleteJson(route('connections.upload-tasks.destroy', [$connection, $task]))
        ->assertOk()
        ->assertJsonPath('status', 'processing');

    expect($task->refresh()->status === CloudTaskStatus::Processing)->toBeTrue()
        ->and($task->cancelled_at)->toBeNull();

    Event::assertNotDispatched(CloudUploadTaskUpdated::class);
});
