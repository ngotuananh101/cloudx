# Share View Page — Design Spec

**Date:** 2026-06-10
**Status:** Approved

## Overview

Public-facing page for viewing shared files/folders via `/s/{uuid}`. Uses Hero Centered layout with full branding, DocViewer-based preview (reusing existing `@iamjariwala/react-doc-viewer`), folder hierarchy navigation, password protection page, and custom error pages.

## Architecture

### Routes

```php
// routes/web.php — public, no auth required
Route::prefix('s')->group(function () {
    Route::get('{uuid}', [ShareViewController::class, 'index']);
    Route::post('{uuid}/verify', [ShareViewController::class, 'verify']);
    Route::get('{uuid}/preview', [ShareViewController::class, 'preview']);
    Route::get('{uuid}/download', [ShareViewController::class, 'download']);
});
```

### Controller: `ShareViewController`

**`index(string $uuid)`** — Main entry point
- Find CloudShare by UUID, load user + cloudConnection relationships
- Check expiration → render `share/error` with reason `expired`
- Check password (session-based verification) → render `share/password`
- For files: fetch file metadata from cloud provider → render `share/view`
- For folders: read `?path=` query param (decoded cloud path), list directory contents → render `share/view` with file list
- Props passed: `share`, `files` (if folder), `file` (if single file), `currentPath`, `previewUrl`, `downloadUrl`

**`verify(string $uuid)`** — Password verification
- Validate password against `$share->password`
- On success: set session `share_verified_{$share->id}` = true, redirect back to index
- On failure: redirect back with error

**`preview(string $uuid)`** — File preview endpoint
- Verify session access (same as index checks)
- Resolve `?path=` to get the target file
- Use cloud connector to get a temporary/signed URL or stream the file
- Return redirect or stream response (same pattern as existing `FileController@preview`)

**`download(string $uuid)`** — File download endpoint
- Same verification as preview
- For files: redirect to signed download URL or stream with Content-Disposition header
- For folders: download each file individually (zip streaming across providers is complex and deferred to a future iteration). The "Download All" button iterates file downloads in sequence via JS.

### Pages

**`resources/js/pages/share/view.tsx`** — Main share view page
- Single file: Hero Centered layout with file icon, name, metadata, Download + Preview buttons, DocViewer preview area below
- Folder: Hero header with folder icon/name/count, Download All button, file table with navigate/download actions, breadcrumb for subfolder navigation
- Fullscreen toggle: expand preview to fullscreen (like existing FilePreviewModal)
- Uses `ShareLayout`
- Navigation: `router.visit(/s/${uuid}?path=${encodeCloudPath(file.path)})` for subfolder navigation

**`resources/js/pages/share/password.tsx`** — Password entry page
- Lock icon, sender info, password input field, Unlock button
- POST to `/s/{uuid}/verify` via Inertia form
- Uses `ShareLayout`

**`resources/js/pages/share/error.tsx`** — Error page
- Accepts `reason` prop: `expired`, `not_found`, `wrong_password`
- Different icons/messages per reason
- "Back to CloudX" button
- Uses `ShareLayout`

### Layout: `ShareLayout`

**`resources/js/layouts/ShareLayout.tsx`**
- Header: CloudX logo (left) + share type badge + ThemeToggle (right)
- Footer: "Powered by CloudX — Your Digital Curator"
- No sidebar, no authenticated nav
- Dark mode support
- Responsive: max-width container centered on page

## UI Components

### `ShareFileView` (inline in `share/view.tsx`)

**Single file state:**
- Shared info bar: sender avatar + name + expiry badge
- Large file type icon (72px, colored background by type)
- File name (18px bold)
- Metadata line: size • file type
- Button group: Download (primary) + Preview (outline)
- DocViewer preview area below buttons
- Fullscreen toggle button in preview header bar

**Folder state:**
- Shared info bar: sender avatar + name + expiry badge
- Folder icon + name + item count + total size
- "Download All (.zip)" button
- File table: icon, name, size, download action
- Folder rows are clickable to navigate into subfolders
- Breadcrumb above table when inside a subfolder

### `SharePreviewViewer` (component in `resources/js/components/share/`)

Reuses `@iamjariwala/react-doc-viewer` + `DocViewerRenderers`:
- Same setup as `FilePreviewModal` — passes preview URL as document URI
- Fullscreen toggle: expands preview area to fill viewport
- Custom NoRenderer fallback: file icon + "Preview not supported" + Download button
- Custom LoadingRenderer: spinner + "Loading preview..."
- Respects dark mode via ThemeProvider
- Size limit check: shows "File too large" message if exceeds `max_preview_size`

### File type icons

Reuse existing file type icon logic from `FileTableRow` component. Same icon mapping by extension.

### Fullscreen view

- Toggle button (Maximize2/Minimize2 icons from lucide-react)
- When active: preview expands to fill the entire viewport (fixed overlay)
- ESC key or click minimize button to exit fullscreen
- Download button remains accessible in fullscreen mode
- Same pattern as existing `FilePreviewModal` fullscreen toggle

## Data Flow

```
User visits /s/{uuid}
  │
  ├─ Share not found → error page (not_found)
  ├─ Share expired → error page (expired)
  ├─ Password protected + not verified → password page
  │   └─ POST verify → redirect to index on success / error on failure
  │
  └─ Access granted
      ├─ is_directory = false (single file)
      │   ├─ Show file info + Download button
      │   └─ DocViewer renders preview via /s/{uuid}/preview?path=...
      │       └─ Server streams/redirects to cloud provider signed URL
      │
      └─ is_directory = true (folder)
          ├─ Read ?path= query param (default: root of shared folder)
          ├─ List directory via cloud connector
          ├─ Display file table + breadcrumb
          └─ Navigate: router.visit with updated ?path=
              └─ Click file → preview in DocViewer or download
```

## Security

- Password verification stored in session: `share_verified_{$share->id}`
- Preview/download endpoints also verify session access (not just the index page)
- Signed URLs from cloud providers are temporary (not exposed to client)
- No authentication required — public access by design
- Rate limiting on password verification to prevent brute force

## Conventions Followed

- Inertia render pattern (server-side routing, React pages)
- `encodeCloudPath()` for path encoding (same as files/index.tsx)
- `?path=` query param for folder navigation (same pattern as storage routes)
- `@iamjariwala/react-doc-viewer` for file preview (same as FilePreviewModal)
- shadcn/ui components for buttons, inputs, radio groups
- Dark mode via ThemeProvider + Tailwind dark: classes
- GuestLayout pattern for unauthenticated pages (but with custom ShareLayout)
- Wayfinder route generation for new routes
- Pest tests for controller logic
