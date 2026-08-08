# Fix Audit Bảo Mật CloudX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 findings bảo mật (5 SSRF DNS rebinding/redirect + 1 size_limit_bypass) từ báo cáo audit 2026-08-09 bằng pin IP ở guard PHP + guard SSRF Python-side + verify part size ở complete().

**Architecture:** 3 task độc lập. Task 1: `HostAddressGuard` thêm `resolveAllowedIp()` trả IP đã pin, caller (remote upload job + FTP/SFTP/S3 connector) dùng IP đó làm host kết nối thực. Task 2: module `url_guard.py` mới trong telegram-client, áp vào `YtDlpService.get_metadata/download`. Task 3: `partDone` nhận `size`, `complete()` verify tổng ≤ max_file_size + mỗi part ≤ chunk_size.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia React 19, Redis queue; Python service (FastAPI/Telethon/yt-dlp) tại `telegram-client`.

**Spec:** `docs/superpowers/specs/2026-08-09-security-fix-design.md`

## Global Constraints

- PHP 8.4, Laravel 13, Pest 4, Inertia React 19 — bám style hiện có.
- Không đổi dependency app nếu chưa duyệt.
- Mọi thay đổi hành vi backend CloudX cần Pest (mới hoặc cập nhật).
- Sau sửa PHP: `vendor/bin/pint --dirty --format agent`.
- Credentials vẫn `encrypted:array`; không lộ `secret_payload`.
- Giữ guarantee bảo mật khác: path normalize, OAuth fail-closed, throttle share verify.
- Repo CloudX: `D:\Source\ponta\ponta-cloudx\cloudx`.
- Repo telegram-client: `D:\Source\ponta\ponta-cloudx\telegram-client` (5 file Python: `main.py`, `client.py`, `database.py`, `utils.py`, `ytdlp_service.py`).
- Trả lời/spec/plan: tiếng Việt; code/identifier/path giữ nguyên.
- Commit message: conventional prefix + mô tả tiếng Việt được phép.

## Bản đồ file

| File | Vai trò | Task |
|------|---------|------|
| `app/Services/CloudStorage/HostAddressGuard.php` | thêm `resolveAllowedIp()`, refactor `hostIsAllowed()` thành wrapper | 1 |
| `app/Services/CloudStorage/RemoteUploadUrlGuard.php` | thêm `resolveIpForUrl()`, `substituteHostWithIp()` | 1 |
| `app/Jobs/RemoteUploadCloudTaskFileJob.php` | `request()` dùng IP pin + Host header, `on_redirect` re-pin | 1 |
| `app/Http/Controllers/FtpConnectionController.php` | store/update lưu `resolved_ip` vào credentials | 1 |
| `app/Http/Controllers/SftpConnectionController.php` | store/update lưu `resolved_ip` vào credentials | 1 |
| `app/Http/Controllers/S3ConnectionController.php` | `assertEndpointHostAllowed` lưu `resolved_ip` | 1 |
| `app/Services/CloudStorage/Connectors/FtpConnector.php` | `diskConfig` ưu tiên `resolved_ip` | 1 |
| `app/Services/CloudStorage/Connectors/SftpConnector.php` | `diskConfig` ưu tiên `resolved_ip` | 1 |
| `app/Services/CloudStorage/S3/S3ConnectionConfig.php` | `diskOptions`/`clientOptions` rebuild endpoint = IP + Host header | 1 |
| `telegram-client/url_guard.py` | module mới block private/internal IP | 2 |
| `telegram-client/ytdlp_service.py` | gọi `assert_url_allowed` trước extract_info | 2 |
| `app/Http/Controllers/CloudUploadDirectCompleteController.php` | `partDone` nhận `size`, `complete()` verify | 3 |
| `resources/js/contexts/UploadManagerContext.tsx` | gửi `size` cho partDone | 3 |
| `tests/Unit/HostAddressGuardTest.php` | test `resolveAllowedIp` | 1 |
| `tests/Feature/RemoteUploadTaskTest.php` | test job dùng IP pin | 1 |
| `tests/Feature/S3DirectUploadTest.php` | test complete() reject part size | 3 |
| `tests/Feature/FtpConnectionTest.php` / `SftpConnectionTest.php` / `S3ConnectionTest.php` | verify resolved_ip lưu | 1 |

---

## Task 1: Pin IP cho `HostAddressGuard` + callers

**Files:**
- Modify: `app/Services/CloudStorage/HostAddressGuard.php:9-48`
- Modify: `app/Services/CloudStorage/RemoteUploadUrlGuard.php:11-28`
- Modify: `app/Jobs/RemoteUploadCloudTaskFileJob.php:290-305`
- Modify: `app/Http/Controllers/FtpConnectionController.php:29,67`
- Modify: `app/Http/Controllers/SftpConnectionController.php:29,67`
- Modify: `app/Http/Controllers/S3ConnectionController.php:87-102`
- Modify: `app/Services/CloudStorage/Connectors/FtpConnector.php:49-67`
- Modify: `app/Services/CloudStorage/Connectors/SftpConnector.php:49-64`
- Modify: `app/Services/CloudStorage/S3/S3ConnectionConfig.php:11-58`
- Test: `tests/Unit/HostAddressGuardTest.php`

