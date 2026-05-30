# FTP Provider Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FTP as a credential-based storage provider that can be connected from the existing Connect Storage modal and used by the current file browser/upload flows.

**Architecture:** FTP uses the existing provider registry and encrypted `CloudConnection.credentials`, but introduces provider `authType` metadata so the UI can distinguish OAuth redirects from credential forms. Backend creates/updates FTP connections through dedicated routes that validate credentials, build an on-demand Flysystem FTP disk, and require a successful root listing before saving.

**Tech Stack:** Laravel 13, Inertia React 3, React 19, Tailwind CSS 4, Laravel Wayfinder, Flysystem FTP adapter `league/flysystem-ftp:^3.0`, Pest 4.

---

## File Structure

### Backend

- Modify `composer.json` / `composer.lock`
  - Add `league/flysystem-ftp:^3.0`.
- Create `app/Services/CloudStorage/Connectors/FtpConnector.php`
  - Builds FTP disks from encrypted connection credentials.
  - Exposes FTP capabilities.
- Create `app/Http/Requests/StoreFtpConnectionRequest.php`
  - Validates FTP create payload.
- Create `app/Http/Requests/UpdateFtpConnectionRequest.php`
  - Validates FTP edit payload where password is optional.
- Create `app/Http/Controllers/FtpConnectionController.php`
  - Stores/updates FTP connections after testing the connection.
  - Returns safe non-password config for edit if needed.
- Modify `app/Providers/CloudStorageServiceProvider.php`
  - Register `FtpConnector`.
- Modify `app/Http/Controllers/HomeController.php`
  - Add `authType` to provider metadata.
  - Keep OAuth redirect URLs for OAuth providers and return null/internal handling for FTP.
- Modify `app/Models/CloudConnection.php`
  - FTP can edit name and edit connection; no reconnect.
- Modify `routes/web.php`
  - Add FTP credential routes.
- Tests:
  - Create `tests/Feature/FtpConnectionTest.php`.
  - Update `tests/Feature/DashboardProviderMetadataTest.php`.
  - Update provider registry tests if needed.

### Frontend

- Modify `resources/js/types/cloud.ts`
  - Add `authType` to `AvailableProvider`.
  - Add FTP form data/config types if useful.
- Modify `resources/js/components/cloud/ConnectStorageModal.tsx`
  - Track selected credential provider and render FTP form.
- Modify `resources/js/components/cloud/ProviderOption.tsx`
  - OAuth providers redirect.
  - Credential providers call an `onSelectCredentialsProvider` callback.
- Create `resources/js/components/cloud/FtpConnectionForm.tsx`
  - Basic + advanced collapsible form.
  - POST create endpoint.
  - Password field never prefilled.
- Modify `resources/js/components/cloud/ConnectionActionsMenu.tsx`
  - Wire edit connection action for FTP.
- Optionally create `resources/js/components/cloud/EditFtpConnectionDialog.tsx`
  - Edit existing non-secret config; password optional.

---

## Task 1: Install FTP Adapter and Add Backend Connector

**Files:**
- Modify: `composer.json`
- Modify: `composer.lock`
- Create: `app/Services/CloudStorage/Connectors/FtpConnector.php`
- Modify: `app/Providers/CloudStorageServiceProvider.php`
- Test: `tests/Feature/FtpConnectionTest.php`

- [ ] **Step 1: Install the Flysystem FTP adapter**

Run:

```bash
"D:/Program/dev_stack/bin/composer.bat" require league/flysystem-ftp:^3.0 --no-interaction
```

Expected: `composer.json` and `composer.lock` include `league/flysystem-ftp`.

- [ ] **Step 2: Write failing connector tests**

Create `tests/Feature/FtpConnectionTest.php`:

```php
<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\Connectors\FtpConnector;

it('registers the ftp provider connector', function () {
    $connector = app(CloudProviderRegistry::class)->connector(CloudProvider::FTP());

    expect($connector)->toBeInstanceOf(FtpConnector::class);
});

it('exposes ftp provider capabilities', function () {
    $capabilities = app(FtpConnector::class)->capabilities();

    expect($capabilities)->toBeInstanceOf(ProviderCapabilities::class)
        ->and($capabilities->toArray())->toMatchArray([
            'browse' => true,
            'upload' => true,
            'download' => true,
            'delete' => true,
            'createFolder' => true,
            'share' => false,
        ]);
});

it('builds an ftp disk from encrypted connection credentials', function () {
    $connection = CloudConnection::factory()->for(User::factory())->create([
        'provider' => CloudProvider::FTP(),
        'credentials' => [
            'host' => 'ftp.example.com',
            'port' => 2121,
            'username' => 'alice',
            'password' => 'secret',
            'root' => '/uploads',
            'ssl' => true,
            'passive' => true,
            'timeout' => 45,
            'utf8' => true,
            'ignore_passive_address' => true,
            'system_type' => 'unix',
            'recurse_manually' => true,
            'timestamps_on_unix_listings_enabled' => false,
        ],
    ]);

    $disk = app(FtpConnector::class)->disk($connection);

    expect($disk)->toBeInstanceOf(\Illuminate\Contracts\Filesystem\Filesystem::class);
});
```

- [ ] **Step 3: Run test and verify failure**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan test --compact tests/Feature/FtpConnectionTest.php
```

Expected: FAIL because `FtpConnector` is not created or registered.

- [ ] **Step 4: Create FTP connector**

Create `app/Services/CloudStorage/Connectors/FtpConnector.php`:

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
use Illuminate\Support\Facades\Storage;
use LogicException;

class FtpConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::FTP();
    }

    public function redirectUrl(): string
    {
        return '';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        throw new LogicException('FTP connections use credential-based authentication.');
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return Storage::build($this->diskConfig($connection->credentials));
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

    /**
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function diskConfig(array $credentials): array
    {
        return array_filter([
            'driver' => 'ftp',
            'host' => $credentials['host'] ?? '',
            'username' => $credentials['username'] ?? '',
            'password' => $credentials['password'] ?? '',
            'port' => (int) ($credentials['port'] ?? 21),
            'root' => $credentials['root'] ?? '',
            'passive' => (bool) ($credentials['passive'] ?? true),
            'ssl' => (bool) ($credentials['ssl'] ?? false),
            'timeout' => (int) ($credentials['timeout'] ?? 30),
            'utf8' => (bool) ($credentials['utf8'] ?? false),
            'ignorePassiveAddress' => $credentials['ignore_passive_address'] ?? null,
            'systemType' => $credentials['system_type'] ?? null,
            'recurseManually' => (bool) ($credentials['recurse_manually'] ?? true),
            'timestampsOnUnixListingsEnabled' => (bool) ($credentials['timestamps_on_unix_listings_enabled'] ?? false),
        ], fn (mixed $value): bool => $value !== null);
    }
}
```

- [ ] **Step 5: Register FTP connector**

Modify `app/Providers/CloudStorageServiceProvider.php` imports:

```php
use App\Services\CloudStorage\Connectors\FtpConnector;
```

Update connector registry array:

```php
return new CloudProviderRegistry([
    $app->make(GoogleDriveConnector::class),
    $app->make(OneDriveConnector::class),
    $app->make(FtpConnector::class),
]);
```

- [ ] **Step 6: Run connector tests**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan test --compact tests/Feature/FtpConnectionTest.php
```

Expected: PASS.

- [ ] **Step 7: Format PHP**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" vendor/bin/pint --dirty --format agent
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add composer.json composer.lock app/Services/CloudStorage/Connectors/FtpConnector.php app/Providers/CloudStorageServiceProvider.php tests/Feature/FtpConnectionTest.php
git commit -m "feat: add FTP storage connector"
```

---

## Task 2: Provider Metadata and Connection Actions

**Files:**
- Modify: `app/Http/Controllers/HomeController.php`
- Modify: `app/Models/CloudConnection.php`
- Modify: `resources/js/types/cloud.ts`
- Test: `tests/Feature/DashboardProviderMetadataTest.php`
- Test: `tests/Feature/FtpConnectionTest.php`

