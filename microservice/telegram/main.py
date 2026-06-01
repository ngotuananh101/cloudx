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
