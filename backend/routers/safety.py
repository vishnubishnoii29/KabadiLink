import logging
from typing import Optional

from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.services import safety as safety_service

logger = logging.getLogger("kabadilink.routers.safety")
router = APIRouter(tags=["Safety"])


@router.get("/safety-content")
def get_safety_content(
    material_code: str,
    content_type: Optional[str] = None,
    language: str = "en",
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    with get_db_connection() as conn:
        return safety_service.list_safety_content(
            conn, material_code, content_type, language, limit, offset
        )
