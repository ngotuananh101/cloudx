# Connection Actions Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a capability-driven three-dot actions menu to sidebar cloud connections with Reconnect, Edit name, and confirmed deletion.

**Architecture:** Backend owns connection action capabilities and OAuth reconnect safety rules. Frontend renders extracted sidebar connection components from those capabilities, keeping row navigation separate from the menu trigger. Tests drive backend routes and reconnect behavior before UI integration.

**Tech Stack:** Laravel 13, Inertia v3, React 19, Wayfinder, Pest 4, Tailwind CSS v4, shadcn/radix UI components.

**Commit policy:** Do not create commits unless the user explicitly asks. Each task lists the files that would be included in a commit, but implementation should stop after tests/verification unless commit permission is given.

---

## File Structure

- Modify `app/Models/CloudConnection.php`
  - Add small capability methods: `canReconnect()`, `canEditName()`, `canEditConnection()`, `canDelete()`.
- Modify `app/Http/Middleware/HandleInertiaRequests.php`
  - Share `connection.actions` for sidebar rendering.
- Modify `app/Http/Controllers/CloudConnectionController.php`
  - Add `reconnect()` and `updateName()` actions.
  - Update `callback()` to branch into pending reconnect flow.
- Modify `routes/web.php`
  - Add `GET /connections/{connection}/reconnect` and `PATCH /connections/{connection}/name`.
- Modify `tests/Feature/CloudConnectionTest.php`
  - Add Pest coverage for actions payload, edit name, authorization, reconnect success, reconnect mismatch, and delete authorization.
- Generate/modify Wayfinder output under `resources/js/actions/App/Http/Controllers/CloudConnectionController.ts`
  - Regenerate after route/controller changes so frontend can import `reconnect`, `updateName`, and `disconnect`.
- Modify `resources/js/types/cloud.ts`
  - Add `CloudConnectionActions` and `actions` to `CloudConnection`.
- Modify `resources/js/layouts/AuthenticatedLayout.tsx`
  - Replace inline connection row rendering with `ConnectionNavItem` and dialog state.
- Create `resources/js/components/cloud/ConnectionNavItem.tsx`
  - Renders the sidebar row and embeds `ConnectionActionsMenu`.
- Create `resources/js/components/cloud/ConnectionActionsMenu.tsx`
  - Renders dropdown items from `connection.actions`.
- Create `resources/js/components/cloud/EditConnectionNameDialog.tsx`
  - Handles name update form.
- Create `resources/js/components/cloud/DeleteConnectionDialog.tsx`
  - Handles destructive delete confirmation.
- Create `resources/js/components/ui/alert-dialog.tsx`
  - Add shadcn alert-dialog component if the CLI does not generate it automatically.

---

### Task 1: Backend connection capabilities in shared Inertia props

**Files:**

- Modify: `app/Models/CloudConnection.php`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Test: `tests/Feature/CloudConnectionTest.php`

- [ ] **Step 1: Add the failing shared-actions test**

Append this test to `tests/Feature/CloudConnectionTest.php`:

```php
it('shares connection action capabilities with inertia auth props', function () {
    $user = User::factory()->create();

    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive (test@gmail.com)',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertInertia(fn ($page) => $page
        ->where('auth.user.connections.0.id', $connection->id)
        ->where('auth.user.connections.0.actions.canReconnect', true)
        ->where('auth.user.connections.0.actions.canEditName', true)
        ->where('auth.user.connections.0.actions.canEditConnection', false)
        ->where('auth.user.connections.0.actions.canDelete', true)
    );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
php artisan test --compact --filter='shares connection action capabilities'
```

Expected: FAIL because `auth.user.connections.0.actions.*` is missing.

- [ ] **Step 3: Add capability methods to `CloudConnection`**

Add these methods inside `app/Models/CloudConnection.php` after `tasks()` and before `getDisk()`:

