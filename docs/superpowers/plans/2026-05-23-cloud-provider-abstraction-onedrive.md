# Cloud Provider Abstraction + OneDrive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor cloud storage into reusable provider connectors and add OneDrive OAuth + browsing support.

**Architecture:** Provider-specific OAuth/disk logic lives in connector classes resolved by a registry. Controllers delegate to services; file browsing uses shared DTOs, path encoding, mapping, and sorting. React pages consume provider/file metadata instead of hardcoded provider UI.

**Tech Stack:** Laravel 13, Inertia v3 React, Pest 4, Flysystem, Google Drive adapter, `justus/flysystem-onedrive`, Microsoft Graph OAuth.

---

## File Structure

### Backend files to create

- `app/Data/ConnectedAccountData.php` — normalized OAuth callback result.
- `app/Data/CloudFileData.php` — normalized file row payload for Inertia.
- `app/Data/ProviderCapabilities.php` — provider action support flags.
- `app/Services/CloudStorage/Contracts/CloudProviderConnector.php` — connector interface.
- `app/Services/CloudStorage/Connectors/GoogleDriveConnector.php` — Google OAuth + disk.
- `app/Services/CloudStorage/Connectors/OneDriveConnector.php` — Microsoft OAuth + disk.
- `app/Services/CloudStorage/CloudProviderRegistry.php` — enum → connector resolver.
- `app/Services/CloudStorage/CloudStorageManager.php` — disk/provider façade.
- `app/Services/CloudStorage/CloudFileBrowser.php` — list/map/sort folder contents.
- `app/Services/CloudStorage/PathEncoder.php` — URL-safe base64 path encode/decode.
- `app/Services/CloudStorage/CloudFileTypeDetector.php` — extension → UI type.

### Backend files to modify

- `composer.json` / `composer.lock` — add `justus/flysystem-onedrive` after approval.
- `config/services.php` — add Microsoft OAuth config.
- `app/Models/CloudConnection.php` — remove Google-specific disk construction.
- `app/Providers/CloudStorageServiceProvider.php` — bind connectors/registry/manager and register drivers.
- `app/Http/Controllers/CloudConnectionController.php` — generic provider OAuth.
- `app/Http/Controllers/StorageBrowserController.php` — delegate to `CloudFileBrowser`.
- `app/Http/Controllers/HomeController.php` — provide `availableProviders` and shared formatting.
- `routes/web.php` — generic OAuth routes.
- Wayfinder generated TS files — regenerate after route/controller signature changes.

### Frontend files to create

- `resources/js/types/cloud.ts` — shared provider/connection/file types.
- `resources/js/lib/cloud-path.ts` — URL-safe base64 path encoder.
- `resources/js/lib/format-bytes.ts` — byte formatting utility.
- `resources/js/components/cloud/StorageOverviewCards.tsx`
- `resources/js/components/cloud/ConnectStorageModal.tsx`
- `resources/js/components/cloud/ProviderOption.tsx`
- `resources/js/components/cloud/UsageSummary.tsx`
- `resources/js/components/cloud/RecentActivityList.tsx`
- `resources/js/components/files/FileBrowserHeader.tsx`
- `resources/js/components/files/FileToolbar.tsx`
- `resources/js/components/files/VirtualizedFileTable.tsx`
- `resources/js/components/files/EmptyFileState.tsx`

### Frontend files to modify

- `resources/js/pages/dashboard.tsx` — compose extracted dashboard components.
- `resources/js/pages/files/index.tsx` — compose extracted file browser components.
- `resources/js/components/FileTableRow.tsx` — consume shared `CloudFile` type and capabilities.

---

## Task 1: Add backend path/type DTO foundation

**Files:**
- Create: `app/Data/ConnectedAccountData.php`
- Create: `app/Data/CloudFileData.php`
- Create: `app/Data/ProviderCapabilities.php`
- Create: `app/Services/CloudStorage/PathEncoder.php`
- Create: `app/Services/CloudStorage/CloudFileTypeDetector.php`
- Test: `tests/Feature/CloudStorageFoundationTest.php`

- [ ] **Step 1: Create failing Pest test**

Create `tests/Feature/CloudStorageFoundationTest.php`:

```php
<?php

use App\Data\CloudFileData;
use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Services\CloudStorage\CloudFileTypeDetector;
use App\Services\CloudStorage\PathEncoder;

it('encodes and decodes unicode cloud paths using url safe base64', function () {
    $path = 'Khách hàng/Ảnh hợp đồng.pdf';

    $encoded = PathEncoder::encode($path);

    expect($encoded)->not->toContain('+')
        ->and($encoded)->not->toContain('/')
        ->and($encoded)->not->toContain('=')
        ->and(PathEncoder::decode($encoded))->toBe($path);
});

it('returns empty string for invalid encoded paths', function () {
    expect(PathEncoder::decode('not valid ***'))->toBe('');
});

it('detects cloud file types from filename and directory flag', function () {
    expect(CloudFileTypeDetector::detect('Docs', true))->toBe('folder')
        ->and(CloudFileTypeDetector::detect('contract.pdf', false))->toBe('document')
        ->and(CloudFileTypeDetector::detect('photo.webp', false))->toBe('image')
        ->and(CloudFileTypeDetector::detect('app.tsx', false))->toBe('code')
        ->and(CloudFileTypeDetector::detect('backup.zip', false))->toBe('archive')
        ->and(CloudFileTypeDetector::detect('movie.mp4', false))->toBe('video')
        ->and(CloudFileTypeDetector::detect('song.mp3', false))->toBe('audio')
        ->and(CloudFileTypeDetector::detect('unknown.bin', false))->toBe('other');
});

it('serializes cloud storage data objects to arrays', function () {
    $account = new ConnectedAccountData(
        providerId: 'user-1',
        name: 'OneDrive (user@example.com)',
        credentials: ['access_token' => 'token'],
        totalSpace: 100,
        usedSpace: 25,
    );

    $file = new CloudFileData(
        id: 'folder/file.pdf',
        path: 'folder/file.pdf',
        name: 'file.pdf',
        type: 'document',
        size: 1000,
        updatedAt: 'May 23, 2026',
        isDirectory: false,
    );

    $capabilities = new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: false,
    );

    expect($account->toArray())->toMatchArray([
        'provider_id' => 'user-1',
        'name' => 'OneDrive (user@example.com)',
        'credentials' => ['access_token' => 'token'],
        'total_space' => 100,
        'used_space' => 25,
    ])->and($file->toArray())->toMatchArray([
        'id' => 'folder/file.pdf',
        'path' => 'folder/file.pdf',
        'name' => 'file.pdf',
        'type' => 'document',
        'size' => 1000,
        'updatedAt' => 'May 23, 2026',
        'isDirectory' => false,
    ])->and($capabilities->toArray())->toMatchArray([
        'browse' => true,
        'upload' => true,
        'download' => true,
        'delete' => true,
        'createFolder' => true,
        'share' => false,
    ]);
});
```

