# GoFile Integration Design

## Goal

Add [GoFile](https://gofile.io) as a credential-based storage provider in CloudX. Users paste their GoFile account token, connect once, then browse, upload, download, delete, create folders, move, and copy through the same file UI used by S3/FTP/Telegram/OneDrive.

Success criterion for phase 1: **parity with the S3/FTP credentials flow** (connect form → encrypted credentials → Flysystem disk → existing browser/upload manager), with unit/feature tests covering client, adapter, connector, and controller.

## Decisions

| Topic | Choice |
|-------|--------|
| Auth | User pastes 32-char account token (no OAuth, no auto guest creation) |
| Architecture | Custom Flysystem adapter (Connector → Adapter → Client), same shape as Telegram/OneDrive |
| Scope | Full file browser: list, upload, download, delete, create folder, move, copy, rename |
| Quota | Not supported (GoFile has no reliable free-tier quota API for our use) |
| Share | Phase 1: `share: true` only in the sense that CloudX can still create CloudShare records pointing at connection+path. Native GoFile public folder links are phase 2 |
| Recycle bin | Out of scope |
| Email magic-link login | Out of scope |

## Scope

### In scope

- `CloudProvider::GOFILE = 8` + slug/icon/description wiring
- `GoFileClient` HTTP wrapper for GoFile REST API
- `GoFileAdapter` implementing `League\Flysystem\FilesystemAdapter`
- `GoFileConnector` implementing `CloudProviderConnector` (+ optional `ProvidesDirectDownloadLink` if a stable direct URL is available)
- Credential connect/edit: `GoFileConnectionController`, Form Requests, routes
- Frontend: `GoFileConnectionForm`, Connect modal/ProviderOption allowlist, types, SVG icon
- Path ↔ contentId resolution with short-lived cache
- Tests: Client, Adapter, Connector, ConnectionController
- Registration in `CloudStorageServiceProvider` + `HomeController` credentials branch + `CloudConnection` edit flags

### Out of scope

- Guest auto-create (`POST /accounts` from CloudX)
- Email magic-link / website login flow
- Recycle bin / restore / empty recycle
- Premium-only stats/history dashboards
- Native GoFile public folder settings UI (password, expiry on GoFile side)
- Python microservice (unlike Telegram — talk to GoFile API directly from Laravel)

## Architecture

```
ConnectStorageModal
  └─ GoFileConnectionForm  →  POST /connections/gofile
       └─ GoFileConnectionController
            └─ GoFileConnector::diskFromCredentials / disk
                 └─ GoFileAdapter (FilesystemAdapter)
                      └─ GoFileClient (Illuminate Http)
                           ├─ https://api.gofile.io/*
                           └─ https://{server}.gofile.io/uploadfile
```

Follows the Telegram/OneDrive pattern: **Connector → Adapter → Client**.

## GoFile API surface (phase 1)

Public marketing page at `https://gofile.io/api` is not a usable reference. Phase 1 targets the live REST surface used by the official web client:

| Operation | Method / URL | Auth | Body / notes |
|-----------|--------------|------|--------------|
| Validate account | `GET https://api.gofile.io/accounts/website` | `Authorization: Bearer {token}` | Returns account id, email (or guest id), `rootFolder`, tier |
| List servers | `GET https://api.gofile.io/servers` | none | Pick a server name for upload host |
| List content | `GET https://api.gofile.io/contents/{contentId}` | Bearer | Query: `page`, `pageSize`, `sortField`, `sortDirection` |
| Create folder | `POST https://api.gofile.io/contents/createfolder` | Bearer | JSON: `parentFolderId`, `folderName`, `public` |
| Upload file | `POST https://{server}.gofile.io/uploadfile` | form field `token` | multipart: `token`, `folderId`, `file` |
| Delete | `DELETE https://api.gofile.io/contents` | Bearer | JSON: `contentsId` (comma-separated allowed by API) |
| Rename | `PUT https://api.gofile.io/contents/{id}/update` | Bearer | JSON: `attribute: "name"`, `attributeValue` |
| Move | `PUT https://api.gofile.io/contents/move` | Bearer | JSON: `contentsId`, `folderId` |
| Copy | `POST https://api.gofile.io/contents/copy` | Bearer | JSON: `contentsId`, `folderId` |

### Response envelope

```json
{ "status": "ok", "data": { ... } }
```

Non-ok `status` values (e.g. `error-notFound`, auth failures) must throw typed client exceptions mapped to Flysystem `UnableTo*` errors.

### Auth details

- Token format: 32 alphanumeric chars (`/^[a-z0-9]{32}$/i`).
- Website client also sends `X-Website-Token` on some list calls. CloudX phase 1 uses **Bearer only**. If list/download is blocked without website token in production, add a follow-up to reverse/port `generateWT` — do not block phase 1 on it.
- Do **not** call `POST /accounts` during normal connect (avoids creating orphan guest accounts).

### Upload flow

1. Resolve destination folder content id from path.
2. `GET /servers` → choose first healthy server (or sticky per-connection last-good server with short TTL).
3. `POST https://{server}.gofile.io/uploadfile` with multipart `token`, `folderId`, `file`.
4. Invalidate path cache for parent folder.

### Download flow

1. Resolve file content id from path.
2. `GET /contents/{id}` (or parent list metadata) to obtain direct download URL / link fields from `data`.
3. Stream via HTTP to the browser response (same pattern as other remote adapters). If only a public `https://gofile.io/d/{code}` page link exists for folders, files should still expose a direct content link from content metadata when present.
4. Optionally implement `ProvidesDirectDownloadLink` when a stable direct URL is available; otherwise CloudX proxy download remains the default.

## Backend design

### Enum

`app/Enums/CloudProvider.php`:

- `case GOFILE = 8;`
- slug: `gofile`
- description: `GoFile`
- icon: `/assets/svg/GoFile.svg`

### Credentials

Stored encrypted on `CloudConnection.credentials`:

```php
[
    'token' => '…32 chars…',
    'account_id' => '…',
    'root_folder' => '…content id…',
    // optional cache hints
    'email' => '…or guest label…',
]
```

- `provider_id` = `account_id` (stable identity for reconnect/edit matching).
- No new migration required (`credentials` already `encrypted:array`).

### GoFileClient

`App\Services\GoFile\GoFileClient`

Constructor:

```php
public function __construct(
    private string $token,
    private ?string $rootFolder = null,
    private string $apiBase = 'https://api.gofile.io',
) {}
```

Key methods:

| Method | Purpose |
|--------|---------|
| `account(): array` | `GET /accounts/website` |
| `servers(): array` | `GET /servers` |
| `getContent(string $contentId, array $query = []): array` | list/metadata |
| `createFolder(string $parentFolderId, string $folderName, bool $public = false): array` | create folder |
| `upload(string $folderId, string $filename, $contents): array` | pick server + multipart upload |
| `uploadStream(string $folderId, string $filename, $stream): array` | stream upload |
| `delete(string|array $contentsId): void` | delete contents |
| `rename(string $contentId, string $name): void` | update name attribute |
| `move(string|array $contentsId, string $folderId): void` | move |
| `copy(string|array $contentsId, string $folderId): void` | copy |

Implementation notes:

- Use Laravel `Http` facade with timeouts; `Http::preventStrayRequests()` in tests.
- Throw `GoFileException` (or reuse a small dedicated exception) on non-ok status / HTTP errors.
- Never log the raw token.

### Path resolution

GoFile is ID-based; CloudX is path-based.

`GoFileAdapter` (or a small `GoFilePathResolver` helper used by the adapter) will:

1. Treat `''` / `'/'` as `root_folder` from credentials (refreshed via `account()` on connect and when missing).
2. Split path segments and walk children by **name** under each folder content id.
3. Cache `path => contentId` and `contentId => metadata` in Laravel Cache with a short TTL (e.g. 60–300s) and connection-scoped keys (include `connection id` or `account_id` + token hash prefix).
4. Invalidate cache entries for a folder (and descendants when needed) after write/delete/move/rename/copy.

Name collisions: if two children share a name (unlikely but possible), prefer the first folder for intermediate segments and the first exact type match for the leaf; document this limitation.

### GoFileAdapter

`App\Services\GoFile\GoFileAdapter` implements `League\Flysystem\FilesystemAdapter`.

| Flysystem method | Behavior |
|------------------|----------|
| `listContents` | Resolve dir id → `getContent` → map children to `FileAttributes` / `DirectoryAttributes` |
| `fileExists` / `directoryExists` | Resolve path; type check |
| `read` / `readStream` | Resolve file → download stream |
| `write` / `writeStream` | Resolve parent → `upload` |
| `delete` | Resolve file → `delete` |
| `deleteDirectory` | Resolve folder → `delete` (API accepts content ids) |
| `createDirectory` | Resolve parent → `createFolder` |
| `move` | Resolve source + dest parent → `move` (+ rename if basename changes) |
| `copy` | Resolve source + dest parent → `copy` (+ rename if needed) |
| `lastModified` / `fileSize` / `mimeType` | From cached metadata or content fetch |
| `visibility` / `setVisibility` | Unsupported → throw Flysystem unable helpers |

Map client failures to the matching `League\Flysystem\UnableTo*` exception (same pattern as `TelegramAdapter` / `OneDriveAdapter`).

### GoFileConnector

`App\Services\CloudStorage\Connectors\GoFileConnector`

- `provider()` → `CloudProvider::GOFILE`
- `redirectUrl()` → `''`
- `handleCallback()` → throws `LogicException` (credentials-only)
- `disk(CloudConnection)` → builds adapter from connection credentials
- `diskFromCredentials(array $credentials)` → used by connect test + store
- `capabilities()`:

```php
new ProviderCapabilities(
    browse: true,
    upload: true,
    download: true,
    delete: true,
    createFolder: true,
    share: true,  // CloudX share records; not native GoFile UI
    move: true,
);
```

Optional: implement `ProvidesDirectDownloadLink` when content metadata exposes a direct URL.

### Connection controller

`App\Http\Controllers\GoFileConnectionController` (mirror S3/FTP):

Routes:

- `POST /connections/gofile`
- `PATCH /connections/{connection}/gofile`

Create flow:

1. Validate `name` + `token` (`required|string|size:32|regex:/^[a-z0-9]+$/i`).
2. Call `GoFileClient::account()` with token.
3. Persist `CloudConnection` with encrypted credentials, `provider_id = account_id`, `status = connected`, quota null.
4. Return Inertia redirect / JSON consistent with other credential providers.

Update flow:

- Allow renaming connection and rotating token.
- If token omitted on edit, keep existing token (same pattern as S3 secret fields).

### Registration touch points

1. `CloudStorageServiceProvider` — register `GoFileConnector` in `CloudProviderRegistry`
2. `HomeController::availableProviders()` — treat `GOFILE` as `authType = credentials`
3. `CloudConnection::canEditName()` / `canEditConnection()` — include `GOFILE`
4. No `canReconnect()` (not OAuth)

### Config

No app-level API key required (token is per-connection). Optional:

```php
// config/services.php
'gofile' => [
    'api_base' => env('GOFILE_API_BASE', 'https://api.gofile.io'),
],
```

`.env.example`:

```
GOFILE_API_BASE=https://api.gofile.io
```

## Frontend design

### Types

`resources/js/types/cloud.ts`:

```ts
export interface GoFileConnectionConfig {
  token?: string; // never returned decrypted from server for display; edit form blank secret
}
```

Server should **not** send the raw token back to the browser on edit (match FTP/S3 secret handling). Show a placeholder “leave blank to keep existing token”.

### Form

`resources/js/components/cloud/GoFileConnectionForm.tsx` (template: S3/FTP form):

- Connection name
- API token (password input)
- Short help text: where to find token on gofile.io account page
- Submit → Wayfinder action for `GoFileConnectionController@store` / `update`

### Modal wiring

- `ProviderOption.tsx`: add `gofile` to credentials allowlist
- `ConnectStorageModal.tsx`: `isGoFileSelected` + render form
- Icon: `public/assets/svg/GoFile.svg`

## Error handling

| Condition | User-facing behavior |
|-----------|----------------------|
| Invalid token format | Validation error on form |
| Account endpoint 401/403 | “Invalid GoFile token” on connect/edit |
| Content not found | File browser empty/error toast via existing error paths |
| Upload server failure | Retry once with next server from `/servers` list; then fail |
| Rate limit / 429 | Surface as temporary failure; do not mark connection broken unless auth-related |
| Network timeout | Temporary failure message |

Auth failures during normal browse may set connection `error_message` following existing remote-provider conventions if present; otherwise leave status connected and show operation error.

## Testing

Pest feature/unit tests (mock HTTP; no real GoFile calls in CI):

| File | Focus |
|------|-------|
| `tests/Feature/GoFileClientTest.php` | account, list, upload server selection, error envelope |
| `tests/Feature/GoFileAdapterTest.php` | Flysystem method delegation + UnableTo* mapping + path walk |
| `tests/Feature/GoFileConnectorTest.php` | provider, capabilities, registry, disk build |
| `tests/Feature/GoFileConnectionControllerTest.php` | store/update validation, success path with faked account |

Use `Http::fake()` and `Http::preventStrayRequests()`.

## File checklist (implementation)

Backend:

1. `app/Enums/CloudProvider.php`
2. `app/Services/GoFile/GoFileClient.php`
3. `app/Services/GoFile/GoFileAdapter.php`
4. `app/Services/GoFile/GoFileException.php` (if needed)
5. `app/Services/CloudStorage/Connectors/GoFileConnector.php`
6. `app/Providers/CloudStorageServiceProvider.php`
7. `app/Http/Controllers/GoFileConnectionController.php`
8. `app/Http/Requests/StoreGoFileConnectionRequest.php`
9. `app/Http/Requests/UpdateGoFileConnectionRequest.php`
10. `app/Models/CloudConnection.php` (edit flags)
11. `app/Http/Controllers/HomeController.php` (credentials branch)
12. `routes/web.php`
13. `config/services.php` + `.env.example`
14. Tests (4 files)

Frontend:

15. `public/assets/svg/GoFile.svg`
16. `resources/js/types/cloud.ts`
17. `resources/js/components/cloud/GoFileConnectionForm.tsx`
18. `resources/js/components/cloud/ConnectStorageModal.tsx`
19. `resources/js/components/cloud/ProviderOption.tsx`

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Undocumented API drift | Isolate all HTTP in `GoFileClient`; adapter stays stable; add fixtures from real responses during dev |
| `X-Website-Token` required later | Feature-flag or follow-up ticket; Bearer-first |
| Path walk expensive on deep trees | Cache path→id; list only current folder (no deep recursive list by default) |
| Inactive free files archived by GoFile after inactivity | Document provider limitation in UI help text; not solvable in adapter |
| Large uploads | Prefer stream upload; rely on GoFile store servers; no multipart chunk API assumed in phase 1 |

## Implementation order

1. Enum + connector skeleton + registry wiring
2. Client + Http fakes tests
3. Adapter + path resolver + adapter tests
4. Connection controller + requests + controller tests
5. Frontend form + modal allowlist + icon
6. Manual smoke against a real token (developer-only)
7. Pint + targeted Pest suite

## References

- GoFile site: https://gofile.io
- Live API root probe: `https://api.gofile.io/` (status envelope)
- Servers: `https://api.gofile.io/servers`
- Existing CloudX patterns: Telegram Flysystem design (`2026-06-02-telegram-flysystem-adapter-design.md`), FTP credentials design (`2026-05-30-ftp-provider-support-design.md`)
