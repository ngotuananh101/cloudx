# CloudX — Thiết kế tối ưu hiệu năng & độ tin cậy

**Ngày:** 2026-07-26  
**Trạng thái:** Đã rà lại (đối chiếu CloudX + `telegram-client`) — chờ duyệt  
**Phạm vi:** Chỉ High + Medium (Low polish để sau)  
**Mặc định product:** An toàn (giữ spool local cho remote upload; Telegram vẫn list đầy đủ + hard cap phía CloudX; cancel cooperative giữa vòng lặp)

**Nguồn đối chiếu lần rà:**
- CloudX: jobs upload, `config/queue.php`, OneDrive/Telegram clients, `CloudFileBrowser`, `CloudStorageCache`, `UploadManagerContext`, download/preview controllers
- Telegram service: `D:\Source\ponta\ponta-cloudx\telegram-client` (`main.py`, `client.py`)

---

## 1. Mục tiêu

Nâng độ tin cậy khi upload chạy lâu, giảm spike bộ nhớ lúc download/preview, giảm API/queue/browser thừa, và làm multi-file upload hành xử ổn định — **không** làm yếu các lớp bảo mật vừa harden (SSRF, giới hạn size, normalize path, OAuth fail-closed).

**Ngoài phạm vi (Low polish để sau):** polish zero-byte (trừ guard client nếu rẻ), share create disk-stat, ẩn nút OAuth login chết, đóng preview share folder, bảng `cloud_task_parts`, index DB composite trừ khi phase cần, remote stream-through không disk, UX infinite-scroll Telegram (API `/list` đã có limit/offset).

---

## 2. Ràng buộc

- PHP 8.4, Laravel 13, Pest 4, Inertia React 19 — bám style hiện có.
- Không đổi dependency app nếu chưa được duyệt.
- Mọi thay đổi hành vi backend CloudX cần Pest test (mới hoặc cập nhật).
- Sau sửa PHP: `vendor/bin/pint --dirty --format agent`.
- Credentials vẫn `encrypted:array`; không bao giờ lộ `secret_payload` trong JSON.
- Giữ guarantee bảo mật: validate remote URL, abort size mid-stream, host policy, normalize path.
- Ưu tiên sửa config/worker hơn code nếu tương đương.
- **Telegram:** mọi thay đổi API/stream/list/upload phải đọc và (nếu cần) sửa kèm `telegram-client`; không giả định service chỉ từ Laravel.

---

## 3. Phát hiện quan trọng khi rà lại (Telegram service)

Repo: `D:\Source\ponta\ponta-cloudx\telegram-client`

| Hạng mục | Thực tế service | Hệ quả cho spec |
|----------|-----------------|-----------------|
| `GET /read` | Tải media Telethon xuống **temp disk**, trả `FileResponse` (không buffer full vào RAM service như body string) | CloudX **vẫn** OOM vì `TelegramClient::download()` → `$response->body()` rồi `php://temp`. Tối ưu Phase 1 chủ yếu ở **CloudX stream HTTP**; service đã spool disk. |
| Cleanup temp sau `/read` | `FileResponse` **không** `BackgroundTasks.cleanup_temp_file` (khác `/yt-dlp/download` dùng `StreamingResponse` + cleanup) | **Rò temp disk** trên service sau mỗi download. Đưa vào Phase 1 (sửa `telegram-client`). |
| `GET /list` | Đã paginate DB index: `limit` 1–1000 (default 100), `offset`, trả `total` | CloudX `TelegramAdapter::listContents` **tự lặp** mọi trang đến `total` rồi cache full. Cap + (sau) UI page nằm phía CloudX; service OK. |
| `POST /write` | `await file.read()` **full vào RAM** service, ghi temp, `send_file` | Upload lớn: OOM **service**. Phase 3 ghi rõ: stream upload multipart phía FastAPI (đọc chunk → disk) là follow-up service; CloudX `uploadStream` attach resource chưa đủ nếu service `file.read()` full. |
| `GET /metadata` | Đọc `FileIndex` local, không hit Telegram | Gộp metadata CloudX rẻ với Telegram (1 HTTP metadata). |
| Timeout CloudX | `PythonServiceClient::request` default **30s** | Download file lớn dễ timeout dù stream; Phase 1 phải tăng timeout path read (config). |
| `postStream` | Đã có trên `PythonServiceClient` (yt-dlp) | Pattern sẵn: thêm `getStream` / dùng `withOptions(['stream' => true])` cho `/read`. |

