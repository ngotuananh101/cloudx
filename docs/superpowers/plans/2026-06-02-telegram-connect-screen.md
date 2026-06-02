# Telegram Connect Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline wizard in the Connect Storage modal for connecting Telegram, following FTP/SFTP credential-based provider pattern.

**Architecture:** Frontend wizard (`TelegramConnectionForm`) inside `ConnectStorageModal` with 3 steps: phone → code → done. Backend controller calls Telegram microservice to send code and login, stores auth state in Laravel session, creates `CloudConnection` on success.

**Tech Stack:** PHP 8.4, Laravel 13, Inertia React v3, Tailwind CSS v4, Pest 4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `resources/js/types/cloud.ts` | Modify | Add `TelegramConnectionConfig` interface |
| `resources/js/components/cloud/TelegramConnectionForm.tsx` | Create | 3-step wizard component |
| `resources/js/components/cloud/ConnectStorageModal.tsx` | Modify | Add Telegram form case |
| `resources/js/components/cloud/ProviderOption.tsx` | Modify | Add 'telegram' to credentials providers |
| `app/Http/Controllers/TelegramConnectionController.php` | Create | Store + request-code endpoints |
| `app/Http/Controllers/HomeController.php` | Modify | Add TELEGRAM to credentials authType |
| `routes/web.php` | Modify | Add Telegram routes |
| `tests/Feature/TelegramConnectionControllerTest.php` | Create | Controller tests |

---

### Task 1: Update TypeScript types and ProviderOption

**Files:**
- Modify: `resources/js/types/cloud.ts`
- Modify: `resources/js/components/cloud/ProviderOption.tsx`

- [ ] **Step 1: Add TelegramConnectionConfig to cloud.ts**

Add after `SftpConnectionConfig`:

```typescript
export interface TelegramConnectionConfig {
    session_id?: string;
}
```

Add to `CloudConnection`:

```typescript
export interface CloudConnection {
    // ... existing fields ...
    telegram_config?: TelegramConnectionConfig;
}
```

- [ ] **Step 2: Add telegram to ProviderOption supported credentials**

In `ProviderOption.tsx`, change line 17-18:

```tsx
const isSupportedCredentialsProvider =
    provider.authType === 'credentials' &&
    (provider.key === 'ftp' ||
        provider.key === 'sftp' ||
        provider.key === 'telegram');
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/types/cloud.ts resources/js/components/cloud/ProviderOption.tsx
git commit -m "feat(telegram): add telegram to credential providers in frontend"
```

---

### Task 2: Update HomeController and ConnectStorageModal

**Files:**
- Modify: `app/Http/Controllers/HomeController.php`
- Modify: `resources/js/components/cloud/ConnectStorageModal.tsx`

- [ ] **Step 1: Add TELEGRAM to credentials authType in HomeController**

In `HomeController::availableProviders()`, line 55:

```php
$authType = $provider->is(CloudProvider::FTP) || $provider->is(CloudProvider::SFTP) || $provider->is(CloudProvider::TELEGRAM) ? 'credentials' : 'oauth';
```

- [ ] **Step 2: Update ConnectStorageModal to handle Telegram**

Replace the full `ConnectStorageModal.tsx`:

```tsx
import { X } from 'lucide-react';
import { useState } from 'react';
import FtpConnectionForm from '@/components/cloud/FtpConnectionForm';
import SftpConnectionForm from '@/components/cloud/SftpConnectionForm';
import TelegramConnectionForm from '@/components/cloud/TelegramConnectionForm';
import ProviderOption from '@/components/cloud/ProviderOption';
import type { AvailableProvider } from '@/types/cloud';

interface ConnectStorageModalProps {
    providers: AvailableProvider[];
    onClose: () => void;
}

export default function ConnectStorageModal({
    providers,
    onClose,
}: ConnectStorageModalProps) {
    const [selectedCredentialsProvider, setSelectedCredentialsProvider] =
        useState<AvailableProvider | null>(null);

    const isFtpSelected = selectedCredentialsProvider?.key === 'ftp';
    const isSftpSelected = selectedCredentialsProvider?.key === 'sftp';
    const isTelegramSelected = selectedCredentialsProvider?.key === 'telegram';
    const isCredentialsSelected =
        isFtpSelected || isSftpSelected || isTelegramSelected;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="connect-storage-modal-title"
                className={`relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl transition-all ${isCredentialsSelected ? 'max-w-2xl' : 'max-w-md'}`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Close connect storage modal"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="mb-6">
                    <h3
                        id="connect-storage-modal-title"
                        className="text-xl font-extrabold tracking-tight text-gray-900"
                    >
                        {isFtpSelected && 'Connect FTP'}
                        {isSftpSelected && 'Connect SFTP'}
                        {isTelegramSelected && 'Connect Telegram'}
                        {!isCredentialsSelected && 'Connect Storage'}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">
                        {isFtpSelected && 'Enter your FTP server credentials to test and link the connection'}
                        {isSftpSelected && 'Enter your SFTP server credentials to test and link the connection'}
                        {isTelegramSelected && 'Connect your Telegram account to store files in Saved Messages'}
                        {!isCredentialsSelected && 'Select a cloud storage provider to link your account'}
                    </p>
                </div>

                {isFtpSelected && (
                    <FtpConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                )}

                {isSftpSelected && (
                    <SftpConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                )}

                {isTelegramSelected && (
                    <TelegramConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                )}

                {!isCredentialsSelected && (
                    <div className="space-y-3">
                        {providers.map((provider) => (
                            <ProviderOption
                                key={provider.key}
                                provider={provider}
                                onSelectCredentialsProvider={
                                    setSelectedCredentialsProvider
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/HomeController.php resources/js/components/cloud/ConnectStorageModal.tsx
git commit -m "feat(telegram): add Telegram to modal and backend authType"
```

---

### Task 3: Create TelegramConnectionController

**Files:**
- Create: `app/Http/Controllers/TelegramConnectionController.php`

- [ ] **Step 1: Create controller**

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Services\Telegram\TelegramClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use RuntimeException;

class TelegramConnectionController extends Controller
{
    private function telegramClient(string $sessionId): TelegramClient
    {
        return new TelegramClient(
            url: (string) config('services.telegram-storage.url'),
            token: (string) config('services.telegram-storage.token'),
            sessionId: $sessionId,
        );
    }

    public function requestCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $sessionId = Str::random(16);
        $client = $this->telegramClient($sessionId);