- [ ] **Step 1: Write failing metadata tests**

Append to `tests/Feature/DashboardProviderMetadataTest.php`:

```php
it('marks ftp as a credential based provider', function () {
    $user = \App\Models\User::factory()->create();

    $response = $this->actingAs($user)->get('/dashboard');

    $providers = collect($response->viewData('page')['props']['availableProviders']);
    $ftp = $providers->firstWhere('key', 'ftp');

    expect($ftp)->not->toBeNull()
        ->and($ftp['authType'])->toBe('credentials')
        ->and($ftp['redirectUrl'])->toBeNull();
});
```

Append to `tests/Feature/FtpConnectionTest.php`:

```php
it('allows ftp connections to edit name and connection settings without oauth reconnect', function () {
    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::FTP(),
    ]);

    expect($connection->actions())->toMatchArray([
        'canReconnect' => false,
        'canEditName' => true,
        'canEditConnection' => true,
        'canDelete' => true,
    ]);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan test --compact tests/Feature/DashboardProviderMetadataTest.php tests/Feature/FtpConnectionTest.php
```

Expected: FAIL because `authType` is absent and FTP actions are not enabled.

- [ ] **Step 3: Add authType metadata**

Modify `app/Http/Controllers/HomeController.php` provider metadata return:

```php
$authType = $provider->is(CloudProvider::FTP()) ? 'credentials' : 'oauth';

return [
    'key' => $provider->slug(),
    'label' => $provider->description,
    'value' => $provider->value,
    'icon' => CloudProvider::getIcon($provider->value),
    'status' => 'active',
    'authType' => $authType,
    'redirectUrl' => $authType === 'oauth' ? route('oauth.redirect', ['provider' => $provider->slug()]) : null,
    'capabilities' => $connector->capabilities()->toArray(),
];
```

Update the PHPDoc return shape to include `authType: string` and nullable `redirectUrl`.

- [ ] **Step 4: Update cloud connection actions**

Modify `app/Models/CloudConnection.php`:

```php
public function canEditName(): bool
{
    return $this->canReconnect() || $this->provider->is(CloudProvider::FTP());
}

public function canEditConnection(): bool
{
    return $this->provider->is(CloudProvider::FTP());
}
```

- [ ] **Step 5: Update frontend provider type**

Modify `resources/js/types/cloud.ts` `AvailableProvider`:

```ts
export interface AvailableProvider {
    key: string;
    label: string;
    value: number;
    icon: string;
    status: 'active' | 'disabled' | 'coming-soon';
    authType: 'oauth' | 'credentials';
    redirectUrl: string | null;
    capabilities: ProviderCapabilities;
}
```

- [ ] **Step 6: Run tests and type check**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan test --compact tests/Feature/DashboardProviderMetadataTest.php tests/Feature/FtpConnectionTest.php
pnpm run types:check
```

Expected: PHP tests pass. Type check may still fail only for existing generated Wayfinder files if they are missing.

- [ ] **Step 7: Format and commit**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" vendor/bin/pint --dirty --format agent
pnpm exec prettier --write resources/js/types/cloud.ts
```

Commit:

```bash
git add app/Http/Controllers/HomeController.php app/Models/CloudConnection.php resources/js/types/cloud.ts tests/Feature/DashboardProviderMetadataTest.php tests/Feature/FtpConnectionTest.php
git commit -m "feat: expose FTP provider metadata"
```

---

## Task 3: FTP Credential Create and Update Backend

**Files:**
- Create: `app/Http/Requests/StoreFtpConnectionRequest.php`
- Create: `app/Http/Requests/UpdateFtpConnectionRequest.php`
- Create: `app/Http/Controllers/FtpConnectionController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/FtpConnectionTest.php`

- [ ] **Step 1: Add failing backend flow tests**

Append to `tests/Feature/FtpConnectionTest.php`:

```php
use App\Enums\ConnectionStatus;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

it('requires a successful ftp connection test before saving', function () {
    Storage::shouldReceive('build')
        ->once()
        ->andThrow(new RuntimeException('Could not connect.'));

    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('connections.ftp.store'), [
            'name' => 'Production FTP',
            'host' => 'ftp.example.com',
            'port' => 21,
            'username' => 'alice',
            'password' => 'secret',
            'root' => '/',
            'ssl' => false,
            'passive' => true,
        ])
        ->assertSessionHasErrors('host');

    expect($user->cloudConnections()->count())->toBe(0);
});

it('creates an ftp connection after testing credentials', function () {
    $disk = Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
    $disk->shouldReceive('listContents')->once()->with('', false)->andReturn(collect());
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('connections.ftp.store'), [
            'name' => 'Production FTP',
            'host' => 'ftp.example.com',
            'port' => 2121,
            'username' => 'alice',
            'password' => 'secret',
            'root' => '/uploads',
            'ssl' => true,
            'passive' => true,
            'timeout' => 45,
            'utf8' => true,
            'ignorePassiveAddress' => true,
            'systemType' => 'unix',
            'recurseManually' => true,
            'timestampsOnUnixListingsEnabled' => false,
        ])
        ->assertRedirect('/dashboard');

    $connection = $user->cloudConnections()->firstOrFail();

    expect($connection->provider->is(CloudProvider::FTP()))->toBeTrue()
        ->and($connection->status->is(ConnectionStatus::CONNECTED()))->toBeTrue()
        ->and($connection->credentials)->toMatchArray([
            'host' => 'ftp.example.com',
            'port' => 2121,
            'username' => 'alice',
            'password' => 'secret',
            'root' => '/uploads',
            'ssl' => true,
            'passive' => true,
            'timeout' => 45,
            'utf8' => true,
            'ignore_passive_address' => true,
            'system_type' => 'unix',
            'recurse_manually' => true,
            'timestamps_on_unix_listings_enabled' => false,
        ]);
});

it('preserves ftp password when updating with a blank password', function () {
    $disk = Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
    $disk->shouldReceive('listContents')->once()->with('', false)->andReturn(collect());
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::FTP(),
        'credentials' => [
            'host' => 'old.example.com',
            'port' => 21,
            'username' => 'old-user',
            'password' => 'old-secret',
            'root' => '/',
            'ssl' => false,
            'passive' => true,
            'timeout' => 30,
        ],
    ]);

    $this->actingAs($connection->user)
        ->patch(route('connections.ftp.update', $connection), [
            'name' => 'Updated FTP',
            'host' => 'new.example.com',
            'port' => 21,
            'username' => 'new-user',
            'password' => '',
            'root' => '/',
            'ssl' => false,
            'passive' => true,
        ])
        ->assertRedirect('/dashboard');

    expect($connection->refresh()->credentials['password'])->toBe('old-secret')
        ->and($connection->name)->toBe('Updated FTP');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan test --compact tests/Feature/FtpConnectionTest.php
```

Expected: FAIL because routes/controller/requests do not exist.

- [ ] **Step 3: Create store request**

Create `app/Http/Requests/StoreFtpConnectionRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFtpConnectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'host' => ['required', 'string', 'max:255'],
            'port' => ['required', 'integer', 'min:1', 'max:65535'],
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:4096'],
            'root' => ['nullable', 'string', 'max:2048'],
            'ssl' => ['boolean'],
            'passive' => ['boolean'],
            'timeout' => ['nullable', 'integer', 'min:1', 'max:300'],
            'utf8' => ['boolean'],
            'ignorePassiveAddress' => ['nullable', 'boolean'],
            'systemType' => ['nullable', Rule::in(['unix', 'windows'])],
            'recurseManually' => ['boolean'],
            'timestampsOnUnixListingsEnabled' => ['boolean'],
        ];
    }
}
```

- [ ] **Step 4: Create update request**

Create `app/Http/Requests/UpdateFtpConnectionRequest.php`:

```php
<?php

namespace App\Http\Requests;

class UpdateFtpConnectionRequest extends StoreFtpConnectionRequest
{
    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['password'] = ['nullable', 'string', 'max:4096'];

        return $rules;
    }
}
```

