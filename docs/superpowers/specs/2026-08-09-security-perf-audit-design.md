# CloudX — Kế hoạch audit bảo mật & tối ưu hiệu năng

**Ngày:** 2026-08-09
**Trạng thái:** Đã duyệt — chờ triển khai scan
**Mục đích:** Kiểm tra toàn bộ project để tìm điểm cần tối ưu và scan bảo mật, xuất báo cáo findings (không sửa code).

---

## 1. Mục tiêu

Tạo **báo cáo findings (markdown, không sửa code)** gồm hai nhóm:

- **Bảo mật**: chỉ giữ findings confidence ≥ 8/10 sau verify chéo. Tập trung injection (SQL / command / SSRF / path traversal), authn/authz bypass, IDOR, secret exposure, unsafe deserialization, RCE.
- **Hiệu năng**: N+1, query thừa, memory spike, cache overhead, round-trip thỡ, missing index. Chỉ ghi issue cụ thể có vị trí `file:dòng` + fix đề xuất.

## 2. Phạm vi

**Trong scope:**
- `app/` (106 PHP): controllers, services, models, middleware, requests, jobs.
- `telegram-client` (`D:\Source\ponta\ponta-cloudx\telegram-client`): FastAPI/Telethon service.
- `routes/`, `config/` (liên quan bảo mật/perf), `database/migrations` (cho index/efficiency).

**Ngoài scope:**
- `resources/js` (client-side, không là ranh giới bảo mật theo checklist).
- `tests/`, `vendor/`, `node_modules`.

**Ranh giới bảo mật đã harden (KHÔNG report lại — chỉ flag nếu tìm được bypass cụ thể):**
`HostAddressGuard`, `RemoteUploadUrlGuard`, `PathEncoder`, credentials `encrypted:array`, CSP/private-cache preview, OAuth fail-closed, throttle share verify.

## 3. Kiến trúc scan — Phân vùng + Verify chéo

### Giai đoạn 1 — Finder (song song, theo vùng)

6 subagent đọc code sâu, mỗi vùng trả danh sách findings thô (`file:dòng`, loại, kịch bản khai thác, confidence tự đánh giá).

| # | Vùng | Files trọng tâm | Surface chính |
|---|------|-----------------|---------------|
| F1 | Share-link công khai | `ShareViewController`, `CloudShareController`, `CloudShare` model | route không auth, path traversal `/{path?}`, password verify bypass, IDOR share |
| F2 | Upload/Download/Preview | `CloudUploadPresign/DirectComplete/TaskChunk`, `CloudFileDownload/PreviewController`, `RemoteUploadUrlGuard`, `HostAddressGuard`, `CloudPath`/`PathEncoder` | SSRF presign, path traversal, IDOR task/connection, size bypass |
| F3 | Connectors & credentials | `Connectors/*` (S3/FTP/SFTP/GDrive/OneDrive/Telegram/Dropbox), `CloudConnection`, `S3Presigner`, `S3ClientFactory` | SSRF host, secret leakage, command injection (FTP/SFTP), inject vào config |
| F4 | Video-downloader | `VideoDownloaderController`, `YtDlpClient`, `PythonServiceClient` | command/arg injection qua yt-dlp, SSRF URL, path traversal output |
| F5 | telegram-client (Python) | `telegram-client/main.py`, `client.py` | path traversal temp, RCE qua Telethon, SSRF, unsafe deserialization |
| F6 | Hiệu năng | toàn `app/` + migrations | N+1, query thỡ, memory, cache overhead, missing index, round-trip |

### Giai đoạn 2 — Verifier (song song, mỗi finding 1 verifier)

Mỗi finding từ F1–F5 (bảo mật) + F6 (hiệu năng) được 1 subagent verify độc lập, prompt bắt **cố gắng bác bỏ** (refute). Áp dụng đầy bộ lọc false-positive. Kết quả: `confirmed` + confidence 1–10.

### Giai đoạn 3 — Tổng hợp

Lọc bỏ mọi finding confidence < 8. Gộp trùng, sắp xếp theo severity. Xuất báo cáo markdown cuối (bảo mật trước, hiệu năng sau).

**Luồng dữ liệu:**

```
6 Finder (song song) → flatten findings → N Verifier (song song) → filter ≥8 → Báo cáo
```

## 4. Tiêu chí đánh giá & Định dạng báo cáo

### Tiêu chí bảo mật (giữ nếu ≥8/10 sau verify)

- Severity: HIGH (RCE, data breach, authz bypass) / MEDIUM (cần điều kiện nhưng impact lớn) / LOW (defense-in-depth, chỉ khi cực rõ).
- Mỗi finding phải có: **`file:dòng` cụ thể + kịch bản khai thác cụ thể + đường tấn công** (không lý thuyết).
- Verifier cố gắng **bác bỏ** — chỉ sống sót nếu không bác được.

### Tiêu chí hiệu năng

- Ảnh hưởng thực tế (query lặp trên tập lớn, memory spike khi stream file lớn, cache overhead đáng kể).
- Mỗi finding có: **`file:dòng` + nguyên nhân + fix đề xuất cụ thể**.

### False-positive filter (loại trừ)

DOS, rate-limit, secret-on-disk, outdated deps, log spoofing, SSRF chỉ kiểm soát path, regex injection, open redirect thấp confidence, XSS React (trừ `dangerouslySetInnerHTML`), client-side authz, notebook, shell script không untrusted input, audit log thiếu, doc files.

### Định dạng báo cáo cuối (markdown)

```markdown
# CloudX — Báo cáo audit bảo mật & hiệu năng

## Tóm tắt
- Bảo mật: X HIGH, Y MEDIUM, Z LOW (sau verify ≥8/10)
- Hiệu năng: N findings
- Phạm vi: app/ + telegram-client; ngày: 2026-08-09

## A. Bảo mật
### [HIGH] sql_injection — `app/...:42`
- Mô tả: ...
- Kịch bản khai thác: ...
- Fix đề xuất: ...
- Confidence: 9/10

## B. Hiệu năng
### [MED] N+1 — `app/...:88`
- Nguyên nhân: ...
- Fix đề xuất: ...

## C. Đã kiểm tra, không tìm thấy vấn đề
- Vùng F5 telegram-client: ...
```

## 5. Tooling bổ sung

- **SonarQube MCP** (project `ngotuananh101_cloudx`): lấy security hotspots/issues làm **tín hiệu đối chiếu**, không làm nguồn chính.
- **Laravel Boost** `database-schema` / `database-query`: cho index/structure khi cần kiểm chứng hiệu năng.
- **Workflow đa-agent**: tổ chức Finder + Verifier song song theo luồng dữ liệu mục 3.

## 6. Ràng buộc

- Đọc code để xác định, không cần chạy lệnh reproduce.
- Không sửa code, không tạo file ngoài báo cáo.
- Trả lời/spec/báo cáo: tiếng Việt; code/identifier/path giữ nguyên.
- Repo CloudX: `D:\Source\ponta\ponta-cloudx\cloudx`.
- Repo telegram-client: `D:\Source\ponta\ponta-cloudx\telegram-client`.
