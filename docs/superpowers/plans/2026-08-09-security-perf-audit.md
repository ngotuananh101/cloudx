# Audit Bảo Mật & Tối Ưu Hiệu Năng CloudX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quét toàn bộ CloudX (`app/`) + `telegram-client` để tìm lỗ hổng bảo mật (confidence ≥8/10 sau verify) và điểm tối ưu hiệu năng, xuất báo cáo markdown — không sửa code.

**Architecture:** Phân vùng đa-agent: 6 Finder song song (theo surface tấn công) → flatten findings → N Verifier song song (mỗi finding 1 verifier, prompt bác bỏ) → lọc confidence <8 → tổng hợp báo cáo. Finder/Verifier dùng `general-purpose` agent; tổ chức qua Workflow.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia React 19, Redis queue; Python service (FastAPI/Telethon) tại `telegram-client`; SonarQube MCP (`ngotuananh101_cloudx`).

**Spec:** `docs/superpowers/specs/2026-08-09-security-perf-audit-design.md`

## Global Constraints

- PHP 8.4, Laravel 13, Pest 4, Inertia React 19 — bám style hiện có.
- **Không sửa code, không tạo file ngoài báo cáo cuối.** Đây là audit chỉ-đọc.
- Đọc code để xác định, không cần chạy lệnh reproduce.
- Báo cáo/spec/trả lời user: tiếng Việt; code/identifier/path giữ nguyên.
- Repo CloudX: `D:\Source\ponta\ponta-cloudx\cloudx`.
- Repo telegram-client: `D:\Source\ponta\ponta-cloudx\telegram-client` (5 file Python: `main.py`, `client.py`, `database.py`, `utils.py`, `ytdlp_service.py`).
- Ranh giới đã harden — KHÔNG report lại trừ khi tìm bypass cụ thể: `HostAddressGuard`, `RemoteUploadUrlGuard`, `PathEncoder`, credentials `encrypted:array`, CSP/private-cache preview, OAuth fail-closed, throttle share verify.
- False-positive filter (loại trừ): DOS, rate-limit, secret-on-disk, outdated deps, log spoofing, SSRF chỉ kiểm soát path, regex injection, open redirect thấp, XSS React (trừ `dangerouslySetInnerHTML`), client-side authz, notebook, shell script không untrusted input, audit log thiếu, doc files.
- Confidence giữ nếu ≥8/10 sau verify.

## Bản đồ vùng scan

| # | Vùng | Files trọng tâm (đường dẫn tuyệt đối) |
|---|------|----------------------------------------|
| F1 | Share-link công khai | `cloudx/app/Http/Controllers/ShareViewController.php`, `cloudx/app/Http/Controllers/Api/CloudShareController.php`, `cloudx/app/Models/CloudShare.php`, `cloudx/routes/web.php` (block `s/`), migration `..._create_cloud_shares_table.php`, `..._add_extra_info_to_cloud_shares_table.php` |
| F2 | Upload/Download/Preview | `cloudx/app/Http/Controllers/CloudUploadPresignController.php`, `CloudUploadDirectCompleteController.php`, `CloudUploadTaskChunkController.php`, `CloudUploadTaskController.php`, `CloudFileDownloadController.php`, `CloudFilePreviewController.php`, `cloudx/app/Services/CloudStorage/RemoteUploadUrlGuard.php`, `HostAddressGuard.php`, `CloudPath.php`, `PathEncoder.php`, `RemoteUploadHeaders.php`, `cloudx/app/Models/CloudTask.php`, `CloudTaskChunk.php`, `CloudConnection.php`, `cloudx/app/Jobs/UploadCloudTaskFileJob.php`, `RemoteUploadCloudTaskFileJob.php`, `CompleteS3MultipartUploadJob.php`, `cloudx/app/Services/CloudStorage/S3/S3Presigner.php`, `S3ClientFactory.php`, `S3ConnectionConfig.php` |
| F3 | Connectors & credentials | `cloudx/app/Services/CloudStorage/Connectors/S3Connector.php`, `FtpConnector.php`, `SftpConnector.php`, `GoogleDriveConnector.php`, `OneDriveConnector.php`, `TelegramConnector.php`, `DropboxConnector.php`, `cloudx/app/Http/Controllers/S3ConnectionController.php`, `FtpConnectionController.php`, `SftpConnectionController.php`, `TelegramConnectionController.php`, `cloudx/app/Http/Requests/StoreS3ConnectionRequest.php`, `StoreFtpConnectionRequest.php`, `StoreSftpConnectionRequest.php` (+ Update*), `cloudx/app/Models/CloudConnection.php`, migration `..._create_cloud_connections_table.php`, `..._add_provider_id_to_cloud_connections_table.php`, `..._add_secret_payload_to_cloud_task_table.php` |
| F4 | Video-downloader | `cloudx/app/Http/Controllers/VideoDownloaderController.php`, `cloudx/app/Services/Python/YtDlpClient.php`, `PythonServiceClient.php`, `cloudx/routes/web.php` (block video-downloader) |
| F5 | telegram-client (Python) | `telegram-client/main.py`, `client.py`, `database.py`, `utils.py`, `ytdlp_service.py`, `telegram-client/Dockerfile`, `docker-compose.yml` |
| F6 | Hiệu năng | Toàn `cloudx/app/` (controllers, services, models, jobs) + `cloudx/database/migrations/` + `cloudx/config/` |