- [ ] **Step 5: Create FTP controller**

Create `app/Http/Controllers/FtpConnectionController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Http\Requests\StoreFtpConnectionRequest;
use App\Http\Requests\UpdateFtpConnectionRequest;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Connectors\FtpConnector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Throwable;

class FtpConnectionController extends Controller
{
    public function store(StoreFtpConnectionRequest $request, FtpConnector $connector): RedirectResponse
    {
        $credentials = $this->credentialsFromRequest($request->validated());
        $this->testConnection($connector, $credentials);

        $request->user()->cloudConnections()->create([
            'name' => $request->string('name')->toString(),
            'provider' => CloudProvider::FTP(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
        ]);

        return redirect()->route('dashboard');
    }

    public function update(UpdateFtpConnectionRequest $request, CloudConnection $connection, FtpConnector $connector): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');
        abort_if(! $connection->provider->is(CloudProvider::FTP()), 404);

        $credentials = $this->credentialsFromRequest($request->validated(), $connection->credentials);
        $this->testConnection($connector, $credentials);

        $connection->forceFill([
            'name' => $request->string('name')->toString(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'error_message' => null,
        ])->save();

        return redirect()->route('dashboard');
    }

    /**
     * @param array<string, mixed> $validated
     * @param array<string, mixed> $existing
     * @return array<string, mixed>
     */
    private function credentialsFromRequest(array $validated, array $existing = []): array
    {
        $password = (string) ($validated['password'] ?? '');

        return [
            'host' => trim((string) $validated['host']),
            'port' => (int) $validated['port'],
            'username' => (string) $validated['username'],
            'password' => $password !== '' ? $password : (string) $existing['password'],
            'root' => trim((string) ($validated['root'] ?? ''), '/'),
            'ssl' => (bool) ($validated['ssl'] ?? false),
            'passive' => (bool) ($validated['passive'] ?? true),
            'timeout' => (int) ($validated['timeout'] ?? 30),
            'utf8' => (bool) ($validated['utf8'] ?? false),
            'ignore_passive_address' => Arr::get($validated, 'ignorePassiveAddress'),
            'system_type' => Arr::get($validated, 'systemType'),
            'recurse_manually' => (bool) ($validated['recurseManually'] ?? true),
            'timestamps_on_unix_listings_enabled' => (bool) ($validated['timestampsOnUnixListingsEnabled'] ?? false),
        ];
    }

    /** @param array<string, mixed> $credentials */
    private function testConnection(FtpConnector $connector, array $credentials): void
    {
        try {
            $connector->diskFromCredentials($credentials)->listContents('', false);
        } catch (Throwable $exception) {
            throw ValidationException::withMessages([
                'host' => 'Could not connect to the FTP server. Check host, port, credentials, SSL, and passive mode settings.',
            ]);
        }
    }

    /** @param array<string, mixed> $credentials */
    private function providerId(array $credentials): string
    {
        return sprintf('%s@%s:%d/%s', $credentials['username'], $credentials['host'], $credentials['port'], $credentials['root']);
    }
}
```

- [ ] **Step 6: Add diskFromCredentials helper to connector**

Modify `FtpConnector`:

```php
public function diskFromCredentials(array $credentials): Filesystem
{
    return Storage::build($this->diskConfig($credentials));
}

public function disk(CloudConnection $connection): Filesystem
{
    return $this->diskFromCredentials($connection->credentials);
}
```

- [ ] **Step 7: Add routes**

Modify `routes/web.php` imports:

```php
use App\Http\Controllers\FtpConnectionController;
```

Inside auth/verified group:

```php
Route::post('/connections/ftp', [FtpConnectionController::class, 'store'])->name('connections.ftp.store');
Route::patch('/connections/{connection}/ftp', [FtpConnectionController::class, 'update'])->name('connections.ftp.update');
```

- [ ] **Step 8: Run backend tests**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan test --compact tests/Feature/FtpConnectionTest.php
```

Expected: PASS.

- [ ] **Step 9: Format and commit**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" vendor/bin/pint --dirty --format agent
```

Commit:

```bash
git add app/Http/Requests/StoreFtpConnectionRequest.php app/Http/Requests/UpdateFtpConnectionRequest.php app/Http/Controllers/FtpConnectionController.php app/Services/CloudStorage/Connectors/FtpConnector.php routes/web.php tests/Feature/FtpConnectionTest.php
git commit -m "feat: add FTP credential connection routes"
```

---

## Task 4: Connect Storage Modal FTP Form

**Files:**
- Create: `resources/js/components/cloud/FtpConnectionForm.tsx`
- Modify: `resources/js/components/cloud/ConnectStorageModal.tsx`
- Modify: `resources/js/components/cloud/ProviderOption.tsx`
- Modify: `resources/js/types/cloud.ts`

- [ ] **Step 1: Add provider option credential callback**

Modify `resources/js/components/cloud/ProviderOption.tsx` props:

```ts
interface ProviderOptionProps {
    provider: AvailableProvider;
    onSelectCredentialsProvider: (provider: AvailableProvider) => void;
}
```

Change active click handler:

```ts
onClick={() => {
    if (provider.authType === 'credentials') {
        onSelectCredentialsProvider(provider);
        return;
    }

    if (provider.redirectUrl) {
        window.location.href = provider.redirectUrl;
    }
}}
```

Update `isActive` to:

```ts
const isActive = provider.status === 'active' && (provider.authType === 'credentials' || Boolean(provider.redirectUrl));
```

- [ ] **Step 2: Create FTP form component**

Create `resources/js/components/cloud/FtpConnectionForm.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import connections from '@/routes/connections';

interface FtpConnectionFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}

export default function FtpConnectionForm({
    onCancel,
    onSuccess,
}: FtpConnectionFormProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [form, setForm] = useState({
        name: '',
        host: '',
        port: 21,
        username: '',
        password: '',
        root: '',
        ssl: false,
        passive: true,
        timeout: 30,
        utf8: false,
        ignorePassiveAddress: '',
        systemType: '',
        recurseManually: true,
        timestampsOnUnixListingsEnabled: false,
    });

    const update = (key: keyof typeof form, value: string | number | boolean) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post(connections.ftp.store().url, form, {
            preserveScroll: true,
            onSuccess: () => onSuccess(),
            onError: (validationErrors) => setErrors(validationErrors as Record<string, string>),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
                <Input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Connection name" />
                {errors.name && <p className="text-xs font-semibold text-red-600">{errors.name}</p>}
                <Input value={form.host} onChange={(event) => update('host', event.target.value)} placeholder="FTP host" />
                {errors.host && <p className="text-xs font-semibold text-red-600">{errors.host}</p>}
                <Input type="number" value={form.port} onChange={(event) => update('port', Number(event.target.value))} placeholder="Port" />
                <Input value={form.username} onChange={(event) => update('username', event.target.value)} placeholder="Username" />
                <Input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="Password" />
                <Input value={form.root} onChange={(event) => update('root', event.target.value)} placeholder="Root path" />
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input type="checkbox" checked={form.ssl} onChange={(event) => update('ssl', event.target.checked)} />
                    Use SSL
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input type="checkbox" checked={form.passive} onChange={(event) => update('passive', event.target.checked)} />
                    Passive mode
                </label>
            </div>

            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Advanced settings
            </button>

            {showAdvanced && (
                <div className="grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-3">
                    <Input type="number" value={form.timeout} onChange={(event) => update('timeout', Number(event.target.value))} placeholder="Timeout" />
                    <select value={form.systemType} onChange={(event) => update('systemType', event.target.value)} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        <option value="">Auto system type</option>
                        <option value="unix">Unix</option>
                        <option value="windows">Windows</option>
                    </select>
                    <select value={form.ignorePassiveAddress} onChange={(event) => update('ignorePassiveAddress', event.target.value)} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        <option value="">Auto passive address</option>
                        <option value="1">Ignore passive address</option>
                        <option value="0">Use passive address</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={form.utf8} onChange={(event) => update('utf8', event.target.checked)} />UTF-8</label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={form.recurseManually} onChange={(event) => update('recurseManually', event.target.checked)} />Recurse manually</label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={form.timestampsOnUnixListingsEnabled} onChange={(event) => update('timestampsOnUnixListingsEnabled', event.target.checked)} />Unix listing timestamps</label>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>Back</Button>
                <Button type="submit" disabled={processing} className="bg-brand text-white hover:bg-[#a0181e]">
                    {processing ? 'Testing connection...' : 'Connect FTP'}
                </Button>
            </div>
        </form>
    );
}
```

