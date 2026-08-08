# CloudX — Báo cáo audit bảo mật & hiệu năng

**Ngày:** 2026-08-09
**Phạm vi:** `app/` (CloudX Laravel) + `telegram-client` (Python service)
**Phương pháp:** 6 Finder song song → Verifier bác bỏ từng finding → lọc confidence ≥8/10
**Spec:** `docs/superpowers/specs/2026-08-09-security-perf-audit-design.md`

---

## Tóm tắt

- **Bảo mật:** 5 HIGH, 1 MEDIUM (6 findings, tất cả CONFIRMED sau verify chéo, confidence 9–10)
- **Hiệu năng:** 5 findings (1 LOW, 4 MEDIUM)
- Tổng findings kiểm tra: 11 (sau Finder) → 11 còn lại (sau Verifier, tất cả ≥8)
- **SonarQube:** 0 security hotspot TO_REVIEW, 0 SECURITY issue HIGH/BLOCKER (13 issue MINOR đều là IP blocklist trong `HostAddressGuard`/tests — là guard harden, không phải vuln)

**Điểm nóng:** Toàn bộ 6 findings bảo mật đều xoay quanh **SSRF** — `HostAddressGuard`/`RemoteUploadUrlGuard` resolve DNS rồi trả bool mà không pin IP, nên DNS rebinding + redirect bypass xuyên suốt từ connection → upload remote → video-downloader → yt-dlp service. Đây là nhóm nên ưu tiên sửa trước.

---

## A. Bảo mật

### [HIGH] ssrf — DNS rebinding trong remote upload — `app/Jobs/RemoteUploadCloudTaskFileJob.php:132`

- **Mô tả:** `RemoteUploadUrlGuard::validate()` → `HostAddressGuard::hostIsAllowed()` resolve DNS (`dns_get_record`/`gethostbyname`) và chỉ trả **bool** kiểm tra IP public — không pin IP. Ngay sau đó, job fetch cùng URL qua HTTP client (`ensureRemoteFileIsAllowed()` HEAD ở dòng 140, `downloadRemoteFile()` GET ở dòng 141), truyền **string URL gốc chứa domain** cho Guzzle, khiến Guzzle resolve DNS độc lập. TOCTOU này cho phép DNS rebinding: domain attacker trả IP public ở lần check của guard, IP private/`169.254.169.254` ở lần fetch của HTTP client.
- **Kịch bản khai thác:** Attacker đăng ký `evil.com` với DNS rebinding server (TTL thấp, luân phiên `1.2.3.4` / `169.254.169.254`). Tạo upload task `upload_mode=remote`, `url=http://evil.com/secret`. Guard resolve → `1.2.3.4` (public) → chấp nhận. HTTP client resolve lại → `169.254.169.254` (AWS IMDS) → rò rỉ IAM credentials hoặc tiếp cận internal services.
- **Fix đề xuất:** Pin IP đã validate — `HostAddressGuard` resolve một lần và trả về IP thay vì bool; caller fetch bằng IP đó (kèm `Host` header) hoặc resolve+connect trong cùng bước, từ chối nếu IP kết nối khác IP đã validate. Callback `on_redirect` phải re-validate IP của redirect target bằng cùng cache.
- **Confidence:** 10/10 | **Region:** F2

### [HIGH] ssrf — DNS rebinding trong connection host — `app/Services/CloudStorage/HostAddressGuard.php:9`