- [ ] **Step 2: Run failing test**

Run: `php artisan test --compact --filter=CloudStorageFoundationTest`

Expected: FAIL because classes do not exist.

- [ ] **Step 3: Implement data classes and utilities**

Create `app/Data/ConnectedAccountData.php`:

```php
<?php

namespace App\Data;

class ConnectedAccountData
{
    /**
     * @param  array<string, mixed>  $credentials
     */
    public function __construct(
        public string $providerId,
        public string $name,
        public array $credentials,
        public ?int $totalSpace,
        public ?int $usedSpace,
    ) {}

    /**
     * @return array{provider_id: string, name: string, credentials: array<string, mixed>, total_space: int|null, used_space: int|null}
     */
    public function toArray(): array
    {
        return [
            'provider_id' => $this->providerId,
            'name' => $this->name,
            'credentials' => $this->credentials,
            'total_space' => $this->totalSpace,
            'used_space' => $this->usedSpace,
        ];
    }
}
```

Create `app/Data/CloudFileData.php`:

```php
<?php

namespace App\Data;

class CloudFileData
{
    public function __construct(
        public string $id,
        public string $path,
        public string $name,
        public string $type,
        public int $size,
        public string $updatedAt,
        public bool $isDirectory,
    ) {}

    /**
     * @return array{id: string, path: string, name: string, type: string, size: int, updatedAt: string, isDirectory: bool}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'path' => $this->path,
            'name' => $this->name,
            'type' => $this->type,
            'size' => $this->size,
            'updatedAt' => $this->updatedAt,
            'isDirectory' => $this->isDirectory,
        ];
    }
}
```

Create `app/Data/ProviderCapabilities.php`:

```php
<?php

namespace App\Data;

class ProviderCapabilities
{
    public function __construct(
        public bool $browse,
        public bool $upload,
        public bool $download,
        public bool $delete,
        public bool $createFolder,
        public bool $share,
    ) {}

    /**
     * @return array{browse: bool, upload: bool, download: bool, delete: bool, createFolder: bool, share: bool}
     */
    public function toArray(): array
    {
        return [
            'browse' => $this->browse,
            'upload' => $this->upload,
            'download' => $this->download,
            'delete' => $this->delete,
            'createFolder' => $this->createFolder,
            'share' => $this->share,
        ];
    }
}
```

Create `app/Services/CloudStorage/PathEncoder.php`:

```php
<?php

namespace App\Services\CloudStorage;

class PathEncoder
{
    public static function encode(string $path): string
    {
        if ($path === '') {
            return '';
        }

        return rtrim(strtr(base64_encode($path), '+/', '-_'), '=');
    }

    public static function decode(?string $path): string
    {
        if ($path === null || $path === '') {
            return '';
        }

        $normalized = strtr($path, '-_', '+/');
        $padding = strlen($normalized) % 4;

        if ($padding > 0) {
            $normalized .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode($normalized, true);

        return $decoded === false ? '' : $decoded;
    }
}
```

Create `app/Services/CloudStorage/CloudFileTypeDetector.php`:

```php
<?php

namespace App\Services\CloudStorage;

class CloudFileTypeDetector
{
    public static function detect(string $name, bool $isDirectory): string
    {
        if ($isDirectory) {
            return 'folder';
        }

        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        return match (true) {
            in_array($extension, ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'], true) => 'document',
            in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'], true) => 'image',
            in_array($extension, ['js', 'ts', 'jsx', 'tsx', 'php', 'css', 'html', 'json'], true) => 'code',
            in_array($extension, ['zip', 'rar', 'tar', 'gz', '7z'], true) => 'archive',
            in_array($extension, ['mp4', 'mov', 'avi', 'mkv'], true) => 'video',
            in_array($extension, ['mp3', 'wav', 'ogg'], true) => 'audio',
            default => 'other',
        };
    }
}
```

- [ ] **Step 4: Verify foundation test passes**

Run: `php artisan test --compact --filter=CloudStorageFoundationTest`

Expected: PASS.

- [ ] **Step 5: Format PHP**

Run: `vendor/bin/pint --dirty --format agent`

Expected: no style errors.

---

## Task 2: Add connector contract, registry, and manager

**Files:**
- Create: `app/Services/CloudStorage/Contracts/CloudProviderConnector.php`
- Create: `app/Services/CloudStorage/CloudProviderRegistry.php`
- Create: `app/Services/CloudStorage/CloudStorageManager.php`
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Test: `tests/Feature/CloudProviderRegistryTest.php`

- [ ] **Step 1: Write failing registry test with fake connectors**

Create `tests/Feature/CloudProviderRegistryTest.php`:

```php
<?php

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;

class FakeGoogleConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::GOOGLE_DRIVE();
    }

    public function redirectUrl(): string
    {
        return 'https://google.example/oauth';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        return new ConnectedAccountData('google-id', 'Google Drive', [], null, null);
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return app(Filesystem::class);
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(true, true, true, true, true, false);
    }
}

class FakeOneDriveConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::ONEDRIVE();
    }

    public function redirectUrl(): string
    {
        return 'https://microsoft.example/oauth';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        return new ConnectedAccountData('onedrive-id', 'OneDrive', [], null, null);
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return app(Filesystem::class);
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(true, true, true, true, true, false);
    }
}

it('resolves connectors by cloud provider', function () {
    $registry = new CloudProviderRegistry([
        new FakeGoogleConnector,
        new FakeOneDriveConnector,
    ]);

    expect($registry->for(CloudProvider::GOOGLE_DRIVE()))->toBeInstanceOf(FakeGoogleConnector::class)
        ->and($registry->for(CloudProvider::ONEDRIVE()))->toBeInstanceOf(FakeOneDriveConnector::class)
        ->and($registry->all())->toHaveCount(2);
});

it('throws for unregistered providers', function () {
    $registry = new CloudProviderRegistry([new FakeGoogleConnector]);

    expect(fn () => $registry->for(CloudProvider::ONEDRIVE()))->toThrow(InvalidArgumentException::class);
});

it('manager delegates connector resolution', function () {
    $manager = new CloudStorageManager(new CloudProviderRegistry([
        new FakeGoogleConnector,
        new FakeOneDriveConnector,
    ]));

    expect($manager->connector(CloudProvider::ONEDRIVE()))->toBeInstanceOf(FakeOneDriveConnector::class);
});
```