---

## 4. Tổng quan kiến trúc

Thứ tự: **đúng/tin cậy** trước **throughput**; **bộ nhớ server** trước **UI polish**.

```
Phase 0  Căn chỉnh queue/worker config
Phase 1  True streaming + gộp metadata + cleanup temp telegram-client
Phase 2  Upload manager: pool concurrency, poll, abort, tách re-render
Phase 3  Hiệu quả disk job + cancel cooperative (+ ghi chú upload Telegram service)
Phase 4  Phân trang listing + cache single-flight + quota unique/debounce
Phase 5  Gầy payload Inertia connection + giảm lock chunk
```

Nguyên tắc chung:

1. **Stream, không buffer** — adapter/provider và HTTP client CloudX không `$response->body()` với nội dung lớn.
2. **Single-flight việc đắt** — miss cache listing, refresh quota, refresh token.
3. **Giới hạn concurrency** — worker upload trên browser và (tuỳ chọn) tách queue.
4. **Giữ fail-closed size/SSRF** — tối ưu quanh guard, không gỡ guard.
5. **Hai repo khi đụng Telegram** — CloudX + `telegram-client` cùng review.

---

## 5. Phase 0 — Queue & worker đúng cấu hình

### Vấn đề

- Job upload: timeout 1200–1500s (`UploadCloudTaskFileJob`, `CompleteS3MultipartUploadJob`, `RemoteUploadCloudTaskFileJob`).
- `retry_after` mặc định database/redis queue là **90s** (`config/queue.php` — `DB_QUEUE_RETRY_AFTER` / `REDIS_QUEUE_RETRY_AFTER`).
- Worker có thể re-release job vẫn đang chạy → race claim trùng, upload đôi, tốn bandwidth.

### Thiết kế

1. Nâng mặc định `REDIS_QUEUE_RETRY_AFTER` / `DB_QUEUE_RETRY_AFTER` lên **tối thiểu 2100** (timeout job max 1500 + buffer), ghi chú trong `.env.example`.
2. Ghi chú worker: `--timeout=1500` (hoặc ≥ job dài nhất) trong comment `.env.example`.
3. Tuỳ chọn (cùng phase nếu rủi ro thấp): queue riêng `uploads` / `remote-uploads` qua `$this->onQueue(...)` trên ba job dài — **chỉ khi** worker đã hỗ trợ multi-queue; không thì để follow-up ops.

### Test

- Test cấu hình nhẹ: assert `retry_after` ≥ timeout job (đọc config sau bind env).
- Phase này không đổi logic claim job.

### Rủi ro

Thấp. Deploy phải restart worker với timeout/retry_after mới cùng lúc.

---

## 6. Phase 1 — Download & preview an toàn bộ nhớ

### Vấn đề

- `OneDriveClient::downloadStream` nạp full body string rồi `php://temp`.
- `TelegramClient::downloadStream` gọi `download()` → `$response->body()` full → `php://temp` (timeout mặc định 30s).
- `telegram-client` `/read` đã spool disk + `FileResponse` nhưng **không cleanup** temp sau response; CloudX vẫn buffer full qua HTTP client.
- Controller download/preview: `exists` + (Telegram) `filenameFor`→`fileSize`/`metadata` + `mimeType` + `fileSize` + `readStream` — nhiều round-trip.
- Direct link đã có cho S3/OneDrive/Dropbox/Google Drive qua `ProvidesDirectDownloadLink` — **download** vẫn ưu tiên redirect.

### Thiết kế

#### 1.1 True streaming — OneDrive (chỉ CloudX)

