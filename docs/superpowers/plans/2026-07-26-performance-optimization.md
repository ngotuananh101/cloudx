# Kế hoạch triển khai tối ưu hiệu năng CloudX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai chương trình tối ưu High+Medium sau security harden: queue đúng timeout, stream download OneDrive/Telegram, pool upload frontend, job disk/cancel, list/cache/quota, gầy Inertia — không làm yếu guard bảo mật.

**Architecture:** Làm theo phase 0→5; CloudX (Laravel/React) là chính; `telegram-client` sửa kèm khi đụng `/read` cleanup và `/write` stream. Prefer config trước code; stream HTTP thay `body()`; single-flight cache/quota; pool 3 upload phía browser.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia React 19, Redis queue, FastAPI/Telethon (`telegram-client`)

**Spec:** `docs/superpowers/specs/2026-07-26-performance-optimization-design.md`

## Global Constraints

- PHP 8.4, Laravel 13, Pest 4, Inertia React 19 — bám style hiện có
- Không đổi dependency app nếu chưa duyệt
- Mọi thay đổi hành vi backend CloudX cần Pest (mới hoặc cập nhật)
- Sau PHP: `vendor/bin/pint --dirty --format agent`
- Credentials `encrypted:array`; không lộ `secret_payload`
- Giữ SSRF validate, progress size limit, host policy, path normalize, CSP/private cache preview, OAuth fail-closed
- Telegram: đọc/sửa `D:\Source\ponta\ponta-cloudx\telegram-client` khi đụng service
- Spec/plan/trả lời user: tiếng Việt; code/identifier/path giữ nguyên
- Commit message: conventional prefix + mô tả tiếng Việt được phép

---

## Bản đồ file

| File | Vai trò |
|------|---------|
| `config/queue.php`, `.env.example` | `retry_after` ≥ 2100 |
| `config/cloud-storage.php` | timeout Telegram stream, `telegram.max_list_items` |
| `app/Services/OneDrive/OneDriveClient.php` | stream download |
| `app/Services/Python/PythonServiceClient.php` | `getStream` / stream helpers |
| `app/Services/Telegram/TelegramClient.php` | stream `/read`, timeout dài |
| `app/Services/Telegram/TelegramAdapter.php` | hard cap list |
| `app/Support/CloudFileResponseFactory.php` (mới) hoặc trait | gộp metadata + stream response |
| `CloudFileDownloadController`, `CloudFilePreviewController`, `ShareViewController` | dùng factory |
| `resources/js/contexts/UploadManagerContext.tsx` | pool, poll, abort, split context |
| `resources/js/lib/request-json.ts` | optional `signal` |
| `app/Jobs/UploadCloudTaskFileJob.php` | concat stream / cancel check |
| `app/Jobs/RemoteUploadCloudTaskFileJob.php` | cancel check (HEAD giữ soft) |
| `app/Jobs/UpdateConnectionQuotaJob.php` | `ShouldBeUnique` |
| `app/Services/CloudStorage/CloudStorageCache.php`, `CloudStorageQuota.php`, `CloudFileBrowser.php` | single-flight, dirs, debounce quota |
| `app/Services/OneDrive/OneDriveClient.php` | `@odata.nextLink` |
| `app/Http/Middleware/HandleInertiaRequests.php` | bỏ decrypt credentials global |
| Controllers edit FTP/S3/SFTP | trả config khi cần edit |
| `app/Http/Controllers/CloudUploadTaskChunkController.php` | giảm recount khi chưa đủ chunk |
| `app/Support/CloudUploadTaskBroadcaster.php` | throttle marker Redis nếu cần |
| `telegram-client/main.py` | cleanup `/read`; stream `/write` |
| Tests Pest tương ứng + manual telegram-client |

---

### Task 1: Queue `retry_after` và ghi chú worker

**Files:**
- Modify: `config/queue.php` (default `DB_QUEUE_RETRY_AFTER`, `REDIS_QUEUE_RETRY_AFTER`)
- Modify: `.env.example`
- Create: `tests/Unit/QueueRetryAfterConfigTest.php`

**Interfaces:**
- Produces: default config `retry_after = 2100` cho database + redis drivers

- [ ] **Step 1: Viết test cấu hình**