**Interfaces:**
- Produces: `HostAddressGuard::resolveAllowedIp(string $host): ?string` (trả IP public hoặc null); `RemoteUploadUrlGuard::resolveIpForUrl(string $url): string` (throw ValidationException nếu private); `RemoteUploadUrlGuard::substituteHostWithIp(string $url, string $ip): string`.

- [ ] **Step 1: Viết test failing cho `resolveAllowedIp`**

Thêm vào cuối `tests/Unit/HostAddressGuardTest.php`:

```php
it('resolves allowed ip for public hosts and returns null for private', function () {
    $guard = app(HostAddressGuard::class);

    expect($guard->resolveAllowedIp('8.8.8.8'))->toBe('8.8.8.8')
        ->and($guard->resolveAllowedIp('1.1.1.1'))->toBe('1.1.1.1')
        ->and($guard->resolveAllowedIp('127.0.0.1'))->toBeNull()
        ->and($guard->resolveAllowedIp('10.0.0.5'))->toBeNull()
        ->and($guard->resolveAllowedIp('169.254.169.254'))->toBeNull()
        ->and($guard->resolveAllowedIp('100.64.1.1'))->toBeNull()
        ->and($guard->resolveAllowedIp(''))->toBeNull();
});

it('keeps hostIsAllowed as wrapper of resolveAllowedIp', function () {
    $guard = app(HostAddressGuard::class);

    expect($guard->hostIsAllowed('8.8.8.8'))->toBeTrue()
        ->and($guard->hostIsAllowed('127.0.0.1'))->toBeFalse();
});
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `php artisan test --compact --filter=resolveAllowedIp`
Expected: FAIL — method `resolveAllowedIp` không tồn tại.

- [ ] **Step 3: Implement `resolveAllowedIp` + refactor `hostIsAllowed`**

Trong `app/Services/CloudStorage/HostAddressGuard.php`, thay method `hostIsAllowed` (dòng 9-28) và thêm method mới ngay sau nó:

```php
public function hostIsAllowed(string $host): bool
{
    return $this->resolveAllowedIp($host) !== null;
}

public function resolveAllowedIp(string $host): ?string
{
    if ($host === '') {
        return null;
    }

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return $this->isPublicIp($host) ? $host : null;
    }

    $records = dns_get_record($host, DNS_A + DNS_AAAA);

    if ($records === false || $records === []) {
        $address = gethostbyname($host);

        return $address !== $host && $this->isPublicIp($address) ? $address : null;
    }

    foreach ($records as $record) {
        $address = $record['ip'] ?? $record['ipv6'] ?? null;

        if (is_string($address) && $this->isPublicIp($address)) {
            return $address;
        }
    }

    return null;
}
```

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `php artisan test --compact --filter=resolveAllowedIp`
Expected: PASS.

- [ ] **Step 5: Viết test failing cho `RemoteUploadUrlGuard::resolveIpForUrl`**

Tạo `tests/Unit/RemoteUploadUrlGuardTest.php`:

```php
<?php

use App\Services\CloudStorage\HostAddressGuard;
use App\Services\CloudStorage\RemoteUploadUrlGuard;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

it('resolves pinned ip for public url', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $hostGuard->shouldReceive('resolveAllowedIp')->with('example.com')->andReturn('1.2.3.4');
    $guard = new RemoteUploadUrlGuard($hostGuard);

    expect($guard->resolveIpForUrl('https://example.com/path'))->toBe('1.2.3.4');
});

it('throws for private url when no ip resolved', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $hostGuard->shouldReceive('resolveAllowedIp')->with('10.0.0.5')->andReturnNull();
    $guard = new RemoteUploadUrlGuard($hostGuard);

    $guard->resolveIpForUrl('http://10.0.0.5/secret');
})->throws(ValidationException::class);

it('substitutes host with pinned ip keeping path and query', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $guard = new RemoteUploadUrlGuard($hostGuard);

    $pinned = $guard->substituteHostWithIp('https://example.com/path?q=1', '1.2.3.4');

    expect($pinned)->toBe('https://1.2.3.4/path?q=1');
});
```

- [ ] **Step 6: Chạy test xác nhận fail**

Run: `php artisan test --compact --filter=RemoteUploadUrlGuardTest`
Expected: FAIL — method không tồn tại.

- [ ] **Step 7: Implement `resolveIpForUrl` + `substituteHostWithIp` trong `RemoteUploadUrlGuard`**

Thay toàn bộ nội dung `app/Services/CloudStorage/RemoteUploadUrlGuard.php`:

```php
<?php

namespace App\Services\CloudStorage;

use Illuminate\Validation\ValidationException;

class RemoteUploadUrlGuard
{
    public function __construct(private HostAddressGuard $hostAddressGuard) {}

