# Video Downloader (yt-dlp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "Video Downloader" page where authenticated users paste a video URL, fetch metadata, pick a format, and stream the download from a Python microservice.

**Architecture:** Refactor `TelegramClient` into a `PythonServiceClient` base + subclass, register a new `YtDlpClient` subclass, add a `VideoDownloaderController` with three auth-protected routes (render page, fetch metadata JSON, proxy stream), and a single React page at `resources/js/pages/video-downloader/index.tsx`.

**Tech Stack:** Laravel 13, Inertia v3, React 19, Pest 4, Laravel HTTP client, Tailwind v4.

---

## File Structure

### New
- `app/Services/Python/PythonServiceClient.php` — generic HTTP wrapper for the Python microservice (token, timeouts, post/get helpers, assert helpers).
- `app/Services/Python/YtDlpClient.php` — extends `PythonServiceClient`. `fetchMetadata` and `downloadStream`.
- `app/Http/Controllers/VideoDownloaderController.php` — three methods: `index`, `metadata`, `download`.
- `resources/js/pages/video-downloader/index.tsx` — single page with URL + cookies form, metadata card, format picker, download button.
- `resources/js/types/video-downloader.ts` — `VideoFormat` and `VideoMetadata` types.
- `tests/Feature/VideoDownloaderControllerTest.php` — auth, validation, success, 502.
- `tests/Feature/Services/Python/PythonServiceClientTest.php` — base class behaviour with `Http::fake`.
- `tests/Feature/Services/Python/YtDlpClientTest.php` — `fetchMetadata` and `downloadStream` behaviour with `Http::fake`.

### Modified
- `app/Services/Telegram/TelegramClient.php` — `extends PythonServiceClient`; all methods delegate HTTP to the parent.
- `config/services.php` — replace `telegram-storage` with `python-service` (with backward-compat fallback to the old env keys).
- `routes/web.php` — three new auth-protected routes.
- `app/Providers/AppServiceProvider.php` — register `PythonServiceClient`, `TelegramClient`, `YtDlpClient` as singletons.
- `resources/js/layouts/AuthenticatedLayout.tsx` — add a "Video Downloader" link in the SYSTEM section.
- `.env.example` — replace `TELEGRAM_STORAGE_*` with `PYTHON_SERVICE_*` (new keys replace old).
- `tests/Feature/TelegramConnectionControllerTest.php` and `tests/Feature/TelegramAdapterTest.php` — only if the constructor change in `TelegramClient` breaks them; otherwise no change.

---

## Task 1: Add the `python-service` config block

**Files:**
- Modify: `config/services.php`

- [ ] **Step 1: Replace the `telegram-storage` block with `python-service`**

Open `config/services.php` and replace the `telegram-storage` block (lines 56-59):

```php
'telegram-storage' => [
    'url' => env('TELEGRAM_STORAGE_URL', 'http://localhost:8000'),
    'token' => env('TELEGRAM_STORAGE_TOKEN'),
],
```

with:

```php
'python-service' => [
    'url' => env('PYTHON_SERVICE_URL', env('TELEGRAM_STORAGE_URL', 'http://localhost:8000')),
    'token' => env('PYTHON_SERVICE_TOKEN', env('TELEGRAM_STORAGE_TOKEN')),
],
```

The inner `env(...)` calls keep the old env names as fallbacks so existing deployments keep working until they migrate.

- [ ] **Step 2: Verify config loads**

Run: `php artisan config:show services.python-service`
Expected: shows `url` and `token` with the values from the current environment (or `http://localhost:8000` if nothing is set).

- [ ] **Step 3: Commit**

```bash
git add config/services.php
git commit -m "refactor(services): rename telegram-storage to python-service"
```

---

## Task 2: Create `PythonServiceClient` base class

**Files:**
- Create: `app/Services/Python/PythonServiceClient.php`
- Test: `tests/Feature/Services/Python/PythonServiceClientTest.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Services/Python/PythonServiceClientTest.php` with:

```php
<?php

use App\Services\Python\PythonServiceClient;
use Illuminate\Support\Facades\Http;
use RuntimeException;

beforeEach(function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);
});

it('sends the X-Token header on every request', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['ok' => true]),
    ]);

    $client = new class('http://localhost:8000', 'test-token') extends PythonServiceClient {
        public function probe(): array
        {
            return $this->post('/probe', [])->json();
        }
    };

    expect($client->probe())->toBe(['ok' => true]);

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/probe'
            && $request->hasHeader('X-Token', 'test-token');
    });
});

it('throws on 403 auth failure', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['error' => 'forbidden'], 403),
    ]);

    $client = new class('http://localhost:8000', 'test-token') extends PythonServiceClient {
        public function probe(): void
        {
            $this->post('/probe', []);
        }
    };

    expect(fn () => $client->probe())->toThrow(RuntimeException::class, 'Telegram storage API authentication failed.');
});

it('throws on 5xx failure', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['error' => 'boom'], 500),
    ]);

    $client = new class('http://localhost:8000', 'test-token') extends PythonServiceClient {
        public function probe(): void
        {
            $this->post('/probe', []);
        }
    };

    expect(fn () => $client->probe())->toThrow(RuntimeException::class);
});

it('exposes url and token', function () {
    $client = new PythonServiceClient('http://localhost:8000', 'abc');

    expect($client->url())->toBe('http://localhost:8000')
        ->and($client->token())->toBe('abc');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `php artisan test --compact --filter=PythonServiceClientTest`
Expected: FAIL with "Class \"App\\Services\\Python\\PythonServiceClient\" not found".

- [ ] **Step 3: Create the base class**

Create `app/Services/Python/PythonServiceClient.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Python;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PythonServiceClient
{
    public function __construct(
        private readonly string $url,
        private readonly string $token,
    ) {}

    public function url(): string
    {
        return $this->url;
    }

    public function token(): string
    {
        return $this->token;
    }

    protected function request(): PendingRequest
    {
        return Http::connectTimeout(5)
            ->timeout(30)
            ->withHeaders(['X-Token' => $this->token]);
    }

    protected function post(string $path, array $body): Response
    {
        return $this->request()->asJson()->post($this->url.$path, $body);
    }

    protected function get(string $path, array $query = []): Response
    {
        return $this->request()->get($this->url.$path, $query);
    }

    protected function assertAuthenticated(Response $response): void
    {
        if ($response->status() === 403) {
            throw new RuntimeException('Telegram storage API authentication failed.');
        }
    }

    protected function assertSuccess(Response $response): void
    {
        $this->assertAuthenticated($response);

        if ($response->failed()) {
            throw new RuntimeException('Telegram storage API error: '.$response->body());
        }
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test --compact --filter=PythonServiceClientTest`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/Services/Python/PythonServiceClient.php tests/Feature/Services/Python/PythonServiceClientTest.php
git commit -m "feat(python-service): add PythonServiceClient base class"
```

---

## Task 3: Refactor `TelegramClient` to extend `PythonServiceClient`

**Files:**
- Modify: `app/Services/Telegram/TelegramClient.php`
- Test: `tests/Feature/TelegramConnectionControllerTest.php` (verify it still passes)

- [ ] **Step 1: Run the existing Telegram tests to confirm baseline**

Run: `php artisan test --compact --filter=TelegramConnectionControllerTest`
Expected: 7 tests passing.

- [ ] **Step 2: Refactor the class**

Replace the contents of `app/Services/Telegram/TelegramClient.php` with:

```php
<?php

declare(strict_types=1);

namespace App\Services\Telegram;

use App\Services\Python\PythonServiceClient;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use RuntimeException;

class TelegramClient extends PythonServiceClient
{
    public function __construct(
        string $url,
        string $token,
        private readonly string $sessionId,
    ) {
        parent::__construct($url, $token);
    }

    protected function request(): PendingRequest
    {
        return parent::request()->withHeaders(['X-Session-Id' => $this->sessionId]);
    }

    public function isAuthorized(): bool
    {
        $response = $this->get('/auth-status');

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
            ->post($this->url().'/write');

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
            ->post($this->url().'/write');

        $this->assertSuccess($response);

        return (int) $response->json('message_id');
    }

    public function download(int $messageId): string
    {
        $response = $this->request()
            ->withQueryParameters(['message_id' => $messageId])
            ->get($this->url().'/read');

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            throw new RuntimeException('Telegram file not found.');
        }

        if ($response->failed()) {
            throw new RuntimeException('Telegram storage API error: '.$response->body());
        }

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
            ->withQueryParameters(['message_id' => $messageId])
            ->delete($this->url().'/delete');

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
            ->withQueryParameters(['message_id' => $messageId])
            ->get($this->url().'/metadata');

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            return null;
        }

        $response->throw();

        $data = $response->json();

        return is_array($data) ? $data : null;
    }

    /**
     * @return array{total: int, limit: int, offset: int, files: array<int, array<string, mixed>>}
     */
    public function listAll(int $limit = 100, int $offset = 0): array
    {
        $response = $this->request()
            ->withQueryParameters(['limit' => $limit, 'offset' => $offset])
            ->get($this->url().'/list');

        $this->assertAuthenticated($response);
        $response->throw();

        return $response->json();
    }

    public function sync(): int
    {
        $response = $this->request()->post($this->url().'/sync');

        $this->assertAuthenticated($response);
        $response->throw();

        return (int) ($response->json('added') ?? 0);
    }

    /**
     * @return string phone_code_hash
     */
    public function sendCodeRequest(string $phone): string
    {
        $response = $this->request()
            ->asJson()
            ->post($this->url().'/request-code', ['phone' => $phone]);

        $this->assertAuthenticated($response);

        if ($response->failed()) {
            throw new RuntimeException('Telegram storage API error: '.$response->body());
        }

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
            ->post($this->url().'/login', $payload);

        $this->assertAuthenticated($response);

        if ($response->failed()) {
            throw new RuntimeException('Telegram storage API error: '.$response->body());
        }

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
}
```

- [ ] **Step 3: Run the Telegram tests to confirm they still pass**

Run: `php artisan test --compact --filter=TelegramConnectionControllerTest`
Expected: 7 tests still passing.

If any test fails, the public API of `TelegramClient` has drifted. Read the failure, locate the test, and adjust the test (NOT the production class) to call the new constructor correctly: `new TelegramClient(url: $url, token: $token, sessionId: $sessionId)`.

- [ ] **Step 4: Run the full test suite**

Run: `php artisan test --compact`
Expected: all tests passing (count may grow from previous runs because new tests are added in Task 2 and later tasks).

- [ ] **Step 5: Commit**

```bash
git add app/Services/Telegram/TelegramClient.php tests/Feature/TelegramConnectionControllerTest.php
git commit -m "refactor(telegram): extend PythonServiceClient"
```

---

## Task 4: Create `YtDlpClient`

**Files:**
- Create: `app/Services/Python/YtDlpClient.php`
- Test: `tests/Feature/Services/Python/YtDlpClientTest.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Services/Python/YtDlpClientTest.php` with:

```php
<?php

use App\Services\Python\YtDlpClient;
use Illuminate\Support\Facades\Http;
use RuntimeException;

beforeEach(function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);
});

it('fetches metadata and unwraps the success/data envelope', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => true,
            'data' => [
                'title' => 'Sample',
                'duration' => 60,
                'thumbnail' => 'https://example.com/t.jpg',
                'uploader' => 'Uploader',
                'view_count' => 100,
                'description' => 'desc',
                'webpage_url' => 'https://example.com/watch?v=1',
                'formats' => [
                    ['format_id' => '18', 'ext' => 'mp4', 'resolution' => '640x360', 'filesize' => 1000, 'vcodec' => 'avc1', 'acodec' => 'mp4a', 'tbr' => 200.0, 'format_note' => '360p'],
                ],
            ],
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    $data = $client->fetchMetadata('https://example.com/watch?v=1');

    expect($data)->toMatchArray([
        'title' => 'Sample',
        'duration' => 60,
        'formats' => [
            ['format_id' => '18', 'ext' => 'mp4', 'resolution' => '640x360'],
        ],
    ]);

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/yt-dlp/metadata'
            && $request['url'] === 'https://example.com/watch?v=1'
            && $request->hasHeader('X-Token', 'test-token');
    });
});

it('throws when metadata response has success: false', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => false,
            'message' => 'Video unavailable.',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    expect(fn () => $client->fetchMetadata('https://example.com/watch?v=1'))
        ->toThrow(RuntimeException::class, 'Video unavailable.');
});

it('throws when metadata response is missing the data wrapper', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response(['success' => true]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    expect(fn () => $client->fetchMetadata('https://example.com/watch?v=1'))
        ->toThrow(RuntimeException::class);
});

it('sends cookies when provided to fetchMetadata', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => true,
            'data' => ['title' => 't', 'duration' => 0, 'thumbnail' => '', 'uploader' => 'u', 'view_count' => 0, 'description' => '', 'webpage_url' => 'https://example.com', 'formats' => []],
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');
    $client->fetchMetadata('https://example.com', 'cookie=value');

    Http::assertSent(fn ($request) => $request['cookies'] === 'cookie=value');
});

it('downloadStream returns the stream resource, content type, filename, and content length', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => 'video/mp4',
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc123.mp4"',
            'Content-Length' => '11',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    $result = $client->downloadStream('https://example.com/watch?v=1', '18', false);

    expect($result['content_type'])->toBe('video/mp4')
        ->and($result['filename'])->toBe('ytdlp_dl_abc123.mp4')
        ->and($result['content_length'])->toBe(11)
        ->and(is_resource($result['stream']))->toBeTrue();

    rewind($result['stream']);
    expect(stream_get_contents($result['stream']))->toBe('binary-body');

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/yt-dlp/download'
            && $request['url'] === 'https://example.com/watch?v=1'
            && $request['format_id'] === '18'
            && $request['audio_only'] === false;
    });
});

it('downloadStream falls back to a default filename when the header is missing', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => 'video/mp4',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');
    $result = $client->downloadStream('https://example.com', '18', false);

    expect($result['filename'])->toBe('ytdlp_dl.mp4');
});

it('downloadStream marks audio_only true in the request body', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('x', 200, [
            'Content-Type' => 'audio/mp4',
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc.m4a"',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');
    $client->downloadStream('https://example.com', '140', true);

    Http::assertSent(fn ($request) => $request['audio_only'] === true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `php artisan test --compact --filter=YtDlpClientTest`
Expected: FAIL with "Class \"App\\Services\\Python\\YtDlpClient\" not found".

- [ ] **Step 3: Implement `YtDlpClient`**

Create `app/Services/Python/YtDlpClient.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Python;

use RuntimeException;

class YtDlpClient extends PythonServiceClient
{
    /**
     * @return array<string, mixed>
     */
    public function fetchMetadata(string $url, ?string $cookies = null): array
    {
        $response = $this->post('/yt-dlp/metadata', array_filter([
            'url' => $url,
            'cookies' => $cookies,
        ], fn ($v) => $v !== null));

        $this->assertSuccess($response);

        $body = $response->json();

        if (! is_array($body) || ! ($body['success'] ?? false)) {
            $message = is_array($body) ? (string) ($body['message'] ?? 'Unknown error.') : 'Unknown error.';
            throw new RuntimeException($message);
        }

        $data = $body['data'] ?? null;

        if (! is_array($data)) {
            throw new RuntimeException('Microservice did not return metadata.');
        }

        return $data;
    }

    /**
     * @return array{stream: resource, content_type: string, filename: string, content_length: int|null}
     */
    public function downloadStream(string $url, string $formatId, bool $audioOnly, ?string $cookies = null): array
    {
        $response = $this->post('/yt-dlp/download', array_filter([
            'url' => $url,
            'format_id' => $formatId,
            'audio_only' => $audioOnly,
            'cookies' => $cookies,
        ], fn ($v) => $v !== null));

        $this->assertSuccess($response);

        $contentType = $response->header('Content-Type') ?? 'application/octet-stream';
        $filename = $this->parseFilename($response->header('Content-Disposition'));
        $contentLength = $response->header('Content-Length') !== null
            ? (int) $response->header('Content-Length')
            : null;

        $stream = fopen('php://temp', 'r+');

        if ($stream === false) {
            throw new RuntimeException('Could not create download stream.');
        }

        fwrite($stream, $response->body());
        rewind($stream);

        return [
            'stream' => $stream,
            'content_type' => $contentType,
            'filename' => $filename,
            'content_length' => $contentLength,
        ];
    }

    private function parseFilename(?string $header): string
    {
        if ($header === null) {
            return 'ytdlp_dl.mp4';
        }

        if (preg_match('/filename\*?=(?:"([^"]+)"|([^;]+))/i', $header, $matches) === 1) {
            $value = $matches[1] !== '' ? $matches[1] : $matches[2];

            return trim($value);
        }

        return 'ytdlp_dl.mp4';
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test --compact --filter=YtDlpClientTest`
Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/Services/Python/YtDlpClient.php tests/Feature/Services/Python/YtDlpClientTest.php
git commit -m "feat(yt-dlp): add YtDlpClient"
```

---

## Task 5: Register the service bindings

**Files:**
- Modify: `app/Providers/AppServiceProvider.php`

- [ ] **Step 1: Add the singleton bindings**

Open `app/Providers/AppServiceProvider.php` and replace the `register` method body (`//`) with:

```php
        $this->app->singleton(\App\Services\Python\PythonServiceClient::class, function () {
            return new \App\Services\Python\PythonServiceClient(
                url: (string) config('services.python-service.url'),
                token: (string) config('services.python-service.token'),
            );
        });

        $this->app->singleton(\App\Services\Telegram\TelegramClient::class, function ($app) {
            $base = $app->make(\App\Services\Python\PythonServiceClient::class);

            return new \App\Services\Telegram\TelegramClient(
                url: $base->url(),
                token: $base->token(),
                sessionId: '',
            );
        });

        $this->app->singleton(\App\Services\Python\YtDlpClient::class, function ($app) {
            $base = $app->make(\App\Services\Python\PythonServiceClient::class);

            return new \App\Services\Python\YtDlpClient(
                url: $base->url(),
                token: $base->token(),
            );
        });
```

Note: `TelegramClient` is registered with an empty `sessionId` because the real session id comes from the per-connection `credentials` column; the controllers that use it construct their own instance with the real session id. The container binding is only for callers that need a default-injected instance.

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `php artisan test --compact`
Expected: all tests still passing.

- [ ] **Step 3: Commit**

```bash
git add app/Providers/AppServiceProvider.php
git commit -m "feat(python-service): register service bindings"
```

---

## Task 6: Create the `VideoDownloaderController`

**Files:**
- Create: `app/Http/Controllers/VideoDownloaderController.php`
- Test: `tests/Feature/VideoDownloaderControllerTest.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/VideoDownloaderControllerTest.php` with:

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);
});

it('renders the video downloader page for authenticated users', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('video-downloader/index')
        );
});

