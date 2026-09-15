import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.helpers import api_error
from backend.services import lots as lots_service
from backend.services.uploads import save_file

logger = logging.getLogger("kabadilink.routers.lots")
router = APIRouter(tags=["Lots"])

LOT_STATUS_VALUES = ("DRAFT", "OPEN", "OFFERED", "ACCEPTED", "HANDOVER_PENDING", "COMPLETED", "DISPUTED", "CANCELLED")


def _collector_id_for_user(conn, user_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM collectors WHERE user_id = %s;", (user_id,))
        row = cur.fetchone()
    if not row:
        api_error(403, "NOT_A_COLLECTOR", "Only collectors can perform this action")
    return str(row["id"])


def _require_lot_owner(conn, lot_id: str, current_user: dict) -> None:
    if current_user.get("role") == "ADMIN":
        return
    owner_user_id = lots_service.get_lot_owner_user_id(conn, lot_id)
    if owner_user_id is None:
        api_error(404, "LOT_NOT_FOUND", "Lot not found")
    if owner_user_id != str(current_user["id"]):
        api_error(403, "FORBIDDEN", "You do not own this lot")


class SplitCombineItem(BaseModel):
    bbox_index: int
    weight_kg: float = Field(..., gt=0)
    condition: str


class FromPhotoRequest(BaseModel):
    lot_photo_id: str
    mode: Literal["SPLIT", "COMBINE"]
    items: List[SplitCombineItem]


class ManualLotRequest(BaseModel):
    material_code: str
    weight_kg: float = Field(..., gt=0)
    condition: str
    photo_url: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    # Idempotency key from the mobile offline outbox — resubmitting the same
    # client_uid returns the already-created lot instead of a duplicate.
    client_uid: Optional[str] = None


class UpdateLotRequest(BaseModel):
    weight_kg: Optional[float] = None
    condition: Optional[str] = None
    status: Optional[Literal[LOT_STATUS_VALUES]] = None
    hazard_flags: Optional[List[str]] = None


class PickupGroupRequest(BaseModel):
    lot_ids: List[str]


@router.post("/lots/photo")
async def upload_lot_photo(
    photo: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Multi-item Detection entry point. Does not create lots yet — see /lots/from-photo."""
    image_bytes = await photo.read()

    with get_db_connection() as conn:
        collector_id = _collector_id_for_user(conn, current_user["id"])
        raw_photo_url = save_file(image_bytes, photo.filename or "lot.jpg", photo.content_type or "image/jpeg")
        result = lots_service.create_lot_photo(conn, collector_id, raw_photo_url, image_bytes, lat, lon)

    return result


@router.post("/lots/from-photo")
def create_lots_from_photo(payload: FromPhotoRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        collector_id = _collector_id_for_user(conn, current_user["id"])
        lots = lots_service.create_lots_from_photo(
            conn, collector_id, current_user["id"], payload.lot_photo_id, payload.mode,
            [item.model_dump() for item in payload.items],
        )
    # 02-backend-api.md documents this response as [{lot_id, lot_code, ...}] — alias the
    # internal "id" primary key without renaming it everywhere else lots are returned.
    return [{**lot, "lot_id": lot["id"]} for lot in lots]


@router.post("/lots")
def create_lot_manual(payload: ManualLotRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        collector_id = _collector_id_for_user(conn, current_user["id"])
        lot = lots_service.create_lot_manual(
            conn, collector_id, current_user["id"], payload.material_code, payload.weight_kg,
            payload.condition, payload.photo_url, payload.lat, payload.lon,
            client_uid=payload.client_uid,
        )
    return lot


@router.get("/lots")
def list_lots(
    status: Optional[str] = None,
    material: Optional[str] = None,
    collector_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    with get_db_connection() as conn:
        return lots_service.list_lots(conn, status, material, collector_id, limit, offset)


@router.get("/lots/{lot_id}")
def get_lot(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return lots_service.get_lot(conn, lot_id)


@router.put("/lots/{lot_id}")
def update_lot(lot_id: str, payload: UpdateLotRequest, current_user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    with get_db_connection() as conn:
        _require_lot_owner(conn, lot_id, current_user)
        return lots_service.update_lot(conn, lot_id, fields, current_user["id"])


@router.delete("/lots/{lot_id}")
def delete_lot(lot_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        _require_lot_owner(conn, lot_id, current_user)
        lots_service.delete_lot(conn, lot_id, current_user["id"])
    return {"ok": True}


@router.get("/pickup-groups")
def list_pickup_groups(recycler_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return lots_service.list_pickup_groups(conn, recycler_id)


@router.post("/pickup-groups")
def create_pickup_group(payload: PickupGroupRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recyclers WHERE user_id = %s;", (current_user["id"],))
            row = cur.fetchone()
        if not row:
            api_error(403, "NOT_A_RECYCLER", "Only recyclers can create pickup groups")
        return lots_service.create_pickup_group(conn, str(row["id"]), current_user["id"], payload.lot_ids)
