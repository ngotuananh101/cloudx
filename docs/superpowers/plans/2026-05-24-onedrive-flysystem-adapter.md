# OneDrive Flysystem Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OneDrive direct Graph browsing with a Laravel/Flysystem-compatible OneDrive disk supporting Full CRUD.

**Architecture:** Add a focused `OneDriveClient` for Microsoft Graph/token concerns and a focused `OneDriveAdapter` implementing `League\Flysystem\FilesystemAdapter`. Register a Laravel `onedrive` disk driver, make `OneDriveConnector::disk()` build it, and remove OneDrive from the direct-provider browsing path.

**Tech Stack:** Laravel 13, PHP 8.4, Flysystem v3, Microsoft Graph HTTP API, Pest 4, Laravel HTTP fake.

---

## File map

- Create `app/Services/OneDrive/OneDriveClient.php`: Microsoft Graph HTTP, token refresh, path encoding, upload sessions, copy monitor polling.
- Create `app/Services/OneDrive/OneDriveAdapter.php`: Flysystem adapter implementation only.
- Modify `app/Services/CloudStorage/Connectors/OneDriveConnector.php`: remove `BrowsesCloudFiles`, delegate token refresh/listing to disk, implement `disk()`.
- Modify `app/Providers/CloudStorageServiceProvider.php`: register `onedrive` storage driver.
- Modify `app/Services/CloudStorage/CloudFileBrowser.php`: keep direct-provider branch but OneDrive must use Flysystem through connector changes.
- Add `tests/Feature/OneDriveClientTest.php`: token refresh, path encoding, core Graph URL behavior.
- Add `tests/Feature/OneDriveAdapterTest.php`: Flysystem adapter CRUD and metadata.
- Update `tests/Feature/OneDriveConnectorTest.php`: disk now works; direct listing tests move to adapter tests.
- Update `tests/Feature/StorageBrowserTest.php`: assert OneDrive browser path uses Flysystem disk.

## Task 1: OneDriveClient token + path foundation

**Files:**
- Create: `app/Services/OneDrive/OneDriveClient.php`
- Test: `tests/Feature/OneDriveClientTest.php`

- [ ] **Step 1: Write failing client token/path tests**

Create `tests/Feature/OneDriveClientTest.php`:

```php
<?php

use App\Models\CloudConnection;
use App\Models\User;
use App\Services\OneDrive\OneDriveClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use RuntimeException;

uses(RefreshDatabase::class);

function oneDriveConnection(array $credentials = []): CloudConnection
{
    $user = User::factory()->create();

    return $user->cloudConnections()->create([
        'provider' => App\Enums\CloudProvider::ONEDRIVE(),
        'provider_id' => 'onedrive-user',
        'name' => 'OneDrive',
        'credentials' => array_merge([
            'access_token' => 'fresh-token',
            'refresh_token' => 'refresh-token',
            'expires_at' => now()->addHour()->timestamp,
        ], $credentials),
        'status' => App\Enums\ConnectionStatus::CONNECTED(),
    ]);
}

it('returns fresh credentials without refresh request', function () {
    Http::preventStrayRequests();
    $connection = oneDriveConnection();

    $credentials = new OneDriveClient($connection)->credentials();

    expect($credentials['access_token'])->toBe('fresh-token');
});

it('refreshes expired credentials and preserves existing refresh token', function () {
    Http::preventStrayRequests();
    Http::fake([
        OneDriveClient::TOKEN_URL => Http::response([
            'access_token' => 'new-token',
            'expires_in' => 3600,
        ]),
    ]);

    $connection = oneDriveConnection(['expires_at' => now()->subMinute()->timestamp]);

    $credentials = new OneDriveClient($connection)->credentials();

    expect($credentials['access_token'])->toBe('new-token')
        ->and($credentials['refresh_token'])->toBe('refresh-token');

    $connection->refresh();
    expect($connection->credentials['access_token'])->toBe('new-token')
        ->and($connection->credentials['refresh_token'])->toBe('refresh-token');
});

it('fails before http when refresh token is missing', function () {
    Http::preventStrayRequests();
    $connection = oneDriveConnection([
        'refresh_token' => null,
        'expires_at' => now()->subMinute()->timestamp,
    ]);

    expect(fn () => new OneDriveClient($connection)->credentials())
        ->toThrow(RuntimeException::class, 'OneDrive refresh token is missing.');
});

it('encodes graph path segments safely', function () {
    $connection = oneDriveConnection();
    $client = new OneDriveClient($connection);

    expect($client->childrenUrl('Folder A/#hash & %.txt'))
        ->toBe('https://graph.microsoft.com/v1.0/me/drive/root:/Folder%20A/%23hash%20%26%20%25.txt:/children')
        ->and($client->childrenUrl(''))->toBe('https://graph.microsoft.com/v1.0/me/drive/root/children');
});
```

