# Telegram Flysystem Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Flysystem adapter and client for Telegram Saved Messages via the existing Python microservice, following the OneDrive adapter/client pattern.

**Architecture:** Three new PHP classes: `TelegramClient` (HTTP client), `TelegramAdapter` (Flysystem adapter), `TelegramConnector` (cloud provider connector). Path in Flysystem = message_id string. Folder operations are no-ops. `move`/`copy` throw.

**Tech Stack:** PHP 8.4, Laravel 13, League Flysystem 3.x, Pest 4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/Services/Telegram/TelegramClient.php` | Create | HTTP client wrapping microservice API |
| `app/Services/Telegram/TelegramAdapter.php` | Create | Flysystem FilesystemAdapter |
| `app/Services/CloudStorage/Connectors/TelegramConnector.php` | Create | CloudProviderConnector implementation |
| `app/Enums/CloudProvider.php` | Modify | Add TELEGRAM = 7 |
| `config/services.php` | Modify | Add telegram-storage config |
| `.env.example` | Modify | Add TELEGRAM_STORAGE_URL, TELEGRAM_STORAGE_TOKEN |
| `app/Providers/CloudStorageServiceProvider.php` | Modify | Register TelegramConnector + Storage::extend |
| `tests/Feature/TelegramClientTest.php` | Create | Client unit tests |
| `tests/Feature/TelegramAdapterTest.php` | Create | Adapter unit tests |
| `tests/Feature/TelegramConnectorTest.php` | Create | Connector tests |

---

### Task 1: Add TELEGRAM to CloudProvider enum

**Files:**
- Modify: `app/Enums/CloudProvider.php`

- [ ] **Step 1: Add TELEGRAM constant and update all match arms**

Add the PHPDoc `@method` annotation:

```php
/**
 * @method static static GOOGLE_DRIVE()
 * @method static static ONEDRIVE()
 * @method static static DROPBOX()
 * @method static static AWS_S3()
 * @method static static FTP()
 * @method static static SFTP()
 * @method static static TELEGRAM()
 */
```

Add constant after SFTP:

```php
const SFTP = 6;

const TELEGRAM = 7;
```

Update `slug()`:

```php
self::SFTP => 'sftp',
self::TELEGRAM => 'telegram',
```

Update `fromSlug()`:

```php
'ftp' => self::FTP(),
'sftp' => self::SFTP(),
'telegram' => self::TELEGRAM(),
```

Update `getDescription()`:

```php
self::SFTP => 'SFTP Server',
self::TELEGRAM => 'Telegram',
```

Update `getIcon()`:

```php
self::SFTP => '/assets/svg/Sftp.svg',
self::TELEGRAM => '/assets/svg/Telegram.svg',
```

- [ ] **Step 2: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`
Expected: No changes or formatting fixes applied.

- [ ] **Step 3: Commit**

```bash
git add app/Enums/CloudProvider.php
git commit -m "feat(telegram): add TELEGRAM provider enum"
```

---

### Task 2: Add config for telegram-storage

**Files:**
- Modify: `config/services.php`
- Modify: `.env.example`

- [ ] **Step 1: Add telegram-storage to config/services.php**

Add after the existing `dropbox` config block (or wherever appropriate in alphabetical order):

```php
'telegram-storage' => [
    'url' => env('TELEGRAM_STORAGE_URL', 'http://localhost:8000'),
    'token' => env('TELEGRAM_STORAGE_TOKEN'),
],
```

- [ ] **Step 2: Add env vars to .env.example**

Append:

```
TELEGRAM_STORAGE_URL=http://localhost:8000
TELEGRAM_STORAGE_TOKEN=
```

- [ ] **Step 3: Commit**

```bash
git add config/services.php .env.example
git commit -m "feat(telegram): add telegram-storage config"
```

---

### Task 3: Create TelegramClient

**Files:**
- Create: `app/Services/Telegram/TelegramClient.php`
- Create: `tests/Feature/TelegramClientTest.php`

- [ ] **Step 1: Write failing tests for TelegramClient**

