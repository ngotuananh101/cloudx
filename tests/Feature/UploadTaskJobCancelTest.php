<?php

use App\Enums\CloudProvider;
use App\Enums\CloudTaskStatus;
use App\Jobs\UploadCloudTaskFileJob;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\CloudStorageManager;
use App\Support\CloudUploadTaskBroadcaster;
use Illuminate\Support\Facades\Storage;

it('stops and cleans up when cancelled during processing without failing', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create([
        'provider' => CloudProvider::GOOGLE_DRIVE,
    ]);

    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'status' => CloudTaskStatus::Queued,
        'payload' => [
            'filename' => 'test.txt',
            'total_chunks' => 6,
            'size' => 100,
        ],
    ]);

    $tempDisk = Storage::fake('local');
    config(['cloud-storage.uploads.temp_disk' => 'local']);
    config(['cloud-storage.uploads.temp_path' => 'cloud-task-uploads']);

    for ($i = 0; $i < 6; $i++) {
        $tempDisk->put("cloud-task-uploads/{$task->id}/{$i}.part", 'chunk');
        $task->chunks()->create([
            'index' => $i,
            'size' => 5,
            'hash' => 'dummy',
        ]);
    }

    $broadcaster = Mockery::mock(CloudUploadTaskBroadcaster::class)->makePartial();
    $broadcaster->shouldReceive('broadcastStatus')->andReturnUsing(function ($t) use ($task) {
        if ($t->status === CloudTaskStatus::Processing) {
            $task->update(['status' => CloudTaskStatus::Cancelled]);
        }
    });

    $job = new UploadCloudTaskFileJob($task->id);

    $job->handle(
        app(CloudStorageCache::class),
        $broadcaster,
        app(ActivityLogger::class)
    );

    $task->refresh();
    expect($task->status)->toBe(CloudTaskStatus::Cancelled);
    $tempDisk->assertMissing("cloud-task-uploads/{$task->id}/0.part");
});

it('uses stream concat for allowlist providers and avoids merged bin', function () {
    $user = User::factory()->create();
    // Use an existing factory state or create a local connection to avoid S3/FTP config exceptions
    $connection = CloudConnection::factory()->for($user)->create([
        'provider' => CloudProvider::FTP,
    ]);

    // Force connection getDisk to return our fake disk
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'status' => CloudTaskStatus::Queued,
        'payload' => [
            'filename' => 'test.txt',
            'total_chunks' => 2,
            'size' => 100,
        ],
    ]);

    $tempDisk = Storage::fake('local');
    config(['cloud-storage.uploads.temp_disk' => 'local']);
    config(['cloud-storage.uploads.temp_path' => 'cloud-task-uploads']);

    $tempDisk->put("cloud-task-uploads/{$task->id}/0.part", 'hello');
    $tempDisk->put("cloud-task-uploads/{$task->id}/1.part", 'world');
    $task->chunks()->createMany([
        ['index' => 0, 'size' => 5, 'hash' => 'dummy'],
        ['index' => 1, 'size' => 5, 'hash' => 'dummy'],
    ]);

    // Hook into getDisk by mocking CloudStorageManager
    $managerMock = Mockery::mock(CloudStorageManager::class);
    $managerMock->shouldReceive('disk')->andReturn(Storage::fake('ftp_fake'));
    app()->instance(CloudStorageManager::class, $managerMock);

    $job = new UploadCloudTaskFileJob($task->id);

    $cacheMock = Mockery::mock(CloudStorageCache::class);
    $cacheMock->shouldReceive('flushFolder')->andReturnNull();
    $cacheMock->shouldReceive('flushQuota')->andReturnNull();

    $job->handle(
        $cacheMock,
        app(CloudUploadTaskBroadcaster::class),
        app(ActivityLogger::class)
    );

    $task->refresh();
    expect($task->status)->toBe(CloudTaskStatus::Completed);

    $connectionDisk = Storage::disk('ftp_fake');
    expect($connectionDisk->exists('test.txt'))->toBeTrue();
    expect($connectionDisk->get('test.txt'))->toBe('helloworld');

    // Should NOT have created merged.bin
    $tempDisk->assertMissing("cloud-task-uploads/{$task->id}/merged.bin");
    $tempDisk->assertMissing("cloud-task-uploads/{$task->id}/0.part");
    $tempDisk->assertMissing("cloud-task-uploads/{$task->id}/1.part");
});
