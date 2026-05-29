# Global Upload Progress Reverb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global Dropbox-like upload progress panel that stays visible across authenticated pages and receives backend task status updates through Laravel Reverb on `users.{userId}.cloud-tasks`.

**Architecture:** Keep binary chunk upload over HTTP, but move upload queue ownership from `resources/js/pages/files/index.tsx` into a global React upload manager rendered by `AuthenticatedLayout`. Backend broadcasts `CloudUploadTaskUpdated` whenever task status changes and when upload progress crosses a 5% boundary, using a private per-user channel authorized in `routes/channels.php`.

**Tech Stack:** Laravel 13, Laravel Reverb, Laravel broadcasting private channels, Pest 4, Inertia React 3, React 19, `@laravel/echo-react`, Wayfinder routes, Tailwind CSS 4.

---

## File Structure

### Backend

- Create `app/Events/CloudUploadTaskUpdated.php`
  - Broadcasts upload task snapshots to `users.{userId}.cloud-tasks`.
  - Uses `ShouldBroadcastNow` for immediate UI feedback and `ShouldRescue` so upload actions are not broken by broadcast transport failures.
- Create `app/Support/CloudUploadTaskData.php`
  - Single serializer for task JSON responses and broadcast payloads.
- Create `app/Support/CloudUploadTaskBroadcaster.php`
  - Centralizes when to dispatch broadcast events.
  - Broadcasts on every status change and when progress crosses 5% increments.
  - Stores `last_broadcast_progress` in `CloudTask.payload`.
- Modify `routes/channels.php`
  - Add `users.{userId}.cloud-tasks` private channel authorization.
- Modify `app/Http/Controllers/CloudUploadTaskController.php`
  - Use shared serializer.
  - Broadcast on create/pause/resume/cancel.
- Modify `app/Http/Controllers/CloudUploadTaskChunkController.php`
  - Use shared serializer.
  - Broadcast upload progress only when 5% threshold changes.
  - Broadcast queued status when all chunks arrive.
- Modify `app/Jobs/UploadCloudTaskFileJob.php`
  - Broadcast processing/completed/failed status updates.
- Test with new `tests/Feature/CloudUploadTaskBroadcastTest.php`.

### Frontend

- Modify `resources/js/types/cloud.ts`
  - Add upload task status/payload/queue types shared by manager and panel.
- Create `resources/js/lib/request-json.ts`
  - Move existing JSON/fetch helper out of `files/index.tsx`.
- Create `resources/js/contexts/UploadManagerContext.tsx`
  - Global queue state, file upload orchestration, socket event merge, pause/resume/cancel/retry/close actions.
- Create `resources/js/components/files/UploadProgressPanel.tsx`
  - Dropbox-like floating bottom-right panel.
- Modify `resources/js/layouts/AuthenticatedLayout.tsx`
  - Wrap authenticated UI in `UploadManagerProvider` and render `UploadProgressPanel` once.
- Modify `resources/js/pages/files/index.tsx`
  - Remove local queue UI/state.
  - Use `useUploadManager()` for file selection uploads.
  - Register current file browser location so completed tasks can refresh the list.

---

## Task 1: Backend Broadcast Event, Serializer, Channel, and Tests

**Files:**
- Create: `app/Events/CloudUploadTaskUpdated.php`
- Create: `app/Support/CloudUploadTaskData.php`
- Modify: `routes/channels.php`
- Test: `tests/Feature/CloudUploadTaskBroadcastTest.php`

- [ ] **Step 1: Write failing tests for channel authorization and event payload**

Create `tests/Feature/CloudUploadTaskBroadcastTest.php` with:

```php
<?php

use App\Events\CloudUploadTaskUpdated;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Support\Facades\Broadcast;

it('authorizes users to subscribe to their cloud task channel', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => "private-users.{$user->id}.cloud-tasks",
        ])
        ->assertOk();

    $this->actingAs($otherUser)
        ->postJson('/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => "private-users.{$user->id}.cloud-tasks",
        ])
        ->assertForbidden();
});

it('broadcasts upload task snapshots on the users cloud task channel', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'target_path' => 'documents',
        'name' => 'proposal.pdf',
        'payload' => [
            'filename' => 'proposal.pdf',
            'mime_type' => 'application/pdf',
            'size' => 1_000,
            'chunk_size' => 100,
            'total_chunks' => 10,
            'uploaded_chunks_count' => 3,
        ],
    ]);

    $event = new CloudUploadTaskUpdated($task->refresh());

    expect($event->broadcastOn())->toEqual([new PrivateChannel("users.{$user->id}.cloud-tasks")]);
    expect($event->broadcastAs())->toBe('CloudUploadTaskUpdated');
    expect($event->broadcastWith())->toMatchArray([
        'id' => $task->id,
        'connection_id' => $connection->id,
        'name' => 'proposal.pdf',
        'target_path' => 'documents',
        'status' => 'pending',
        'progress' => 30,
        'uploaded_chunks_count' => 3,
        'total_chunks' => 10,
        'error_message' => null,
    ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
php artisan test --compact tests/Feature/CloudUploadTaskBroadcastTest.php
```

