# Video Downloader (yt-dlp) - Design

**Status:** draft
**Date:** 2026-06-17

## 1. Goal

Add a standalone "Video Downloader" page where authenticated users paste a video URL, fetch metadata, pick a format, and download the file. The page is independent of the cloud storage feature - it does not create a `CloudConnection`, does not write to a remote backend, and does not browse any file tree. The microservice is the same Python service currently used for Telegram (now generalised to `python-service`); the new endpoint is `yt-dlp`.

## 2. Scope

In scope:
- Refactor the existing `TelegramClient` into a `PythonServiceClient` base class plus a `TelegramClient` subclass so both adapters share HTTP wiring.
- Rename config key `services.telegram-storage` to `services.python-service` (URL + token shared by Telegram and yt-dlp).
- Add a `YtDlpClient` subclass exposing `fetchMetadata` and `downloadStream`.
- Add `App\Http\Controllers\VideoDownloaderController` with three endpoints behind the `auth` middleware:
  - `GET  /video-downloader` - render Inertia page
  - `POST /video-downloader/metadata` - call `YtDlpClient::fetchMetadata`, return JSON
  - `GET  /video-downloader/download` - proxy the stream from the microservice
- Add a React page at `resources/js/pages/video-downloader/index.tsx` with URL input, metadata card, format picker, download button.
- Add nav link "Video Downloader" in the authenticated layout.

Out of scope:
- Persisting download history.
- Queuing / backgrounding downloads.
- Uploading downloaded files to a cloud connection.
- Cookies storage per user (the cookies field is sent ad-hoc with each request).
- Changing the Telegram connection flow or breaking any existing tests.

## 3. Architecture

### 3.1 HTTP client layer

`App\Services\Python\PythonServiceClient` (new, base class) - generic HTTP wrapper for the Python microservice.

Constructor:
```php
public function __construct(
    private readonly string $url,
    private readonly string $token,
) {}
```

Responsibilities:
- Build `Illuminate\Http\Client\PendingRequest` with `X-Token` header, connect timeout 5s, request timeout 30s.
- Expose `protected function request(): PendingRequest` so subclasses can call it.
- Expose `protected function post(string $path, array $body): Response` and `protected function get(string $path, array $query = []): Response`.
- Expose `public function url(): string` and `public function token(): string`.
- Throw `RuntimeException` on auth failure (HTTP 403) via `assertAuthenticated`.
- Throw `RuntimeException` on non-2xx responses via `assertSuccess`.

`App\Services\Telegram\TelegramClient` (class now `extends PythonServiceClient`) - moves every Telegram-specific call (`sendCodeRequest`, `login`, `sync`, `metadata`, `listAll`, `read`, `readStream`, `write`, `uploadStream`, `delete`) to use `$this->post(...)` / `$this->get(...)` from the parent. URLs are constructed relative to the base URL. `X-Session-Id` header is added by the subclass.

`App\Services\Python\YtDlpClient` (new, `extends PythonServiceClient`):
- `fetchMetadata(string $url, ?string $cookies = null): array` - POST `/yt-dlp/metadata` with `{"url": ..., "cookies": ...}`. Throws if `success !== true` or `data` is missing. Returns the unwrapped `data` array.
- `downloadStream(string $url, string $formatId, bool $audioOnly, ?string $cookies = null): array` - POST `/yt-dlp/download` with the JSON body. Returns:
  ```php
  ['stream' => resource, 'content_type' => string, 'filename' => string, 'content_length' => int|null]
  ```
  Pulls `Content-Type` and `Content-Disposition` from the microservice response. Parses `filename="..."` out of the attachment header. Streams the body to a `php://temp` resource so the controller can `fpassthru` it without buffering the full video in Laravel HTTP client memory.

### 3.2 Configuration

`config/services.php`:
```php
'python-service' => [
    'url'   => env('PYTHON_SERVICE_URL', 'http://localhost:8000'),
    'token' => env('PYTHON_SERVICE_TOKEN'),
],
```

### 3.3 Service registration

`App\Providers\AppServiceProvider`:
- Bind `PythonServiceClient` as a singleton from `config('services.python-service.url')` and `token`.
- Bind `TelegramClient` as a singleton wrapping the same `PythonServiceClient`.
- Bind `YtDlpClient` as a singleton wrapping the same `PythonServiceClient`.

### 3.4 Controller