---

## Task 1: Triển khai Finder song song (Giai đoạn 1)

**Files:**
- Không tạo/sửa file; 6 subagent đọc code.

**Interfaces:**
- Consumes: bản đồ vùng scan ở mục trên.
- Produces: mỗi Finder trả JSON object theo schema `FINDINGS` (xem Step 1) — mảng findings, mỗi finding có `id`, `region`, `file`, `line`, `category`, `severity`, `description`, `exploit_scenario`, `confidence` (1-10).

- [ ] **Step 1: Chạy Workflow Finder song song 6 vùng**

Gọi tool `Workflow` với script dưới đây. Script chạy 6 `agent()` song song (qua `parallel`), mỗi agent là một Finder cho một vùng, trả structured output theo schema. Lưu ý: prompt mỗi Finder phải **liệt kê đầy đủ files của vùng đó** và **nhúng toàn bộ bộ lọc false-positive + danh sách ranh giới đã harden** để Finder tự loại ngay từ đầu.

```javascript
export const meta = {
  name: 'cloudx-audit-finders',
  description: '6 Finders song song scan bảo mật + hiệu năng CloudX và telegram-client',
  phases: [{ title: 'Find', detail: '6 vùng scan song song' }],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['region', 'findings'],
  properties: {
    region: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'file', 'line', 'category', 'severity', 'description', 'exploit_scenario', 'confidence'],
        properties: {
          id: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          category: { type: 'string' },
          severity: { enum: ['HIGH', 'MEDIUM', 'LOW'] },
          description: { type: 'string' },
          exploit_scenario: { type: 'string' },
          confidence: { type: 'integer', minimum: 1, maximum: 10 },
        },
      },
    },
  },
}

const BASE = `Bạn là senior security engineer. Đọc ĐỦ các file được liệt kê cho vùng, trace luồng dữ liệu từ input không đáng tin (HTTP request param, path, body, query string, route param) tới các operation nhạy cảm (SQL, file system, system command, HTTP request ra ngoài, deserialization, render HTML).

LOẠI TRỪ (KHÔNG báo cáo): DOS/resource exhaustion, rate limiting, secret-on-disk nếu đã secured, outdated third-party libs, log spoofing, SSRF CHỈ kiểm soát path (chỉ SSRF khi kiểm soát được host/protocol), regex injection/regex DOS, open redirect thấp confidence, XSS trong React/trong file .tsx (TRỪ khi dùng dangerouslySetInnerHTML), thiếu authz ở client-side JS/TS, notebook .ipynb không có attack path cụ thể, shell script không nhận untrusted input, thiếu audit log, documentation/markdown files, hardening measures thiếu mà không phải vuln cụ thể, race condition lý thuyết, memory safety trong ngôn ngữ memory-safe.

RANH GIỚI ĐÃ HARDEN (KHÔNG report lại TRỪ khi tìm được BYPASS cụ thể): HostAddressGuard, RemoteUploadUrlGuard, PathEncoder, credentials "encrypted:array", CSP/private-cache preview header, OAuth fail-closed, throttle share verify.