it('requires authentication to render the page', function () {
    $this->get(route('video-downloader.index'))->assertRedirect(route('login'));
});

it('returns the unwrapped metadata when the microservice succeeds', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => true,
            'data' => [
                'title' => 'Sample',
                'duration' => 60,
                'thumbnail' => 'https://example.com/t.jpg',
                'uploader' => 'Uploader',
                'view_count' => 100,
                'description' => 'desc',
                'webpage_url' => 'https://example.com/watch?v=1',
                'formats' => [
                    ['format_id' => '18', 'ext' => 'mp4', 'resolution' => '640x360', 'filesize' => 1000, 'vcodec' => 'avc1', 'acodec' => 'mp4a', 'tbr' => 200.0, 'format_note' => '360p'],
                ],
            ],
        ]),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.metadata'), [
            'url' => 'https://example.com/watch?v=1',
        ])
        ->assertOk()
        ->assertJson(['title' => 'Sample']);
});

it('returns 422 when the url is missing', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.metadata'), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url']);
});

it('returns 502 when the microservice fails', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response(['boom' => true], 500),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.metadata'), [
            'url' => 'https://example.com/watch?v=1',
        ])
        ->assertStatus(502)
        ->assertJson(['message' => 'Could not fetch video metadata.']);
});

it('streams the downloaded file with the original Content-Disposition filename', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => 'video/mp4',
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc.mp4"',
        ]),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.download', [
            'url' => 'https://example.com/watch?v=1',
            'format_id' => '18',
        ]))
        ->assertOk()
        ->assertHeader('Content-Type', 'video/mp4')
        ->assertHeader('Content-Disposition', 'attachment; filename="ytdlp_dl_abc.mp4"');
});