```php
<?php

use App\Services\Telegram\TelegramClient;
use Illuminate\Support\Facades\Http;

it('sends correct headers on all requests', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/auth-status' => Http::response(['authorized' => true]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'test-token', 'sess1');
    $client->isAuthorized();

    Http::assertSent(fn ($request): bool =>
        $request->hasHeader('X-Session-Id', 'sess1')
        && $request->hasHeader('X-Token', 'test-token')
    );
});

it('returns authorized status', function () {
    Http::preventStrayRequests();
    Http::fake(['*/auth-status' => Http::response(['authorized' => true])]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect($client->isAuthorized())->toBeTrue();
});

it('returns unauthorized status', function () {
    Http::preventStrayRequests();
    Http::fake(['*/auth-status' => Http::response(['authorized' => false])]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect($client->isAuthorized())->toBeFalse();
});

it('uploads file and returns message_id', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/write' => Http::response(['success' => true, 'message_id' => 12345], 200),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $messageId = $client->upload('test.txt', 'hello world');

    expect($messageId)->toBe(12345);

    Http::assertSent(fn ($request): bool =>
        $request->method() === 'POST'
        && str_contains($request->url(), '/write')
    );
});

it('uploads stream and returns message_id', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/write' => Http::response(['success' => true, 'message_id' => 67890], 200),
    ]);

    $stream = fopen('php://temp', 'r+');
    fwrite($stream, 'stream content');
    rewind($stream);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $messageId = $client->uploadStream('stream.txt', $stream);

    expect($messageId)->toBe(67890);
});

it('downloads file as string', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/read*' => Http::response('file contents', 200, ['Content-Type' => 'text/plain']),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $result = $client->download(12345);

    expect($result)->toBe('file contents');

    Http::assertSent(fn ($request): bool =>
        $request->method() === 'GET'
        && str_contains($request->url(), '/read')
        && str_contains($request->url(), 'message_id=12345')
    );
});

it('downloads file as stream', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/read*' => Http::response('stream data', 200),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $stream = $client->downloadStream(12345);

    expect(is_resource($stream))->toBeTrue()
        ->and(stream_get_contents($stream))->toBe('stream data');
});

it('deletes file by message_id', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/delete*' => Http::response(['success' => true]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $client->delete(12345);

    Http::assertSent(fn ($request): bool =>
        $request->method() === 'DELETE'
        && str_contains($request->url(), '/delete')
        && str_contains($request->url(), 'message_id=12345')
    );
});

it('gets file metadata', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/metadata*' => Http::response([
            'message_id' => 12345,
            'original_name' => 'test.txt',
            'size' => 100,
            'mime_type' => 'text/plain',
            'caption' => 'test.txt',
            'created_at' => '2026-01-01T00:00:00',
            'updated_at' => '2026-01-01T00:00:00',
        ]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $meta = $client->metadata(12345);

    expect($meta)->toBeArray()
        ->and($meta['message_id'])->toBe(12345)
        ->and($meta['original_name'])->toBe('test.txt')
        ->and($meta['size'])->toBe(100);
});

it('returns null metadata for missing file', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/metadata*' => Http::response(['detail' => 'File not found'], 404),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $meta = $client->metadata(99999);

    expect($meta)->toBeNull();
});

it('lists files with pagination', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/list*' => Http::response([
            'total' => 2,
            'limit' => 100,
            'offset' => 0,
            'files' => [
                ['message_id' => 1, 'original_name' => 'a.txt', 'size' => 10, 'mime_type' => 'text/plain', 'caption' => 'a.txt', 'created_at' => '2026-01-01T00:00:00'],
                ['message_id' => 2, 'original_name' => 'b.txt', 'size' => 20, 'mime_type' => 'text/plain', 'caption' => 'b.txt', 'created_at' => '2026-01-02T00:00:00'],
            ],
        ]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $result = $client->listAll(100, 0);

    expect($result['total'])->toBe(2)
        ->and($result['files'])->toHaveCount(2)
        ->and($result['files'][0]['message_id'])->toBe(1);
});

it('syncs and returns added count', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/sync' => Http::response(['success' => true, 'added' => 5]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $added = $client->sync();

    expect($added)->toBe(5);
});

it('throws on 403 responses', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/auth-status' => Http::response(['detail' => 'Invalid API Token'], 403),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect(fn () => $client->isAuthorized())->toThrow(RuntimeException::class, 'Telegram storage API authentication failed.');
});

it('throws on unexpected errors', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/read*' => Http::response(['detail' => 'Internal error'], 500),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect(fn () => $client->download(12345))->toThrow(RuntimeException::class);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact --filter=TelegramClientTest`
Expected: FAIL — `TelegramClient` class not found.

