# CloudX Performance & Reliability Optimization Design

**Date:** 2026-07-26  
**Status:** Draft for review  
**Scope:** High + Medium impact only (Low polish deferred)  
**Product defaults:** Safe (keep local spool for remote upload; Telegram full list for now; cooperative cancel mid-loop)

---

## 1. Goal

Improve reliability under long-running uploads, cut memory spikes on download/preview, reduce unnecessary API/queue/browser work, and make multi-file uploads behave predictably — without weakening the recent security hardening (SSRF, size limits, path normalize, fail-closed OAuth).

**Out of scope (deferred Low polish):** zero-byte UX polish beyond client guard if free, share create disk-stat, hide dead OAuth login buttons, share folder preview close, `cloud_task_parts` table, composite DB indexes unless needed by a phase, remote stream-through without disk, Telegram infinite-scroll UX.

---

## 2. Constraints

- PHP 8.4, Laravel 13, Pest 4, Inertia React 19 — match existing style.
- Do not change app dependencies without approval.
- Every backend behavior change needs a Pest test (or update).
- Run `vendor/bin/pint --dirty --format agent` after PHP edits.
- Credentials remain `encrypted:array`; never expose `secret_payload` in JSON.
- Security guarantees stay: remote URL validation, mid-stream size abort, host policy, path normalize.
- Prefer config/worker fixes over code when equivalent.

---

## 3. Architecture overview

Work is ordered so **correctness/reliability** lands before **throughput**, and **server memory** before **UI polish**.

```
Phase 0  Queue/worker config alignment
Phase 1  True streaming + download/preview metadata collapse
Phase 2  Upload manager: concurrency pool, poll, abort, re-render split
Phase 3  Job disk efficiency + cooperative cancel
Phase 4  Listing pagination + cache single-flight + unique/debounced quota
Phase 5  Inertia connection payload slim + chunk lock reduction
```

Shared principles:

1. **Stream, don't buffer** — provider adapters must not call `$response->body()` for large content.
2. **Single-flight expensive work** — listing cache miss, quota refresh, token refresh.
3. **Bound concurrency** — browser upload workers and optional queue isolation.
4. **Keep fail-closed size/SSRF** — optimize around guards, not by removing them.

---

## 4. Phase 0 — Queue & worker correctness

### Problem

- Upload jobs: timeout 1200–1500s (`UploadCloudTaskFileJob`, `CompleteS3MultipartUploadJob`, `RemoteUploadCloudTaskFileJob`).
- Default `retry_after` for database/redis queues is **90s** (`config/queue.php`).
- Workers can re-release still-running jobs → duplicate claim races, double upload, wasted bandwidth.

### Design

1. Raise default `REDIS_QUEUE_RETRY_AFTER` / `DB_QUEUE_RETRY_AFTER` to **at least 2100** (max job timeout 1500 + buffer), documented in `.env.example`.
2. Document worker flag: `--timeout=1500` (or ≥ longest job) in deploy notes / README ops section only if project already has ops docs; otherwise `.env.example` comments only.
3. Optional (same phase if low risk): dedicated queue names `uploads` / `remote-uploads` via `$this->onQueue(...)` on the three long jobs — **only if** workers are already multi-queue capable; otherwise document as follow-up ops task.

### Tests

- Config assertion test or feature that documents expected retry_after ≥ job timeout (lightweight unit reading config after env bind).
- No behavior change to job claim logic in this phase.

### Risk

Low. Deploy must restart workers with new timeout/retry_after together.

---

## 5. Phase 1 — Memory-safe download & preview

### Problem

- `OneDriveClient::downloadStream` loads full body into string then `php://temp`.
- `TelegramClient::downloadStream` same pattern via `download()` → body.
- Download/preview controllers often call `exists` + `mimeType` + `fileSize` + `readStream` (3–5 remote ops).
- Direct links already exist for S3/OneDrive/Dropbox/Google Drive via `ProvidesDirectDownloadLink` — keep preferring redirect for **download**.

### Design

#### 1.1 True streaming

**OneDriveClient**

