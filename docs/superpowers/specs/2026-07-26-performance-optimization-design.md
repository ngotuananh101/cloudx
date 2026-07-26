# CloudX — Thiết kế tối ưu hiệu năng & độ tin cậy

**Ngày:** 2026-07-26  
**Trạng thái:** Bản nháp chờ review  
**Phạm vi:** Chỉ High + Medium (Low polish để sau)  
**Mặc định product:** An toàn (giữ spool local cho remote upload; Telegram vẫn list đầy đủ + hard cap; cancel cooperative giữa vòng lặp)

---

## 1. Mục tiêu

Nâng độ tin cậy khi upload chạy lâu, giảm spike bộ nhớ lúc download/preview, giảm API/queue/browser thừa, và làm multi-file upload hành xử ổn định — **không** làm yếu các lớp bảo mật vừa harden (SSRF, giới hạn size, normalize path, OAuth fail-closed).

**Ngoài phạm vi (Low polish để sau):** polish zero-byte (trừ guard client nếu rẻ), share create disk-stat, ẩn nút OAuth login chết, đóng preview share folder, bảng `cloud_task_parts`, index DB composite trừ khi phase cần, remote stream-through không disk, UX infinite-scroll Telegram.

---

## 2. Ràng buộc

- PHP 8.4, Laravel 13, Pest 4, Inertia React 19 — bám style hiện có.
- Không đổi dependency app nếu chưa được duyệt.
- Mọi thay đổi hành vi backend cần Pest test (mới hoặc cập nhật).
- Sau sửa PHP: `vendor/bin/pint --dirty --format agent`.
- Credentials vẫn `encrypted:array`; không bao giờ lộ `secret_payload` trong JSON.
- Giữ guarantee bảo mật: validate remote URL, abort size mid-stream, host policy, normalize path.
- Ưu tiên sửa config/worker hơn code nếu tương đương.

---

## 3. Tổng quan kiến trúc

Thứ tự: **đúng/tin cậy** trước **throughput**; **bộ nhớ server** trước **UI polish**.

```
Phase 0  Căn chỉnh queue/worker config
Phase 1  True streaming + gộp metadata download/preview
Phase 2  Upload manager: pool concurrency, poll, abort, tách re-render
Phase 3  Hiệu quả disk job + cancel cooperative
Phase 4  Phân trang listing + cache single-flight + quota unique/debounce
Phase 5  Gầy payload Inertia connection + giảm lock chunk
```

Nguyên tắc chung:

1. **Stream, không buffer** — adapter provider không được `$response->body()` với nội dung lớn.
2. **Single-flight việc đắt** — miss cache listing, refresh quota, refresh token.
3. **Giới hạn concurrency** — worker upload trên browser và (tuỳ chọn) tách queue.
4. **Giữ fail-closed size/SSRF** — tối ưu quanh guard, không gỡ guard.

---

## 4. Phase 0 — Queue & worker đúng cấu hình

### Vấn đề

- Job upload: timeout 1200–1500s (`UploadCloudTaskFileJob`, `CompleteS3MultipartUploadJob`, `RemoteUploadCloudTaskFileJob`).
- `retry_after` mặc định database/redis queue là **90s** (`config/queue.php`).
- Worker có thể re-release job vẫn đang chạy → race claim trùng, upload đôi, tốn bandwidth.

### Thiết kế

1. Nâng mặc định `REDIS_QUEUE_RETRY_AFTER` / `DB_QUEUE_RETRY_AFTER` lên **tối thiểu 2100** (timeout job max 1500 + buffer), ghi chú trong `.env.example`.
2. Ghi chú worker: `--timeout=1500` (hoặc ≥ job dài nhất) trong comment `.env.example` / ops notes nếu đã có.
3. Tuỳ chọn (cùng phase nếu rủi ro thấp): queue riêng `uploads` / `remote-uploads` qua `$this->onQueue(...)` trên ba job dài — **chỉ khi** worker đã hỗ trợ multi-queue; không thì để follow-up ops.

### Test

- Test cấu hình nhẹ: assert `retry_after` ≥ timeout job (đọc config sau bind env).
- Phase này không đổi logic claim job.

### Rủi ro

Thấp. Deploy phải restart worker với timeout/retry_after mới cùng lúc.

---

## 5. Phase 1 — Download & preview an toàn bộ nhớ

### Vấn đề

- `OneDriveClient::downloadStream` nạp full body string rồi `php://temp`.
- `TelegramClient::downloadStream` cùng pattern qua `download()` → body.
- Controller download/preview thường gọi `exists` + `mimeType` + `fileSize` + `readStream` (3–5 remote op).
- Direct link đã có cho S3/OneDrive/Dropbox/Google Drive qua `ProvidesDirectDownloadLink` — **download** vẫn ưu tiên redirect.

