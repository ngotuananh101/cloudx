# Telegram Flysystem Adapter Design

## Goal

Add Telegram Saved Messages as a storage provider in the Laravel app by implementing a Flysystem-compatible adapter and client that communicates with the existing Telegram Python microservice. Users can connect a Telegram session, browse files, upload, download, and delete through the same UI used by other providers.

## Scope

In scope:

- `TelegramClient` — HTTP client wrapping the Telegram microservice API.
- `TelegramAdapter` — Flysystem `FilesystemAdapter` implementation.
- `TelegramConnector` — `CloudProviderConnector` implementation.
- `CloudProvider::TELEGRAM` enum value and registration.
- Flysystem disk wiring through `Storage::build()`.
- Unit tests for client and adapter (mocked HTTP).
- Config for microservice URL and shared API token.

Out of scope for this phase:

- Frontend UI for Telegram provider (separate task).
- Folder emulation — `createDirectory` and `deleteDirectory` are no-ops. `listContents` returns a flat list.
- `move` and `copy` operations — throw `UnableToMoveFile` / `UnableToCopyFile`.
- Chunked upload — microservice accepts multipart directly.
- `setVisibility` / `visibility` — throw unsupported.
- Telegram auth flow (login/request-code) — handled separately through microservice endpoints.

## Architecture

```
Laravel App
  └─ TelegramConnector (CloudProviderConnector)
       └─ TelegramAdapter (FilesystemAdapter)
            └─ TelegramClient (HTTP → microservice)
                 └─ Python microservice (FastAPI on port 8000)
                      └─ Telegram Saved Messages
```

Follows the same pattern as OneDrive: Connector → Adapter → Client.

## Backend Design

### Config

Add to `config/services.php`:

```php
'telegram-storage' => [
    'url' => env('TELEGRAM_STORAGE_URL', 'http://localhost:8000'),
    'token' => env('TELEGRAM_STORAGE_TOKEN'),
],
```

Add to `.env.example`:

```
TELEGRAM_STORAGE_URL=http://localhost:8000
TELEGRAM_STORAGE_TOKEN=
```

### Connection credentials

Each `CloudConnection` with `provider = TELEGRAM` stores credentials:

```php
[
    'session_id' => 'user_abc123',
]
```

The `session_id` identifies the Telegram session file on the microservice. It is unique per connection and validated by the microservice to contain only `[a-zA-Z0-9_-]{1,64}`.

The shared API token comes from config, not from per-connection credentials.

### TelegramClient

Create `App\Services\Telegram\TelegramClient`.

Constructor:

```php
public function __construct(
    private string $url,
    private string $token,
    private string $sessionId,
) {}
```

Methods:

| Method | HTTP | Endpoint | Returns |
|---|---|---|---|
| `isAuthorized(): bool` | GET | `/auth-status` | `{authorized: bool}` |
| `listAll(int $limit = 100, int $offset = 0): array` | GET | `/list?limit=&offset=` | `{total, files: [{message_id, original_name, size, mime_type, caption, created_at}]}` |
| `metadata(int $messageId): array` | GET | `/metadata?message_id=` | `{message_id, original_name, size, mime_type, caption, created_at, updated_at}` |
| `upload(string $filename, string $contents): int` | POST | `/write` | `{success, message_id}` |
| `uploadStream(string $filename, resource $stream): int` | POST | `/write` | `{success, message_id}` |
| `download(int $messageId): string` | GET | `/read?message_id=` | Raw body |
| `downloadStream(int $messageId): resource` | GET | `/read?message_id=` | `php://temp` stream |
| `delete(int $messageId): void` | DELETE | `/delete?message_id=` | `{success}` |
| `sync(): int` | POST | `/sync` | `{success, added}` |

All requests include headers:
- `X-Session-Id: {sessionId}`
- `X-Token: {token}`

