# File Browser Breadcrumb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the file browser breadcrumb to show the current full path while keeping only the latest three folders visible and exposing older hidden folders through an ellipsis menu.

**Architecture:** Keep breadcrumb logic client-side because `StorageBrowserController` already provides `decodedPath` and `FileBrowserHeader` already owns the current breadcrumb UI. Add a small path-segment model inside `FileBrowserHeader`, render the existing home icon unchanged, render an ellipsis dropdown only when more than three folders exist, and navigate via a typed callback from the page. Reuse the existing shadcn/Radix `DropdownMenu` component already present in `resources/js/components/ui/dropdown-menu.tsx`.

**Tech Stack:** Laravel 13, Inertia React 3, React 19, TypeScript, Tailwind CSS 4, shadcn/Radix dropdown-menu, Laravel Wayfinder route helpers.

---

## File Structure

- Modify: `resources/js/components/files/FileBrowserHeader.tsx`
  - Build breadcrumb segments from `decodedPath`.
  - Show home icon exactly as now.
  - Show at most the latest three folder segments inline.
  - Show an ellipsis dropdown containing hidden earlier path segments when path depth is greater than three.
  - Call `onNavigatePath(path)` when a breadcrumb folder or hidden menu item is selected.
- Modify: `resources/js/pages/files/index.tsx`
  - Add `handleNavigatePath(path: string)` using existing `encodeCloudPath()` and `storageIndex.url()` route helper.
  - Pass `onNavigatePath` into `FileBrowserHeader`.
- No backend changes required.
- No new dependencies required.

---

## Task 1: Add Breadcrumb Navigation Callback

**Files:**
- Modify: `resources/js/pages/files/index.tsx`
- Modify: `resources/js/components/files/FileBrowserHeader.tsx`

- [ ] **Step 1: Update `FileBrowserHeaderProps` with path navigation callback**

In `resources/js/components/files/FileBrowserHeader.tsx`, change the props interface from:

```tsx
interface FileBrowserHeaderProps {
    connection: CloudConnection;
    decodedPath?: string | null;
    onNavigateHome: () => void;
}
```

to:

```tsx
interface FileBrowserHeaderProps {
    connection: CloudConnection;
    decodedPath?: string | null;
    onNavigateHome: () => void;
    onNavigatePath: (path: string) => void;
}
```

Update the component parameters from:

```tsx
export function FileBrowserHeader({
    connection,
    decodedPath,
    onNavigateHome,
}: FileBrowserHeaderProps) {
```

to:

```tsx
export function FileBrowserHeader({
    connection,
    decodedPath,
    onNavigateHome,
    onNavigatePath,
}: FileBrowserHeaderProps) {
```

- [ ] **Step 2: Add path navigation handler in the file browser page**

In `resources/js/pages/files/index.tsx`, add this function after `handleNavigateHome`:

```tsx
    const handleNavigatePath = (path: string) => {
        const encodedPath = encodeCloudPath(path);

        router.visit(
            storageIndex.url({ connection: connection.id, path: encodedPath }),
        );
    };
```

- [ ] **Step 3: Pass the new callback to `FileBrowserHeader`**

In `resources/js/pages/files/index.tsx`, update the header render from:

```tsx
            <FileBrowserHeader
                connection={connection}
                decodedPath={decodedPath}
                onNavigateHome={handleNavigateHome}
            />
```

to:

```tsx
            <FileBrowserHeader
                connection={connection}
                decodedPath={decodedPath}
                onNavigateHome={handleNavigateHome}
                onNavigatePath={handleNavigatePath}
            />
```

- [ ] **Step 4: Run type check and verify expected failure/passing state**

Run through PowerShell:

```powershell
pnpm run types:check
```

Expected: PASS after both files are updated together. If it fails, the failure should point to a missing `onNavigatePath` prop or an incorrect callback type.

---

## Task 2: Build Breadcrumb Segment Model

**Files:**
- Modify: `resources/js/components/files/FileBrowserHeader.tsx`

- [ ] **Step 1: Add breadcrumb segment type and helper**

At the top of `resources/js/components/files/FileBrowserHeader.tsx`, after the props interface, add:

```tsx
interface BreadcrumbSegment {
    label: string;
    path: string;
}

function breadcrumbSegments(decodedPath?: string | null): BreadcrumbSegment[] {
    return (decodedPath ?? '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((label, index, segments) => ({
            label,
            path: segments.slice(0, index + 1).join('/'),
        }));
}
```

- [ ] **Step 2: Derive visible and hidden breadcrumb segments**

Inside `FileBrowserHeader`, before `return`, add:

```tsx
    const segments = breadcrumbSegments(decodedPath);
    const hiddenSegments = segments.slice(0, -3);
    const visibleSegments = segments.slice(-3);
    const hasHiddenSegments = hiddenSegments.length > 0;
```

- [ ] **Step 3: Run type check**

Run through PowerShell:

```powershell
pnpm run types:check
```

Expected: PASS. The helper is pure TypeScript and should not require backend changes.

---

## Task 3: Render Full Breadcrumb with Ellipsis Menu

**Files:**
- Modify: `resources/js/components/files/FileBrowserHeader.tsx`

- [ ] **Step 1: Add dropdown imports**

Change the imports in `resources/js/components/files/FileBrowserHeader.tsx` from:

```tsx
import { ChevronRight, Home } from 'lucide-react';
import type { CloudConnection } from '@/types/cloud';
```

to:

```tsx
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CloudConnection } from '@/types/cloud';
```

- [ ] **Step 2: Replace current single-folder title breadcrumb**

Replace the current block inside `<div className="mt-1 flex items-center gap-2">`:

```tsx
                    {decodedPath ? (
                        <>
                            <button
                                type="button"
                                onClick={onNavigateHome}
                                className="text-2xl font-extrabold tracking-tight text-gray-400 transition-colors hover:text-gray-900"
                                aria-label="Go to root folder"
                            >
                                <Home className="h-5 w-5" />
                            </button>
                            <span className="text-lg font-medium text-gray-300">
                                /
                            </span>
                            <h2 className="max-w-md truncate text-lg font-medium tracking-tight text-gray-900">
                                {decodedPath.split('/').pop() || decodedPath}
                            </h2>
                        </>
                    ) : (
                        <h2 className="text-xl font-extrabold tracking-tight text-gray-900">
                            My Files
                        </h2>
                    )}
```

with:

```tsx
                    {segments.length > 0 ? (
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={onNavigateHome}
                                className="text-2xl font-extrabold tracking-tight text-gray-400 transition-colors hover:text-gray-900"
                                aria-label="Go to root folder"
                            >
                                <Home className="h-5 w-5" />
                            </button>

                            {hasHiddenSegments && (
                                <>
                                    <span className="text-lg text-gray-300">/</span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="inline-flex h-7 items-center rounded-md px-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900"
                                                aria-label="Show hidden breadcrumb folders"
                                            >
                                                <MoreHorizontal className="h-5 w-5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-56">
                                            {hiddenSegments.map((segment) => (
                                                <DropdownMenuItem
                                                    key={segment.path}
                                                    onSelect={() =>
                                                        onNavigatePath(segment.path)
                                                    }
                                                >
                                                    <span className="truncate">
                                                        {segment.label}
                                                    </span>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}

                            {visibleSegments.map((segment, index) => {
                                const isLast = index === visibleSegments.length - 1;

                                return (
                                    <div
                                        key={segment.path}
                                        className="flex min-w-0 items-center gap-2"
                                    >
                                        <span className="text-lg text-gray-300">/</span>
                                        {isLast ? (
                                            <h2 className="max-w-[18rem] truncate text-lg font-medium tracking-tight text-gray-900">
                                                {segment.label}
                                            </h2>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onNavigatePath(segment.path)
                                                }
                                                className="max-w-[10rem] truncate text-lg text-gray-500 transition-colors hover:text-gray-900"
                                            >
                                                {segment.label}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <h2 className="text-xl font-extrabold tracking-tight text-gray-900">
                            My Files
                        </h2>
                    )}
```

This preserves the existing home icon button and only changes the folder breadcrumb rendering.

- [ ] **Step 3: Verify breadcrumb depth behavior manually in code**

For `decodedPath = 'A/B/C'`, expected inline folders:

```txt
Home / A / B / C
```

For `decodedPath = 'A/B/C/D'`, expected inline folders:

```txt
Home / ... / B / C / D
```

Ellipsis menu contains:

```txt
A
```

For `decodedPath = 'A/B/C/D/E'`, expected inline folders:

```txt
Home / ... / C / D / E
```

Ellipsis menu contains:

```txt
A
B
```

Selecting `B` navigates to path `A/B`.

- [ ] **Step 4: Format and type check**

Run through PowerShell:

```powershell
pnpm exec prettier --write resources/js/components/files/FileBrowserHeader.tsx resources/js/pages/files/index.tsx
pnpm run types:check
```

Expected: PASS.

---

## Task 4: Manual Browser Verification

**Files:**
- No source changes unless verification finds a bug.

- [ ] **Step 1: Start or use the existing dev server**

If the app is not already running, ask before starting the dev stack. If approved, run through PowerShell:

```powershell
composer run dev
```

Expected: Laravel and Vite dev servers start.

- [ ] **Step 2: Verify root breadcrumb**

Open a storage connection root page.

Expected:

```txt
My Files
```

No ellipsis menu is visible.

- [ ] **Step 3: Verify one to three folder levels**

Navigate to a folder path with one, two, and three folder segments.

Expected examples:

```txt
Home / FolderA
Home / FolderA / FolderB
Home / FolderA / FolderB / FolderC
```

No ellipsis menu is visible for these depths.

- [ ] **Step 4: Verify four or more folder levels**

Navigate to a path with at least four folder segments.

Expected:

```txt
Home / ... / FolderB / FolderC / FolderD
```

Only the latest three folders are inline after the ellipsis.

- [ ] **Step 5: Verify hidden folder menu navigation**

Click the ellipsis menu.

Expected:

- Hidden earlier folders appear in order from root toward the visible path.
- Clicking a hidden folder navigates to that folder path.
- The home icon still navigates to root.
- Clicking visible non-current folders navigates to that folder path.
- The current folder is displayed as text, not a button.

---

## Task 5: Commit

**Files:**
- Modify: `resources/js/components/files/FileBrowserHeader.tsx`
- Modify: `resources/js/pages/files/index.tsx`

- [ ] **Step 1: Inspect diff**

Run through PowerShell:

```powershell
git diff -- resources/js/components/files/FileBrowserHeader.tsx resources/js/pages/files/index.tsx
```

Expected: diff only contains breadcrumb-related changes.

- [ ] **Step 2: Commit changes**

Only commit if the user asks to commit. If committing, run:

```powershell
git add resources/js/components/files/FileBrowserHeader.tsx resources/js/pages/files/index.tsx
git commit -m "feat: improve file browser breadcrumb"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: The plan preserves the home icon, shows the current path, limits inline folders to the latest three, and adds an ellipsis menu for hidden folders when path depth exceeds three.
- Placeholder scan: No TBD/TODO placeholders remain. All code changes and commands are explicit.
- Type consistency: `onNavigatePath(path: string)` is introduced in `FileBrowserHeaderProps`, implemented in `files/index.tsx`, and used consistently in visible and hidden breadcrumb items.