it('returns 422 when the download url is missing', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.download', ['format_id' => '18']))
        ->assertUnprocessable();
});

it('returns 502 when the download request fails', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response(['boom' => true], 500),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.download', [
            'url' => 'https://example.com/watch?v=1',
            'format_id' => '18',
        ]))
        ->assertStatus(502);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `php artisan test --compact --filter=VideoDownloaderControllerTest`
Expected: FAIL with "Route [video-downloader.index] not defined" or controller class not found.

- [ ] **Step 3: Create the controller**

Create `app/Http/Controllers/VideoDownloaderController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\Python\YtDlpClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VideoDownloaderController extends Controller
{
    public function __construct(private YtDlpClient $client) {}

    public function index(): Response
    {
        return Inertia::render('video-downloader/index');
    }

    public function metadata(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'url', 'max:2048'],
            'cookies' => ['nullable', 'string', 'max:65535'],
        ]);

        try {
            $data = $this->client->fetchMetadata(
                $validated['url'],
                $validated['cookies'] ?? null,
            );
        } catch (RuntimeException $exception) {
            Log::warning('yt-dlp metadata request failed.', [
                'exception' => $exception,
                'url' => $validated['url'],
            ]);

            return response()->json([
                'message' => 'Could not fetch video metadata.',
            ], 502);
        }

        return response()->json($data);
    }

    public function download(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'url', 'max:2048'],
            'format_id' => ['required', 'string', 'max:64'],
            'audio_only' => ['nullable', 'boolean'],
            'cookies' => ['nullable', 'string', 'max:65535'],
        ]);

        try {
            $result = $this->client->downloadStream(
                $validated['url'],
                $validated['format_id'],
                (bool) ($validated['audio_only'] ?? false),
                $validated['cookies'] ?? null,
            );
        } catch (RuntimeException $exception) {
            Log::warning('yt-dlp download request failed.', [
                'exception' => $exception,
                'url' => $validated['url'],
                'format_id' => $validated['format_id'],
            ]);

            abort(502, 'Could not download the video.');
        }

        $headers = array_filter([
            'Content-Type' => $result['content_type'],
            'Content-Length' => $result['content_length'],
            'Content-Disposition' => 'attachment; filename="'.$result['filename'].'"',
        ], fn ($v) => $v !== null);

        return response()->stream(function () use ($result) {
            $stream = $result['stream'];
            fpassthru($stream);
            fclose($stream);
        }, 200, $headers);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test --compact --filter=VideoDownloaderControllerTest`
Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/VideoDownloaderController.php tests/Feature/VideoDownloaderControllerTest.php
git commit -m "feat(video-downloader): add controller"
```

---

## Task 7: Register the routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add the three routes inside the auth middleware group**

Open `routes/web.php` and add the following three lines inside the `Route::middleware(['auth', 'verified'])->group(...)` block, right after the `Route::delete('/connections/{connection}/move', ...)` line (or anywhere within the group as long as they are inside):

```php
    Route::get('/video-downloader', [VideoDownloaderController::class, 'index'])->name('video-downloader.index');
    Route::post('/video-downloader/metadata', [VideoDownloaderController::class, 'metadata'])->name('video-downloader.metadata');
    Route::get('/video-downloader/download', [VideoDownloaderController::class, 'download'])->name('video-downloader.download');