    public function validate(string $url, string $field = 'url'): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must be a valid HTTP or HTTPS URL.',
            ]);
        }

        if (! $this->hostAddressGuard->hostIsAllowed($host)) {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must resolve to a public address.',
            ]);
        }
    }

    public function resolveIpForUrl(string $url, string $field = 'url'): string
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must be a valid HTTP or HTTPS URL.',
            ]);
        }

        $ip = $this->hostAddressGuard->resolveAllowedIp($host);

        if ($ip === null) {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must resolve to a public address.',
            ]);
        }

        return $ip;
    }

    public function substituteHostWithIp(string $url, string $ip): string
    {
        $parts = parse_url($url);
        $scheme = (string) ($parts['scheme'] ?? 'https');
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = (string) ($parts['path'] ?? '');
        $query = isset($parts['query']) ? '?'.$parts['query'] : '';
        $fragment = isset($parts['fragment']) ? '#'.$parts['fragment'] : '';

        return $scheme.'://'.$ip.$port.$path.$query.$fragment;
    }
}
```

- [ ] **Step 8: Chạy test xác nhận pass**

Run: `php artisan test --compact --filter=RemoteUploadUrlGuardTest`
Expected: PASS.

- [ ] **Step 9: Sửa `RemoteUploadCloudTaskFileJob::request()` dùng IP pin**

Trong `app/Jobs/RemoteUploadCloudTaskFileJob.php`, thay method `request` (dòng 290-305) — thêm tham số `$pinnedIp` và `$originalHost`, dựng URL pin + Host header:

```php
/**
 * @param  array<string, string>  $headers
 */
private function request(array $headers, RemoteUploadUrlGuard $urlGuard, string $url, ?string $pinnedIp = null): PendingRequest
{
    $requestHeaders = $headers;

    if ($pinnedIp !== null) {
        $originalHost = (string) (parse_url($url, PHP_URL_HOST) ?? '');
        $pinnedUrl = $urlGuard->substituteHostWithIp($url, $pinnedIp);

        if ($originalHost !== '') {
            $requestHeaders['Host'] = $originalHost;
        }
    } else {
        $pinnedUrl = $url;
    }

    $pinnedIpForRedirect = $pinnedIp;

    return Http::withHeaders($requestHeaders)
        ->connectTimeout((int) config('cloud-storage.remote_upload.connect_timeout', 10))
        ->timeout((int) config('cloud-storage.remote_upload.timeout', 1200))
        ->retry([1000, 5000, 10000], 0, fn (Throwable $exception): bool => $exception instanceof ConnectionException
            || ($exception instanceof RequestException && $exception->response->serverError()))
        ->withOptions([
            'allow_redirects' => [
                'max' => (int) config('cloud-storage.remote_upload.max_redirects', 3),
                'on_redirect' => function ($request, $response, $uri) use ($urlGuard, &$pinnedIpForRedirect): void {
                    $redirectUrl = (string) $uri;
                    $urlGuard->resolveIpForUrl($redirectUrl);
                    $pinnedIpForRedirect = $urlGuard->resolveIpForUrl($redirectUrl);
                },
            ],
        ]);
}
```

Lưu ý: `on_redirect` re-resolve IP cho redirect target. Vì Guzzle `on_redirect` không cho phép thay đổi URL request đã gửi, việc pin IP cho redirect target thực hiện bằng cách reject nếu redirect target resolve private (đã qua `resolveIpForUrl` throw). Pin IP đầy đủ cho redirect cần hook sâu hơn Guzzle — chấp nhận re-validate (chặn private redirect) là đủ cho đợt này, note trong commit.

- [ ] **Step 10: Cập nhật caller của `request()` để truyền IP pin**

Trong `app/Jobs/RemoteUploadCloudTaskFileJob.php`, sửa `processRemoteUpload` (dòng 132-141) — resolve IP pin một lần rồi truyền cho cả HEAD và GET:

Tìm đoạn:
```php
        $urlGuard->validate($url);

        $targetPath = $task->connection?->provider === CloudProvider::TELEGRAM
            ? $filename
            : (trim($task->target_path, '/') === '' ? $filename : trim($task->target_path, '/').'/'.$filename);
        $tempPath = $this->tempPath($task);
        $absoluteTempPath = $this->absoluteTempPath($tempPath);

        $this->ensureRemoteFileIsAllowed($url, $headers, $urlGuard);
        $this->downloadRemoteFile($task, $url, $headers, $absoluteTempPath, $urlGuard);
```

Thay bằng:
```php
        $urlGuard->validate($url);
        $pinnedIp = $urlGuard->resolveIpForUrl($url);

        $targetPath = $task->connection?->provider === CloudProvider::TELEGRAM
            ? $filename
            : (trim($task->target_path, '/') === '' ? $filename : trim($task->target_path, '/').'/'.$filename);
        $tempPath = $this->tempPath($task);
        $absoluteTempPath = $this->absoluteTempPath($tempPath);

        $this->ensureRemoteFileIsAllowed($url, $headers, $urlGuard, $pinnedIp);
        $this->downloadRemoteFile($task, $url, $headers, $absoluteTempPath, $urlGuard, $pinnedIp);
```

Sửa `ensureRemoteFileIsAllowed` (dòng 225-239) — thêm tham số `?string $pinnedIp` và truyền cho `request`:

```php
/**
 * @param  array<string, string>  $headers
 */
