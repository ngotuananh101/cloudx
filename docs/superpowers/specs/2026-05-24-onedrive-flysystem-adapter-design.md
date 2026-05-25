# OneDrive Flysystem Adapter Design

## Goal

Implement OneDrive as a fully Flysystem-compatible storage backend inside the existing cloud storage abstraction. The OneDrive connector should no longer bypass Flysystem for browsing. It should expose a Laravel filesystem disk that supports normal Flysystem operations for listing, reading, writing, deleting, folders, move/copy, and metadata where Microsoft Graph supports them safely.

## Current state

- `OneDriveConnector` handles OAuth and direct Microsoft Graph listing.
- `OneDriveConnector::disk()` currently throws `RuntimeException`.
- `CloudFileBrowser` has a `BrowsesCloudFiles` branch for direct provider listing and a Flysystem branch for disk-backed providers.
- Google Drive already uses a Flysystem disk.
- Credentials are stored encrypted on `CloudConnection`.

## Chosen approach

Build a custom in-app OneDrive client and Flysystem adapter.

Rejected alternatives:

1. Porting or forking an existing OneDrive package: faster initially, but current packages are not compatible with Laravel 13/Flysystem v3 and would create external maintenance risk.
2. Wrapping the existing direct-listing connector: less code initially, but keeps provider logic coupled to the connector and does not create a clean Flysystem-compatible boundary.

## Architecture

### `app/Services/OneDrive/OneDriveClient.php`

Responsibilities:

- Own Microsoft Graph HTTP calls.
- Refresh expired access tokens using the connection refresh token.
- Persist refreshed credentials back to `CloudConnection`.
- Encode OneDrive paths safely for Graph path URLs.
- Return normalized Graph item arrays to the adapter.

Rules:

- Use `connectTimeout`, `timeout`, `retry`, and `throw` for Graph calls.
- Never log tokens or secrets.
- Refresh only once per operation path. A 401 after refresh should fail clearly, not loop.
- Preserve the existing refresh token when Microsoft does not return a new one.

### `app/Services/OneDrive/OneDriveAdapter.php`

Responsibilities:

- Implement Flysystem v3 adapter behavior.
- Translate Flysystem paths and operations into `OneDriveClient` calls.
- Return Flysystem attributes (`FileAttributes`, `DirectoryAttributes`).
- Convert Graph errors into Flysystem exceptions or booleans matching method contracts.

The adapter should not know OAuth flow details, Laravel routes, Inertia props, or dashboard metadata.

### `CloudStorageServiceProvider`

Register a Laravel filesystem driver:

- Driver name: `onedrive`.
- Factory creates `OneDriveClient`, `OneDriveAdapter`, `League\Flysystem\Filesystem`, and Laravel `FilesystemAdapter`.
- Driver config includes the `CloudConnection` or `connection_id` needed for token refresh and credential persistence.

### `OneDriveConnector`

Responsibilities after refactor:

- Keep OAuth redirect/callback logic.
- Keep provider capabilities.
- `disk(CloudConnection $connection)` returns `Storage::build(...)` using the `onedrive` driver.
- Remove `BrowsesCloudFiles` from OneDrive once the adapter supports `listContents`.

### `CloudFileBrowser`

After OneDrive adapter is in place:

- OneDrive should use the existing Flysystem listing path.
- The direct provider branch can remain for future providers that truly cannot provide Flysystem disks, but OneDrive should not implement `BrowsesCloudFiles`.

## Flysystem operation mapping

### Listing

- `listContents($path, $deep)`
  - Root path uses `/v1.0/me/drive/root/children`.
  - Nested path uses `/v1.0/me/drive/root:/{encodedPath}:/children`.
  - `$deep = false` returns direct children.
  - `$deep = true` recursively traverses folders.

### Existence

- `fileExists($path)`
  - Look up item by path and return true only when Graph item has `file` metadata.
- `directoryExists($path)`
  - Look up item by path and return true only when Graph item has `folder` metadata.

### Read

- `read($path)`
  - Download `/content` and return the body string.
- `readStream($path)`
  - Return a readable stream for `/content`.

### Write

- `write($path, $contents, Config $config)`
  - Use simple upload for small string content.
- `writeStream($path, $contents, Config $config)`
  - Use an upload session for streams and large files.

### Delete

- `delete($path)`
  - Delete a file item.
- `deleteDirectory($path)`
  - Delete a folder item and its children through Graph delete semantics.

### Directories

- `createDirectory($path, Config $config)`
  - Create the final folder name under its parent path.
  - Parent folder must exist. Missing parent should return a Flysystem unable-to-create-directory error.

### Move and copy

- `move($source, $destination, Config $config)`
  - Use Graph `PATCH` with `parentReference` and `name`.
- `copy($source, $destination, Config $config)`
  - Use Graph async copy endpoint.
  - Poll the monitor URL for a short bounded period.
  - If copy does not complete in time, throw a clear Flysystem unable-to-copy-file error.

### Metadata

- `lastModified($path)` maps from `lastModifiedDateTime`.
- `fileSize($path)` maps from `size`.
- `mimeType($path)` maps from Graph `file.mimeType` when available.

### Unsupported operations

These should fail explicitly because they do not map safely to OneDrive semantics:

- `visibility($path)`
- `setVisibility($path, $visibility)`
- `publicUrl($path, Config $config)`
- `temporaryUrl($path, Config $config)`
- `checksum($path, Config $config)` unless a Graph-provided hash is explicitly supported later.

## Error handling

- Graph 404 should become false for existence checks and Flysystem metadata/read/list exceptions for operations that require the item.
- Graph 401 should trigger one token refresh attempt before failing.
- Graph rate-limit/server errors should rely on configured retry, then throw Flysystem-compatible exceptions.
- Missing refresh token should throw a clear runtime/Flysystem exception before making HTTP calls.
- Adapter exceptions should not expose raw credentials, access tokens, refresh tokens, or client secrets.

## Tests

Add or update Pest tests for:

- `OneDriveClient` token refresh:
  - no refresh when access token is fresh.
  - refresh when expired.
  - persist refreshed credentials.
  - preserve refresh token when omitted by Microsoft.
  - missing refresh token throws and makes no HTTP request.
- Path encoding:
  - spaces, `#`, `%`, `&`, unicode, and nested folders.
- `OneDriveAdapter` operations:
  - `listContents` shallow and recursive.
  - `fileExists` and `directoryExists`.
  - `read` and `readStream`.
  - `write` and `writeStream`.
  - `delete` and `deleteDirectory`.
  - `createDirectory`.
  - `move`.
  - `copy` with completed async monitor response.
  - metadata: `lastModified`, `fileSize`, `mimeType`.
  - unsupported visibility/public URL/checksum behavior.
- Integration with current app:
  - `OneDriveConnector::disk()` returns a usable filesystem.
  - `CloudFileBrowser` lists OneDrive through Flysystem branch.
  - Existing Google behavior remains unchanged.

## Verification

Before completion run:

- `vendor/bin/pint --dirty --format agent`
- Targeted OneDrive/Flysystem/Pest tests.
- `php artisan test --compact`
- `pnpm run types:check`
- `pnpm run lint:check`
- `pnpm run build`

## Out of scope

- Sharing links and public permissions.
- Delta sync.
- Resumable upload progress UI.
- Background copy job orchestration beyond bounded polling in adapter.
- Replacing Google Drive adapter.