- [ ] **Step 2: Run failing registry test**

Run: `php artisan test --compact --filter=CloudProviderRegistryTest`

Expected: FAIL because classes/interfaces do not exist.

- [ ] **Step 3: Implement contract, registry, manager**

Create `app/Services/CloudStorage/Contracts/CloudProviderConnector.php`:

```php
<?php

namespace App\Services\CloudStorage\Contracts;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;

interface CloudProviderConnector
{
    public function provider(): CloudProvider;

    public function redirectUrl(): string;

    public function handleCallback(Request $request): ConnectedAccountData;

    public function disk(CloudConnection $connection): Filesystem;

    public function capabilities(): ProviderCapabilities;
}
```

Create `app/Services/CloudStorage/CloudProviderRegistry.php`:

```php
<?php

namespace App\Services\CloudStorage;

use App\Enums\CloudProvider;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use InvalidArgumentException;

class CloudProviderRegistry
{
    /** @var array<int, CloudProviderConnector> */
    private array $connectors = [];

    /**
     * @param  iterable<CloudProviderConnector>  $connectors
     */
    public function __construct(iterable $connectors)
    {
        foreach ($connectors as $connector) {
            $this->connectors[$connector->provider()->value] = $connector;
        }
    }

    public function for(CloudProvider $provider): CloudProviderConnector
    {
        return $this->connectors[$provider->value]
            ?? throw new InvalidArgumentException("Unsupported cloud provider [{$provider->value}].");
    }

    /** @return array<int, CloudProviderConnector> */
    public function all(): array
    {
        return array_values($this->connectors);
    }
}
```

Create `app/Services/CloudStorage/CloudStorageManager.php`:

```php
<?php

namespace App\Services\CloudStorage;

use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;

class CloudStorageManager
{
    public function __construct(private CloudProviderRegistry $registry) {}

    public function connector(CloudProvider $provider): CloudProviderConnector
    {
        return $this->registry->for($provider);
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return $this->connector($connection->provider)->disk($connection);
    }

    /** @return array<int, CloudProviderConnector> */
    public function connectors(): array
    {
        return $this->registry->all();
    }
}
```

- [ ] **Step 4: Bind registry with empty connector list temporarily**

Modify `app/Providers/CloudStorageServiceProvider.php` `register()` method after existing bindings:

```php
$this->app->singleton(CloudProviderRegistry::class, function () {
    return new CloudProviderRegistry([]);
});

$this->app->singleton(CloudStorageManager::class);
```

Add imports:

```php
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\CloudStorageManager;
```

- [ ] **Step 5: Run registry test**

Run: `php artisan test --compact --filter=CloudProviderRegistryTest`

Expected: PASS.

---

## Task 3: Move Google OAuth/disk into connector

**Files:**
- Create: `app/Services/CloudStorage/Connectors/GoogleDriveConnector.php`
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Modify: `app/Models/CloudConnection.php`
- Test: `tests/Feature/CloudConnectionTest.php`

- [ ] **Step 1: Add failing test for Google connector redirect and callback**

Append to `tests/Feature/CloudConnectionTest.php`:

```php
it('google connector creates redirect url', function () {
    $mockClient = Mockery::mock(Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('setClientSecret')->once();
    $mockClient->shouldReceive('setRedirectUri')->once();
    $mockClient->shouldReceive('addScope')->once();
    $mockClient->shouldReceive('setAccessType')->once()->with('offline');
    $mockClient->shouldReceive('setPrompt')->once()->with('consent');
    $mockClient->shouldReceive('createAuthUrl')->once()->andReturn('https://accounts.google.com/oauth');

    $this->app->instance(Client::class, $mockClient);

    $connector = app(\App\Services\CloudStorage\Connectors\GoogleDriveConnector::class);

    expect($connector->redirectUrl())->toBe('https://accounts.google.com/oauth');
});
```

- [ ] **Step 2: Run failing test**

Run: `php artisan test --compact --filter='google connector creates redirect url'`

Expected: FAIL because `GoogleDriveConnector` does not exist.

- [ ] **Step 3: Implement Google connector**

Create `app/Services/CloudStorage/Connectors/GoogleDriveConnector.php`:

```php
<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Google\Client;
use Google\Service\Drive;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class GoogleDriveConnector implements CloudProviderConnector
{
    public function __construct(private Client $client, private Drive $drive) {}

    public function provider(): CloudProvider
    {
        return CloudProvider::GOOGLE_DRIVE();
    }

    public function redirectUrl(): string
    {
        $this->client->setClientId(config('services.google.client_id'));
        $this->client->setClientSecret(config('services.google.client_secret'));
        $this->client->setRedirectUri(config('services.google.redirect_uri'));
        $this->client->addScope(Drive::DRIVE);
        $this->client->setAccessType('offline');
        $this->client->setPrompt('consent');

        return $this->client->createAuthUrl();
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        $code = $request->query('code');

        if (! is_string($code) || $code === '') {
            throw new RuntimeException('Google authentication failed or was cancelled.');
        }

        $this->client->setClientId(config('services.google.client_id'));
        $this->client->setClientSecret(config('services.google.client_secret'));
        $this->client->setRedirectUri(config('services.google.redirect_uri'));

        $token = $this->client->fetchAccessTokenWithAuthCode($code);

        if (isset($token['error'])) {
            throw new RuntimeException('Failed to retrieve access token.');
        }

        $this->client->setAccessToken($token);

        $about = $this->drive->about->get(['fields' => 'user,storageQuota']);
        $googleUser = $about->getUser();
        $emailAddress = $googleUser->getEmailAddress() ?? 'Google Drive';
        $quota = $about->getStorageQuota();

        return new ConnectedAccountData(
            providerId: $emailAddress,
            name: 'Google Drive ('.$emailAddress.')',
            credentials: $token,
            totalSpace: $quota->getLimit(),
            usedSpace: $quota->getUsage(),
        );
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return Storage::build([
            'driver' => 'google_drive',
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'credentials' => $connection->credentials,
            'connection_id' => $connection->id,
        ]);
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: true,
            share: false,
        );
    }
}
```

- [ ] **Step 4: Register Google connector in provider registry**

Modify `app/Providers/CloudStorageServiceProvider.php` imports:

```php
use App\Services\CloudStorage\Connectors\GoogleDriveConnector;
```

Change registry singleton:

```php
$this->app->singleton(CloudProviderRegistry::class, function ($app) {
    return new CloudProviderRegistry([
        $app->make(GoogleDriveConnector::class),
    ]);
});
```

- [ ] **Step 5: Delegate `CloudConnection::getDisk()` to manager**

Modify `app/Models/CloudConnection.php` imports remove `Storage`, add:

```php
use App\Services\CloudStorage\CloudStorageManager;
```

Replace `getDisk()` body:

```php
public function getDisk(): Filesystem
{
    return app(CloudStorageManager::class)->disk($this);
}
```

- [ ] **Step 6: Run Google tests**

Run: `php artisan test --compact --filter=CloudConnectionTest`

Expected: PASS. Existing controller tests may still pass before controller refactor because old code still exists.

---

## Task 4: Refactor OAuth routes/controller to generic provider flow

**Files:**
- Modify: `routes/web.php`
- Modify: `app/Http/Controllers/CloudConnectionController.php`
- Modify: `tests/Feature/CloudConnectionTest.php`

- [ ] **Step 1: Update tests to generic route names**

In `tests/Feature/CloudConnectionTest.php`, replace Google route calls:

```php
route('oauth.google.redirect')
```

with:

```php
route('oauth.redirect', ['provider' => 'google-drive'])
```

Replace:

```php
route('oauth.google.callback', ['code' => 'valid_code'])
```

with:

```php
route('oauth.callback', ['provider' => 'google-drive', 'code' => 'valid_code'])
```

Add test:

```php
it('rejects unsupported oauth providers', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('oauth.redirect', ['provider' => 'unknown']));

    $response->assertNotFound();
});
```

- [ ] **Step 2: Run failing tests**

Run: `php artisan test --compact --filter=CloudConnectionTest`

Expected: FAIL because generic routes do not exist.

- [ ] **Step 3: Add provider slug helpers to enum**

Modify `app/Enums/CloudProvider.php` add methods:

```php
public function slug(): string
{
    return match ($this->value) {
        self::GOOGLE_DRIVE => 'google-drive',
        self::ONEDRIVE => 'onedrive',
        self::DROPBOX => 'dropbox',
        self::AWS_S3 => 'aws-s3',
        self::FTP => 'ftp',
        default => (string) $this->value,
    };
}

public static function fromSlug(string $slug): ?self
{
    return match ($slug) {
        'google-drive' => self::GOOGLE_DRIVE(),
        'onedrive' => self::ONEDRIVE(),
        'dropbox' => self::DROPBOX(),
        'aws-s3' => self::AWS_S3(),
        'ftp' => self::FTP(),
        default => null,
    };
}
```

- [ ] **Step 4: Modify routes**

In `routes/web.php`, replace provider-specific OAuth routes:

```php
Route::get('/oauth/google/redirect', [CloudConnectionController::class, 'redirectToGoogle'])->name('oauth.google.redirect');
Route::get('/oauth/google/callback', [CloudConnectionController::class, 'handleGoogleCallback'])->name('oauth.google.callback');
```

with:

```php
Route::get('/oauth/{provider}/redirect', [CloudConnectionController::class, 'redirect'])->name('oauth.redirect');
Route::get('/oauth/{provider}/callback', [CloudConnectionController::class, 'callback'])->name('oauth.callback');
```

- [ ] **Step 5: Refactor controller**

Replace `app/Http/Controllers/CloudConnectionController.php` with:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Throwable;

class CloudConnectionController extends Controller
{
    public function __construct(private CloudStorageManager $cloudStorage) {}

    public function redirect(string $provider): RedirectResponse
    {
        $cloudProvider = CloudProvider::fromSlug($provider);

        abort_if($cloudProvider === null, 404);

        return redirect()->away($this->cloudStorage->connector($cloudProvider)->redirectUrl());
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $cloudProvider = CloudProvider::fromSlug($provider);

        abort_if($cloudProvider === null, 404);

        try {
            $account = $this->cloudStorage->connector($cloudProvider)->handleCallback($request);

            $connection = $request->user()->cloudConnections()->firstOrNew([
                'provider' => $cloudProvider,
                'provider_id' => $account->providerId,
            ]);

            $connection->fill([
                'name' => $account->name,
                'credentials' => $account->credentials,
                'status' => ConnectionStatus::CONNECTED(),
                'total_space' => $account->totalSpace,
                'used_space' => $account->usedSpace,
                'error_message' => null,
                'last_synced_at' => now(),
            ])->save();

            return redirect()->route('dashboard')->with('success', 'Successfully connected to '.$cloudProvider->description.'!');
        } catch (Throwable $e) {
            report($e);

            return redirect()->route('dashboard')->with('error', 'Could not connect to '.$cloudProvider->description.'.');
        }
    }

    public function disconnect(Request $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized action.');
        }

        $connection->delete();

        return redirect()->route('dashboard')->with('success', 'Successfully disconnected '.$connection->name);
    }
}
```

- [ ] **Step 6: Run CloudConnection tests**

Run: `php artisan test --compact --filter=CloudConnectionTest`

Expected: PASS after updating expected success message to `Successfully connected to Google Drive!` if needed.

---

## Task 5: Add OneDrive dependency, config, connector skeleton

**Files:**
- Modify: `composer.json`, `composer.lock`
- Modify: `config/services.php`
- Create: `app/Services/CloudStorage/Connectors/OneDriveConnector.php`
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Test: `tests/Feature/OneDriveConnectorTest.php`

- [ ] **Step 1: Ask approval for dependency install if not already approved in this execution session**

Run only after approval: `composer require justus/flysystem-onedrive`

Expected: package installed, lock updated.

- [ ] **Step 2: Write failing OneDrive redirect test**

Create `tests/Feature/OneDriveConnectorTest.php`:

```php
<?php

use App\Services\CloudStorage\Connectors\OneDriveConnector;