- [ ] **Step 3: Implement TelegramClient**

```php
<?php

declare(strict_types=1);

namespace App\Services\Telegram;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class TelegramClient
{
    public function __construct(
        private readonly string $url,
        private readonly string $token,
        private readonly string $sessionId,
    ) {}

    public function isAuthorized(): bool
    {
        $response = $this->request()->get($this->url.'/auth-status');

        $this->assertAuthenticated($response);

        return (bool) ($response->json('authorized') ?? false);
    }

    /**
     * @return int message_id
     */
    public function upload(string $filename, string $contents): int
    {
        $response = $this->request()
            ->attach('file', $contents, $filename)
            ->post($this->url.'/write');

        $this->assertSuccess($response);

        return (int) $response->json('message_id');
    }

    /**
     * @param  resource  $stream
     * @return int message_id
     */
    public function uploadStream(string $filename, $stream): int
    {
        $response = $this->request()
            ->attach('file', $stream, $filename)
            ->post($this->url.'/write');

        $this->assertSuccess($response);

        return (int) $response->json('message_id');
    }

    public function download(int $messageId): string
    {
        $response = $this->request()
            ->get($this->url.'/read', ['message_id' => $messageId]);

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            throw new RuntimeException('Telegram file not found.');
        }

        $response->throw();

        return $response->body();
    }

    /**
     * @return resource
     */
    public function downloadStream(int $messageId)
    {
        $body = $this->download($messageId);

        $stream = fopen('php://temp', 'r+');

        if ($stream === false) {
            throw new RuntimeException('Could not create download stream.');
        }

        fwrite($stream, $body);
        rewind($stream);

        return $stream;
    }

    public function delete(int $messageId): void
    {
        $response = $this->request()
            ->delete($this->url.'/delete', ['message_id' => $messageId]);

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            throw new RuntimeException('Telegram file not found.');
        }

        $response->throw();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function metadata(int $messageId): ?array
    {
        $response = $this->request()
            ->get($this->url.'/metadata', ['message_id' => $messageId]);

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            return null;
        }

        $data = $response->throw()->json();

        return is_array($data) ? $data : null;
    }

    /**
     * @return array{total: int, limit: int, offset: int, files: array<int, array<string, mixed>>}
     */
    public function listAll(int $limit = 100, int $offset = 0): array
    {
        $response = $this->request()
            ->get($this->url.'/list', ['limit' => $limit, 'offset' => $offset]);

        $this->assertAuthenticated($response);
        $response->throw();

        return $response->json();
    }

    public function sync(): int
    {
        $response = $this->request()->post($this->url.'/sync');

        $this->assertAuthenticated($response);
        $response->throw();

        return (int) ($response->json('added') ?? 0);
    }

    private function request(): PendingRequest
    {
        return Http::connectTimeout(5)
            ->timeout(30)
            ->withHeaders([
                'X-Session-Id' => $this->sessionId,
                'X-Token' => $this->token,
            ]);
    }

    private function assertAuthenticated(Response $response): void
    {
        if ($response->status() === 403) {
            throw new RuntimeException('Telegram storage API authentication failed.');
        }
    }

    private function assertSuccess(Response $response): void
    {
        $this->assertAuthenticated($response);
        $response->throw();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `php artisan test --compact --filter=TelegramClientTest`
Expected: All PASS.

- [ ] **Step 5: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`

- [ ] **Step 6: Commit**

```bash
git add app/Services/Telegram/TelegramClient.php tests/Feature/TelegramClientTest.php
git commit -m "feat(telegram): add TelegramClient HTTP wrapper"
```