- Add streaming GET with Guzzle/Laravel HTTP `withOptions(['stream' => true])`.
- Return a PHP resource (PSR stream detach or wrapper) without materializing full body.
- Keep `download(): string` only for tiny/internal uses or deprecate internal callers toward stream.
- Content timeout remains elevated (already 120s for content); document that very large files should use `directDownloadLink` redirect when available.

**TelegramClient**

- Stream from Python service with `stream => true`.
- Increase download timeout for stream path beyond default 30s (config-driven if possible, else dedicated method timeout).
- If Python service cannot stream today, implement client-side stream option and verify service; if blocked, document dependency and fall back with hard max size for proxy path.

#### 1.2 Metadata collapse

Introduce a small helper used by download/preview/share stream paths, e.g. `CloudFileResponseFactory` or private methods on a shared trait:

- One metadata resolution: name, mime, size (best-effort).
- Skip separate `exists` when metadata fetch is authoritative (404 → not found).
- Then single `readStream`.
- Prefer `directDownloadLink` for download (existing); preview may still proxy when inline headers/CSP required.

#### 1.3 Tests

- Unit/feature: mock HTTP stream for OneDrive/Telegram — assert no full-body path (or assert stream resource / chunked read).
- Feature: preview/download still set disposition, nosniff, CSP for HTML/SVG.
- Existing download redirect tests remain green.

### Risk

Medium. Adapter error handling and token refresh must still run. Do not weaken CSP/cache headers from security work.

---

## 6. Phase 2 — Upload manager (frontend)

### Problem

- `enqueue` starts **all** files immediately (no pool).
- Poll every 3s depends on full `items` → interval restarts every progress tick; runs even when Echo is live.
- No `AbortController`; cancel waits for in-flight chunk.
- Context `value` includes `items` → File Browser re-renders on every chunk.
- Double `router.reload` on complete (local + broadcast).
- Completed `File` blobs retained until manual remove.

### Design

#### 2.1 Concurrency pool

- Constant `MAX_CONCURRENT_UPLOADS = 3`.
- Queue items start as `pending`; a scheduler starts uploads until 3 active (`uploading` client-side, not server `processing`).
- On complete/fail/cancel/pause of an active item, start next pending.
- Remote enqueue: count toward pool for task-create only (cheap); server jobs unlimited except queue workers.

#### 2.2 Polling

- Poll only tasks in `queued` | `processing` **server** status (after client finished sending chunks).
- Store active task IDs in a ref; interval effect depends on **sorted ID string**, not full items.
- Prefer Echo; keep poll as fallback always-on but low frequency (3s) — safe default (no Echo status coupling required in v1). Optionally later gate on Echo connection state.
- Cap: one request per active task per tick; skip if previous poll in-flight for that task.

#### 2.3 Abort

- `Map<itemKey, AbortController>`; new controller per upload run.
- Pass `signal` through `requestJson` and direct `fetch` PUTs.
- Cancel/pause aborts controller; ignore abort errors in UI status.
- Extend `request-json.ts` to accept optional `signal` in init.

#### 2.4 Re-render isolation

- Split context or use dual context:
  - `UploadManagerActionsContext` — stable callbacks.
  - `UploadManagerStateContext` — `items`, `isPanelVisible`.
- File browser uses actions only; panel uses state.

#### 2.5 Refresh & memory

- Debounce `router.reload({ only: ['files', 'connection'] })` 400ms; single owner (broadcast/poll merge path preferred; remove duplicate call at end of `uploadFile` or guard with flag).
- After terminal status, drop `file` / `remote` heavy fields from item (keep name, size, status).
- Auto-remove completed items after 10 minutes (optional timer) — include if small.

#### 2.6 Tests / verification

- Manual checklist in phase verification.
- Optional frontend unit tests only if project already has component test infra; otherwise manual.

### Risk

Medium (race in pool scheduler). No security regression if CSRF headers preserved on aborted retries.

---

## 7. Phase 3 — Job disk efficiency & cooperative cancel

### Problem

- Backend upload merges all chunks to `merged.bin`, then re-reads for `writeStream` (~2× disk for up to 5GB).
- Remote upload always HEAD + GET spool + re-upload.
- Cancel after claim does not stop merge/download loops.

### Design