it('builds microsoft oauth redirect url', function () {
    config()->set('services.microsoft.client_id', 'client-id');
    config()->set('services.microsoft.redirect_uri', 'https://app.test/oauth/onedrive/callback');

    $url = app(OneDriveConnector::class)->redirectUrl();

    expect($url)->toStartWith('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
        ->and($url)->toContain('client_id=client-id')
        ->and($url)->toContain('response_type=code')
        ->and(urldecode($url))->toContain('User.Read Files.ReadWrite.All offline_access');
});
```

- [ ] **Step 3: Run failing OneDrive test**

Run: `php artisan test --compact --filter=OneDriveConnectorTest`

Expected: FAIL because connector does not exist.

- [ ] **Step 4: Add Microsoft config**

In `config/services.php`, after `google` config add:

```php
'microsoft' => [
    'client_id' => env('MICROSOFT_CLIENT_ID'),
    'client_secret' => env('MICROSOFT_CLIENT_SECRET'),
    'redirect_uri' => env('MICROSOFT_REDIRECT_URI'),
],
```

- [ ] **Step 5: Implement OneDrive connector redirect skeleton**

Create `app/Services/CloudStorage/Connectors/OneDriveConnector.php`:

```php
<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class OneDriveConnector implements CloudProviderConnector
{
    private const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

    private const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    public function provider(): CloudProvider
    {
        return CloudProvider::ONEDRIVE();
    }

    public function redirectUrl(): string
    {
        return self::AUTHORIZE_URL.'?'.http_build_query([
            'client_id' => config('services.microsoft.client_id'),
            'response_type' => 'code',
            'redirect_uri' => config('services.microsoft.redirect_uri'),
            'response_mode' => 'query',
            'scope' => 'User.Read Files.ReadWrite.All offline_access',
        ]);
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        throw new RuntimeException('OneDrive callback is not implemented yet.');
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return Storage::build([
            'driver' => 'onedrive',
            'access_token' => $connection->credentials['access_token'] ?? null,
            'root' => 'me',
            'directory_type' => 'drives',
        ]);
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: true,
            share: false,
        );
    }
}
```

- [ ] **Step 6: Register OneDrive connector in registry**

Modify `app/Providers/CloudStorageServiceProvider.php` imports:

```php
use App\Services\CloudStorage\Connectors\OneDriveConnector;
```

Update connector registry:

```php
return new CloudProviderRegistry([
    $app->make(GoogleDriveConnector::class),
    $app->make(OneDriveConnector::class),
]);
```

- [ ] **Step 7: Run OneDrive redirect test**

Run: `php artisan test --compact --filter='builds microsoft oauth redirect url'`

Expected: PASS.

---

## Task 6: Implement OneDrive OAuth callback using Laravel HTTP fakeable requests

**Files:**
- Modify: `app/Services/CloudStorage/Connectors/OneDriveConnector.php`
- Modify: `tests/Feature/OneDriveConnectorTest.php`

- [ ] **Step 1: Add failing callback test**

Append to `tests/Feature/OneDriveConnectorTest.php`:

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

it('handles microsoft oauth callback and normalizes account data', function () {
    config()->set('services.microsoft.client_id', 'client-id');
    config()->set('services.microsoft.client_secret', 'secret');
    config()->set('services.microsoft.redirect_uri', 'https://app.test/oauth/onedrive/callback');

    Http::fake([
        'login.microsoftonline.com/*/oauth2/v2.0/token' => Http::response([
            'access_token' => 'access-token',
            'refresh_token' => 'refresh-token',
            'expires_in' => 3600,
        ]),
        'graph.microsoft.com/v1.0/me' => Http::response([
            'id' => 'microsoft-user-id',
            'displayName' => 'Test User',
            'userPrincipalName' => 'user@example.com',
        ]),
        'graph.microsoft.com/v1.0/me/drive' => Http::response([
            'quota' => [
                'total' => 1000,
                'used' => 250,
            ],
        ]),
    ]);

    $request = Request::create('/oauth/onedrive/callback', 'GET', ['code' => 'valid-code']);

    $account = app(OneDriveConnector::class)->handleCallback($request);

    expect($account->providerId)->toBe('microsoft-user-id')
        ->and($account->name)->toBe('OneDrive (user@example.com)')
        ->and($account->credentials['access_token'])->toBe('access-token')
        ->and($account->credentials['refresh_token'])->toBe('refresh-token')
        ->and($account->totalSpace)->toBe(1000)
        ->and($account->usedSpace)->toBe(250);
});
```

- [ ] **Step 2: Run failing callback test**

Run: `php artisan test --compact --filter='handles microsoft oauth callback'`

Expected: FAIL because callback throws not implemented.

- [ ] **Step 3: Implement OneDrive callback**

Replace `handleCallback()` in `OneDriveConnector`:

```php
public function handleCallback(Request $request): ConnectedAccountData
{
    $code = $request->query('code');

    if (! is_string($code) || $code === '') {
        throw new RuntimeException('Microsoft authentication failed or was cancelled.');
    }

    $token = Http::asForm()
        ->timeout(10)
        ->post(self::TOKEN_URL, [
            'client_id' => config('services.microsoft.client_id'),
            'client_secret' => config('services.microsoft.client_secret'),
            'code' => $code,
            'redirect_uri' => config('services.microsoft.redirect_uri'),
            'grant_type' => 'authorization_code',
        ])
        ->throw()
        ->json();

    $accessToken = $token['access_token'] ?? null;

    if (! is_string($accessToken) || $accessToken === '') {
        throw new RuntimeException('Microsoft did not return an access token.');
    }

    $user = Http::withToken($accessToken)
        ->timeout(10)
        ->get('https://graph.microsoft.com/v1.0/me')
        ->throw()
        ->json();

    $drive = Http::withToken($accessToken)
        ->timeout(10)
        ->get('https://graph.microsoft.com/v1.0/me/drive')
        ->throw()
        ->json();

    $providerId = (string) ($user['id'] ?? $user['userPrincipalName'] ?? 'onedrive');
    $email = (string) ($user['mail'] ?? $user['userPrincipalName'] ?? $user['displayName'] ?? 'OneDrive');

    return new ConnectedAccountData(
        providerId: $providerId,
        name: 'OneDrive ('.$email.')',
        credentials: $token,
        totalSpace: isset($drive['quota']['total']) ? (int) $drive['quota']['total'] : null,
        usedSpace: isset($drive['quota']['used']) ? (int) $drive['quota']['used'] : null,
    );
}
```

- [ ] **Step 4: Run OneDrive connector tests**

Run: `php artisan test --compact --filter=OneDriveConnectorTest`

Expected: PASS.

---

## Task 7: Register OneDrive filesystem driver and token refresh path

**Files:**
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Modify: `app/Services/CloudStorage/Connectors/OneDriveConnector.php`
- Test: `tests/Feature/OneDriveConnectorTest.php`

- [ ] **Step 1: Add token refresh test**

Append to `tests/Feature/OneDriveConnectorTest.php`:

```php
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;

it('refreshes expired microsoft tokens before building disk config', function () {
    Http::fake([
        'login.microsoftonline.com/*/oauth2/v2.0/token' => Http::response([
            'access_token' => 'new-access-token',
            'refresh_token' => 'new-refresh-token',
            'expires_in' => 3600,
        ]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive (user@example.com)',
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'microsoft-user-id',
        'credentials' => [
            'access_token' => 'old-access-token',
            'refresh_token' => 'old-refresh-token',
            'expires_at' => now()->subMinute()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $credentials = app(OneDriveConnector::class)->credentialsForDisk($connection);

    expect($credentials['access_token'])->toBe('new-access-token')
        ->and($connection->fresh()->credentials['access_token'])->toBe('new-access-token');
});
```

- [ ] **Step 2: Run failing refresh test**

Run: `php artisan test --compact --filter='refreshes expired microsoft tokens'`

Expected: FAIL because `credentialsForDisk()` does not exist.

- [ ] **Step 3: Add reusable token refresh method**

In `OneDriveConnector`, add method:

```php
/** @return array<string, mixed> */
public function credentialsForDisk(CloudConnection $connection): array
{
    $credentials = $connection->credentials ?? [];
    $expiresAt = $credentials['expires_at'] ?? null;

    if (is_numeric($expiresAt) && (int) $expiresAt > now()->addMinute()->timestamp) {
        return $credentials;
    }

    $refreshToken = $credentials['refresh_token'] ?? null;

    if (! is_string($refreshToken) || $refreshToken === '') {
        return $credentials;
    }

    $token = Http::asForm()
        ->timeout(10)
        ->post(self::TOKEN_URL, [
            'client_id' => config('services.microsoft.client_id'),
            'client_secret' => config('services.microsoft.client_secret'),
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token',
        ])
        ->throw()
        ->json();

    $token['expires_at'] = now()->addSeconds((int) ($token['expires_in'] ?? 3600))->timestamp;
    $credentials = array_merge($credentials, $token);

    $connection->update([
        'credentials' => $credentials,
        'last_synced_at' => now(),
    ]);

    return $credentials;
}
```

In `handleCallback()`, before returning data, add:

```php
$token['expires_at'] = now()->addSeconds((int) ($token['expires_in'] ?? 3600))->timestamp;
```

Change `disk()`:

```php
public function disk(CloudConnection $connection): Filesystem
{
    $credentials = $this->credentialsForDisk($connection);

    return Storage::build([
        'driver' => 'onedrive',
        'access_token' => $credentials['access_token'] ?? null,
        'root' => 'me',
        'directory_type' => 'drives',
    ]);
}
```

- [ ] **Step 4: Register OneDrive Storage driver**

In `CloudStorageServiceProvider::boot()`, after Google driver, add a driver. Adjust class names to match installed package if composer exposes different namespaces; inspect vendor package before editing.

Expected shape:

```php
Storage::extend('onedrive', function ($app, $config) {
    $graph = new \Microsoft\Graph\Graph;
    $graph->setAccessToken($config['access_token']);

    $adapter = new \Justus\FlysystemOneDrive\OneDriveAdapter(
        $graph,
        $config['root'] ?? 'me',
        ['directory_type' => $config['directory_type'] ?? 'drives'],
    );

    return new FilesystemAdapter(
        new Filesystem($adapter),
        $adapter,
        $config,
    );
});
```

If installed package uses a different namespace/API, replace only this driver block with vendor-documented class names. Keep the connector API unchanged.

- [ ] **Step 5: Run OneDrive tests**

Run: `php artisan test --compact --filter=OneDriveConnectorTest`

Expected: PASS.

---

## Task 8: Move file browsing to service

**Files:**
- Create: `app/Services/CloudStorage/CloudFileBrowser.php`
- Modify: `app/Http/Controllers/StorageBrowserController.php`
- Test: `tests/Feature/StorageBrowserTest.php`

- [ ] **Step 1: Write service test with fake Storage disk**

Create `tests/Feature/StorageBrowserTest.php`:

```php
<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudFileBrowser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('lists files with folders first and normalized metadata', function () {
    Storage::fake('testing');
    Storage::disk('testing')->makeDirectory('Projects');
    Storage::disk('testing')->put('zeta.txt', 'hello');
    Storage::disk('testing')->put('alpha.pdf', 'hello');

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive (user@example.com)',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'user@example.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    app()->bind(\App\Services\CloudStorage\CloudStorageManager::class, function () {
        return new class {
            public function disk(CloudConnection $connection)
            {
                return Storage::disk('testing');
            }

            public function connector($provider)
            {
                return new class {
                    public function capabilities()
                    {
                        return new \App\Data\ProviderCapabilities(true, true, true, true, true, false);
                    }
                };
            }
        };
    });

    $files = app(CloudFileBrowser::class)->list($connection, '');

    expect($files)->toHaveCount(3)
        ->and($files[0]['name'])->toBe('Projects')
        ->and($files[0]['type'])->toBe('folder')
        ->and($files[1]['name'])->toBe('alpha.pdf')
        ->and($files[1]['type'])->toBe('document')
        ->and($files[2]['name'])->toBe('zeta.txt');
});
```

- [ ] **Step 2: Run failing browser test**

Run: `php artisan test --compact --filter=StorageBrowserTest`

Expected: FAIL because `CloudFileBrowser` does not exist.

- [ ] **Step 3: Implement CloudFileBrowser**

Create `app/Services/CloudStorage/CloudFileBrowser.php`:

```php
<?php

namespace App\Services\CloudStorage;

use App\Data\CloudFileData;
use App\Models\CloudConnection;
use League\Flysystem\StorageAttributes;

class CloudFileBrowser
{
    public function __construct(private CloudStorageManager $cloudStorage) {}

    /** @return array<int, array{id: string, path: string, name: string, type: string, size: int, updatedAt: string, isDirectory: bool}> */
    public function list(CloudConnection $connection, string $encodedPath): array
    {
        $decodedPath = PathEncoder::decode($encodedPath);
        $contents = $this->cloudStorage->disk($connection)->listContents($decodedPath, false);
        $files = [];

        foreach ($contents as $item) {
            /** @var StorageAttributes $item */
            $name = basename($item->path());

            if (str_starts_with($name, '.')) {
                continue;
            }

            $isDirectory = $item->isDir();
            $files[] = (new CloudFileData(
                id: $item->path(),
                path: $item->path(),
                name: $name,
                type: CloudFileTypeDetector::detect($name, $isDirectory),
                size: $isDirectory ? 0 : (int) ($item->fileSize() ?? 0),
                updatedAt: $item->lastModified() ? date('M j, Y', $item->lastModified()) : '--',
                isDirectory: $isDirectory,
            ))->toArray();
        }

        usort($files, function (array $a, array $b): int {
            if ($a['isDirectory'] && ! $b['isDirectory']) {
                return -1;
            }

            if (! $a['isDirectory'] && $b['isDirectory']) {
                return 1;
            }

            return strnatcasecmp($a['name'], $b['name']);
        });

        return $files;
    }

    public function decodedPath(string $encodedPath): string
    {
        return PathEncoder::decode($encodedPath);
    }
}
```

