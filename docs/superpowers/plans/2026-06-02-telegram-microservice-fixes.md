# Telegram Microservice Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all security, correctness, and operational issues in the Telegram storage microservice. Remove virtual path concept — files are identified by `(session_id, message_id)` only.

**Architecture:** Fix in place. New file `microservice/telegram/utils.py` for validation helpers. Each file in the microservice is rewritten with correct logic. Files are identified exclusively by Telegram `message_id` — no virtual path, no directory structure, no caption-based routing.

**API contract (after fix):**

| Endpoint | Method | Params | Description |
|---|---|---|---|
| `/auth-status` | GET | `X-Session-Id`, `X-Token` | Check if Telegram session is authorized |
| `/request-code` | POST | `phone`, `X-Session-Id`, `X-Token` | Request Telegram login code |
| `/login` | POST | `phone`, `code`, `password?`, `X-Session-Id`, `X-Token` | Sign in to Telegram |
| `/write` | POST | `file` (multipart), `X-Session-Id`, `X-Token` | Upload file, returns `message_id` |
| `/read` | GET | `message_id`, `X-Session-Id`, `X-Token` | Download file by message_id |
| `/delete` | DELETE | `message_id`, `X-Session-Id`, `X-Token` | Delete file by message_id |
| `/list` | GET | `limit?`, `offset?`, `X-Session-Id`, `X-Token` | List indexed files |
| `/metadata` | GET | `message_id`, `X-Session-Id`, `X-Token` | Get file metadata by message_id |
| `/sync` | POST | `X-Session-Id`, `X-Token` | Sync Saved Messages into index |

**Tech Stack:** Python 3.12, FastAPI, Telethon, SQLAlchemy + aiosqlite, Docker

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `microservice/telegram/requirements.txt` | Modify | Pin dependency versions |
| `microservice/telegram/database.py` | Rewrite | Remove `path` column, unique on `(session_id, message_id)`, fix mutable default, add temp dir |
| `microservice/telegram/utils.py` | Create | Validation helpers: `validate_session_id`, `make_temp_path` |
| `microservice/telegram/client.py` | Rewrite | Fix 2FA sign-in, remove caption-as-path logic from `iter_files` |
| `microservice/telegram/main.py` | Rewrite | All endpoints use `message_id`, fix security/DB/error handling |
| `microservice/telegram/Dockerfile` | Modify | Python 3.12, non-root user, remove chmod 777 |
| `microservice/telegram/docker-compose.yml` | Modify | Add healthcheck |
| `microservice/telegram/.env.example` | Modify | Add TEMP_DIR |
| `microservice/telegram/.dockerignore` | Modify | Exclude storage/ |

---

### Task 1: Pin dependency versions

**Files:**
- Modify: `microservice/telegram/requirements.txt`

- [ ] **Step 1: Replace unpinned requirements with pinned versions**

Replace the contents of `requirements.txt` with:

```txt
fastapi==0.115.12
uvicorn[standard]==0.34.3
telethon==1.40.0
python-multipart==0.0.20
pydantic-settings==2.9.1
sqlalchemy==2.0.41
aiosqlite==0.21.0
python-dotenv==1.1.0
```

- [ ] **Step 2: Verify versions resolve**

Run: `cd microservice/telegram && pip install -r requirements.txt`
Expected: All packages install without conflict.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/requirements.txt
git commit -m "fix(telegram): pin dependency versions"
```

---

### Task 2: Rewrite database model — remove path, unique on message_id

**Files:**
- Modify: `microservice/telegram/database.py`

- [ ] **Step 1: Replace entire database.py**

```python
from sqlalchemy import Column, Integer, String, DateTime, JSON, UniqueConstraint
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./storage/telegram_storage.db")
TEMP_DIR = os.getenv("TEMP_DIR", "storage/temp")

# Auto-create directories for SQLite
if DATABASE_URL.startswith("sqlite"):
    db_path = DATABASE_URL.split("///")[-1] if "///" in DATABASE_URL else DATABASE_URL.split("//")[-1]
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

# Ensure temp dir exists
os.makedirs(TEMP_DIR, exist_ok=True)

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()


