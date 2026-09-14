import io
import logging
from typing import Any, Dict, List

from PIL import Image

from backend import ai_vision, inference
from backend.config import settings

logger = logging.getLogger("kabadilink.services.classification")

# Offline Deterministic Reasoning Templates (03-ai-ml-pipeline.md) — used whenever a detection has
# no cloud-verified reasoning of its own (rule_based fallback, or local_model with no Gemini call).
REASONING_TEMPLATES = {
    "PCB": "Detected rigid green substrate with integrated circuits, solder pads, and surface-mount components.",
    "BATTERY": "Identified cylindrical/pouch cell casing with distinct terminal contacts.",
    "CABLE": "Detected flexible insulated copper/aluminum wiring bundle.",
    "LCD": "Detected thin flat-panel display assembly with backlight layering.",
    "CRT": "Detected heavy glass cathode-ray funnel with electron gun assembly.",
    "MOTOR": "Detected cylindrical metallic stator/rotor assembly with copper winding core.",
    "MAGNET": "Detected neodymium or ferrite magnetic assembly.",
    "PLASTIC": "Detected molded polymer housing/casing.",
    "OTHER": "Unclassified electronic assembly requiring collector confirmation.",
}


def _rule_based_fallback(image_bytes: bytes) -> Dict[str, Any]:
    """Whole-image OTHER guess — used when no trained local model is available yet."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
    except Exception:
        width, height = 0, 0

    return {
        "bbox": [0, 0, width, height],
        "material": "OTHER",
        "confidence": 0.5,
        "source": "rule_based",
        "reasoning": REASONING_TEMPLATES["OTHER"],
    }


def classify_photo(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Full pipeline per 03-ai-ml-pipeline.md: on-device-equivalent local model first, then an
    optional single-batched cloud verification pass, then the AI Confidence & Verification rule
    (needs_confirmation when confidence < AI_CONFIDENCE_THRESHOLD). Every returned item matches
    the {result≈material, confidence, reasoning, source} explanation contract.
    """
    local_detections = inference.detect_and_classify(image_bytes)

    if local_detections:
        detections = ai_vision.verify_material_batch(image_bytes, local_detections)
    else:
        # No trained local model yet (backend/inference.py) — rule_based keeps the contract
        # shape correct for every caller while Agent E's training pipeline is still in progress.
        detections = [_rule_based_fallback(image_bytes)]

    for d in detections:
        if not d.get("reasoning"):
            d["reasoning"] = REASONING_TEMPLATES.get(d.get("material"), REASONING_TEMPLATES["OTHER"])
        d["needs_confirmation"] = d.get("confidence", 0.0) < settings.AI_CONFIDENCE_THRESHOLD

    return detections