private function ensureRemoteFileIsAllowed(string $url, array $headers, RemoteUploadUrlGuard $urlGuard, ?string $pinnedIp = null): void
{
    $response = $this->request($headers, $urlGuard, $url, $pinnedIp)
        ->head($urlGuard->substituteHostWithIp($url, $pinnedIp ?? ''));

    if ($response->failed() && ! in_array($response->status(), [405, 501], true)) {
        $response->throw();
    }

    $contentLength = (int) $response->header('Content-Length');

    if ($contentLength > $this->maxFileSize()) {
        throw new CloudUploadException(self::REMOTE_FILE_TOO_LARGE);
    }
}
```

Sửa `downloadRemoteFile` (dòng 244-285) — thêm tham số `?string $pinnedIp`, thay `$this->request($headers, $urlGuard)->...->get($url)` bằng URL pin:

Tìm dòng:
```php
        $response = $this->request($headers, $urlGuard)
            ->withOptions([
```
Thay bằng:
```php
        $pinnedUrl = $pinnedIp !== null ? $urlGuard->substituteHostWithIp($url, $pinnedIp) : $url;

        $response = $this->request($headers, $urlGuard, $url, $pinnedIp)
            ->withOptions([
```
Và ở cuối method, dòng `->get($url)` thay bằng `->get($pinnedUrl)`.

- [ ] **Step 11: Chạy test remote upload hiện có để verify không vỡ**

Run: `php artisan test --compact --filter=RemoteUploadTaskTest`
Expected: PASS (test hiện có mock Guzzle, cần verify chúng vẫn pass; nếu vỡ do thay đổi signature `request()`, cập nhật mock).

- [ ] **Step 12: Lưu `resolved_ip` vào credentials khi store/update FTP**

Trong `app/Http/Controllers/FtpConnectionController.php`, `credentialsFromValidated` (dòng 92-111) là nơi build `$credentials`. Thêm tham số `$resolvedIp` vào method và thêm key vào mảng.

Đổi signature (dòng 92):
```php
    private function credentialsFromValidated(array $validated, array $existingCredentials = [], ?string $resolvedIp = null): array
```

Trong mảng `$credentials` (sau dòng 95 `'host' => $validated['host'],`), thêm:
```php
            'resolved_ip' => $resolvedIp,
```

Trong `store` (dòng 28-30), đổi:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated);
```
thành:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $resolvedIp = $this->hostAddressGuard->resolveAllowedIp((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated, [], $resolvedIp);
```

Trong `update` (dòng 66-68), đổi:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials);
```
thành:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $resolvedIp = $this->hostAddressGuard->resolveAllowedIp((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials, $resolvedIp);
```

Lưu ý `hostIsAllowedForConnections` có allowlist `nas.local` — nếu host trong allowlist thì `resolveAllowedIp` trả null (vì private) → `resolved_ip` = null, `diskConfig` fallback về `host` gốc (hành vi cũ, tin tưởng allowlist). `array_filter` với `!== null` giữ null ra khỏi mảng nếu null — vậy khi allowlist, key `resolved_ip` không được lưu (fallback host gốc).

- [ ] **Step 13: Lưu `resolved_ip` vào credentials khi store/update SFTP**

Trong `app/Http/Controllers/SftpConnectionController.php`, `credentialsFromValidated` (dòng 92-110) build mảng qua `array_filter([...], ...)`. Thêm tham số `$resolvedIp` vào method và thêm key vào mảng trả về.

Đổi signature (dòng 92):
```php
    private function credentialsFromValidated(array $validated, array $existingCredentials = [], ?string $resolvedIp = null): array
```

Trong mảng `array_filter` (sau dòng 99 `'host' => $validated['host'],`), thêm:
```php
            'resolved_ip' => $resolvedIp,
```

Trong `store` (dòng 28-30), đổi:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated);
```
thành:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $resolvedIp = $this->hostAddressGuard->resolveAllowedIp((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated, [], $resolvedIp);
```

Trong `update` (dòng 66-68), đổi:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials);
```
thành:
```php
        $validated = $request->validated();
        $this->hostAddressGuard->assertConnectionHostAllowed((string) $validated['host']);
        $resolvedIp = $this->hostAddressGuard->resolveAllowedIp((string) $validated['host']);
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials, $resolvedIp);
```

- [ ] **Step 14: Lưu `resolved_ip` cho S3 endpoint**

Trong `app/Http/Controllers/S3ConnectionController.php`, sửa `assertEndpointHostAllowed` (dòng 87-102) — resolve IP và trả về để caller lưu vào credentials. Đổi thành:

```php
private function assertEndpointHostAllowed(mixed $endpoint): ?string
{
    if (! is_string($endpoint) || trim($endpoint) === '') {
        return null;
    }

    $host = parse_url($endpoint, PHP_URL_HOST);

    if (! is_string($host) || $host === '') {
        throw ValidationException::withMessages([
            'endpoint' => 'S3 endpoint must include a valid host.',
        ]);
    }

    $this->hostAddressGuard->assertConnectionHostAllowed($host, 'endpoint');

    return $this->hostAddressGuard->resolveAllowedIp($host);
}
```

Trong `store` (dòng 29) đổi:
```php
        $this->assertEndpointHostAllowed($validated['endpoint'] ?? null);
```
thành:
```php
        $resolvedIp = $this->assertEndpointHostAllowed($validated['endpoint'] ?? null);
```
Và dòng 30 `$credentials = $this->credentialsFromValidated($validated);` thành `$credentials = $this->credentialsFromValidated($validated, [], $resolvedIp);`.

Trong `update` (dòng 67) đổi:
```php
        $this->assertEndpointHostAllowed($validated['endpoint'] ?? null);
```
thành:
```php
        $resolvedIp = $this->assertEndpointHostAllowed($validated['endpoint'] ?? null);
```
Và dòng 68 `$credentials = $this->credentialsFromValidated($validated, $connection->credentials);` thành `$credentials = $this->credentialsFromValidated($validated, $connection->credentials, $resolvedIp);`.

Đổi signature `credentialsFromValidated` (dòng 109):
```php
    private function credentialsFromValidated(array $validated, array $existingCredentials = [], ?string $resolvedIp = null): array
```
Trong mảng trả về (sau dòng 119 `'endpoint' => $validated['endpoint'] ?? null,`), thêm:
```php
            'resolved_ip' => $resolvedIp,
```

- [ ] **Step 15: `FtpConnector::diskConfig` ưu tiên `resolved_ip`**

Trong `app/Services/CloudStorage/Connectors/FtpConnector.php` (dòng 49-67), đổi key `host`:

```php
public function diskConfig(array $credentials): array
{
    return array_filter([
        'driver' => 'ftp',
        'host' => $credentials['resolved_ip'] ?? $credentials['host'] ?? null,
        'username' => $credentials['username'] ?? null,
        'password' => $credentials['password'] ?? null,
        'port' => $credentials['port'] ?? 21,
        'root' => $credentials['root'] ?? '',
        'passive' => $credentials['passive'] ?? true,
        'ssl' => $credentials['ssl'] ?? false,
        'timeout' => $credentials['timeout'] ?? 30,
        'utf8' => $credentials['utf8'] ?? false,
        'ignorePassiveAddress' => $credentials['ignore_passive_address'] ?? null,
        'systemType' => $credentials['system_type'] ?? null,
        'recurseManually' => $credentials['recurse_manually'] ?? true,
        'timestampsOnUnixListingsEnabled' => $credentials['timestamps_on_unix_listings_enabled'] ?? false,
    ], static fn (mixed $value): bool => $value !== null);
}
```

- [ ] **Step 16: `SftpConnector::diskConfig` ưu tiên `resolved_ip`**

Trong `app/Services/CloudStorage/Connectors/SftpConnector.php` (dòng 49-64), đổi key `host`:

```php
public function diskConfig(array $credentials): array
{
    return array_filter([
        'driver' => 'sftp',
        'host' => $credentials['resolved_ip'] ?? $credentials['host'] ?? null,
        'username' => $credentials['username'] ?? null,
        'password' => $credentials['password'] ?? null,
        'privateKey' => $credentials['privateKey'] ?? null,
        'passphrase' => $credentials['passphrase'] ?? null,
        'port' => (int) ($credentials['port'] ?? 22),
        'root' => empty($credentials['root']) ? '/' : $credentials['root'],
        'timeout' => (int) ($credentials['timeout'] ?? 30),
        'useAgent' => (bool) ($credentials['useAgent'] ?? false),
        'hostFingerprint' => $credentials['hostFingerprint'] ?? null,
    ], static fn (mixed $value): bool => $value !== null);
}
```

- [ ] **Step 17: `S3ConnectionConfig` rebuild endpoint = IP + Host header**

Trong `app/Services/CloudStorage/S3/S3ConnectionConfig.php`, thêm helper rebuild endpoint và áp dụng cho cả `diskOptions` + `clientOptions`. Thêm method private:

```php
private function pinnedEndpoint(array $credentials): ?string
{
    $resolvedIp = $credentials['resolved_ip'] ?? null;

    if (! is_string($resolvedIp) || $resolvedIp === '') {
        return null;
    }

    $endpoint = $credentials['endpoint'] ?? $this->defaultEndpointForPreset((string) ($credentials['provider_preset'] ?? 'aws'));
    $scheme = is_string($endpoint) && str_starts_with($endpoint, 'http://') ? 'http' : 'https';

    return $scheme.'://'.$resolvedIp;
}
```

Trong `diskOptions` (dòng 11-33) và `clientOptions` (dòng 39-58), đổi dòng `'endpoint' => $endpoint,` thành:

```php
'endpoint' => $this->pinnedEndpoint($credentials) ?? $endpoint,
```

Cho S3 virtual-host routing đúng khi host = IP, cần thêm `Host` header. AWS SDK v3 Laravel Flysystem không expose Host header trực tiếp qua `Storage::build` — note: nếu S3 path-style endpoint đã bật (`use_path_style_endpoint`), routing dùng path thay vì host nên không cần Host header. Khuyến nghị đảm bảo connection S3 có `use_path_style_endpoint = true` khi dùng IP pin (đã có preset minio/r2/rustfs). Test thật với S3 thực ở Step 22.

- [ ] **Step 18: Viết test verify `resolved_ip` lưu cho FTP/SFTP/S3**

Trong `tests/Feature/FtpConnectionTest.php`, thêm test (mock `resolveAllowedIp` trả IP cố định vì DNS không deterministic trong test):

```php
it('stores resolved ip in credentials when creating ftp connection', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $hostGuard->shouldReceive('assertConnectionHostAllowed')->andReturnNull();
    $hostGuard->shouldReceive('hostIsAllowedForConnections')->andReturn(true);
    $hostGuard->shouldReceive('resolveAllowedIp')->with('ftp.example.com')->andReturn('1.2.3.4');
    $this->app->instance(HostAddressGuard::class, $hostGuard);

    $user = User::factory()->create();
    $response = $this->actingAs($user)->postJson(route('connections.ftp.store'), [
        'name' => 'ftp-test',
        'host' => 'ftp.example.com',
        'username' => 'user',
        'password' => 'pass',
    ]);

    $response->assertRedirect();
    $connection = CloudConnection::query()->where('user_id', $user->id)->sole();
    expect($connection->credentials['resolved_ip'] ?? null)->toBe('1.2.3.4');
});
```

Lặp pattern tương tự cho `tests/Feature/SftpConnectionTest.php` (route `connections.sftp.store`) và `tests/Feature/S3ConnectionTest.php` (route `connections.s3.store`, dùng field `endpoint` thay `host`). Đọc file test hiện có để lấy import (`HostAddressGuard`, `User`, `CloudConnection`) và factory setup chính xác.

- [ ] **Step 19: Chạy test verify resolved_ip**

Run: `php artisan test --compact --filter=resolved_ip`
Expected: PASS.

- [ ] **Step 20: Chạy toàn bộ test connection để verify không vỡ**

Run: `php artisan test --compact --filter=ConnectionTest`
Expected: PASS. Nếu test hiện có vỡ do mock guard cũ không có `resolveAllowedIp`, cập nhật mock.

- [ ] **Step 21: Chạy Pint format PHP**

Run: `vendor/bin/pint --dirty --format agent`
Expected: file PHP đã format đúng style.

- [ ] **Step 22: Test thủ công connection thật (manual, không tự động)**

Kiểm tra thủ công với FTP/SFTP/S3 thực (nếu có credential test):
- Tạo FTP/SFTP connection với host public → verify kết nối thành công, `resolved_ip` lưu.
- Tạo S3 connection với endpoint public → verify `listContents` thành công.
- Nếu không có credential test, note trong commit rằng test thủ công pending.

- [ ] **Step 23: Commit Task 1**

```bash
cd "D:/Source/ponta/ponta-cloudx/cloudx"
git add app/Services/CloudStorage/HostAddressGuard.php app/Services/CloudStorage/RemoteUploadUrlGuard.php app/Jobs/RemoteUploadCloudTaskFileJob.php app/Http/Controllers/FtpConnectionController.php app/Http/Controllers/SftpConnectionController.php app/Http/Controllers/S3ConnectionController.php app/Services/CloudStorage/Connectors/FtpConnector.php app/Services/CloudStorage/Connectors/SftpConnector.php app/Services/CloudStorage/S3/S3ConnectionConfig.php tests/Unit/HostAddressGuardTest.php tests/Unit/RemoteUploadUrlGuardTest.php tests/Feature/FtpConnectionTest.php tests/Feature/SftpConnectionTest.php tests/Feature/S3ConnectionTest.php
git commit -m "fix(security): pin IP trong HostAddressGuard chống DNS rebinding SSRF

HostAddressGuard.resolveAllowedIp trả IP đã validate; remote upload job +
FTP/SFTP/S3 connector dùng IP đó làm host kết nối thực. Fix F2-001 + F3-001.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Guard SSRF Python-side (telegram-client)

**Files:**
- Create: `telegram-client/url_guard.py`
- Modify: `telegram-client/ytdlp_service.py:181,242`
- Test: thủ công (không pytest theo quyết định)

**Interfaces:**
- Produces: `assert_url_allowed(url: str) -> None` (raise `ValueError` nếu host resolve private/internal/metadata).

- [ ] **Step 1: Tạo module `telegram-client/url_guard.py`**

Tạo file `telegram-client/url_guard.py` với nội dung:

```python
import ipaddress
import socket
from urllib.parse import urlparse

BLOCKED_MESSAGE = "URL host resolves to a blocked (private/internal/metadata) address."


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_unspecified
        or ip.is_multicast
    )


def assert_url_allowed(url: str) -> None:
    """Reject URLs whose host is or resolves to a private/internal/metadata address."""
    parts = urlparse(url)
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise ValueError("URL scheme must be http or https")
    host = parts.hostname
    if not host:
        raise ValueError("URL must include a host")
    if _is_blocked_ip(host):
        raise ValueError(BLOCKED_MESSAGE)
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise ValueError(BLOCKED_MESSAGE)
    for info in infos:
        ip = info[4][0]
        if _is_blocked_ip(ip):
            raise ValueError(BLOCKED_MESSAGE)
```

- [ ] **Step 2: Áp `assert_url_allowed` vào `get_metadata`**

Trong `telegram-client/ytdlp_service.py`, thêm import ở đầu file (sau `from urllib.parse import urlparse` dòng 9):

```python
from url_guard import assert_url_allowed
```

Trong method `get_metadata` (dòng 181), ngay sau dòng `cookie_path = None` (dòng 182) và trước `ydl_opts = ...` (dòng 183), thêm:

```python
        assert_url_allowed(url)
```

- [ ] **Step 3: Áp `assert_url_allowed` vào `download`**

Trong method `download` (dòng 242), ngay sau dòng `cookie_path = None` (dòng 243) và trước dòng tạo `fd, temp_out = tempfile.mkstemp(...)` (dòng 246), thêm:

```python
        assert_url_allowed(url)
```

- [ ] **Step 4: Test thủ công — reject internal IP**

Khởi động service (cần `ACCESS_TOKEN` env). Gửi request:

```bash
curl -X POST http://localhost:8000/yt-dlp/metadata \
  -H "X-Token: $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'
```

Expected: HTTP 400, body `{"detail": "URL host resolves to a blocked (private/internal/metadata) address."}`.

- [ ] **Step 5: Test thủ công — reject loopback**

```bash
curl -X POST http://localhost:8000/yt-dlp/metadata \
  -H "X-Token: $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://127.0.0.1:6379/"}'
```

Expected: HTTP 400, same blocked message.

- [ ] **Step 6: Test thủ công — accept public URL**

```bash
curl -X POST http://localhost:8000/yt-dlp/metadata \
  -H "X-Token: $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Expected: HTTP 200, JSON metadata (title/formats). Verify không bị block.

- [ ] **Step 7: Commit Task 2**

```bash
cd "D:/Source/ponta/ponta-cloudx/telegram-client"
git add url_guard.py ytdlp_service.py
git commit -m "fix(security): guard SSRF chặn private/internal IP trong yt-dlp

Module url_guard.assert_url_allowed áp vào get_metadata/download, chặn
fetch tới 169.254.169.254/loopback/private. Fix F4-001 + F5-001 + F5-002.
Redirect-to-internal là residual risk (cần yt-dlp hook sâu hơn, follow-up).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Verify part size ở `complete()` + frontend gửi `size`

**Files:**
- Modify: `app/Http/Controllers/CloudUploadDirectCompleteController.php:25-89,91-144`
- Modify: `resources/js/contexts/UploadManagerContext.tsx:251-269`
- Test: `tests/Feature/S3DirectUploadTest.php`

**Interfaces:**
- Consumes: payload `size` (từ store) + `chunk_size` (từ store) trong `$payload`.
- Produces: `partDone` giờ yêu cầu body `{ etag: string, size: int }`; `complete()` reject nếu part `Size > chunk_size` hoặc tổng `Size > max_file_size`.

- [ ] **Step 1: Viết test failing — complete() reject part size vượt chunk_size**

Thêm vào `tests/Feature/S3DirectUploadTest.php`:

```php
it('rejects direct upload complete when a part exceeds chunk size', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
    ]);
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'payload' => [
            'filename' => 'big.pdf',
            'mime_type' => MIME_PDF,
            'size' => 1024,
            'chunk_size' => 1024,
            'total_chunks' => 1,
            'uploaded_chunks_count' => 0,
            'upload_mode' => 'direct',
            's3_multipart' => [
                'upload_id' => 'upload-id-1',
                'key' => 'documents/big.pdf',
                'parts' => [],
            ],
        ],
        'status' => CloudTaskStatus::Uploading,
    ]);

    $response = $this->actingAs($user)->postJson(
        route('connections.upload-tasks.direct.parts.done', [$connection, $task, 1]),
        ['etag' => 'etag-1', 'size' => 5368709120],
    );

    $response = $this->actingAs($user)->postJson(
        route('connections.upload-tasks.direct.complete', [$connection, $task]),
    );

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['task']);
});
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `php artisan test --compact --filter="exceeds chunk size"`
Expected: FAIL — test hiện pass vì `complete()` không check size (part 5GB được chấp nhận).

