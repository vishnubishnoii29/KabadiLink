import logging

from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.services import epr as epr_service

logger = logging.getLogger("kabadilink.routers.epr")
router = APIRouter(tags=["EPR"])


@router.get("/lots/{lot_id}/epr-record")
def get_epr_record(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return epr_service.get_or_generate_epr_record(conn, lot_id, current_user["id"])


@router.get("/lots/{lot_id}/epr-certificate")
def get_epr_certificate(lot_id: str, current_user: dict = Depends(get_current_user)):
    """Backwards-compatible alias for /lots/{lot_id}/epr-record."""
    with get_db_connection() as conn:
        return epr_service.get_or_generate_epr_record(conn, lot_id, current_user["id"])