### Thiết kế

#### 1.1 True streaming

**OneDriveClient**

- GET streaming với Laravel HTTP/Guzzle `withOptions(['stream' => true])`.
- Trả PHP resource (detach PSR stream hoặc wrapper), không materialize full body.
- `download(): string` chỉ giữ cho use-case nhỏ / nội bộ, hoặc chuyển caller sang stream.
- Timeout content giữ mức cao (đã ~120s); file rất lớn nên đi `directDownloadLink` khi có.

**TelegramClient**

- Stream từ Python service với `stream => true`.
- Tăng timeout path download stream (vượt 30s mặc định), config-driven nếu được.
- Nếu Python service chưa stream được: implement phía client + xác minh service; nếu chặn, ghi dependency và fallback kèm hard max size cho proxy path.

#### 1.2 Gộp metadata

Helper nhỏ dùng chung download/preview/share stream, ví dụ `CloudFileResponseFactory` hoặc trait private:

- Một lần resolve metadata: name, mime, size (best-effort).
- Bỏ `exists` riêng khi metadata đã authoritative (404 → not found).
- Sau đó một `readStream`.
- Download: ưu tiên `directDownloadLink` (hiện có); preview vẫn có thể proxy khi cần header inline/CSP.

#### 1.3 Test

- Unit/feature: mock HTTP stream OneDrive/Telegram — không đi full-body (hoặc assert resource stream / đọc theo chunk).
- Feature: preview/download vẫn set disposition, nosniff, CSP cho HTML/SVG.
- Test redirect download hiện có vẫn xanh.

### Rủi ro

Trung bình. Error handling adapter và refresh token vẫn phải chạy. Không làm yếu CSP/cache header từ security work.

---

## 6. Phase 2 — Upload manager (frontend)

### Vấn đề

- `enqueue` start **mọi** file ngay (không pool).
- Poll 3s phụ thuộc full `items` → interval restart mỗi progress tick; chạy cả khi Echo sống.
- Không `AbortController`; cancel phải chờ chunk đang bay.
- Context `value` gồm `items` → File Browser re-render mỗi chunk.
- Double `router.reload` khi complete (local + broadcast).
- `File` blob giữ đến khi user remove thủ công.

### Thiết kế

#### 2.1 Pool concurrency

- Hằng `MAX_CONCURRENT_UPLOADS = 3`.
- Item vào queue ở `pending`; scheduler start upload đến khi 3 active (client `uploading`, không phải server `processing`).
- Khi active complete/fail/cancel/pause → start pending tiếp.
- Remote enqueue: chỉ tính vào pool lúc tạo task (rẻ); job server không giới hạn phía browser (worker queue lo).

#### 2.2 Polling

- Chỉ poll task status server `queued` | `processing` (sau khi client xong gửi chunk).
- Lưu active task ID trong ref; effect interval phụ thuộc **chuỗi ID đã sort**, không phụ thuộc full `items`.
- Ưu tiên Echo; poll fallback 3s luôn bật ở v1 (an toàn, không bắt buộc gắn Echo connection state). Sau có thể gate theo trạng thái Echo.
- Cap: một request/task/tick; bỏ qua nếu poll trước của task đó còn in-flight.

#### 2.3 Abort

- `Map<itemKey, AbortController>`; controller mới mỗi lần chạy upload.
- Truyền `signal` qua `requestJson` và `fetch` PUT direct.
- Cancel/pause abort controller; UI bỏ qua lỗi abort.
- Mở rộng `request-json.ts` nhận optional `signal`.

#### 2.4 Tách re-render

- Dual context:
  - `UploadManagerActionsContext` — callback ổn định.
  - `UploadManagerStateContext` — `items`, `isPanelVisible`.
- File browser chỉ dùng actions; panel dùng state.

#### 2.5 Refresh & bộ nhớ

- Debounce `router.reload({ only: ['files', 'connection'] })` 400ms; một owner (ưu tiên merge broadcast/poll; bỏ hoặc guard gọi cuối `uploadFile`).
- Sau status terminal, gỡ field nặng `file` / `remote` (giữ name, size, status).
- (Tuỳ chọn) auto-remove item completed sau 10 phút nếu gọn.

#### 2.6 Kiểm chứng

- Checklist manual trong verification phase.
- Unit frontend chỉ khi project đã có infra; không thì manual.

### Rủi ro

