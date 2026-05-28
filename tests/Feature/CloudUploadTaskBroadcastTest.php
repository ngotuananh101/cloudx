<?php

use App\Events\CloudUploadTaskUpdated;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use Illuminate\Broadcasting\BroadcastController;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;
use Pusher\Pusher;

it('authorizes users to subscribe to their cloud task channel', function () {
    config()->set('broadcasting.default', 'reverb');
    config()->set('broadcasting.connections.reverb.key', 'testing');
    config()->set('broadcasting.connections.reverb.secret', 'testing');
    config()->set('broadcasting.connections.reverb.app_id', 'testing');
    app(BroadcastManager::class)->forgetDrivers();
    Route::post('/testing/broadcasting/auth', '\\'.BroadcastController::class.'@authenticate')
        ->middleware('web');

    Broadcast::connection('reverb')->setPusher(new class extends Pusher
    {
        public function __construct() {}

        public function authorizeChannel(string $channel, string $socket_id): string
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
        ->postJson('/testing/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => "private-users.{$user->id}.cloud-tasks",
        ])
        ->assertOk();

    $this->actingAs($otherUser)
        ->postJson('/testing/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => "private-users.{$user->id}.cloud-tasks",
        ])
        ->assertForbidden();
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
        'target_path' => 'documents',
        'status' => 'pending',
        'progress' => 30,
        'uploaded_chunks_count' => 3,
        'total_chunks' => 10,
        'error_message' => null,
    ]);
});
