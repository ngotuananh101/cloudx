<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\CloudShare;
use App\Models\User;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Connectors\TelegramConnector;
use App\Services\CloudStorage\PathEncoder;
use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramClient;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use League\Flysystem\Filesystem;

const MIME_PNG = 'image/png';
const TG_FILE_ID = '12345';
const COMPONENT_SHARE_VIEW = 'share/view';
const PROJECT_SRC_PATH = 'Projects/src';

it('renders error page when share is not found', function () {
    $this->get(route('share.view', ['uuid' => 'nonexistent-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/error')
            ->where('reason', 'not_found')
        );
});

it('renders error page when share has expired', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'expired-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'file.txt',
        'name' => 'file.txt',
        'is_directory' => false,
        'type' => 'public',
        'expires_at' => now()->subDay(),
    ]);

    $this->get(route('share.view', ['uuid' => 'expired-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/error')
            ->where('reason', 'expired')
        );
});

it('renders password page when share is password protected and not verified', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'locked-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'secret.pdf',
        'name' => 'secret.pdf',
        'is_directory' => false,
        'type' => 'password',
        'password' => Hash::make('mypass'),
    ]);

    $this->get(route('share.view', ['uuid' => 'locked-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/password')
            ->where('uuid', 'locked-uuid')
            ->where('share.name', 'secret.pdf')
        );
});

it('renders view page for public file share', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'public-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'report.pdf',
        'name' => 'report.pdf',
        'is_directory' => false,
        'type' => 'public',
    ]);

    $this->get(route('share.view', ['uuid' => 'public-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component(COMPONENT_SHARE_VIEW)
            ->where('share.uuid', 'public-uuid')
            ->where('share.name', 'report.pdf')
            ->where('isDirectory', false)
            ->has('file')
            ->where('file.name', 'report.pdf')
        );
});

it('shows the real file size from extra_info for single file shares', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'sized-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'docs/report.pdf',
        'name' => 'report.pdf',
        'is_directory' => false,
        'type' => 'public',
        'extra_info' => ['size' => 12345],
    ]);

    $this->get(route('share.view', ['uuid' => 'sized-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component(COMPONENT_SHARE_VIEW)
            ->where('isDirectory', false)
            ->where('file.size', 12345)
        );
});

it('shows zero size for single file shares created before extra_info was added', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'legacy-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'docs/legacy.pdf',
        'name' => 'legacy.pdf',
        'is_directory' => false,
        'type' => 'public',
    ]);

    $this->get(route('share.view', ['uuid' => 'legacy-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component(COMPONENT_SHARE_VIEW)
            ->where('isDirectory', false)
            ->where('file.size', 0)
        );
});

it('renders view page for public folder share with file listing', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'folder-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'Projects',
        'name' => 'Projects',
        'is_directory' => true,
        'type' => 'public',
    ]);

    $browser = Mockery::mock(CloudFileBrowser::class);
    $browser->shouldReceive('list')->andReturn([
        [
            'id' => 'Projects/readme.md',
            'path' => 'Projects/readme.md',
            'name' => 'readme.md',
            'type' => 'document',
            'size' => 512,
            'updatedAt' => 'Jun 8, 2026',
            'isDirectory' => false,
        ],
        [
            'id' => PROJECT_SRC_PATH,
            'path' => PROJECT_SRC_PATH,
            'name' => 'src',
            'type' => 'folder',
            'size' => 0,
            'updatedAt' => '--',
            'isDirectory' => true,
        ],
    ]);
    $this->app->instance(CloudFileBrowser::class, $browser);

    $this->get(route('share.view', ['uuid' => 'folder-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component(COMPONENT_SHARE_VIEW)
            ->where('share.uuid', 'folder-uuid')
            ->where('isDirectory', true)
            ->has('files', 2)
            ->where('currentPath', 'Projects')
        );
});