```php
public function canReconnect(): bool
{
    return in_array($this->provider->value, [
        CloudProvider::GOOGLE_DRIVE,
        CloudProvider::ONEDRIVE,
    ], true);
}

public function canEditName(): bool
{
    return $this->canReconnect();
}

public function canEditConnection(): bool
{
    return false;
}

public function canDelete(): bool
{
    return true;
}

/**
 * @return array{canReconnect: bool, canEditName: bool, canEditConnection: bool, canDelete: bool}
 */
public function actions(): array
{
    return [
        'canReconnect' => $this->canReconnect(),
        'canEditName' => $this->canEditName(),
        'canEditConnection' => $this->canEditConnection(),
        'canDelete' => $this->canDelete(),
    ];
}
```

- [ ] **Step 4: Share actions through Inertia auth props**

In `app/Http/Middleware/HandleInertiaRequests.php`, update the connection map array to include:

```php
'actions' => $connection->actions(),
```

The mapped connection array should become:

```php
return [
    'id' => $connection->id,
    'name' => $connection->name,
    'provider' => $connection->provider->description,
    'provider_value' => $connection->provider->value,
    'provider_icon' => CloudProvider::getIcon($connection->provider->value),
    'status' => $connection->status->description,
    'status_value' => $connection->status->value,
    'actions' => $connection->actions(),
];
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
php artisan test --compact --filter='shares connection action capabilities'
```

Expected: PASS.

- [ ] **Step 6: Run Pint on dirty PHP files**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: PASS and no formatting errors.

- [ ] **Step 7: Record Task 1 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include these files for this task:

```text
app/Models/CloudConnection.php
app/Http/Middleware/HandleInertiaRequests.php
tests/Feature/CloudConnectionTest.php
```

---

### Task 2: Edit connection display name route

**Files:**

- Modify: `routes/web.php`
- Modify: `app/Http/Controllers/CloudConnectionController.php`
- Test: `tests/Feature/CloudConnectionTest.php`

- [ ] **Step 1: Add failing tests for edit name**

Append these tests to `tests/Feature/CloudConnectionTest.php`:

```php
it('updates a cloud connection display name', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Old name',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $response = $this->actingAs($user)->patch(route('cloud-connections.name.update', $connection), [
        'name' => 'Personal Drive',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success', 'Connection name updated.');

    $connection->refresh();

    expect($connection->name)->toBe('Personal Drive')
        ->and($connection->provider_id)->toBe('test@gmail.com')
        ->and($connection->credentials['access_token'])->toBe('token');
});

it('validates cloud connection display names', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)
        ->from(route('dashboard'))
        ->patch(route('cloud-connections.name.update', $connection), ['name' => ''])
        ->assertRedirect(route('dashboard'))
        ->assertSessionHasErrors('name');

    expect($connection->fresh()->name)->toBe('Google Drive');
});

it('does not let users rename another users cloud connection', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => 'Owner Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'owner@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($otherUser)
        ->patch(route('cloud-connections.name.update', $connection), ['name' => 'Stolen Drive'])
        ->assertForbidden();

    expect($connection->fresh()->name)->toBe('Owner Drive');
});
```

- [ ] **Step 2: Run focused edit-name tests and verify they fail**

Run:

```bash
php artisan test --compact --filter='cloud connection display name|rename another users'
```

Expected: FAIL because route `cloud-connections.name.update` does not exist.

- [ ] **Step 3: Add the route**

In `routes/web.php`, add this after the existing `Route::delete('/connections/{connection}', ...)` line:

```php
Route::patch('/connections/{connection}/name', [CloudConnectionController::class, 'updateName'])->name('cloud-connections.name.update');
```

- [ ] **Step 4: Add `updateName()` to the controller**

In `app/Http/Controllers/CloudConnectionController.php`, add this method before `disconnect()`:

```php
public function updateName(Request $request, CloudConnection $connection): RedirectResponse
{
    if ($connection->user_id !== $request->user()->id) {
        abort(403, 'Unauthorized action.');
    }

    if (! $connection->canEditName()) {
        abort(403, 'This connection name cannot be edited.');
    }

    $validated = $request->validate([
        'name' => ['required', 'string', 'max:255'],
    ]);

    $connection->update([
        'name' => $validated['name'],
    ]);

    return back()->with('success', 'Connection name updated.');
}
```

