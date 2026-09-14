from typing import List, Literal, Optional

from pydantic import BaseModel


class AIResult(BaseModel):
    """
    The shared explanation contract (03-ai-ml-pipeline.md): every AI-producing API response uses
    this shape, or an array of it for multi-item results. Internal detection objects passed
    between inference.py/ai_vision.py/classification.py keep the spec's own pseudocode field name
    "material" (also the documented shape of lot_photos.detections_json in 01-database-schema.md)
    — this model is the wire-response boundary only, built from those internal dicts at the
    router layer.
    """
    result: str
    confidence: float
    reasoning: str
    source: Literal["local_model", "cloud_verified", "rule_based"]
    bbox: Optional[List[float]] = None
    needs_confirmation: Optional[bool] = None


def detection_to_ai_result(detection: dict) -> AIResult:
    return AIResult(
        result=detection["material"],
        confidence=detection["confidence"],
        reasoning=detection.get("reasoning", ""),
        source=detection["source"],
        bbox=detection.get("bbox"),
        needs_confirmation=detection.get("needs_confirmation"),
    )