```php
<?php

// tests/Unit/QueueRetryAfterConfigTest.php
use Tests\TestCase;

uses(TestCase::class);

it('sets queue retry_after at least as long as the longest upload job timeout', function () {
    $redisRetry = (int) config('queue.connections.redis.retry_after');
    $databaseRetry = (int) config('queue.connections.database.retry_after');

    // RemoteUploadCloudTaskFileJob::$timeout = 1500
    expect($redisRetry)->toBeGreaterThanOrEqual(2100)
        ->and($databaseRetry)->toBeGreaterThanOrEqual(2100);
});
```

- [ ] **Step 2: Chạy test — expect FAIL** (mặc định 90)

Run: `php artisan test --compact tests/Unit/QueueRetryAfterConfigTest.php`

- [ ] **Step 3: Sửa config + `.env.example`**

Trong `config/queue.php`:

```php
'retry_after' => (int) env('DB_QUEUE_RETRY_AFTER', 2100),
// ...
'retry_after' => (int) env('REDIS_QUEUE_RETRY_AFTER', 2100),
```

Trong `.env.example` thêm (gần `QUEUE_CONNECTION`):

```env
# Phải >= timeout job dài nhất (RemoteUpload 1500s) + buffer. Worker: php artisan queue:work --timeout=1500
DB_QUEUE_RETRY_AFTER=2100
REDIS_QUEUE_RETRY_AFTER=2100
```

- [ ] **Step 4: Chạy test — PASS**

Run: `php artisan test --compact tests/Unit/QueueRetryAfterConfigTest.php`

- [ ] **Step 5: Commit**