Trung bình (race scheduler pool). CSRF header phải giữ trên retry không bị abort nhầm.

---

## 7. Phase 3 — Hiệu quả disk job & cancel cooperative

### Vấn đề

- Backend upload merge mọi chunk vào `merged.bin` rồi đọc lại `writeStream` (~2× disk, tới 5GB).
- Remote upload luôn HEAD + GET spool + re-upload.
- Cancel sau claim không dừng vòng merge/download.

### Thiết kế

#### 3.1 Đường merge

- **Mặc định an toàn:** giữ merge on-disk khi provider cần seekable/size (`OneDriveClient::streamSize` dùng `fstat`).
- **Tối ưu:** khi adapter nhận stream tuần tự (có/không cần size) không cần seek → stream nối chunk thẳng vào `writeStream` (resource concat), **không** full `merged.bin`.
- `ChunkConcatStream` (hoặc callback fopen tuần tự) dùng trong `UploadCloudTaskFileJob`.
- Provider fail thiếu Content-Length → fallback merge-to-temp cho provider đó.

Ma trận (mặc định an toàn):

| Provider | Chiến lược |
|----------|------------|
| S3 | Concat stream → writeStream (hoặc đã có direct multipart client) |
| Google Drive | Concat nếu adapter cho; không thì merge |
| Dropbox | Concat nếu adapter cho; không thì merge |
| OneDrive | Giữ merge (cần size) rồi upload session hiện có |
| FTP/SFTP | Ưu tiên concat stream |
| Telegram | Merge hoặc sized stream theo Python API |

#### 3.2 Remote upload

- Giữ GET + progress size limit + spool local (mặc định an toàn).
- HEAD: **early reject** khi Content-Length có và > max; 405/501/thiếu length không fail cứng (đã soft).
- **Không** bỏ spool local trong chương trình này (stream-through để sau).
- Validate lúc create + job giữ nguyên (TOCTOU).

#### 3.3 Cancel cooperative

- Trong vòng dài (merge chunk, progress remote, upload chunk OneDrive): định kỳ đọc lại status task (mỗi N chunk / mỗi progress tick).
- Nếu `Cancelled`: abort HTTP nếu được, xóa temp, thoát (không rethrow storm).
- `claimQueuedTask` Queued→Processing không đổi.

#### 3.4 Test

- Feature: cancel khi processing cuối cùng dừng (fake disk + flip status).
- Unit concat stream; feature upload không tạo `merged.bin` khi đi concat path (nếu assert được).
- Remote: oversize vẫn fail qua progress; nhánh HEAD optional được cover.

### Rủi ro

Trung bình–cao cho concat đa provider. Có thể ship allowlist (S3/FTP/SFTP trước).

---

## 8. Phase 4 — Listing, cache, quota

### Vấn đề

- OneDrive `listChildren` chỉ trang đầu (`@odata.nextLink` bỏ qua).
- Telegram list cả history vào cache 6h.
- `Cache::remember` stampede khi cold folder.
- `flushQuota` forget lock rồi luôn dispatch; không `ShouldBeUnique`.
- `list` vs `listDirectories` trùng gọi provider khi cold cache.

### Thiết kế

#### 4.1 Phân trang OneDrive

- Lặp `@odata.nextLink` đến hết hoặc safety cap (vd. 50 trang / 10k item), log khi cap.
- Mặc định an toàn: list đủ trong cap (chưa UI load-more).

#### 4.2 Telegram

- Mặc định an toàn: **giữ full list** cho UX.
- Thêm **hard safety cap** (config `telegram.max_list_items`, mặc định vd. 2000), log khi cắt — chặn memory unbounded, ít đổi UX tài khoản thường.
- Infinite-scroll để sau.

#### 4.3 Cache single-flight

- Miss remember → `Cache::lock("cloud:list:lock:...")` TTL ngắn; waiter sau retry remember.
- Directory listing derive từ full folder listing khi đã có cache full (một lần gọi provider → ghi cả hai key).

#### 4.4 Job quota

- `UpdateConnectionQuotaJob`: `ShouldBeUnique`, `uniqueId = connectionId`, `uniqueFor = 300` (hoặc 600).
- `flushQuota`: không luôn forget lock rồi dispatch; dùng unique job + `delay(now()->addSeconds(15))` để gộp burst.
- `refreshInBackground`: bỏ qua nếu `last_synced_at` trong N phút (config, mặc định 10) trừ khi force.

#### 4.5 Test

- OneDrive multi-page Graph fake.
- Quota: dispatch hai lần → một unique job (`Bus::fake`).
- Directory listing: connector mock call count = 1 khi warm path.