`App\Http\Controllers\VideoDownloaderController` (behind `auth` middleware):
- `GET  /video-downloader` - render Inertia page
- `POST /video-downloader/metadata` - validate `url` (required, url, max 2048) and `cookies` (nullable string, max 65535), call `YtDlpClient::fetchMetadata`, return JSON. 502 with generic message on `RuntimeException`.
- `GET  /video-downloader/download` - validate `url`, `format_id`, `audio_only`, `cookies`. Call `YtDlpClient::downloadStream`. Stream response with the headers the microservice supplied. 502 on `RuntimeException`.

### 3.5 Frontend

`resources/js/pages/video-downloader/index.tsx`:

State: `url`, `cookies`, `loading`, `metadata`, `error`, `selectedFormatId`.

Flow:
1. User types URL, optionally a cookies string, clicks "Get info".
2. Page posts `{ url, cookies }` to `/video-downloader/metadata`. On success stores the response, shows the card.
3. Renders the card: thumbnail, title, uploader, view count, duration, description, list of formats. Each format row is a button that becomes selected on click.
4. When a format is selected, a "Download" button appears. Clicking it navigates to `/video-downloader/download?url=...&format_id=...&audio_only=...&cookies=...`. The browser handles the file save.

`resources/js/types/video-downloader.ts`:
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

Nav: add a "Video Downloader" link in `AuthenticatedLayout` pointing to `route('video-downloader.index')`.

### 3.6 Backwards compatibility for the env rename

The old env keys are read in `config/services.php` as fallbacks so existing deployments keep working without an `.env` edit:
```php
'python-service' => [
    'url'   => env('PYTHON_SERVICE_URL', env('TELEGRAM_STORAGE_URL', 'http://localhost:8000')),
    'token' => env('PYTHON_SERVICE_TOKEN', env('TELEGRAM_STORAGE_TOKEN')),
],
```

## 4. Data flow

### 4.1 Metadata fetch

```
Browser -> POST /video-downloader/metadata { url, cookies }
Laravel -> YtDlpClient::fetchMetadata -> POST /yt-dlp/metadata { url, cookies } X-Token
Microservice -> {success: true, data: {...}}
Laravel -> { ...data } -> Browser
```

### 4.2 Download

```
Browser -> GET /video-downloader/download ?url=...&format_id=...&audio_only=...&cookies=...
Laravel -> YtDlpClient::downloadStream -> POST /yt-dlp/download {url, format_id, audio_only, cookies} X-Token
Microservice -> stream, headers: Content-Type, Content-Disposition
Laravel -> 200 stream with same headers -> Browser
```

The browser receives the stream with the same filename and content-type the microservice sent.

## 5. Error handling

| Failure | Detection | Behaviour |
|---|---|---|
| Microservice unreachable | `ConnectionException` | 502; UI shows "Could not reach download service." |
| Microservice returns `{success: false}` | client checks wrapper | 502 |
| Microservice returns 4xx/5xx | `assertSuccess` | 502 |
| Invalid URL or format | Validator | 422 with field errors |
| Cookies too long | Validator | 422 |
| File too large | Stream via `php://temp` | no buffer blowup |

## 6. Testing

- `PythonServiceClientTest` - base class: token header, throws on 403, throws on 5xx, returns body on 2xx.
- `TelegramClientTest` - existing tests keep passing after refactor. Update constructor calls if needed.
- `YtDlpClientTest` - `fetchMetadata` unwraps + throws; `downloadStream` returns filename + content-type + resource.
- `VideoDownloaderControllerTest` - `index` requires auth; `metadata` validates + 502 on fail; `download` streams with original headers + 502 on fail.
- Frontend: manual smoke test (no browser test infra in this project).

## 7. Files touched

New:
- `app/Services/Python/PythonServiceClient.php`
- `app/Services/Python/YtDlpClient.php`
- `app/Http/Controllers/VideoDownloaderController.php`
- `resources/js/pages/video-downloader/index.tsx`
- `resources/js/types/video-downloader.ts`
- `tests/Feature/VideoDownloaderControllerTest.php`
- `tests/Feature/Services/Python/YtDlpClientTest.php`

Modified:
- `app/Services/Telegram/TelegramClient.php` - extends `PythonServiceClient`
- `config/services.php` - `python-service` + backwards-compat fallbacks
- `routes/web.php` - 3 new routes under `auth`
- `resources/js/components/...` - nav link
- `.env.example` - `PYTHON_SERVICE_*`
- Existing tests touching `TelegramClient` - constructor updates if needed
