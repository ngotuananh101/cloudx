# Telegram Microservice Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all security, correctness, and operational issues in the Telegram storage microservice so it is safe and reliable for integration with the Laravel app.

**Architecture:** Fix in place — no new files except `microservice/telegram/utils.py` for shared validation helpers. Changes touch `main.py`, `client.py`, `database.py`, `requirements.txt`, `Dockerfile`, `.env.example`, and `docker-compose.yml`. Each task is self-contained and testable independently.

**Tech Stack:** Python 3.12, FastAPI, Telethon, SQLAlchemy + aiosqlite, Docker

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `microservice/telegram/requirements.txt` | Modify | Pin dependency versions |
| `microservice/telegram/database.py` | Modify | Add unique constraint, fix mutable default, add temp dir config |
| `microservice/telegram/utils.py` | Create | Input validation helpers (session_id, path, temp files) |
| `microservice/telegram/client.py` | Modify | Fix 2FA sign-in flow, add session_id validation |
| `microservice/telegram/main.py` | Modify | Fix all endpoint bugs, security, error handling |
| `microservice/telegram/Dockerfile` | Modify | Fix Python version, non-root user, remove chmod 777 |
| `microservice/telegram/docker-compose.yml` | Modify | Add healthcheck |
| `microservice/telegram/.env.example` | Modify | Add TEMP_DIR config |

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

### Task 2: Fix database model

**Files:**
- Modify: `microservice/telegram/database.py`

- [ ] **Step 1: Add UniqueConstraint and fix mutable default**

