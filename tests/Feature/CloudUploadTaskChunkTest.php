<?php

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Jobs\UploadCloudTaskFileJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

it('increments uploaded_chunks_count and avoids recount on non-final chunk', function () {
    Storage::fake('local');
    config()->set('cloud-storage.uploads.temp_disk', 'local');
    config()->set('cloud-storage.uploads.chunk_size', 1024);

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->create([
        'type' => CloudTaskType::Upload,
        'status' => CloudTaskStatus::Pending,
        'payload' => [
            'upload_mode' => 'backend',
            'chunk_size' => 1024,
            'total_chunks' => 3,
            'uploaded_chunks_count' => 0,
        ],
    ]);

    Queue::fake();

    $file = UploadedFile::fake()->create('chunk.txt', 1);

    DB::enableQueryLog();

    // chunk 0
    $response = $this->actingAs($user)
        ->postJson(route('connections.upload-tasks.chunks.store', [$connection, $task]), [
            'chunk' => $file,
            'index' => 0,
        ]);

    $response->assertOk();

    $queries = DB::getQueryLog();
    $countQueries = collect($queries)->filter(fn ($q) => str_contains(strtolower($q['query']), 'select count('));
    expect($countQueries)->toBeEmpty(); // Should not run a count query for early chunks

    $task->refresh();
    expect($task->payload['uploaded_chunks_count'])->toBe(1);
    expect($task->status)->toBe(CloudTaskStatus::Uploading);
    Queue::assertNotPushed(UploadCloudTaskFileJob::class);
});

it('does not increment count for duplicate chunks', function () {
    Storage::fake('local');
    config()->set('cloud-storage.uploads.temp_disk', 'local');
    config()->set('cloud-storage.uploads.chunk_size', 1024);

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->create([
        'type' => CloudTaskType::Upload,
        'status' => CloudTaskStatus::Uploading,
        'payload' => [
            'upload_mode' => 'backend',
            'chunk_size' => 1024,
            'total_chunks' => 3,
            'uploaded_chunks_count' => 1,
        ],
    ]);

    // Simulate chunk 0 already exists
    $task->chunks()->create([
        'index' => 0,
        'size' => 1024,
    ]);

    Queue::fake();

    $file = UploadedFile::fake()->create('chunk.txt', 1);

    DB::enableQueryLog();

    // upload duplicate chunk 0
    $response = $this->actingAs($user)
        ->postJson(route('connections.upload-tasks.chunks.store', [$connection, $task]), [
            'chunk' => $file,
            'index' => 0,
        ]);

    $response->assertOk();

    $queries = DB::getQueryLog();
    $countQueries = collect($queries)->filter(fn ($q) => str_contains(strtolower($q['query']), 'select count('));

    expect($countQueries)->toBeEmpty(); // Should not run a count query for duplicate chunks

    $task->refresh();
    expect($task->payload['uploaded_chunks_count'])->toBe(1);
    Queue::assertNotPushed(UploadCloudTaskFileJob::class);
});

it('sets queued status and pushes job exactly once on final chunk', function () {
    Storage::fake('local');
    config()->set('cloud-storage.uploads.temp_disk', 'local');
    config()->set('cloud-storage.uploads.chunk_size', 1024);

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->create([
        'type' => CloudTaskType::Upload,
        'status' => CloudTaskStatus::Uploading,
        'payload' => [
            'upload_mode' => 'backend',
            'chunk_size' => 1024,
            'total_chunks' => 3,
            'uploaded_chunks_count' => 2,
        ],
    ]);

    $task->chunks()->createMany([
        ['index' => 0, 'size' => 1024],
        ['index' => 1, 'size' => 1024],
    ]);

    Queue::fake();

    $file = UploadedFile::fake()->create('chunk.txt', 0.5);

    // upload final chunk 2
    $response = $this->actingAs($user)
        ->postJson(route('connections.upload-tasks.chunks.store', [$connection, $task]), [
            'chunk' => $file,
            'index' => 2,
        ]);

    $response->assertOk();

    $task->refresh();
    expect($task->payload['uploaded_chunks_count'])->toBe(3);
    expect($task->status)->toBe(CloudTaskStatus::Queued);
    Queue::assertPushed(UploadCloudTaskFileJob::class, 1);

    // Send another duplicate final chunk, should return 422 because it's queued sequentially
    $response2 = $this->actingAs($user)
        ->postJson(route('connections.upload-tasks.chunks.store', [$connection, $task]), [
            'chunk' => $file,
            'index' => 2,
        ]);

    $response2->assertStatus(422);

    Queue::assertPushed(UploadCloudTaskFileJob::class, 1); // still 1
});
