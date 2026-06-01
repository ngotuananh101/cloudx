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