- [ ] **Step 3: Update modal to render FTP form**

Modify `resources/js/components/cloud/ConnectStorageModal.tsx` imports:

```ts
import { useState } from 'react';
import FtpConnectionForm from '@/components/cloud/FtpConnectionForm';
```

Inside component:

```ts
const [selectedCredentialProvider, setSelectedCredentialProvider] = useState<AvailableProvider | null>(null);
```

Replace body list with conditional:

```tsx
{selectedCredentialProvider?.key === 'ftp' ? (
    <FtpConnectionForm
        onCancel={() => setSelectedCredentialProvider(null)}
        onSuccess={onClose}
    />
) : (
    <div className="space-y-3">
        {providers.map((provider) => (
            <ProviderOption
                key={provider.key}
                provider={provider}
                onSelectCredentialsProvider={setSelectedCredentialProvider}
            />
        ))}
    </div>
)}
```

- [ ] **Step 4: Generate Wayfinder routes**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan wayfinder:generate
```

Expected: `@/routes/connections` includes `ftp.store()`.

- [ ] **Step 5: Run frontend checks**

Run:

```bash
pnpm exec prettier --write resources/js/components/cloud/FtpConnectionForm.tsx resources/js/components/cloud/ConnectStorageModal.tsx resources/js/components/cloud/ProviderOption.tsx resources/js/types/cloud.ts
pnpm run types:check
```

Expected: PASS after Wayfinder generation.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/cloud/FtpConnectionForm.tsx resources/js/components/cloud/ConnectStorageModal.tsx resources/js/components/cloud/ProviderOption.tsx resources/js/types/cloud.ts resources/js/routes resources/js/actions
git commit -m "feat: add FTP connection modal"
```

---

## Task 5: FTP Edit Connection UI

**Files:**
- Create: `resources/js/components/cloud/EditFtpConnectionDialog.tsx`
- Modify: `resources/js/components/cloud/ConnectionActionsMenu.tsx`
- Modify: `resources/js/layouts/AuthenticatedLayout.tsx`
- Modify: `resources/js/types/cloud.ts`
- Modify: `app/Http/Controllers/HomeController.php` or shared connection serializer if present

- [ ] **Step 1: Expose safe FTP config in connection payload**

Modify dashboard connection mapping to include non-secret config for FTP only:

```php
'ftp_config' => $connection->provider->is(CloudProvider::FTP()) ? Arr::except($connection->credentials, ['password']) : null,
```

Add `use Illuminate\Support\Arr;`.

Update `CloudConnection` TS type:

```ts
ftp_config?: {
    host: string;
    port: number;
    username: string;
    root: string;
    ssl: boolean;
    passive: boolean;
    timeout?: number;
    utf8?: boolean;
    ignore_passive_address?: boolean | null;
    system_type?: 'unix' | 'windows' | null;
    recurse_manually?: boolean;
    timestamps_on_unix_listings_enabled?: boolean;
} | null;
```

- [ ] **Step 2: Create edit dialog**

Create `resources/js/components/cloud/EditFtpConnectionDialog.tsx` reusing the same fields as `FtpConnectionForm`, initialized from `connection.ftp_config`, with password blank and optional. Submit to `connections.ftp.update({ connection: connection.id }).url` via `router.patch()`.

Minimum structure:

```tsx
export default function EditFtpConnectionDialog({ connection, onClose }: { connection: CloudConnection | null; onClose: () => void }) {
    if (!connection) return null;
    // render modal form; password placeholder "Leave blank to keep current password"
}
```

- [ ] **Step 3: Wire actions menu callback**

