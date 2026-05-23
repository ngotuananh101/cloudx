# Cloud Provider Abstraction + OneDrive Design

## Goal

Refactor the current Google Drive-specific cloud storage code into a provider-based architecture, then add OneDrive via `justus/flysystem-onedrive` (`https://github.com/doerffler/flysystem-onedrive`). The result should make future providers such as Dropbox, S3, and FTP additive instead of requiring controller/UI rewrites.

## Current Problem

The current implementation is tightly coupled to Google Drive:

- `CloudConnection::getDisk()` builds a Google Drive disk directly.
- `CloudConnectionController` owns Google OAuth details.
- `StorageBrowserController` handles path decoding, disk resolution, file mapping, filtering, and sorting.
- Dashboard and connect modal hardcode provider options and status.
- File browser duplicates path encoding and file formatting concerns in React.

This is workable for one provider, but it will grow quickly as more providers are added.

## Selected Approach

Use a full provider abstraction:

- One provider connector per cloud provider.
- Shared registry to resolve connectors.
- Shared disk factory/manager.
- Shared file browser service.
- DTO/data classes for provider account data, file rows, and provider capabilities.
- Frontend provider/file types and utilities reused across dashboard and file browser.

This adds more files now, but it keeps each provider isolated and makes future providers predictable.

## Backend Architecture

### Core Contract

Create `App\Services\CloudStorage\Contracts\CloudProviderConnector` with methods:

- `provider(): CloudProvider`
- `redirectUrl(): string`
- `handleCallback(Request $request): ConnectedAccountData`
- `disk(CloudConnection $connection): Filesystem`
- `capabilities(): ProviderCapabilities`

Each provider connector owns only provider-specific OAuth, API, token refresh, and disk construction.

### Provider Implementations

Create:

- `App\Services\CloudStorage\Connectors\GoogleDriveConnector`
- `App\Services\CloudStorage\Connectors\OneDriveConnector`

Google behavior should remain functionally equivalent to the current flow. OneDrive should use Microsoft OAuth and `justus/flysystem-onedrive`.

### Registry and Manager

Create:

- `App\Services\CloudStorage\CloudProviderRegistry`
- `App\Services\CloudStorage\CloudStorageManager`

`CloudProviderRegistry` maps `CloudProvider` enum values to connector instances. `CloudStorageManager` exposes high-level operations such as resolving a connector and building a disk for a `CloudConnection`.

`CloudConnection` should no longer know how each provider disk is built. Its disk behavior should delegate to `CloudStorageManager` or be removed in favor of service calls.

### Controller Refactor

Refactor `CloudConnectionController` into generic provider endpoints:

- `GET /oauth/{provider}/redirect`
- `GET /oauth/{provider}/callback`
- `DELETE /cloud-connections/{connection}`

The controller should validate/resolve the provider, call the connector, and persist the returned `ConnectedAccountData`.

The controller should not contain Google or Microsoft OAuth details.

### File Browser Service

Create `App\Services\CloudStorage\CloudFileBrowser` with responsibility for:

- Decoding incoming paths.
- Building the right disk via `CloudStorageManager`.
- Listing folder contents.
- Filtering hidden/system files.
- Mapping Flysystem attributes to `CloudFileData`.
- Sorting folders first, then natural name order.

`StorageBrowserController` should only authorize the connection, call the service, and render the Inertia page.

## Data Classes

Create:

### `App\Data\ConnectedAccountData`

Fields:

- `providerId`
- `name`
- `credentials`
- `totalSpace`
- `usedSpace`

Used by OAuth connectors to return normalized account data.

### `App\Data\CloudFileData`

Fields:

- `id`
- `path`
- `name`
- `type`
- `size`
- `updatedAt`
- `isDirectory`

Used by the browser service and Inertia props.

### `App\Data\ProviderCapabilities`

Fields:

- `browse`
- `upload`
- `download`
- `delete`
- `createFolder`
- `share`

Used by backend props and frontend action visibility.

### `App\Services\CloudStorage\PathEncoder`

Encodes and decodes cloud paths using URL-safe base64. It should handle Unicode safely and be mirrored in the frontend.

## OneDrive Design

### Dependency

Install:

```bash
composer require justus/flysystem-onedrive
```

Do not change dependencies without explicit approval during implementation.

### Config

Add Microsoft config under `config/services.php`:

- `services.microsoft.client_id`
- `services.microsoft.client_secret`
- `services.microsoft.redirect_uri`

Expected environment variables:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`

### OAuth

OneDrive should use Microsoft identity platform OAuth with scopes:

- `User.Read`
- `Files.ReadWrite.All`
- `offline_access`

Redirect flow:

1. User clicks OneDrive in the connect modal.
2. App redirects to Microsoft OAuth.
3. Microsoft redirects back with `code`.
4. App exchanges `code` for access/refresh token.
5. App calls Microsoft Graph `/me` for account identity.
6. App calls `/me/drive` for quota where available.
7. App creates or updates `CloudConnection` with encrypted credentials.

The `provider_id` should be stable, preferring Microsoft user id when available, with email as a display value.

### OneDrive Disk

Register an `onedrive` filesystem driver in `CloudStorageServiceProvider` or a dedicated provider.

Disk construction should use the connection's encrypted credentials and refresh the token before adapter construction when needed.

The driver should use `Justus\FlysystemOneDrive` classes according to the package API.

## Frontend Design

### Shared Types and Utilities

Create:

- `resources/js/types/cloud.ts`
- `resources/js/lib/cloud-path.ts`
- `resources/js/lib/format-bytes.ts`

`cloud.ts` should define provider, connection, file item, and capability types. `cloud-path.ts` should mirror backend URL-safe base64 behavior.

### Dashboard Refactor

Split `resources/js/pages/dashboard.tsx` into focused components:

- `StorageOverviewCards`
- `ConnectStorageModal`
- `ProviderOption`
- `UsageSummary`
- `RecentActivityList`

The dashboard should receive `availableProviders` from the backend instead of hardcoding Google/OneDrive/S3 in JSX.

Each provider option should include:

- `key`
- `label`
- `icon`
- `status`
- `redirectUrl`
- `capabilities`

Google and OneDrive should be active. Providers with enum entries but no connector can be shown as disabled/coming soon.

### File Browser Refactor

Split `resources/js/pages/files/index.tsx` into:

- `FileBrowserHeader`
- `FileToolbar`
- `VirtualizedFileTable`
- `EmptyFileState`

`FileTableRow` should use shared file types and show actions according to provider capabilities. Unsupported actions should be hidden or disabled, not hardcoded.

Folder navigation should use the shared path encoder and Wayfinder route helpers where possible.

## Error Handling

- Invalid provider route value: return 404 or validation-style redirect.
- OAuth denied/missing code: redirect to dashboard with a safe flash error.
- Token exchange/API failure: redirect to dashboard with a safe flash error and report/log details server-side.
- Browser listing failure: keep current graceful behavior, but show a generic user-facing error and log technical details.
- Unauthorized connection access: keep `403` behavior.

## Tests

### Feature Tests

Add or update Pest tests for:

- Provider registry resolves Google and OneDrive connectors.
- Google OAuth flow still creates/updates a connection.
- OneDrive OAuth callback creates/updates a connection.
- Credentials are encrypted at rest.
- Invalid provider is rejected.
- Users cannot browse another user's connection.
- File browser service maps and sorts folder/file data correctly.

### Unit Tests

Add tests for:

- `PathEncoder` Unicode encode/decode.
- File type detection.
- Provider capabilities serialization.

### Frontend/Build Verification

Run the existing project checks after implementation:

- PHP tests via Pest.
- Pint for dirty PHP files.
- Frontend typecheck/lint/build via the existing pnpm scripts.
- Manual app verification: dashboard connect modal shows Google + OneDrive; existing Google browsing still works; OneDrive connect flow reaches Microsoft redirect when config exists.

## Implementation Notes

- Follow existing Laravel/Inertia conventions.
- Use Laravel Boost docs before code changes.
- Keep provider-specific code inside connector classes.
- Prefer Wayfinder-generated route helpers on the frontend.
- Do not introduce provider-specific conditionals into React pages when backend provider metadata can drive the UI.
- Do not create new base directories outside existing Laravel/React structure except focused service/data folders needed for this design.