Chỉ giữ finding khi bạn CONFIDENT ≥7/10 có đường tấn công cụ thể. Mỗi finding PHẢI có: file (đường dẫn tuyệt đối hoặc repo-relative), line số cụ thể, category (ví dụ sql_injection, path_traversal, ssrf, command_injection, idor, authz_bypass, rce, secret_exposure, n_plus_one, query_redundancy, memory_spike, cache_overhead, missing_index), severity, mô tả, kịch bản khai thác cụ thể (đường tấn công), confidence 1-10. Trả JSON theo schema.`

phase('Find')

const regions = [
  {
    label: 'F1-share-link',
    prompt: `${BASE}\n\nVÙNG F1 — Share-link công khai (route KHÔNG auth, surface lớn nhất). Đọc:\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/ShareViewController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/Api/CloudShareController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Models/CloudShare.php\n- D:/Source/ponta/ponta-cloudx/cloudx/routes/web.php (chỉ block prefix "s/")\n- D:/Source/ponta/ponta-cloudx/cloudx/database/migrations/*cloud_shares*\n\nTập trung: path traversal qua {path?} ở /s/{uuid}/preview/{path?} và /s/{uuid}/download/{path?}, bypass password verify, IDOR (truy cập share/file không thuộc share), giới hạn share (expiry), enumeration UUID, lộ dữ liệu qua preview, redirect/SSRF khi download.`,
  },
  {
    label: 'F2-upload-download',
    prompt: `${BASE}\n\nVÙNG F2 — Upload/Download/Preview (presign S3 direct, stream download, path & size). Đọc:\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/CloudUploadPresignController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/CloudUploadDirectCompleteController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/CloudUploadTaskChunkController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/CloudUploadTaskController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/CloudFileDownloadController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/CloudFilePreviewController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/RemoteUploadUrlGuard.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/HostAddressGuard.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/CloudPath.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/PathEncoder.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/RemoteUploadHeaders.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Models/CloudTask.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Models/CloudTaskChunk.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Models/CloudConnection.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Jobs/UploadCloudTaskFileJob.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Jobs/RemoteUploadCloudTaskFileJob.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Jobs/CompleteS3MultipartUploadJob.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/S3/S3Presigner.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/S3/S3ClientFactory.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/S3/S3ConnectionConfig.php\n\nTập trung: SSRF qua RemoteUploadUrlGuard (bypass host allowlist), IDOR qua {connection}/{task} không check ownership, path traversal qua {path?}, bypass size limit mid-stream, presign URL cho bucket/path sai, complete multipart với partNumber không thuộc task, abort task của user khác.`,
  },
  {
    label: 'F3-connectors-credentials',
    prompt: `${BASE}\n\nVÙNG F3 — Connectors & credentials (SSRF host, secret, command injection FTP/SFTP). Đọc:\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/Connectors/S3Connector.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/Connectors/FtpConnector.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/Connectors/SftpConnector.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/Connectors/GoogleDriveConnector.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/Connectors/OneDriveConnector.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/Connectors/TelegramConnector.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/CloudStorage/Connectors/DropboxConnector.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/S3ConnectionController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/FtpConnectionController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/SftpConnectionController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/TelegramConnectionController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Requests/StoreS3ConnectionRequest.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Requests/StoreFtpConnectionRequest.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Requests/StoreSftpConnectionRequest.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Requests/UpdateS3ConnectionRequest.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Requests/UpdateFtpConnectionRequest.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Requests/UpdateSftpConnectionRequest.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Models/CloudConnection.php\n- D:/Source/ponta/ponta-cloudx/cloudx/database/migrations/*cloud_connections*\n- D:/Source/ponta/ponta-cloudx/cloudx/database/migrations/*secret_payload*\n\nTập trung: SSRF qua host FTP/SFTP/S3/Telegram user-controlled (đọc HostAddressGuard xem có áp dụng cho connector không), command injection qua tham số FTP/SFTP (host có ký tự đặc biệt), lộ secret_payload qua JSON/Inertia/log, inject vào S3 endpoint URL, thiếu validate host dẫn tới metadata cloud (169.254.169.254), Telegram session/credentials handling.`,
  },
  {
    label: 'F4-video-downloader',
    prompt: `${BASE}\n\nVÙNG F4 — Video-downloader (yt-dlp, URL người dùng). Đọc:\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Http/Controllers/VideoDownloaderController.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/Python/YtDlpClient.php\n- D:/Source/ponta/ponta-cloudx/cloudx/app/Services/Python/PythonServiceClient.php\n- D:/Source/ponta/ponta-cloudx/cloudx/routes/web.php (chỉ block video-downloader)\n\nTập trung: command/argument injection qua URL truyền vào yt-dlp (URL có shell metacharacter hay option injection như "--"), SSRF qua URL download (yt-dlp fetch URL arbitary), path traversal qua output filename, thiếu validate scheme (file://, gopher://), metadata endpoint leak.`,
  },
  {
    label: 'F5-telegram-client',
    prompt: `${BASE}\n\nVÙNG F5 — telegram-client (Python service, chịu tải file/download từ Internet). Đọc:\n- D:/Source/ponta/ponta-cloudx/telegram-client/main.py\n- D:/Source/ponta/ponta-cloudx/telegram-client/client.py\n- D:/Source/ponta/ponta-cloudx/telegram-client/database.py\n- D:/Source/ponta/ponta-cloudx/telegram-client/utils.py\n- D:/Source/ponta/ponta-cloudx/telegram-client/ytdlp_service.py\n- D:/Source/ponta/ponta-cloudx/telegram-client/Dockerfile\n- D:/Source/ponta/ponta-cloudx/telegram-client/docker-compose.yml\n\nTập trung: path traversal qua tên file temp (download/read cleanup), RCE qua Telethon session hoặc input, SSRF khi download media, unsafe deserialization (pickle/eval/exec/yaml.load), command injection qua subprocess gọi yt-dlp/ffmpeg, file:// hoặc gopher:// scheme, lộ token API Telegram qua log/response, FastAPI thiếu auth, endpoint /read /write /list /metadata /yt-dlp download暴露.`,
  },
  {
    label: 'F6-performance',
    prompt: `Bạn là senior performance engineer. Đọc code CloudX để tìm VẤN ĐỀ HIỆU NĂNG cụ thể (KHÔNG phải bảo mật). Đọc các file tại D:/Source/ponta/ponta-cloudx/cloudx/app/ (controllers, services, models, jobs) + D:/Source/ponta/ponta-cloudx/cloudx/database/migrations/ + D:/Source/ponta/ponta-cloudx/cloudx/config/.\n\nTập trung: N+1 query (loop với query/load), query thừa (gọi DB nhiều lần trong loop), memory spike (body() full file/stream, collect full list), cache overhead (cache quá ngắn/đúng-key sai), round-trip HTTP thỡ (gọi API ngoài nhiều lần), missing DB index trên cột thường query/where, eager loading thiếu, transaction dài.\n\nMỗi finding PHẢI có: file (đường dẫn tuyệt đối), line cụ thể, category (n_plus_one, query_redundancy, memory_spike, cache_overhead, missing_index, redundant_http_roundtrip, missing_eager_load), severity, nguyên nhân, fix đề xuất cụ thể, confidence 1-10. Chỉ giữ khi confident ≥7. Trả JSON theo schema.` ,
  },
]

const results = await parallel(regions.map(r => () =>
  agent(r.prompt, { label: r.label, phase: 'Find', schema: FINDINGS_SCHEMA })
))

return results.filter(Boolean)
```

- [ ] **Step 2: Lưu kết quả Finder ra file tạm để Verifier đọc**

Sau khi Workflow hoàn tất, đọc output. Flatten toàn bộ findings của 6 vùng thành một mảng JSON, mỗi phần tử thêm trường `region`. Ghi ra file tạm `cloudx/storage/app/audit-findings-raw.json` (dùng Write tool) để Verifier reference. Nếu Workflow trả object có cấu trúc `{region, findings}` lặp lại, đảm bảo flatten đúng.

Expected: file JSON chứa 0–N findings, mỗi finding có đủ 8 trường bắt buộc + `region`.

- [ ] **Step 3: Commit checkpoint**

```bash
cd "D:/Source/ponta/ponta-cloudx/cloudx"
git add docs/superpowers/specs/2026-08-09-security-perf-audit-design.md
git commit -m "docs: spec audit bảo mật & hiệu năng CloudX" --allow-empty
```

(File findings-raw.json KHÔNG commit — nằm trong storage, đã .gitignore.)

---

## Task 2: Triển khai Verifier song song (Giai đoạn 2)

**Files:**
- Không tạo/sửa file; N subagent verify.

**Interfaces:**
- Consumes: mảng findings từ Task 1 (`audit-findings-raw.json`).
- Produces: mỗi finding kèm `verdict` (`confirmed`/`refuted`) + `verified_confidence` (1-10) + `refutation_note`.

- [ ] **Step 1: Chạy Workflow Verifier song song — mỗi finding 1 verifier**

Gọi tool `Workflow` với script. Script đọc findings từ `args` (truyền mảng findings vào tham số `args` của Workflow). Mỗi finding → 1 `agent()` verifier với prompt **bắt buộc cố gắng bác bỏ** + nhúng đầy bộ lọc false-positive. Trả schema `VERDICT`.

```javascript
export const meta = {
  name: 'cloudx-audit-verifiers',
  description: 'Verifier song song bác bỏ từng finding của CloudX audit',
  phases: [{ title: 'Verify', detail: 'mỗi finding 1 verifier' }],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'verdict', 'verified_confidence', 'refutation_note'],
  properties: {
    id: { type: 'string' },
    verdict: { enum: ['confirmed', 'refuted'] },
    verified_confidence: { type: 'integer', minimum: 1, maximum: 10 },
    refutation_note: { type: 'string' },
  },
}

const FILTER = `BỘ LỌC FALSE-POSITIVE — áp dụng trước khi chấm điểm:
LOẠI (refuted) nếu khớp: DOS/resource exhaustion; rate limiting; secret-on-disk nếu đã secured; outdated third-party libs; log spoofing; SSRF CHỈ kiểm soát path (chỉ confirmed khi kiểm soát được host/protocol); regex injection/regex DOS; open redirect thấp confidence; XSS trong React/.tsx (TRỪ dangerouslySetInnerHTML/bypassSecurityTrustHtml); thiếu authz ở client-side JS/TS (backend chịu trách nhiệm); notebook .ipynb không có attack path cụ thể; shell script không nhận untrusted input; thiếu audit log; documentation/markdown; thiếu hardening không phải vuln cụ thể; race condition lý thuyết; memory safety trong ngôn ngữ memory-safe; logging URL là an toàn; logging non-PII dù nhạy cảm không phải vuln; env var/CLI flag là trusted; UUID coi như unguessable không cần validate.
RANH GIỜI ĐÃ HARDEN — KHÔNG confirmed nếu chỉ là "thiếu guard" mà guard đó đã tồn tại: HostAddressGuard, RemoteUploadUrlGuard, PathEncoder, credentials "encrypted:array", CSP/private-cache preview, OAuth fail-closed, throttle share verify. CHỈ confirmed nếu tìm được BYPASS cụ thể của guard đó.

NHIỆM VỤ: CỐ GẮNG BÁC BỎ finding. Mở file/line được chỉ ra, đọc code thật, trace xem đường tấn công có thực sự đi thông không. Mặc định nghi ngờ. Chỉ `confirmed` khi bạn đọc code và thấy đường tấn công cụ thể đi được đến operation nhạy cảm. Gán verified_confidence 1-10. refutation_note: nếu refuted thì ghi lý do cụ thể; nếu confirmed thì ghi tại sao không bác được.`

phase('Verify')

const findings = args // mảng findings từ Task 1, mỗi phần tử có id, region, file, line, category, severity, description, exploit_scenario, confidence

const verdicts = await parallel(findings.map(f => () =>
  agent(
    `${FILTER}\n\nVERIFY FINDING:\nID: ${f.id}\nRegion: ${f.region}\nFile: ${f.file}\nLine: ${f.line}\nCategory: ${f.category}\nSeverity: ${f.severity}\nDescription: ${f.description}\nExploit scenario: ${f.exploit_scenario}\nFinder confidence: ${f.confidence}\n\nMở file/line đó đọc code thật và xác định: đường tấn công có đi thông không? Trả verdict.`,
    { label: `verify:${f.id}`, phase: 'Verify', schema: VERDICT_SCHEMA }
  )
))

return verdicts.filter(Boolean)
```

Truyền `args` là mảng findings (JSON value thật, không stringified) khi gọi Workflow.

- [ ] **Step 2: Gộp verdict vào findings**

Map `verdict`/`verified_confidence`/`refutation_note` từ kết quả Verifier ngược vào từng finding theo `id`. Lọc bỏ mọi finding có `verdict === 'refuted'` HOẶC `verified_confidence < 8`. Kết quả là mảng confirmed findings cuối.

Expected: chỉ còn findings confidence ≥8.

---

## Task 3: Tổng hợp & xuất báo cáo markdown (Giai đoạn 3)

**Files:**
- Create: `cloudx/docs/audit/2026-08-09-security-perf-audit-report.md` (báo cáo cuối).
- Không sửa code app.

**Interfaces:**
- Consumes: mảng confirmed findings từ Task 2.
- Produces: file báo cáo markdown theo định dạng spec mục 4.

- [ ] **Step 1: Gom SonarQube làm tín hiệu đối chiếu (tùy chọn, bổ sung)**

Gọi MCP SonarQube để đối chiếu:
- `search_security_hotspots` (projectKey `ngotuananh101_cloudx`, status `TO_REVIEW`).
- `search_sonar_issues_in_projects` (projectKey `ngotuananh101_cloudx`, severities `['HIGH','BLOCKER']`, impactSoftwareQualities `['SECURITY']`).

So sánh với confirmed findings: nếu Sonar có hotspot mà Finder chưa bắt → thêm vào báo cáo phần "Tín hiệu SonarQube cần xem" (KHÔNG tự động coi là vuln — cần verify riêng nếu muốn nâng cấp). Ghi rõ đây là tín hiệu, chưa verify.

Expected: danh sách Sonar hotspots/issues để đối chiếu.

- [ ] **Step 2: Viết báo cáo markdown cuối**

Dùng Write tool tạo `cloudx/docs/audit/2026-08-09-security-perf-audit-report.md` với cấu trúc:

```markdown
# CloudX — Báo cáo audit bảo mật & hiệu năng

**Ngày:** 2026-08-09
**Phạm vi:** app/ (CloudX) + telegram-client
**Phương pháp:** 6 Finder song song → Verifier bác bỏ từng finding → lọc confidence ≥8/10

## Tóm tắt
- Bảo mật: X HIGH, Y MEDIUM, Z LOW
- Hiệu năng: N findings
- Tổng số findings kiểm tra: ... (trước filter), ... còn lại (sau filter ≥8)

## A. Bảo mật

### [HIGH] <category> — `<file>:<line>`
- **Mô tả:** ...
- **Kịch bản khai thác:** ...
- **Fix đề xuất:** ...
- **Confidence:** 9/10
- **Region:** F1 | **Verifier note:** ...

(lặp cho mỗi finding bảo mật, sắp xếp HIGH → MEDIUM → LOW)

## B. Hiệu năng

### [MED] <category> — `<file>:<line>`
- **Nguyên nhân:** ...
- **Fix đề xuất:** ...

(lặp cho mỗi finding hiệu năng)

## C. Đã kiểm tra, không tìm thấy vấn đề (≥8/10)
- F1 Share-link: ...
- F2 Upload/Download: ...
- ...

## D. Tín hiệu SonarQube cần xem (chưa verify)
- <hotspot key> — <file>:<line> — <mô tả ngắn>
```

Điền số liệu tóm tắt chính xác từ mảng confirmed findings. Mỗi finding bảo mật phải có đủ 5 trường. Phần C ghi ngắn gọn vùng nào sạch. Phần D chỉ liệt kê hotspot Sonar CHƯA bị Finder bắt (nếu có).

- [ ] **Step 3: Trình bày báo cáo cho user**

In nội dung báo cáo (hoặc tóm tắt + đường dẫn file) cho user. Không sửa code. Kết thúc audit.

- [ ] **Step 4: Commit báo cáo**

```bash
cd "D:/Source/ponta/ponta-cloudx/cloudx"
git add docs/audit/2026-08-09-security-perf-audit-report.md
git commit -m "docs: báo cáo audit bảo mật & hiệu năng CloudX 2026-08-09

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