Modify `ConnectionActionsMenuProps`:

```ts
onEditConnection: (connection: CloudConnection) => void;
```

For `actions.canEditConnection`, call `onEditConnection(connection)` on select.

- [ ] **Step 4: Wire layout dialog state**

In `AuthenticatedLayout.tsx`, add state:

```ts
const [connectionBeingEdited, setConnectionBeingEdited] = useState<CloudConnection | null>(null);
```

Pass `onEditConnection={setConnectionBeingEdited}` to `ConnectionNavItem` / actions path as needed. Render:

```tsx
<EditFtpConnectionDialog connection={connectionBeingEdited} onClose={() => setConnectionBeingEdited(null)} />
```

If `ConnectionNavItem` does not accept `onEditConnection`, update it to pass through to `ConnectionActionsMenu`.

- [ ] **Step 5: Generate routes and run checks**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan wayfinder:generate
pnpm exec prettier --write resources/js/components/cloud/EditFtpConnectionDialog.tsx resources/js/components/cloud/ConnectionActionsMenu.tsx resources/js/layouts/AuthenticatedLayout.tsx resources/js/types/cloud.ts
pnpm run types:check
"D:/Program/dev_stack/bin/php.bat" vendor/bin/pint --dirty --format agent
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/HomeController.php resources/js/components/cloud/EditFtpConnectionDialog.tsx resources/js/components/cloud/ConnectionActionsMenu.tsx resources/js/components/cloud/ConnectionNavItem.tsx resources/js/layouts/AuthenticatedLayout.tsx resources/js/types/cloud.ts resources/js/routes resources/js/actions
git commit -m "feat: edit FTP connection settings"
```

---

## Task 6: Final Verification

**Files:**
- No new files unless fixing verification issues.

- [ ] **Step 1: Run backend tests**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" artisan test --compact tests/Feature/FtpConnectionTest.php tests/Feature/DashboardProviderMetadataTest.php tests/Feature/CloudProviderRegistryTest.php
```

Expected: PASS.

- [ ] **Step 2: Run formatter checks**

Run:

```bash
"D:/Program/dev_stack/bin/php.bat" vendor/bin/pint --dirty --format agent
pnpm exec prettier --check resources/js/components/cloud/FtpConnectionForm.tsx resources/js/components/cloud/EditFtpConnectionDialog.tsx resources/js/components/cloud/ConnectStorageModal.tsx resources/js/components/cloud/ProviderOption.tsx resources/js/components/cloud/ConnectionActionsMenu.tsx resources/js/layouts/AuthenticatedLayout.tsx resources/js/types/cloud.ts
```

Expected: PASS.

- [ ] **Step 3: Run frontend type check**

Run:

```bash
pnpm run types:check
```

Expected: PASS after Wayfinder generation.

- [ ] **Step 4: Manual FTP verification**

Start app stack and use a real FTP server:

1. Open dashboard.
2. Click Connect Storage.
3. Select FTP.
4. Fill basic credentials.
5. Expand Advanced and confirm fields are available.
6. Submit with bad credentials and confirm no connection is saved.
7. Submit with valid credentials and confirm modal closes.
8. Open FTP connection in file browser.
9. Browse root and a subfolder.
10. Create a folder.
11. Upload a small file.
12. Download the file.
13. Delete the file/folder.
14. Edit FTP connection without entering password and confirm it still works.
15. Edit FTP connection with a new password and confirm it uses the new credentials.

- [ ] **Step 5: Commit verification fixes if any**

If verification required changes:

```bash
git add <changed-files>
git commit -m "fix: stabilize FTP provider support"
```

Do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers FTP dependency, connector, provider registration, provider `authType`, credential create/update routes, connection test before save, encrypted credential storage, no password return, modal form, edit flow, no quota, and verification.
- Placeholder scan: No TBD/TODO placeholders remain. Code snippets and commands are explicit.
- Type consistency: Backend uses snake_case stored credential keys; frontend uses camelCase request keys; controller normalizes camelCase to snake_case; provider metadata uses `authType` consistently.