Note: replace the accidental `App":"` strings with normal PHP namespace separators before running:

```php
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\OneDrive\OneDriveClient;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --compact --filter=OneDriveClientTest`
Expected: FAIL because `App\Services\OneDrive\OneDriveClient` does not exist.

- [ ] **Step 3: Implement minimal client foundation**

Create `app/Services/OneDrive/OneDriveClient.php`:

```php
<?php

namespace App\Services\OneDrive;

use App\Models\CloudConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OneDriveClient
{
    public const GRAPH_URL = 'https://graph.microsoft.com/v1.0';

    public const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    public function __construct(private CloudConnection $connection) {}

    /** @return array<string, mixed> */
    public function credentials(): array
    {
        $credentials = $this->connection->credentials ?? [];
        $expiresAt = (int) ($credentials['expires_at'] ?? 0);

        if ($expiresAt > now()->addMinutes(5)->timestamp) {
            return $credentials;
        }

        $refreshToken = $credentials['refresh_token'] ?? null;

        if (! is_string($refreshToken) || $refreshToken === '') {
            throw new RuntimeException('OneDrive refresh token is missing.');
        }

        $token = Http::asForm()
            ->connectTimeout(5)
            ->timeout(10)
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.microsoft.client_id'),
                'client_secret' => config('services.microsoft.client_secret'),
                'refresh_token' => $refreshToken,
                'grant_type' => 'refresh_token',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            return $credentials;
        }

        $credentials = array_merge($credentials, $token, [
            'refresh_token' => $token['refresh_token'] ?? $credentials['refresh_token'] ?? null,
            'expires_at' => now()->addSeconds((int) ($token['expires_in'] ?? 3600))->timestamp,
        ]);

        $this->connection->forceFill(['credentials' => $credentials])->save();

        return $credentials;
    }

    public function childrenUrl(string $path): string
    {
        $path = trim($path, '/');

        if ($path === '') {
            return self::GRAPH_URL.'/me/drive/root/children';
        }

        return self::GRAPH_URL.'/me/drive/root:/'.$this->encodePath($path).':/children';
    }

    public function itemUrl(string $path): string
    {
        $path = trim($path, '/');

        if ($path === '') {
            return self::GRAPH_URL.'/me/drive/root';
        }

        return self::GRAPH_URL.'/me/drive/root:/'.$this->encodePath($path);
    }

    public function contentUrl(string $path): string
    {
        return $this->itemUrl($path).':/content';
    }

    protected function graph(): PendingRequest
    {
        $credentials = $this->credentials();

        return Http::withToken((string) ($credentials['access_token'] ?? ''))
            ->connectTimeout(5)
            ->timeout(10)
            ->retry([100, 250]);
    }

    private function encodePath(string $path): string
    {
        return collect(explode('/', trim($path, '/')))
            ->map(fn (string $segment): string => rawurlencode($segment))
            ->implode('/');
    }
}
```

- [ ] **Step 4: Run client tests**

Run: `php artisan test --compact --filter=OneDriveClientTest`
Expected: PASS.

## Task 2: OneDriveClient Graph operations

**Files:**
- Modify: `app/Services/OneDrive/OneDriveClient.php`
- Test: `tests/Feature/OneDriveClientTest.php`

- [ ] **Step 1: Add failing Graph operation tests**

Append to `tests/Feature/OneDriveClientTest.php`:

```php
it('lists children through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Folder:/children' => Http::response([
            'value' => [['id' => '1', 'name' => 'doc.txt', 'file' => ['mimeType' => 'text/plain'], 'size' => 12]],
        ]),
    ]);

    $items = new OneDriveClient(oneDriveConnection())->listChildren('Folder');

    expect($items)->toHaveCount(1)->and($items[0]['name'])->toBe('doc.txt');
});

it('reads and writes content through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/doc.txt:/content' => Http::sequence()
            ->push('hello')
            ->push([], 201),
    ]);

    $client = new OneDriveClient(oneDriveConnection());

    expect($client->download('doc.txt'))->toBe('hello');
    $client->upload('doc.txt', 'updated');

    Http::assertSentCount(2);
});

it('creates upload sessions and uploads fragments', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/big.bin:/createUploadSession' => Http::response([
            'uploadUrl' => 'https://upload.example/session',
        ]),
        'https://upload.example/session' => Http::response([], 201),
    ]);

    $stream = fopen('php://temp', 'r+');
    fwrite($stream, 'stream-body');
    rewind($stream);

    new OneDriveClient(oneDriveConnection())->uploadStream('big.bin', $stream);

    Http::assertSentCount(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --compact --filter=OneDriveClientTest`