- GET streaming với Laravel HTTP/Guzzle `withOptions(['stream' => true])`.
- Trả PHP resource (detach PSR stream hoặc wrapper), không materialize full body.
- `download(): string` chỉ giữ cho use-case nhỏ / nội bộ, hoặc chuyển caller sang stream.
- Timeout content giữ mức cao (đã ~120s content path); file rất lớn nên đi `directDownloadLink` khi có.

#### 1.2 True streaming — Telegram (CloudX + telegram-client)

**CloudX (`TelegramClient` / `PythonServiceClient`):**

- Thêm path GET stream (tương tự `postStream` đã có): `withOptions(['stream' => true])` tới `GET /read`.
- `downloadStream`: không gọi `body()`; pipe PSR/Guzzle stream → resource PHP (hoặc sink tạm **chỉ khi** bắt buộc seekable — ưu tiên stream thẳng ra response controller).
- Timeout download/stream: config mới, mặc định **≥ 600s** (không dùng 30s của metadata/auth).
- `assertSuccess` trên stream response: **không** đọc `$response->body()` khi failed nếu body lớn; dùng status + snippet an toàn.

**telegram-client (`main.py` `/read`):**

- Giữ spool disk + stream ra client (FileResponse hoặc StreamingResponse).
- **Bắt buộc:** dọn temp sau khi gửi xong — mirror pattern `yt-dlp/download`: `BackgroundTasks.add_task(cleanup_temp_file, download_path)` (hoặc `StreamingResponse` + cleanup tương đương). Hiện `/read` thiếu bước này → rò `TEMP_DIR`.
- Không yêu cầu đổi Telethon sang pure async byte-stream trong phase này (spool disk service là chấp nhận được).

#### 1.3 Gộp metadata (CloudX)

Helper dùng chung download/preview/share stream, ví dụ `CloudFileResponseFactory` hoặc trait:

- Một lần resolve metadata: name, mime, size (best-effort).
- **Telegram:** một `GET /metadata` đủ name/mime/size — bỏ chuỗi `exists` + `filenameFor` + `mimeType` + `fileSize` tách rời trước stream.
- Bỏ `exists` riêng khi metadata authoritative (404 → not found).
- Sau đó một `readStream` / stream HTTP.
- Download non-Telegram: ưu tiên `directDownloadLink`; preview có thể proxy khi cần inline/CSP.

#### 1.4 Test

- Unit/feature CloudX: mock HTTP stream OneDrive/Telegram — không full-body.
- Feature: preview/download vẫn disposition, nosniff, CSP HTML/SVG.
- telegram-client: nếu có test suite thì assert cleanup temp; không thì checklist manual + code review.
- Test redirect download hiện có vẫn xanh.

### Rủi ro

Trung bình. Error handling + token OneDrive; Telegram phụ thuộc deploy đồng bộ CloudX + service. Không làm yếu CSP/cache header security.

---

## 7. Phase 2 — Upload manager (frontend)

### Vấn đề

- `enqueue` start **mọi** file ngay (không pool) — `UploadManagerContext.tsx`.
- Poll 3s phụ thuộc full `items` → interval restart mỗi progress tick; chạy cả khi Echo sống.
- Không `AbortController`; cancel phải chờ chunk đang bay.
- Context `value` gồm `items` → File Browser re-render mỗi chunk.
- Double `router.reload` khi complete (local + broadcast).
- `File` blob giữ đến khi user remove thủ công.

### Thiết kế

#### 2.1 Pool concurrency

- Hằng `MAX_CONCURRENT_UPLOADS = 3`.
- Item vào queue ở `pending`; scheduler start upload đến khi 3 active (client `uploading`).
- Khi active complete/fail/cancel/pause → start pending tiếp.
- Remote enqueue: tạo task rẻ; vẫn tôn trọng pool nếu muốn tránh bão POST (khuyến nghị: remote cũng qua pool).

#### 2.2 Polling

