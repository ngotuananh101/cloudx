# Share View Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public-facing share view page (`/s/{uuid}`) with file/folder preview, password protection, folder navigation, and fullscreen view — consistent with the existing CloudX UI.

**Architecture:** A new `ShareViewController` handles all public share routes (no auth required). It reuses `CloudFileBrowser` for folder listing, `CloudStorageManager` for file streaming, and the existing `@iamjariwala/react-doc-viewer` for previews. A dedicated `ShareLayout` wraps all share pages with CloudX branding, dark mode, and no sidebar.

**Tech Stack:** Laravel 13, Inertia v3, React 19, Tailwind CSS v4, shadcn/ui, `@iamjariwala/react-doc-viewer`, Pest v4

**Spec:** `docs/superpowers/specs/2026-06-10-share-view-page-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `app/Http/Controllers/ShareViewController.php` | Public share routes: index, verify, preview, download |
| `resources/js/layouts/ShareLayout.tsx` | Layout for public pages: header (logo + badge + theme toggle), footer, centered content |
| `resources/js/pages/share/view.tsx` | Main share page: single file hero + DocViewer preview + folder table + fullscreen |
| `resources/js/pages/share/password.tsx` | Password entry page for protected shares |
| `resources/js/pages/share/error.tsx` | Error page: expired, not_found, wrong_password |
| `resources/js/components/share/SharePreview.tsx` | DocViewer wrapper with fullscreen toggle, dark mode, loading/error states |
| `resources/js/components/share/ShareFileTable.tsx` | File table for folder view: icon, name, size, download action, folder navigation |
| `resources/js/components/share/ShareBreadcrumb.tsx` | Breadcrumb for subfolder navigation |
| `tests/Feature/ShareViewTest.php` | Pest tests for ShareViewController |

### Modified files

| File | Change |
|------|--------|
| `routes/web.php` | Add public share routes (no auth middleware) |
| `app/Http/Kernel.php` or `bootstrap/app.php` | Register rate limiter for password verification |

---

### Task 1: Create ShareLayout

**Files:**
- Create: `resources/js/layouts/ShareLayout.tsx`

- [ ] **Step 1: Create ShareLayout component**

```tsx
import type { PropsWithChildren } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ShareLayout({ children }: PropsWithChildren) {
    return (
        <div className="relative flex min-h-screen flex-col bg-[#f8f9fa] dark:bg-gray-950">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="flex flex-1 items-center justify-center px-4 py-12">
                {children}
            </div>
            <footer className="pb-6 text-center text-xs text-gray-400 dark:text-gray-600">
                Powered by <span className="font-semibold text-gray-500 dark:text-gray-400">CloudX</span> — Your Digital Curator
            </footer>
        </div>
    );
}
```

- [ ] **Step 2: Verify it renders without errors**

Run: `npx tsc --noEmit resources/js/layouts/ShareLayout.tsx 2>&1 | head -5`
Expected: No errors (or only unrelated warnings)

- [ ] **Step 3: Commit**

```bash
git add resources/js/layouts/ShareLayout.tsx
git commit -m "feat(share): add ShareLayout for public share pages"
```

---

### Task 2: Add public share routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add share routes outside auth middleware**

Add the following **before** the `Route::middleware(['auth', 'verified'])` block in `routes/web.php`:

```php
use App\Http\Controllers\ShareViewController;

// Public share routes (no auth required)
Route::prefix('s')->group(function () {
    Route::get('{uuid}', [ShareViewController::class, 'index'])->name('share.view');
    Route::post('{uuid}/verify', [ShareViewController::class, 'verify'])->name('share.verify');
    Route::get('{uuid}/preview/{path?}', [ShareViewController::class, 'preview'])
        ->name('share.preview')
        ->where('path', '.*');
    Route::get('{uuid}/download/{path?}', [ShareViewController::class, 'download'])
        ->name('share.download')
        ->where('path', '.*');
});
```

- [ ] **Step 2: Verify routes are registered**

Run: `php artisan route:list --path=s/`
Expected: 4 routes under `s/` prefix, all without auth middleware

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat(share): add public share routes"
```

---

### Task 3: Create ShareViewController — index method (error + password + single file)

**Files:**
- Create: `app/Http/Controllers/ShareViewController.php`
- Test: `tests/Feature/ShareViewTest.php`

- [ ] **Step 1: Write failing tests for index method**

Create `tests/Feature/ShareViewTest.php`:

```php
<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\CloudShare;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

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
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

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
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

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
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => 'public-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'report.pdf',
        'name' => 'report.pdf',
        'is_directory' => false,
        'type' => 'public',
    ]);

    // Mock cloud storage to avoid real API calls
    $browser = Mockery::mock(\App\Services\CloudStorage\CloudFileBrowser::class);
    $browser->shouldReceive('list')->andReturn([
        [
            'id' => 'report.pdf',
            'path' => 'report.pdf',
            'name' => 'report.pdf',
            'type' => 'document',
            'size' => 2048,
            'updatedAt' => 'Jun 10, 2026',
            'isDirectory' => false,
        ],
    ]);
    $this->app->instance(\App\Services\CloudStorage\CloudFileBrowser::class, $browser);

    $this->get(route('share.view', ['uuid' => 'public-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/view')
            ->where('share.uuid', 'public-uuid')
            ->where('share.name', 'report.pdf')
            ->where('isDirectory', false)
            ->has('file')
            ->where('file.name', 'report.pdf')
        );
});

it('renders view page for public folder share with file listing', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => 'folder-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'Projects',
        'name' => 'Projects',
        'is_directory' => true,
        'type' => 'public',
    ]);

    $browser = Mockery::mock(\App\Services\CloudStorage\CloudFileBrowser::class);
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
            'id' => 'Projects/src',
            'path' => 'Projects/src',
            'name' => 'src',
            'type' => 'folder',
            'size' => 0,
            'updatedAt' => '--',
            'isDirectory' => true,
        ],
    ]);
    $this->app->instance(\App\Services\CloudStorage\CloudFileBrowser::class, $browser);

    $this->get(route('share.view', ['uuid' => 'folder-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/view')
            ->where('share.uuid', 'folder-uuid')
            ->where('isDirectory', true)
            ->has('files', 2)
            ->where('currentPath', '')
        );
});

it('renders folder subfolder when path query param is provided', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => 'folder-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'Projects',
        'name' => 'Projects',
        'is_directory' => true,
        'type' => 'public',
    ]);

    $browser = Mockery::mock(\App\Services\CloudStorage\CloudFileBrowser::class);
    $browser->shouldReceive('list')->andReturn([
        [
            'id' => 'Projects/src/index.ts',
            'path' => 'Projects/src/index.ts',
            'name' => 'index.ts',
            'type' => 'code',
            'size' => 256,
            'updatedAt' => 'Jun 9, 2026',
            'isDirectory' => false,
        ],
    ]);
    $this->app->instance(\App\Services\CloudStorage\CloudFileBrowser::class, $browser);

    $encodedPath = \App\Services\CloudStorage\PathEncoder::encode('Projects/src');

    $this->get(route('share.view', ['uuid' => 'folder-uuid', 'path' => $encodedPath]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/view')
            ->where('isDirectory', true)
            ->has('files', 1)
            ->where('currentPath', 'Projects/src')
        );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact --filter=ShareViewTest`
Expected: FAIL — `ShareViewController` does not exist

- [ ] **Step 3: Create ShareViewController with index method**

