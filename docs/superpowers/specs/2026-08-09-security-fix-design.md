# CloudX — Thiết kế fix audit bảo mật 2026-08-09

**Ngày:** 2026-08-09
**Trạng thái:** Đã duyệt — chờ triển khai
**Phạm vi:** Fix 6 findings bảo mật từ báo cáo `docs/audit/2026-08-09-security-perf-audit-report.md` (5 SSRF + 1 size_limit_bypass). Hiệu năng để đợt sau.
**Repo CloudX:** `D:\Source\ponta\ponta-cloudx\cloudx`
**Repo telegram-client:** `D:\Source\ponta\ponta-cloudx\telegram-client`

---

## 1. Bối cảnh & lý do pin IP

`HostAddressGuard` hiện resolve DNS rồi chỉ trả `bool` (public hay không) — không lưu IP. Caller (Guzzle, FTP, SFTP, S3) mở kết nối riêng, **resolve DNS lần thứ 2** độc lập. Lỗ hổng TOCTOU: DNS rebinding (attacker chạy authoritative DNS TTL=0, trả IP khác qua các lần hỏi) → guard thấy IP public ở lần check, kết nối thực đi tới IP private/`169.254.169.254` ở lần resolve thứ 2.

**Pin IP** = resolve đúng 1 lần, dùng chính IP đã validate (public) làm host kết nối thực tế → không có lần resolve thứ 2 → rebinding vô tác dụng.

## 2. Tổng quan 3 task

| Task | Fix | Vùng |
|------|-----|------|
| Task 1 — Pin IP cho `HostAddressGuard` | F2-001 + F3-001 | CloudX PHP |
| Task 2 — Guard SSRF Python-side | F4-001 + F5-001 + F5-002 | telegram-client |
| Task 3 — Verify part size ở `complete()` | F2-002 | CloudX PHP |

3 task độc lập, mỗi task có test cycle riêng.

## 3. Task 1 — Pin IP cho `HostAddressGuard`

### 3.1 Thay đổi `app/Services/CloudStorage/HostAddressGuard.php`

Thêm method `resolveAllowedIp(string $host): ?string` — resolve + trả IP public đã pin (hoặc null). Logic mirror `hostIsAllowed` hiện tại nhưng trả IP thay vì bool:

```php
public function resolveAllowedIp(string $host): ?string
{
    if ($host === '') {
        return null;
    }

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return $this->isPublicIp($host) ? $host : null;
    }

    $records = dns_get_record($host, DNS_A + DNS_AAAA);

    if ($records === false || $records === []) {
        $address = gethostbyname($host);

        return $address !== $host && $this->isPublicIp($address) ? $address : null;
    }

    foreach ($records as $record) {
        $address = $record['ip'] ?? $record['ipv6'] ?? null;

        if (is_string($address) && $this->isPublicIp($address)) {
            return $address;
        }
    }

    return null;
}
```

`hostIsAllowed()` refactor thành wrapper gọi `resolveAllowedIp() !== null` (backward-compat cho chỗ chỉ cần check). Các method private `isPublicIp`/`isBlockedSpecialRange` giữ nguyên.

`hostIsAllowedForConnections()` (có allowlist `allowed_private_hosts`/`allow_private_connection_hosts`): thêm `resolveAllowedIpForConnections()` — nếu host trong allowlist thì trả `null` (không pin được IP private, nhưng tin tưởng chủ quan → cho qua, hành vi cũ); ngược lại delegate `resolveAllowedIp()`.

### 3.2 Remote upload job (F2-001) — `app/Jobs/RemoteUploadCloudTaskFileJob.php`

`RemoteUploadUrlGuard` thêm method `resolveIpForUrl(string $url): string` — parse_url lấy host, gọi `resolveAllowedIp()`, throw `ValidationException` nếu null.

Job `request()` (dòng 290-305) dùng IP pin thay host:
- Substitute host trong URL = IP: `http://{ip}/{path}` (giữ path + query).
- Thêm `Host` header = host gốc (cho SNI/virtual host).
- `on_redirect` (dòng 300-302): re-pin IP cho redirect target — gọi `resolveIpForUrl((string) $uri)`, substitute host, giữ `Host` header = redirect host gốc.