- [ ] **Step 5: Run focused edit-name tests and verify they pass**

Run:

```bash
php artisan test --compact --filter='cloud connection display name|rename another users'
```

Expected: PASS.

- [ ] **Step 6: Run Pint on dirty PHP files**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: PASS and no formatting errors.

- [ ] **Step 7: Record Task 2 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include these files for this task:

```text
routes/web.php
app/Http/Controllers/CloudConnectionController.php
tests/Feature/CloudConnectionTest.php
```

---

### Task 3: Safe OAuth reconnect flow

**Files:**

- Modify: `routes/web.php`
- Modify: `app/Http/Controllers/CloudConnectionController.php`
- Test: `tests/Feature/CloudConnectionTest.php`

- [ ] **Step 1: Add reconnect tests**

Append these tests to `tests/Feature/CloudConnectionTest.php`:

```php
it('starts reconnect for the users existing oauth connection', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive (test@gmail.com)',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('redirectUrl')->once()->andReturn('https://accounts.google.com/o/oauth2/auth?reconnect=1');

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider->is(CloudProvider::GOOGLE_DRIVE())
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('cloud-connections.reconnect', $connection));

    $response->assertRedirect('https://accounts.google.com/o/oauth2/auth?reconnect=1');
    $response->assertSessionHas('cloud_connection_reconnect.connection_id', $connection->id);
    $response->assertSessionHas('cloud_connection_reconnect.provider', CloudProvider::GOOGLE_DRIVE);
    $response->assertSessionHas('cloud_connection_reconnect.provider_id', 'test@gmail.com');
});

it('does not let users reconnect another users cloud connection', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => 'Owner Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'owner@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($otherUser)
        ->get(route('cloud-connections.reconnect', $connection))
        ->assertForbidden();
});

it('updates the existing connection when reconnect returns the same account', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Old Drive Name',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
        'total_space' => 10,
        'used_space' => 5,
    ]);

    session([
        'cloud_connection_reconnect' => [
            'connection_id' => $connection->id,
            'provider' => CloudProvider::GOOGLE_DRIVE,
            'provider_id' => 'test@gmail.com',
        ],
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('handleCallback')->once()->with(Mockery::type(Request::class))->andReturn(new ConnectedAccountData(
        providerId: 'test@gmail.com',
        name: 'Google Drive (test@gmail.com)',
        credentials: ['access_token' => 'new-token', 'refresh_token' => 'new-refresh-token'],
        totalSpace: 100,
        usedSpace: 25,
    ));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider->is(CloudProvider::GOOGLE_DRIVE())
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('oauth.callback', [
        'provider' => 'google-drive',
        'code' => 'valid_code',
    ]));

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('success', 'Successfully reconnected Google Drive (test@gmail.com).');
    $response->assertSessionMissing('cloud_connection_reconnect');

    $connection->refresh();

    expect($connection->name)->toBe('Old Drive Name')
        ->and($connection->provider_id)->toBe('test@gmail.com')
        ->and($connection->credentials['access_token'])->toBe('new-token')
        ->and($connection->credentials['refresh_token'])->toBe('new-refresh-token')
        ->and($connection->total_space)->toBe(100)
        ->and($connection->used_space)->toBe(25)
        ->and($connection->error_message)->toBeNull()
        ->and($connection->last_synced_at)->not->toBeNull();
});

it('rejects reconnect when oauth returns a different account', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Original Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'original@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
        'total_space' => 10,
        'used_space' => 5,
    ]);

    session([
        'cloud_connection_reconnect' => [
            'connection_id' => $connection->id,
            'provider' => CloudProvider::GOOGLE_DRIVE,
            'provider_id' => 'original@gmail.com',
        ],
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('handleCallback')->once()->with(Mockery::type(Request::class))->andReturn(new ConnectedAccountData(
        providerId: 'different@gmail.com',
        name: 'Google Drive (different@gmail.com)',
        credentials: ['access_token' => 'new-token'],
        totalSpace: 100,
        usedSpace: 25,
    ));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider->is(CloudProvider::GOOGLE_DRIVE())
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('oauth.callback', [
        'provider' => 'google-drive',
        'code' => 'valid_code',
    ]));

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('error', 'Reconnect failed because the selected account does not match Original Drive.');
    $response->assertSessionMissing('cloud_connection_reconnect');

    $connection->refresh();

    expect($connection->provider_id)->toBe('original@gmail.com')
        ->and($connection->credentials['access_token'])->toBe('old-token')
        ->and($connection->total_space)->toBe(10)
        ->and($connection->used_space)->toBe(5)
        ->and(CloudConnection::count())->toBe(1);
});
```