Create `app/Http/Controllers/ShareViewController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\CloudShare;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\PathEncoder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ShareViewController extends Controller
{
    public function __construct(
        private CloudFileBrowser $fileBrowser,
        private CloudStorageManager $cloudStorage,
    ) {}

    public function index(Request $request, string $uuid): Response
    {
        $share = CloudShare::where('uuid', $uuid)
            ->with(['user', 'cloudConnection'])
            ->first();

        if (! $share) {
            return Inertia::render('share/error', [
                'reason' => 'not_found',
            ]);
        }

        if ($share->expires_at && $share->expires_at->isPast()) {
            return Inertia::render('share/error', [
                'reason' => 'expired',
            ]);
        }

        if ($share->type === 'password' && ! $request->session()->get("share_verified_{$share->id}")) {
            return Inertia::render('share/password', [
                'uuid' => $uuid,
                'share' => [
                    'name' => $share->name,
                ],
            ]);
        }

        $connection = $share->cloudConnection;

        if ($share->is_directory) {
            $encodedPath = $request->query('path', '');
            $decodedPath = $encodedPath ? PathEncoder::decode($encodedPath) : $share->path;

            // Build the full path: share base path + subfolder path
            $browsePath = $encodedPath ? $decodedPath : $share->path;

            try {
                $files = $this->fileBrowser->list($connection, PathEncoder::encode($browsePath));
            } catch (Throwable $exception) {
                Log::error('Could not list shared folder contents.', [
                    'exception' => $exception,
                    'share_uuid' => $uuid,
                    'path' => $browsePath,
                ]);
                $files = [];
            }

            return Inertia::render('share/view', [
                'share' => $this->shareData($share),
                'isDirectory' => true,
                'files' => $files,
                'file' => null,
                'currentPath' => $browsePath,
                'shareBasePath' => $share->path,
                'previewUrl' => null,
                'downloadUrl' => null,
            ]);
        }

        // Single file share
        return Inertia::render('share/view', [
            'share' => $this->shareData($share),
            'isDirectory' => false,
            'files' => [],
            'file' => [
                'name' => $share->name,
                'path' => $share->path,
                'size' => 0,
                'type' => \App\Services\CloudStorage\CloudFileTypeDetector::detect($share->name, false),
            ],
            'currentPath' => '',
            'shareBasePath' => $share->path,
            'previewUrl' => route('share.preview', ['uuid' => $uuid, 'path' => PathEncoder::encode($share->path)]),
            'downloadUrl' => route('share.download', ['uuid' => $uuid, 'path' => PathEncoder::encode($share->path)]),
        ]);
    }

    public function verify(Request $request, string $uuid): RedirectResponse
    {
        $share = CloudShare::where('uuid', $uuid)->firstOrFail();

        $request->validate([
            'password' => 'required|string',
        ]);

        if (! Hash::check($request->input('password'), $share->password)) {
            return back()->withErrors(['password' => 'Incorrect password.']);
        }

        $request->session()->put("share_verified_{$share->id}", true);

        return redirect()->route('share.view', ['uuid' => $uuid]);
    }

    public function preview(Request $request, string $uuid, ?string $path = null): StreamedResponse
    {
        $share = $this->resolveAndVerify($request, $uuid);
        $decodedPath = $path ? PathEncoder::decode($path) : $share->path;

        try {
            $connector = $this->cloudStorage->connector($share->cloudConnection->provider);
            $disk = $connector->disk($share->cloudConnection);

            abort_unless($disk->exists($decodedPath), 404, 'File not found.');

            $name = basename($decodedPath);

            try {
                $mimeType = $disk->mimeType($decodedPath);
            } catch (Throwable) {
                $mimeType = 'application/octet-stream';
            }

            try {
                $fileSize = $disk->fileSize($decodedPath);
            } catch (Throwable) {
                $fileSize = null;
            }

            return response()->stream(function () use ($disk, $decodedPath) {
                $stream = $disk->readStream($decodedPath);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            }, 200, array_filter([
                'Content-Type' => $mimeType,
                'Content-Length' => $fileSize,
                'Content-Disposition' => 'inline; filename="' . addslashes($name) . '"',
                'Cache-Control' => 'public, max-age=31536000, immutable',
            ]));
        } catch (Throwable $exception) {
            Log::error('Could not preview shared file.', [
                'exception' => $exception,
                'share_uuid' => $uuid,
                'path' => $decodedPath,
            ]);

            abort(404, 'File could not be previewed.');
        }
    }

    public function download(Request $request, string $uuid, ?string $path = null): StreamedResponse|RedirectResponse
    {
        $share = $this->resolveAndVerify($request, $uuid);
        $decodedPath = $path ? PathEncoder::decode($path) : $share->path;

        try {
            $connector = $this->cloudStorage->connector($share->cloudConnection->provider);

            if ($connector instanceof \App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink) {
                $url = $connector->directDownloadLink($share->cloudConnection, $decodedPath);
                if (is_string($url) && $url !== '') {
                    return redirect()->away($url);
                }
            }

            $disk = $connector->disk($share->cloudConnection);
            abort_unless($disk->exists($decodedPath), 404, 'File not found.');

            $name = basename($decodedPath);

            try {
                $mimeType = $disk->mimeType($decodedPath);
            } catch (Throwable) {
                $mimeType = 'application/octet-stream';
            }

            try {
                $fileSize = $disk->fileSize($decodedPath);
            } catch (Throwable) {
                $fileSize = null;
            }

            return response()->streamDownload(function () use ($disk, $decodedPath) {
                $stream = $disk->readStream($decodedPath);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            }, $name, array_filter([
                'Content-Type' => $mimeType,
                'Content-Length' => $fileSize,
            ]));
        } catch (Throwable $exception) {
            Log::error('Could not download shared file.', [
                'exception' => $exception,
                'share_uuid' => $uuid,
                'path' => $decodedPath,
            ]);

            abort(404, 'File could not be downloaded.');
        }
    }

    private function resolveAndVerify(Request $request, string $uuid): CloudShare
    {
        $share = CloudShare::where('uuid', $uuid)
            ->with('cloudConnection')
            ->firstOrFail();

        abort_if(
            $share->type === 'password' && ! $request->session()->get("share_verified_{$share->id}"),
            403,
            'Password verification required.'
        );

        return $share;
    }

    /**
     * @return array{uuid: string, name: string, type: string, expires_at: string|null, created_at: string, is_directory: bool, user_name: string|null}
     */
    private function shareData(CloudShare $share): array
    {
        return [
            'uuid' => $share->uuid,
            'name' => $share->name,
            'type' => $share->type,
            'expires_at' => $share->expires_at?->toISOString(),
            'created_at' => $share->created_at->toISOString(),
            'is_directory' => $share->is_directory,
            'user_name' => $share->user?->name,
        ];
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test --compact --filter=ShareViewTest`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/ShareViewController.php tests/Feature/ShareViewTest.php
git commit -m "feat(share): add ShareViewController with index, verify, preview, download"
```

---

### Task 4: Write tests for password verification

**Files:**
- Modify: `tests/Feature/ShareViewTest.php`

- [ ] **Step 1: Add password verification tests**

Append to `tests/Feature/ShareViewTest.php`:

```php
it('redirects to share view after correct password', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => 'locked-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'secret.pdf',
        'name' => 'secret.pdf',
        'is_directory' => false,
        'type' => 'password',
        'password' => Hash::make('correct-password'),
    ]);

    $this->post(route('share.verify', ['uuid' => 'locked-uuid']), [
        'password' => 'correct-password',
    ])->assertRedirect(route('share.view', ['uuid' => 'locked-uuid']));

    $this->assertTrue(session()->get('share_verified_' . CloudShare::where('uuid', 'locked-uuid')->first()->id));
});