it('renders folder subfolder when path query param is provided', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'folder-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'Projects',
        'name' => 'Projects',
        'is_directory' => true,
        'type' => 'public',
    ]);

    $browser = Mockery::mock(CloudFileBrowser::class);
    $browser->shouldReceive('list')->andReturn([
        [
            'id' => PROJECT_SRC_PATH.'/index.ts',
            'path' => PROJECT_SRC_PATH.'/index.ts',
            'name' => 'index.ts',
            'type' => 'code',
            'size' => 256,
            'updatedAt' => 'Jun 9, 2026',
            'isDirectory' => false,
        ],
    ]);
    $this->app->instance(CloudFileBrowser::class, $browser);

    $encodedPath = PathEncoder::encode(PROJECT_SRC_PATH);

    $this->get(route('share.view', ['uuid' => 'folder-uuid', 'path' => $encodedPath]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component(COMPONENT_SHARE_VIEW)
            ->where('isDirectory', true)
            ->has('files', 1)
            ->where('currentPath', PROJECT_SRC_PATH)
        );
});

it('uses the original telegram file name for shared downloads instead of the message id', function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);

    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/metadata*' => Http::response([
            'message_id' => 12345,
            'original_name' => 'photo.png',
            'size' => 11,
            'mime_type' => MIME_PNG,
        ]),
        'http://localhost:8000/read*' => Http::response('file contents', 200, ['Content-Type' => MIME_PNG]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'My Telegram',
        'provider' => CloudProvider::TELEGRAM,
        'credentials' => ['session_id' => 'sess123'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => 'tg-download-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => TG_FILE_ID,
        'name' => 'photo.png',
        'is_directory' => false,
        'type' => 'public',
    ]);

    $connector = new class($connection) extends TelegramConnector
    {
        public function __construct(private CloudConnection $conn) {}

        public function disk(CloudConnection $connection): Illuminate\Contracts\Filesystem\Filesystem
        {
            $client = new TelegramClient(
                url: (string) config('services.python-service.url'),
                token: (string) config('services.python-service.token'),
                sessionId: (string) ($this->conn->credentials['session_id'] ?? ''),
            );

            return new FilesystemAdapter(
                new Filesystem(new TelegramAdapter($client)),
                new TelegramAdapter($client),
                [],
            );
        }
    };

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->andReturn($connector);
    $this->app->instance(CloudStorageManager::class, $manager);

    $this->get(route('share.download', ['uuid' => 'tg-download-uuid', 'path' => PathEncoder::encode(TG_FILE_ID)]))
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename=photo.png');
});

it('uses the original telegram file name for shared previews instead of the message id', function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);

    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/metadata*' => Http::response([
            'message_id' => 12345,
            'original_name' => 'photo.png',
            'size' => 11,
            'mime_type' => MIME_PNG,
        ]),
        'http://localhost:8000/read*' => Http::response('file contents', 200, ['Content-Type' => MIME_PNG]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'My Telegram',
        'provider' => CloudProvider::TELEGRAM,
        'credentials' => ['session_id' => 'sess123'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => 'tg-preview-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => TG_FILE_ID,
        'name' => 'photo.png',
        'is_directory' => false,
        'type' => 'public',
    ]);

    $connector = new class($connection) extends TelegramConnector
    {
        public function __construct(private CloudConnection $conn) {}

        public function disk(CloudConnection $connection): Illuminate\Contracts\Filesystem\Filesystem
        {
            $client = new TelegramClient(
                url: (string) config('services.python-service.url'),
                token: (string) config('services.python-service.token'),
                sessionId: (string) ($this->conn->credentials['session_id'] ?? ''),
            );

            return new FilesystemAdapter(
                new Filesystem(new TelegramAdapter($client)),
                new TelegramAdapter($client),
                [],
            );
        }
    };

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->andReturn($connector);
    $this->app->instance(CloudStorageManager::class, $manager);

    $this->get(route('share.preview', ['uuid' => 'tg-preview-uuid', 'path' => PathEncoder::encode(TG_FILE_ID)]))
        ->assertOk()
        ->assertHeader('Content-Disposition', 'inline; filename="photo.png"');
});