        try {
            $phoneCodeHash = $client->sendCodeRequest($validated['phone']);
        } catch (RuntimeException $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Could not send code to your Telegram. Please check the phone number.',
            ], 422);
        }

        Session::put('telegram_connect', [
            'session_id' => $sessionId,
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'phone_code_hash' => $phoneCodeHash,
        ]);

        return response()->json(['success' => true]);
    }

    public function store(Request $request): JsonResponse
    {
        $connect = Session::get('telegram_connect');

        if (! is_array($connect) || ! isset($connect['session_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Session expired. Please start over.',
            ], 422);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10'],
            'password' => ['nullable', 'string', 'max:256'],
        ]);

        $client = $this->telegramClient($connect['session_id']);

        $result = $client->login(
            phone: $connect['phone'],
            code: $validated['code'],
            phoneCodeHash: $connect['phone_code_hash'] ?? null,
            password: $validated['password'] ?? null,
        );

        if ($result['password_required'] ?? false) {
            return response()->json([
                'password_required' => true,
                'message' => $result['message'] ?? 'Two-factor authentication required.',
            ]);
        }

        if (! ($result['success'] ?? false)) {
            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? 'Login failed. Please try again.',
            ], 422);
        }

        $connection = $request->user()->cloudConnections()->create([
            'name' => $connect['name'],
            'provider' => CloudProvider::TELEGRAM(),
            'provider_id' => $connect['session_id'],
            'credentials' => ['session_id' => $connect['session_id']],
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        $synced = $result['synced'] ?? 0;

        Session::forget('telegram_connect');

        return response()->json([
            'success' => true,
            'connection_id' => $connection->id,
            'synced' => $synced,
        ]);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/TelegramConnectionController.php
git commit -m "feat(telegram): add TelegramConnectionController"
```

---

### Task 4: Add sendCodeRequest and login to TelegramClient

**Files:**
- Modify: `app/Services/Telegram/TelegramClient.php`

The current `TelegramClient` has `upload`, `download`, `delete`, etc. but no auth methods. Add them.

- [ ] **Step 1: Add auth methods to TelegramClient**

Add after the `sync()` method in `TelegramClient.php`:

```php
    /**
     * @return string phone_code_hash
     */
    public function sendCodeRequest(string $phone): string
    {
        $response = $this->request()
            ->asJson()
            ->post($this->url.'/request-code', ['phone' => $phone]);

        $this->assertAuthenticated($response);
        $response->throw();

        $data = $response->json();

        if (! is_array($data) || ! isset($data['phone_code_hash'])) {
            throw new RuntimeException('Microservice did not return a phone code hash.');
        }

        return (string) $data['phone_code_hash'];
    }

    /**
     * @return array{success: bool, password_required: bool, message: string, synced: int}
     */
    public function login(string $phone, string $code, ?string $phoneCodeHash = null, ?string $password = null): array
    {
        $payload = [
            'phone' => $phone,
            'code' => $code,
        ];

        if ($phoneCodeHash !== null) {
            $payload['phone_code_hash'] = $phoneCodeHash;
        }

        if ($password !== null) {
            $payload['password'] = $password;
        }

        $response = $this->request()
            ->asJson()
            ->post($this->url.'/login', $payload);

        $this->assertAuthenticated($response);
        $response->throw();

        $data = $response->json();

        if (! is_array($data)) {
            return [
                'success' => false,
                'password_required' => false,
                'message' => 'Unexpected response from microservice.',
                'synced' => 0,
            ];
        }

        return [
            'success' => (bool) ($data['success'] ?? false),
            'password_required' => (bool) ($data['password_required'] ?? false),
            'message' => (string) ($data['message'] ?? ''),
            'synced' => (int) ($data['synced'] ?? 0),
        ];
    }
```

- [ ] **Step 2: Commit**

```bash
git add app/Services/Telegram/TelegramClient.php
git commit -m "feat(telegram): add sendCodeRequest and login to TelegramClient"
```

---

### Task 5: Register routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add Telegram routes**

Add after the SFTP routes:

```php
Route::post('/connections/telegram/request-code', [TelegramConnectionController::class, 'requestCode'])->name('connections.telegram.request-code');
Route::post('/connections/telegram', [TelegramConnectionController::class, 'store'])->name('connections.telegram.store');
```

Also add the import at the top:

```php
use App\Http\Controllers\TelegramConnectionController;
```

- [ ] **Step 2: Commit**

```bash
git add routes/web.php
git commit -m "feat(telegram): add Telegram connection routes"
```

---

### Task 6: Create TelegramConnectionForm

**Files:**
- Create: `resources/js/components/cloud/TelegramConnectionForm.tsx`

- [ ] **Step 1: Create component**

```tsx
import { useState, type FormEvent } from 'react';
import { router } from '@inertiajs/react';

interface TelegramConnectionFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}

export default function TelegramConnectionForm({
    onCancel,
    onSuccess,
}: TelegramConnectionFormProps) {
    const [step, setStep] = useState<'phone' | 'code' | 'password' | 'done'>('phone');
    const [name, setName] = useState('My Telegram');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncedCount, setSyncedCount] = useState(0);

    const sendCode = (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        fetch('/connections/telegram/request-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ name, phone }),
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.message ?? 'Failed to send code');
                }
                return data;
            })
            .then(() => setStep('code'))
            .catch((err) => setError(err.message ?? 'An error occurred'))
            .finally(() => setLoading(false));
    };

    const verifyCode = (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        fetch('/connections/telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ code, password: password || undefined }),
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (data.password_required) {
                        setStep('password');
                        return data;
                    }
                    throw new Error(data.message ?? 'Verification failed');
                }
                return data;
            })
            .then((data) => {
                if (data?.success) {
                    setSyncedCount(data.synced ?? 0);
                    setStep('done');
                }
            })
            .catch((err) => {
                if (err.message) {
                    setError(err.message);
                }
            })
            .finally(() => setLoading(false));
    };

    const verifyPassword = (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        fetch('/connections/telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ code, password }),
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.message ?? 'Password verification failed');
                }
                return data;
            })
            .then((data) => {
                if (data?.success) {
                    setSyncedCount(data.synced ?? 0);
                    setStep('done');
                }
            })
            .catch((err) => setError(err.message ?? 'An error occurred'))
            .finally(() => setLoading(false));
    };

    const stepIndicator = (current: number, active: number, error: boolean = false) => (
        <div
            className={`flex-1 h-1 rounded-full transition-colors ${
                error ? 'bg-amber-500' : current < active ? 'bg-blue-600' : current === active ? (error ? 'bg-amber-500' : 'bg-blue-600') : 'bg-gray-200'
            }`}
        />
    );

    if (step === 'done') {
        return (
            <div className="space-y-6 text-center py-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div>
                    <h4 className="text-lg font-bold text-gray-900">Telegram Connected!</h4>
                    <p className="mt-1 text-sm text-gray-500">
                        "{name}" is ready to use.
                        {syncedCount > 0 && (
                            <span className="block mt-1">{syncedCount} files synced from Saved Messages.</span>
                        )}
                    </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onSuccess}
                        className="rounded-md bg-blue-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Step indicator */}
            <div className="flex gap-2">
                {stepIndicator(1, step === 'phone' ? 1 : step === 'done' ? 3 : 2)}
                {stepIndicator(2, step === 'code' || step === 'password' ? 2 : step === 'done' ? 3 : 1, step === 'password')}
                {stepIndicator(3, step === 'done' ? 3 : 2)}
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Step 1: Phone */}
            {step === 'phone' && (
                <form onSubmit={sendCode} className="space-y-4">
                    <div>
                        <label htmlFor="tg-name" className="text-xs font-bold text-gray-600">
                            Connection Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputClassName}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="tg-phone" className="text-xs font-bold text-gray-600">
                            Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={inputClassName}
                            placeholder="+84 912 345 678"
                        />
                        <p className="mt-1 text-[11px] text-gray-400">Use international format with country code</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'Sending code...' : 'Send Code →'}
                        </button>
                    </div>
                </form>
            )}

            {/* Step 2: Code */}
            {step === 'code' && (
                <form onSubmit={verifyCode} className="space-y-4">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        💬 Code sent to your Telegram app. Enter it below.
                    </div>
                    <div>
                        <label htmlFor="tg-phone-display" className="text-xs font-bold text-gray-600">
                            Phone Number
                        </label>
                        <div id="tg-phone-display" className="h-10 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-500 flex items-center">
                            {phone}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="tg-code" className="text-xs font-bold text-gray-600">
                            Verification Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className={`${inputClassName} font-mono text-lg tracking-widest`}
                            placeholder="12345"
                            autoFocus
                            inputMode="numeric"
                        />
                    </div>
                    <div className="flex justify-between gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setStep('phone')}
                            disabled={loading}
                            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                        >
                            ← Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading || code.length < 3}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </form>
            )}

            {/* Step 2b: Password (2FA) */}
            {step === 'password' && (
                <form onSubmit={verifyPassword} className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        🔒 Your Telegram account has two-factor authentication enabled. Enter your 2FA password.
                    </div>
                    <div>
                        <label htmlFor="tg-password" className="text-xs font-bold text-gray-600">
                            2FA Password <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputClassName}
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-between gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setStep('code')}
                            disabled={loading}
                            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                        >
                            ← Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