it('returns error when password is incorrect', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => 'locked-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'secret.pdf',
        'name' => 'secret.pdf',
        'is_directory' => false,
        'type' => 'password',
        'password' => Hash::make('correct-password'),
    ]);

    $this->post(route('share.verify', ['uuid' => 'locked-uuid']), [
        'password' => 'wrong-password',
    ])->assertSessionHasErrors('password');
});

it('blocks preview endpoint when password share is not verified', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

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

    $this->get(route('share.preview', ['uuid' => 'locked-uuid']))
        ->assertForbidden();
});
```

- [ ] **Step 2: Run all share tests**

Run: `php artisan test --compact --filter=ShareViewTest`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/ShareViewTest.php
git commit -m "test(share): add password verification and preview access tests"
```

---

### Task 5: Create error page

**Files:**
- Create: `resources/js/pages/share/error.tsx`

- [ ] **Step 1: Create error page component**

```tsx
import { Head } from '@inertiajs/react';
import { Clock, Search, ShieldAlert } from 'lucide-react';
import ShareLayout from '@/layouts/ShareLayout';
import { Button } from '@/components/ui/button';

const errorConfig = {
    not_found: {
        icon: Search,
        iconBg: 'bg-gray-100 dark:bg-gray-800',
        title: 'Link Not Found',
        description: 'This shared link doesn\'t exist or has been removed. Please check the URL or contact the sender.',
    },
    expired: {
        icon: Clock,
        iconBg: 'bg-red-50 dark:bg-red-950',
        title: 'Link Expired',
        description: 'This shared link has expired and is no longer available. Please contact the sender for a new link.',
    },
    wrong_password: {
        icon: ShieldAlert,
        iconBg: 'bg-amber-50 dark:bg-amber-950',
        title: 'Access Denied',
        description: 'The password you entered is incorrect. Please try again.',
    },
} as const;

export default function ShareError({ reason }: { reason: keyof typeof errorConfig }) {
    const config = errorConfig[reason] ?? errorConfig.not_found;
    const Icon = config.icon;

    return (
        <ShareLayout>
            <Head title={`Error — ${config.title}`} />
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900">
                <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBg}`}>
                    <Icon className="h-7 w-7 text-gray-500 dark:text-gray-400" />
                </div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {config.title}
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {config.description}
                </p>
                <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => window.location.href = '/'}
                >
                    ← Back to CloudX
                </Button>
            </div>
        </ShareLayout>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/share/error.tsx