- Chỉ poll task status server `queued` | `processing` (sau khi client xong gửi chunk / remote đã tạo task).
- Effect interval phụ thuộc **chuỗi task ID đã sort**, không full `items`.
- Poll fallback 3s luôn bật ở v1 (an toàn). Follow-up: gate theo Echo connected.
- Cap: một request/task/tick; skip nếu poll trước còn in-flight.

#### 2.3 Abort

- `Map<itemKey, AbortController>`; controller mới mỗi lần chạy upload.
- Truyền `signal` qua `requestJson` và `fetch` PUT direct.
- Cancel/pause abort controller; UI bỏ qua lỗi abort.
- Mở rộng `request-json.ts` nhận optional `signal`.

#### 2.4 Tách re-render

- Dual context: actions ổn định vs state (`items`, `isPanelVisible`).
- File browser chỉ actions; panel dùng state.

#### 2.5 Refresh & bộ nhớ

- Debounce `router.reload({ only: ['files', 'connection'] })` ~400ms; một owner (broadcast/poll).
- Sau terminal: gỡ field nặng `file` / `remote`.
- (Tuỳ chọn) auto-remove completed sau 10 phút.

#### 2.6 Kiểm chứng

- Checklist manual; unit frontend chỉ nếu đã có infra.

### Rủi ro

Trung bình (race scheduler). Giữ CSRF trên request không bị abort nhầm.

---

## 8. Phase 3 — Hiệu quả disk job & cancel cooperative

### Vấn đề

- Backend upload merge mọi chunk vào `merged.bin` rồi đọc lại `writeStream` (~2× disk, tới 5GB).
- Remote upload: HEAD + GET spool + re-upload.
- Cancel sau claim không dừng vòng merge/download.
- **Telegram upload:** CloudX `uploadStream` attach resource, nhưng service `POST /write` làm `await file.read()` full RAM rồi mới ghi temp — bottleneck memory nằm **service** với file lớn.

### Thiết kế

#### 3.1 Đường merge (CloudX)

- **Mặc định an toàn:** giữ merge on-disk khi provider cần seekable/size (OneDrive `streamSize` / `fstat`).
- **Tối ưu:** concat stream tuần tự chunk → `writeStream` khi adapter không cần seek full file.
- `ChunkConcatStream` (hoặc fopen tuần tự) trong `UploadCloudTaskFileJob`.
- Fallback merge-to-temp theo provider.

Ma trận:

| Provider | Chiến lược |
|----------|------------|
| S3 | Concat / direct multipart client |
| Google Drive | Concat nếu adapter cho; không thì merge |
| Dropbox | Concat nếu adapter cho; không thì merge |
| OneDrive | Giữ merge (cần size) + upload session |
| FTP/SFTP | Ưu tiên concat |
| Telegram | CloudX có thể stream attach; **service phải** nhận upload không `file.read()` full — xem 3.4 |

#### 3.2 Remote upload

- Giữ GET + progress size limit + spool local.
- HEAD: early reject khi Content-Length > max; 405/501/thiếu length soft.
- Không stream-through bỏ disk trong chương trình này.
- Validate create + job giữ nguyên.

#### 3.3 Cancel cooperative

- Vòng dài: định kỳ re-read status (`Cancelled` → abort HTTP, xóa temp, thoát sạch).
- `claimQueuedTask` không đổi.

#### 3.4 Upload Telegram service (cùng phase hoặc sub-task chặn nếu làm Telegram upload lớn)

Trong `telegram-client` `POST /write`:

- Thay `content = await file.read()` bằng ghi stream/chunk vào `temp_path` (ví dụ `aiofiles` / `shutil.copyfileobj` từ `file.file`).
- Giữ index DB + `upload_file` Telethon từ path disk như hiện tại.
- Không đổi contract API (`message_id` response).

Nếu chưa sửa service: ghi rõ giới hạn — upload Telegram lớn vẫn rủi ro OOM service; CloudX concat không đủ một mình.

#### 3.5 Test

- Cancel processing dừng (fake + flip status).
- Unit concat stream.
- Remote oversize progress.
- telegram-client: upload file vừa phải không load full vào một bytes object (nếu có test Python).

### Rủi ro

