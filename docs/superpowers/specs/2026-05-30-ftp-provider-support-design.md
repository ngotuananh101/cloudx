# FTP Provider Support Design

## Goal

Add FTP as a credential-based storage provider alongside the existing OAuth-based providers. Users should be able to connect an FTP server from the existing Connect Storage modal, browse files, upload through the existing upload manager, download, delete, and create folders using Flysystem's FTP adapter.

## Scope

In scope:

- FTP provider registration and provider metadata.
- Credential-based connection creation and editing.
- FTP connection test before saving.
- Encrypted credential storage in `cloud_connections.credentials`.
- Flysystem FTP disk creation from saved credentials.
- Connect Storage modal support for FTP form flow.
- Existing file browser/upload/delete/create folder flows working through FTP disk.
- Backend and frontend tests for the new provider flow.

Out of scope for this phase:

- FTP quota/storage usage display.
- SFTP support.
- Public sharing links.
- Returning decrypted FTP passwords to the browser.
- Background health checks for FTP connections.

## Architecture

The existing app models storage providers through `CloudProviderConnector`, `CloudProviderRegistry`, and encrypted `CloudConnection.credentials`. FTP fits the disk/capabilities side of that abstraction, but not the OAuth redirect/callback side. The design adds an explicit provider auth type so the UI and controller layer can distinguish OAuth providers from credential-based providers.

Provider metadata will include:

```ts
authType: 'oauth' | 'credentials'
```

Google Drive and OneDrive remain `oauth`. FTP becomes `credentials`.

## Backend Design

### Dependency

Add the Flysystem FTP adapter:

```bash
composer require league/flysystem-ftp:^3.0
```

Laravel supports FTP disks through Flysystem when this package is installed. The FTP connector will use `Storage::build()` with an on-demand disk instead of registering a custom filesystem driver.

### FTP connector

Create `App\Services\CloudStorage\Connectors\FtpConnector` implementing `CloudProviderConnector`.

Responsibilities:

- `provider()` returns `CloudProvider::FTP()`.
- `capabilities()` returns:
  - browse: true
  - upload: true
  - download: true
  - delete: true
  - createFolder: true
  - share: false
- `disk(CloudConnection $connection)` returns `Storage::build()` with driver `ftp` and normalized credentials.
- OAuth-only methods remain inert and are not used by FTP UI flow.

Disk config shape:

```php
[
    'driver' => 'ftp',
    'host' => $credentials['host'],
    'username' => $credentials['username'],
    'password' => $credentials['password'],
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
]
```

Use `FTP_BINARY` as the default transfer mode if explicitly configuring transfer mode.

### Provider registration

Register `FtpConnector` in `CloudStorageServiceProvider` so `CloudProviderRegistry` resolves it and `HomeController` includes FTP in available providers.

### Credential controller

Add a credential-specific controller for FTP, for example `FtpConnectionController`.

Routes:

- `POST /connections/ftp`
- `PATCH /connections/{connection}/ftp`

Creation flow:

1. Validate request fields.
2. Normalize credentials.
3. Build an FTP disk from the request credentials.
4. Test the connection by listing the configured root.
5. If test succeeds, create `CloudConnection` with:
   - `provider = CloudProvider::FTP()`
   - encrypted credentials array
   - `status = connected`
   - quota fields null
   - `provider_id` as a stable normalized identifier such as `username@host:port/root`
6. Return the new connection or redirect response matching existing Inertia conventions.

Edit flow:

1. Authorize ownership and provider is FTP.
2. Validate request fields.
3. Merge credentials with existing credentials.
4. If password is blank, preserve existing password.
5. Test merged credentials before saving.
6. Save updated encrypted credentials and connection name.

Password is never returned to the frontend. Edit forms receive non-secret config only.

### Validation

Basic fields:

- `name`: required string, max 255.
- `host`: required string, max 255.
- `port`: required integer, min 1, max 65535, default 21.
- `username`: required string, max 255.
- `password`: required on create, nullable on update, max 4096.
- `root`: nullable string, max 2048, normalized to no surrounding whitespace.
- `ssl`: boolean.
- `passive`: boolean.

Advanced fields:

- `timeout`: integer, min 1, max 300, default 30.
- `utf8`: boolean.
- `ignorePassiveAddress`: nullable boolean.
- `systemType`: nullable enum `unix`, `windows`.
- `recurseManually`: boolean, default true.
- `timestampsOnUnixListingsEnabled`: boolean, default false.