Expected: FAIL for undefined `listChildren`, `download`, `upload`, `uploadStream`.

- [ ] **Step 3: Add Graph operations**

Add these methods to `OneDriveClient`:

```php
/** @return array<int, array<string, mixed>> */
public function listChildren(string $path): array
{
    $response = $this->graph()->get($this->childrenUrl($path))->throw()->json();

    return is_array($response) && isset($response['value']) && is_array($response['value']) ? $response['value'] : [];
}

/** @return array<string, mixed>|null */
public function item(string $path): ?array
{
    $response = $this->graph()->get($this->itemUrl($path));

    if ($response->status() === 404) {
        return null;
    }

    $item = $response->throw()->json();

    return is_array($item) ? $item : null;
}

public function download(string $path): string
{
    return $this->graph()->get($this->contentUrl($path))->throw()->body();
}

/** @return resource */
public function downloadStream(string $path)
{
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $this->download($path));
    rewind($stream);

    return $stream;
}

public function upload(string $path, string $contents): void
{
    $this->graph()->withBody($contents)->put($this->contentUrl($path))->throw();
}

/** @param resource $contents */
public function uploadStream(string $path, $contents): void
{
    $body = stream_get_contents($contents);

    if ($body === false) {
        throw new RuntimeException('Could not read OneDrive upload stream.');
    }

    $session = $this->graph()
        ->post($this->itemUrl($path).':/createUploadSession', [
            'item' => ['@microsoft.graph.conflictBehavior' => 'replace'],
        ])
        ->throw()
        ->json();

    $uploadUrl = is_array($session) ? ($session['uploadUrl'] ?? null) : null;

    if (! is_string($uploadUrl) || $uploadUrl === '') {
        throw new RuntimeException('OneDrive upload session was not created.');
    }

    Http::withHeaders([
        'Content-Length' => (string) strlen($body),
        'Content-Range' => 'bytes 0-'.(strlen($body) - 1).'/'.strlen($body),
    ])->withBody($body)->put($uploadUrl)->throw();
}
```

- [ ] **Step 4: Run client tests**

Run: `php artisan test --compact --filter=OneDriveClientTest`
Expected: PASS.

## Task 3: OneDriveClient mutation helpers

**Files:**
- Modify: `app/Services/OneDrive/OneDriveClient.php`
- Test: `tests/Feature/OneDriveClientTest.php`

- [ ] **Step 1: Add failing mutation tests**

Append:

```php
it('deletes and creates folders through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/old.txt' => Http::response([], 204),
        'https://graph.microsoft.com/v1.0/me/drive/root:/Parent:/children' => Http::response(['id' => 'new-folder'], 201),
    ]);

    $client = new OneDriveClient(oneDriveConnection());
    $client->delete('old.txt');
    $client->createFolder('Parent/New Folder');

    Http::assertSentCount(2);
});

it('moves files through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Target' => Http::response(['id' => 'target-id', 'folder' => []]),
        'https://graph.microsoft.com/v1.0/me/drive/root:/Source/doc.txt' => Http::response(['id' => 'moved'], 200),
    ]);

    new OneDriveClient(oneDriveConnection())->move('Source/doc.txt', 'Target/doc2.txt');

    Http::assertSentCount(2);
});

it('copies files and polls monitor url', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Target' => Http::response(['id' => 'target-id', 'folder' => []]),
        'https://graph.microsoft.com/v1.0/me/drive/root:/Source/doc.txt:/copy' => Http::response('', 202, ['Location' => 'https://monitor.example/copy']),
        'https://monitor.example/copy' => Http::response(['status' => 'completed'], 200),
    ]);

    new OneDriveClient(oneDriveConnection())->copy('Source/doc.txt', 'Target/doc2.txt');

    Http::assertSentCount(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --compact --filter=OneDriveClientTest`
Expected: FAIL for undefined mutation methods.

- [ ] **Step 3: Add mutation helpers**

Add to `OneDriveClient`:

```php
public function delete(string $path): void
{
    $this->graph()->delete($this->itemUrl($path))->throw();
}

public function createFolder(string $path): void
{
    [$parent, $name] = $this->splitPath($path);

    $this->graph()->post($this->childrenUrl($parent), [
        'name' => $name,
        'folder' => new \stdClass(),
        '@microsoft.graph.conflictBehavior' => 'fail',
    ])->throw();
}

public function move(string $source, string $destination): void
{
    [$parent, $name] = $this->splitPath($destination);
    $parentItem = $this->item($parent);

    if (! is_array($parentItem) || ! isset($parentItem['id'])) {
        throw new RuntimeException('OneDrive move destination parent does not exist.');
    }

    $this->graph()->patch($this->itemUrl($source), [
        'name' => $name,
        'parentReference' => ['id' => $parentItem['id']],
    ])->throw();
}

public function copy(string $source, string $destination): void
{
    [$parent, $name] = $this->splitPath($destination);
    $parentItem = $this->item($parent);

    if (! is_array($parentItem) || ! isset($parentItem['id'])) {
        throw new RuntimeException('OneDrive copy destination parent does not exist.');
    }

    $response = $this->graph()->post($this->itemUrl($source).':/copy', [
        'name' => $name,
        'parentReference' => ['id' => $parentItem['id']],
    ])->throw();

    $monitorUrl = $response->header('Location');

    if (! is_string($monitorUrl) || $monitorUrl === '') {
        return;
    }

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $monitor = Http::connectTimeout(5)->timeout(10)->get($monitorUrl)->throw()->json();
        $status = is_array($monitor) ? ($monitor['status'] ?? null) : null;

        if ($status === 'completed') {
            return;
        }

        if ($status === 'failed') {
            throw new RuntimeException('OneDrive copy failed.');
        }
    }

    throw new RuntimeException('OneDrive copy did not complete in time.');
}

/** @return array{0: string, 1: string} */
private function splitPath(string $path): array
{
    $path = trim($path, '/');
    $name = basename($path);
    $parent = trim(dirname($path), '.');

    return [$parent === '.' ? '' : trim($parent, '/'), $name];
}
```

- [ ] **Step 4: Run client tests**

Run: `php artisan test --compact --filter=OneDriveClientTest`
Expected: PASS.

## Task 4: OneDriveAdapter listing/existence/metadata

**Files:**
- Create: `app/Services/OneDrive/OneDriveAdapter.php`
- Test: `tests/Feature/OneDriveAdapterTest.php`

- [ ] **Step 1: Write failing adapter tests**

Create `tests/Feature/OneDriveAdapterTest.php`:

```php
<?php

use App\Services\OneDrive\OneDriveAdapter;
use App\Services\OneDrive\OneDriveClient;
use League\Flysystem\Config;
use League\Flysystem\DirectoryAttributes;
use League\Flysystem\FileAttributes;

it('lists files and directories as flysystem attributes', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('listChildren')->with('Docs')->andReturn([
        ['id' => 'folder-id', 'name' => 'Nested', 'folder' => [], 'size' => 0, 'lastModifiedDateTime' => '2026-01-01T00:00:00Z'],
        ['id' => 'file-id', 'name' => 'a.txt', 'file' => ['mimeType' => 'text/plain'], 'size' => 12, 'lastModifiedDateTime' => '2026-01-02T00:00:00Z'],
    ]);

    $items = iterator_to_array(new OneDriveAdapter($client)->listContents('Docs', false));

    expect($items)->toHaveCount(2)
        ->and($items[0])->toBeInstanceOf(DirectoryAttributes::class)
        ->and($items[0]->path())->toBe('Docs/Nested')
        ->and($items[1])->toBeInstanceOf(FileAttributes::class)
        ->and($items[1]->path())->toBe('Docs/a.txt')
        ->and($items[1]->fileSize())->toBe(12)
        ->and($items[1]->mimeType())->toBe('text/plain');
});

it('checks file and directory existence by item metadata', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('item')->with('file.txt')->andReturn(['file' => []]);
    $client->shouldReceive('item')->with('Folder')->andReturn(['folder' => []]);
    $client->shouldReceive('item')->with('missing')->andReturn(null);

    $adapter = new OneDriveAdapter($client);

    expect($adapter->fileExists('file.txt'))->toBeTrue()
        ->and($adapter->directoryExists('Folder'))->toBeTrue()
        ->and($adapter->fileExists('missing'))->toBeFalse();
});

it('returns metadata attributes', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('item')->with('file.txt')->andReturn([
        'name' => 'file.txt',
        'file' => ['mimeType' => 'text/plain'],
        'size' => 12,
        'lastModifiedDateTime' => '2026-01-02T00:00:00Z',
    ]);

    $adapter = new OneDriveAdapter($client);

    expect($adapter->fileSize('file.txt')->fileSize())->toBe(12)
        ->and($adapter->mimeType('file.txt')->mimeType())->toBe('text/plain')
        ->and($adapter->lastModified('file.txt')->lastModified())->toBe(strtotime('2026-01-02T00:00:00Z'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --compact --filter=OneDriveAdapterTest`