- [ ] **Step 4: Refactor controller**

Replace `app/Http/Controllers/StorageBrowserController.php` with:

```php
<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class StorageBrowserController extends Controller
{
    public function __construct(
        private CloudFileBrowser $browser,
        private CloudStorageManager $cloudStorage,
    ) {}

    public function index(CloudConnection $connection, string $path = '')
    {
        abort_if($connection->user_id !== auth()->id(), 403, 'Unauthorized access to this connection.');

        try {
            $files = $this->browser->list($connection, $path);
        } catch (\Throwable $e) {
            Log::error($e);
            $files = [];
            session()->flash('error', 'Could not retrieve files from this storage.');
        }

        return Inertia::render('files/index', [
            'connection' => [
                'id' => $connection->id,
                'name' => $connection->name,
                'provider' => $connection->provider->value,
                'capabilities' => $this->cloudStorage->connector($connection->provider)->capabilities()->toArray(),
            ],
            'currentPath' => $path,
            'decodedPath' => $this->browser->decodedPath($path),
            'files' => $files,
        ]);
    }
}
```

- [ ] **Step 5: Run browser tests**

Run: `php artisan test --compact --filter=StorageBrowserTest`

Expected: PASS.

---

## Task 9: Add backend provider metadata for dashboard

**Files:**
- Modify: `app/Http/Controllers/HomeController.php`
- Test: `tests/Feature/DashboardProviderMetadataTest.php`

- [ ] **Step 1: Write failing dashboard metadata test**

Create `tests/Feature/DashboardProviderMetadataTest.php`:

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('passes available providers to dashboard', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->has('availableProviders', 2)
            ->where('availableProviders.0.key', 'google-drive')
            ->where('availableProviders.1.key', 'onedrive')
        );
});
```

- [ ] **Step 2: Run failing metadata test**

Run: `php artisan test --compact --filter=DashboardProviderMetadataTest`

Expected: FAIL because `availableProviders` missing.

- [ ] **Step 3: Update HomeController**

Modify constructor and response in `app/Http/Controllers/HomeController.php`:

```php
use App\Services\CloudStorage\CloudStorageManager;

public function __construct(private CloudStorageManager $cloudStorage) {}
```

Add method:

```php
private function availableProviders(): array
{
    return collect($this->cloudStorage->connectors())
        ->map(function ($connector) {
            $provider = $connector->provider();

            return [
                'key' => $provider->slug(),
                'label' => $provider->description,
                'value' => $provider->value,
                'icon' => CloudProvider::getIcon($provider->value),
                'status' => 'active',
                'redirectUrl' => route('oauth.redirect', ['provider' => $provider->slug()]),
                'capabilities' => $connector->capabilities()->toArray(),
            ];
        })
        ->values()
        ->all();
}
```

Add to inertia props:

```php
'availableProviders' => $this->availableProviders(),
```

- [ ] **Step 4: Run metadata test**

Run: `php artisan test --compact --filter=DashboardProviderMetadataTest`

Expected: PASS.

---

## Task 10: Add frontend shared types/utilities and refactor file browser

**Files:**
- Create: `resources/js/types/cloud.ts`
- Create: `resources/js/lib/cloud-path.ts`
- Create: `resources/js/lib/format-bytes.ts`
- Create: `resources/js/components/files/FileBrowserHeader.tsx`
- Create: `resources/js/components/files/FileToolbar.tsx`
- Create: `resources/js/components/files/VirtualizedFileTable.tsx`
- Create: `resources/js/components/files/EmptyFileState.tsx`
- Modify: `resources/js/components/FileTableRow.tsx`
- Modify: `resources/js/pages/files/index.tsx`

- [ ] **Step 1: Create shared cloud types**

Create `resources/js/types/cloud.ts`:

```ts
export interface ProviderCapabilities {
    browse: boolean;
    upload: boolean;
    download: boolean;
    delete: boolean;
    createFolder: boolean;
    share: boolean;
}

export interface AvailableProvider {
    key: string;
    label: string;
    value: number;
    icon: string;
    status: 'active' | 'disabled' | 'coming-soon';
    redirectUrl: string | null;
    capabilities: ProviderCapabilities;
}

export interface CloudConnection {
    id: number;
    name: string;
    provider: string;
    provider_value?: number;
    provider_icon?: string;
    status?: string;
    status_value?: number;
    used_space?: number;
    total_space?: number;
    used_formatted?: string;
    total_formatted?: string;
    percent?: number;
    capabilities?: ProviderCapabilities;
}