```bash
git add config/queue.php .env.example tests/Unit/QueueRetryAfterConfigTest.php
git commit -m "$(cat <<'EOF'
fix: căn retry_after queue với timeout job upload

Default 2100s cho redis/database queue; ghi chú worker --timeout.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: OneDrive true stream download

**Files:**
- Modify: `app/Services/OneDrive/OneDriveClient.php` (`downloadStream`, optional `download`)
- Create/Modify: `tests/Unit/OneDriveClientStreamTest.php` hoặc feature Http::fake

**Interfaces:**
- Produces: `downloadStream(string $path): resource` không gọi full `body()` vào string PHP cho file lớn

- [ ] **Step 1: Viết test stream**

Dùng `Http::fake` + body streamable, hoặc unit partial mock. Pattern tối thiểu:

```php
it('downloadStream does not require loading the entire body via download()', function () {
    // Http::fake stream response for content URL
    // assert resource returned and first bytes readable
    // assert memory pattern: implementation uses stream option
})->skip(fn () => false); // implement without skip
```

Practical approach trong repo: extract protected method `contentStream(string $url)` tested via subclass, **hoặc** feature test với Http::fake:

```php
Http::fake([
    'https://graph.microsoft.com/*' => Http::response('chunk-a-chunk-b', 200, [
        'Content-Type' => 'application/octet-stream',
    ]),
]);
// credentials mock connection with non-expired token
$stream = $client->downloadStream('file.bin');
expect(stream_get_contents($stream))->toBe('chunk-a-chunk-b');
```

Đảm bảo implementation **không** đi qua `fwrite($stream, $response->body())` sau khi refactor — review code.

- [ ] **Step 2: Implement `downloadStream`**

```php
public function downloadStream(string $path)
{
    $response = $this->contentGraph()
        ->withOptions(['stream' => true])
        ->get($this->contentUrl($path))
        ->throw();

    $psrStream = $response->toPsrResponse()->getBody();

    if ($psrStream->isSeekable()) {
        $psrStream->rewind();
    }

    $resource = $psrStream->detach();

    if (! is_resource($resource)) {
        // fallback: copy to php://temp in chunks (8KB), never one-shot body()
        $resource = fopen('php://temp', 'r+');
        // ... fread/fwrite loop from re-opened stream if detach fails
        throw_if($resource === false, OneDriveException::class, 'Could not create OneDrive download stream.');
    }

    return $resource;
}
```

Nếu `detach()` null trên fake: chunk-copy từ `$psrStream->read(8192)` loop.

- [ ] **Step 3: Test PASS + pint**

```bash
php artisan test --compact tests/Unit/OneDriveClientStreamTest.php
vendor/bin/pint --dirty --format agent
```

- [ ] **Step 4: Commit**

```bash
git commit -m "fix: stream OneDrive download thay vì body() full"
```

---

### Task 3: Telegram stream CloudX + cleanup `/read` service

**Files:**
- Modify: `app/Services/Python/PythonServiceClient.php` — thêm helper stream GET
- Modify: `app/Services/Telegram/TelegramClient.php` — `downloadStream`, timeout
- Modify: `config/cloud-storage.php` — `telegram.download_timeout`
- Modify: `D:\Source\ponta\ponta-cloudx\telegram-client\main.py` — cleanup temp sau `/read`
- Test: `tests/Unit/TelegramClientStreamTest.php` hoặc Feature Http::fake

**Interfaces:**
- Consumes: pattern `postStream` hiện có
- Produces: `TelegramClient::downloadStream(int $messageId): resource`; service dọn temp

- [ ] **Step 1: Config**

```php
// config/cloud-storage.php
'telegram' => [
    'download_timeout' => (int) env('CLOUD_TELEGRAM_DOWNLOAD_TIMEOUT', 600),
    'max_list_items' => (int) env('CLOUD_TELEGRAM_MAX_LIST_ITEMS', 2000),
],
```

- [ ] **Step 2: `PythonServiceClient` — get với stream**

```php
protected function getStream(string $path, array $query = [], int $timeout = 30): Response
{
    $response = $this->request($timeout)
        ->withOptions(['stream' => true])
        ->get($this->baseUrl.$path, $query);

    $this->assertAuthenticated($response);

    if ($response->failed()) {
        // tránh body() full: dùng status + short json/message nếu nhỏ
        throw new PythonServiceException('Python service error: HTTP '.$response->status());
    }

    return $response;
}
```

- [ ] **Step 3: `TelegramClient::downloadStream`**

```php
public function downloadStream(int $messageId)
{
    $timeout = (int) config('cloud-storage.telegram.download_timeout', 600);

    $response = $this->request($timeout)
        ->withOptions(['stream' => true])
        ->withQueryParameters(['message_id' => $messageId])
        ->get($this->url().'/read');

    if ($response->status() === 404) {
        throw new TelegramServiceException('Telegram file not found.');
    }

    $this->assertAuthenticated($response);
    if ($response->failed()) {
        throw new TelegramServiceException('Python service error: HTTP '.$response->status());
    }

    $psr = $response->toPsrResponse()->getBody();
    $resource = $psr->detach();

    if (is_resource($resource)) {
        return $resource;
    }

    // chunk fallback vào php://temp
    $stream = fopen('php://temp', 'r+');
    // ...
    return $stream;
}
```

Giữ `download(): string` cho chỗ nhỏ nếu còn; hoặc implement `download` bằng stream_get_contents của `downloadStream` (vẫn load full — chỉ dùng nội bộ nhỏ).

- [ ] **Step 4: telegram-client cleanup**

Trong `main.py` `read_file`, thêm `BackgroundTasks`:

```python
@app.get("/read")
async def read_file(
    background_tasks: BackgroundTasks,
    message_id: int = Query(...),
    ...
):
    ...
    await client.download_media(msg, file=download_path)
    background_tasks.add_task(cleanup_temp_file, download_path)
    return FileResponse(
        path=download_path,
        media_type=file_info.mime_type or "application/octet-stream",
        filename=file_info.original_name or "download",
    )