---

### Task 4: Create TelegramAdapter

**Files:**
- Create: `app/Services/Telegram/TelegramAdapter.php`
- Create: `tests/Feature/TelegramAdapterTest.php`

- [ ] **Step 1: Write failing tests for TelegramAdapter**

```php
<?php

use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramClient;
use League\Flysystem\Config;
use League\Flysystem\FileAttributes;
use League\Flysystem\UnableToCopyFile;
use League\Flysystem\UnableToDeleteFile;
use League\Flysystem\UnableToMoveFile;
use League\Flysystem\UnableToReadFile;
use League\Flysystem\UnableToRetrieveMetadata;
use League\Flysystem\UnableToSetVisibility;
use League\Flysystem\UnableToWriteFile;

it('delegates write to client upload', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('upload')->with('test.txt', 'hello')->once()->andReturn(12345);

    $adapter = new TelegramAdapter($client);
    $adapter->write('test.txt', 'hello', new Config);

    // write() is void — upload was called (verified by Mockery)
    expect(true)->toBeTrue();
});

it('delegates writeStream to client uploadStream', function () {
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, 'data');

    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('uploadStream')->with('test.txt', Mockery::type('resource'))->once()->andReturn(12345);

    $adapter = new TelegramAdapter($client);
    $adapter->writeStream('test.txt', $stream, new Config);

    expect(true)->toBeTrue();
});

it('delegates read to client download', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('download')->with(12345)->once()->andReturn('file contents');

    $adapter = new TelegramAdapter($client);

    expect($adapter->read('12345'))->toBe('file contents');
});

it('delegates readStream to client downloadStream', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('downloadStream')->with(12345)->once()->andReturn(fopen('php://temp', 'r+'));

    $adapter = new TelegramAdapter($client);
    $stream = $adapter->readStream('12345');

    expect(is_resource($stream))->toBeTrue();
});

it('delegates delete to client', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('delete')->with(12345)->once();

    $adapter = new TelegramAdapter($client);
    $adapter->delete('12345');

    expect(true)->toBeTrue();
});

it('checks file existence via metadata', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('metadata')->with(12345)->once()->andReturn(['message_id' => 12345]);
    $client->shouldReceive('metadata')->with(99999)->once()->andReturn(null);

    $adapter = new TelegramAdapter($client);

    expect($adapter->fileExists('12345'))->toBeTrue()
        ->and($adapter->fileExists('99999'))->toBeFalse();
});

it('always returns false for directoryExists', function () {
    $client = Mockery::mock(TelegramClient::class);

    $adapter = new TelegramAdapter($client);

    expect($adapter->directoryExists('anything'))->toBeFalse();
});

it('returns FileAttributes from metadata methods', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('metadata')->with(12345)->andReturn([
        'message_id' => 12345,
        'original_name' => 'test.txt',
        'size' => 100,
        'mime_type' => 'text/plain',
        'caption' => 'test.txt',
        'created_at' => '2026-01-01T00:00:00',
        'updated_at' => '2026-01-01T00:00:00',
    ]);

    $adapter = new TelegramAdapter($client);

    $fileSize = $adapter->fileSize('12345');
    expect($fileSize)->toBeInstanceOf(FileAttributes::class)
        ->and($fileSize->fileSize())->toBe(100);

    $mimeType = $adapter->mimeType('12345');
    expect($mimeType)->toBeInstanceOf(FileAttributes::class)
        ->and($mimeType->mimeType())->toBe('text/plain');

    $lastModified = $adapter->lastModified('12345');
    expect($lastModified)->toBeInstanceOf(FileAttributes::class)
        ->and($lastModified->lastModified())->toBe(strtotime('2026-01-01T00:00:00'));
});

it('lists contents as FileAttributes with message_id as path', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('listAll')->with(100, 0)->andReturn([
        'total' => 2,
        'limit' => 100,
        'offset' => 0,
        'files' => [
            ['message_id' => 1, 'original_name' => 'a.txt', 'size' => 10, 'mime_type' => 'text/plain', 'created_at' => '2026-01-01T00:00:00'],
            ['message_id' => 2, 'original_name' => 'b.jpg', 'size' => 200, 'mime_type' => 'image/jpeg', 'created_at' => '2026-01-02T00:00:00'],
        ],
    ]);

    $adapter = new TelegramAdapter($client);
    $items = iterator_to_array($adapter->listContents('', false));

    expect($items)->toHaveCount(2)
        ->and($items[0])->toBeInstanceOf(FileAttributes::class)
        ->and($items[0]->path())->toBe('1')
        ->and($items[0]->fileSize())->toBe(10)
        ->and($items[0]->mimeType())->toBe('text/plain')
        ->and($items[1]->path())->toBe('2')
        ->and($items[1]->fileSize())->toBe(200);
});

it('rejects visibility operations', function () {
    $adapter = new TelegramAdapter(Mockery::mock(TelegramClient::class));

    expect(fn () => $adapter->visibility('12345'))->toThrow(UnableToRetrieveMetadata::class)
        ->and(fn () => $adapter->setVisibility('12345', 'public'))->toThrow(UnableToSetVisibility::class);
});

it('rejects move and copy', function () {
    $adapter = new TelegramAdapter(Mockery::mock(TelegramClient::class));

    expect(fn () => $adapter->move('1', '2', new Config))->toThrow(UnableToMoveFile::class)
        ->and(fn () => $adapter->copy('1', '2', new Config))->toThrow(UnableToCopyFile::class);
});

it('no-ops createDirectory and deleteDirectory', function () {
    $adapter = new TelegramAdapter(Mockery::mock(TelegramClient::class));

    $adapter->createDirectory('folder', new Config);
    $adapter->deleteDirectory('folder');

    // No exceptions = pass
    expect(true)->toBeTrue();
});

it('maps client failures to flysystem exceptions', function (string $method, array $arguments, string $clientMethod, array $clientArgs, string $exceptionClass) {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive($clientMethod)->with(...$clientArgs)->once()->andThrow(new RuntimeException('API failed.'));

    expect(fn () => new TelegramAdapter($client)->{$method}(...$arguments))->toThrow($exceptionClass);
})->with([
    'write' => ['write', ['a.txt', 'new', new Config], 'upload', ['a.txt', 'new'], UnableToWriteFile::class],
    'writeStream' => ['writeStream', ['a.txt', fopen('php://temp', 'r+'), new Config], 'uploadStream', ['a.txt', Mockery::type('resource')], UnableToWriteFile::class],
    ['read', ['12345'], 'download', [12345], UnableToReadFile::class],
    ['readStream', ['12345'], 'downloadStream', [12345], UnableToReadFile::class],
    ['delete', ['12345'], 'delete', [12345], UnableToDeleteFile::class],
]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact --filter=TelegramAdapterTest`
Expected: FAIL — `TelegramAdapter` class not found.