Trung bình–cao concat đa provider; service write stream trung bình. Allowlist provider nếu cần.

---

## 9. Phase 4 — Listing, cache, quota

### Vấn đề

- OneDrive `listChildren` chỉ trang đầu (`@odata.nextLink` bỏ qua) — `OneDriveClient.php`.
- Telegram: service **đã** paginate; CloudX `listContents` lặp `listAll(100)` đến `total` rồi `CloudFileBrowser` materialize + cache TTL 6h — payload Inertia có thể rất lớn.
- `Cache::remember` stampede cold folder.
- `flushQuota` forget lock + luôn dispatch; không `ShouldBeUnique`.
- `list` vs `listDirectories` trùng provider khi cold.

### Thiết kế

#### 4.1 OneDrive pagination

- Lặp `@odata.nextLink` đến hết hoặc safety cap (vd. 50 trang / 10k item), log khi cap.
- Chưa UI load-more.

#### 4.2 Telegram listing (CloudX; service giữ nguyên)

- Mặc định an toàn UX: vẫn có thể list “đủ” trong cap.
- **Hard cap** config `cloud-storage.telegram.max_list_items` (mặc định **2000**): `TelegramAdapter::listContents` dừng khi đủ cap dù `total` lớn hơn; log warning.
- Không đổi API service; tận dụng `limit`/`offset` hiện có (`le=1000` mỗi request).
- Infinite-scroll / chỉ page đầu UI: **follow-up** (API đã sẵn limit/offset).
- Cache: tránh cache listing > cap; cân nhắc TTL ngắn hơn cho Telegram (optional config).

#### 4.3 Cache single-flight

- Lock ngắn trên miss remember.
- Derive `:dirs` từ full list khi có cache full (một lần provider).

#### 4.4 Job quota

- `UpdateConnectionQuotaJob`: `ShouldBeUnique`, `uniqueId = connectionId`, `uniqueFor` 300–600s.
- `flushQuota`: unique + `delay(15s)` coalesce; không spam forget+dispatch.
- `refreshInBackground`: skip nếu `last_synced_at` trong N phút (mặc định 10) trừ force.

#### 4.5 Test

- OneDrive multi-page fake.
- Telegram adapter: dừng ở cap (mock `listAll`).
- Quota unique `Bus::fake`.
- Directory listing call count.

### Rủi ro

Trung bình (list lâu / API quota). Cap chống runaway.

---

## 10. Phase 5 — Hiệu quả nền tảng

### Vấn đề

- `HandleInertiaRequests` load connections + decrypt credentials FTP/S3 trên mọi trang Inertia.
- Mỗi chunk: `lockForUpdate` + đếm chunk + broadcast (có thể lock thêm).

### Thiết kế

#### 5.1 Tóm tắt connection Inertia

- Share field không-secret (id, name, provider, status, spaces, capabilities).
- FTP/S3 edit config chỉ trang settings connection.
- Không decrypt full credentials trong global share.

#### 5.2 Progress chunk

- Tăng `uploaded_chunks_count`; verify đủ chunk chỉ khi chạm `total_chunks` trước queue job.
- Throttle broadcast; marker Redis nếu cần tránh lock thứ hai.
- Không `cloud_task_parts` trong scope.

#### 5.3 Test

- Inertia share không secret.
- Chunk cuối queue đúng một lần.

### Rủi ro

Trung bình — đổi prop shape; audit frontend types/forms.

---

## 11. Non-goals (chương trình này)

- Remote upload stream-through không disk.
- UI infinite scroll Telegram (API đã paginate; UX để sau).
- Pure streaming Telethon không spool disk trên service.
- Preview URL public/CDN mặc định.
- Bảng `cloud_task_parts`.
- Ẩn OAuth login / đóng preview share / share disk-stat.
- Đổi product max file size.

---

## 12. Checklist tương tác bảo mật