Expected: FAIL because `CloudUploadTaskUpdated`, upload factory state, or the channel does not exist yet.

- [ ] **Step 3: Add upload factory state if missing**

Inspect `database/factories/CloudTaskFactory.php`. If it does not have an upload state, add:

```php
use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;

public function upload(): static
{
    return $this->state(fn (array $attributes): array => [
        'type' => CloudTaskType::Upload(),
        'status' => CloudTaskStatus::Pending(),
        'target_path' => '',
        'name' => 'upload.txt',
        'payload' => [
            'filename' => 'upload.txt',
            'mime_type' => 'text/plain',
            'size' => 100,
            'chunk_size' => 100,
            'total_chunks' => 1,
            'uploaded_chunks_count' => 0,
        ],
        'result' => null,
        'error_message' => null,
    ]);
}
```

If the factory already has an equivalent state, keep the existing pattern and do not add a duplicate.

- [ ] **Step 4: Create shared task serializer**

Create `app/Support/CloudUploadTaskData.php`:

```php
<?php

namespace App\Support;

use App\Models\CloudTask;

class CloudUploadTaskData
{
    /**
     * @return array{
     *     id: int,
     *     connection_id: int,
     *     name: string,
     *     type: string,
     *     status: string,
     *     status_value: int,
     *     target_path: string,
     *     payload: array<string, mixed>,
     *     progress: int,
     *     uploaded_chunks_count: int,
     *     total_chunks: int,
     *     result: array<string, mixed>|null,
     *     error_message: string|null,
     *     uploaded_chunks: array<int, int>,
     *     updated_at: string|null
     * }
     */
    public static function fromTask(CloudTask $task): array
    {
        $payload = $task->payload ?? [];
        $uploadedChunksCount = (int) ($payload['uploaded_chunks_count'] ?? 0);
        $totalChunks = (int) ($payload['total_chunks'] ?? 0);
        $progress = $totalChunks > 0 ? (int) floor(($uploadedChunksCount / $totalChunks) * 100) : 0;

        if ($task->status->description === 'completed') {
            $progress = 100;
        }

        return [
            'id' => $task->id,
            'connection_id' => $task->cloud_connection_id,
            'name' => $task->name,
            'type' => $task->type->description,
            'status' => $task->status->description,
            'status_value' => $task->status->value,
            'target_path' => $task->target_path,
            'payload' => $payload,
            'progress' => $progress,
            'uploaded_chunks_count' => $uploadedChunksCount,
            'total_chunks' => $totalChunks,
            'result' => $task->result,
            'error_message' => $task->error_message,
            'uploaded_chunks' => $task->relationLoaded('chunks') ? $task->chunks->pluck('index')->values()->all() : [],
            'updated_at' => $task->updated_at?->toJSON(),
        ];
    }
}
```

- [ ] **Step 5: Create broadcast event**

Create `app/Events/CloudUploadTaskUpdated.php`:

```php
<?php

namespace App\Events;

use App\Models\CloudTask;
use App\Support\CloudUploadTaskData;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CloudUploadTaskUpdated implements ShouldBroadcastNow, ShouldRescue
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public CloudTask $task) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('users.'.$this->task->user_id.'.cloud-tasks')];
    }

    public function broadcastAs(): string
    {
        return 'CloudUploadTaskUpdated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return CloudUploadTaskData::fromTask($this->task);
    }
}
```

- [ ] **Step 6: Add private channel authorization**

Modify `routes/channels.php` to include:

```php
Broadcast::channel('users.{userId}.cloud-tasks', function ($user, int $userId): bool {
    return (int) $user->id === $userId;
});
```

Keep the existing `App.Models.User.{id}` channel.

- [ ] **Step 7: Run tests to verify they pass**

Run:

```bash
php artisan test --compact tests/Feature/CloudUploadTaskBroadcastTest.php
```

Expected: PASS.

- [ ] **Step 8: Format PHP**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: Pint formats only touched PHP files.

- [ ] **Step 9: Commit**

```bash
git add app/Events/CloudUploadTaskUpdated.php app/Support/CloudUploadTaskData.php routes/channels.php tests/Feature/CloudUploadTaskBroadcastTest.php database/factories/CloudTaskFactory.php
git commit -m "feat: add upload task broadcast event"
```

---

## Task 2: Backend Broadcast Throttling and Status Updates

**Files:**
- Create: `app/Support/CloudUploadTaskBroadcaster.php`
- Modify: `app/Http/Controllers/CloudUploadTaskController.php`
- Modify: `app/Http/Controllers/CloudUploadTaskChunkController.php`
- Modify: `app/Jobs/UploadCloudTaskFileJob.php`
- Test: `tests/Feature/CloudUploadTaskBroadcastTest.php`

