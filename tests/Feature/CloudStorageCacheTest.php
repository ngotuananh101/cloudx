<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

it('caches folder listings by connection and path', function () {
    config(['cloud-storage.cache.store' => 'array']);
    Cache::store('array')->flush();

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $cache = app(CloudStorageCache::class);
    $firstCallbackCalls = 0;
    $secondCallbackCalls = 0;
    $cachedListing = [
        ['id' => 'docs', 'path' => 'Projects/docs', 'name' => 'docs', 'type' => 'folder', 'size' => 0, 'updatedAt' => '--', 'isDirectory' => true],
    ];

    $firstResult = $cache->rememberFolderListing($connection, 'Projects', function () use (&$firstCallbackCalls, $cachedListing): array {
        $firstCallbackCalls++;

        return $cachedListing;
    });

    $secondResult = $cache->rememberFolderListing($connection, 'Projects', function () use (&$secondCallbackCalls): array {
        $secondCallbackCalls++;

        return [
            ['id' => 'fresh', 'path' => 'Projects/fresh.txt', 'name' => 'fresh.txt', 'type' => 'document', 'size' => 10, 'updatedAt' => '--', 'isDirectory' => false],
        ];
    });

    expect($firstResult)->toBe($cachedListing)
        ->and($secondResult)->toBe($cachedListing)
        ->and($firstCallbackCalls)->toBe(1)
        ->and($secondCallbackCalls)->toBe(0);
});