Error handling:
- 403 → `RuntimeException('Telegram storage API authentication failed.')`
- 404 → return `null` for metadata/download, throw for delete
- Other non-2xx → `RuntimeException`

HTTP timeouts: connect 5s, timeout 30s (uploads can be slow).

### TelegramAdapter

Create `App\Services\Telegram\TelegramAdapter` implementing `League\Flysystem\FilesystemAdapter`.

Constructor:

```php
public function __construct(private TelegramClient $client) {}
```

Path semantics: the `path` parameter in Flysystem methods is a Telegram `message_id` as a string (e.g., `"12345"`). This is the unique identifier for files in Telegram Saved Messages.

Method mapping:

| Flysystem method | Implementation | Notes |
|---|---|---|
| `write(path, contents, config)` | `upload(path, contents)` | `path` is used as the filename sent to microservice. Returns void. The actual identifier is `message_id` from the response. |
| `writeStream(path, stream, config)` | `uploadStream(path, stream)` | Same as above. |
| `read(path)` | `download((int) path)` | Returns string. |
| `readStream(path)` | `downloadStream((int) path)` | Returns `resource`. |
| `delete(path)` | `delete((int) path)` | |
| `deleteDirectory(path)` | no-op | Telegram has no folders. |
| `createDirectory(path, config)` | no-op | Telegram has no folders. |
| `fileExists(path)` | `metadata((int) path)` | Returns `true` if not null, `false` otherwise. |
| `directoryExists(path)` | always `false` | |
| `listContents(path, deep)` | `listAll()` | Paginated via microservice. Yields `FileAttributes` with `path = (string) message_id`. Ignores `path` and `deep` params — always returns all files flat. |
| `mimeType(path)` | `metadata((int) path)` | Returns `FileAttributes`. |
| `lastModified(path)` | `metadata((int) path)` | Returns `FileAttributes`. |
| `fileSize(path)` | `metadata((int) path)` | Returns `FileAttributes`. |
| `visibility(path)` | throw `UnableToRetrieveMetadata` | |
| `setVisibility(path, visibility)` | throw `UnableToSetVisibility` | |
| `move(source, destination, config)` | throw `UnableToMoveFile` | Telegram does not support move. |
| `copy(source, destination, config)` | throw `UnableToCopyFile` | Telegram does not support copy. |

The `write` / `writeStream` methods use the `path` parameter as the filename (caption) when uploading to Telegram. After upload, the file is identified by `message_id`, not by the original path. This means:
- `write("report.pdf", $contents)` uploads a file named "report.pdf".
- The microservice returns `message_id = 12345`.
- To read this file later, use `read("12345")`.
- `listContents()` returns `FileAttributes` where `path = "12345"`.

This differs from traditional filesystem adapters where the path used to write is the same path used to read. Callers must use `listContents()` or capture the `message_id` from the upload response to reference files.

To expose `message_id` after upload, the adapter provides an additional public method not part of the Flysystem interface:

```php
public function uploadAndGetId(string $filename, string $contents): int
{
    return $this->client->upload($filename, $contents);
}
```

### TelegramConnector

Create `App\Services\CloudStorage\Connectors\TelegramConnector` implementing `CloudProviderConnector`.

```php
class TelegramConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::TELEGRAM();
    }

    public function redirectUrl(): string
    {
        // Telegram uses credential-based auth, not OAuth.
        // Not called from UI — returns empty string.
        return '';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        // Not used for credential-based providers.
        throw new RuntimeException('Telegram uses credential-based authentication.');
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        $credentials = $connection->credentials;

        $client = new TelegramClient(
            url: (string) config('services.telegram-storage.url'),
            token: (string) config('services.telegram-storage.token'),
            sessionId: (string) ($credentials['session_id'] ?? ''),
        );

        return new Filesystem(new TelegramAdapter($client));
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: false,
            share: false,
        );
    }
}
```

### Provider registration

Add `TELEGRAM` to `CloudProvider` enum:

```php
const TELEGRAM = 7;
```

Update `slug()`, `fromSlug()`, `getDescription()`, `getIcon()`.

Register `TelegramConnector` in `CloudStorageServiceProvider`.

### Credential-based connection flow

Telegram is a credential-based provider (like FTP/SFTP). The connection flow:

1. User opens Connect Storage modal.
2. User selects Telegram.
3. Modal shows credential form: only `session_id` field.
4. User submits. Backend validates `session_id` format.
5. Backend calls `GET /auth-status` on microservice to verify session exists and is authorized.
6. If authorized, create `CloudConnection` with `provider = TELEGRAM`, encrypted credentials `{session_id}`.
7. If not authorized, return error — user must complete Telegram auth flow separately.

Telegram auth (phone/code/2FA) is handled through microservice endpoints (`/request-code`, `/login`) separately from the connection creation flow. This keeps the auth complexity out of the connector.

### Edit connection

Edit form shows `session_id` (pre-filled). On submit:
- Test connection via `GET /auth-status`.
- If session changes, update credentials.

## Data Flow

Upload:
1. User uploads file through existing upload manager.
2. `CloudStorageManager` resolves `TelegramConnector`.
3. `TelegramConnector::disk()` creates `TelegramClient` + `TelegramAdapter`.
4. `TelegramAdapter::write(filename, contents)` calls `TelegramClient::upload()`.
5. Client sends `POST /write` to microservice with multipart file.
6. Microservice uploads to Telegram Saved Messages, returns `message_id`.
7. File is now stored in Telegram.

Download:
1. User requests file by `message_id` (from `listContents()` result).
2. `TelegramAdapter::read(message_id)` calls `TelegramClient::download()`.
3. Client sends `GET /read?message_id=` to microservice.
4. Microservice downloads from Telegram, streams back.
5. Adapter returns file contents.

## Error Handling

- Microservice unreachable → `RuntimeException` with connection error message.
- 403 from microservice → authentication/token error.
- 404 from microservice → file not found or stale index.
- Large file download → streamed via `php://temp` to avoid memory issues.
- All Telegram-specific errors wrapped in Flysystem `UnableTo*` exceptions.

## Testing

Backend tests:

- `TelegramClient` sends correct headers and parses responses.
- `TelegramClient` handles 403, 404, non-2xx responses.
- `TelegramAdapter::write()` calls client upload.
- `TelegramAdapter::read()` calls client download.
- `TelegramAdapter::delete()` calls client delete.
- `TelegramAdapter::listContents()` calls client listAll and yields FileAttributes.
- `TelegramAdapter::fileExists()` returns true/false based on metadata.
- `TelegramAdapter::move()` and `copy()` throw.
- `TelegramAdapter::setVisibility()` and `visibility()` throw.
- `TelegramAdapter::createDirectory()` and `deleteDirectory()` are no-ops.
- `TelegramConnector::disk()` builds a Filesystem with TelegramAdapter.
- `TelegramConnector::capabilities()` returns correct flags.
- Telegram provider is registered in `CloudProviderRegistry`.
- Dashboard provider metadata includes Telegram with `authType: credentials`.

## Decisions

- Telegram uses credential modal flow, not OAuth redirect.
- `session_id` is the only per-connection credential. API token is shared via config.
- Path in Flysystem = `message_id` string. `write()` uses path as filename/caption.
- Folder operations are no-ops. `listContents` is flat.
- `move` and `copy` throw — Telegram does not support these.
- `createFolder: false` in capabilities.
- Telegram auth (phone/code/2FA) handled separately from connector flow.

## Self-Review

- Placeholder scan: no TBD/TODO remain.
- Consistency: design follows existing OneDrive/FTP connector patterns.
- Scope: focused on Flysystem adapter only; frontend UI is out of scope.
- Ambiguity: path semantics (message_id vs filename), folder handling, config location, and credential structure are explicitly defined.