- [ ] **Step 1: Add failing tests for percent throttling and status broadcasting**

Append to `tests/Feature/CloudUploadTaskBroadcastTest.php`:

```php
use App\Events\CloudUploadTaskUpdated;
use App\Support\CloudUploadTaskBroadcaster;
use Illuminate\Support\Facades\Event;

it('broadcasts upload progress only when a five percent boundary changes', function () {
    Event::fake([CloudUploadTaskUpdated::class]);

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create([
        'payload' => [
            'filename' => 'video.mov',
            'mime_type' => 'video/quicktime',
            'size' => 10_000,
            'chunk_size' => 100,
            'total_chunks' => 100,
            'uploaded_chunks_count' => 4,
            'last_broadcast_progress' => 0,
        ],
    ]);

    app(CloudUploadTaskBroadcaster::class)->broadcastProgressIfNeeded($task->refresh());
    Event::assertNotDispatched(CloudUploadTaskUpdated::class);

    $payload = $task->payload;
    $payload['uploaded_chunks_count'] = 5;
    $task->forceFill(['payload' => $payload])->save();

    app(CloudUploadTaskBroadcaster::class)->broadcastProgressIfNeeded($task->refresh());

    Event::assertDispatched(CloudUploadTaskUpdated::class, fn (CloudUploadTaskUpdated $event): bool => $event->task->is($task));
    expect($task->refresh()->payload['last_broadcast_progress'])->toBe(5);
});

it('broadcasts every explicit upload task status update', function () {
    Event::fake([CloudUploadTaskUpdated::class]);

    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create();
    $task = CloudTask::factory()->for($user)->for($connection, 'connection')->upload()->create();

    app(CloudUploadTaskBroadcaster::class)->broadcastStatus($task->refresh());

    Event::assertDispatched(CloudUploadTaskUpdated::class, fn (CloudUploadTaskUpdated $event): bool => $event->task->is($task));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
php artisan test --compact tests/Feature/CloudUploadTaskBroadcastTest.php
```

Expected: FAIL because `CloudUploadTaskBroadcaster` does not exist.

- [ ] **Step 3: Create broadcaster support class**

Create `app/Support/CloudUploadTaskBroadcaster.php`:

```php
<?php

namespace App\Support;

use App\Enums\CloudTaskStatus;
use App\Events\CloudUploadTaskUpdated;
use App\Models\CloudTask;

class CloudUploadTaskBroadcaster
{
    public function broadcastStatus(CloudTask $task): void
    {
        CloudUploadTaskUpdated::dispatch($task->refresh());
    }

    public function broadcastProgressIfNeeded(CloudTask $task): void
    {
        $task->refresh();
        $payload = $task->payload ?? [];
        $totalChunks = (int) ($payload['total_chunks'] ?? 0);
        $uploadedChunksCount = (int) ($payload['uploaded_chunks_count'] ?? 0);

        if ($totalChunks < 1) {
            return;
        }

        $progress = $task->status->is(CloudTaskStatus::Completed())
            ? 100
            : (int) floor(($uploadedChunksCount / $totalChunks) * 100);
        $broadcastProgress = intdiv($progress, 5) * 5;
        $lastBroadcastProgress = (int) ($payload['last_broadcast_progress'] ?? 0);

        if ($broadcastProgress <= $lastBroadcastProgress && $progress < 100) {
            return;
        }

        $payload['last_broadcast_progress'] = $broadcastProgress;
        $task->forceFill(['payload' => $payload])->save();

        CloudUploadTaskUpdated::dispatch($task->refresh());
    }
}
```

- [ ] **Step 4: Inject serializer and broadcaster in `CloudUploadTaskController`**

Modify imports:

```php
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
```

Update methods:

```php
public function store(Request $request, CloudConnection $connection, CloudUploadTaskBroadcaster $broadcaster): JsonResponse
{
    // keep existing authorization, validation, filename checks, task creation

    $broadcaster->broadcastStatus($task);

    return response()->json(CloudUploadTaskData::fromTask($task));
}

public function pause(Request $request, CloudConnection $connection, CloudTask $task, CloudUploadTaskBroadcaster $broadcaster): JsonResponse
{
    $this->authorizeTask($request, $connection, $task);

    if ($task->status->in([CloudTaskStatus::Pending(), CloudTaskStatus::Uploading()])) {
        $task->forceFill(['status' => CloudTaskStatus::Paused()])->save();
        $broadcaster->broadcastStatus($task);
    }

    return response()->json(CloudUploadTaskData::fromTask($task));
}

public function resume(Request $request, CloudConnection $connection, CloudTask $task, CloudUploadTaskBroadcaster $broadcaster): JsonResponse
{
    $this->authorizeTask($request, $connection, $task);

    if ($task->status->is(CloudTaskStatus::Paused())) {
        $task->forceFill(['status' => CloudTaskStatus::Uploading()])->save();
        $broadcaster->broadcastStatus($task);
    }

    return response()->json(CloudUploadTaskData::fromTask($task->load('chunks')));
}

public function destroy(Request $request, CloudConnection $connection, CloudTask $task, CloudUploadTaskBroadcaster $broadcaster): JsonResponse
{
    $this->authorizeTask($request, $connection, $task);

    $task->forceFill([
        'status' => CloudTaskStatus::Cancelled(),
        'cancelled_at' => now(),
    ])->save();

    $broadcaster->broadcastStatus($task);

    return response()->json(CloudUploadTaskData::fromTask($task));
}
```