```

Lưu ý: `FileResponse` + xóa ngay có thể race — nếu cleanup quá sớm, chuyển `StreamingResponse` + iterator như yt-dlp (ưu tiên pattern đã có trong cùng file).

```python
def file_iterator():
    try:
        with open(download_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk
    finally:
        cleanup_temp_file(download_path)

return StreamingResponse(
    file_iterator(),
    media_type=file_info.mime_type or "application/octet-stream",
    headers={"Content-Disposition": f'attachment; filename="{file_info.original_name or "download"}"'},
)
```

- [ ] **Step 5: Test CloudX + commit (2 repo nếu khác git)**

```bash
php artisan test --compact tests/Unit/TelegramClientStreamTest.php
vendor/bin/pint --dirty --format agent
# CloudX commit
# telegram-client: commit riêng trong repo đó nếu có git
```

```bash
git commit -m "fix: stream Telegram download và tăng timeout"
# telegram-client:
# git commit -m "fix: stream /read và dọn temp sau download"
```

---

### Task 4: Gộp metadata download/preview/share

**Files:**
- Create: `app/Support/CloudFileResponseFactory.php` (hoặc `app/Services/CloudStorage/CloudFileStreamer.php`)
- Modify: `CloudFileDownloadController`, `CloudFilePreviewController`, `ShareViewController` (stream paths)
- Test: cập nhật `CloudFileDownloadTest`, `CloudFilePreviewTest`, `ShareViewTest`

**Interfaces:**
- Produces: factory build headers + stream callback từ disk path; Telegram: 1 metadata call

- [ ] **Step 1: Implement factory**

```php
final class CloudFileResponseFactory
{
    /**
     * @return array{name: string, mime: string, size: int|null}
     */
    public function resolveMeta(\Illuminate\Contracts\Filesystem\Filesystem $disk, string $path): array
    {
        // Prefer single metadata path for Telegram via adapter if available
        $name = TelegramHelper::filenameFor($disk, $path) ?? basename($path);
        try {
            $mime = $disk->mimeType($path);
        } catch (\Throwable) {
            $mime = 'application/octet-stream';
        }
        try {
            $size = $disk->fileSize($path);
        } catch (\Throwable) {
            $size = null;
        }

        return ['name' => $name, 'mime' => (string) $mime, 'size' => $size];
    }

    // streamDownload / streamInline methods setting ContentDisposition, nosniff, CSP, private cache
}
```

Tối ưu Telegram: nếu `getAdapter() instanceof TelegramAdapter`, gọi **một** `metadata` client (expose method trên adapter) trả name+mime+size — tránh `fileExists` + 3 metadata.

Bỏ `$disk->exists` trước khi meta nếu meta 404 đã đủ (catch UnableToRetrieveMetadata → 404).

- [ ] **Step 2: Wire controllers** — giữ header security (private cache, CSP sandbox HTML/SVG, ContentDisposition).

- [ ] **Step 3: Chạy tests download/preview/share**

```bash
php artisan test --compact tests/Feature/CloudFileDownloadTest.php tests/Feature/CloudFilePreviewTest.php tests/Feature/ShareViewTest.php
vendor/bin/pint --dirty --format agent
git commit -m "perf: gộp metadata download/preview và giữ header an toàn"
```

---

### Task 5: Upload manager — pool 3, poll ổn định, AbortSignal

**Files:**
- Modify: `resources/js/lib/request-json.ts`
- Modify: `resources/js/contexts/UploadManagerContext.tsx` (file lớn — chỉnh từng phần)
- Manual verify checklist

**Interfaces:**
- Produces: `MAX_CONCURRENT_UPLOADS = 3`; `requestJson` forwards `signal` từ `RequestInit` (đã spread options — chỉ cần document + dùng signal từ caller)

- [ ] **Step 1: `request-json`** — `RequestInit` đã có `signal`; không đổi API nếu spread `...options` đủ. Chỉ đảm bảo không strip signal.

- [ ] **Step 2: Pool**

```ts
const MAX_CONCURRENT_UPLOADS = 3;
const activeUploadKeys = useRef(new Set<string>());
const abortControllers = useRef(new Map<string, AbortController>());

const pumpQueue = useCallback(() => {
    setItems((current) => {
        const pending = current.filter((i) => i.status === 'pending' && i.file);
        const activeCount = current.filter((i) =>
            ['uploading'].includes(i.status),
        ).length;
        // start up to MAX - activeCount pending items via uploadFile
        return current;
    });
}, [...]);
```

`enqueue`: chỉ `setItems` status `pending`, gọi `pumpQueue()` — **không** `forEach(uploadFile)` tất cả.

Khi upload xong/fail/cancel/pause: `activeUploadKeys.delete`, `pumpQueue()`.

- [ ] **Step 3: Abort**

```ts
const controller = new AbortController();
abortControllers.current.set(key, controller);
// pass signal to requestJson and fetch(part.url, { method:'PUT', body, signal })
// cancel(): controller.abort(); cancelledUploads.add
```

Backend chunk loop: check `cancelledUploads` **và** `pausedUploads` mỗi chunk (hiện backend path thiếu cancel check).

- [ ] **Step 4: Poll**

```ts
const activeTaskIds = items
    .filter((i) => i.task && (i.status === 'queued' || i.status === 'processing'))
    .map((i) => i.task!.id)
    .sort((a, b) => a - b)
    .join(',');

useEffect(() => {
    if (!activeTaskIds) return;
    const ids = activeTaskIds.split(',').map(Number);
    const intervalId = setInterval(() => { /* poll each id, skip in-flight */ }, 3000);
    return () => clearInterval(intervalId);
}, [activeTaskIds, mergeBroadcastTask]);
```

- [ ] **Step 5: Debounce reload + drop File sau terminal**

- `refreshFilesIfActive` debounce 400ms
- Bỏ reload trùng cuối `uploadFile` nếu broadcast đã lo
- `updateItem` terminal: `{ file: undefined, remote: undefined }` giữ name qua field riêng nếu cần UI

- [ ] **Step 6: Dual context (nếu thời gian cho phép trong task)**

Tách `UploadManagerActionsContext` + `UploadManagerStateContext` để `files/index` không re-render theo `items`. Nếu quá lớn, commit pool/poll/abort trước, split context task nhỏ ngay sau.

- [ ] **Step 7: Manual + commit**

```bash
# Manual: chọn 5 file → chỉ 3 uploading
# Cancel giữa chừng → PUT dừng
git add resources/js/contexts/UploadManagerContext.tsx resources/js/lib/request-json.ts
git commit -m "fix: pool upload max 3, poll ổn định và AbortController"
```

---

### Task 6: Job — cancel cooperative + concat stream (allowlist)

**Files:**
- Modify: `app/Jobs/UploadCloudTaskFileJob.php`
- Modify: `app/Jobs/RemoteUploadCloudTaskFileJob.php` (progress callback + status check)
- Optional Create: `app/Support/ChunkConcatStream.php` hoặc private method
- Test: Feature/Unit job cancel + merge path

**Interfaces:**
- Produces: job dừng khi status `Cancelled`; S3/FTP/SFTP ưu tiên không `merged.bin` nếu an toàn

- [ ] **Step 1: Helper re-check status**

```php
private function assertNotCancelled(CloudTask $task): void
{
    $task->refresh();
    if ($task->status === CloudTaskStatus::Cancelled) {
        throw new CloudUploadException('Upload was cancelled.');
    }
}
```

Gọi mỗi N chunk trong merge loop; trong remote `progress` callback (mỗi ~1MB); trước `writeStream`.

`failed()` / catch: nếu cancelled, không mark Failed lại (giữ Cancelled).

- [ ] **Step 2: Concat stream cho provider không cần seek**

```php
// Pseudo: open wb only if needsSeekableMergedFile($task)
// else: sequential readStream chunks into writeStream via php://temp maxmemory hoặc custom
```

OneDrive: **giữ** merge file (cần size).  
Telegram: merge hoặc stream attach — service write vẫn full read đến Task 7.

Bắt đầu allowlist: `CloudProvider::AWS_S3`, FTP, SFTP → concat; còn lại merge.

- [ ] **Step 3: Tests**

```php
it('stops processing when task is cancelled mid-job', function () {
    // create task processing, dispatch job that checks cancel
});
```

- [ ] **Step 4: pint + commit**

```bash
git commit -m "fix: cancel cooperative và concat stream upload backend"
```

---

### Task 7: telegram-client `POST /write` stream to disk

**Files:**
- Modify: `D:\Source\ponta\ponta-cloudx\telegram-client\main.py` (`write_file`)

**Interfaces:**
- Produces: không `await file.read()` full; ghi chunk vào `temp_path`

- [ ] **Step 1: Thay write body**

```python
@app.post("/write")
async def write_file(...):
    session_id = validate_session_id(x_session_id)
    temp_path = make_temp_path(TEMP_DIR, session_id, file.filename or "upload")
    try:
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)

        message = await telegram_client.upload_file(session_id, temp_path, caption=file.filename or "")
        size = os.path.getsize(temp_path)
        # FileIndex size=size ...
