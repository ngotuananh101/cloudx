<?php

use App\Enums\ActivityAction;
use App\Enums\CloudProvider;
use App\Models\ActivityLog;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Support\Facades\Storage;

const BULK_REPORT_PATH = 'documents/report.txt';
const BULK_SOURCE_PATH = 'inbox/source.txt';

beforeEach(function () {
    Storage::fake('ftp');
});

function bindFakeCloudDisk(): void
{
    $mockManager = Mockery::mock(CloudStorageManager::class);
    $mockManager->shouldReceive('disk')
        ->with(Mockery::type(CloudConnection::class))
        ->andReturn(Storage::disk('ftp'));

    app()->instance(CloudStorageManager::class, $mockManager);
}

it('deletes multiple files and folders', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::FTP,
    ]);

    Storage::disk('ftp')->put(BULK_REPORT_PATH, 'report');
    Storage::disk('ftp')->put('documents/archive/photo.jpg', 'photo');
    Storage::disk('ftp')->put('keep.txt', 'keep');
    bindFakeCloudDisk();

    $response = $this->actingAs($user)->delete(route('connections.items.destroy', $connection), [
        'items' => [
            ['path' => BULK_REPORT_PATH, 'is_directory' => false],
            ['path' => 'documents/archive', 'is_directory' => true],
        ],
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success', '2 items deleted.');

    expect(Storage::disk('ftp')->exists(BULK_REPORT_PATH))->toBeFalse();
    expect(Storage::disk('ftp')->exists('documents/archive/photo.jpg'))->toBeFalse();
    expect(Storage::disk('ftp')->exists('keep.txt'))->toBeTrue();

    expect(ActivityLog::query()->where('user_id', $user->id)->count())->toBe(2)
        ->and(ActivityLog::query()->pluck('action')->unique()->all())->toBe([ActivityAction::FileDeleted]);
});

it('moves multiple files and folders to a shared destination', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::FTP,
    ]);

    Storage::disk('ftp')->put(BULK_SOURCE_PATH, 'content');
    Storage::disk('ftp')->put('inbox/folder/nested.txt', 'nested');
    Storage::disk('ftp')->makeDirectory('dest_folder');
    bindFakeCloudDisk();

    $response = $this->actingAs($user)->post(route('connections.items.move', $connection), [
        'destination_folder' => 'dest_folder',
        'items' => [
            ['path' => BULK_SOURCE_PATH, 'is_directory' => false],
            ['path' => 'inbox/folder', 'is_directory' => true],
        ],
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success', '2 items moved.');

    expect(Storage::disk('ftp')->exists('dest_folder/source.txt'))->toBeTrue();
    expect(Storage::disk('ftp')->exists('dest_folder/folder/nested.txt'))->toBeTrue();
    expect(Storage::disk('ftp')->exists(BULK_SOURCE_PATH))->toBeFalse();
    expect(Storage::disk('ftp')->exists('inbox/folder/nested.txt'))->toBeFalse();

    expect(ActivityLog::query()->where('user_id', $user->id)->count())->toBe(2)
        ->and(ActivityLog::query()->pluck('action')->unique()->all())->toBe([ActivityAction::FileMoved]);
});

it('limits bulk item actions to one hundred items', function (string $method, string $routeName) {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::FTP,
    ]);

    $items = collect(range(1, 101))
        ->map(fn (int $number): array => [
            'path' => "file-{$number}.txt",
            'is_directory' => false,
        ])
        ->all();

    $response = $this->actingAs($user)->{$method}(route($routeName, $connection), [
        'destination_folder' => 'dest',
        'items' => $items,
    ]);

    $response->assertSessionHasErrors(['items']);
})->with([
    'delete' => ['delete', 'connections.items.destroy'],
    'move' => ['post', 'connections.items.move'],
]);