- **Mô tả:** `assertConnectionHostAllowed()` (`:50`) / `hostIsAllowed()` (`:9`) resolve DNS, xác minh record là public, rồi trả bool/void — không cache/pin IP. Ngay sau đó `testConnection()` (`FtpConnectionController.php:29-32`) truyền hostname gốc (chưa pin IP) vào `connector->diskFromCredentials()`, khiến FTP extension (`ftp_connect`) / phpseclib (SFTP) resolve lại host độc lập khi mở socket. Cùng pattern cho S3 endpoint (`S3ConnectionController::assertEndpointHostAllowed`) và mọi lần dựng disk sau (`CloudStorageManager::disk()`/jobs).
- **Kịch bản khai thác:** Attacker (user đăng ký) tạo domain `evil.attacker.com` authoritative DNS TTL=0. POST tạo SFTP connection `host=evil.attacker.com`. Guard resolve → `203.0.113.9` (public) → pass. `testConnection` resolve lại → `169.254.169.254` hoặc `10.x` internal → client mở TCP tới internal host từ trong mạng cloud deploy. FTP active mode còn có thể ép server mở connection ngược (FTP bounce).
- **Fix đề xuất:** Pin IP đã validate cho toàn bộ vòng đời kết nối — resolve một lần, dùng IP đó làm host thực tế (kèm SNI/Host header nếu cần) cho `testConnection` và mọi `disk()` sau này. Hoặc resolve+connect trong cùng bước, reject nếu IP socket khác IP đã validate.
- **Confidence:** 10/10 | **Region:** F3

### [HIGH] ssrf — redirect bypass trong video-downloader — `app/Http/Controllers/VideoDownloaderController.php:40`

- **Mô tả:** `RemoteUploadUrlGuard` (gọi tại `:40` metadata, `:71` download) chỉ validate host **ban đầu** của URL: `parse_url` lấy scheme+host rồi `HostAddressGuard` check public IP. Sau đó URL forward **nguyên si** (không pin IP, không giới hạn redirect) sang Python yt-dlp service qua `YtDlpClient::fetchMetadata/downloadStream`. `ydl_opts` (`ytdlp_service.py:131-140`) không chặn redirect hay private IP. yt-dlp mặc định follow HTTP 3xx → attacker public server trả 302 tới internal host.
- **Kịch bản khai thác:** Attacker domain công khai resolve public (qua guard), host trả `302 Location: http://169.254.169.254/latest/meta-data/iam/security-credentials/<role>`. Authenticated user `POST /video-downloader/metadata?url=http://attacker.com/redir` → Laravel forward cho yt-dlp → follow 302 tới internal → exfil cloud credential trong JSON metadata (title/description).
- **Fix đề xuất:** Pin IP + validate redirect target: bật `no_redirect` trong `ydl_opts` rồi re-validate từng redirect, hoặc thêm middleware yt-dlp block private/loopback/link-local IP. Tốt nhất là validate host/IP ở **Python service** (xem F5-001/002) vì đó là nơi fetch thực sự.
- **Confidence:** 9/10 | **Region:** F4

### [HIGH] ssrf — `/yt-dlp/metadata` không validate host/IP — `telegram-client/main.py:385`

- **Mô tả:** Endpoint `/yt-dlp/metadata` truyền nguyên `data.url` (HTTP body, attacker-controlled) thẳng vào `YtDlpService.get_metadata` (`ytdlp_service.py:181`) → `yt_dlp.YoutubeDL(opts).extract_info(url, download=False)` (`:193`). Không allowlist host/scheme, không block private IP (`10.x/172.16-31.x/192.168.x`) hay cloud-metadata `169.254.169.254`. yt-dlp generic extractor issue HTTP GET tới host attacker chỉ định, parse HTML, trả title/description/thumbnail trong JSON (`main.py:386`).
- **Kịch bản khai thác:** `POST /yt-dlp/metadata {"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/role-name"}` hoặc `{"url":"http://internal-admin.corp:8080/"}`. Service fetch URL nội bộ, trả title/description trang nội bộ → leak thông tin + map internal network qua nhiều IP/port (port scan mù qua khác biệt error/response).
- **Fix đề xuất:** Thêm validation ở Python service: parse URL, giới hạn scheme `http/https`, resolve host, reject nếu IP thuộc private/loopback/link-local/CGNAT/metadata range (`169.254.169.254`). Tái xác thực sau redirect. Nếu giữ guard ở Laravel, vẫn phải validate lại ở Python vì service nhận URL trực tiếp.
- **Confidence:** 9/10 | **Region:** F5

### [HIGH] ssrf — `/yt-dlp/download` proxy đọc nội bộ — `telegram-client/main.py:395`

