<?php

use App\Models\CloudConnection;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use App\Enums\CloudProvider;

it('moves a file to a new folder', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id, 'provider' => CloudProvider::FTP]);
    
    Storage::fake('ftp');
    Storage::disk('ftp')->put('source.txt', 'content');
    Storage::disk('ftp')->makeDirectory('dest_folder');

    // Mock CloudStorageManager to return the fake disk
    $mockManager = Mockery::mock(\App\Services\CloudStorage\CloudStorageManager::class);
    $mockManager->shouldReceive('disk')
        ->with(Mockery::type(CloudConnection::class))
        ->andReturn(Storage::disk('ftp'));
    $this->instance(\App\Services\CloudStorage\CloudStorageManager::class, $mockManager);

    $response = $this->actingAs($user)->post(route('connections.items.move', $connection), [
        'source_path' => 'source.txt',
        'destination_folder' => 'dest_folder',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success', 'Item moved.');

    expect(Storage::disk('ftp')->exists('dest_folder/source.txt'))->toBeTrue();
    expect(Storage::disk('ftp')->exists('source.txt'))->toBeFalse();
});

it('cannot move a root directory', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id, 'provider' => CloudProvider::FTP]);

    $response = $this->actingAs($user)->post(route('connections.items.move', $connection), [
        'source_path' => '',
        'destination_folder' => 'dest_folder',
    ]);

    $response->assertSessionHasErrors(['source_path']);
});

it('cannot move a folder into itself', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id, 'provider' => CloudProvider::FTP]);

    $response = $this->actingAs($user)->post(route('connections.items.move', $connection), [
        'source_path' => 'my_folder',
        'destination_folder' => 'my_folder/subfolder',
    ]);

    $response->assertSessionHasErrors(['destination_folder']);
});