const inputClassName =
    'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/cloud/TelegramConnectionForm.tsx
git commit -m "feat(telegram): add TelegramConnectionForm wizard"
```

---

### Task 7: Create TelegramConnectionControllerTest

**Files:**
- Create: `tests/Feature/TelegramConnectionControllerTest.php`

- [ ] **Step 1: Write failing test**

```php
<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;

uses(RefreshDatabase::class);

function telegramUser(): User
{
    return User::factory()->create();
}

beforeEach(function () {
    config(['services.telegram-storage.url' => 'http://localhost:8000']);
    config(['services.telegram-storage.token' => 'test-token']);
});

it('validates name and phone on requestCode', function () {
    $user = telegramUser();

    $response = $this->actingAs($user)->postJson('/connections/telegram/request-code', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['name', 'phone']);
});

it('sends code request to microservice and stores session', function () {
    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/request-code' => Http::response([
            'success' => true,
            'phone_code_hash' => 'hash123',
        ]),
    ]);

    $user = telegramUser();

    $response = $this->actingAs($user)->postJson('/connections/telegram/request-code', [
        'name' => 'My Telegram',
        'phone' => '+84912345678',
    ]);

    $response->assertOk();
    $response->assertJson(['success' => true]);

    $session = session('telegram_connect');
    expect($session)->not()->toBeNull()
        ->and($session['session_id'])->toBeString()
        ->and($session['name'])->toBe('My Telegram')
        ->and($session['phone'])->toBe('+84912345678');
});