Also add this import near the top if it is missing:

```php
use App\Data\ConnectedAccountData;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
```

- [ ] **Step 2: Run focused reconnect tests and verify they fail**

Run:

```bash
php artisan test --compact --filter='reconnect'
```

Expected: FAIL because the reconnect route and callback branch do not exist.

- [ ] **Step 3: Add the reconnect route**

In `routes/web.php`, add this near the other cloud connection routes:

```php
Route::get('/connections/{connection}/reconnect', [CloudConnectionController::class, 'reconnect'])->name('cloud-connections.reconnect');
```

- [ ] **Step 4: Add `reconnect()` to the controller**

In `app/Http/Controllers/CloudConnectionController.php`, add this method before `callback()`:

```php
public function reconnect(Request $request, CloudConnection $connection): RedirectResponse
{
    if ($connection->user_id !== $request->user()->id) {
        abort(403, 'Unauthorized action.');
    }

    if (! $connection->canReconnect()) {
        abort(403, 'This connection cannot be reconnected.');
    }

    $request->session()->put('cloud_connection_reconnect', [
        'connection_id' => $connection->id,
        'provider' => $connection->provider->value,
        'provider_id' => $connection->provider_id,
    ]);

    return redirect()->away($this->cloudStorage->connector($connection->provider)->redirectUrl());
}
```

- [ ] **Step 5: Update `callback()` to support pending reconnect**

Replace the body of `callback()` in `app/Http/Controllers/CloudConnectionController.php` with:

```php
public function callback(Request $request, string $provider): RedirectResponse
{
    $cloudProvider = CloudProvider::fromSlug($provider);

    if ($cloudProvider === null) {
        abort(404);
    }

    try {
        $account = $this->cloudStorage->connector($cloudProvider)->handleCallback($request);
        $pendingReconnect = $request->session()->get('cloud_connection_reconnect');

        if ($pendingReconnect !== null) {
            $request->session()->forget('cloud_connection_reconnect');

            $connection = CloudConnection::whereKey($pendingReconnect['connection_id'])
                ->where('user_id', $request->user()->id)
                ->firstOrFail();

            if ((int) $pendingReconnect['provider'] !== $cloudProvider->value || $pendingReconnect['provider_id'] !== $account->providerId) {
                return redirect()->route('dashboard')->with('error', "Reconnect failed because the selected account does not match {$connection->name}.");
            }

            $connection->fill([
                'credentials' => $account->credentials,
                'status' => ConnectionStatus::CONNECTED(),
                'total_space' => $account->totalSpace,
                'used_space' => $account->usedSpace,
                'error_message' => null,
                'last_synced_at' => now(),
            ])->save();

            return redirect()->route('dashboard')->with('success', "Successfully reconnected {$connection->name}.");
        }

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

        return redirect()->route('dashboard')->with('success', "Successfully connected to {$cloudProvider->description}!");
    } catch (Throwable $exception) {
        $request->session()->forget('cloud_connection_reconnect');
        report($exception);

        return redirect()->route('dashboard')->with('error', "Could not connect to {$cloudProvider->description}.");
    }
}
```

- [ ] **Step 6: Run focused reconnect tests and verify they pass**

Run:

```bash
php artisan test --compact --filter='reconnect'
```

Expected: PASS.

- [ ] **Step 7: Run existing cloud connection tests**

Run:

```bash
php artisan test --compact tests/Feature/CloudConnectionTest.php
```