- **Mô tả:** Endpoint `/yt-dlp/download` truyền nguyên `data.url` vào `YtDlpService.download` (`ytdlp_service.py:242`) → `yt_dlp.YoutubeDL(ydl_opts).extract_info(url, download=True)` (`:284`). `ydl_opts` (`:253-275`) không có filter host/IP. yt-dlp download nội dung URL về `storage/downloads` (`mkstemp`, `:246`) rồi `main.py` stream byte về caller qua `StreamingResponse` (`:406-415`). Attacker kiểm soát full host+protocol → service thành proxy download nội bộ.
- **Kịch bản khai thác:** `POST /yt-dlp/download {"url": "http://internal-fileserver.local/recordings/confidential.mp4"}`. yt-dlp download file nội bộ về temp, endpoint stream byte về attacker → exfiltrate file nội bộ.
- **Fix đề xuất:** Cùng validation host/IP như F5-001, áp dụng cho cả path download. Ngoài ra giới hạn scheme và reject redirect tới private range.
- **Confidence:** 9/10 | **Region:** F5

### [MEDIUM] size_limit_bypass — direct S3 multipart upload không verify kích thước part — `app/Http/Controllers/CloudUploadDirectCompleteController.php:112`

- **Mô tả:** `complete()` (`:91-144`) chỉ verify `count($parts) === $totalChunks` và part numbers liên tiếp (`1..N`), **không bao giờ verify kích thước** mỗi part so với `chunk_size` hay `size` khai báo. `max_file_size` chỉ check với `size` client khai báo lúc tạo task (`CloudUploadTaskController::store`). `partDone()` (`:25-89`) chỉ lưu `etag`+`PartNumber`, không ghi nhận size. Presigned UploadPart URL (`S3Presigner::presignUploadPart`) không áp size cap ngoài giới hạn 5GB/part của S3.
- **Kịch bản khai thác:** Attacker tạo direct upload task `size=5MB`, `chunk_size=5MB` → `totalChunks=1`. Lấy presigned UploadPart URL, `PUT` file 5GB (S3 chấp nhận tới 5GB cho last part), lấy ETag, `complete()` thấy 1 part = totalChunks → pass → lưu file 5GB dù khai báo 5MB. Với `chunk_size` nhỏ → 10000 part × 5GB = ~50TB.
- **Fix đề xuất:** (1) Yêu cầu client gửi `size` từng part trong `partDone`, lưu vào payload, verify `sum(part sizes) ≤ max_file_size` và mỗi `part_size ≤ chunk_size` (cho phép last part nhỏ hơn) ở `complete()`. (2) Hoặc sau `completeMultipartUpload`, query `ListParts` lấy `size` thực và reject/abort nếu vượt `max_file_size`.
- **Confidence:** 9/10 | **Region:** F2

---

## B. Hiệu năng

### [MED] query_redundancy — 100 INSERT tuần tự khi xóa items — `app/Http/Controllers/CloudItemController.php:49`

- **Nguyên nhân:** Trong foreach xóa tối đa 100 items, mỗi item gọi `$this->activityLogger->log()` → `ActivityLog::create()` = 1 INSERT riêng. 100 items = 100 round-trip DB tuần tự trong 1 request đồng bộ, không gom batch, không queue.
- **Fix đề xuất:** Thu thập subjectName trong loop, sau loop gọi 1 lần `ActivityLog::insert([...])` (set `created_at` = now) hoặc dispatch 1 job queue ghi log. Giảm 100 INSERT → 1.
- **Confidence:** 9/10

### [MED] query_redundancy — 100 INSERT tuần tự khi move items — `app/Http/Controllers/CloudItemMoveController.php:59`

- **Nguyên nhân:** Tương tự CloudItemController::destroy — foreach move tối đa 100 items, mỗi item `activityLogger->log()` = 1 INSERT vào `activity_logs`. 100 round-trip tuần tự.
- **Fix đề xuất:** Gom toàn bộ activity log records thành mảng, 1 lần `ActivityLog::insert([...])` sau loop, hoặc dispatch 1 job. Giảm 100 → 1.
- **Confidence:** 9/10

### [MED] redundant_http_roundtrip — 2-3 HTTP round-trip metadata trước mỗi download/preview — `app/Support/CloudFileResponseFactory.php:46`