Replace `taskData()` usage in `index()` and `show()` with `CloudUploadTaskData::fromTask($task)`, then delete the private `taskData()` method.

- [ ] **Step 5: Inject broadcaster in `CloudUploadTaskChunkController`**

Modify imports:

```php
use App\Support\CloudUploadTaskBroadcaster;
use App\Support\CloudUploadTaskData;
```

Change signature:

```php
public function store(Request $request, CloudConnection $connection, CloudTask $task, CloudUploadTaskBroadcaster $broadcaster): JsonResponse
```

After the transaction and refresh:

```php
$task->refresh()->load('chunks');

if ($task->status->is(CloudTaskStatus::Queued())) {
    $broadcaster->broadcastStatus($task);
} else {
    $broadcaster->broadcastProgressIfNeeded($task);
}

return response()->json(CloudUploadTaskData::fromTask($task));
```

- [ ] **Step 6: Broadcast job status transitions**

Modify `app/Jobs/UploadCloudTaskFileJob.php` imports:

```php
use App\Support\CloudUploadTaskBroadcaster;
```

Change handle signature:

```php
public function handle(CloudStorageCache $cache, CloudUploadTaskBroadcaster $broadcaster): void
```

After processing save:

```php
$broadcaster->broadcastStatus($task);
```

After completed save:

```php
$broadcaster->broadcastStatus($task);
```

After failed save in catch:

```php
$broadcaster->broadcastStatus($task);
```

Keep `throw $exception;` unchanged.

- [ ] **Step 7: Run backend broadcast tests**

Run:

```bash
php artisan test --compact tests/Feature/CloudUploadTaskBroadcastTest.php
```

Expected: PASS.

- [ ] **Step 8: Run affected upload/storage tests**

Run:

```bash
php artisan test --compact tests/Feature/StorageBrowserTest.php tests/Feature/CloudStorageFoundationTest.php tests/Feature/CloudConnectionTest.php
```

Expected: PASS.

- [ ] **Step 9: Format PHP**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: Pint formats touched PHP files.

- [ ] **Step 10: Commit**

```bash
git add app/Support/CloudUploadTaskBroadcaster.php app/Http/Controllers/CloudUploadTaskController.php app/Http/Controllers/CloudUploadTaskChunkController.php app/Jobs/UploadCloudTaskFileJob.php tests/Feature/CloudUploadTaskBroadcastTest.php
git commit -m "feat: broadcast upload task progress"
```

---

## Task 3: Shared Frontend Upload Types and Request Helper

**Files:**
- Modify: `resources/js/types/cloud.ts`
- Create: `resources/js/lib/request-json.ts`
- Modify: `resources/js/pages/files/index.tsx`

- [ ] **Step 1: Add shared upload types**

Append to `resources/js/types/cloud.ts`:

```ts
export type UploadTaskStatus =
    | 'pending'
    | 'uploading'
    | 'paused'
    | 'queued'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface CloudUploadTaskPayload {
    filename: string;
    mime_type: string | null;
    size: number;
    chunk_size: number;
    total_chunks: number;
    uploaded_chunks_count: number;
    last_broadcast_progress?: number;
}

export interface CloudUploadTask {
    id: number;
    connection_id: number;
    name: string;
    type: string;
    status: UploadTaskStatus;
    status_value: number;
    target_path: string;
    payload: CloudUploadTaskPayload;
    progress: number;
    uploaded_chunks_count: number;
    total_chunks: number;
    result: { path?: string } | null;
    error_message: string | null;
    uploaded_chunks: number[];
    updated_at: string | null;
}

export interface UploadQueueItem {
    key: string;
    file: File;
    connectionId: number;
    path: string;
    task?: CloudUploadTask;
    progress: number;
    status: UploadTaskStatus;
    error?: string;
}
```

- [ ] **Step 2: Create request helper**

Create `resources/js/lib/request-json.ts`:

```ts
const csrfToken = () => {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

    return cookie ? decodeURIComponent(cookie) : '';
};

export const requestJson = async <T,>(
    url: string,
    options: RequestInit = {},
): Promise<T> => {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': csrfToken(),
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => null);

        throw new Error(payload?.message || 'Request failed.');
    }

    return response.json();
};
```

- [ ] **Step 3: Temporarily switch `files/index.tsx` to shared types/helper**

In `resources/js/pages/files/index.tsx`:

- Remove local `UploadTask`, `UploadQueueItem`, `csrfToken`, and `requestJson` definitions.
- Add imports:

```ts
import { requestJson } from '@/lib/request-json';
import type {
    CloudConnection,
    CloudFile,
    CloudUploadTask,
    UploadQueueItem,
} from '@/types/cloud';
```

- Replace `UploadTask` references with `CloudUploadTask`.
- Keep local upload UI and logic unchanged for now.

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
pnpm run types:check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/types/cloud.ts resources/js/lib/request-json.ts resources/js/pages/files/index.tsx
git commit -m "refactor: share upload task frontend types"
```

---

## Task 4: Global Upload Manager Context with Reverb Subscription

**Files:**
- Create: `resources/js/contexts/UploadManagerContext.tsx`
- Modify: `resources/js/layouts/AuthenticatedLayout.tsx`
- Modify: `resources/js/pages/files/index.tsx`

- [ ] **Step 1: Create upload manager context**

Create `resources/js/contexts/UploadManagerContext.tsx`:

```tsx
import { router, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { requestJson } from '@/lib/request-json';
import connections from '@/routes/connections';
import type { CloudUploadTask, UploadQueueItem } from '@/types/cloud';

interface UploadTarget {
    connectionId: number;
    path: string;
}

interface ActiveFileBrowserLocation {
    connectionId: number;
    path: string;
}

interface UploadManagerContextValue {
    items: UploadQueueItem[];
    isPanelVisible: boolean;
    enqueue: (files: File[], target: UploadTarget) => void;
    pause: (item: UploadQueueItem) => Promise<void>;
    resume: (item: UploadQueueItem) => Promise<void>;
    cancel: (item: UploadQueueItem) => Promise<void>;
    retry: (item: UploadQueueItem) => void;
    closePanel: () => void;
    registerFileBrowserLocation: (location: ActiveFileBrowserLocation | null) => void;
}

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

const uploadKey = (file: File, target: UploadTarget) =>
    `${target.connectionId}:${target.path}:${file.name}:${file.size}:${file.lastModified}`;

const shouldRefreshFiles = (
    task: CloudUploadTask,
    location: ActiveFileBrowserLocation | null,
) =>
    location !== null &&
    task.connection_id === location.connectionId &&
    task.target_path === location.path;

export function UploadManagerProvider({ children }: { children: ReactNode }) {
    const { props } = usePage() as any;
    const user = props.auth?.user;
    const [items, setItems] = useState<UploadQueueItem[]>([]);
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const pausedUploads = useRef(new Set<string>());
    const fileBrowserLocation = useRef<ActiveFileBrowserLocation | null>(null);

    const updateItem = useCallback((key: string, changes: Partial<UploadQueueItem>) => {
        setItems((currentItems) =>
            currentItems.map((item) =>
                item.key === key ? { ...item, ...changes } : item,
            ),
        );
    }, []);

    const mergeTask = useCallback((task: CloudUploadTask) => {
        setItems((currentItems) =>
            currentItems.map((item) =>
                item.task?.id === task.id
                    ? {
                          ...item,
                          task,
                          status: task.status,
                          progress: task.progress,
                          error: task.error_message || undefined,
                      }
                    : item,
            ),
        );

        if (task.status === 'completed' && shouldRefreshFiles(task, fileBrowserLocation.current)) {
            router.reload({ only: ['files', 'connection'] });
        }
    }, []);

    useEcho<CloudUploadTask>(
        user?.id ? `users.${user.id}.cloud-tasks` : null,
        '.CloudUploadTaskUpdated',
        mergeTask,
    );

    const uploadFile = useCallback(
        async (item: UploadQueueItem, existingTask?: CloudUploadTask) => {
            try {
                updateItem(item.key, {
                    status: 'uploading',
                    progress: existingTask?.progress ?? 0,
                    error: undefined,
                });

                const task =
                    existingTask ||
                    (await requestJson<CloudUploadTask>(
                        connections.uploadTasks.store({ connection: item.connectionId }).url,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                path: item.path,
                                filename: item.file.name,
                                mime_type: item.file.type || null,
                                size: item.file.size,
                                chunk_size: Math.min(
                                    5 * 1024 * 1024,
                                    Math.max(1024, item.file.size),
                                ),
                            }),
                        },
                    ));

                updateItem(item.key, { task });

                const chunkSize = task.payload.chunk_size;
                const uploadedChunks = new Set(task.uploaded_chunks || []);

                for (let index = 0; index < task.payload.total_chunks; index++) {
                    if (pausedUploads.current.has(item.key)) {
                        updateItem(item.key, { status: 'paused' });

                        return;
                    }

                    if (uploadedChunks.has(index)) {
                        continue;
                    }

                    const formData = new FormData();
                    formData.append(
                        'chunk',
                        item.file.slice(
                            index * chunkSize,
                            Math.min(item.file.size, (index + 1) * chunkSize),
                        ),
                        item.file.name,
                    );
                    formData.append('index', String(index));

                    const updatedTask = await requestJson<CloudUploadTask>(
                        connections.uploadTasks.chunks.store({
                            connection: item.connectionId,
                            task: task.id,
                        }).url,
                        {
                            method: 'POST',
                            body: formData,
                        },
                    );

                    updateItem(item.key, {
                        task: updatedTask,
                        progress: updatedTask.progress,
                        status: updatedTask.status,
                    });
                }

                updateItem(item.key, { status: 'queued', progress: 100 });
            } catch (error) {
                updateItem(item.key, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Upload failed.',
                });
            }
        },
        [updateItem],
    );

    const enqueue = useCallback(
        (files: File[], target: UploadTarget) => {
            if (files.length === 0) {
                return;
            }

            const queueItems = files.map((file) => ({
                key: uploadKey(file, target),
                file,
                connectionId: target.connectionId,
                path: target.path,
                progress: 0,
                status: 'pending' as const,
            }));

            setItems((currentItems) => [...queueItems, ...currentItems]);
            setIsPanelVisible(true);
            queueItems.forEach((item) => void uploadFile(item));
        },
        [uploadFile],
    );

    const pause = useCallback(
        async (item: UploadQueueItem) => {
            pausedUploads.current.add(item.key);

            if (item.task) {
                await requestJson<CloudUploadTask>(
                    connections.uploadTasks.pause({
                        connection: item.connectionId,
                        task: item.task.id,
                    }).url,
                    { method: 'PATCH' },
                );
            }

            updateItem(item.key, { status: 'paused' });
        },
        [updateItem],
    );

    const resume = useCallback(
        async (item: UploadQueueItem) => {
            if (!item.task) {
                return;
            }

            pausedUploads.current.delete(item.key);
            const task = await requestJson<CloudUploadTask>(
                connections.uploadTasks.resume({
                    connection: item.connectionId,
                    task: item.task.id,
                }).url,
                { method: 'PATCH' },
            );

            updateItem(item.key, { task, status: 'uploading' });
            void uploadFile(item, task);
        },
        [updateItem, uploadFile],
    );

    const cancel = useCallback(
        async (item: UploadQueueItem) => {
            pausedUploads.current.add(item.key);

            if (item.task) {
                await requestJson<CloudUploadTask>(
                    connections.uploadTasks.destroy({
                        connection: item.connectionId,
                        task: item.task.id,
                    }).url,
                    { method: 'DELETE' },
                );
            }

            updateItem(item.key, { status: 'cancelled' });
        },
        [updateItem],
    );

    const retry = useCallback(
        (item: UploadQueueItem) => {
            pausedUploads.current.delete(item.key);
            void uploadFile(item, item.task);
        },
        [uploadFile],
    );

    const closePanel = useCallback(() => {
        setIsPanelVisible(false);
        setItems((currentItems) =>
            currentItems.filter((item) =>
                ['pending', 'uploading', 'paused', 'queued', 'processing'].includes(item.status),
            ),
        );
    }, []);

    const registerFileBrowserLocation = useCallback(
        (location: ActiveFileBrowserLocation | null) => {
            fileBrowserLocation.current = location;
        },
        [],
    );

    const value = useMemo(
        () => ({
            items,
            isPanelVisible,
            enqueue,
            pause,
            resume,
            cancel,
            retry,
            closePanel,
            registerFileBrowserLocation,
        }),
        [items, isPanelVisible, enqueue, pause, resume, cancel, retry, closePanel, registerFileBrowserLocation],
    );

    return (
        <UploadManagerContext.Provider value={value}>
            {children}
        </UploadManagerContext.Provider>
    );
}

