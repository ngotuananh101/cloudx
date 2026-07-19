<?php

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\BrowsesCloudFiles;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\CloudStorage\PathEncoder;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

const BROWSER_GOOGLE_DRIVE_NAME = 'Google Drive';

it('lists Google Drive files via Flysystem with normalized metadata and sorting', function () {
    Storage::fake('google-test');
    Storage::disk('google-test')->put('docs/report.pdf', 'contents');
    Storage::disk('google-test')->put('zeta.txt', 'contents');
    Storage::disk('google-test')->put('alpha.txt', 'contents');
    Storage::disk('google-test')->put('.hidden.txt', 'contents');

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => BROWSER_GOOGLE_DRIVE_NAME,
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::type(CloudProvider::class))->andReturn($connector);
    $manager->shouldReceive('disk')->once()->with($connection)->andReturn(Storage::disk('google-test'));

    $cache = Mockery::mock(CloudStorageCache::class);
    $cache->shouldReceive('rememberFolderListing')->once()->andReturnUsing(fn (CloudConnection $connection, string $path, Closure $callback): array => $callback());

    $browser = new CloudFileBrowser($manager, $cache);

    $files = $browser->list($connection, '');

    expect($files)->toHaveCount(3)
        ->and(array_column($files, 'name'))->toBe(['docs', 'alpha.txt', 'zeta.txt'])
        ->and($files[0]['type'])->toBe('folder')
        ->and($files[1]['type'])->toBe('document')
        ->and($files[1]['updatedAt'])->not->toBeNull();
});

it('lists files via a direct browsing connector with normalized metadata and sorting', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = new class implements BrowsesCloudFiles, CloudProviderConnector
    {
        public function provider(): CloudProvider
        {
            return CloudProvider::ONEDRIVE;
        }

        public function redirectUrl(): string
        {
            return 'https://example.com';
        }

        public function handleCallback(Request $request): ConnectedAccountData
        {
            throw new LogicException('handleCallback is not used in this test.');
        }

        public function disk(CloudConnection $connection): Filesystem
        {
            throw new LogicException('OneDrive disk should not be called.');
        }

        public function capabilities(): ProviderCapabilities
        {
            return new ProviderCapabilities(true, true, true, true, true, false, false);
        }

        /**
         * @return array<int, array{id: string, path: string, name: string, isDirectory: bool, size: int, lastModifiedTimestamp: int|null}>
         */
        public function listContents(CloudConnection $connection, string $path): array
        {
            expect($path)->toBe('Projects');

            return [
                ['id' => 'file-b', 'path' => 'Projects/B.txt', 'name' => 'B.txt', 'isDirectory' => false, 'size' => 20, 'lastModifiedTimestamp' => 1717200000],
                ['id' => 'hidden', 'path' => 'Projects/.hidden', 'name' => '.hidden', 'isDirectory' => false, 'size' => 10, 'lastModifiedTimestamp' => 1717200000],
                ['id' => 'folder-a', 'path' => 'Projects/Alpha', 'name' => 'Alpha', 'isDirectory' => true, 'size' => 0, 'lastModifiedTimestamp' => null],
                ['id' => 'file-a', 'path' => 'Projects/a.pdf', 'name' => 'a.pdf', 'isDirectory' => false, 'size' => 10, 'lastModifiedTimestamp' => 1717286400],
            ];
        }
    };

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider === CloudProvider::ONEDRIVE
    ))->andReturn($connector);
    $manager->shouldNotReceive('disk');

    $cache = Mockery::mock(CloudStorageCache::class);
    $cache->shouldReceive('rememberFolderListing')->once()->andReturnUsing(fn (CloudConnection $connection, string $path, Closure $callback): array => $callback());

    $browser = new CloudFileBrowser($manager, $cache);

    $files = $browser->list($connection, PathEncoder::encode('Projects'));

    expect($files)->toHaveCount(3)
        ->and(array_column($files, 'name'))->toBe(['Alpha', 'a.pdf', 'B.txt'])
        ->and($files[0]['type'])->toBe('folder')
        ->and($files[0]['updatedAt'])->toBe('--')
        ->and($files[1]['type'])->toBe('document')
        ->and($files[1]['updatedAt'])->toBe('Jun 2, 2024')
        ->and($files[1]['size'])->toBe(10);
});

it('lists one drive files through the flysystem disk path', function () {
    Storage::fake('onedrive-test');
    Storage::disk('onedrive-test')->put('Docs/readme.txt', 'contents');

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider === CloudProvider::ONEDRIVE
    ))->andReturn($connector);
    $manager->shouldReceive('disk')->once()->with($connection)->andReturn(Storage::disk('onedrive-test'));

    $cache = Mockery::mock(CloudStorageCache::class);
    $cache->shouldReceive('rememberFolderListing')->once()->andReturnUsing(fn (CloudConnection $connection, string $path, Closure $callback): array => $callback());

    $browser = new CloudFileBrowser($manager, $cache);

    $files = $browser->list($connection, PathEncoder::encode('Docs'));

    expect($files)->toHaveCount(1)
        ->and($files[0]['path'])->toBe('Docs/readme.txt')
        ->and($files[0]['name'])->toBe('readme.txt');
});

it('forbids non-owners from browsing a storage connection', function () {
    $owner = User::factory()->create();
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => BROWSER_GOOGLE_DRIVE_NAME,
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)
        ->get(route('storage.index', $connection))
        ->assertForbidden();
});

it('renders owner storage browser with capabilities and files', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => BROWSER_GOOGLE_DRIVE_NAME,
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $browser = Mockery::mock(CloudFileBrowser::class);
    $browser->shouldReceive('decodedPath')->once()->with('')->andReturn('');
    $browser->shouldReceive('list')->once()->with(Mockery::type(CloudConnection::class), '')->andReturn([
        ['id' => 'docs', 'path' => 'docs', 'name' => 'docs', 'type' => 'folder', 'size' => 0, 'updatedAt' => '--', 'isDirectory' => true],
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('capabilities')->once()->andReturn(new ProviderCapabilities(true, true, false, false, true, false, false));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->twice()->with(Mockery::type(CloudProvider::class))->andReturn($connector);

    $this->app->instance(CloudFileBrowser::class, $browser);
    $this->app->instance(CloudStorageManager::class, $manager);

    $this->actingAs($user)
        ->get(route('storage.index', $connection))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('files/index')
            ->where('connection.id', $connection->id)
            ->where('connection.capabilities.browse', true)
            ->where('connection.capabilities.download', false)
            ->has('files', 1)
            ->where('files.0.name', 'docs')
            ->etc()
        );
});

it('renders an empty file list and flashes an error when browsing fails', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => BROWSER_GOOGLE_DRIVE_NAME,
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $browser = Mockery::mock(CloudFileBrowser::class);
    $browser->shouldReceive('decodedPath')->once()->with('')->andReturn('');
    $browser->shouldReceive('list')->once()->andThrow(new RuntimeException('Provider failed.'));

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('capabilities')->once()->andReturn(new ProviderCapabilities(true, true, true, true, true, false, false));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->twice()->andReturn($connector);

    $this->app->instance(CloudFileBrowser::class, $browser);
    $this->app->instance(CloudStorageManager::class, $manager);

    $this->actingAs($user)
        ->get(route('storage.index', $connection))
        ->assertOk()
        ->assertSessionHas('error', 'Could not retrieve files from this storage.')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('files/index')
            ->where('files', [])
            ->etc()
        );
});