class FileIndex(Base):
    """Index of Telegram Saved Messages with media.

    Each file is uniquely identified by (session_id, message_id).
    No virtual path — message_id is the only key.
    """
    __tablename__ = "file_index"
    __table_args__ = (
        UniqueConstraint("session_id", "message_id", name="uq_file_index_session_message"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    message_id = Column(Integer, nullable=False, index=True)
    original_name = Column(String)
    size = Column(Integer)
    mime_type = Column(String)
    caption = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    extra_metadata = Column(JSON, default=dict)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

Key changes vs original:
- Removed `path` column entirely
- Unique constraint on `(session_id, message_id)` only
- Added `caption` column to store Telegram caption text
- `original_name` renamed from implicit naming
- `extra_metadata` uses `default=dict` instead of mutable `default={}`
- Added `TEMP_DIR` from env
- Removed old comment about manual UniqueConstraint

- [ ] **Step 2: Verify SQLAlchemy model loads**

Run: `cd microservice/telegram && python -c "from database import FileIndex; print(FileIndex.__table_args__)"`
Expected: Prints the UniqueConstraint tuple.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/database.py
git commit -m "fix(telegram): remove virtual path, unique on session_id+message_id"
```

---

### Task 3: Create input validation helpers

**Files:**
- Create: `microservice/telegram/utils.py`

- [ ] **Step 1: Write utils.py**

```python
import re
import os
import tempfile
from fastapi import HTTPException

SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


def validate_session_id(session_id: str) -> str:
    """Validate session_id contains only safe characters for use as a filename."""
    if not SESSION_ID_PATTERN.match(session_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid session_id: must be 1-64 alphanumeric, dash, or underscore characters.",
        )
    return session_id


def validate_message_id(message_id: int) -> int:
    """Validate message_id is a positive integer."""
    if message_id <= 0:
        raise HTTPException(status_code=400, detail="message_id must be a positive integer.")
    return message_id


def make_temp_path(temp_dir: str, session_id: str, filename: str) -> str:
    """Create a safe temp file path using tempfile, avoiding path traversal."""
    safe_name = os.path.basename(filename) or "upload"
    fd, path = tempfile.mkstemp(prefix=f"tg_{session_id}_", suffix=f"_{safe_name}", dir=temp_dir)
    os.close(fd)
    return path
```

Note: `validate_path` and `validate_directory` are no longer needed since we removed virtual paths.

- [ ] **Step 2: Verify utils load**

Run: `cd microservice/telegram && python -c "from utils import validate_session_id, validate_message_id, make_temp_path; print('OK')"`
Expected: Prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/utils.py
git commit -m "feat(telegram): add input validation helpers"
```

---

### Task 4: Fix TelegramStorageClient — 2FA and cleanup

**Files:**
- Modify: `microservice/telegram/client.py`

- [ ] **Step 1: Replace entire client.py**

```python
import os
from typing import Optional
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from dotenv import load_dotenv

load_dotenv()

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
STORAGE_DIR = "storage"
SESSIONS_DIR = os.path.join(STORAGE_DIR, "sessions")


class TelegramStorageClient:
    def __init__(self):
        self.clients = {}  # session_id -> TelegramClient

    async def get_client(self, session_id: str):
        if session_id not in self.clients:
            session_path = os.path.join(SESSIONS_DIR, session_id)
            os.makedirs(SESSIONS_DIR, exist_ok=True)
            self.clients[session_id] = TelegramClient(session_path, API_ID, API_HASH)

        client = self.clients[session_id]
        if not client.is_connected():
            await client.connect()
        return client

    async def is_user_authorized(self, session_id: str):
        client = await self.get_client(session_id)
        return await client.is_user_authorized()

    async def send_code_request(self, session_id: str, phone: str):
        client = await self.get_client(session_id)
        result = await client.send_code_request(phone)
        return result.phone_code_hash if hasattr(result, "phone_code_hash") else result

    async def sign_in(self, session_id: str, phone: str, code: str, phone_code_hash: Optional[str] = None, password: Optional[str] = None):
        """Sign in with phone+code. Handles 2FA properly."""
        client = await self.get_client(session_id)
        try:
            result = await client.sign_in(phone, code, password=password, phone_code_hash=phone_code_hash)
            return {"success": True, "user": str(result)}
        except SessionPasswordNeededError:
            if password:
                try:
                    result = await client.sign_in(password=password)
                    return {"success": True, "user": str(result)}
                except Exception as e:
                    return {"success": False, "password_required": True, "error": str(e)}
            return {"success": False, "password_required": True, "error": "Two-factor authentication password is required."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def upload_file(self, session_id: str, file_path: str, caption: Optional[str] = None):
        client = await self.get_client(session_id)
        message = await client.send_file("me", file_path, caption=caption)
        return message

    async def download_file(self, session_id: str, message_id: int, output_path=None):
        client = await self.get_client(session_id)
        message = await client.get_messages("me", ids=message_id)
        if message and message.media:
            return await client.download_media(message, file=output_path)
        return None

    async def delete_file(self, session_id: str, message_id: int):
        client = await self.get_client(session_id)
        return await client.delete_messages("me", message_id)

    async def get_message(self, session_id: str, message_id: int):
        client = await self.get_client(session_id)
        return await client.get_messages("me", ids=message_id)

    async def iter_files(self, session_id: str):
        """Iterate all media messages in Saved Messages.

        Yields dicts with message_id, filename, caption, size, date.
        No path logic — message_id is the key.
        """
        client = await self.get_client(session_id)
        async for message in client.iter_messages("me"):
            if message.media is None:
                continue

            filename = "unnamed_file"
            file_size = 0
            if hasattr(message.media, "document") and message.media.document:
                for attr in message.media.document.attributes:
                    if hasattr(attr, "file_name"):
                        filename = attr.file_name
                        break
                file_size = message.media.document.size or 0
            elif hasattr(message.media, "photo"):
                filename = f"photo_{message.id}.jpg"

            yield {
                "message_id": message.id,
                "filename": filename,
                "caption": message.message or "",
                "size": file_size,
                "date": message.date,
            }


telegram_client = TelegramStorageClient()
```

Key changes vs original:
- Properly handles `SessionPasswordNeededError` with two-step sign-in
- Returns structured dicts instead of swallowing errors
- `iter_files` yields clean data without path logic
- Removes unused `asyncio` import
- Removes debug `print` calls
- Stores caption as-is, no path interpretation

- [ ] **Step 2: Verify client loads**

Run: `cd microservice/telegram && python -c "from client import telegram_client; print(type(telegram_client))"`
Expected: Prints `<class 'client.TelegramStorageClient'>`.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/client.py
git commit -m "fix(telegram): handle 2FA properly, remove path logic from iter_files"
```

---

### Task 5: Rewrite main.py — message_id as key, fix all bugs

**Files:**
- Modify: `microservice/telegram/main.py`

This task rewrites all endpoints to use `message_id` instead of `path`, and fixes all security/correctness issues:

- Remove token logging (review issue 2)
- Add token protection to `/auth-status` (review issue 1)
- Sanitize session_id via `validate_session_id` (review issue 3)
- Use `make_temp_path` for uploads (review issue 4)
- Fix 2FA response handling in `/login` (review issue 5)
- Fix DB session lifecycle in `/login` (review issue 6)
- Fix None caption crash in `perform_sync` (review issue 7)
- Handle stale index in `/read` (review issue 11)
- Stream via temp file in `/read` instead of BytesIO (review issue 9)
- `/list` returns flat list, no directory boundary issue (review issue 10)

- [ ] **Step 1: Replace entire main.py**

```python
import os
import logging
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import AsyncSessionLocal, FileIndex, init_db, TEMP_DIR
from client import telegram_client
from utils import validate_session_id, validate_message_id, make_temp_path
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("telegram-storage")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Telegram Storage Microservice", lifespan=lifespan)

API_SECRET_TOKEN = os.getenv("TELEGRAM_STORAGE_TOKEN")


async def perform_sync(session_id: str, db: AsyncSession):
    """Sync Telegram Saved Messages into the local file index."""
    count = 0
    async for item in telegram_client.iter_files(session_id):
        # Skip if already indexed by message_id
        result = await db.execute(
            select(FileIndex).where(
                FileIndex.session_id == session_id,
                FileIndex.message_id == item["message_id"],
            )
        )
        if result.scalar_one_or_none():
            continue

        new_file = FileIndex(
            session_id=session_id,
            message_id=item["message_id"],
            original_name=item["filename"],
            size=item["size"],
            mime_type="application/octet-stream",
            caption=item["caption"],
            created_at=item["date"],
        )
        db.add(new_file)
        count += 1

    await db.commit()
    logger.info("Sync completed for session %s: added %d files", session_id, count)
    return count


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def verify_token(x_token: str = Header(...)):
    if x_token != API_SECRET_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid API Token")
    return x_token


class RequestCodeModel(BaseModel):
    phone: str


class LoginModel(BaseModel):
    phone: str
    code: str
    phone_code_hash: Optional[str] = None
    password: Optional[str] = None


@app.get("/auth-status")
async def auth_status(x_session_id: str = Header(...), token: str = Depends(verify_token)):
    session_id = validate_session_id(x_session_id)
    is_auth = await telegram_client.is_user_authorized(session_id)
    return {"authorized": is_auth}


@app.post("/request-code")
async def request_code(data: RequestCodeModel, x_session_id: str = Header(...), token: str = Depends(verify_token)):
    session_id = validate_session_id(x_session_id)
    phone_code_hash = await telegram_client.send_code_request(session_id, data.phone)
    return {"success": True, "message": "Code sent to Telegram", "phone_code_hash": phone_code_hash}


@app.post("/login")
async def login(data: LoginModel, x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    session_id = validate_session_id(x_session_id)
    result = await telegram_client.sign_in(session_id, data.phone, data.code, data.phone_code_hash, data.password)

    if isinstance(result, dict) and result.get("success"):
        is_auth = await telegram_client.is_user_authorized(session_id)
        if is_auth:
            await perform_sync(session_id, db)
        return {"success": True, "message": "Login successful"}

    if isinstance(result, dict) and result.get("password_required"):
        return {"success": False, "password_required": True, "message": result.get("error", "2FA password required.")}

    error_msg = result.get("error", str(result)) if isinstance(result, dict) else str(result)
    return {"success": False, "message": "Login failed", "detail": error_msg}


@app.post("/write")
async def write_file(
    file: UploadFile = File(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    temp_path = make_temp_path(TEMP_DIR, session_id, file.filename or "upload")

    try:
        content = await file.read()
        with open(temp_path, "wb") as buffer:
            buffer.write(content)

        message = await telegram_client.upload_file(session_id, temp_path, caption=file.filename or "")

        # Index the new file
        new_file = FileIndex(
            session_id=session_id,
            message_id=message.id,
            original_name=file.filename,
            size=file.size,
            mime_type=file.content_type,
            caption=file.filename or "",
        )

        db.add(new_file)
        await db.commit()

        return {"success": True, "message_id": message.id}

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/read")
async def read_file(
    message_id: int = Query(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    message_id = validate_message_id(message_id)

    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.message_id == message_id)
    )
    file_info = result.scalar_one_or_none()

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    # Download to temp file to avoid OOM on large files
    download_path = make_temp_path(TEMP_DIR, session_id, file_info.original_name or "download")
    try:
        msg = await telegram_client.get_message(session_id, file_info.message_id)
        if msg is None or msg.media is None:
            # Stale index — message deleted from Telegram
            await db.delete(file_info)
            await db.commit()
            raise HTTPException(status_code=404, detail="File no longer exists in Telegram (stale index removed)")

        client = await telegram_client.get_client(session_id)
        await client.download_media(msg, file=download_path)

        return FileResponse(
            path=download_path,
            media_type=file_info.mime_type or "application/octet-stream",
            filename=file_info.original_name or "download",
        )
    except HTTPException:
        # Clean up temp file on known errors
        if os.path.exists(download_path):
            os.remove(download_path)
        raise
    except Exception:
        if os.path.exists(download_path):
            os.remove(download_path)
        raise HTTPException(status_code=500, detail="Failed to download file from Telegram")


@app.delete("/delete")
async def delete_file(
    message_id: int = Query(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    message_id = validate_message_id(message_id)

    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.message_id == message_id)
    )
    file_info = result.scalar_one_or_none()

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    await telegram_client.delete_file(session_id, file_info.message_id)
    await db.delete(file_info)
    await db.commit()

    return {"success": True}


@app.get("/list")
async def list_files(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)

    # Get total count
    count_result = await db.execute(
        select(func.count()).select_from(FileIndex).where(FileIndex.session_id == session_id)
    )
    total = count_result.scalar() or 0

    # Get page
    result = await db.execute(
        select(FileIndex)
        .where(FileIndex.session_id == session_id)
        .order_by(FileIndex.message_id.desc())
        .limit(limit)
        .offset(offset)
    )
    files = result.scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "files": [
            {
                "message_id": f.message_id,
                "original_name": f.original_name,
                "size": f.size,
                "mime_type": f.mime_type,
                "caption": f.caption,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in files
        ],
    }


@app.post("/sync")
async def sync_endpoint(x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    session_id = validate_session_id(x_session_id)
    new_count = await perform_sync(session_id, db)
    return {"success": True, "added": new_count}


@app.get("/metadata")
async def get_metadata(
    message_id: int = Query(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    message_id = validate_message_id(message_id)

    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.message_id == message_id)
    )
    file_info = result.scalar_one_or_none()

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "message_id": file_info.message_id,
        "original_name": file_info.original_name,
        "size": file_info.size,
        "mime_type": file_info.mime_type,
        "caption": file_info.caption,
        "created_at": file_info.created_at.isoformat() if file_info.created_at else None,
        "updated_at": file_info.updated_at.isoformat() if file_info.updated_at else None,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 2: Verify the app starts without import errors**

Run: `cd microservice/telegram && python -c "from main import app; print('OK')"`
Expected: Prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/main.py
git commit -m "fix(telegram): use message_id as key, fix all security and correctness bugs"
```

---

### Task 6: Fix Dockerfile

**Files:**
- Modify: `microservice/telegram/Dockerfile`

- [ ] **Step 1: Replace Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install minimal system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user and set up storage directories
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/storage/sessions /app/storage/temp \
    && chown -R appuser:appuser /app/storage

USER appuser

EXPOSE 8000

CMD ["python", "main.py"]
```

- [ ] **Step 2: Verify Dockerfile builds**

Run: `cd microservice/telegram && docker build -t telegram-storage-test .`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/Dockerfile
git commit -m "fix(telegram): use Python 3.12, non-root user, remove chmod 777"
```

---

### Task 7: Fix docker-compose, .env.example, .dockerignore

**Files:**
- Modify: `microservice/telegram/docker-compose.yml`
- Modify: `microservice/telegram/.env.example`
- Modify: `microservice/telegram/.dockerignore`

- [ ] **Step 1: Update docker-compose.yml**

```yaml
services:
  telegram-storage:
    build: .
    container_name: telegram-storage-service
    ports:
      - "8000:8000"
    volumes:
      - ./storage:/app/storage
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

- [ ] **Step 2: Update .env.example**

```env
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_PHONE=
DATABASE_URL=sqlite+aiosqlite:///./storage/telegram_storage.db
TEMP_DIR=storage/temp
TELEGRAM_STORAGE_TOKEN=change-me-in-production
```

- [ ] **Step 3: Update .dockerignore**

```
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.env
storage/
.git
.gitignore
```

- [ ] **Step 4: Commit**

```bash
git add microservice/telegram/docker-compose.yml microservice/telegram/.env.example microservice/telegram/.dockerignore
git commit -m "fix(telegram): add healthcheck, update env and dockerignore"
```

---

### Task 8: Smoke test the full service locally

**Files:** None (manual verification)

- [ ] **Step 1: Start the service**

Run: `cd microservice/telegram && cp .env.example .env && python main.py`
Expected: Server starts on port 8000.

- [ ] **Step 2: Verify /auth-status requires token**

Run: `curl -s http://localhost:8000/auth-status -H "X-Session-Id: test"`
Expected: `403` with `{"detail":"Invalid API Token"}`.

- [ ] **Step 3: Verify session_id validation rejects path traversal**

Run: `curl -s http://localhost:8000/auth-status -H "X-Session-Id: ../etc/passwd" -H "X-Token: change-me-in-production"`
Expected: `400` with invalid session_id error.

- [ ] **Step 4: Verify /list returns flat paginated list**

Run: `curl -s "http://localhost:8000/list?limit=10&offset=0" -H "X-Session-Id: test" -H "X-Token: change-me-in-production"`
Expected: `200` with `{"total": 0, "limit": 10, "offset": 0, "files": []}`.

- [ ] **Step 5: Verify /read rejects invalid message_id**

Run: `curl -s "http://localhost:8000/read?message_id=0" -H "X-Session-Id: test" -H "X-Token: change-me-in-production"`
Expected: `400` with message_id must be positive.

- [ ] **Step 6: Commit final state if any additional fixes were needed**

```bash
git add -A
git commit -m "fix(telegram): smoke test fixes"
```