- [ ] **Step 3: `partDone` nhận `size` + lưu vào payload**

Trong `app/Http/Controllers/CloudUploadDirectCompleteController.php`, sửa `partDone` (dòng 25-89). Thay validation (dòng 30-32) và phần set `partsByNumber[$partNumber]` (dòng 62-65):

Validation:
```php
        $validated = $request->validate([
            'etag' => ['required', 'string', 'max:1024'],
            'size' => ['required', 'integer', 'min:1'],
        ]);
```

Set partsByNumber:
```php
            $partsByNumber[$partNumber] = [
                'ETag' => $validated['etag'],
                'PartNumber' => $partNumber,
                'Size' => (int) $validated['size'],
            ];
```

- [ ] **Step 4: `complete()` verify part size**

Trong `app/Http/Controllers/CloudUploadDirectCompleteController.php`, trong method `complete` (dòng 91-144), sau block verify part numbers (dòng 118-130) và trước `$lockedTask->forceFill(...)` (dòng 132), thêm:

```php
            $chunkSize = (int) ($payload['chunk_size'] ?? 0);
            $maxFileSize = (int) config('cloud-storage.uploads.max_file_size');

            $totalUploaded = array_sum(array_map(
                fn (array $part): int => (int) ($part['Size'] ?? 0),
                $parts,
            ));

            if ($totalUploaded > $maxFileSize) {
                throw ValidationException::withMessages([
                    'task' => 'Uploaded parts exceed the maximum allowed file size.',
                ]);
            }

            if ($chunkSize > 0) {
                foreach ($parts as $part) {
                    if ((int) ($part['Size'] ?? 0) > $chunkSize) {
                        throw ValidationException::withMessages([
                            'task' => 'Upload part exceeds the allowed chunk size.',
                        ]);
                    }
                }
            }
```

