import logging
import os
import uuid
from typing import Optional

import requests

from backend.config import settings

logger = logging.getLogger("kabadilink.services.uploads")


def _local_save(file_bytes: bytes, filename: str) -> str:
    os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(filename)[1] or ""
    unique_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.LOCAL_UPLOAD_DIR, unique_name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return f"/uploads/{unique_name}"


def _supabase_save(file_bytes: bytes, filename: str, content_type: str) -> Optional[str]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None

    ext = os.path.splitext(filename)[1] or ""
    object_path = f"{uuid.uuid4().hex}{ext}"
    upload_url = (
        f"{settings.SUPABASE_URL}/storage/v1/object/"
        f"{settings.SUPABASE_STORAGE_BUCKET}/{object_path}"
    )
    try:
        resp = requests.put(
            upload_url,
            data=file_bytes,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Content-Type": content_type or "application/octet-stream",
                "x-upsert": "true",
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            return (
                f"{settings.SUPABASE_URL}/storage/v1/object/public/"
                f"{settings.SUPABASE_STORAGE_BUCKET}/{object_path}"
            )
        logger.warning(
            f"Supabase upload failed ({resp.status_code}): {resp.text}. Falling back to local disk."
        )
    except Exception as e:
        logger.warning(f"Supabase upload error: {e}. Falling back to local disk.")
    return None


def save_file(file_bytes: bytes, filename: str, content_type: str = "application/octet-stream") -> str:
    """Zero-cost object storage: Supabase Storage when configured, local disk otherwise."""
    url = _supabase_save(file_bytes, filename, content_type)
    if url:
        return url
    return _local_save(file_bytes, filename)