```

Add the import at the top of the file alongside the other controller imports:

```php
use App\Http\Controllers\VideoDownloaderController;
```

- [ ] **Step 2: Confirm the routes are registered**

Run: `php artisan route:list --except-vendor --name=video-downloader`
Expected: shows three routes (`GET /video-downloader`, `POST /video-downloader/metadata`, `GET /video-downloader/download`).

- [ ] **Step 3: Run the controller tests**

Run: `php artisan test --compact --filter=VideoDownloaderControllerTest`
Expected: 7 tests still passing.

- [ ] **Step 4: Commit**

```bash
git add routes/web.php
git commit -m "feat(video-downloader): register routes"
```

---

## Task 8: Add the TypeScript types

**Files:**
- Create: `resources/js/types/video-downloader.ts`

- [ ] **Step 1: Create the types file**

Create `resources/js/types/video-downloader.ts`:

```ts
export interface VideoFormat {
    format_id: string;
    ext: string;
    resolution: string;
    filesize: number | null;
    vcodec: string | null;
    acodec: string | null;
    tbr: number | null;
    format_note: string | null;
}

export interface VideoMetadata {
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
    view_count: number;
    description: string;
    webpage_url: string;
    formats: VideoFormat[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors (this file alone cannot fail; it is consumed by Task 9).

- [ ] **Step 3: Commit**

```bash
git add resources/js/types/video-downloader.ts
git commit -m "feat(video-downloader): add TS types"
```

---

## Task 9: Create the Inertia page

**Files:**
- Create: `resources/js/pages/video-downloader/index.tsx`

- [ ] **Step 1: Create the page**

Create `resources/js/pages/video-downloader/index.tsx`:

```tsx
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { formatBytes } from '@/lib/format-bytes';
import type { VideoFormat, VideoMetadata } from '@/types/video-downloader';

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '--';
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

function formatCount(value: number): string {
    if (!Number.isFinite(value)) {
        return '0';
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }
    return String(value);
}

export default function VideoDownloaderIndex() {
    const [url, setUrl] = useState('');
    const [cookies, setCookies] = useState('');
    const [showCookies, setShowCookies] = useState(false);
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);

    const csrfToken = (): string =>
        (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '';

    const fetchInfo = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMetadata(null);
        setSelectedFormatId(null);

        try {
            const response = await fetch('/video-downloader/metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    url,
                    cookies: cookies || null,
                }),
            });

            const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

            if (!response.ok) {
                throw new Error((data.message as string) ?? 'Failed to fetch video info.');
            }

            setMetadata(data as unknown as VideoMetadata);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const triggerDownload = () => {
        if (!metadata || !selectedFormatId) {
            return;
        }

        const params = new URLSearchParams({
            url,
            format_id: selectedFormatId,
            cookies: cookies || '',
        });

        window.location.href = `/video-downloader/download?${params.toString()}`;
    };

    const selectedFormat: VideoFormat | null =
        metadata?.formats.find((format) => format.format_id === selectedFormatId) ?? null;

    return (
        <AuthenticatedLayout title="Video Downloader">
            <div className="mx-auto max-w-4xl space-y-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        Video Downloader
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Paste a video URL to fetch available formats and download the file.
                    </p>
                </div>

                <form onSubmit={fetchInfo} className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div>
                        <label htmlFor="vd-url" className="text-xs font-bold text-foreground">
                            Video URL
                        </label>
                        <input
                            id="vd-url"
                            type="url"
                            required
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/50"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowCookies((current) => !current)}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                        {showCookies ? 'Hide cookies' : 'Use cookies (advanced)'}
                    </button>

                    {showCookies && (
                        <div>
                            <label htmlFor="vd-cookies" className="text-xs font-bold text-foreground">
                                Cookies (Netscape format)
                            </label>
                            <textarea
                                id="vd-cookies"
                                value={cookies}
                                onChange={(event) => setCookies(event.target.value)}
                                rows={4}
                                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/50"
                            />
                        </div>
                    )}

                    {error && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !url}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Fetching...
                            </>
                        ) : (
                            'Get info'
                        )}
                    </button>
                </form>

                {metadata && (
                    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row">
                            {metadata.thumbnail && (
                                <img
                                    src={metadata.thumbnail}
                                    alt={metadata.title}
                                    className="h-40 w-full max-w-[320px] rounded-xl object-cover"
                                />
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                                <h2 className="truncate text-lg font-bold text-foreground">
                                    {metadata.title}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {metadata.uploader}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatDuration(metadata.duration)} - {formatCount(metadata.view_count)} views
                                </p>
                                {metadata.description && (
                                    <p className="line-clamp-3 text-xs text-muted-foreground">
                                        {metadata.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">
                                FORMATS
                            </h3>
                            <ul className="divide-y divide-border rounded-xl border border-border">
                                {metadata.formats.map((format) => {
                                    const isSelected = format.format_id === selectedFormatId;
                                    return (
                                        <li key={format.format_id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedFormatId(format.format_id)}
                                                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                                                    isSelected
                                                        ? 'bg-primary/10 font-semibold text-foreground'
                                                        : 'hover:bg-muted'
                                                }`}
                                            >
                                                <span className="flex flex-col">
                                                    <span className="font-semibold text-foreground">
                                                        {format.format_note ?? format.resolution ?? format.format_id}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format.ext} - {format.resolution}
                                                    </span>
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format.filesize ? formatBytes(format.filesize) : 'unknown size'}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <button
                            type="button"
                            onClick={triggerDownload}
                            disabled={!selectedFormat}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                        >
                            <Download className="h-4 w-4" />
                            Download {selectedFormat ? `${selectedFormat.format_note ?? selectedFormat.format_id}.${selectedFormat.ext}` : ''}
                        </button>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full backend test suite (frontend has no automated test infra)**