- [ ] **Step 5: Chạy test xác nhận pass**

Run: `php artisan test --compact --filter="exceeds chunk size"`
Expected: PASS.

- [ ] **Step 6: Viết test — complete() accept khi part size đúng**

Thêm vào `tests/Feature/S3DirectUploadTest.php`:

```php
it('accepts direct upload complete when parts match chunk size', function () {
    Queue::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
    ]);
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'payload' => [
            'filename' => 'ok.pdf',
            'mime_type' => MIME_PDF,
            'size' => 1024,
            'chunk_size' => 1024,
            'total_chunks' => 1,
            'uploaded_chunks_count' => 0,
            'upload_mode' => 'direct',
            's3_multipart' => [
                'upload_id' => 'upload-id-1',
                'key' => 'ok.pdf',
                'parts' => [],
            ],
        ],
        'status' => CloudTaskStatus::Uploading,
    ]);

    $this->actingAs($user)->postJson(
        route('connections.upload-tasks.direct.parts.done', [$connection, $task, 1]),
        ['etag' => 'etag-1', 'size' => 1024],
    );

    $response = $this->actingAs($user)->postJson(
        route('connections.upload-tasks.direct.complete', [$connection, $task]),
    );

    $response->assertOk();
});
```

- [ ] **Step 7: Chạy test xác nhận pass**