it('validates code on store', function () {
    $user = telegramUser();
    Session::put('telegram_connect', [
        'session_id' => 'sess123',
        'name' => 'My Telegram',
        'phone' => '+84912345678',
        'phone_code_hash' => 'hash123',
    ]);

    $response = $this->actingAs($user)->postJson('/connections/telegram', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['code']);
});

it('handles password_required response', function () {
    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/login' => Http::response([
            'success' => false,
            'password_required' => true,
            'message' => '2FA password required.',
        ]),
    ]);

    $user = telegramUser();
    Session::put('telegram_connect', [
        'session_id' => 'sess123',
        'name' => 'My Telegram',
        'phone' => '+84912345678',
        'phone_code_hash' => 'hash123',
    ]);

    $response = $this->actingAs($user)->postJson('/connections/telegram', [
        'code' => '12345',
    ]);

    $response->assertOk();
    $response->assertJson(['password_required' => true]);
});

it('creates CloudConnection on successful login', function () {
    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/login' => Http::response([
            'success' => true,
            'message' => 'Login successful',
            'synced' => 42,
        ]),
    ]);

    $user = telegramUser();
    Session::put('telegram_connect', [
        'session_id' => 'sess123',
        'name' => 'My Telegram',
        'phone' => '+84912345678',
        'phone_code_hash' => 'hash123',
    ]);

    $response = $this->actingAs($user)->postJson('/connections/telegram', [
        'code' => '12345',
    ]);

    $response->assertOk();
    $response->assertJson(['success' => true, 'synced' => 42]);

    $this->assertDatabaseHas('cloud_connections', [
        'name' => 'My Telegram',
        'provider' => CloudProvider::TELEGRAM,
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connection = $user->cloudConnections()->first();
    expect($connection->credentials)->toBe(['session_id' => 'sess123']);
    expect(Session::has('telegram_connect'))->toBeFalse();
});

it('rejects request with expired session', function () {
    $user = telegramUser();

    $response = $this->actingAs($user)->postJson('/connections/telegram', [
        'code' => '12345',
    ]);

    $response->assertStatus(422);
    $response->assertJson(['message' => 'Session expired. Please start over.']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact --filter=TelegramConnectionControllerTest`
Expected: FAIL — controller or routes not yet registered.

- [ ] **Step 3: After Tasks 3-5 are done, run tests to verify they pass**

Run: `php artisan test --compact --filter=TelegramConnectionControllerTest`
Expected: All PASS.

- [ ] **Step 4: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`

- [ ] **Step 5: Commit**

```bash
git add tests/Feature/TelegramConnectionControllerTest.php
git commit -m "feat(telegram): add TelegramConnectionController tests"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run all Telegram-related tests**

Run: `php artisan test --compact --filter=Telegram`
Expected: All PASS.

- [ ] **Step 2: Run full test suite**

Run: `php artisan test --compact`
Expected: All PASS.

- [ ] **Step 3: Run Pint**

Run: `vendor/bin/pint --dirty --format agent`
Expected: No changes needed.