git commit -m "feat(share): add error page for expired, not_found, wrong_password"
```

---

### Task 6: Create password page

**Files:**
- Create: `resources/js/pages/share/password.tsx`

- [ ] **Step 1: Create password page component**

```tsx
import { Head, useForm } from '@inertiajs/react';
import { Lock, Loader2 } from 'lucide-react';
import ShareLayout from '@/layouts/ShareLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SharePasswordProps {
    uuid: string;
    share: {
        name: string;
    };
}

export default function SharePassword({ uuid, share }: SharePasswordProps) {
    const { data, setData, post, processing, errors } = useForm({
        password: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/s/${uuid}/verify`);
    };

    return (
        <ShareLayout>
            <Head title={`Unlock — ${share.name}`} />
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900">
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
                        <Lock className="h-7 w-7 text-amber-500" />
                    </div>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        Password Protected
                    </h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <strong>{share.name}</strong> is protected with a password.
                        Enter the password to access it.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Enter password..."
                            autoFocus
                            className="h-11"
                        />
                        {errors.password && (
                            <p className="text-sm text-red-500">{errors.password}</p>
                        )}
                    </div>
                    <Button
                        type="submit"
                        disabled={processing || data.password.length === 0}
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                        {processing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Lock className="mr-2 h-4 w-4" />
                        )}
                        Unlock
                    </Button>
                </form>
            </div>
        </ShareLayout>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/share/password.tsx
git commit -m "feat(share): add password entry page for protected shares"
```

---

### Task 7: Create ShareBreadcrumb component

**Files:**
- Create: `resources/js/components/share/ShareBreadcrumb.tsx`

- [ ] **Step 1: Create breadcrumb component**

```tsx
import { ChevronRight, Home } from 'lucide-react';

interface ShareBreadcrumbProps {
    /** The share's root folder name */
    shareName: string;
    /** Current decoded path inside the share */
    currentPath: string;
    /** The share's base path (root of the share) */
    shareBasePath: string;
    onNavigate: (path: string | null) => void;
}

interface BreadcrumbSegment {
    label: string;
    path: string;
}

export function ShareBreadcrumb({
    shareName,
    currentPath,
    shareBasePath,
    onNavigate,
}: ShareBreadcrumbProps) {
    // Build segments relative to share root
    const relativePath = currentPath.startsWith(shareBasePath)
        ? currentPath.slice(shareBasePath.length).replace(/^\//, '')
        : '';

    const segments: BreadcrumbSegment[] = relativePath
        .split('/')
        .filter(Boolean)
        .map((label, index, arr) => ({
            label,
            path: `${shareBasePath}/${arr.slice(0, index + 1).join('/')}`,
        }));

    const isAtRoot = segments.length === 0;

    return (
        <div className="flex items-center gap-1.5 text-sm">
            <button
                type="button"
                onClick={() => onNavigate(null)}
                className={`flex items-center gap-1 transition-colors ${
                    isAtRoot
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
                <Home className="h-4 w-4" />
                <span className="truncate">{shareName}</span>
            </button>

            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;

                return (
                    <div key={segment.path} className="flex items-center gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                        {isLast ? (
                            <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                {segment.label}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onNavigate(segment.path)}
                                className="truncate text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                            >
                                {segment.label}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/share/ShareBreadcrumb.tsx
git commit -m "feat(share): add ShareBreadcrumb for subfolder navigation"
```

---

### Task 8: Create ShareFileTable component

**Files:**
- Create: `resources/js/components/share/ShareFileTable.tsx`

- [ ] **Step 1: Create file table component**

```tsx
import {
    Folder,
    FileText,
    FileImage,
    FileCode,
    FileArchive,
    FileVideo,
    FileAudio,
    File,
    Download,
} from 'lucide-react';
import { formatBytes } from '@/lib/format-bytes';
import { encodeCloudPath } from '@/lib/cloud-path';
import { Button } from '@/components/ui/button';
import type { CloudFile } from '@/types/cloud';

interface ShareFileTableProps {
    files: CloudFile[];
    shareUuid: string;
    onNavigate: (file: CloudFile) => void;
    onPreview: (file: CloudFile) => void;
}

function getFileIcon(type: string) {
    switch (type) {
        case 'folder':
            return <Folder className="h-4 w-4 fill-blue-500/20 text-blue-500 dark:fill-blue-500/30 dark:text-blue-400" />;
        case 'document':
            return <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
        case 'image':
            return <FileImage className="h-4 w-4 text-emerald-500" />;
        case 'code':
            return <FileCode className="h-4 w-4 text-amber-500" />;
        case 'archive':
            return <FileArchive className="h-4 w-4 text-red-500" />;
        case 'video':
            return <FileVideo className="h-4 w-4 text-purple-500" />;
        case 'audio':
            return <FileAudio className="h-4 w-4 text-pink-500" />;
        default:
            return <File className="h-4 w-4 text-gray-400 dark:text-gray-500" />;
    }
}

export function ShareFileTable({ files, shareUuid, onNavigate, onPreview }: ShareFileTableProps) {
    const handleDownload = (file: CloudFile) => {
        const encodedPath = encodeCloudPath(file.path);
        window.location.href = `/s/${shareUuid}/download/${encodedPath}`;
    };

    if (files.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                This folder is empty.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Name
                        </th>
                        <th className="w-28 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Size
                        </th>
                        <th className="w-16 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {files.map((file) => (
                        <tr
                            key={file.id}
                            className="group border-b border-gray-50 dark:border-gray-800 last:border-b-0 bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/80"
                        >
                            <td className="px-4 py-2.5">
                                <div
                                    className={`flex min-w-0 items-center gap-3 ${file.isDirectory ? 'cursor-pointer' : ''}`}
                                    onClick={() => file.isDirectory ? onNavigate(file) : onPreview(file)}
                                    role={file.isDirectory ? 'button' : undefined}
                                    tabIndex={file.isDirectory ? 0 : undefined}
                                    onKeyDown={(e) => {
                                        if (file.isDirectory && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            onNavigate(file);
                                        }
                                    }}
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                                        {getFileIcon(file.type)}
                                    </div>
                                    <span className={`truncate text-sm font-medium ${
                                        file.isDirectory
                                            ? 'text-blue-600 dark:text-blue-400 hover:underline'
                                            : 'text-gray-900 dark:text-gray-100'
                                    }`}>
                                        {file.name}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">
                                {file.isDirectory ? '--' : formatBytes(file.size)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {!file.isDirectory && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                        onClick={() => handleDownload(file)}
                                        aria-label={`Download ${file.name}`}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/share/ShareFileTable.tsx
git commit -m "feat(share): add ShareFileTable for folder view with navigation and download"
```

---

### Task 9: Create SharePreview component

**Files:**
- Create: `resources/js/components/share/SharePreview.tsx`

- [ ] **Step 1: Create preview component with fullscreen support**

```tsx
import DocViewer, { DocViewerRenderers } from '@iamjariwala/react-doc-viewer';
import '@iamjariwala/react-doc-viewer/dist/index.css';
import { Download, File, Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format-bytes';

interface SharePreviewProps {
    previewUrl: string;
    fileName: string;
    fileSize: number;
    downloadUrl: string;
}

export function SharePreview({ previewUrl, fileName, fileSize, downloadUrl }: SharePreviewProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { theme } = useTheme();
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const handleDownload = () => {
        window.location.href = downloadUrl;
    };

    const NoRendererFallback = () => (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-950">
            <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                <File className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Preview not supported
            </h4>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This file type cannot be previewed in the browser.
            </p>
            <Button className="mt-6" onClick={handleDownload}>
                Download File
            </Button>
        </div>
    );

    const LoadingRenderer = () => (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-950">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Loading preview...
            </p>
        </div>
    );

    const previewContent = (
        <div className={`flex flex-col ${isFullscreen ? 'h-screen w-screen' : 'h-[500px]'}`}>
            {/* Header bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                <div className="min-w-0 flex-1 pr-4">
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {fileName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(fileSize)}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        onClick={handleDownload}
                        title="Download"
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                    {isFullscreen && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            onClick={() => setIsFullscreen(false)}
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* DocViewer area */}
            <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-950">
                <DocViewer
                    documents={[{ uri: previewUrl, fileName }]}
                    pluginRenderers={DocViewerRenderers}
                    className="my-preview"
                    config={{
                        themeMode: isDark ? 'dark' : 'light',
                        header: { disableHeader: true },
                        noRenderer: { overrideComponent: NoRendererFallback },
                        loadingRenderer: {
                            overrideComponent: LoadingRenderer,
                            showLoadingTimeout: 500,
                        },
                    }}
                />
            </div>
        </div>
    );

    if (isFullscreen) {
        return (
            <>
                {/* Keep the inline preview visible behind the overlay */}
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    {previewContent}
                </div>
                {/* Fullscreen overlay */}
                <div
                    className="fixed inset-0 z-50 bg-white dark:bg-gray-950"
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setIsFullscreen(false);
                        }
                    }}
                >
                    {previewContent}
                </div>
            </>
        );
    }

    return (
        <div className="rounded-xl border border-gray-100 overflow-hidden dark:border-gray-800">
            {previewContent}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/share/SharePreview.tsx
git commit -m "feat(share): add SharePreview with DocViewer and fullscreen support"
```

---

### Task 10: Create main share/view.tsx page

**Files:**
- Create: `resources/js/pages/share/view.tsx`

- [ ] **Step 1: Create the main share view page**

```tsx
import { Head, router } from '@inertiajs/react';
import {
    Download,
    File,
    FileArchive,
    FileAudio,
    FileCode,
    FileImage,
    FileText,
    FileVideo,
    Folder,
    Clock,
    Globe,
    Lock,
} from 'lucide-react';
import { useState } from 'react';
import ShareLayout from '@/layouts/ShareLayout';
import { Button } from '@/components/ui/button';
import { ShareBreadcrumb } from '@/components/share/ShareBreadcrumb';
import { ShareFileTable } from '@/components/share/ShareFileTable';
import { SharePreview } from '@/components/share/SharePreview';
import { encodeCloudPath } from '@/lib/cloud-path';
import { formatBytes } from '@/lib/format-bytes';
import type { CloudFile } from '@/types/cloud';

interface ShareViewProps {
    share: {
        uuid: string;
        name: string;
        type: 'public' | 'password';
        expires_at: string | null;
        created_at: string;
        is_directory: boolean;
        user_name: string | null;
    };
    isDirectory: boolean;
    files: CloudFile[];
    file: {
        name: string;
        path: string;
        size: number;
        type: string;
    } | null;
    currentPath: string;
    shareBasePath: string;
    previewUrl: string | null;
    downloadUrl: string | null;
}

function getLargeIcon(type: string, isDirectory: boolean) {
    if (isDirectory) {
        return { icon: Folder, bg: 'bg-amber-50 dark:bg-amber-950', color: 'text-amber-500' };
    }
    switch (type) {
        case 'image':
            return { icon: FileImage, bg: 'bg-emerald-50 dark:bg-emerald-950', color: 'text-emerald-500' };
        case 'video':
            return { icon: FileVideo, bg: 'bg-purple-50 dark:bg-purple-950', color: 'text-purple-500' };
        case 'audio':
            return { icon: FileAudio, bg: 'bg-pink-50 dark:bg-pink-950', color: 'text-pink-500' };
        case 'code':
            return { icon: FileCode, bg: 'bg-blue-50 dark:bg-blue-950', color: 'text-blue-500' };
        case 'archive':
            return { icon: FileArchive, bg: 'bg-red-50 dark:bg-red-950', color: 'text-red-500' };
        case 'document':
            return { icon: FileText, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-500' };
        default:
            return { icon: File, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-400' };
    }
}

export default function ShareView({
    share,
    isDirectory,
    files,
    file,
    currentPath,
    shareBasePath,
    previewUrl,
    downloadUrl,
}: ShareViewProps) {
    const [previewingFile, setPreviewingFile] = useState<CloudFile | null>(null);

    const handleNavigateFolder = (folderFile: CloudFile) => {
        const encodedPath = encodeCloudPath(folderFile.path);
        router.visit(`/s/${share.uuid}?path=${encodedPath}`);
    };

    const handleBreadcrumbNavigate = (path: string | null) => {
        if (path === null) {
            router.visit(`/s/${share.uuid}`);
        } else {
            const encodedPath = encodeCloudPath(path);
            router.visit(`/s/${share.uuid}?path=${encodedPath}`);
        }
    };

    const handlePreviewFile = (fileItem: CloudFile) => {
        setPreviewingFile(fileItem);
    };

    const totalSize = isDirectory
        ? files.reduce((sum, f) => sum + (f.isDirectory ? 0 : f.size), 0)
        : 0;

    const iconConfig = isDirectory
        ? getLargeIcon('folder', true)
        : getLargeIcon(file?.type ?? 'other', false);
    const IconComponent = iconConfig.icon;

    const handleDownload = () => {
        if (!file || !downloadUrl) {
            return;
        }
        window.location.href = downloadUrl;
    };

    const handleDownloadFolderFile = (fileItem: CloudFile) => {
        const encodedPath = encodeCloudPath(fileItem.path);
        window.location.href = `/s/${share.uuid}/download/${encodedPath}`;
    };

    const isAtRoot = currentPath === shareBasePath || currentPath === '';

    return (
        <ShareLayout>
            <Head title={`${share.name} — Shared`} />

            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900">
                {/* Header with badge */}
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3 dark:border-gray-800">
                    <span className="text-sm font-bold tracking-tight text-brand">
                        CloudX
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {share.type === 'public' ? (
                            <>
                                <Globe className="h-3 w-3" />
                                Public
                            </>
                        ) : (
                            <>
                                <Lock className="h-3 w-3" />
                                Protected
                            </>
                        )}
                    </span>
                </div>

                {/* Body */}
                <div className="px-6 py-8">
                    {/* Shared info */}
                    <div className="mb-6 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {share.user_name && (
                            <>
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                                    {share.user_name.charAt(0).toUpperCase()}
                                </div>
                                <span>
                                    Shared by <strong className="text-gray-700 dark:text-gray-300">{share.user_name}</strong>
                                </span>
                                <span>•</span>
                            </>
                        )}
                        {share.expires_at ? (
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires {new Date(share.expires_at).toLocaleDateString()}
                            </span>
                        ) : (
                            <span>No expiry</span>
                        )}
                    </div>

                    {/* Breadcrumb for folders */}
                    {isDirectory && !isAtRoot && (
                        <div className="mb-4">
                            <ShareBreadcrumb
                                shareName={share.name}
                                currentPath={currentPath}
                                shareBasePath={shareBasePath}
                                onNavigate={handleBreadcrumbNavigate}
                            />
                        </div>
                    )}

                    {/* File/Folder hero */}
                    <div className="mb-6 text-center">
                        <div className={`mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-2xl ${iconConfig.bg}`}>
                            <IconComponent className={`h-8 w-8 ${iconConfig.color}`} />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {isDirectory && !isAtRoot
                                ? currentPath.split('/').pop()
                                : share.name}
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {isDirectory
                                ? `${files.length} items • ${formatBytes(totalSize)} total`
                                : `${formatBytes(file?.size ?? 0)} • ${file?.type ?? 'file'}`}
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="mb-6 flex justify-center gap-3">
                        {!isDirectory && (
                            <>
                                <Button
                                    onClick={handleDownload}
                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </Button>
                            </>
                        )}
                        {isDirectory && files.length > 0 && (
                            <Button
                                onClick={() => {
                                    // Download each file individually
                                    const downloadableFiles = files.filter((f) => !f.isDirectory);
                                    downloadableFiles.forEach((f) => handleDownloadFolderFile(f));
                                }}
                                className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download All
                            </Button>
                        )}
                    </div>

                    {/* Preview area for single file */}
                    {!isDirectory && previewUrl && downloadUrl && file && (
                        <SharePreview
                            previewUrl={previewUrl}
                            fileName={file.name}
                            fileSize={file.size}
                            downloadUrl={downloadUrl}
                        />
                    )}

                    {/* Preview area for file inside folder */}
                    {previewingFile && (
                        <div className="mb-6">
                            <SharePreview
                                previewUrl={`/s/${share.uuid}/preview/${encodeCloudPath(previewingFile.path)}`}
                                fileName={previewingFile.name}
                                fileSize={previewingFile.size}
                                downloadUrl={`/s/${share.uuid}/download/${encodeCloudPath(previewingFile.path)}`}
                            />
                        </div>
                    )}

                    {/* File table for folders */}
                    {isDirectory && (
                        <ShareFileTable
                            files={files}
                            shareUuid={share.uuid}
                            onNavigate={handleNavigateFolder}
                            onPreview={handlePreviewFile}
                        />
                    )}
                </div>
            </div>
        </ShareLayout>
    );
}
```

- [ ] **Step 2: Run Pint and verify**

Run: `vendor/bin/pint --dirty --format agent`

- [ ] **Step 3: Run all tests**

Run: `php artisan test --compact --filter=ShareViewTest`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/share/view.tsx resources/js/components/share/
git commit -m "feat(share): add main share view page with file preview, folder navigation, and fullscreen"
```

---

### Task 11: Run Wayfinder and final verification

- [ ] **Step 1: Regenerate Wayfinder routes**

Run: `php artisan wayfinder:generate`
Expected: New route files generated under `resources/js/routes/`

- [ ] **Step 2: Run all tests**

Run: `php artisan test --compact`
Expected: All tests PASS

- [ ] **Step 3: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`

- [ ] **Step 4: Build frontend**

Run: `npm run build`
Expected: No build errors

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(share): finalize share view page with wayfinder routes and build"
```
