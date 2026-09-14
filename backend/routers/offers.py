import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.helpers import api_error
from backend.services import offers as offers_service

logger = logging.getLogger("kabadilink.routers.offers")
router = APIRouter(tags=["Offers"])


class OfferRequest(BaseModel):
    price: float = Field(..., gt=0)


class CounterOfferRequest(BaseModel):
    price: float = Field(..., gt=0)


def _recycler_id_for_user(conn, user_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM recyclers WHERE user_id = %s;", (user_id,))
        row = cur.fetchone()
    if not row:
        api_error(403, "NOT_A_RECYCLER", "Only recyclers can perform this action")
    return str(row["id"])


@router.get("/lots/{lot_id}/price-estimate")
def price_estimate(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return offers_service.get_price_estimate(conn, lot_id, current_user["id"])


@router.get("/lots/{lot_id}/recyclers")
def recyclers_for_lot(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return offers_service.get_recyclers_for_lot(conn, lot_id)


@router.post("/lots/{lot_id}/offers")
def create_offer(lot_id: str, payload: OfferRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        recycler_id = _recycler_id_for_user(conn, current_user["id"])
        return offers_service.create_offer(conn, lot_id, recycler_id, current_user["id"], payload.price)


@router.get("/lots/{lot_id}/offers")
def list_offers(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return offers_service.list_offers_for_lot(conn, lot_id)


@router.post("/offers/{offer_id}/counter")
def counter_offer(offer_id: int, payload: CounterOfferRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return offers_service.create_counter_offer(conn, offer_id, payload.price, current_user["id"])


@router.post("/offers/{offer_id}/accept")
def accept_offer(offer_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return offers_service.accept_offer(conn, offer_id, current_user["id"])


@router.post("/offers/{offer_id}/reject")
def reject_offer(offer_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return offers_service.reject_offer(conn, offer_id, current_user["id"])