`RemoteUploadUrlGuard::validate()` (dùng ở `CloudUploadTaskController`, `VideoDownloaderController`) giữ nguyên — chỉ check bool, vì các controller đó không fetch trực tiếp (forward sang Python service hoặc lưu task). Riêng job fetch trực tiếp nên cần pin IP.

### 3.3 FTP/SFTP/S3 connection (F3-001) — pin IP khi lưu credentials

Pin IP tại lúc store/update connection, lưu vào `credentials['resolved_ip']`:

- `FtpConnectionController::store/update` (dòng 29, 67): `assertConnectionHostAllowed` resolve IP, lưu `$credentials['resolved_ip']`.
- `SftpConnectionController::store/update` (dòng 29, 67): tương tự.
- `S3ConnectionController::assertEndpointHostAllowed` (dòng 87-102): resolve IP cho S3 endpoint host, lưu `$credentials['resolved_ip']`.

Connectors ưu tiên `resolved_ip` làm host khi dựng disk:
- `FtpConnector::diskConfig()` (dòng 49-67): `host` = `resolved_ip` nếu có, kèm `'hostFingerprint'` không đổi (FTP dùng IP làm kết nối).
- `SftpConnector::diskConfig()` (dòng 49-64): tương tự, `host` = `resolved_ip`.
- `S3ConnectionConfig::diskOptions()` + `clientOptions()` (dòng 11-58): `endpoint` rebuild = `https://{resolved_ip}` (hoặc http theo scheme gốc), kèm `Host` header = host gốc qua Guzzle middleware/AWS `Host` header để virtual-host routing đúng.

### 3.4 Rủi ro & xử lý

- **SNI/Host header**: thay host = IP có thể ảnh hưởng server check hostname. FTP/SFTP phpseclib không có Host header → test thật. S3 cần `Host` header đúng.
- **IP stale**: host DNS đổi IP public hợp lệ (CDN) → IP pin cũ có thể stale. Trade-off an toàn > tính năng. Khi user update host → re-resolve IP mới.
- **Task cũ không có `resolved_ip`**: graceful — `diskConfig` fallback về `credentials['host']` (hành vi cũ). Chỉ connection mới/store-update có pin.

## 4. Task 2 — Guard SSRF Python-side (`telegram-client`)

### 4.1 Module mới `telegram-client/url_guard.py`

```python
import ipaddress
import socket
from urllib.parse import urlparse

BLOCKED_MESSAGE = "URL host resolves to a blocked (private/internal/metadata) address."

def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    return (ip.is_private or ip.is_loopback or ip.is_link_local
            or ip.is_reserved or ip.is_unspecified or ip.is_multicast)

def assert_url_allowed(url: str) -> None:
    parts = urlparse(url)
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise ValueError("URL scheme must be http or https")
    host = parts.hostname
    if not host:
        raise ValueError("URL must include a host")
    if _is_blocked_ip(host):
        raise ValueError(BLOCKED_MESSAGE)
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise ValueError(BLOCKED_MESSAGE)
    for info in infos:
        ip = info[4][0]
        if _is_blocked_ip(ip):
            raise ValueError(BLOCKED_MESSAGE)
```

Block toàn bộ dải: private (10/172.16-31/192.168), loopback (127), link-local (169.254 — gồm AWS metadata `169.254.169.254`), reserved, unspecified, multicast. CGNAT (100.64/10) rơi vào `is_private`? — Python `is_private` trả True cho 100.64/10 từ Python 3.x mới; nếu không, thêm check range riêng.

### 4.2 Áp vào `telegram-client/ytdlp_service.py`

- `get_metadata(url, ...)` (dòng 181): gọi `assert_url_allowed(url)` trước `extract_info`.
- `download(url, ...)` (dòng 242): tương tự.

Import: `from url_guard import assert_url_allowed`.

### 4.3 Redirect — residual risk (ghi nhận)

`assert_url_allowed` chỉ check URL ban đầu. yt-dlp `extract_info` follow HTTP 3xx mặc định → attacker public server trả 302 tới internal là vector còn lại. Fix triệt để redirect cần custom yt-dlp `UrllibHandler`/monkeypatch — phức tạp, rủi ro vỡ yt-dlp.

**Quyết định đợt này:** guard URL ban đầu chặn F5-001/F5-002 (gọi thẳng internal IP/domain) + giảm surface. Redirect-to-internal là **residual risk**, note rõ, không giả định fix 100%. Follow-up riêng nếu cần.

