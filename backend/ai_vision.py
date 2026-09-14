import json
import logging
from typing import Any, Dict, List, Optional

from backend.config import settings

logger = logging.getLogger("kabadilink.ai_vision")

# 15 RPM Rate Limit Protection (03-ai-ml-pipeline.md): batch every box in ONE request per photo,
# never fire one request per cropped item.
GEMINI_TIMEOUT_MS = 3000
MATERIAL_CLASSES = ["PCB", "CABLE", "BATTERY", "LCD", "CRT", "MOTOR", "MAGNET", "PLASTIC", "OTHER"]

_client = None
_client_init_attempted = False


def _get_client() -> Optional[Any]:
    global _client, _client_init_attempted
    if _client_init_attempted:
        return _client
    _client_init_attempted = True

    if not settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY not set — cloud verification disabled, staying on local_model/rule_based.")
        return None

    try:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"Failed to initialize Gemini client: {e}")
        _client = None
    return _client


def verify_material_batch(image_bytes: bytes, local_detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Single-prompt multi-item batch verification (03-ai-ml-pipeline.md): sends the whole photo plus
    every local detection's bbox in ONE Gemini Flash request. On any error, timeout (>3s), or
    missing API key, falls back to local_detections unchanged — a cloud outage must never fail a
    user's classify-material request.
    """
    client = _get_client()
    if client is None or not local_detections:
        return local_detections

    try:
        from google.genai import types
    except Exception as e:
        logger.warning(f"google-genai types unavailable: {e}")
        return local_detections

    boxes_summary = [
        {"box_index": i, "bbox": d.get("bbox"), "local_guess": d.get("material")}
        for i, d in enumerate(local_detections)
    ]
    prompt = (
        "You are verifying e-waste material classifications for a recycling marketplace app. "
        "The attached photo contains one or more items at the given bounding boxes, each already "
        "carrying a local model's guess. For EACH box_index below, look at that region of the "
        f"image and return the material you observe (one of {MATERIAL_CLASSES}), your own "
        "confidence from 0 to 1, and a one-sentence plain-language reasoning.\n"
        f"Boxes: {json.dumps(boxes_summary)}"
    )
    schema = {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "box_index": {"type": "INTEGER"},
                "material": {"type": "STRING", "enum": MATERIAL_CLASSES},
                "confidence": {"type": "NUMBER"},
                "reasoning": {"type": "STRING"},
            },
            "required": ["box_index", "material", "confidence", "reasoning"],
        },
    }

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[prompt, types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=schema,
                http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
            ),
        )
        cloud_results = response.parsed if response.parsed is not None else json.loads(response.text)
    except Exception as e:
        # Covers 429 rate-limit, timeout, network errors, and malformed responses alike —
        # graceful fallback to local_model per the spec, never a failed user request.
        logger.warning(f"Gemini Vision verification failed, falling back to local_model: {e}")
        return local_detections

    return _merge_detections(local_detections, cloud_results)


def _merge_detections(local_detections: List[Dict[str, Any]], cloud_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Agree: raise confidence, use Gemini's reasoning, source=cloud_verified.
    Disagree: keep the local model's result but surface both guesses, source stays local_model,
    confidence is capped low — this is also the AI Confidence & Verification trigger condition.
    """
    by_index = {r["box_index"]: r for r in cloud_results if isinstance(r, dict) and "box_index" in r}
    merged = []

    for i, local in enumerate(local_detections):
        cloud = by_index.get(i)
        if cloud is None:
            merged.append(local)
            continue

        if cloud.get("material") == local.get("material"):
            merged.append({
                **local,
                "confidence": max(local.get("confidence", 0.0), cloud.get("confidence", 0.0)),
                "reasoning": cloud.get("reasoning", local.get("reasoning")),
                "source": "cloud_verified",
            })
        else:
            merged.append({
                **local,
                "confidence": min(local.get("confidence", 0.5), 0.5),
                "reasoning": (
                    f"Local model detected {local.get('material')} ({local.get('reasoning', '')}); "
                    f"cloud verification suggested {cloud.get('material')} instead "
                    f"({cloud.get('reasoning', '')}). Flagged for collector confirmation."
                ),
                "source": "local_model",
            })

    return merged