- **Nguyên nhân:** `resolveMeta()` gọi lần lượt `$disk->mimeType($path)` rồi `$disk->fileSize($path)` như 2 lời gọi riêng. Với OneDrive/Google Drive adapter, mỗi lời gọi là 1 HTTP round-trip tới provider API. Khi `fileSize()` ném `UnableToRetrieveMetadata` còn gọi thêm `$disk->exists($path)` (thêm 1 round-trip). Mỗi download/preview tốn 2-3 HTTP chỉ để lấy metadata trước khi stream.
- **Fix đề xuất:** Gọi metadata 1 lần qua adapter (`OneDriveAdapter::metadata()` đã gọi `item()` 1 lần cho cả mimeType/lastModified/fileSize) — override `resolveMeta` dùng adapter trực tiếp thay vì 3 method Flysystem riêng. Giảm 2-3 → 1 round-trip mỗi download/preview.
- **Confidence:** 8/10

### [MED] missing_index — thiếu index tổng hợp trên `cloud_shares` — `database/migrations/2026_06_07_060506_create_cloud_shares_table.php:18`

- **Nguyên nhân:** Migration chỉ tạo FK index đơn lẻ trên `cloud_connection_id` + unique(`uuid`). Không có index tổng hợp `(cloud_connection_id, path)` dù `CloudShareController::index` (Api) query `where('cloud_connection_id', ...)->where('path', ...)` — chạy thường xuyên khi duyệt file. Cũng thiếu `(user_id, created_at)` cho `SharedLinkController::index` query `where user_id` + `orderBy created_at desc` paginate 15.
- **Fix đề xuất:** Thêm migration: `$table->index(['cloud_connection_id', 'path']);` và `$table->index(['user_id', 'created_at']);` trên `cloud_shares`.
- **Confidence:** 8/10

### [LOW] redundant_http_roundtrip — 3 HTTP tuần tự trong OAuth callback OneDrive — `app/Services/CloudStorage/Connectors/OneDriveConnector.php:82`

- **Nguyên nhân:** `handleCallback` thực hiện 3 HTTP request tuần tự: (1) POST token endpoint đổi code, (2) GET `/me` lấy thông tin user, (3) GET `/me/drive` lấy quota. (2) và (3) độc lập nhưng chạy nối tiếp, mỗi cái timeout 10s + retry.
- **Fix đề xuất:** Chạy GET `/me` và `/me/drive` song song bằng `Http::pool()` sau khi có access_token, hoặc gộp (chỉ cần `/me/drive` vì đã trả drive+quota; email lấy riêng nếu bắt buộc). Giảm 3 → 2 round-trip tuần tự.
- **Confidence:** 8/10

---

## C. Đã kiểm tra, không tìm thấy vấn đề (≥8/10)

- **F1 Share-link công khai (`ShareViewController`, `CloudShareController`, `CloudShare`):** Finder không phát hiện path traversal qua `{path?}`, password verify bypass, hay IDOR. Route `s/{uuid}` dùng UUID unguessable, throttle verify `5,1`, CSP/private-cache preview. Sạch.
- **F6 hiệu năng (toàn `app/`):** ngoài 5 findings trên, phần còn lại (upload jobs, cache single-flight, quota, stream download) đã được tối ưu ở spec `2026-07-26` và không có vấn đề mới ≥8/10.

## D. Tín hiệu SonarQube cần xem

- **0 security hotspot TO_REVIEW**, **0 SECURITY issue HIGH/BLOCKER**.
- 13 issue MINOR (rule `php:S1313` hardcoded IP tại `HostAddressGuard.php:105-108` + `tests/Unit/HostAddressGuardTest.php`; rule `php:S5332` HTTP tại `tests/Feature/CloudFileResponseFactoryTest.php:24`). Đây là IP blocklist private-range của guard harden + test fixtures — **không phải vuln**, không cần hành động. Sonar không phát hiện được logic flaw SSRF (DNS rebinding/redirect) vì đó là static rule, xác nhận lại rằng audit thủ công là cần thiết.