## 5. Task 3 — Verify part size ở `complete()` (fix F2-002)

### 5.1 `partDone` — `app/Http/Controllers/CloudUploadDirectCompleteController.php:25-89`

Thêm validation `size` + lưu vào payload:

```php
$validated = $request->validate([
    'etag' => ['required', 'string', 'max:1024'],
    'size' => ['required', 'integer', 'min:1'],  // MỚI
]);

// trong transaction, set partsByNumber[$partNumber]:
$partsByNumber[$partNumber] = [
    'ETag' => $validated['etag'],
    'PartNumber' => $partNumber,
    'Size' => (int) $validated['size'],  // MỚI
];
```

### 5.2 `complete` — dòng 91-144

Sau verify count + part numbers (dòng 130), trước set Queued (dòng 132), thêm:

```php
$declaredSize = (int) ($payload['size'] ?? 0);
$chunkSize = (int) ($payload['chunk_size'] ?? 0);
$maxFileSize = (int) config('cloud-storage.uploads.max_file_size');

$totalUploaded = array_sum(array_map(
    fn (array $part): int => (int) ($part['Size'] ?? 0),
    $parts,
));

if ($totalUploaded > $maxFileSize) {
    throw ValidationException::withMessages([
        'task' => 'Uploaded parts exceed the maximum allowed file size.',
    ]);
}

if ($chunkSize > 0) {
    foreach ($parts as $part) {
        $partSize = (int) ($part['Size'] ?? 0);
        if ($partSize > $chunkSize) {
            throw ValidationException::withMessages([
                'task' => 'Upload part exceeds the allowed chunk size.',
            ]);
        }
    }
}
```

### 5.3 Edge cases

- Mỗi part (kể cả last) không vượt `chunk_size` — chặt chặn nhất, vì client luôn chunk theo `chunk_size`.
- `Size`/`chunk_size` thiếu trong payload (task cũ) → skip check chunk size, nhưng check `totalUploaded > maxFileSize` vẫn chạy nếu có `Size`.
- Client lie `size` → vẫn chặn vì check `totalUploaded > maxFileSize` độc lập khai báo.

### 5.4 Frontend caller

`resources/js/contexts/UploadManagerContext.tsx` (client upload) hiện không gửi `size` cho `partDone` → cần thêm field `size` khi gọi `partDone`. Plan triển khai sẽ note cụ thể.

## 6. Test strategy

### Pest (CloudX)
- `tests/Unit/HostAddressGuardTest.php`: thêm test `resolveAllowedIp()` trả IP public, null cho private/loopback/link-local/CGNAT.
- `tests/Feature/RemoteUploadTaskTest.php`: test remote upload với mocked Guzzle — verify request dùng IP pin (không phải domain).
- `tests/Feature/S3DirectUploadTest.php`: thêm test `complete()` reject khi part `Size > chunk_size`, và tổng `> max_file_size`.
- `tests/Feature/FtpConnectionTest.php` / `SftpConnectionTest.php` / `S3ConnectionTest.php`: verify `resolved_ip` lưu vào credentials sau store/update; diskConfig ưu tiên IP pin.

### Python (telegram-client) — test thủ công
- Gửi `POST /yt-dlp/metadata` với `url=http://169.254.169.254/...` và `url=http://127.0.0.1/...` → xác nhận service reject (400).
- Tương tự `/yt-dlp/download`.
- Không thêm pytest theo quyết định.

### Chạy
- `php artisan test --compact` cho file liên quan.
- `vendor/bin/pint --dirty --format agent` sau sửa PHP.

## 7. Ràng buộc

- PHP 8.4, Laravel 13, Pest 4, Inertia React 19 — bám style hiện có.
- Không đổi dependency app nếu chưa duyệt.
- Mọi thay đổi hành vi backend cần Pest (mới hoặc cập nhật).
- Sau PHP: `vendor/bin/pint --dirty --format agent`.
- Credentials vẫn `encrypted:array`; không lộ `secret_payload`.
- Giữ guarantee bảo mật khác: path normalize, OAuth fail-closed, throttle share verify.
- Trả lời/spec/plan: tiếng Việt; code/identifier/path giữ nguyên.
- Commit message: conventional prefix + mô tả tiếng Việt được phép.
