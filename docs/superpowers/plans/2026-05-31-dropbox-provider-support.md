# Dropbox Provider Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dropbox as an OAuth-based cloud storage provider that users can connect from the existing Connect Storage modal and browse/upload/manage through the current file browser flows.

**Architecture:** Dropbox follows the existing OAuth provider architecture used by OneDrive: a `CloudProviderConnector` builds the OAuth redirect URL, validates callback state, exchanges the authorization code for tokens, fetches account/quota metadata, and builds a Flysystem disk for file operations. Storage uses `spatie/flysystem-dropbox` registered as a Laravel custom filesystem driver via `Storage::extend('dropbox')`. Dropbox remains an OAuth provider, so no credential form UI is needed.

**Tech Stack:** Laravel 13, Inertia React 3, Pest 4, Laravel HTTP client, Laravel custom filesystem drivers, `spatie/flysystem-dropbox`, Dropbox OAuth 2.0.

---

## File Structure

### Backend

- Modify: `composer.json` / `composer.lock`
  - Add `spatie/flysystem-dropbox`.
- Modify: `config/services.php`
  - Add Dropbox OAuth config keys.
- Create: `app/Services/CloudStorage/Connectors/DropboxConnector.php`
  - Builds Dropbox OAuth redirect URL.
  - Handles OAuth callback and token exchange.
  - Fetches Dropbox account and quota metadata.
  - Refreshes expired Dropbox access tokens before building disks.
  - Exposes Dropbox capabilities.
- Modify: `app/Providers/CloudStorageServiceProvider.php`
  - Register `DropboxConnector` in `CloudProviderRegistry`.
  - Register a Laravel `dropbox` filesystem driver using `Spatie\FlysystemDropbox\DropboxAdapter`.
- Modify: `app/Models/CloudConnection.php`
  - Allow Dropbox OAuth reconnect and name edit like Google Drive / OneDrive.
- Tests:
  - Create `tests/Feature/DropboxConnectorTest.php`.
  - Update `tests/Feature/DashboardProviderMetadataTest.php`.
  - Update registry/action tests if present.

### Frontend / Assets

- Create: `public/assets/svg/Dropbox.svg`
  - Existing enum already points `CloudProvider::DROPBOX` to this asset.
- No React form changes required because Dropbox uses existing OAuth provider option behavior.
- Regenerate Wayfinder if route/action output is stale, though no new route is needed.

### Environment

Add these keys to `.env` / deployment configuration outside the code change:

```dotenv
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
DROPBOX_REDIRECT_URI="${APP_URL}/oauth/dropbox/callback"
```

Dropbox app settings must include the exact redirect URI above.

---

## Task 1: Install Dropbox Flysystem Adapter

**Files:**
- Modify: `composer.json`
- Modify: `composer.lock`

- [ ] **Step 1: Install the adapter package**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/composer.bat' require spatie/flysystem-dropbox --no-interaction
```

Expected: `composer.json` contains `spatie/flysystem-dropbox`, `composer.lock` contains `spatie/flysystem-dropbox`, `spatie/dropbox-api`, and related dependencies.

- [ ] **Step 2: Verify Composer autoload can resolve the Dropbox adapter**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/composer.bat' dump-autoload --no-interaction
```

Expected: Composer finishes without dependency errors.

- [ ] **Step 3: Commit dependency update if committing this task**

Only commit if the user asks to commit. If committing, run:

```powershell
git add composer.json composer.lock
git commit -m "build: install Dropbox Flysystem adapter"
```

Expected: Commit succeeds.

---

## Task 2: Add Dropbox Service Configuration and Icon

**Files:**
- Modify: `config/services.php`
- Create: `public/assets/svg/Dropbox.svg`
- Test: `tests/Feature/DropboxConnectorTest.php`

- [ ] **Step 1: Add Dropbox config to `config/services.php`**

In `config/services.php`, after the `microsoft` block, add:

```php
    'dropbox' => [
        'client_id' => env('DROPBOX_CLIENT_ID'),
        'client_secret' => env('DROPBOX_CLIENT_SECRET'),
        'redirect_uri' => env('DROPBOX_REDIRECT_URI'),
    ],
```

The surrounding section should look like:

```php
    'microsoft' => [
        'client_id' => env('MICROSOFT_CLIENT_ID'),
        'client_secret' => env('MICROSOFT_CLIENT_SECRET'),
        'redirect_uri' => env('MICROSOFT_REDIRECT_URI'),
    ],

    'dropbox' => [
        'client_id' => env('DROPBOX_CLIENT_ID'),
        'client_secret' => env('DROPBOX_CLIENT_SECRET'),
        'redirect_uri' => env('DROPBOX_REDIRECT_URI'),
    ],
```

- [ ] **Step 2: Add Dropbox SVG asset**

Create `public/assets/svg/Dropbox.svg` with:

```xml
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" rx="16" fill="#0061FF" fill-opacity="0.1"/>
    <path d="M20.5 14L8 22.1L20.5 30.2L33 22.1L20.5 14Z" fill="#0061FF"/>
    <path d="M45.5 14L33 22.1L45.5 30.2L58 22.1L45.5 14Z" fill="#0061FF"/>
    <path d="M20.5 31.8L8 39.9L20.5 48L33 39.9L20.5 31.8Z" fill="#0061FF"/>
    <path d="M45.5 31.8L33 39.9L45.5 48L58 39.9L45.5 31.8Z" fill="#0061FF"/>
    <path d="M33 43.5L20.5 51.6L33 59.7L45.5 51.6L33 43.5Z" fill="#0061FF"/>
</svg>
```

- [ ] **Step 3: Write config/icon regression tests**

Create `tests/Feature/DropboxConnectorTest.php` with the initial enum/icon test:

```php
<?php

use App\Enums\CloudProvider;

it('defines Dropbox provider metadata', function () {
    $provider = CloudProvider::DROPBOX();

    expect($provider->slug())->toBe('dropbox')
        ->and($provider->description)->toBe('Dropbox')
        ->and(CloudProvider::fromSlug('dropbox')->is(CloudProvider::DROPBOX()))->toBeTrue()
        ->and(CloudProvider::getIcon(CloudProvider::DROPBOX))->toBe('/assets/svg/Dropbox.svg')
        ->and(file_exists(public_path('assets/svg/Dropbox.svg')))->toBeTrue();
});
```

- [ ] **Step 4: Run the metadata test**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan test --compact tests/Feature/DropboxConnectorTest.php
```

Expected: PASS because enum already has Dropbox and the new SVG file exists.

- [ ] **Step 5: Format PHP**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' vendor/bin/pint --dirty --format agent
```

Expected: PASS.

---

## Task 3: Implement Dropbox OAuth Connector

**Files:**
- Create: `app/Services/CloudStorage/Connectors/DropboxConnector.php`
- Test: `tests/Feature/DropboxConnectorTest.php`

- [ ] **Step 1: Append failing Dropbox connector tests**

Append the following to `tests/Feature/DropboxConnectorTest.php`:

```php
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Connectors\DropboxConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

it('builds the Dropbox OAuth redirect URL', function () {
    config()->set('services.dropbox.client_id', 'dropbox-client-id');
    config()->set('services.dropbox.redirect_uri', 'https://example.test/oauth/dropbox/callback');

    $redirectUrl = app(DropboxConnector::class)->redirectUrl();
    $redirectUrlParts = parse_url($redirectUrl);
    parse_str($redirectUrlParts['query'], $query);

    expect($redirectUrlParts['scheme'])->toBe('https')
        ->and($redirectUrlParts['host'])->toBe('www.dropbox.com')
        ->and($redirectUrlParts['path'])->toBe('/oauth2/authorize')
        ->and($query['client_id'])->toBe('dropbox-client-id')
        ->and($query['response_type'])->toBe('code')
        ->and($query['redirect_uri'])->toBe('https://example.test/oauth/dropbox/callback')
        ->and($query['token_access_type'])->toBe('offline')
        ->and($query['scope'])->toBe('account_info.read files.metadata.read files.content.read files.content.write')
        ->and($query['state'])->not->toBeEmpty()
        ->and(session('oauth_state_dropbox'))->toBe($query['state'])
        ->and($query)->not->toHaveKey('client_secret');
});

it('rejects an invalid Dropbox OAuth callback state', function () {
    session(['oauth_state_dropbox' => 'expected-state']);

    $request = Request::create('/oauth/dropbox/callback', 'GET', [
        'state' => 'invalid-state',
    ]);
    $request->setLaravelSession(session()->driver());

    app(DropboxConnector::class)->handleCallback($request);
})->throws(RuntimeException::class, 'Invalid Dropbox OAuth state.');

it('handles the Dropbox OAuth callback', function () {
    config()->set('services.dropbox.client_id', 'dropbox-client-id');
    config()->set('services.dropbox.client_secret', 'dropbox-client-secret');
    config()->set('services.dropbox.redirect_uri', 'https://example.test/oauth/dropbox/callback');

    session(['oauth_state_dropbox' => 'valid-state']);

    Http::preventStrayRequests();

    Http::fake([
        DropboxConnector::TOKEN_URL => Http::response([
            'access_token' => 'dropbox-access-token',
            'refresh_token' => 'dropbox-refresh-token',
            'expires_in' => 14400,
            'token_type' => 'bearer',
            'account_id' => 'dbid:test-account',
        ]),
        DropboxConnector::CURRENT_ACCOUNT_URL => Http::response([
            'account_id' => 'dbid:test-account',
            'name' => ['display_name' => 'Dropbox User'],
            'email' => 'dropbox@example.com',
        ]),
        DropboxConnector::SPACE_USAGE_URL => Http::response([
            'used' => 1024,
            'allocation' => [
                '.tag' => 'individual',
                'allocated' => 4096,
            ],
        ]),
    ]);

    $request = Request::create('/oauth/dropbox/callback', 'GET', [
        'code' => 'valid-code',
        'state' => 'valid-state',
    ]);
    $request->setLaravelSession(session()->driver());

    $account = app(DropboxConnector::class)->handleCallback($request);

    expect($account->providerId)->toBe('dbid:test-account')
        ->and($account->name)->toBe('Dropbox (dropbox@example.com)')
        ->and($account->credentials['access_token'])->toBe('dropbox-access-token')
        ->and($account->credentials['refresh_token'])->toBe('dropbox-refresh-token')
        ->and($account->credentials['expires_at'])->toBeInt()
        ->and($account->credentials['expires_at'])->toBeGreaterThan(now()->addHours(3)->timestamp)
        ->and($account->totalSpace)->toBe(4096)
        ->and($account->usedSpace)->toBe(1024)
        ->and(session()->has('oauth_state_dropbox'))->toBeFalse();

    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === DropboxConnector::TOKEN_URL
        && $request->isForm()
        && $request['client_id'] === 'dropbox-client-id'
        && $request['client_secret'] === 'dropbox-client-secret'
        && $request['code'] === 'valid-code'
        && $request['redirect_uri'] === 'https://example.test/oauth/dropbox/callback'
        && $request['grant_type'] === 'authorization_code');

    Http::assertSent(fn ($request): bool => $request->url() === DropboxConnector::CURRENT_ACCOUNT_URL
        && $request->hasHeader('Authorization', 'Bearer dropbox-access-token'));

    Http::assertSent(fn ($request): bool => $request->url() === DropboxConnector::SPACE_USAGE_URL
        && $request->hasHeader('Authorization', 'Bearer dropbox-access-token'));
});

it('builds a Dropbox disk from a connected account', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Dropbox',
        'provider' => CloudProvider::DROPBOX,
        'provider_id' => 'dbid:test-account',
        'credentials' => [
            'access_token' => 'fresh-dropbox-token',
            'refresh_token' => 'dropbox-refresh-token',
            'expires_at' => now()->addHour()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    Storage::shouldReceive('build')
        ->once()
        ->with([
            'driver' => 'dropbox',
            'authorization_token' => 'fresh-dropbox-token',
        ])
        ->andReturn(Mockery::mock(Filesystem::class));

    $disk = app(DropboxConnector::class)->disk($connection);

    expect($disk)->toBeInstanceOf(Filesystem::class);
});

it('refreshes an expired Dropbox token before building a disk', function () {
    config()->set('services.dropbox.client_id', 'dropbox-client-id');
    config()->set('services.dropbox.client_secret', 'dropbox-client-secret');

    Http::preventStrayRequests();
    Http::fake([
        DropboxConnector::TOKEN_URL => Http::response([
            'access_token' => 'refreshed-dropbox-token',
            'expires_in' => 14400,
            'token_type' => 'bearer',
        ]),
    ]);

    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::DROPBOX(),
        'credentials' => [
            'access_token' => 'expired-dropbox-token',
            'refresh_token' => 'dropbox-refresh-token',
            'expires_at' => now()->subMinute()->timestamp,
        ],
    ]);

    Storage::shouldReceive('build')
        ->once()
        ->with([
            'driver' => 'dropbox',
            'authorization_token' => 'refreshed-dropbox-token',
        ])
        ->andReturn(Mockery::mock(Filesystem::class));

    app(DropboxConnector::class)->disk($connection);

    expect($connection->refresh()->credentials['access_token'])->toBe('refreshed-dropbox-token')
        ->and($connection->credentials['refresh_token'])->toBe('dropbox-refresh-token')
        ->and($connection->credentials['expires_at'])->toBeGreaterThan(now()->addHours(3)->timestamp);

    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === DropboxConnector::TOKEN_URL
        && $request->isForm()
        && $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === 'dropbox-refresh-token'
        && $request['client_id'] === 'dropbox-client-id'
        && $request['client_secret'] === 'dropbox-client-secret');
});

it('exposes Dropbox provider capabilities', function () {
    $capabilities = app(DropboxConnector::class)->capabilities()->toArray();

    expect($capabilities)->toMatchArray([
        'browse' => true,
        'upload' => true,
        'download' => true,
        'delete' => true,
        'createFolder' => true,
        'share' => false,
    ]);
});

it('resolves the Dropbox connector from the cloud storage manager', function () {
    expect(app(CloudStorageManager::class)->connector(CloudProvider::DROPBOX())->provider()->value)
        ->toBe(CloudProvider::DROPBOX);
});
```