Run: `php artisan test --compact --filter="match chunk size"`
Expected: PASS.

- [ ] **Step 8: Cập nhật frontend gửi `size` cho partDone**

Trong `resources/js/contexts/UploadManagerContext.tsx`, sửa phần tính part size và gửi `size`. Đọc context quanh dòng 198-269 để thấy `index`, `chunkSize`, `file`. Phần slice (dòng 225-227) tính size part:

```typescript
                        body: file.slice(
                            index * chunkSize,
                            Math.min(file.size, (index + 1) * chunkSize),
                        ),
```

Trước `try` block (sau dòng `part = await requestJson` setup), tính size:

Thêm biến tính part size trước khi fetch PUT (sau dòng 221 `body: JSON.stringify({ part_number: partNumber }),` và trước `response = await fetch(part.url, {`). Đặt ngay trước `const controller = new AbortController();` (dòng 207):

```typescript
                const partSize = Math.min(file.size, (index + 1) * chunkSize) - index * chunkSize;
```

Sửa body partDone (dòng 266) từ:
```typescript
                            body: JSON.stringify({ etag }),
```
thành:
```typescript
                            body: JSON.stringify({ etag, size: partSize }),
```

- [ ] **Step 9: Chạy toàn bộ test S3 direct upload**

Run: `php artisan test --compact --filter=S3DirectUploadTest`
Expected: PASS tất cả.