- [ ] **Step 3: Implement TelegramAdapter**

```php
<?php

declare(strict_types=1);

namespace App\Services\Telegram;

use League\Flysystem\Config;
use League\Flysystem\FileAttributes;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\StorageAttributes;
use League\Flysystem\UnableToCopyFile;
use League\Flysystem\UnableToCreateDirectory;
use League\Flysystem\UnableToDeleteDirectory;
use League\Flysystem\UnableToDeleteFile;
use League\Flysystem\UnableToMoveFile;
use League\Flysystem\UnableToReadFile;
use League\Flysystem\UnableToRetrieveMetadata;
use League\Flysystem\UnableToSetVisibility;
use League\Flysystem\UnableToWriteFile;
use Throwable;

class TelegramAdapter implements FilesystemAdapter
{
    public function __construct(private readonly TelegramClient $client) {}

    public function fileExists(string $path): bool
    {
        return $this->client->metadata((int) $path) !== null;
    }

    public function directoryExists(string $path): bool
    {
        return false;
    }

    public function write(string $path, string $contents, Config $config): void
    {
        try {
            $this->client->upload($path, $contents);
        } catch (Throwable $exception) {
            throw UnableToWriteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function writeStream(string $path, $contents, Config $config): void
    {
        try {
            $this->client->uploadStream($path, $contents);
        } catch (Throwable $exception) {
            throw UnableToWriteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function read(string $path): string
    {
        try {
            return $this->client->download((int) $path);
        } catch (Throwable $exception) {
            throw UnableToReadFile::fromLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function readStream(string $path)
    {
        try {
            return $this->client->downloadStream((int) $path);
        } catch (Throwable $exception) {
            throw UnableToReadFile::fromLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function delete(string $path): void
    {
        try {
            $this->client->delete((int) $path);
        } catch (Throwable $exception) {
            throw UnableToDeleteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function deleteDirectory(string $path): void
    {
        // Telegram has no folder concept — no-op.
    }

    public function createDirectory(string $path, Config $config): void
    {
        // Telegram has no folder concept — no-op.
    }

    public function setVisibility(string $path, string $visibility): void
    {
        throw UnableToSetVisibility::atLocation($path, 'Telegram visibility is not supported.');
    }

    public function visibility(string $path): FileAttributes
    {
        throw UnableToRetrieveMetadata::visibility($path);
    }

    public function mimeType(string $path): FileAttributes
    {
        return $this->metadata($path);
    }

    public function lastModified(string $path): FileAttributes
    {
        return $this->metadata($path);
    }

    public function fileSize(string $path): FileAttributes
    {
        return $this->metadata($path);
    }

    /**
     * @return iterable<StorageAttributes>
     */
    public function listContents(string $path, bool $deep): iterable
    {
        $offset = 0;
        $limit = 100;

        do {
            $result = $this->client->listAll($limit, $offset);
            $files = $result['files'] ?? [];

            foreach ($files as $file) {
                yield $this->fileAttribute($file);
            }

            $offset += $limit;
        } while ($offset < ($result['total'] ?? 0));
    }

    public function move(string $source, string $destination, Config $config): void
    {
        throw UnableToMoveFile::fromLocationTo($source, $destination, new \RuntimeException('Telegram does not support move.'));
    }

    public function copy(string $source, string $destination, Config $config): void
    {
        throw UnableToCopyFile::fromLocationTo($source, $destination, new \RuntimeException('Telegram does not support copy.'));
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private function metadata(string $path): FileAttributes
    {
        $meta = $this->client->metadata((int) $path);

        if (! is_array($meta)) {
            throw UnableToRetrieveMetadata::create($path);
        }

        return $this->fileAttribute($meta);
    }

    /**
     * @param  array<string, mixed>  $file
     */
    private function fileAttribute(array $file): FileAttributes
    {
        $createdAt = $file['created_at'] ?? null;

        return new FileAttributes(
            path: (string) ($file['message_id'] ?? ''),
            fileSize: isset($file['size']) ? (int) $file['size'] : null,
            visibility: null,
            lastModified: is_string($createdAt) ? strtotime($createdAt) : null,
            mimeType: isset($file['mime_type']) ? (string) $file['mime_type'] : null,
        );
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `php artisan test --compact --filter=TelegramAdapterTest`
Expected: All PASS.

- [ ] **Step 5: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`

