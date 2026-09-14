import logging
import os
from typing import Any, Dict, List

logger = logging.getLogger("kabadilink.inference")

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
STAGE1_DETECTOR_PATH = os.path.join(MODELS_DIR, "stage1_detector.onnx")
STAGE2_CLASSIFIER_PATH = os.path.join(MODELS_DIR, "stage2_classifier.onnx")

MATERIAL_CLASSES = ["PCB", "CABLE", "BATTERY", "LCD", "CRT", "MOTOR", "MAGNET", "PLASTIC", "OTHER"]

_stage1_session = None
_stage2_session = None
_models_loaded = False


def _load_models() -> None:
    """
    Loads both ONNX sessions once at import time, per 03-ai-ml-pipeline.md.
    Agent E's Colab training pipeline (dataset annotation + YOLOv8n/MobileNetV2 fine-tuning +
    export) hasn't produced models/stage1_detector.onnx and models/stage2_classifier.onnx yet —
    until it does, this stays a no-op and detect_and_classify() reports itself unavailable so
    callers fall back to the rule_based path (00-master-plan.md's zero-cost-fallback rule).
    """
    global _stage1_session, _stage2_session, _models_loaded
    if _models_loaded:
        return
    if not (os.path.exists(STAGE1_DETECTOR_PATH) and os.path.exists(STAGE2_CLASSIFIER_PATH)):
        logger.info(
            "ONNX models not found under models/ (stage1_detector.onnx, stage2_classifier.onnx) — "
            "server-side detection is unavailable until the training pipeline produces them."
        )
        return

    try:
        import onnxruntime as ort

        _stage1_session = ort.InferenceSession(STAGE1_DETECTOR_PATH)
        _stage2_session = ort.InferenceSession(STAGE2_CLASSIFIER_PATH)
        _models_loaded = True
        logger.info("Loaded stage1_detector.onnx and stage2_classifier.onnx.")
    except Exception as e:
        # A corrupt/incompatible model file must degrade to the rule_based fallback, not crash
        # the whole app at import time (00-master-plan.md's zero-cost-fallback rule).
        logger.warning(f"Failed to load ONNX models, staying on rule_based fallback: {e}")
        _stage1_session = None
        _stage2_session = None
        _models_loaded = False


_load_models()


def models_available() -> bool:
    return _models_loaded


def detect_and_classify(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Stage 1 (YOLOv8n region proposal) + Stage 2 (MobileNetV2 material classification).
    Returns [] whenever the trained models aren't present — the caller (services/classification.py)
    is responsible for the rule_based fallback so a missing model never breaks a user request.

    NOT YET IMPLEMENTED: the exact preprocessing (input size, normalization) and postprocessing
    (box decoding, NMS thresholds, output tensor layout) are fixed by Agent E's export config per
    the "Pre-training Freeze & Consistency Rule" in 03-ai-ml-pipeline.md — they can only be written
    correctly against the real exported models, not guessed ahead of them. Once
    models/stage1_detector.onnx and models/stage2_classifier.onnx exist, fill in this function to
    match their actual input/output contract and verify identical results against the TFLite
    export used by the mobile app, per the same consistency rule.
    """
    if not _models_loaded:
        return []

    raise NotImplementedError(
        "ONNX models are present but detect_and_classify()'s pre/postprocessing has not been "
        "implemented against their real input/output contract yet — see this function's docstring."
    )