#### 3.1 Merge path

- **Default safe path:** keep on-disk merge when provider needs seekable/size (`OneDriveClient::streamSize` uses `fstat`).
- **Optimization:** when adapter/disk can accept a sequential stream of known total size **without** seek, stream chunks directly into `writeStream` via a custom concatenated stream resource (chunk files opened in order) — **no** full `merged.bin`.
- Implement a small `ChunkConcatStream` (or sequential fopen callback stream) used by `UploadCloudTaskFileJob`.
- If provider fails without Content-Length, fall back to merge-to-temp for that provider only (feature flag or provider check: Telegram/OneDrive may need merge; S3 Flysystem often streams).

Provider matrix (safe default):

| Provider | Strategy |
|----------|----------|
| S3 | Concat stream → writeStream (or prefer direct client multipart already) |
| Google Drive | Concat stream if adapter allows; else merge |
| Dropbox | Concat stream if adapter allows; else merge |
| OneDrive | Keep merge (needs size) then existing upload session |
| FTP/SFTP | Concat stream preferred |
| Telegram | Merge or sized stream as Python API requires |

#### 3.2 Remote upload

- Keep GET + progress size limit + local spool (safe default).
- HEAD: keep as **optional early reject** when Content-Length present and > max; on 405/501/missing length, skip hard failure (already soft).
- Do **not** remove local spool in this program (stream-through deferred).
- Avoid redundant double validate cost is negligible; keep job-time validate for TOCTOU.

#### 3.3 Cooperative cancel

- In long loops (chunk merge, remote progress callback, OneDrive chunk upload), periodically re-read task status (every N chunks or every progress tick).
- If `Cancelled`, abort HTTP if possible, delete temp, exit without rethrow storm (mark already cancelled).
- `claimQueuedTask` unchanged for Queued→Processing.

#### 3.4 Tests

- Feature: cancel while processing eventually stops (simulate with fake disk + status flip).
- Feature: upload completes without merged.bin when using concat path (assert temp files pattern) — if hard to assert, unit-test concat stream.
- Remote: still rejects oversize via progress; HEAD optional paths covered.

### Risk

Medium–High for concat stream across providers. Ship behind provider allowlist starting with S3/FTP/SFTP if needed.

---

## 8. Phase 4 — Listing, cache, quota

### Problem

- OneDrive `listChildren` returns first page only (`@odata.nextLink` ignored).
- Telegram lists entire history into 6h cache.
- `Cache::remember` stampede on cold folder.
- `flushQuota` forgets lock and always dispatches; no `ShouldBeUnique`.
- `list` vs `listDirectories` duplicate provider work on cold cache.

### Design

#### 4.1 OneDrive pagination

- Loop `@odata.nextLink` until exhausted or safety cap (e.g. 50 pages / 10k items) with logging when capped.
- Safe default: full list within cap (no UI load-more yet).

#### 4.2 Telegram

- Safe default: **keep full list behavior** for UX stability.
- Add **hard safety cap** (config `telegram.max_list_items`, default e.g. 2000) with log when truncated — prevents unbounded memory without changing primary UX for normal accounts.
- Defer infinite-scroll product work.

#### 4.3 Cache single-flight

- On remember miss, use `Cache::lock("cloud:list:lock:...")` with short TTL; second waiter retries remember after lock.
- Derive directory listing from full folder listing when full list cache hit exists (populate both keys from one provider call on miss).

#### 4.4 Quota jobs

- `UpdateConnectionQuotaJob` implements `ShouldBeUnique` with `uniqueId = connectionId`, `uniqueFor = 300` (or 600).
- `flushQuota`: do **not** always `Cache::forget` lock then dispatch; use unique job + optional delayed dispatch (`delay(now()->addSeconds(15))`) to coalesce bursts.
- `refreshInBackground`: skip if `last_synced_at` within N minutes (config, default 10) unless forced.

#### 4.5 Tests

- OneDrive client unit/feature with faked multi-page Graph responses.
- Quota: dispatch twice → one unique job (Bus::fake).
- Directory listing uses shared cache path (mock connector call count = 1).

### Risk

Medium for pagination (longer list latency / quota). Cap prevents runaway.