### Connection test

Before creating or updating a connection, the backend must verify the FTP credentials. The test should build the same disk config that will be saved and perform a shallow root listing. If Flysystem throws an exception, return a validation error and do not save.

This keeps invalid credentials out of `cloud_connections`.

### Cloud connection actions

FTP should support editing connection credentials. Update action metadata so FTP connections expose edit connection behavior. Rename should remain available for FTP.

FTP does not support quota in this phase, so `storageQuota.supported` remains false.

## Frontend Design

### Provider metadata

Extend `AvailableProvider` with:

```ts
authType: 'oauth' | 'credentials';
```

Existing OAuth providers keep redirect behavior. FTP opens a credential form in the modal.

### Connect Storage modal

`ConnectStorageModal` remains the entry point.

Behavior:

- Click OAuth provider: redirect to `provider.redirectUrl` as today.
- Click FTP provider: show FTP connection form inside the modal.

### FTP form

Basic section:

- Connection name
- Host
- Port
- Username
- Password
- Root path
- SSL toggle
- Passive mode toggle

Advanced collapsible section:

- Timeout
- UTF-8 toggle
- Ignore passive address toggle
- System type select: Auto, Unix, Windows
- Recurse manually toggle
- Timestamps on Unix listings toggle

Submit state:

- Button text should indicate testing/saving, e.g. `Testing connection...`.
- Backend validation errors display inline.
- A failed connection test keeps the modal open and shows the error.
- Success closes the modal and refreshes dashboard/connections.

Edit state:

- FTP edit form loads saved non-secret fields.
- Password input is blank and labeled as optional.
- Blank password preserves the existing password.
- A new password replaces the stored password.

## Data Flow

Create FTP connection:

1. User opens Connect Storage modal.
2. User selects FTP.
3. Modal renders FTP form.
4. User submits credentials.
5. Frontend posts to `POST /connections/ftp`.
6. Backend validates and tests FTP root listing.
7. Backend saves encrypted credentials if test succeeds.
8. Frontend closes modal and refreshes providers/connections.
9. User can open FTP connection in file browser.

Browse/upload flow after connection:

1. Existing file browser requests storage path for the FTP connection.
2. `CloudStorageManager` resolves `FtpConnector`.
3. `FtpConnector::disk()` builds a Flysystem FTP disk from encrypted credentials.
4. Existing browser/upload/folder/delete controllers use that disk.

## Error Handling

- Validation errors return field-level messages.
- Connection test failures return a general credential/connectivity error without exposing password.
- FTP exceptions should be converted to user-readable messages such as `Could not connect to the FTP server. Check host, port, credentials, SSL, and passive mode settings.`
- Passwords must never be logged or returned to the frontend.
- Saved credentials should only be updated after a successful connection test.

## Testing

Backend tests:

- `FtpConnector` builds a disk config from credentials.
- FTP provider is registered in `CloudProviderRegistry`.
- Dashboard provider metadata includes FTP with `authType: credentials`.
- Create route validates required fields.
- Create route does not save when FTP connection test fails.
- Create route saves encrypted credentials when connection test succeeds.
- Edit route preserves password when password field is blank.
- Edit route replaces password when a new password is provided.
- FTP connection actions include edit connection.

Frontend checks:

- TypeScript type check for `authType` metadata.
- Provider option opens FTP form instead of redirecting for `credentials` providers.
- Advanced section toggles.
- Password is not prefilled in edit mode.

Manual verification:

- Connect to a real FTP server.
- Browse root and subfolders.
- Upload a file.
- Download a file.
- Create a folder.
- Delete a file/folder.
- Edit connection without changing password.
- Edit connection with a new password.

## Decisions

- FTP uses credential modal flow, not OAuth redirect.
- FTP form uses Basic + Advanced collapsible fields.
- Backend must test root listing before saving.
- Password is never returned to frontend on edit.
- FTP quota is unsupported in phase one.
- No database migration is required for basic FTP support.

## Self-Review

- Placeholder scan: no TBD/TODO placeholders remain.
- Consistency: design follows existing provider registry, encrypted credentials, and Flysystem disk usage.
- Scope: focused on FTP only; SFTP and quota are explicitly out of scope.
- Ambiguity: credential fields, connection test behavior, password edit behavior, and quota behavior are explicitly defined.
