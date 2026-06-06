<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\CloudStorage\PathEncoder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('streams file contents from the disk for preview', function () {
    Storage::fake('telegram-test');
    Storage::disk('telegram-test')->put('docs/readme.txt', 'hello world');

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Telegram',
        'provider' => CloudProvider::TELEGRAM,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('disk')->once()->with(Mockery::on(fn ($c) => $c->id === $connection->id))->andReturn(Storage::disk('telegram-test'));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $this->actingAs($user)
        ->get(route('cloud.files.preview', [
            'connection' => $connection,
            'path' => PathEncoder::encode('docs/readme.txt'),
        ]))
        ->assertOk()
        ->assertHeader('Content-Type', 'text/plain; charset=utf-8')
        ->assertHeader('Content-Length', '11')
        ->assertHeader('Content-Disposition', 'inline; filename="readme.txt"');
});

it('forbids non-owners from previewing a file', function () {
    $owner = User::factory()->create();
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)
        ->get(route('cloud.files.preview', [
            'connection' => $connection,
            'path' => PathEncoder::encode('file.txt'),
        ]))
        ->assertForbidden();
});

it('returns 404 when the file does not exist on disk for preview', function () {
    Storage::fake('telegram-test');

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Telegram',
        'provider' => CloudProvider::TELEGRAM,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('disk')->once()->with(Mockery::on(fn ($c) => $c->id === $connection->id))->andReturn(Storage::disk('telegram-test'));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $this->actingAs($user)
        ->get(route('cloud.files.preview', [
            'connection' => $connection,
            'path' => PathEncoder::encode('missing.txt'),
        ]))
        ->assertNotFound();
});