---

## 9. Phase 5 — Platform efficiency

### Problem

- `HandleInertiaRequests` loads all connections and decrypts credentials for FTP/S3 config on **every** Inertia page.
- Each chunk: `lockForUpdate` + chunk count + progress broadcast with second lock.

### Design

#### 5.1 Inertia connection summary

- Share only non-secret fields needed globally (id, name, provider, status, spaces, capabilities flags).
- Move FTP/S3 edit config to connection settings endpoints/props only (pages that edit connections already fetch or can receive dedicated props).
- Avoid decrypting full credentials in global share.

#### 5.2 Chunk progress path

- Trust `uploaded_chunks_count` increment without full `chunks()->count()` every time when possible; verify completeness only when count reaches `total_chunks` before queueing job.
- Throttle progress broadcast (already ~5%): ensure no second `lockForUpdate` solely for broadcast marker — store last broadcast percent in Redis key `upload:progress:{taskId}` if needed.
- Do not redesign multipart parts JSON storage in this scope (parts table is Low/deferred).

#### 5.3 Tests

- Inertia share / feature test: shared connections payload lacks secrets.
- Chunk complete still queues upload job exactly once.

### Risk

Medium for Inertia prop shape changes — audit frontend types (`User` connections, connection forms).

---

## 10. Explicit non-goals (this program)

- Remote upload stream-through without disk.
- Telegram infinite scroll / load-more UI.
- Always CDN/public preview URLs.
- `cloud_task_parts` table.
- Hiding OAuth login buttons / share preview close / share disk-stat (track separately as polish).
- Changing max file size product limits.

---

## 11. Security interaction checklist

| Guard | Optimization rule |
|-------|-------------------|
| Remote URL SSRF validate | Keep at create + job; streaming must still validate redirects |
| Progress size limit | Keep on GET; HEAD only early-reject |
| Path normalize | Unchanged |
| Private host policy | Unchanged |
| Preview CSP / private cache | Unchanged when streaming |
| OAuth fail-closed | Keep; add single-flight refresh only if touched |
| secret_payload | Never in Inertia/JSON |

---

## 12. Success metrics

| Metric | Target |
|--------|--------|
| Queue duplicate processing of long uploads | Eliminated when retry_after ≥ timeout |
| Peak PHP memory on large OneDrive/Telegram proxy download | Bounded (stream; no full body string) |
| Multi-file upload browser | ≤ 3 concurrent active uploads |
| Poll storm | Interval stable; no restart every progress tick |
| OneDrive folders > first page | Complete listing within safety cap |
| Quota jobs per upload burst | Coalesced (unique + delay) |
| Global Inertia payload | No decrypted FTP/S3 secrets |

---

## 13. Implementation order & commit cadence

1. Phase 0 — config/env  
2. Phase 1 — streaming + metadata  
3. Phase 2 — upload manager  
4. Phase 3 — jobs cancel/disk  
5. Phase 4 — list/cache/quota  
6. Phase 5 — Inertia + chunk locks  

One logical commit per phase (or split backend/frontend within phase if large).

---

## 14. Verification plan

Per phase:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=...   # phase-specific
```

Broader after Phase 1 and Phase 4:

```bash
php artisan test --compact tests/Feature/RemoteUploadTaskTest.php tests/Feature/S3DirectUploadTest.php tests/Feature/CloudFileDownloadTest.php tests/Feature/CloudFilePreviewTest.php tests/Feature/ShareViewTest.php
```

Manual smoke:

1. Upload 5+ files → only 3 active.  
2. Large OneDrive file download/preview without worker OOM.  
3. Remote upload oversize still fails mid-stream.  
4. Cancel during processing stops further work.  
5. OneDrive folder with >200 items lists fully (within cap).  
6. Burst uploads → single quota job.  
7. Browse app pages → network/Inertia props without credential secrets.

---

## 15. Open follow-ups (not blocking approval)

- Echo-connected poll gating.  
- Telegram load-more UX.  
- Remote stream-through for trusted hosts.  
- Low polish batch from security plan leftovers.  
- Provider-native multipart for backend Google/Dropbox beyond concat stream.