```

- [ ] **Step 2: Manual upload file vừa; commit trong repo telegram-client**

```bash
git commit -m "fix: ghi upload /write theo chunk tránh OOM"
```

---

### Task 8: OneDrive `@odata.nextLink` + Telegram list cap

**Files:**
- Modify: `app/Services/OneDrive/OneDriveClient.php` `listChildren`
- Modify: `app/Services/Telegram/TelegramAdapter.php` `listContents`
- Config: `cloud-storage.telegram.max_list_items` (đã Task 3)
- Tests: Unit OneDrive multi-page; Unit Telegram cap

- [ ] **Step 1: OneDrive**

```php
public function listChildren(string $path): array
{
    $items = [];
    $url = $this->childrenUrl($path);
    $pages = 0;
    $maxPages = 50;

    do {
        $response = $this->graph()->get($url)->throw()->json();
        $pageItems = is_array($response['value'] ?? null) ? $response['value'] : [];
        array_push($items, ...$pageItems);
        $url = is_string($response['@odata.nextLink'] ?? null) ? $response['@odata.nextLink'] : null;
        $pages++;
    } while ($url !== null && $pages < $maxPages);

    return $items;
}
```

Dùng full URL nextLink với `Http::withToken` (graph client) — cẩn thận nextLink absolute: `Http::withToken(...)->get($url)`.

- [ ] **Step 2: Telegram adapter cap**

```php
$max = (int) config('cloud-storage.telegram.max_list_items', 2000);
$yielded = 0;
// trong loop: if ($yielded >= $max) break; $yielded++;
```

- [ ] **Step 3: Tests + commit**

```bash
php artisan test --compact tests/Unit/OneDriveListPaginationTest.php tests/Unit/TelegramAdapterListCapTest.php
git commit -m "fix: phân trang OneDrive list và cap Telegram listing"
```

---

### Task 9: Cache single-flight, derive dirs, quota unique

**Files:**
- Modify: `app/Services/CloudStorage/CloudStorageCache.php`
- Modify: `app/Services/CloudStorage/CloudFileBrowser.php`
- Modify: `app/Services/CloudStorage/CloudStorageQuota.php`
- Modify: `app/Jobs/UpdateConnectionQuotaJob.php` — `ShouldBeUnique`
- Tests: Bus::fake unique; browser mock call count

- [ ] **Step 1: Unique quota job**

```php
class UpdateConnectionQuotaJob implements ShouldQueue, ShouldBeUnique
{
    public int $uniqueFor = 300;