export interface CloudFile {
    id: string | number;
    path: string;
    name: string;
    type: 'folder' | 'document' | 'image' | 'code' | 'archive' | 'video' | 'audio' | 'other';
    size: number;
    updatedAt: string;
    isDirectory: boolean;
}
```

- [ ] **Step 2: Create frontend path/bytes utilities**

Create `resources/js/lib/cloud-path.ts`:

```ts
export function encodeCloudPath(path: string): string {
    if (!path) {
        return '';
    }

    const bytes = new TextEncoder().encode(path);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

Create `resources/js/lib/format-bytes.ts`:

```ts
export function formatBytes(bytes: number, precision = 1): string {
    if (bytes <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

    return `${(bytes / Math.pow(1024, unitIndex)).toFixed(precision)} ${units[unitIndex]}`;
}
```

- [ ] **Step 3: Refactor FileTableRow**

Replace `resources/js/components/FileTableRow.tsx` with a version using `CloudFile` and capabilities. Preserve current visuals; change props:

```ts
import type { CloudFile, ProviderCapabilities } from '@/types/cloud';

export function FileTableRow({
    item,
    style,
    capabilities,
    onNavigate,
}: {
    item: CloudFile;
    style: React.CSSProperties;
    capabilities?: ProviderCapabilities;
    onNavigate?: (item: CloudFile) => void;
}) {
```

Use `item.isDirectory` instead of `item.type === 'folder'` for folder checks. Show Share/Download/Delete buttons only when `capabilities?.share`, `capabilities?.download`, `capabilities?.delete` are true.

- [ ] **Step 4: Create extracted file components**

Create components matching existing JSX:

- `FileBrowserHeader` props: `connection`, `decodedPath`, `onNavigateHome`.
- `FileToolbar` props: `decodedPath`, `searchQuery`, `setSearchQuery`, `capabilities`.
- `EmptyFileState` props: `searchQuery`.
- `VirtualizedFileTable` props: `files`, `capabilities`, `onNavigate`.

Move current JSX from `resources/js/pages/files/index.tsx` into these components without changing styling.

- [ ] **Step 5: Replace files page with composition**

`resources/js/pages/files/index.tsx` should:

- import shared `CloudConnection`, `CloudFile`.
- filter files by search query.
- use `encodeCloudPath(file.path)` for folder navigation.
- use Wayfinder `index.url({ connection: connection.id, path: encodedPath })` from `@/actions/App/Http/Controllers/StorageBrowserController` if generated; otherwise keep current URL until Wayfinder regeneration.

- [ ] **Step 6: Run frontend typecheck**

Run: `pnpm run types:check`

Expected: PASS.

---

## Task 11: Refactor dashboard provider UI

**Files:**
- Create: `resources/js/components/cloud/StorageOverviewCards.tsx`
- Create: `resources/js/components/cloud/ConnectStorageModal.tsx`
- Create: `resources/js/components/cloud/ProviderOption.tsx`
- Create: `resources/js/components/cloud/UsageSummary.tsx`
- Create: `resources/js/components/cloud/RecentActivityList.tsx`
- Modify: `resources/js/pages/dashboard.tsx`

- [ ] **Step 1: Create provider option component**

Create `resources/js/components/cloud/ProviderOption.tsx`:

```tsx
import { ChevronRight, Cloud, Lock } from 'lucide-react';
import type { AvailableProvider } from '@/types/cloud';

export function ProviderOption({ provider }: { provider: AvailableProvider }) {
    const active = provider.status === 'active' && provider.redirectUrl;

    if (!active) {
        return (
            <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left opacity-75 select-none">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-500/5 text-gray-400">
                        {provider.icon?.endsWith('.svg') ? <img src={provider.icon} className="h-6 w-6" alt={provider.label} /> : <Cloud className="h-6 w-6" />}
                    </div>
                    <div>
                        <h5 className="text-sm font-bold text-gray-500">{provider.label}</h5>
                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400">Coming Soon</span>
                    </div>
                </div>
                <Lock className="mr-1 h-4 w-4 text-gray-300" />
            </div>
        );
    }

    return (
        <button
            onClick={() => {
                window.location.href = provider.redirectUrl!;
            }}
            className="group flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:border-blue-200 hover:bg-blue-50/20"
        >
            <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    {provider.icon?.endsWith('.svg') ? <img src={provider.icon} className="h-6 w-6" alt={provider.label} /> : <Cloud className="h-6 w-6" />}
                </div>
                <div>
                    <h5 className="text-sm font-bold text-gray-900">{provider.label}</h5>
                    <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">Active</span>
                </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 transition-all group-hover:translate-x-1 group-hover:text-blue-600" />
        </button>
    );
}
```

- [ ] **Step 2: Extract remaining dashboard components**

Move existing dashboard JSX into focused components while preserving current styling:

- `ConnectStorageModal` receives `providers`, `onClose`.
- `StorageOverviewCards` receives `connections`, `onDisconnect`.
- `UsageSummary` receives `connections` and uses `formatBytes`.
- `RecentActivityList` contains current static recent activities.

- [ ] **Step 3: Simplify dashboard page**

`resources/js/pages/dashboard.tsx` props:

```ts
interface DashboardProps {
    connections: CloudConnection[];
    availableProviders: AvailableProvider[];
}
```

The page should only manage modal state and disconnect handler, then compose extracted components.

- [ ] **Step 4: Run frontend checks**

Run: `pnpm run types:check`

Expected: PASS.

Run: `pnpm run lint:check`

Expected: PASS or only pre-existing lint failures. Fix new lint failures.

---

## Task 12: Regenerate Wayfinder routes/actions

**Files:**
- Modify generated files under `resources/js/actions/` and `resources/js/routes/`

- [ ] **Step 1: Regenerate Wayfinder**

Run: `php artisan wayfinder:generate --no-interaction`

Expected: generated TypeScript route helpers include generic OAuth routes and updated storage route metadata.

- [ ] **Step 2: Update imports if generated names changed**

If `StorageBrowserController.index` helper remains available, use it in file navigation:

```ts
import { index as storageIndex } from '@/actions/App/Http/Controllers/StorageBrowserController';
```

Use:

```ts
router.visit(storageIndex.url({ connection: connection.id, path: encodedPath }));
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run types:check`

Expected: PASS.

---

## Task 13: Final verification

**Files:**
- All changed files

- [ ] **Step 1: Run PHP formatter**

Run: `vendor/bin/pint --dirty --format agent`

Expected: dirty PHP files formatted.

- [ ] **Step 2: Run targeted tests**

Run:

```bash
php artisan test --compact --filter=CloudStorageFoundationTest
php artisan test --compact --filter=CloudProviderRegistryTest
php artisan test --compact --filter=CloudConnectionTest
php artisan test --compact --filter=OneDriveConnectorTest
php artisan test --compact --filter=StorageBrowserTest
php artisan test --compact --filter=DashboardProviderMetadataTest
```

Expected: all PASS.

- [ ] **Step 3: Run full backend test suite**

Run: `php artisan test --compact`

Expected: PASS.

- [ ] **Step 4: Run frontend verification**

Run:

```bash
pnpm run types:check
pnpm run lint:check
pnpm run build
```

Expected: PASS.

- [ ] **Step 5: Manual app verification**

Run app with existing project command:

```bash
composer run dev
```

Open dashboard in browser. Verify:

- Dashboard loads.
- Connect modal shows Google Drive and OneDrive active.
- Clicking Google still redirects to Google OAuth.
- Clicking OneDrive redirects to Microsoft OAuth when Microsoft env config exists.
- Existing file browser route opens for a Google connection.
- Folder navigation still encodes Unicode paths correctly.

---

## Self-Review

- Spec coverage: provider abstraction, OneDrive OAuth, shared file browser service, DTOs, frontend provider metadata, tests, and verification are covered by Tasks 1-13.
- Dependency caveat: `justus/flysystem-onedrive` installation requires explicit approval before execution because it changes dependencies.
- Vendor API caveat: Task 7 requires inspecting installed package namespaces for the OneDrive adapter block; connector API remains stable.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation steps remain.
- Type consistency: provider data uses `provider_id`, `total_space`, `used_space` in PHP persistence and camelCase only where existing React props already use camelCase (`updatedAt`, `isDirectory`, `createFolder`).
