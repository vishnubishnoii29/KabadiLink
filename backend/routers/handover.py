import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.services import handover as handover_service

logger = logging.getLogger("kabadilink.routers.handover")
router = APIRouter(tags=["Handover"])


class OtpVerifyRequest(BaseModel):
    code: str
    actual_weight_kg: Optional[float] = None


class StageOfflineRequest(BaseModel):
    actual_weight_kg: float = Field(..., gt=0)


class StatusUpdateRequest(BaseModel):
    status: Literal["EN_ROUTE", "COMPLETED"]


class PaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: Literal["CASH", "DIGITAL"]


@router.get("/handover/{lot_id}")
def get_handover(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return handover_service.get_handover(conn, lot_id)


@router.post("/handover/{lot_id}/otp/generate")
def generate_otp(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return handover_service.generate_otp(conn, lot_id, current_user["id"])


@router.post("/handover/{lot_id}/otp/verify")
def verify_otp(lot_id: str, payload: OtpVerifyRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return handover_service.verify_otp(conn, lot_id, payload.code, current_user["id"], payload.actual_weight_kg)


@router.post("/handover/{lot_id}/stage-offline")
def stage_offline(lot_id: str, payload: StageOfflineRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return handover_service.stage_offline(conn, lot_id, current_user["id"], payload.actual_weight_kg)


@router.post("/handover/{lot_id}/status")
def update_status(lot_id: str, payload: StatusUpdateRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return handover_service.update_status(conn, lot_id, payload.status, current_user["id"])


@router.post("/handover/{lot_id}/payment")
def record_payment(lot_id: str, payload: PaymentRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return handover_service.record_payment(conn, lot_id, current_user["id"], payload.amount, payload.method)


@router.get("/passport/{lot_id}")
def get_passport(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return handover_service.get_passport(conn, lot_id)
