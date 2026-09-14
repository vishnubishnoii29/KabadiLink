import logging

from fastapi import APIRouter, Depends, UploadFile, File

from backend.auth import get_current_user
from backend.services.uploads import save_file

logger = logging.getLogger("kabadilink.routers.uploads")
router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Generic object storage upload — verification docs, dispute evidence, ISL media."""
    file_bytes = await file.read()
    file_url = save_file(file_bytes, file.filename or "upload", file.content_type or "application/octet-stream")
    return {"file_url": file_url}