Expected: PASS.

- [ ] **Step 8: Run Pint on dirty PHP files**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: PASS and no formatting errors.

- [ ] **Step 9: Record Task 3 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include these files for this task:

```text
routes/web.php
app/Http/Controllers/CloudConnectionController.php
tests/Feature/CloudConnectionTest.php
```

---

### Task 4: Delete authorization coverage

**Files:**

- Modify: `tests/Feature/CloudConnectionTest.php`
- Optionally modify: `app/Http/Controllers/CloudConnectionController.php`

- [ ] **Step 1: Add the failing authorization test for delete**

Append this test to `tests/Feature/CloudConnectionTest.php`:

```php
it('does not let users delete another users cloud connection', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => 'Owner Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'owner@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($otherUser)
        ->delete(route('cloud-connections.destroy', $connection))
        ->assertForbidden();

    expect(CloudConnection::find($connection->id))->not->toBeNull();
});
```

- [ ] **Step 2: Run the focused delete authorization test**

Run:

```bash
php artisan test --compact --filter='delete another users cloud connection'
```

Expected: PASS if existing `disconnect()` authorization is already correct. If it fails, continue to Step 3.

- [ ] **Step 3: Ensure `disconnect()` checks ownership and capability**

In `app/Http/Controllers/CloudConnectionController.php`, update `disconnect()` to:

```php
public function disconnect(Request $request, CloudConnection $connection): RedirectResponse
{
    if ($connection->user_id !== $request->user()->id) {
        abort(403, 'Unauthorized action.');
    }

    if (! $connection->canDelete()) {
        abort(403, 'This connection cannot be deleted.');
    }

    $this->cache->flushConnection($connection);
    $connection->delete();

    return redirect()->route('dashboard')->with('success', 'Successfully disconnected '.$connection->name);
}
```

- [ ] **Step 4: Run delete tests**

Run:

```bash
php artisan test --compact --filter='disconnect|delete another users cloud connection'
```

Expected: PASS.

- [ ] **Step 5: Run Pint if PHP changed**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: PASS and no formatting errors.

- [ ] **Step 6: Record Task 4 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include these files for this task:

```text
app/Http/Controllers/CloudConnectionController.php
tests/Feature/CloudConnectionTest.php
```

---

### Task 5: Regenerate Wayfinder routes and add frontend types

**Files:**

- Modify: `resources/js/actions/App/Http/Controllers/CloudConnectionController.ts`
- Modify: Wayfinder generated route files if the generator updates them
- Modify: `resources/js/types/cloud.ts`

- [ ] **Step 1: Regenerate Wayfinder output**

Run the project Wayfinder generation command:

```bash
php artisan wayfinder:generate --no-interaction
```

Expected: generated TypeScript routes include `reconnect`, `updateName`, and existing `disconnect` in `resources/js/actions/App/Http/Controllers/CloudConnectionController.ts`.

If the command is unavailable, run:

```bash
php artisan list --no-interaction
```

Then use the listed Wayfinder generation command that exists in this app.

- [ ] **Step 2: Verify generated controller actions exist**

Open `resources/js/actions/App/Http/Controllers/CloudConnectionController.ts` and confirm it exports named constants for `reconnect`, `updateName`, and `disconnect`. The exact generated bodies should follow the existing Wayfinder pattern in that file: each constant has `.definition`, `.url`, method helpers, and `.form` where applicable.

- [ ] **Step 3: Add connection action types**

In `resources/js/types/cloud.ts`, add this interface before `CloudConnection`:

```ts
export interface CloudConnectionActions {
    canReconnect: boolean;
    canEditName: boolean;
    canEditConnection: boolean;
    canDelete: boolean;
}
```

Then add this property to `CloudConnection`:

```ts
actions?: CloudConnectionActions;
```

- [ ] **Step 4: Run frontend type check or build check**

Run the available frontend validation command used by this project. Start with:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS. If the project does not define standalone TypeScript checking, run:

```bash
pnpm run build
```

Expected: PASS.

- [ ] **Step 5: Record Task 5 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include these paths for this task:

```text
resources/js/actions
resources/js/types/cloud.ts
```

---

### Task 6: Add alert-dialog UI component

**Files:**

- Create: `resources/js/components/ui/alert-dialog.tsx`
- Possibly modify: package lock files only if shadcn adds dependencies

- [ ] **Step 1: Generate the shadcn alert-dialog component**

Run:

```bash
pnpm dlx shadcn@latest add alert-dialog
```

Expected: `resources/js/components/ui/alert-dialog.tsx` exists. Existing dependencies should already include Radix because `dropdown-menu` uses `radix-ui`; if the command changes package files, inspect them before committing.

- [ ] **Step 2: If generation is not available, create the component manually**

Create `resources/js/components/ui/alert-dialog.tsx` with:

```tsx
import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
```

- [ ] **Step 3: Run frontend validation**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS. If unavailable, run `pnpm run build` and expect PASS.

- [ ] **Step 4: Record Task 6 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include `resources/js/components/ui/alert-dialog.tsx`. Include `package.json` and `pnpm-lock.yaml` only if the shadcn command changed them.

---

### Task 7: Build connection action frontend components

**Files:**

- Create: `resources/js/components/cloud/ConnectionActionsMenu.tsx`
- Create: `resources/js/components/cloud/ConnectionNavItem.tsx`
- Create: `resources/js/components/cloud/EditConnectionNameDialog.tsx`
- Create: `resources/js/components/cloud/DeleteConnectionDialog.tsx`

- [ ] **Step 1: Create `ConnectionActionsMenu.tsx`**

Create `resources/js/components/cloud/ConnectionActionsMenu.tsx`:

```tsx
import { MoreHorizontal, Pencil, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { reconnect } from '@/actions/App/Http/Controllers/CloudConnectionController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CloudConnection } from '@/types/cloud';

interface ConnectionActionsMenuProps {
    connection: CloudConnection;
    onEditName: (connection: CloudConnection) => void;
    onDelete: (connection: CloudConnection) => void;
}

export default function ConnectionActionsMenu({ connection, onEditName, onDelete }: ConnectionActionsMenuProps) {
    const actions = connection.actions;

    if (!actions || (!actions.canReconnect && !actions.canEditName && !actions.canEditConnection && !actions.canDelete)) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-lg text-gray-400 opacity-0 transition-opacity hover:bg-white/70 hover:text-gray-700 group-hover:opacity-100 data-[state=open]:bg-white/70 data-[state=open]:opacity-100"
                    aria-label={`Open actions for ${connection.name}`}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                {actions.canReconnect && (
                    <DropdownMenuItem asChild>
                        <a href={reconnect.url(connection)}>
                            <RefreshCw className="h-4 w-4" />
                            Reconnect
                        </a>
                    </DropdownMenuItem>
                )}
                {actions.canEditName && (
                    <DropdownMenuItem
                        onSelect={(event) => {
                            event.preventDefault();
                            onEditName(connection);
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                        Edit name
                    </DropdownMenuItem>
                )}
                {actions.canEditConnection && (
                    <DropdownMenuItem>
                        <Settings2 className="h-4 w-4" />
                        Edit connection
                    </DropdownMenuItem>
                )}
                {actions.canDelete && (actions.canReconnect || actions.canEditName || actions.canEditConnection) && <DropdownMenuSeparator />}
                {actions.canDelete && (
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={(event) => {
                            event.preventDefault();
                            onDelete(connection);
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        Xoá connection
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

- [ ] **Step 2: Create `ConnectionNavItem.tsx`**

Create `resources/js/components/cloud/ConnectionNavItem.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { Cloud } from 'lucide-react';
import ConnectionActionsMenu from '@/components/cloud/ConnectionActionsMenu';
import type { CloudConnection } from '@/types/cloud';

interface ConnectionNavItemProps {
    connection: CloudConnection;
    href: string;
    isActive: boolean;
    onEditName: (connection: CloudConnection) => void;
    onDelete: (connection: CloudConnection) => void;
}

