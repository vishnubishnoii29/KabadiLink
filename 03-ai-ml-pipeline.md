# KabadiLink — AI/ML Pipeline (03 of 9)

Covers: Multi-item Detection, Fully On-device AI, AI/ML-only-where-data-supports-it, and the
explanation contract used everywhere else in the backend.

**Model Pipeline Architecture & Export Freeze Rule**:
1. **Pre-training Freeze & Consistency Rule (MANDATORY)**:
   Freeze the exact detector architecture and export pipeline before model training. Produce one
   known-good ONNX model and one known-good TFLite model, and run identical test images through
   both before integrating either into the apps. This guarantees server-side (`onnxruntime`) and
   on-device Flutter (`tflite_flutter`) produce consistent bounding boxes and classifications.
2. **Framework & Export Paths**:
   - **Stage 1 Detector (YOLOv8n)**: Fine-tune Ultralytics YOLOv8n on e-waste bounding boxes. Export directly
     via Ultralytics export CLI/API to ONNX (`yolo export format=onnx`) for backend inference, and to
     TFLite (`yolo export format=tflite`) for Flutter on-device inference.
   - **Stage 2 Classifier (MobileNetV2)**: Fine-tune MobileNetV2 in TensorFlow/Keras on 9-class e-waste materials.
     Export cleanly to TFLite via `tf.lite.TFLiteConverter` and to ONNX via `tf2onnx`.
3. **No Photo-Based Weight Estimation**:
   The vision pipeline outputs bounding boxes, material classes, and confidence scores only. It does **not**
   attempt photo-based weight estimation. Collectors or recyclers enter weights manually in all channels.

---

## Why this is two models, not one — a real feasibility constraint

Multi-item detection needs bounding boxes. The public Kaggle E-Waste Image Dataset (used for
material classification) is classification-only — single label per image, no bounding box
annotations. Training a good object detector from scratch needs box-annotated data that doesn't
exist for this domain yet. Solution: **two-stage pipeline**, not one end-to-end detector.

### Stage 1 — region proposal (finds "where are the items")
1. Take 100–200 real photos of mixed e-waste piles (your team's own photos — this doubles as
   prep for the field-research demo photos anyway).
2. Annotate bounding boxes around each distinct item using **Roboflow** (free tier covers this
   dataset size, and exports directly to a training-ready format).
3. Fine-tune a lightweight pretrained detector (**Ultralytics YOLOv8n**) on this small annotated set.
   **Training Environment**: Train in **PyTorch on Google Colab free T4 GPU tier**. The goal
   isn't to classify material at this stage — just to output "here's an object" boxes. A
   class-agnostic or coarse "electronic-item" label is enough.
4. Export directly from Ultralytics CLI: `yolo export model=runs/detect/train/weights/best.pt format=onnx`
   and `format=tflite`. Verify both `models/stage1_detector.onnx` and `models/stage1_detector.tflite`.

### Stage 2 — material classification (finds "what is each item")
1. Crop each Stage 1 bounding box out of the original photo.
2. Run each crop through a MobileNetV2 classifier fine-tuned on the Kaggle E-Waste Image
   Dataset, mapped onto the existing `MATERIAL_CLASSES` list (`PCB, CABLE, BATTERY, LCD, CRT,
   MOTOR, MAGNET, PLASTIC, OTHER`) — group Kaggle's categories onto these 9 as needed.
3. Export and verify both `models/stage2_classifier.onnx` and `models/stage2_classifier.tflite`.
4. This is the classifier that plugs into `ai_engine.py`'s existing `classify_image()` contract
   — keep that function's return shape identical, just replace its internals.

**Output of the full pipeline for one photo**: a list of `{bbox, material, confidence}` — this
is exactly the `detections_json` shape stored on `lot_photos` (see `01-database-schema.md`) and
what `POST /lots/photo` returns. Weight is entered subsequently by the user.

---

## Server-side inference (`backend/inference.py`)

```python
# Pseudocode structure — actual implementation fills in the ONNX Runtime calls
import onnxruntime as ort

_stage1_session = ort.InferenceSession("models/stage1_detector.onnx")
_stage2_session = ort.InferenceSession("models/stage2_classifier.onnx")

def detect_and_classify(image_bytes: bytes) -> list[dict]:
    boxes = _run_stage1(image_bytes)          # -> list of bbox
    results = []
    for box in boxes:
        crop = _crop(image_bytes, box)
        material, confidence = _run_stage2(crop)
        results.append({
            "bbox": box, "material": material, "confidence": confidence,
            "source": "local_model",
        })
    return results
```

Load both sessions once at import time (module-level), not per-request.

---

## On-device (mobile) integration