Run: `php artisan test --compact`
Expected: all tests still passing.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/video-downloader/index.tsx
git commit -m "feat(video-downloader): add page"
```

---

## Task 10: Add the sidebar link

**Files:**
- Modify: `resources/js/layouts/AuthenticatedLayout.tsx`

- [ ] **Step 1: Add the import**

Open `resources/js/layouts/AuthenticatedLayout.tsx`. In the `lucide-react` import block (lines 3-15), add `Download` to the imports:

```tsx
import {
    LayoutDashboard,
    Cloud,
    Settings,
    LogOut,
    Bell,
    FolderPlus,
    Search,
    Upload,
    ListTodo,
    Link as LinkIcon,
    Eraser,
    RefreshCw,
    Download,
} from 'lucide-react';
```

- [ ] **Step 2: Add the nav link**

In the SYSTEM `<ul>` block (after the "SHARED LINKS" `<li>`, before the closing `</ul>`), add a new `<li>`:

```tsx
                            <li>
                                <Link
                                    href="/video-downloader"
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold tracking-wide transition-colors ${url.startsWith('/video-downloader') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {url.startsWith('/video-downloader') && (
                                        <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
                                    )}
                                    <Download
                                        className={`h-4.5 w-4.5 ${url.startsWith('/video-downloader') ? 'text-primary' : 'text-muted-foreground'}`}
                                    />
                                    VIDEO DOWNLOADER
                                </Link>
                            </li>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add resources/js/layouts/AuthenticatedLayout.tsx
git commit -m "feat(video-downloader): add sidebar link"
```

---

## Task 11: Update `.env.example` and run final checks

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace the old env keys with the new ones**

Open `.env.example`. Find the lines mentioning `TELEGRAM_STORAGE_URL` and `TELEGRAM_STORAGE_TOKEN` (if any) and replace them with:

```
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_TOKEN=
```

If those lines do not exist in `.env.example`, just append the two lines to the file.

- [ ] **Step 2: Run the full test suite**

Run: `php artisan test --compact`
Expected: all tests passing.

- [ ] **Step 3: Run the formatter**

Run: `vendor/bin/pint --dirty --format agent`
Expected: any leftover style issues get fixed.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "chore(env): rename telegram-storage to python-service"
```

---

## Task 12: Manual smoke test

- [ ] **Step 1: Boot the dev environment**

Run: `composer run dev` (or `php artisan serve` + `npm run dev` in two terminals).

- [ ] **Step 2: Walk through the flow**

In a browser:
1. Log in.
2. Click "VIDEO DOWNLOADER" in the sidebar. The page renders with an empty form.
3. Paste a YouTube URL and click "Get info". A card appears with title, uploader, view count, duration, description, and a list of formats.
4. Click a format row. A "Download" button appears.
5. Click "Download". The browser saves the file with the name from `Content-Disposition` (e.g. `ytdlp_dl_abc123.mp4`).
6. Optional: enter a cookies string before fetching, verify the request still works.

- [ ] **Step 3: Verify error path**

Paste an obviously invalid URL. The form should not submit (HTML5 `type=url` validation). Or submit a URL the microservice cannot resolve - the page should show "Could not fetch video metadata." (or whatever the microservice returns).

- [ ] **Step 4: Final commit if any smoke-test fixups were needed**

```bash
git add -A
git commit -m "chore: smoke-test fixups"
```

---

## Self-Review Notes

- **Spec coverage:**
  - `PythonServiceClient` base class - Task 2.
  - `TelegramClient` extends base - Task 3.
  - `services.python-service` config + backwards compat - Task 1 (uses double-`env()` fallback).
  - `YtDlpClient` with `fetchMetadata` + `downloadStream` - Task 4.
  - Service bindings - Task 5.
  - `VideoDownloaderController` with `index`/`metadata`/`download` - Task 6.
  - 3 auth-protected routes - Task 7.
  - TS types - Task 8.
  - Inertia page - Task 9.
  - Nav link - Task 10.
  - `.env.example` rename - Task 11.
  - Manual smoke test - Task 12.

- **Placeholder scan:** no "TBD", "TODO", "similar to" or vague "handle errors" steps. Every step has explicit code or commands.

- **Type consistency:**
  - `PythonServiceClient` is referenced consistently as `App\Services\Python\PythonServiceClient` everywhere it appears.
  - `YtDlpClient::fetchMetadata(string $url, ?string $cookies = null): array` is defined in Task 4 and called identically in Task 6.
  - `YtDlpClient::downloadStream(string $url, string $formatId, bool $audioOnly, ?string $cookies = null): array` returns the documented shape (stream, content_type, filename, content_length) and the controller in Task 6 reads those exact keys.
  - Route names (`video-downloader.index`, `video-downloader.metadata`, `video-downloader.download`) match across Tasks 6, 7, and 9.
  - The `parseFilename` helper falls back to `'ytdlp_dl.mp4'` and the controller does not need to override it.

- **Open items for the executor:**
  - The fallback `TelegramClient` container binding uses an empty `sessionId`. Real callers (controllers) construct their own `TelegramClient` with a real session id. This matches the existing pattern in `TelegramConnectionController` and `TelegramConnector`. No production code uses the container-resolved `TelegramClient`, so this is safe.
  - Frontend has no automated test infra in this project. The plan calls for a manual smoke test in Task 12 instead.
