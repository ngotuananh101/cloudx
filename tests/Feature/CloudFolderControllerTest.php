<?php

use App\Enums\ActivityAction;
use App\Enums\CloudProvider;
use App\Models\ActivityLog;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Support\Facades\Storage;

it('creates a folder and logs the activity', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id, 'provider' => CloudProvider::FTP]);

    Storage::fake('ftp');

    $mockManager = Mockery::mock(CloudStorageManager::class);
    $mockManager->shouldReceive('disk')
        ->with(Mockery::type(CloudConnection::class))
        ->andReturn(Storage::disk('ftp'));
    $this->instance(CloudStorageManager::class, $mockManager);

    $response = $this->actingAs($user)->post(route('connections.folders.store', $connection), [
        'path' => 'documents',
        'name' => 'invoices',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success', 'Folder created.');

    expect(Storage::disk('ftp')->directoryExists('documents/invoices'))->toBeTrue();

    $log = ActivityLog::query()->where('user_id', $user->id)->sole();
    expect($log->action)->toBe(ActivityAction::FolderCreated)
        ->and($log->subject_name)->toBe('invoices')
        ->and($log->target_name)->toBe('documents')
        ->and($log->cloud_connection_id)->toBe($connection->id);
});

it('rejects invalid folder names', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id, 'provider' => CloudProvider::FTP]);

    $response = $this->actingAs($user)->post(route('connections.folders.store', $connection), [
        'path' => '',
        'name' => '../etc',
    ]);

    $response->assertSessionHasErrors(['name']);
    expect(ActivityLog::query()->count())->toBe(0);
});
