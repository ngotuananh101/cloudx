# Connection Actions Menu Design

## Goal

Add a three-dot actions menu to each connection in the sidebar. The menu should expose only actions supported by that connection while keeping the existing row click behavior for opening storage.

## Decisions

- Use a capability-driven menu.
- Use the inline row layout: the three-dot button sits inside the connection row.
- OAuth connections show Reconnect, Edit name, and Xoá connection.
- Config-based connections in the future can show Edit connection when supported.
- Deleting a connection requires a shadcn alert-dialog confirmation.
- Reconnect must target the same existing account, not silently switch to a different OAuth account.

## Sidebar UX

Each connection row in `CONNECTED STORAGE` remains a navigation link to that connection's storage browser. The three-dot button appears at the end of the row. Clicking the row navigates as it does today. Clicking the three-dot button opens a dropdown menu and must not trigger navigation.

Menu items are rendered from connection capabilities:

- `canReconnect`: show Reconnect.
- `canEditName`: show Edit name.
- `canEditConnection`: show Edit connection.
- `canDelete`: show Xoá connection.

For current OAuth providers, the menu contains:

1. Reconnect
2. Edit name
3. Xoá connection

`Xoá connection` is styled as destructive and opens a confirmation dialog. `Edit name` opens a small dialog with the current name prefilled and Cancel/Save actions. `Reconnect` redirects into the provider OAuth flow.

## Backend Data Contract

Connections shared with Inertia should include an action/capability object, for example:

```ts
actions: {
  canReconnect: boolean;
  canEditName: boolean;
  canEditConnection: boolean;
  canDelete: boolean;
}
```

For OAuth providers such as OneDrive and Google Drive:

- `canReconnect = true`
- `canEditName = true`
- `canEditConnection = false`
- `canDelete = true`

The capability values should come from backend provider/connection rules rather than frontend provider-name checks.

## Reconnect Flow

Add a reconnect route that receives the existing `CloudConnection`.

The reconnect route:

1. Confirms the connection belongs to the authenticated user.
2. Confirms the connection supports reconnect.
3. Stores pending reconnect context in the session:
   - connection id
   - provider
   - current provider id
4. Redirects to the provider OAuth URL.

The OAuth callback checks for pending reconnect context. When present:

1. The returned provider must match the pending provider.
2. The returned provider account id must match the existing connection's provider id.
3. If both match, update the existing connection credentials, status, quota fields, error message, and sync timestamp.
4. Clear the pending reconnect context and redirect with success.
5. If the account differs, clear the pending reconnect context, redirect with an error, and do not create or update any other connection.

Normal first-time connect behavior remains unchanged when no pending reconnect context exists.

## Edit Name Flow

Add a `PATCH` update-name route for `CloudConnection`.

The route:

1. Confirms the connection belongs to the authenticated user.
2. Confirms the connection supports `canEditName`.
3. Validates `name` as required, string, and max 255 characters.
4. Updates only the display name.
5. Redirects back with a success flash message.

Editing the name is separate from future `Edit connection` configuration. `Edit connection` remains hidden until a connection type supports editable configuration fields.

## Delete Flow

The delete action can reuse the existing disconnect behavior: flush the connection cache, delete the connection, and redirect with a success flash message.

The frontend must require confirmation through shadcn `alert-dialog` before submitting the destructive request.

## Frontend Structure

Keep `AuthenticatedLayout` focused by extracting sidebar connection UI into smaller components:

- `ConnectionNavItem`: renders one connection row, active state, icon, name, and three-dot trigger.
- `ConnectionActionsMenu`: renders dropdown items from `connection.actions`.
- `EditConnectionNameDialog`: manages the edit-name form and submit state.
- `DeleteConnectionDialog`: renders the destructive confirmation dialog.

Use shadcn `dropdown-menu` for the menu and shadcn `alert-dialog` for delete confirmation. Generate missing shadcn components if they are not already present.

Prefer Wayfinder route imports for generated Laravel routes instead of hardcoded URLs.

## Testing and Verification

Backend feature tests should cover:

- A user cannot update, delete, or reconnect another user's connection.
- Edit name validates the name field.
- Edit name updates only the selected connection name.
- Reconnect with the same OAuth account updates the existing connection credentials.
- Reconnect with a different OAuth account fails and leaves the existing connection unchanged.
- Delete flushes cache and removes the connection.

Manual frontend verification should cover:

- Clicking a connection row still navigates to storage.
- Clicking the three-dot button opens the menu without navigating.
- OAuth connections show Reconnect, Edit name, and Xoá connection.
- Delete opens an alert-dialog and only deletes after confirmation.
- Edit name updates the sidebar after save.
- Reconnect redirects into the OAuth provider flow.