- [ ] **Step 2: Run the Dropbox tests and verify failure**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan test --compact tests/Feature/DropboxConnectorTest.php
```

Expected: FAIL because `App\Services\CloudStorage\Connectors\DropboxConnector` does not exist.

- [ ] **Step 3: Create `DropboxConnector`**

Create `app/Services/CloudStorage/Connectors/DropboxConnector.php`:

```php
<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class DropboxConnector implements CloudProviderConnector
{
    public const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';

    public const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

    public const CURRENT_ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account';

    public const SPACE_USAGE_URL = 'https://api.dropboxapi.com/2/users/get_space_usage';

    public function provider(): CloudProvider
    {
        return CloudProvider::DROPBOX();
    }

    public function redirectUrl(): string
    {
        $state = Str::random(40);

        session()->put($this->stateSessionKey(), $state);

        return self::AUTHORIZE_URL.'?'.http_build_query([
            'client_id' => config('services.dropbox.client_id'),
            'response_type' => 'code',
            'redirect_uri' => config('services.dropbox.redirect_uri'),
            'token_access_type' => 'offline',
            'scope' => 'account_info.read files.metadata.read files.content.read files.content.write',
            'state' => $state,
        ]);
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        $state = $request->query('state');
        $sessionState = $request->session()->pull($this->stateSessionKey());

        if (! is_string($state) || ! is_string($sessionState) || ! hash_equals($sessionState, $state)) {
            throw new RuntimeException('Invalid Dropbox OAuth state.');
        }

        $code = $request->query('code');

        if (! is_string($code) || $code === '') {
            throw new RuntimeException('Dropbox authentication failed or was cancelled.');
        }

        $token = $this->tokenFromAuthorizationCode($code);
        $accessToken = (string) $token['access_token'];

        $account = $this->http()->withToken($accessToken)
            ->retry([100, 250])
            ->post(self::CURRENT_ACCOUNT_URL)
            ->throw()
            ->json();

        $spaceUsage = $this->http()->withToken($accessToken)
            ->retry([100, 250])
            ->post(self::SPACE_USAGE_URL)
            ->throw()
            ->json();

        $providerId = (string) ($account['account_id'] ?? $token['account_id'] ?? 'dropbox');
        $email = (string) ($account['email'] ?? data_get($account, 'name.display_name', 'Dropbox'));
        $allocation = is_array($spaceUsage) ? ($spaceUsage['allocation'] ?? null) : null;
        $totalSpace = is_array($allocation) && isset($allocation['allocated']) ? (int) $allocation['allocated'] : null;
        $usedSpace = is_array($spaceUsage) && isset($spaceUsage['used']) ? (int) $spaceUsage['used'] : null;

        return new ConnectedAccountData(
            providerId: $providerId,
            name: "Dropbox ({$email})",
            credentials: $token,
            totalSpace: $totalSpace,
            usedSpace: $usedSpace,
        );
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        $credentials = $this->freshCredentials($connection);

        return Storage::build([
            'driver' => 'dropbox',
            'authorization_token' => (string) $credentials['access_token'],
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

    private function stateSessionKey(): string
    {
        return 'oauth_state_dropbox';
    }

    private function http(): PendingRequest
    {
        $request = Http::connectTimeout(5)->timeout(10);

        return app()->isLocal() ? $request->withoutVerifying() : $request;
    }

    /**
     * @return array<string, mixed>
     */
    private function tokenFromAuthorizationCode(string $code): array
    {
        $token = $this->http()->asForm()
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.dropbox.client_id'),
                'client_secret' => config('services.dropbox.client_secret'),
                'code' => $code,
                'redirect_uri' => config('services.dropbox.redirect_uri'),
                'grant_type' => 'authorization_code',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            throw new RuntimeException('Dropbox authentication failed or was cancelled.');
        }

        $token['expires_at'] = now()->addSeconds((int) ($token['expires_in'] ?? 14400))->timestamp;

        return $token;
    }

    /**
     * @return array<string, mixed>
     */
    private function freshCredentials(CloudConnection $connection): array
    {
        $credentials = $connection->credentials;
        $expiresAt = (int) ($credentials['expires_at'] ?? 0);

        if ($expiresAt > now()->addMinute()->timestamp) {
            return $credentials;
        }

        $refreshToken = $credentials['refresh_token'] ?? null;

        if (! is_string($refreshToken) || $refreshToken === '') {
            return $credentials;
        }

        $token = $this->http()->asForm()
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.dropbox.client_id'),
                'client_secret' => config('services.dropbox.client_secret'),
                'refresh_token' => $refreshToken,
                'grant_type' => 'refresh_token',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            return $credentials;
        }

        $freshCredentials = array_merge($credentials, $token, [
            'refresh_token' => $refreshToken,
            'expires_at' => now()->addSeconds((int) ($token['expires_in'] ?? 14400))->timestamp,
        ]);

        $connection->forceFill([
            'credentials' => $freshCredentials,
            'last_synced_at' => now(),
        ])->save();

        return $freshCredentials;
    }
}
```

- [ ] **Step 4: Run Dropbox tests and verify connector-only failures**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan test --compact tests/Feature/DropboxConnectorTest.php
```

Expected: Some tests pass; registry/disk tests may still fail because `DropboxConnector` is not registered and the custom `dropbox` filesystem driver is not registered yet.

---

## Task 4: Register Dropbox Connector and Filesystem Driver

**Files:**
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Test: `tests/Feature/DropboxConnectorTest.php`

- [ ] **Step 1: Add imports to `CloudStorageServiceProvider`**

Add these imports:

```php
use App\Services\CloudStorage\Connectors\DropboxConnector;
use Spatie\Dropbox\Client as DropboxClient;
use Spatie\FlysystemDropbox\DropboxAdapter;
```

The connector imports should include:

```php
use App\Services\CloudStorage\Connectors\DropboxConnector;
use App\Services\CloudStorage\Connectors\FtpConnector;
use App\Services\CloudStorage\Connectors\GoogleDriveConnector;
use App\Services\CloudStorage\Connectors\OneDriveConnector;
use App\Services\CloudStorage\Connectors\SftpConnector;
```

- [ ] **Step 2: Register `DropboxConnector` in the provider registry**

Update the `CloudProviderRegistry` array from:

```php
return new CloudProviderRegistry([
    $app->make(GoogleDriveConnector::class),
    $app->make(OneDriveConnector::class),
    $app->make(FtpConnector::class),
    $app->make(SftpConnector::class),
]);
```

to:

```php
return new CloudProviderRegistry([
    $app->make(GoogleDriveConnector::class),
    $app->make(OneDriveConnector::class),
    $app->make(DropboxConnector::class),
    $app->make(FtpConnector::class),
    $app->make(SftpConnector::class),
]);
```

- [ ] **Step 3: Register Laravel custom Dropbox filesystem driver**

Inside `boot()`, after the OneDrive `Storage::extend()` block and before or after the Google Drive block, add:

```php
Storage::extend('dropbox', function ($app, array $config): FilesystemAdapter {
    $adapter = new DropboxAdapter(new DropboxClient(
        (string) ($config['authorization_token'] ?? '')
    ));

    return new FilesystemAdapter(
        new Filesystem($adapter, $config),
        $adapter,
        $config
    );
});
```

- [ ] **Step 4: Run Dropbox tests**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan test --compact tests/Feature/DropboxConnectorTest.php
```

Expected: PASS.

- [ ] **Step 5: Format PHP**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' vendor/bin/pint --dirty --format agent
```

Expected: PASS.

---

## Task 5: Expose Dropbox in Provider Metadata and Connection Actions

**Files:**
- Modify: `app/Models/CloudConnection.php`
- Modify: `tests/Feature/DashboardProviderMetadataTest.php`
- Test: `tests/Feature/DropboxConnectorTest.php`

- [ ] **Step 1: Update connection action support**

In `app/Models/CloudConnection.php`, update `canReconnect()` from:

```php
return in_array($this->provider->value, [
    CloudProvider::GOOGLE_DRIVE,
    CloudProvider::ONEDRIVE,
], true);
```

to:

```php
return in_array($this->provider->value, [
    CloudProvider::GOOGLE_DRIVE,
    CloudProvider::ONEDRIVE,
    CloudProvider::DROPBOX,
], true);
```

Update `canEditName()` from:

```php
return in_array($this->provider->value, [
    CloudProvider::GOOGLE_DRIVE,
    CloudProvider::ONEDRIVE,
    CloudProvider::FTP,
    CloudProvider::SFTP,
], true);
```

to:

```php
return in_array($this->provider->value, [
    CloudProvider::GOOGLE_DRIVE,
    CloudProvider::ONEDRIVE,
    CloudProvider::DROPBOX,
    CloudProvider::FTP,
    CloudProvider::SFTP,
], true);
```

- [ ] **Step 2: Add Dropbox action test**

Append to `tests/Feature/DropboxConnectorTest.php`:

```php
it('allows Dropbox connections to reconnect and edit name through OAuth', function () {
    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::DROPBOX(),
    ]);

    expect($connection->actions())->toMatchArray([
        'canReconnect' => true,
        'canEditName' => true,
        'canEditConnection' => false,
        'canDelete' => true,
    ]);
});
```

- [ ] **Step 3: Update dashboard metadata test to include Dropbox**

In `tests/Feature/DashboardProviderMetadataTest.php`, create a Dropbox mock connector after the OneDrive connector:

```php
$dropboxConnector = Mockery::mock(CloudProviderConnector::class);
$dropboxConnector->shouldReceive('provider')->andReturn(CloudProvider::DROPBOX());
$dropboxConnector->shouldReceive('capabilities')->andReturn(new ProviderCapabilities(
    browse: true,
    upload: true,
    download: true,
    delete: true,
    createFolder: true,
    share: false,
));
```

Update the manager connectors from:

```php
$manager->shouldReceive('connectors')->once()->andReturn([
    $googleConnector,
    $oneDriveConnector,
    $ftpConnector,
]);
```

to:

```php
$manager->shouldReceive('connectors')->once()->andReturn([
    $googleConnector,
    $oneDriveConnector,
    $dropboxConnector,
    $ftpConnector,
]);
```

Update the assertion count:

```php
->has('availableProviders', 4)
```

Add these assertions before the FTP assertions:

```php
->where('availableProviders.2.key', 'dropbox')
->where('availableProviders.2.label', 'Dropbox')
->where('availableProviders.2.value', CloudProvider::DROPBOX)
->where('availableProviders.2.icon', '/assets/svg/Dropbox.svg')
->where('availableProviders.2.status', 'active')
->where('availableProviders.2.authType', 'oauth')
->where('availableProviders.2.redirectUrl', route('oauth.redirect', ['provider' => 'dropbox']))
->where('availableProviders.2.capabilities', [
    'browse' => true,
    'upload' => true,
    'download' => true,
    'delete' => true,
    'createFolder' => true,
    'share' => false,
])
```

Then shift the FTP assertions from index `2` to index `3`:

```php
->where('availableProviders.3.key', 'ftp')
->where('availableProviders.3.label', 'FTP Server')
->where('availableProviders.3.value', CloudProvider::FTP)
->where('availableProviders.3.icon', '/assets/svg/Ftp.svg')
->where('availableProviders.3.status', 'active')
->where('availableProviders.3.authType', 'credentials')
->where('availableProviders.3.redirectUrl', null)
->where('availableProviders.3.capabilities', [
    'browse' => true,
    'upload' => true,
    'download' => true,
    'delete' => true,
    'createFolder' => true,
    'share' => false,
])
```

- [ ] **Step 4: Run relevant tests**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan test --compact tests/Feature/DropboxConnectorTest.php tests/Feature/DashboardProviderMetadataTest.php tests/Feature/CloudProviderRegistryTest.php
```

Expected: PASS.

- [ ] **Step 5: Format PHP**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' vendor/bin/pint --dirty --format agent
```

Expected: PASS.

---

## Task 6: Regenerate Wayfinder and Run Frontend Checks

**Files:**
- Potentially modify generated files under `resources/js/actions` and `resources/js/routes` if Wayfinder output changes.
- No manual React code changes expected.

- [ ] **Step 1: Regenerate Wayfinder routes/actions**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan wayfinder:generate
```

Expected: command succeeds. Because Dropbox uses existing OAuth routes, generated output may remain unchanged.

- [ ] **Step 2: Run frontend type check**

Run through PowerShell:

```powershell
pnpm run types:check
```

Expected: PASS.

- [ ] **Step 3: Format changed frontend/generated files if needed**

If Wayfinder modifies TypeScript files, run:

```powershell
pnpm exec prettier --write resources/js/actions resources/js/routes resources/js/types/cloud.ts
```

Expected: Prettier finishes without errors.

---

## Task 7: Manual Dropbox OAuth Verification

**Files:**
- No source changes unless verification finds a bug.

- [ ] **Step 1: Configure Dropbox OAuth app**

In the Dropbox App Console:

1. Create or open a scoped-access Dropbox app.
2. Add redirect URI: `https://your-app.test/oauth/dropbox/callback` or the local APP_URL equivalent.
3. Enable scopes:

```txt
account_info.read
files.metadata.read
files.content.read
files.content.write
```

4. Copy app key and app secret into environment variables:

```dotenv
DROPBOX_CLIENT_ID=<app-key>
DROPBOX_CLIENT_SECRET=<app-secret>
DROPBOX_REDIRECT_URI=<app-url>/oauth/dropbox/callback
```

- [ ] **Step 2: Clear Laravel config cache**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan optimize:clear
```

Expected: config/cache/routes/views are cleared.

- [ ] **Step 3: Verify Connect Storage shows Dropbox**

Open Dashboard → Connect Storage.

Expected:

- Dropbox appears as an active OAuth provider.
- Dropbox uses `/assets/svg/Dropbox.svg`.
- Clicking Dropbox redirects to Dropbox OAuth, not to a credential form.

- [ ] **Step 4: Complete OAuth callback**

Authorize the app in Dropbox.

Expected:

- User returns to Dashboard.
- A new CloudConnection exists with provider Dropbox.
- Flash message says Dropbox connected successfully.
- Connection card displays Dropbox icon/name/quota if Dropbox returns quota.

- [ ] **Step 5: Verify file operations**

Open the Dropbox connection and test:

1. Browse root folder.
2. Browse a subfolder.
3. Create a folder.
4. Upload a small file.
5. Download the file.
6. Delete the file/folder.
7. Reconnect Dropbox from the sidebar actions.

Expected: all supported actions work with the Dropbox Flysystem disk.

---

## Task 8: Final Verification and Optional Commit

**Files:**
- All modified files from previous tasks.

- [ ] **Step 1: Run backend tests**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' artisan test --compact tests/Feature/DropboxConnectorTest.php tests/Feature/DashboardProviderMetadataTest.php tests/Feature/CloudProviderRegistryTest.php tests/Feature/StorageBrowserTest.php
```

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run through PowerShell:

```powershell
pnpm run types:check
```

Expected: PASS.

- [ ] **Step 3: Run formatters**

Run through PowerShell:

```powershell
& 'D:/Program/dev_stack/bin/php.bat' vendor/bin/pint --dirty --format agent
pnpm exec prettier --check resources/js/actions resources/js/routes resources/js/types/cloud.ts
```

Expected: PASS.

- [ ] **Step 4: Inspect diff**

Run through PowerShell:

```powershell
git diff -- composer.json composer.lock config/services.php app/Services/CloudStorage/Connectors/DropboxConnector.php app/Providers/CloudStorageServiceProvider.php app/Models/CloudConnection.php tests/Feature/DropboxConnectorTest.php tests/Feature/DashboardProviderMetadataTest.php public/assets/svg/Dropbox.svg resources/js/actions resources/js/routes
```

Expected: diff only contains Dropbox provider support changes.

- [ ] **Step 5: Commit only if requested**

If the user asks to commit, run:

```powershell
git add composer.json composer.lock config/services.php app/Services/CloudStorage/Connectors/DropboxConnector.php app/Providers/CloudStorageServiceProvider.php app/Models/CloudConnection.php tests/Feature/DropboxConnectorTest.php tests/Feature/DashboardProviderMetadataTest.php public/assets/svg/Dropbox.svg resources/js/actions resources/js/routes
git commit -m "feat: add Dropbox storage provider"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: The plan adds Dropbox as an OAuth provider, uses `spatie/flysystem-dropbox`, registers a Dropbox Flysystem adapter, exposes Dropbox in provider metadata, supports OAuth connect/reconnect, and covers file browser operations through existing storage flows.
- Placeholder scan: No TBD/TODO placeholders remain. All implementation snippets, test snippets, and commands are explicit.
- Type consistency: `DropboxConnector`, `CloudProvider::DROPBOX`, `oauth_state_dropbox`, `services.dropbox.*`, and `driver => dropbox` are used consistently across tests, connector, provider registration, and config.
