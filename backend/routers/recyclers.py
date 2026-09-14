import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.helpers import api_error
from backend.services import matching as matching_service
from backend.services.uploads import save_file

logger = logging.getLogger("kabadilink.routers.recyclers")
router = APIRouter(prefix="/recyclers", tags=["Recyclers"])


def _require_recycler_owner(conn, recycler_id: str, current_user: dict) -> None:
    if current_user.get("role") == "ADMIN":
        return
    owner_user_id = matching_service.get_recycler_owner_user_id(conn, recycler_id)
    if owner_user_id is None:
        api_error(404, "RECYCLER_NOT_FOUND", "Recycler not found")
    if owner_user_id != str(current_user["id"]):
        api_error(403, "FORBIDDEN", "You do not own this recycler profile")


class UpdateRecyclerRequest(BaseModel):
    materials_accepted: Optional[List[str]] = None
    pickup_available: Optional[bool] = None
    service_area_km: Optional[float] = None
    cpcb_reg_number: Optional[str] = None


@router.get("/{recycler_id}")
def get_recycler(recycler_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return matching_service.get_recycler(conn, recycler_id)


@router.put("/{recycler_id}")
def update_recycler(recycler_id: str, payload: UpdateRecyclerRequest, current_user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    with get_db_connection() as conn:
        _require_recycler_owner(conn, recycler_id, current_user)
        return matching_service.update_recycler(conn, recycler_id, fields, current_user["id"])


@router.post("/{recycler_id}/verification-docs")
async def upload_verification_doc(
    recycler_id: str,
    doc_type: str = Form(...),
    doc: Optional[UploadFile] = File(None),
    doc_url: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    url = doc_url
    if doc is not None:
        file_bytes = await doc.read()
        url = save_file(file_bytes, doc.filename or "verification-doc", doc.content_type or "application/octet-stream")

    if not url:
        api_error(400, "MISSING_DOCUMENT", "Provide either a file upload or a doc_url")

    with get_db_connection() as conn:
        _require_recycler_owner(conn, recycler_id, current_user)
        return matching_service.add_verification_document(conn, recycler_id, current_user["id"], url, doc_type)


@router.get("/{recycler_id}/lots")
def get_recycler_lots(recycler_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return matching_service.get_recycler_lots(conn, recycler_id)


@router.get("/{recycler_id}/pickups")
def get_recycler_pickups(recycler_id: str, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return matching_service.get_recycler_pickups(conn, recycler_id, status)