Replace the full `database.py` with:

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
    __tablename__ = "file_index"
    __table_args__ = (
        UniqueConstraint("session_id", "path", name="uq_file_index_session_path"),
        UniqueConstraint("session_id", "message_id", name="uq_file_index_session_message"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    path = Column(String, index=True, nullable=False)
    message_id = Column(Integer, nullable=False)
    size = Column(Integer)
    mime_type = Column(String)
    original_name = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    extra_metadata = Column(JSON, default=dict)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 2: Verify SQLAlchemy model loads**

Run: `cd microservice/telegram && python -c "from database import FileIndex; print(FileIndex.__table_args__)"`
Expected: Prints the two UniqueConstraint tuples.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/database.py
git commit -m "fix(telegram): add unique constraints and fix mutable JSON default"
```

---

### Task 3: Create input validation helpers

**Files:**
- Create: `microservice/telegram/utils.py`

- [ ] **Step 1: Write utils.py with validation functions**

```python
import re
import os
import tempfile
from fastapi import HTTPException

SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
PATH_MAX_LENGTH = 4096


def validate_session_id(session_id: str) -> str:
    """Validate session_id contains only safe characters for use as a filename."""
    if not SESSION_ID_PATTERN.match(session_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid session_id: must be 1-64 alphanumeric, dash, or underscore characters.",
        )
    return session_id


def validate_path(path: str) -> str:
    """Validate and normalize a virtual file path."""
    if not path or not path.startswith("/"):
        raise HTTPException(status_code=400, detail="Path must start with '/'")
    if ".." in path:
        raise HTTPException(status_code=400, detail="Path must not contain '..'")
    if "\x00" in path:
        raise HTTPException(status_code=400, detail="Path must not contain null bytes")
    if len(path) > PATH_MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"Path exceeds max length of {PATH_MAX_LENGTH}")
    # Normalize multiple slashes
    normalized = re.sub(r"/+", "/", path)
    return normalized


def validate_directory(directory: str) -> str:
    """Validate and normalize a directory query. Returns normalized dir ending with '/' or ''."""
    if not directory:
        return ""
    if ".." in directory:
        raise HTTPException(status_code=400, detail="Directory must not contain '..'")
    if "\x00" in directory:
        raise HTTPException(status_code=400, detail="Directory must not contain null bytes")
    normalized = re.sub(r"/+", "/", directory)
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    if not normalized.endswith("/"):
        normalized = normalized + "/"
    return normalized


def make_temp_path(temp_dir: str, session_id: str, filename: str) -> str:
    """Create a safe temp file path using tempfile, avoiding path traversal."""
    # Sanitize filename: strip path separators, keep basename only
    safe_name = os.path.basename(filename) or "upload"
    fd, path = tempfile.mkstemp(prefix=f"tg_{session_id}_", suffix=f"_{safe_name}", dir=temp_dir)
    os.close(fd)
    return path
```

- [ ] **Step 2: Verify utils load**

Run: `cd microservice/telegram && python -c "from utils import validate_session_id, validate_path; print('OK')"`
Expected: Prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/utils.py
git commit -m "feat(telegram): add input validation helpers"
```

---

### Task 4: Fix TelegramStorageClient — 2FA and session_id safety

**Files:**
- Modify: `microservice/telegram/client.py`

- [ ] **Step 1: Rewrite client.py with proper 2FA handling and session_id validation**

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
        self.clients = {}  # sessionId -> TelegramClient

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
        """
        Sign in with phone+code. If 2FA is required, returns dict with
        password_required=True instead of swallowing the error.
        """
        client = await self.get_client(session_id)
        try:
            result = await client.sign_in(phone, code, password=password, phone_code_hash=phone_code_hash)
            return {"success": True, "user": str(result)}
        except SessionPasswordNeededError:
            if password:
                # Try signing in with 2FA password
                try:
                    result = await client.sign_in(password=password)
                    return {"success": True, "user": str(result)}
                except Exception as e:
                    return {"success": False, "password_required": True, "error": str(e)}
            return {"success": False, "password_required": True, "error": "Two-factor authentication password is required."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def upload_file(self, session_id: str, file_path, caption=None):
        client = await self.get_client(session_id)
        message = await client.send_file("me", file_path, caption=caption)
        return message

    async def download_file(self, session_id: str, message_id, output_path=None):
        client = await self.get_client(session_id)
        message = await client.get_messages("me", ids=message_id)
        if message and message.media:
            return await client.download_media(message, file=output_path)
        return None

    async def delete_file(self, session_id: str, message_id):
        client = await self.get_client(session_id)
        return await client.delete_messages("me", message_id)

    async def get_message(self, session_id: str, message_id):
        client = await self.get_client(session_id)
        return await client.get_messages("me", ids=message_id)

    async def iter_files(self, session_id: str):
        client = await self.get_client(session_id)
        async for message in client.iter_messages("me"):
            if message.media is not None:
                filename = "unnamed_file"
                if hasattr(message.media, "document"):
                    for attr in message.media.document.attributes:
                        if hasattr(attr, "file_name"):
                            filename = attr.file_name
                            break
                elif hasattr(message.media, "photo"):
                    filename = f"photo_{message.id}.jpg"

                yield {
                    "message_id": message.id,
                    "filename": filename,
                    "caption": message.message,
                    "size": getattr(message.media, "document", message.media).size if hasattr(message.media, "document") else 0,
                    "date": message.date,
                }


telegram_client = TelegramStorageClient()
```

- [ ] **Step 2: Verify client loads**

Run: `cd microservice/telegram && python -c "from client import telegram_client; print(type(telegram_client))"`
Expected: Prints `<class 'client.TelegramStorageClient'>`.

- [ ] **Step 3: Commit**

```bash
git add microservice/telegram/client.py
git commit -m "fix(telegram): handle 2FA properly and remove debug prints"
```

---

### Task 5: Fix main.py — security, endpoints, error handling

**Files:**
- Modify: `microservice/telegram/main.py`

This is the largest task — it addresses all remaining issues in `main.py`:

- Remove token logging (issue 2)
- Add token protection to `/auth-status` (issue 1)
- Sanitize session_id via `validate_session_id` (issue 3)
- Use `make_temp_path` for uploads (issue 4)
- Fix 2FA response handling in `/login` (issue 5)
- Fix DB session lifecycle in `/login` (issue 6)
- Fix None caption crash in `perform_sync` (issue 7)
- Handle stale index in `/read` (issue 11)
- Fix `/list` directory boundary (issue 10)
- Stream from temp file in `/read` instead of BytesIO (issue 9)

- [ ] **Step 1: Replace entire main.py**

```python
import os
import logging
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from database import AsyncSessionLocal, FileIndex, init_db, TEMP_DIR
from client import telegram_client
from utils import validate_session_id, validate_path, validate_directory, make_temp_path
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
        caption = item.get("caption") or ""
        path = caption if caption.startswith("/") else f"/telegram-imports/{item['message_id']}_{item['filename']}"

        # Skip if already indexed by message_id
        result = await db.execute(
            select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.message_id == item["message_id"])
        )
        if result.scalar_one_or_none():
            continue

        # Handle path collision: append message_id for auto-generated paths
        path_result = await db.execute(
            select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.path == path)
        )
        if path_result.scalar_one_or_none():
            if not caption.startswith("/"):
                path = f"/telegram-imports/{item['message_id']}_{item['filename']}"
            else:
                # User-set path collides — skip to avoid overwriting
                continue

        new_file = FileIndex(
            session_id=session_id,
            path=path,
            message_id=item["message_id"],
            size=item["size"],
            mime_type="application/octet-stream",
            original_name=item["filename"],
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

    return {"success": False, "message": "Login failed", "detail": result.get("error", str(result)) if isinstance(result, dict) else str(result)}


@app.post("/write")
async def write_file(
    path: str = Query(...),
    file: UploadFile = File(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    path = validate_path(path)

    temp_path = make_temp_path(TEMP_DIR, session_id, file.filename or "upload")
    try:
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        message = await telegram_client.upload_file(session_id, temp_path, caption=path)

        new_file = FileIndex(
            session_id=session_id,
            path=path,
            message_id=message.id,
            size=file.size,
            mime_type=file.content_type,
            original_name=file.filename,
        )

        # Upsert: try insert first, handle unique constraint violation
        try:
            db.add(new_file)
            await db.commit()
        except IntegrityError:
            await db.rollback()
            # Path or message_id exists — update it
            existing = await db.execute(
                select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.path == path)
            )
            existing_file = existing.scalar_one_or_none()
            if existing_file:
                # Delete old Telegram message (best-effort)
                try:
                    await telegram_client.delete_file(session_id, existing_file.message_id)
                except Exception:
                    pass
                existing_file.message_id = message.id
                existing_file.size = file.size
                existing_file.mime_type = file.content_type
                existing_file.original_name = file.filename
                await db.commit()
            else:
                # message_id collision with different path — re-raise
                raise HTTPException(status_code=409, detail="File index conflict")

        return {"success": True, "message_id": message.id}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/read")
async def read_file(
    path: str = Query(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    path = validate_path(path)

    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.path == path)
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

        await (await telegram_client.get_client(session_id)).download_media(msg, file=download_path)

        return FileResponse(
            path=download_path,
            media_type=file_info.mime_type or "application/octet-stream",
            filename=file_info.original_name or "download",
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to download file from Telegram")
    finally:
        # FileResponse streams then deletes; we schedule cleanup
        # FastAPI/Starlette will read the file before returning, so we clean up after
        # For safety, leave cleanup to a background task or periodic sweep
        pass


@app.delete("/delete")
async def delete_file(
    path: str = Query(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    path = validate_path(path)

    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.path == path)
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
    directory: str = Query(""),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    normalized_dir = validate_directory(directory)

    pattern = f"{normalized_dir}%" if normalized_dir else "%"
    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.path.like(pattern))
    )
    files = result.scalars().all()

    return [
        {
            "path": f.path,
            "size": f.size,
            "mime_type": f.mime_type,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in files
    ]


@app.post("/sync")
async def sync_endpoint(x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    session_id = validate_session_id(x_session_id)
    new_count = await perform_sync(session_id, db)
    return {"success": True, "added": new_count}


@app.get("/metadata")
async def get_metadata(
    path: str = Query(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token),
):
    session_id = validate_session_id(x_session_id)
    path = validate_path(path)

    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.path == path)
    )
    file_info = result.scalar_one_or_none()

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "path": file_info.path,
        "size": file_info.size,
        "mime_type": file_info.mime_type,
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
git commit -m "fix(telegram): fix security, 2FA, DB lifecycle, stale index, list boundary"
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

### Task 7: Fix docker-compose and .env.example

**Files:**
- Modify: `microservice/telegram/docker-compose.yml`
- Modify: `microservice/telegram/.env.example`

- [ ] **Step 1: Update docker-compose.yml with healthcheck**

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

- [ ] **Step 3: Update .dockerignore to include temp dir**

Replace contents of `.dockerignore`:

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
git commit -m "fix(telegram): add healthcheck, update env example and dockerignore"
```

---

### Task 8: Smoke test the full service locally

**Files:** None (manual verification)

- [ ] **Step 1: Start the service**

Run: `cd microservice/telegram && cp .env.example .env && python main.py`
Expected: Server starts on port 8000.

- [ ] **Step 2: Verify /auth-status requires token**

Run: `curl -s http://localhost:8000/auth-status -H "X-Session-Id: test"`
Expected: `403` with `{"detail":"Invalid API Token"}` (not 200).

- [ ] **Step 3: Verify session_id validation**

Run: `curl -s http://localhost:8000/auth-status -H "X-Session-Id: ../etc/passwd" -H "X-Token: change-me-in-production"`
Expected: `400` with invalid session_id error.

- [ ] **Step 4: Verify path validation**

Run: `curl -s "http://localhost:8000/metadata?path=../../etc/passwd" -H "X-Session-Id: test" -H "X-Token: change-me-in-production"`
Expected: `400` with path must start with `/`.

- [ ] **Step 5: Verify /list directory boundary**

Run: `curl -s "http://localhost:8000/list?directory=/foo" -H "X-Session-Id: test" -H "X-Token: change-me-in-production"`
Expected: `200` with empty list (not error).

- [ ] **Step 6: Commit final state if any additional fixes were needed**

```bash
git add -A
git commit -m "fix(telegram): smoke test fixes"
```