| Guard | Quy tắc khi tối ưu |
|-------|-------------------|
| Validate remote URL SSRF | Giữ create + job; stream vẫn validate redirect |
| Progress size limit | Giữ trên GET; HEAD chỉ early-reject |
| Normalize path | Không đổi |
| Host policy private | Không đổi |
| Preview CSP / private cache | Không đổi khi streaming |
| OAuth fail-closed | Giữ; single-flight refresh chỉ nếu đụng |
| secret_payload | Không trong Inertia/JSON |
| Telegram `X-Token` / session | Không log token; cleanup temp không lộ path ra client |

---

## 13. Tiêu chí thành công

| Metric | Mục tiêu |
|--------|----------|
| Xử lý trùng job upload dài | Hết khi `retry_after` ≥ timeout |
| Peak PHP memory proxy OneDrive/Telegram lớn | Bounded (HTTP stream; không full body string) |
| Temp disk telegram-client sau `/read` | Được cleanup (BackgroundTasks hoặc tương đương) |
| Multi-file upload browser | ≤ 3 active |
| Poll storm | Interval ổn định theo task ID set |
| Folder OneDrive > trang đầu | List đủ trong cap |
| Telegram list | Không vượt hard cap CloudX |
| Quota job burst upload | Gộp unique + delay |
| Payload Inertia global | Không secret FTP/S3 decrypt |
| Upload Telegram lớn (sau 3.4) | Service không `file.read()` full vào RAM |

---

## 14. Thứ tự triển khai & commit

1. Phase 0 — config/env (CloudX)  
2. Phase 1 — streaming CloudX + cleanup `/read` telegram-client + metadata gộp  
3. Phase 2 — upload manager (CloudX FE)  
4. Phase 3 — job disk/cancel CloudX + (khuyến nghị cùng lúc) stream `POST /write` telegram-client  
5. Phase 4 — list/cache/quota CloudX  
6. Phase 5 — Inertia + chunk locks CloudX  

Commit: tách CloudX vs `telegram-client` nếu khác git root; message tiếng Việt + conventional prefix được phép.

---

## 15. Kế hoạch kiểm chứng

CloudX mỗi phase:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=...
```

Rộng sau Phase 1 và 4:

```bash
php artisan test --compact tests/Feature/RemoteUploadTaskTest.php tests/Feature/S3DirectUploadTest.php tests/Feature/CloudFileDownloadTest.php tests/Feature/CloudFilePreviewTest.php tests/Feature/ShareViewTest.php
```

telegram-client:

- Manual: download file → xác nhận file temp trong `TEMP_DIR` bị xóa sau response.
- Manual: upload file lớn vừa (sau 3.4) không spike RAM bất thường.
- (Nếu có pytest/ci) chạy suite hiện có.

Smoke:

1. Upload ≥5 file → chỉ 3 active.  
2. Download/preview OneDrive + Telegram lớn không OOM PHP worker.  
3. Remote oversize fail mid-stream.  
4. Cancel processing dừng tiếp.  
5. OneDrive >200 item list đủ (trong cap).  
6. Telegram > cap item: list cắt + log.  
7. Burst upload → quota job gộp.  
8. Inertia props không lộ secret.  
9. telegram-client temp sau `/read` sạch.

---

## 16. Follow-up mở (không chặn duyệt)

- Gate poll theo Echo connected.  
- UX load-more Telegram (API `/list` đã sẵn).  
- Remote stream-through host tin cậy.  
- Telethon pure stream không spool (phức tạp hơn cleanup FileResponse).  
- Low polish security plan leftovers.  
- Multipart native Google/Dropbox ngoài concat.  
- `assertSuccess` không gọi `body()` trên mọi error path Python client.

---

## 17. Nhật ký rà lại

| Ngày | Thay đổi |
|------|----------|
| 2026-07-26 | Bản đầu High+Medium, safe defaults, tiếng Việt |
| 2026-07-26 | Rà lại với `telegram-client`: `/read` spool disk + thiếu cleanup; `/list` đã paginate; `/write` full `file.read()`; CloudX vẫn body() + list full + timeout 30s; bổ sung Phase 1 service cleanup, Phase 3 service write stream, làm rõ Phase 4 Telegram |
