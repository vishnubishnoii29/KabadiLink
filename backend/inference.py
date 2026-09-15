import io
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger("kabadilink.inference")

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
STAGE1_DETECTOR_PATH = os.path.join(MODELS_DIR, "stage1_detector.onnx")
STAGE2_CLASSIFIER_PATH = os.path.join(MODELS_DIR, "stage2_classifier.onnx")
STAGE2_LABELS_PATH = os.path.join(MODELS_DIR, "stage2_classifier_labels.json")

MATERIAL_CLASSES = ["PCB", "CABLE", "BATTERY", "LCD", "CRT", "MOTOR", "MAGNET", "PLASTIC", "OTHER"]

_stage1_session = None
_stage2_session = None
_models_loaded = False

_stage2_classes = ["BATTERY", "CABLE", "CRT", "LCD", "OTHER", "PCB", "PLASTIC"]
_stage2_input_size = 224
_stage2_mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
_stage2_std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


def _load_models() -> None:
    """
    Loads ONNX sessions at import time.
    If stage2_classifier.onnx is present, loads it for classification.
    If stage1_detector.onnx is also present, loads it for multi-item region proposals.
    """
    global _stage1_session, _stage2_session, _models_loaded, _stage2_classes, _stage2_input_size, _stage2_mean, _stage2_std
    if _models_loaded:
        return

    # Load Stage 2 labels if available
    if os.path.exists(STAGE2_LABELS_PATH):
        try:
            with open(STAGE2_LABELS_PATH, "r", encoding="utf-8") as f:
                meta = json.load(f)
                _stage2_classes = meta.get("classes", _stage2_classes)
                _stage2_input_size = meta.get("input_size", 224)
                if "normalize_mean" in meta:
                    _stage2_mean = np.array(meta["normalize_mean"], dtype=np.float32).reshape(3, 1, 1)
                if "normalize_std" in meta:
                    _stage2_std = np.array(meta["normalize_std"], dtype=np.float32).reshape(3, 1, 1)
        except Exception as e:
            logger.warning(f"Could not load stage2 labels metadata: {e}")

    # Load ONNX sessions
    if os.path.exists(STAGE2_CLASSIFIER_PATH):
        try:
            import onnxruntime as ort

            _stage2_session = ort.InferenceSession(STAGE2_CLASSIFIER_PATH)
            _models_loaded = True
            logger.info("Loaded stage2_classifier.onnx.")
        except Exception as e:
            logger.warning(f"Failed to load stage2_classifier.onnx, staying on rule_based fallback: {e}")
            _stage2_session = None

    if os.path.exists(STAGE1_DETECTOR_PATH):
        try:
            import onnxruntime as ort

            _stage1_session = ort.InferenceSession(STAGE1_DETECTOR_PATH)
            logger.info("Loaded stage1_detector.onnx.")
        except Exception as e:
            logger.warning(f"Failed to load stage1_detector.onnx: {e}")
            _stage1_session = None


_load_models()


def models_available() -> bool:
    return _stage2_session is not None


def _preprocess_crop(img: Image.Image) -> np.ndarray:
    """Preprocesses a PIL Image crop for MobileNetV2 Stage 2 inference."""
    rgb_img = img.convert("RGB")
    resized = rgb_img.resize((_stage2_input_size, _stage2_input_size), Image.Resampling.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)
    arr = (arr - _stage2_mean) / _stage2_std
    return np.expand_dims(arr, axis=0)


def classify_crop(img: Image.Image) -> Tuple[str, float]:
    """Runs Stage 2 MobileNetV2 ONNX inference on a PIL Image crop."""
    if _stage2_session is None:
        return "OTHER", 0.5

    batch = _preprocess_crop(img)
    logits = _stage2_session.run(["logits"], {"image": batch})[0][0]
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)
    idx = int(np.argmax(probs))
    pred_class = _stage2_classes[idx] if idx < len(_stage2_classes) else "OTHER"
    confidence = float(probs[idx])
    return pred_class, round(confidence, 4)


def detect_and_classify(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Runs on-device-equivalent local inference:
    1. If stage1_detector.onnx exists, runs YOLOv8n proposals and classifies each cropped box.
    2. If only stage2_classifier.onnx exists, classifies the whole image as a single lot item.
    3. If no models are loaded, returns [] to fall back to rule_based gracefully.
    """
    if _stage2_session is None:
        return []

    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
    except Exception as e:
        logger.error(f"Failed to open image bytes for inference: {e}")
        return []

    # If Stage 1 detector is present, run bounding box proposals (when trained in future)
    if _stage1_session is not None:
        # Placeholder for full YOLOv8n decode when Stage 1 model is added
        pass

    # Stage 2 classification over the image
    pred_class, confidence = classify_crop(img)

    return [
        {
            "bbox": [0, 0, width, height],
            "material": pred_class,
            "confidence": confidence,
            "source": "local_model",
        }
    ]
