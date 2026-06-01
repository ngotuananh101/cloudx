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
