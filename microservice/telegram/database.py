from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./storage/telegram_storage.db")

# Tự động tạo thư mục nếu chưa có (để SQLite có thể tạo file .db)
if DATABASE_URL.startswith("sqlite"):
    # Lấy đường dẫn file từ URL (loại bỏ sqlite+aiosqlite:/// hoặc sqlite:///)
    db_path = DATABASE_URL.split("///")[-1] if "///" in DATABASE_URL else DATABASE_URL.split("//")[-1]
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

class FileIndex(Base):
    __tablename__ = "file_index"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    path = Column(String, index=True, nullable=False)
    message_id = Column(Integer, nullable=False)
    size = Column(Integer)
    mime_type = Column(String)
    original_name = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    extra_metadata = Column(JSON, default={})

    # Note: UniqueConstraint will be added manually if needed or via alembic
    # For a simple aiosqlite script, we just ensure path isolation by query

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
