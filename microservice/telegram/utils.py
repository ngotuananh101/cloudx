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