- [ ] **Step 6: Commit**

```bash
git add app/Services/Telegram/TelegramAdapter.php tests/Feature/TelegramAdapterTest.php
git commit -m "feat(telegram): add TelegramAdapter Flysystem implementation"
```

---

### Task 5: Create TelegramConnector and register it

**Files:**
- Create: `app/Services/CloudStorage/Connectors/TelegramConnector.php`
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Create: `tests/Feature/TelegramConnectorTest.php`

- [ ] **Step 1: Write failing tests for TelegramConnector**

```php
<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\Connectors\TelegramConnector;
use App\Services\CloudStorage\CloudProviderRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

function telegramConnection(array $credentials = []): CloudConnection
{
    $user = User::factory()->create();

    return $user->cloudConnections()->create([
        'provider' => CloudProvider::TELEGRAM(),
        'provider_id' => 'telegram-sess1',
        'name' => 'Telegram Storage',
        'credentials' => array_merge(['session_id' => 'sess1'], $credentials),
        'status' => \App\Enums\ConnectionStatus::CONNECTED(),
    ]);
}

it('returns TELEGRAM provider', function () {
    $connector = new TelegramConnector;

    expect($connector->provider()->is(CloudProvider::TELEGRAM()))->toBeTrue();
});

it('returns correct capabilities', function () {
    $connector = new TelegramConnector;
    $caps = $connector->capabilities();

    expect($caps)->toBeInstanceOf(ProviderCapabilities::class)
        ->and($caps->browse)->toBeTrue()
        ->and($caps->upload)->toBeTrue()
        ->and($caps->download)->toBeTrue()
        ->and($caps->delete)->toBeTrue()
        ->and($caps->createFolder)->toBeFalse()
        ->and($caps->share)->toBeFalse();
});

it('builds a filesystem disk from connection', function () {
    Http::preventStrayRequests();

    $connection = telegramConnection();
    $connector = new TelegramConnector;
    $disk = $connector->disk($connection);

    expect($disk)->toBeInstanceOf(\Illuminate\Contracts\Filesystem\Filesystem::class);
});

it('returns empty redirect url', function () {
    $connector = new TelegramConnector;

    expect($connector->redirectUrl())->toBe('');
});

it('is registered in the provider registry', function () {
    $registry = app(CloudProviderRegistry::class);
    $connector = $registry->connector(CloudProvider::TELEGRAM());

    expect($connector)->toBeInstanceOf(TelegramConnector::class);
});

it('uses enum constants consistently for telegram connections', function () {
    expect(CloudProvider::TELEGRAM)->toBe(7)
        ->and(telegramConnection()->provider->is(CloudProvider::TELEGRAM()))->toBeTrue();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact --filter=TelegramConnectorTest`