Expected: FAIL because `OneDriveAdapter` does not exist.

- [ ] **Step 3: Implement adapter listing/existence/metadata**

Create `app/Services/OneDrive/OneDriveAdapter.php`:

```php
<?php

namespace App\Services\OneDrive;

use League\Flysystem\Config;
use League\Flysystem\DirectoryAttributes;
use League\Flysystem\FileAttributes;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\StorageAttributes;
use League\Flysystem\UnableToRetrieveMetadata;
use League\Flysystem\UnableToSetVisibility;

class OneDriveAdapter implements FilesystemAdapter
{
    public function __construct(private OneDriveClient $client) {}

    public function fileExists(string $path): bool
    {
        $item = $this->client->item($path);

        return is_array($item) && isset($item['file']);
    }

    public function directoryExists(string $path): bool
    {
        $item = $this->client->item($path);

        return is_array($item) && isset($item['folder']);
    }

    public function listContents(string $path, bool $deep): iterable
    {
        foreach ($this->client->listChildren($path) as $item) {
            $attribute = $this->attribute($path, $item);

            yield $attribute;

            if ($deep && $attribute->isDir()) {
                yield from $this->listContents($attribute->path(), true);
            }
        }
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

    public function visibility(string $path): FileAttributes
    {
        throw UnableToRetrieveMetadata::visibility($path);
    }

    public function setVisibility(string $path, string $visibility): void
    {
        throw UnableToSetVisibility::atLocation($path, 'OneDrive visibility is not supported.');
    }

    private function metadata(string $path): FileAttributes
    {
        $item = $this->client->item($path);

        if (! is_array($item) || ! isset($item['file'])) {
            throw UnableToRetrieveMetadata::create($path);
        }

        return $this->fileAttribute($path, $item);
    }

    private function attribute(string $parent, array $item): StorageAttributes
    {
        $name = (string) ($item['name'] ?? '');
        $path = trim($parent, '/') === '' ? $name : trim($parent, '/').'/'.$name;

        if (isset($item['folder'])) {
            return new DirectoryAttributes($path, null, $this->timestamp($item));
        }

        return $this->fileAttribute($path, $item);
    }

    private function fileAttribute(string $path, array $item): FileAttributes
    {
        return new FileAttributes(
            path: $path,
            fileSize: (int) ($item['size'] ?? 0),
            visibility: null,
            lastModified: $this->timestamp($item),
            mimeType: isset($item['file']['mimeType']) ? (string) $item['file']['mimeType'] : null,
        );
    }

    private function timestamp(array $item): ?int
    {
        $value = $item['lastModifiedDateTime'] ?? null;

        return is_string($value) ? strtotime($value) ?: null : null;
    }

    public function write(string $path, string $contents, Config $config): void {}
    public function writeStream(string $path, $contents, Config $config): void {}
    public function read(string $path): string { return ''; }
    public function readStream(string $path) { return fopen('php://temp', 'r+'); }
    public function delete(string $path): void {}
    public function deleteDirectory(string $path): void {}
    public function createDirectory(string $path, Config $config): void {}
    public function move(string $source, string $destination, Config $config): void {}
    public function copy(string $source, string $destination, Config $config): void {}
}
```

- [ ] **Step 4: Run adapter tests**

Run: `php artisan test --compact --filter=OneDriveAdapterTest`
Expected: PASS for current adapter tests.

## Task 5: OneDriveAdapter read/write/delete/folders/move/copy

**Files:**
- Modify: `app/Services/OneDrive/OneDriveAdapter.php`
- Test: `tests/Feature/OneDriveAdapterTest.php`

- [ ] **Step 1: Add failing CRUD tests**

Append:

```php
it('delegates read and write operations to client', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('download')->with('a.txt')->once()->andReturn('body');
    $client->shouldReceive('downloadStream')->with('a.txt')->once()->andReturn(fopen('php://temp', 'r+'));
    $client->shouldReceive('upload')->with('a.txt', 'new')->once();
    $client->shouldReceive('uploadStream')->once();

    $adapter = new OneDriveAdapter($client);
    $stream = fopen('php://temp', 'r+');

    expect($adapter->read('a.txt'))->toBe('body')
        ->and(is_resource($adapter->readStream('a.txt')))->toBeTrue();

    $adapter->write('a.txt', 'new', new Config());
    $adapter->writeStream('a.txt', $stream, new Config());
});

it('delegates delete folder move and copy operations to client', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('delete')->with('a.txt')->once();
    $client->shouldReceive('delete')->with('Folder')->once();
    $client->shouldReceive('createFolder')->with('New')->once();
    $client->shouldReceive('move')->with('a.txt', 'b.txt')->once();
    $client->shouldReceive('copy')->with('b.txt', 'c.txt')->once();

    $adapter = new OneDriveAdapter($client);
    $adapter->delete('a.txt');
    $adapter->deleteDirectory('Folder');
    $adapter->createDirectory('New', new Config());
    $adapter->move('a.txt', 'b.txt', new Config());
    $adapter->copy('b.txt', 'c.txt', new Config());

    expect(true)->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --compact --filter=OneDriveAdapterTest`
Expected: FAIL because current stub methods do not delegate.

- [ ] **Step 3: Replace stub methods with real delegation**

In `OneDriveAdapter`, replace stubs with:

```php
public function write(string $path, string $contents, Config $config): void
{
    $this->client->upload($path, $contents);
}

public function writeStream(string $path, $contents, Config $config): void
{
    $this->client->uploadStream($path, $contents);
}

public function read(string $path): string
{
    return $this->client->download($path);
}

public function readStream(string $path)
{
    return $this->client->downloadStream($path);
}

public function delete(string $path): void
{
    $this->client->delete($path);
}

public function deleteDirectory(string $path): void
{
    $this->client->delete($path);
}

public function createDirectory(string $path, Config $config): void
{
    $this->client->createFolder($path);
}

public function move(string $source, string $destination, Config $config): void
{
    $this->client->move($source, $destination);
}

public function copy(string $source, string $destination, Config $config): void
{
    $this->client->copy($source, $destination);
}
```

- [ ] **Step 4: Run adapter tests**

Run: `php artisan test --compact --filter=OneDriveAdapterTest`
Expected: PASS.

## Task 6: Register Laravel `onedrive` disk driver

**Files:**
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Modify: `app/Services/CloudStorage/Connectors/OneDriveConnector.php`
- Test: `tests/Feature/OneDriveConnectorTest.php`

- [ ] **Step 1: Add failing connector disk test**

Append/update in `tests/Feature/OneDriveConnectorTest.php`:

```php
it('returns a usable one drive filesystem disk', function () {
    $connection = oneDriveConnection([
        'access_token' => 'fresh-token',
        'refresh_token' => 'refresh-token',
        'expires_at' => now()->addHour()->timestamp,
    ]);

    $disk = app(App\Services\CloudStorage\Connectors\OneDriveConnector::class)->disk($connection);

    expect($disk)->toBeInstanceOf(Illuminate\Contracts\Filesystem\Filesystem::class);
});
```

