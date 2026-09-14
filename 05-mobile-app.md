# KabadiLink — Mobile App Spec (05 of 9)

Existing stack: Flutter, offline-first (SQLite + `pending_ops` outbox with `client_uid` dedup —
**already implemented, verify it still works after backend changes, don't rebuild it**). This is
the primary collector-facing surface — most new features land here first, web/WhatsApp are
secondary paths to the same underlying lots/offers/handover flow.

---

## `lib/ui/collector/sell_wizard.dart` (extend)
- After photo capture, run the on-device two-stage model (see `03-ai-ml-pipeline.md`) — this
  must work fully offline. Show one card per detected item (crop, material, confidence).
- If any item's confidence is below threshold, show the AI Confidence & Verification prompt:
  "Is this a battery?" with confirm/correct buttons, before continuing.
- Smart Lot Management step: collector enters weight per item manually (weight is never estimated from photo), then chooses "Sell separately" vs. "Sell together" choice, same as web.
- Price estimate screen: show explanation text + confidence badge (Explainable Fair Price),
  not just the number — this should work offline too, falling back to the last-synced local
  price data with `source: rule_based` and a note that it's using cached data.
- Add the "Scrap or sell?" decision screen (Tier 2 feature #8) here: if any detected item's
  crop looks visually intact (a simple heuristic — sharp edges, no visible damage — or just a
  confidence-based "not obviously e-waste" signal from the classifier), show scrap value vs. an
  estimated resale value side by side before committing to scrapping it.

## `lib/ui/collector/lots_page.dart` (extend)
- Offers list with Accept / Reject / Counter, same behavior as web.
- Pickup Tracking status display.
- Dispute button + form, same fields as web (`type`, `description`, optional photo).

## New screen: handover / OTP confirmation
- Show the OTP (or a QR code encoding it) for the recycler to scan/enter.
- Payment-method selector (cash/digital) + confirm button.
- **Offline Handover Security**: When offline, handover intent and actual measured weight are recorded and staged
  locally as `READY_TO_VERIFY` / `HANDOVER_PENDING` with mutual collector-recycler acknowledgement queued in `pending_ops`.
  To prevent unauthorized offline OTP creation, official completion is **not** confirmed offline; once connectivity is
  restored, the record is synced and verified server-side via `POST /handover/{lot_id}/otp/verify` before transitioning
  to `COMPLETED`.

## `lib/ui/collector/passport_page.dart` (extend)
- Full Scrap Passport view, same fields as web.
- EPR-Ready Handover Record view/download link (formatted to assist CPCB Form-2 filing, JSON or PDF viewer).

## `lib/ui/collector/earnings_page.dart` (extend)
- Show payment method (cash/digital) per transaction, reading from the canonical `transactions` table.

## `lib/ui/collector/safety_page.dart` (extend — ISL video guidance)
- Add an ISL video player alongside the existing text-to-speech safety content, per material
  type, sourced from `safety_content` where `content_type = ISL_VIDEO`.
- This is **one-directional only** — the app plays ISL video *to* the user. Do not attempt
  camera-based sign *recognition*; it's not reliable enough to demo and isn't in scope.

## Voice + visual, low-literacy mode (cross-cutting, not a single screen)
- A settings toggle that switches the whole collector flow to: larger icons, minimal text,
  voice-guided prompts read aloud at each step (reuse the existing TTS pattern from the safety
  hub, extend it to the sell wizard and offers flow).

## `lib/data/offline_db.dart` / `lib/data/repository.dart` (extend, carefully)
- New local tables/queues needed for the new server-side entities that can be created offline:
  disputes, counter-offers, handover OTP generation. Follow the exact same
  `pending_ops` + `client_uid` pattern already used for lots and offer-acceptances — don't
  invent a second offline-sync mechanism.
- Verify the existing dedup logic still triggers correctly for these new operation types before
  considering this done.

## On-device model bundling
- Add the two TFLite files (`stage1_detector.tflite` for YOLOv8n object detection and `stage2_classifier.tflite`
  for MobileNetV2 classification, from `03-ai-ml-pipeline.md`) to Flutter assets.
- Both models must be pre-verified against identical test images run through the server ONNX models before bundling.
- Add `tflite_flutter` (or the current recommended Flutter TFLite package — check what's
  actively maintained at build time) to `pubspec.yaml`.
- Keep model files reasonably small (quantize if needed) — they're bundled into the app binary,
  not downloaded at runtime, since offline-first means they must be present from install.

## `lib/core/config.dart`
- Point at the deployed backend URL once available (see `07-deployment.md`) — don't leave this
  hardcoded to localhost when building for the demo device.