export const useUploadManager = () => {
    const context = useContext(UploadManagerContext);

    if (!context) {
        throw new Error('useUploadManager must be used within UploadManagerProvider.');
    }

    return context;
};
```

- [ ] **Step 2: Wrap authenticated layout internals with provider**

In `resources/js/layouts/AuthenticatedLayout.tsx`, import:

```tsx
import { UploadManagerProvider } from '@/contexts/UploadManagerContext';
```

Change the component return from:

```tsx
return (
    <div className="flex h-screen ...">
        ...
    </div>
);
```

to:

```tsx
return (
    <UploadManagerProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-[#f4f5f7] font-sans text-gray-900 antialiased">
            ...existing layout content...
        </div>
    </UploadManagerProvider>
);
```

- [ ] **Step 3: Use manager in files page for enqueue and refresh location**

In `resources/js/pages/files/index.tsx`, import:

```tsx
import { useEffect } from 'react';
import { useUploadManager } from '@/contexts/UploadManagerContext';
```

Inside `FileBrowser`, add:

```tsx
const uploadManager = useUploadManager();

useEffect(() => {
    uploadManager.registerFileBrowserLocation({
        connectionId: connection.id,
        path: decodedPath,
    });

    return () => uploadManager.registerFileBrowserLocation(null);
}, [connection.id, decodedPath, uploadManager]);
```

Change `handleUploadFiles` to:

```tsx
const handleUploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';

    uploadManager.enqueue(selectedFiles, {
        connectionId: connection.id,
        path: decodedPath,
    });
};
```

Do not remove local queue UI yet in this task unless TypeScript requires it. The next task replaces the UI.

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
pnpm run types:check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/contexts/UploadManagerContext.tsx resources/js/layouts/AuthenticatedLayout.tsx resources/js/pages/files/index.tsx
git commit -m "feat: add global upload manager"
```

