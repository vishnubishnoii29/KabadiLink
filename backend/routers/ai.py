import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, Field

from backend.ai_contract import AIResult, detection_to_ai_result
from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.services import classification as classification_service
from backend.services import pricing as pricing_service
from backend.services.anomaly import check_price_anomaly

logger = logging.getLogger("kabadilink.routers.ai")
router = APIRouter(prefix="/ai", tags=["AI"])


class AnomalyCheckRequest(BaseModel):
    material: str
    offer_price: float = Field(..., gt=0)
    location: Optional[str] = None
    condition: Optional[str] = None


@router.post("/classify-material", response_model=List[AIResult])
async def classify_material(photo: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Full detection pipeline detail in 03-ai-ml-pipeline.md — one AIResult per detected object."""
    image_bytes = await photo.read()
    detections = classification_service.classify_photo(image_bytes)
    return [detection_to_ai_result(d) for d in detections]


@router.get("/estimate-price")
def estimate_price(
    material: str,
    weight: float,
    location: Optional[str] = None,
    condition: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Same shape as /lots/{id}/price-estimate, usable before a lot exists (e.g. a WhatsApp 'what's it worth' query)."""
    with get_db_connection() as conn:
        material_id = pricing_service.get_material_id_by_code(conn, material)
        return pricing_service.estimate_fair_price(conn, material_id, weight, location, condition)


@router.post("/anomaly-check")
def anomaly_check(payload: AnomalyCheckRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        material_id = pricing_service.get_material_id_by_code(conn, payload.material)
        return check_price_anomaly(conn, material_id, payload.offer_price)