### Rủi ro

Trung bình (list lâu hơn / tốn quota API). Cap chống runaway.

---

## 9. Phase 5 — Hiệu quả nền tảng

### Vấn đề

- `HandleInertiaRequests` load mọi connection và decrypt credentials FTP/S3 trên **mọi** trang Inertia.
- Mỗi chunk: `lockForUpdate` + đếm chunk + broadcast progress (có thể lock lần hai).

### Thiết kế

#### 5.1 Tóm tắt connection trên Inertia

- Share chỉ field không-secret cần global (id, name, provider, status, spaces, capability flags).
- Config edit FTP/S3 chỉ trên trang/settings connection (prop riêng).
- Không decrypt full credentials trong global share.

#### 5.2 Đường progress chunk

- Tin `uploaded_chunks_count` tăng dần; chỉ verify đủ chunk khi chạm `total_chunks` trước khi queue job.
- Throttle broadcast (đã ~5%): marker last broadcast trên Redis `upload:progress:{taskId}` nếu cần, tránh lock thứ hai chỉ để marker.
- Không redesign JSON parts multipart trong scope này (bảng parts = Low/để sau).

#### 5.3 Test

- Feature Inertia share: payload connection không chứa secret.
- Chunk cuối vẫn queue upload job đúng một lần.

### Rủi ro

Trung bình — đổi shape prop Inertia; audit type frontend (`User` connections, form connection).

---

## 10. Non-goals rõ ràng (chương trình này)

- Remote upload stream-through không disk.
- UI infinite scroll / load-more Telegram.
- Preview URL public/CDN mặc định.
- Bảng `cloud_task_parts`.
- Ẩn nút OAuth login / đóng preview share / share disk-stat (polish riêng).
- Đổi product limit max file size.

---

## 11. Checklist tương tác bảo mật

| Guard | Quy tắc khi tối ưu |
|-------|-------------------|
| Validate remote URL SSRF | Giữ lúc create + job; stream vẫn validate redirect |
| Progress size limit | Giữ trên GET; HEAD chỉ early-reject |
| Normalize path | Không đổi |
| Host policy private | Không đổi |
| Preview CSP / private cache | Không đổi khi streaming |
| OAuth fail-closed | Giữ; single-flight refresh chỉ nếu đụng tới |
| secret_payload | Không bao giờ trong Inertia/JSON |

---

## 12. Tiêu chí thành công

| Metric | Mục tiêu |
|--------|----------|
| Xử lý trùng job upload dài | Hết khi `retry_after` ≥ timeout |
| Peak PHP memory proxy OneDrive/Telegram lớn | Bounded (stream; không full body string) |
| Multi-file upload browser | ≤ 3 upload active đồng thời |
| Poll storm | Interval ổn định; không restart mỗi progress tick |
| Folder OneDrive > trang đầu | List đủ trong safety cap |
| Quota job mỗi burst upload | Gộp (unique + delay) |
| Payload Inertia global | Không secret FTP/S3 đã decrypt |

---

## 13. Thứ tự triển khai & commit

1. Phase 0 — config/env  
2. Phase 1 — streaming + metadata  
3. Phase 2 — upload manager  
4. Phase 3 — job cancel/disk  
5. Phase 4 — list/cache/quota  
6. Phase 5 — Inertia + chunk locks  

Một commit logic / phase (hoặc tách backend/frontend trong phase nếu lớn).

---

## 14. Kế hoạch kiểm chứng

Mỗi phase:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=...   # theo phase
```

Rộng hơn sau Phase 1 và Phase 4:

```bash
php artisan test --compact tests/Feature/RemoteUploadTaskTest.php tests/Feature/S3DirectUploadTest.php tests/Feature/CloudFileDownloadTest.php tests/Feature/CloudFilePreviewTest.php tests/Feature/ShareViewTest.php
```

Smoke manual:

1. Upload ≥5 file → chỉ 3 active.  
2. Download/preview file OneDrive lớn không OOM worker.  
3. Remote upload oversize vẫn fail mid-stream.  
4. Cancel lúc processing dừng việc tiếp.  
5. Folder OneDrive >200 item list đủ (trong cap).  
6. Burst upload → một quota job.  
7. Duyệt app → prop Inertia không lộ credential secret.

---

## 15. Follow-up mở (không chặn approve)

- Gate poll theo Echo connected.  
- UX load-more Telegram.  
- Remote stream-through host tin cậy.  
- Batch Low polish còn lại từ security plan.  
- Multipart native backend Google/Dropbox ngoài concat stream.