---

## Task 5: Dropbox-like Upload Progress Panel and Files Page Cleanup

**Files:**
- Create: `resources/js/components/files/UploadProgressPanel.tsx`
- Modify: `resources/js/layouts/AuthenticatedLayout.tsx`
- Modify: `resources/js/pages/files/index.tsx`

- [ ] **Step 1: Create upload progress panel component**

Create `resources/js/components/files/UploadProgressPanel.tsx`:

```tsx
import { Pause, Play, RefreshCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUploadManager } from '@/contexts/UploadManagerContext';
import { formatBytes } from '@/lib/format-bytes';
import type { UploadQueueItem } from '@/types/cloud';

const activeStatuses = ['pending', 'uploading', 'paused', 'queued', 'processing'];

const statusLabel = (item: UploadQueueItem) => {
    if (item.error) {
        return `Failed · ${item.error}`;
    }

    if (item.status === 'uploading') {
        return `Uploading · ${formatBytes(item.task?.uploaded_chunks_count ? item.task.uploaded_chunks_count * item.task.payload.chunk_size : 0)} of ${formatBytes(item.file.size)}`;
    }

    return item.status.charAt(0).toUpperCase() + item.status.slice(1);
};

export function UploadProgressPanel() {
    const uploadManager = useUploadManager();
    const { items } = uploadManager;

    if (!uploadManager.isPanelVisible || items.length === 0) {
        return null;
    }

    const activeCount = items.filter((item) => activeStatuses.includes(item.status)).length;
    const failedCount = items.filter((item) => item.status === 'failed').length;
    const completedCount = items.filter((item) => item.status === 'completed').length;
    const totalProgress = Math.round(
        items.reduce((sum, item) => sum + item.progress, 0) / items.length,
    );

    return (
        <div className="fixed right-6 bottom-6 z-50 w-[390px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
                <div>
                    <div className="text-sm font-extrabold text-gray-900">
                        {activeCount > 0
                            ? `Uploading ${activeCount} ${activeCount === 1 ? 'file' : 'files'}`
                            : `Uploaded ${completedCount} ${completedCount === 1 ? 'file' : 'files'}`}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-gray-500">
                        {completedCount} completed · {activeCount} active · {failedCount} failed
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={uploadManager.closePanel}
                    className="h-7 w-7 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="border-b border-gray-100 px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>Total progress</span>
                    <span>{totalProgress}%</span>
                </div>
                <Progress value={totalProgress} className="h-2 bg-gray-200 [&>div]:bg-brand" />
            </div>

            <div className="max-h-[320px] overflow-y-auto">
                {items.map((item) => (
                    <div
                        key={item.key}
                        className={`border-b border-gray-50 px-4 py-3 last:border-b-0 ${item.status === 'failed' ? 'bg-orange-50' : 'bg-white'}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className={`truncate text-sm font-bold ${item.status === 'failed' ? 'text-orange-800' : 'text-gray-900'}`}>
                                    {item.file.name}
                                </div>
                                <div className={`mt-1 text-xs font-semibold ${item.status === 'failed' ? 'text-orange-700' : 'text-gray-500'}`}>
                                    {statusLabel(item)}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                {item.status === 'uploading' && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => void uploadManager.pause(item)}
                                        className="h-7 w-7 rounded-lg bg-gray-50"
                                    >
                                        <Pause className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                {item.status === 'paused' && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => void uploadManager.resume(item)}
                                        className="h-7 w-7 rounded-lg bg-gray-50"
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                {item.status === 'failed' && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => uploadManager.retry(item)}
                                        className="h-7 w-7 rounded-lg bg-orange-100 text-orange-700"
                                    >
                                        <RefreshCcw className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                {!['completed', 'cancelled', 'failed'].includes(item.status) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => void uploadManager.cancel(item)}
                                        className="h-7 w-7 rounded-lg bg-red-50 text-red-600"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {item.status !== 'queued' && item.status !== 'completed' && item.status !== 'cancelled' && item.status !== 'failed' && (
                            <Progress value={item.progress} className="mt-3 h-1.5 bg-gray-200 [&>div]:bg-brand" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Render panel in authenticated layout**

In `resources/js/layouts/AuthenticatedLayout.tsx`, import:

```tsx
import { UploadProgressPanel } from '@/components/files/UploadProgressPanel';
```

Render before closing the main layout div:

```tsx
<UploadProgressPanel />
```

Place it after `DeleteConnectionDialog` so it overlays the app but stays inside `UploadManagerProvider`.

- [ ] **Step 3: Remove old upload queue logic from files page**

In `resources/js/pages/files/index.tsx`, remove these imports if no longer used:

```tsx
import { Pause, Play } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { requestJson } from '@/lib/request-json';
import type { CloudUploadTask, UploadQueueItem } from '@/types/cloud';
```

Remove these local declarations/state/functions:

```tsx
const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
const pausedUploads = useRef(new Set<string>());
const updateUploadItem = (...);
const uploadFile = async (...);
const pauseUpload = async (...);
const resumeUpload = async (...);
const cancelUpload = async (...);
```

Remove the inline upload queue block currently starting with:

```tsx
{uploadQueue.length > 0 && (
```

Keep `fileInputRef`, `handleUploadFiles`, create-folder behavior, file filtering, and table rendering.

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
pnpm run types:check
```

Expected: PASS.

- [ ] **Step 5: Run frontend formatting check for touched TSX files**

Run:

```bash
pnpm exec prettier --check resources/js/contexts/UploadManagerContext.tsx resources/js/components/files/UploadProgressPanel.tsx resources/js/layouts/AuthenticatedLayout.tsx resources/js/pages/files/index.tsx resources/js/types/cloud.ts resources/js/lib/request-json.ts
```

Expected: PASS. If it fails, run the same command with `--write`, then re-run the check.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/files/UploadProgressPanel.tsx resources/js/layouts/AuthenticatedLayout.tsx resources/js/pages/files/index.tsx resources/js/contexts/UploadManagerContext.tsx
git commit -m "feat: show global upload progress panel"
```

---

## Task 6: Manual Reverb Verification and Final Checks

**Files:**
- No code files unless verification exposes bugs.

- [ ] **Step 1: Confirm local Reverb environment**

Check local `.env` has Reverb configured. Required values:

```env
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=local
REVERB_APP_KEY=local
REVERB_APP_SECRET=local
REVERB_HOST="localhost"
REVERB_PORT=8080
REVERB_SCHEME=http
VITE_REVERB_APP_KEY="local"
VITE_REVERB_HOST="localhost"
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME="http"
```

Do not commit `.env`.

- [ ] **Step 2: Start app processes**

Run these in separate terminals, or use the existing local process manager if the project has one:

```bash
php artisan serve
php artisan queue:listen --tries=1
php artisan reverb:start
pnpm run dev
```

Expected: Laravel app, queue worker, Reverb, and Vite all running.

- [ ] **Step 3: Verify upload UI manually in browser**

Use the app in Chrome:

1. Open the file browser for a connected cloud account.
2. Click Upload.
3. Select multiple files.
4. Confirm the panel appears at bottom-right.
5. Confirm each file row shows status and progress.
6. Pause one upload and confirm status becomes Paused.
7. Resume it and confirm progress continues.
8. Cancel one upload and confirm status becomes Cancelled.
9. Let one upload complete and confirm status becomes Completed.
10. Confirm the panel stays visible after completion until clicking close.
11. Confirm the file list refreshes when a completed upload belongs to the current connection/path.

- [ ] **Step 4: Check browser logs**

Use Laravel Boost browser logs or Chrome console. Expected: no Echo/Reverb connection errors, no React errors, no failed broadcast auth requests.

- [ ] **Step 5: Run final backend tests**

Run:

```bash
php artisan test --compact tests/Feature/CloudUploadTaskBroadcastTest.php tests/Feature/StorageBrowserTest.php tests/Feature/CloudStorageFoundationTest.php tests/Feature/CloudConnectionTest.php
```

Expected: PASS.

- [ ] **Step 6: Run final frontend checks**

Run:

```bash
pnpm run types:check
pnpm exec prettier --check resources/js/contexts/UploadManagerContext.tsx resources/js/components/files/UploadProgressPanel.tsx resources/js/layouts/AuthenticatedLayout.tsx resources/js/pages/files/index.tsx resources/js/types/cloud.ts resources/js/lib/request-json.ts
```

Expected: PASS.

- [ ] **Step 7: Commit verification fixes if any**

If verification required code changes:

```bash
git add <changed-files>
git commit -m "fix: stabilize upload progress updates"
```

If no changes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers global manager, Dropbox-like panel, Reverb channel `users.{userId}.cloud-tasks`, percent-throttled progress, status broadcasts, no backend polling, panel close behavior, pause/resume/cancel/retry, and current-folder refresh after completion.
- Placeholder scan: No TODO/TBD placeholders remain. Each code task includes concrete files, code snippets, commands, and expected outcomes.
- Type consistency: Backend payload keys match frontend `CloudUploadTask`; channel name is consistently `users.{userId}.cloud-tasks`; status strings match current enum descriptions used by existing responses.
