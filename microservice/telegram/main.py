import os
import shutil
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import AsyncSessionLocal, FileIndex, init_db
from client import telegram_client
from pydantic import BaseModel
import uvicorn
import io
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    await init_db()
    yield
    # Shutdown logic (nếu cần)

app = FastAPI(title="Telegram Storage Microservice", lifespan=lifespan)

API_SECRET_TOKEN = os.getenv("TELEGRAM_STORAGE_TOKEN")

async def perform_sync(session_id: str, db: AsyncSession):
    print(f"Starting sync for session: {session_id}")
    count = 0
    async for item in telegram_client.iter_files(session_id):
        # Determine path: use caption if it looks like a path, else use filename
        path = item['caption'] if item['caption'] and item['caption'].startswith('/') else f"/{item['filename']}"
        
        # Check if record already exists by message_id
        result = await db.execute(
            select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.message_id == item['message_id'])
        )
        if result.scalar_one_or_none():
            continue
            
        # Also check if same path exists but with different message_id (if so, we skip to avoid path collision)
        path_result = await db.execute(
            select(FileIndex).where(FileIndex.session_id == session_id, FileIndex.path == path)
        )
        if path_result.scalar_one_or_none():
            # If path exists but message_id is different, it might be a newer version or manual upload naming clash.
            # For sync, we prefer not to overwrite existing virtual structure unless specified.
            # Here we'll append message_id to make it unique if it's a clash.
            if not item['caption'].startswith('/'): # Only if it's an auto-generated path from filename
                path = f"/{item['message_id']}_{item['filename']}"

        new_file = FileIndex(
            session_id=session_id,
            path=path,
            message_id=item['message_id'],
            size=item['size'],
            mime_type="application/octet-stream", # Standardize or detect later
            original_name=item['filename'],
            created_at=item['date']
        )
        db.add(new_file)
        count += 1
    
    await db.commit()
    print(f"Sync completed. Added {count} new files.")
    return count

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

def verify_token(x_token: str = Header(...)):
    print(f"Verifying token: Received={x_token}, Expected={API_SECRET_TOKEN}")
    if x_token != API_SECRET_TOKEN:
        print("Token mismatch!")
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
async def auth_status(x_session_id: str = Header(...)):
    is_auth = await telegram_client.is_user_authorized(x_session_id)
    return {"authorized": is_auth}

@app.post("/request-code")
async def request_code(data: RequestCodeModel, x_session_id: str = Header(...), token: str = Depends(verify_token)):
    print(f"Requesting code for phone: {data.phone}, Session: {x_session_id}")
    phone_code_hash = await telegram_client.send_code_request(x_session_id, data.phone)
    return {"message": "Code sent to Telegram", "phone_code_hash": phone_code_hash}

@app.post("/login")
async def login(data: LoginModel, x_session_id: str = Header(...), token: str = Depends(verify_token)):
    result = await telegram_client.sign_in(x_session_id, data.phone, data.code, data.phone_code_hash, data.password)
    is_auth = await telegram_client.is_user_authorized(x_session_id)
    if is_auth:
        await perform_sync(x_session_id, next(get_db()) if hasattr(get_db(), '__next__') else await anext(get_db()))
    
    return {
        "success": is_auth,
        "message": "Login successful" if is_auth else "Login failed",
        "detail": str(result)
    }

@app.post("/write")
async def write_file(
    path: str = Query(...),
    file: UploadFile = File(...),
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(verify_token)
):
    # Temp save to disk for Telethon upload
    temp_path = f"temp_{x_session_id}_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Upload to Telegram
        message = await telegram_client.upload_file(x_session_id, temp_path, caption=path)
        
        # Save to local index
        new_file = FileIndex(
            session_id=x_session_id,
            path=path,
            message_id=message.id,
            size=file.size,
            mime_type=file.content_type,
            original_name=file.filename
        )
        
        # Check if exists to update (within same session)
        result = await db.execute(
            select(FileIndex).where(FileIndex.session_id == x_session_id, FileIndex.path == path)
        )
        existing_file = result.scalar_one_or_none()
        
        if existing_file:
            # Delete old message
            await telegram_client.delete_file(x_session_id, existing_file.message_id)
            await db.delete(existing_file)
            
        db.add(new_file)
        await db.commit()
        
        return {"success": True, "message_id": message.id}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/read")
async def read_file(path: str = Query(...), x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == x_session_id, FileIndex.path == path)
    )
    file_info = result.scalar_one_or_none()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
        
    buffer = io.BytesIO()
    msg = await telegram_client.get_message(x_session_id, file_info.message_id)
    client = await telegram_client.get_client(x_session_id)
    await client.download_media(msg, file=buffer)
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type=file_info.mime_type)

@app.delete("/delete")
async def delete_file(path: str = Query(...), x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == x_session_id, FileIndex.path == path)
    )
    file_info = result.scalar_one_or_none()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
        
    await telegram_client.delete_file(x_session_id, file_info.message_id)
    await db.delete(file_info)
    await db.commit()
    
    return {"success": True}

@app.get("/list")
async def list_files(directory: str = Query(""), x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    pattern = f"{directory}%" if directory else "%"
    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == x_session_id, FileIndex.path.like(pattern))
    )
    files = result.scalars().all()
    
    return [
        {
            "path": f.path,
            "size": f.size,
            "mime_type": f.mime_type,
            "created_at": f.created_at.isoformat()
        } for f in files
    ]

@app.post("/sync")
async def sync_endpoint(x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    new_count = await perform_sync(x_session_id, db)
    return {"success": True, "added": new_count}

@app.get("/metadata")
async def get_metadata(path: str = Query(...), x_session_id: str = Header(...), db: AsyncSession = Depends(get_db), token: str = Depends(verify_token)):
    result = await db.execute(
        select(FileIndex).where(FileIndex.session_id == x_session_id, FileIndex.path == path)
    )
    file_info = result.scalar_one_or_none()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
        
    return {
        "path": file_info.path,
        "size": file_info.size,
        "mime_type": file_info.mime_type,
        "created_at": file_info.created_at.isoformat(),
        "updated_at": file_info.updated_at.isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