- [ ] **Step 10: Chạy Pint format PHP**

Run: `vendor/bin/pint --dirty --format agent`
Expected: file PHP đã format.

- [ ] **Step 11: Build frontend verify TypeScript không lỗi**

Run: `pnpm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 12: Commit Task 3**

```bash
cd "D:/Source/ponta/ponta-cloudx/cloudx"
git add app/Http/Controllers/CloudUploadDirectCompleteController.php resources/js/contexts/UploadManagerContext.tsx tests/Feature/S3DirectUploadTest.php
git commit -m "fix(security): verify part size ở complete() chống bypass max_file_size

partDone nhận size, complete() verify tổng ≤ max_file_size + mỗi part ≤
chunk_size. Frontend gửi size của từng part. Fix F2-002.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Chạy toàn bộ test suite + verify cuối

- [ ] **Step 1: Chạy toàn bộ Pest test suite**

Run: `php artisan test --compact`
Expected: PASS toàn bộ. Nếu có test vỡ do thay đổi API guard (`resolveAllowedIp` mock), cập nhật mock/test đó.

- [ ] **Step 2: Chạy Pint dirty toàn bộ**

Run: `vendor/bin/pint --dirty --format agent`
Expected: không có thay đổi format.

- [ ] **Step 3: Build frontend lần cuối**

Run: `pnpm run build`
Expected: build thành công.

- [ ] **Step 4: Kiểm tra residual risk đã note**

Verify commit Task 1 và Task 2 đã note rõ:
- Task 1: pin IP cho redirect target chỉ re-validate (chặn private), pin IP đầy đủ cho redirect cần hook Guzzle sâu hơn.
- Task 2: redirect-to-internal là residual risk.

Nếu chưa note, thêm vào commit message hoặc báo cáo.

- [ ] **Step 5: Cập nhật báo cáo audit (optional)**

Trong `docs/audit/2026-08-09-security-perf-audit-report.md`, thêm phần "Trạng thái fix" ghi nhận 6 findings bảo mật đã fix (Task 1-3). Commit:

```bash
cd "D:/Source/ponta/ponta-cloudx/cloudx"
git add docs/audit/2026-08-09-security-perf-audit-report.md
git commit -m "docs: cập nhật trạng thái fix audit bảo mật

6 findings bảo mật đã fix (pin IP SSRF + part size verify).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