Expected: FAIL — `TelegramConnector` class not found or not registered.

- [ ] **Step 3: Implement TelegramConnector**

```php
<?php

declare(strict_types=1);

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramClient;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use League\Flysystem\Filesystem as Flysystem;
use LogicException;

class TelegramConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::TELEGRAM();
    }

    public function redirectUrl(): string
    {
        return '';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        throw new LogicException('Telegram connections are credential-based and do not support OAuth callbacks.');
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        $credentials = $connection->credentials;

        $client = new TelegramClient(
            url: (string) config('services.telegram-storage.url'),
            token: (string) config('services.telegram-storage.token'),
            sessionId: (string) ($credentials['session_id'] ?? ''),
        );

        return new \Illuminate\Filesystem\FilesystemAdapter(
            new Flysystem(new TelegramAdapter($client)),
            new TelegramAdapter($client),
            [],
        );
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: false,
            share: false,
        );
    }
}
```

- [ ] **Step 4: Register TelegramConnector in CloudStorageServiceProvider**

In `app/Providers/CloudStorageServiceProvider.php`, add the import:

```php
use App\Services\CloudStorage\Connectors\TelegramConnector;
```

Add to the registry array in `register()`:

```php
return new CloudProviderRegistry([
    $app->make(GoogleDriveConnector::class),
    $app->make(OneDriveConnector::class),
    $app->make(DropboxConnector::class),
    $app->make(FtpConnector::class),
    $app->make(SftpConnector::class),
    $app->make(TelegramConnector::class),
]);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test --compact --filter=TelegramConnectorTest`
Expected: All PASS.

- [ ] **Step 6: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`

- [ ] **Step 7: Commit**

```bash
git add app/Services/CloudStorage/Connectors/TelegramConnector.php app/Providers/CloudStorageServiceProvider.php tests/Feature/TelegramConnectorTest.php
git commit -m "feat(telegram): add TelegramConnector and register in provider registry"
```

---

### Task 6: Verify all tests pass together

**Files:** None (verification only)

- [ ] **Step 1: Run all Telegram-related tests**

Run: `php artisan test --compact --filter=Telegram`
Expected: All tests PASS.

- [ ] **Step 2: Run full test suite to check for regressions**

Run: `php artisan test --compact`
Expected: All tests PASS.

- [ ] **Step 3: Run Pint on all dirty files**

Run: `vendor/bin/pint --dirty --format agent`
Expected: No changes needed.