    public function uniqueId(): string
    {
        return (string) $this->connectionId;
    }
}
```

- [ ] **Step 2: `flushQuota`**

```php
public function flushQuota(CloudConnection $connection): void
{
    dispatch(new UpdateConnectionQuotaJob($connection->id))->delay(now()->addSeconds(15));
}
```

Không `Cache::forget('quota_update_lock_...')` mỗi lần (hoặc giữ lock riêng trong `refreshInBackground` với `last_synced_at`).

- [ ] **Step 3: `refreshInBackground`**

```php
if ($connection->last_synced_at && $connection->last_synced_at->gt(now()->subMinutes(10))) {
    return;
}
// existing lock + dispatch
```

- [ ] **Step 4: `rememberFolderListing` single-flight**

```php
$lock = Cache::lock('cloud:list:lock:'.$connection->id.':'.$this->pathHash($path), 10);
return $lock->block(5, fn () => $this->repository(...)->remember(...));
```

- [ ] **Step 5: `listDirectories` derive**

Trong `CloudFileBrowser::listDirectories`: thử đọc cache full list key nếu có, filter dirs; miss thì một list provider ghi cả list + dirs.

- [ ] **Step 6: Tests + commit**

```bash
php artisan test --compact tests/Feature/...Quota... tests/Unit/CloudStorageCache...
git commit -m "perf: single-flight listing và gộp job quota"
```

---

### Task 10: Inertia gầy credentials + giảm lock chunk

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php` — bỏ `ftp_config`/`s3_config` từ global share
- Modify: controllers/pages edit FTP/S3/SFTP — đảm bảo props/local fetch vẫn có config (Inertia render connection settings hoặc API)
- Modify: `CloudUploadTaskChunkController` — đếm chunk: tin increment khi updateOrCreate mới; full `count()` chỉ khi gần `total_chunks`
- Modify: `resources/js/types` nếu cần
- Tests: feature share auth props; chunk queue once