export default function ConnectionNavItem({ connection, href, isActive, onEditName, onDelete }: ConnectionNavItemProps) {
    return (
        <li>
            <Link href={href} className={`group relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-3 text-xs font-bold tracking-wide transition-colors ${isActive ? 'bg-red-50 text-brand' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                {isActive && <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-brand" />}
                <div className="flex min-w-0 items-center gap-3 truncate">
                    {connection.provider_icon?.endsWith('.svg') ? (
                        <img
                            src={connection.provider_icon}
                            className="h-4.5 w-4.5 shrink-0"
                            alt={connection.name}
                        />
                    ) : (
                        <Cloud className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-brand' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    )}
                    <span
                        className={`truncate font-bold ${isActive ? 'text-brand' : 'text-gray-700'}`}
                        title={connection.name}
                    >
                        {connection.name}
                    </span>
                </div>
                <ConnectionActionsMenu connection={connection} onEditName={onEditName} onDelete={onDelete} />
            </Link>
        </li>
    );
}
```

- [ ] **Step 3: Create `EditConnectionNameDialog.tsx`**

Create `resources/js/components/cloud/EditConnectionNameDialog.tsx`:

```tsx
import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect } from 'react';
import { updateName } from '@/actions/App/Http/Controllers/CloudConnectionController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CloudConnection } from '@/types/cloud';

interface EditConnectionNameDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

export default function EditConnectionNameDialog({ connection, onClose }: EditConnectionNameDialogProps) {
    const form = useForm({
        name: connection?.name ?? '',
    });

    useEffect(() => {
        form.setData('name', connection?.name ?? '');
        form.clearErrors();
    }, [connection?.id]);

    if (!connection) {
        return null;
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        form.patch(updateName.url(connection), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
            <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl">
                <div className="mb-5">
                    <h3 className="text-lg font-extrabold tracking-tight text-gray-900">Edit connection name</h3>
                    <p className="mt-1 text-xs font-medium text-gray-400">Update the display name shown in the sidebar.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="connection-name">Name</Label>
                    <Input
                        id="connection-name"
                        value={form.data.name}
                        onChange={(event) => form.setData('name', event.target.value)}
                        maxLength={255}
                        autoFocus
                    />
                    {form.errors.name && <p className="text-xs font-semibold text-red-600">{form.errors.name}</p>}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={form.processing}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        Save
                    </Button>
                </div>
            </form>
        </div>
    );
}
```

- [ ] **Step 4: Create `DeleteConnectionDialog.tsx`**

Create `resources/js/components/cloud/DeleteConnectionDialog.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { disconnect } from '@/actions/App/Http/Controllers/CloudConnectionController';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CloudConnection } from '@/types/cloud';

interface DeleteConnectionDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

export default function DeleteConnectionDialog({ connection, onClose }: DeleteConnectionDialogProps) {
    const deleteConnection = () => {
        if (!connection) {
            return;
        }

        router.delete(disconnect.url(connection), {
            preserveScroll: true,
            onFinish: onClose,
        });
    };

    return (
        <AlertDialog open={connection !== null} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Xoá connection?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove {connection?.name} from your connected storage list. You can reconnect it later through OAuth.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={deleteConnection}>
                        Xoá connection
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
```

- [ ] **Step 5: Run frontend validation**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS. If unavailable, run `pnpm run build` and expect PASS after Task 8 wires imports.

- [ ] **Step 6: Record Task 7 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include these files for this task:

```text
resources/js/components/cloud/ConnectionActionsMenu.tsx
resources/js/components/cloud/ConnectionNavItem.tsx
resources/js/components/cloud/EditConnectionNameDialog.tsx
resources/js/components/cloud/DeleteConnectionDialog.tsx
```

---

### Task 8: Wire connection action components into authenticated layout

**Files:**

- Modify: `resources/js/layouts/AuthenticatedLayout.tsx`

- [ ] **Step 1: Update imports**

In `resources/js/layouts/AuthenticatedLayout.tsx`:

Remove the `Cloud` import only if it is no longer used by the logo. Keep it for the logo.

Add imports:

```tsx
import { useState } from 'react';
import ConnectionNavItem from '@/components/cloud/ConnectionNavItem';
import DeleteConnectionDialog from '@/components/cloud/DeleteConnectionDialog';
import EditConnectionNameDialog from '@/components/cloud/EditConnectionNameDialog';
import type { CloudConnection } from '@/types/cloud';
```

Change the existing React type import from:

```tsx
import type { ReactNode } from 'react';
```

to:

```tsx
import type { ReactNode } from 'react';
```

Keep `ReactNode` as a type import and `useState` as a value import.

- [ ] **Step 2: Add dialog state**

Inside `AuthenticatedLayout`, after `activeConnection`, add:

```tsx
const [connectionBeingRenamed, setConnectionBeingRenamed] = useState<CloudConnection | null>(null);
const [connectionBeingDeleted, setConnectionBeingDeleted] = useState<CloudConnection | null>(null);
```

- [ ] **Step 3: Replace inline connection rows**

Replace the current `connections.map((connection: any) => {` block that returns `<li key={connection.id}>` rows in `AuthenticatedLayout.tsx` with:

```tsx
{connections.map((connection: CloudConnection) => {
    const storageUrl = storageIndex.url({ connection: connection.id });
    const isActive = url.startsWith(storageUrl);

    return (
        <ConnectionNavItem
            key={connection.id}
            connection={connection}
            href={storageUrl}
            isActive={isActive}
            onEditName={setConnectionBeingRenamed}
            onDelete={setConnectionBeingDeleted}
        />
    );
})}
```

- [ ] **Step 4: Render dialogs in the layout**

Just before the closing `</div>` of the top-level wrapper in `AuthenticatedLayout.tsx`, after the main area, render:

```tsx
<EditConnectionNameDialog
    connection={connectionBeingRenamed}
    onClose={() => setConnectionBeingRenamed(null)}
/>
<DeleteConnectionDialog
    connection={connectionBeingDeleted}
    onClose={() => setConnectionBeingDeleted(null)}
/>
```

- [ ] **Step 5: Run frontend validation**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS. If unavailable, run:

```bash
pnpm run build
```

Expected: PASS.

- [ ] **Step 6: Record Task 8 files for a future commit if requested**

Do not commit unless the user explicitly asks. If a commit is requested later, include this file for this task:

```text
resources/js/layouts/AuthenticatedLayout.tsx
```

---

### Task 9: Final verification

**Files:**
- No planned code changes unless verification exposes defects.

- [ ] **Step 1: Run backend tests for the affected area**

Run:

```bash
php artisan test --compact tests/Feature/CloudConnectionTest.php
```

Expected: PASS.

- [ ] **Step 2: Run full test suite if time allows**

Run:

```bash
php artisan test --compact
```

Expected: PASS.

- [ ] **Step 3: Run frontend build validation**

Run:

```bash
pnpm run build
```

Expected: PASS.

- [ ] **Step 4: Start the app for manual UI verification**

Run the project dev command from the user's preference:

```bash
pnpm run dev
```

Keep it running while testing in the browser. If Laravel also needs to run, start the existing local Laravel dev server command used by this project, for example:

```bash
php artisan serve
```

- [ ] **Step 5: Open the app and verify sidebar behavior**

Use the project URL shown by the dev server or resolve it through Laravel Boost before sharing it. In the browser, verify:

1. Clicking a connection row navigates to its storage page.
2. Clicking the three-dot button opens the dropdown and does not navigate.
3. OAuth connection menu shows Reconnect, Edit name, and Xoá connection.
4. Edit name opens the dialog, saving a new name updates the sidebar.
5. Xoá connection opens an alert-dialog and only deletes after confirmation.
6. Reconnect redirects to the provider OAuth URL.

- [ ] **Step 6: Run Pint after any PHP fixes**

Run only if verification required PHP changes:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: PASS.

- [ ] **Step 7: Record verification fixes for a future commit if requested**

Do not commit unless the user explicitly asks. If verification required changes, note the changed files in the task handoff. If no changes were needed, record that no verification fixes were required.
