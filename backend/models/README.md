# Trained model artifacts

`backend/inference.py` loads two ONNX files from this directory at import time:

- `stage1_detector.onnx` — YOLOv8n region proposal ("where are the items")
- `stage2_classifier.onnx` — MobileNetV2 material classifier ("what is each item")

Neither exists yet. Producing them is Agent E's job per `03-ai-ml-pipeline.md`:
annotate real e-waste photos in Roboflow, fine-tune both models on Colab's free T4 tier,
then export each to both ONNX (for this backend) and TFLite (for the Flutter app), verifying
identical outputs on the same test images per the file's "Pre-training Freeze & Consistency Rule."

Until both files are present, `backend/inference.py`'s `detect_and_classify()` returns `[]` and
`backend/services/classification.py` falls back to a rule_based whole-image placeholder — the
`/ai/classify-material` and `/lots/photo` endpoints stay fully functional either way.

## Stage 2 classifier: training in progress

`scripts/prepare_material_dataset.py` consolidates the raw Kaggle downloads under `dataset/`
into `dataset/material_dataset/{train,val,test}/<class>/`, and `scripts/train_stage2_classifier.py`
fine-tunes MobileNetV2 on it, producing `stage2_classifier.onnx` here plus
`stage2_classifier_labels.json` (the class-index order — do not assume it matches
`MATERIAL_CLASSES`' full order or length, see below).

**Framework deviation**: trained in **PyTorch** (torchvision's MobileNetV2), not
TensorFlow/Keras as `03-ai-ml-pipeline.md` specifies. TensorFlow dropped native Windows GPU
support after v2.10 (needs WSL2); PyTorch has first-class native Windows CUDA support and was
the pragmatic choice for training on a local RTX 3050. Export to ONNX is unaffected either way.
TFLite export for the offline Flutter app is deferred as a follow-up (PyTorch has no direct
TFLite path — likely ONNX → TensorFlow → TFLite via a separate conversion pass).

**Class scope**: trained on 7 of the 9 `MATERIAL_CLASSES` — `PCB, CABLE, BATTERY, LCD, CRT,
PLASTIC, OTHER`. **MOTOR and MAGNET are known gaps for this pilot**: no usable source imagery
existed for either (public e-waste/electronics datasets only show whole-appliance photos, not
motor/magnet closeups), and manual photography for both was intentionally deferred rather than
block training. The model will never predict these two classes — a photo of an actual motor or
magnet will be forced into whichever of the 7 trained classes looks closest, likely at low
confidence, which correctly triggers the existing `needs_confirmation` UX path in
`services/classification.py` rather than silently misreporting the material.

`stage2_classifier.onnx` is committed directly (~9MB, well within git's comfortable range) so
it's present on every checkout, including CI and Render — no separate distribution step needed.
`stage1_detector.onnx` (once trained) should be committed the same way unless it turns out to be
much larger, in which case revisit Git LFS or object storage. `.tflite` exports remain
git-ignored since they don't exist yet (see "Framework deviation" above).