If no `oneDriveConnection` helper exists in this file, create it using the helper from Task 1 test.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --compact --filter='returns a usable one drive filesystem disk'`
Expected: FAIL because `disk()` throws or driver is missing.

- [ ] **Step 3: Register driver in service provider**

In `app/Providers/CloudStorageServiceProvider.php`, add imports:

```php
use App\Models\CloudConnection;
use App\Services\OneDrive\OneDriveAdapter;
use App\Services\OneDrive\OneDriveClient;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Filesystem as FlysystemFilesystem;
```

Inside `boot()`, register:

```php
Storage::extend('onedrive', function ($app, array $config): FilesystemAdapter {
    $connection = $config['connection'] ?? null;

    if (! $connection instanceof CloudConnection) {
        $connectionId = $config['connection_id'] ?? null;
        $connection = CloudConnection::query()->findOrFail($connectionId);
    }

    $adapter = new OneDriveAdapter(new OneDriveClient($connection));
    $filesystem = new FlysystemFilesystem($adapter);

    return new FilesystemAdapter($filesystem, $adapter, $config);
});
```

- [ ] **Step 4: Implement connector disk**

In `OneDriveConnector`, remove `BrowsesCloudFiles` from `implements` and imports. Replace `disk()` with:

```php
public function disk(CloudConnection $connection): Filesystem
{
    return Storage::build([
        'driver' => 'onedrive',
        'connection' => $connection,
    ]);
}
```

Add import:

```php
use Illuminate\Support\Facades\Storage;
```

Remove `listContents()` and `credentialsForGraph()` only after Task 7 moves all coverage to client/adapter.

- [ ] **Step 5: Run connector test**

Run: `php artisan test --compact --filter='returns a usable one drive filesystem disk'`
Expected: PASS.

## Task 7: Move OneDrive browsing to Flysystem and remove direct listing

**Files:**
- Modify: `app/Services/CloudStorage/Connectors/OneDriveConnector.php`
- Modify: `tests/Feature/StorageBrowserTest.php`
- Modify: `tests/Feature/OneDriveConnectorTest.php`

- [ ] **Step 1: Update browser test expectation**

In `tests/Feature/StorageBrowserTest.php`, add/update test to fake the OneDrive disk driver and ensure browser output comes through Flysystem attributes. Use this shape:

```php
it('lists one drive files through the flysystem disk path', function () {
    Storage::extend('onedrive-test', function ($app, array $config) {
        $adapter = new class implements League\Flysystem\FilesystemAdapter {
            public function fileExists(string $path): bool { return true; }
            public function directoryExists(string $path): bool { return true; }
            public function write(string $path, string $contents, League\Flysystem\Config $config): void {}
            public function writeStream(string $path, $contents, League\Flysystem\Config $config): void {}
            public function read(string $path): string { return ''; }
            public function readStream(string $path) { return fopen('php://temp', 'r+'); }
            public function delete(string $path): void {}
            public function deleteDirectory(string $path): void {}
            public function createDirectory(string $path, League\Flysystem\Config $config): void {}
            public function setVisibility(string $path, string $visibility): void {}
            public function visibility(string $path): League\Flysystem\FileAttributes { return new League\Flysystem\FileAttributes($path); }
            public function mimeType(string $path): League\Flysystem\FileAttributes { return new League\Flysystem\FileAttributes($path, null, null, null, 'text/plain'); }
            public function lastModified(string $path): League\Flysystem\FileAttributes { return new League\Flysystem\FileAttributes($path, null, null, 1767225600); }
            public function fileSize(string $path): League\Flysystem\FileAttributes { return new League\Flysystem\FileAttributes($path, 12); }
            public function listContents(string $path, bool $deep): iterable
            {
                yield new League\Flysystem\FileAttributes('Docs/readme.txt', 12, null, 1767225600, 'text/plain');
            }
            public function move(string $source, string $destination, League\Flysystem\Config $config): void {}
            public function copy(string $source, string $destination, League\Flysystem\Config $config): void {}
        };

        return new Illuminate\Filesystem\FilesystemAdapter(new League\Flysystem\Filesystem($adapter), $adapter, $config);
    });

    $connector = Mockery::mock(App\Services\CloudStorage\Connectors\OneDriveConnector::class)->makePartial();
    $connector->shouldReceive('provider')->andReturn(App\Enums\CloudProvider::ONEDRIVE());
    $connector->shouldReceive('disk')->andReturn(Storage::build(['driver' => 'onedrive-test']));

    $manager = Mockery::mock(App\Services\CloudStorage\CloudStorageManager::class);
    $manager->shouldReceive('connector')->andReturn($connector);
    $manager->shouldReceive('disk')->andReturn(Storage::build(['driver' => 'onedrive-test']));
    app()->instance(App\Services\CloudStorage\CloudStorageManager::class, $manager);

    $connection = App\Models\CloudConnection::factory()->create(['provider' => App\Enums\CloudProvider::ONEDRIVE()]);

    $files = app(App\Services\CloudStorage\CloudFileBrowser::class)->list($connection, App\Services\CloudStorage\PathEncoder::encode('Docs'));

    expect($files)->toHaveCount(1)->and($files[0]['path'])->toBe('Docs/readme.txt');
});
```

- [ ] **Step 2: Run storage browser test**

Run: `php artisan test --compact --filter='lists one drive files through the flysystem disk path'`
Expected: PASS after connector no longer implements `BrowsesCloudFiles`; FAIL if direct branch still used.

- [ ] **Step 3: Remove direct OneDrive listing from connector**

In `OneDriveConnector`:

- Remove `use App\Services\CloudStorage\Contracts\BrowsesCloudFiles;`.
- Change class declaration to:

```php
class OneDriveConnector implements CloudProviderConnector
```

- Delete methods `credentialsForGraph()` and `listContents()` because `OneDriveClient` now owns token refresh and listing.

- [ ] **Step 4: Run affected tests**

Run: `php artisan test --compact --filter=OneDriveConnectorTest`
Expected: PASS after removing/rewriting direct-listing tests to client/adapter tests.

Run: `php artisan test --compact --filter=StorageBrowserTest`
Expected: PASS.

## Task 8: Flysystem exception mapping

**Files:**
- Modify: `app/Services/OneDrive/OneDriveAdapter.php`
- Test: `tests/Feature/OneDriveAdapterTest.php`

- [ ] **Step 1: Add unsupported/exception tests**

Append:

```php
it('throws explicit exceptions for unsupported visibility', function () {
    $adapter = new OneDriveAdapter(Mockery::mock(OneDriveClient::class));

    expect(fn () => $adapter->visibility('a.txt'))->toThrow(League\Flysystem\UnableToRetrieveMetadata::class)
        ->and(fn () => $adapter->setVisibility('a.txt', 'public'))->toThrow(League\Flysystem\UnableToSetVisibility::class);
});

