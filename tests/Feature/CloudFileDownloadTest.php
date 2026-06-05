<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink;
use App\Services\CloudStorage\PathEncoder;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('redirects to the direct download link when the connector provides one', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = new class implements CloudProviderConnector, ProvidesDirectDownloadLink
    {
        public function provider(): CloudProvider
        {
            return CloudProvider::ONEDRIVE();
        }

        public function redirectUrl(): string
        {
            return 'https://example.com';
        }

        public function handleCallback(\Illuminate\Http\Request $request): \App\Data\ConnectedAccountData
        {
            throw new RuntimeException('Not used.');
        }

        public function disk(CloudConnection $connection): Filesystem
        {
            throw new RuntimeException('Disk should not be called when direct link is available.');
        }

        public function capabilities(): \App\Data\ProviderCapabilities
        {
            return new \App\Data\ProviderCapabilities(true, true, true, true, true, false);
        }

        public function directDownloadLink(CloudConnection $connection, string $path): ?string
        {
            expect($path)->toBe('docs/file.pdf');

            return 'https://onedrive.example.com/download?token=abc';
        }
    };

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->andReturn($connector);
    $manager->shouldNotReceive('disk');

    $this->app->instance(CloudStorageManager::class, $manager);

    $this->actingAs($user)
        ->get(route('cloud.files.download', [
            'connection' => $connection,
            'path' => PathEncoder::encode('docs/file.pdf'),
        ]))
        ->assertRedirect('https://onedrive.example.com/download?token=abc');
});

it('streams file contents from the disk when no direct link is available', function () {
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
        ->get(route('cloud.files.download', [
            'connection' => $connection,
            'path' => PathEncoder::encode('docs/readme.txt'),
        ]))
        ->assertOk()
        ->assertHeader('Content-Type', 'text/plain; charset=utf-8')
        ->assertHeader('Content-Length', '11')
        ->assertHeader('Content-Disposition', 'attachment; filename=readme.txt');
});

it('falls back to streaming when ProvidesDirectDownloadLink returns null', function () {
    Storage::fake('dropbox-test');
    Storage::disk('dropbox-test')->put('file.txt', 'contents');

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Dropbox',
        'provider' => CloudProvider::DROPBOX,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = new class implements CloudProviderConnector, ProvidesDirectDownloadLink
    {
        public function provider(): CloudProvider
        {
            return CloudProvider::DROPBOX();
        }

        public function redirectUrl(): string
        {
            return '';
        }

        public function handleCallback(\Illuminate\Http\Request $request): \App\Data\ConnectedAccountData
        {
            throw new RuntimeException('Not used.');
        }

        public function disk(CloudConnection $connection): Filesystem
        {
            return Storage::disk('dropbox-test');
        }

        public function capabilities(): \App\Data\ProviderCapabilities
        {
            return new \App\Data\ProviderCapabilities(true, true, true, true, true, false);
        }

        public function directDownloadLink(CloudConnection $connection, string $path): ?string
        {
            return null;
        }
    };

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->andReturn($connector);
    $manager->shouldReceive('disk')->zeroOrMoreTimes()->with(Mockery::on(fn ($c) => $c->id === $connection->id))->andReturn(Storage::disk('dropbox-test'));

    $this->app->instance(CloudStorageManager::class, $manager);

    $this->actingAs($user)
        ->get(route('cloud.files.download', [
            'connection' => $connection,
            'path' => PathEncoder::encode('file.txt'),
        ]))
        ->assertOk();
});

it('forbids non-owners from downloading a file', function () {
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
        ->get(route('cloud.files.download', [
            'connection' => $connection,
            'path' => PathEncoder::encode('file.txt'),
        ]))
        ->assertForbidden();
});

it('returns 404 when the file does not exist on disk', function () {
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
        ->get(route('cloud.files.download', [
            'connection' => $connection,
            'path' => PathEncoder::encode('missing.txt'),
        ]))
        ->assertNotFound();
});
