<?php

use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Data\CloudFileData;

it('returns only directories', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    $mockBrowser = Mockery::mock(CloudFileBrowser::class);
    $mockBrowser->shouldReceive('listDirectories')
        ->once()
        ->with(Mockery::type(CloudConnection::class), 'test_path')
        ->andReturn([
            (new CloudFileData('2', 'test_path/folder1', 'folder1', 'folder', 0, null, true))->toArray(),
            (new CloudFileData('3', 'test_path/folder2', 'folder2', 'folder', 0, null, true))->toArray(),
        ]);

    $this->instance(CloudFileBrowser::class, $mockBrowser);

    $response = $this->actingAs($user)->getJson(route('connections.folders.index', [
        'connection' => $connection->id,
        'path' => 'test_path',
    ]));

    $response->assertStatus(200);
    $data = $response->json();
    
    expect($data)->toHaveCount(2);
    expect($data[0]['name'])->toBe('folder1');
    expect($data[1]['name'])->toBe('folder2');
});

it('aborts if connection belongs to another user', function () {
    $user1 = User::factory()->create();
    $user2 = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user1->id]);

    $response = $this->actingAs($user2)->getJson(route('connections.folders.index', [
        'connection' => $connection->id,
    ]));

    $response->assertStatus(403);
});