it('throws metadata exception for missing item metadata', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('item')->with('missing.txt')->andReturn(null);

    expect(fn () => new OneDriveAdapter($client)->fileSize('missing.txt'))
        ->toThrow(League\Flysystem\UnableToRetrieveMetadata::class);
});
```

- [ ] **Step 2: Run adapter tests**

Run: `php artisan test --compact --filter=OneDriveAdapterTest`
Expected: PASS if Task 4 implementation is correct.

- [ ] **Step 3: Wrap client exceptions in Flysystem exceptions for CRUD**

Update CRUD methods to catch `Throwable` and throw operation-specific exceptions:

```php
public function write(string $path, string $contents, Config $config): void
{
    try {
        $this->client->upload($path, $contents);
    } catch (\Throwable $exception) {
        throw \League\Flysystem\UnableToWriteFile::atLocation($path, $exception->getMessage(), $exception);
    }
}
```

Repeat the same pattern with the matching exception classes:

- `writeStream` → `UnableToWriteFile::atLocation($path, ...)`
- `read` and `readStream` → `UnableToReadFile::fromLocation($path, ...)`
- `delete` → `UnableToDeleteFile::atLocation($path, ...)`
- `deleteDirectory` → `UnableToDeleteDirectory::atLocation($path, ...)`
- `createDirectory` → `UnableToCreateDirectory::atLocation($path, ...)`
- `move` → `UnableToMoveFile::fromLocationTo($source, $destination, ...)`
- `copy` → `UnableToCopyFile::fromLocationTo($source, $destination, ...)`

- [ ] **Step 4: Run adapter tests**

Run: `php artisan test --compact --filter=OneDriveAdapterTest`
Expected: PASS.

## Task 9: Final verification and cleanup

**Files:**
- Modify as needed from lint/Pint findings.

- [ ] **Step 1: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`
Expected: `{"tool":"pint","result":"passed"}` or list of fixed files.

- [ ] **Step 2: Run targeted tests**

Run:

```powershell
php artisan test --compact --filter=OneDriveClientTest
php artisan test --compact --filter=OneDriveAdapterTest
php artisan test --compact --filter=OneDriveConnectorTest
php artisan test --compact --filter=StorageBrowserTest
```

Expected: all PASS.

- [ ] **Step 3: Run full backend test suite**

Run: `php artisan test --compact`
Expected: all PASS.

- [ ] **Step 4: Run frontend checks**

Run:

```powershell
pnpm run types:check
pnpm run lint:check
pnpm run build
```

Expected: typecheck/build PASS. Lint may retain the known TanStack Virtual React Compiler warning, but must have 0 errors.

- [ ] **Step 5: Check status**

Run: `git status --short`
Expected: OneDrive adapter/client/spec/plan changes are uncommitted as requested; no generated junk or accidental worktree files.

## Self-review

- Spec coverage: client token refresh/path/Graph calls covered by Tasks 1-3; adapter mapping covered by Tasks 4-5; driver integration covered by Task 6; browser refactor covered by Task 7; unsupported/error behavior covered by Task 8; verification covered by Task 9.
- Placeholder scan: no TBD/TODO placeholders; each task has exact files, code, commands, expected results.
- Type consistency: adapter signatures match `League\Flysystem\FilesystemAdapter`; client methods referenced by adapter are introduced before use.
- Commit note: normal writing-plans template recommends commits, but this repo already has user-requested uncommitted feature changes, so this plan intentionally omits commit steps.
