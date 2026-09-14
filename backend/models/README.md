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

Files placed here are git-ignored (see `.gitignore`) — they're large binaries that don't belong
in version control; deploy them alongside the backend some other way (build artifact, object
storage, Git LFS).