- Bundle the two TFLite model files in the Flutter app assets.
- Use `tflite_flutter` for inference — same two-stage flow as above, run entirely on-device.
- This is what makes it testable in airplane mode: the mobile app never needs to reach the
  server for `POST /lots/photo` to work. It only reaches the server for the optional cloud
  verification pass below, and only when online.

---

## Cloud verification (`backend/ai_vision.py`, Gemini Vision)

- Model: a **Flash-tier** Gemini model (free tier: roughly 10–15 requests/minute, up to ~1,000/
  day — comfortably enough for demo and pilot scale). Never use a Pro-tier model here — those require
  billing.
- **Single-Prompt Multi-Item Batching (15 RPM Rate Limit Protection)**:
  Instead of firing separate API requests per cropped item (which would exhaust the 15 RPM limit on photos
  with 3–5 items), send the **entire original photo along with the array of bounding box coordinates in ONE prompt**.
- Prompt asks Gemini for a structured JSON array: `[{box_index: 0, material: "PCB", confidence: 0.88, reasoning: "..."}, ...]`.
- **429 / Timeout Fallback**: If Gemini returns HTTP 429 (rate-limited) or fails to respond within 3 seconds,
  catch the error gracefully and fall back immediately to `source: "local_model"` without failing the user request.
- Merge logic: if Gemini's result matches the local model's result, raise confidence and use
  Gemini's reasoning text (mark `source: cloud_verified`). If they disagree, prefer the local
  model's result but surface both in the reasoning text and flag `confidence: low` — this is
  also exactly the trigger condition for AI Confidence & Verification (below).

```python
def verify_material_batch(image_bytes: bytes, local_detections: list[dict]) -> list[dict]:
    # calls Gemini Flash vision in one batched request passing image and bounding boxes
    # parses response into list of verified detections with explanations
    # if 429 / error occurs, falls back gracefully to local_detections with source: "local_model"
    ...
```

---

## The explanation contract — implement as a shared Pydantic model, use everywhere

```python
class AIResult(BaseModel):
    result: str            # material code, or a price band, or an anomaly status
    confidence: float      # 0.0-1.0, or "low"/"medium"/"high" for price estimates specifically
    reasoning: str         # one plain-language sentence
    source: Literal["local_model", "cloud_verified", "rule_based"]
```

Every AI-touching endpoint in `02-backend-api.md` returns this shape (or an array of it, for
multi-item results). Don't let any endpoint invent its own ad-hoc response format for an AI
result — that's the rule this whole contract exists to enforce.

**Offline Deterministic Reasoning Templates**:
When operating offline (`source: "local_model"`), reasoning strings must still be provided to satisfy
the `AIResult` contract. Use pre-defined domain templates based on detected class and condition:
- `PCB`: *"Detected rigid green substrate with integrated circuits, solder pads, and surface-mount components."*
- `BATTERY`: *"Identified cylindrical/pouch cell casing with distinct terminal contacts."*
- `CABLE`: *"Detected flexible insulated copper/aluminum wiring bundle."*
- `LCD`: *"Detected thin flat-panel display assembly with backlight layering."*
- `CRT`: *"Detected heavy glass cathode-ray funnel with electron gun assembly."*
- `MOTOR`: *"Detected cylindrical metallic stator/rotor assembly with copper winding core."*
- `MAGNET`: *"Detected neodymium or ferrite magnetic assembly."*
- `PLASTIC`: *"Detected molded polymer housing/casing."*
- `OTHER`: *"Unclassified electronic assembly requiring collector confirmation."*

---

## AI Confidence & Verification (the UX rule this powers)

In `services/classification.py`: if `confidence < CONFIDENCE_THRESHOLD` (start at 0.7, tune
after real testing), the API response includes `"needs_confirmation": true`. The client (web,
mobile, WhatsApp) must then show the collector the AI's guess and ask them to confirm or
correct it before the lot proceeds — never silently accept a low-confidence guess as fact.

---

## AI/ML only where data supports it (the pricing-side implementation)

In `services/pricing.py`, before returning an ML-influenced estimate:
```python
if sample_size < MIN_SAMPLES_FOR_CONFIDENCE:   # e.g. 8, matching the existing engine's tiers
    return {..., "confidence": "low", "source": "rule_based",
            "explanation": "Not enough recent local sales for a confident estimate — "
                            "showing the broader regional range instead."}
```
This branch must actually exist in the code, not just be true by coincidence of the existing
engine's design — the official problem statement is explicitly testing whether AI/ML claims are
backed by a real decision rule or just asserted. Keep the existing confidence-tier logic from
`estimate_fair_price()`; this is a restatement of a rule you already have, made explicit and
tied to the shared `source` field.