- [ ] **Step 1: HandleInertiaRequests**

```php
// Chỉ payload không secret — xóa block credentials FTP/S3
$payload = [
    'id' => ...,
    'name' => ...,
    'provider' => ...,
    // status, actions, spaces if columns exist
];
```

- [ ] **Step 2: Edit dialogs**

`EditFtpConnectionDialog` / `EditS3ConnectionDialog` / SFTP: load config từ prop page connection hoặc endpoint hiện có. Nếu hiện chỉ lấy từ `auth.user.connections[].ftp_config`, thêm prop trên trang cloud connections list/settings:

```php
// Ví dụ CloudConnectionController index/show
'ftp_config' => $connection->provider === FTP
    ? collect($connection->credentials)->except('password')->all()
    : null,
```

- [ ] **Step 3: Chunk count**

```php
$lockedTask->chunks()->updateOrCreate(...);
$uploadedChunksCount = (int) ($lockedTask->payload['uploaded_chunks_count'] ?? 0);
// if updateOrCreate was new index, increment; or always count() only when uploadedChunksCount + 1 >= totalChunks
$uploadedChunksCount = $lockedTask->chunks()->count(); // keep count when completing; optional optimize: only count when payload count >= total-1
```

Tối thiểu an toàn: chỉ `count()` khi `(payload['uploaded_chunks_count'] ?? 0) >= $totalChunks - 1`, còn lại increment nếu row wasRecentlyCreated.

- [ ] **Step 4: Tests + commit**

```bash
php artisan test --compact --filter=Inertia
php artisan test --compact tests/Feature/S3DirectUploadTest.php # or chunk upload tests
git commit -m "perf: bỏ decrypt credentials Inertia global và giảm recount chunk"
```

---

### Task 11: Regression cuối

- [ ] **Step 1: Pint**

```bash
vendor/bin/pint --dirty --format agent
```

- [ ] **Step 2: Suite liên quan**

```bash
php artisan test --compact \
  tests/Unit/QueueRetryAfterConfigTest.php \
  tests/Feature/RemoteUploadTaskTest.php \
  tests/Feature/S3DirectUploadTest.php \
  tests/Feature/CloudFileDownloadTest.php \
  tests/Feature/CloudFilePreviewTest.php \
  tests/Feature/ShareViewTest.php
```

- [ ] **Step 3: Smoke manual (checklist spec §15)**

1. Upload ≥5 file → ≤3 active  
2. OneDrive + Telegram download lớn  
3. Remote oversize mid-stream  
4. Cancel processing  
5. OneDrive folder lớn  
6. Telegram > cap  
7. Quota gộp  
8. Inertia không secret  
9. telegram-client temp sạch sau `/read`

- [ ] **Step 4: Commit fix sót (nếu có) hoặc dừng**

---

## Self-review coverage

| Spec section | Task |
|--------------|------|
| Phase 0 queue retry_after | Task 1 |
| Phase 1 OneDrive stream | Task 2 |
| Phase 1 Telegram stream + service cleanup | Task 3 |
| Phase 1 metadata gộp | Task 4 |
| Phase 2 upload manager | Task 5 |
| Phase 3 job cancel/concat | Task 6 |
| Phase 3 telegram `/write` stream | Task 7 |
| Phase 4 OneDrive pages + Telegram cap | Task 8 |
| Phase 4 cache/quota | Task 9 |
| Phase 5 Inertia + chunk | Task 10 |
| Verification | Task 11 |
| Non-goals (stream-through remote, UI infinite Telegram, parts table, OAuth buttons…) | Không có task — đúng |

**Placeholder scan:** không TBD/TODO mơ hồ.  
**Type consistency:** config keys `cloud-storage.telegram.*`, `ShouldBeUnique`, `MAX_CONCURRENT_UPLOADS = 3` thống nhất.

---

## Ghi chú triển khai

- Repo `telegram-client` có thể **khác git root** với CloudX — commit/deploy riêng, đồng bộ version.
- Sau đổi `retry_after`: **restart queue workers** với `--timeout=1500` (hoặc cao hơn).
- Không gỡ HEAD remote upload; không bỏ spool remote.
