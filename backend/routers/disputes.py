import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.auth import get_current_user, require_role
from backend.db import get_db_connection
from backend.services import disputes as disputes_service

logger = logging.getLogger("kabadilink.routers.disputes")
router = APIRouter(tags=["Disputes"])


class DisputeRequest(BaseModel):
    type: Literal["WEIGHT_MISMATCH", "PAYMENT_MISMATCH", "DAMAGED", "PICKUP_ISSUE"]
    description: str
    evidence_photo_url: Optional[str] = None


class ResolveDisputeRequest(BaseModel):
    resolution_note: str
    status: Literal["RESOLVED", "DISMISSED"]


@router.post("/lots/{lot_id}/disputes")
def create_dispute(lot_id: str, payload: DisputeRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return disputes_service.create_dispute(
            conn, lot_id, current_user["id"], payload.type, payload.description, payload.evidence_photo_url,
        )


@router.get("/disputes")
def list_disputes(status: Optional[str] = None, current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return disputes_service.list_disputes(conn, status)


@router.post("/disputes/{dispute_id}/resolve")
def resolve_dispute(dispute_id: int, payload: ResolveDisputeRequest, current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return disputes_service.resolve_dispute(conn, dispute_id, payload.resolution_note, payload.status, current_user["id"])
