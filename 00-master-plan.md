# KabadiLink — Master Build Plan (00 of 9)

**Read this file first.** It's the index and sequencing document for the other eight. Each
other file is a self-contained spec for one domain — hand a whole file to one Claude Code or
Antigravity agent session and it should be able to build that domain without needing to ask
you anything not already answered in these documents.

**Scope**: everything in Tier 1 (must-have table stakes) and the **Tier 2 Flagship Five (mandatory differentiators)** of
`kabadilink-final-feature-list.md`. Secondary Tier 2 features (items 6–11) are strictly optional and to be built only if time remains after Tier 1 and Flagship 5 are solid and integrated. Nothing from Tier 3 gets built. If an agent hits a decision
not covered here, the answer is: check the feature list and architecture doc first; if still
ambiguous, default to the simplest option that satisfies the stated requirement, and flag it
rather than guessing silently.

**Non-negotiable ground rules for every agent, every file:**
1. Zero real-money cost. No paid SMS, no outbound WhatsApp business messages, no paid hosting
   tier, no live payment gateway. See `07-deployment.md` for the exact free-tier stack.
2. Every AI-producing response returns `{result, confidence, reasoning, source}` — no
   exceptions, no ad-hoc response shapes. See `03-ai-ml-pipeline.md`.
3. Build on the existing repo (`priyanshubiswal3306/Kabadi-Link`). Don't rebuild what's already
   correct — `match_recyclers()`'s material-compatibility filter and the mobile app's
   `client_uid` sync dedup are already implemented; verify them, don't recreate them.
4. Every state-changing action writes to `audit_log`, including which AI `source` was used.
5. No feature is considered complete until it passes an integration test through the shared service
   layer and the relevant client(s).
6. No feature may have a hard dependency on a service whose free availability has not been verified
   immediately before implementation; every external service must have a documented zero-cost fallback.

---

## Target repo structure (end state)

```
backend/
  main.py                      # slim: app creation, CORS, startup, router registration only
  config.py                    # env vars, thresholds
  db.py                        # connection layer, Postgres via DATABASE_URL
  auth.py                      # JWT + OTP helpers (kept from base repo, extended)
  helpers.py                   # audit(), next_lot_id(), lot_payload(), etc. — moved out of main.py
  inference.py                 # ONNX model loading + predict() — on-device-equivalent server path
  ai_vision.py                 # Gemini Vision call + reasoning generation
  seed.py                      # demo data (existing, extend with new tables)
  smoke_test.py                # existing 33 checks, extend per new endpoints
  routers/
    auth.py
    lots.py
    offers.py
    recyclers.py
    handover.py
    disputes.py
    notifications.py
    epr.py
    admin.py
    ai.py
    whatsapp.py
    uploads.py
  services/
    lots.py
    pricing.py
    classification.py
    matching.py
    offers.py
    anomaly.py
    epr.py
    handover.py
    payments.py
    notifications.py
    admin.py
    uploads.py
  models/                      # ONNX model files (stage-1 detector, stage-2 classifier)
  jobs/                        # background jobs: cloud AI calls, EPR PDF gen, dataset export
web/        # existing React+Vite app, extended per 04-web-app.md
mobile/     # existing Flutter app, extended per 05-mobile-app.md
.github/workflows/
  ci.yml                       # test on push
  keep-alive.yml               # health-check ping every 10 min
```

---

## Phase sequencing and parallel-agent assignment

### Phase 0 — Foundation (sequential, one agent, do this first, ~half a day)
Blocks nothing else conceptually, but touches `main.py` which everything else reads from, so
merge it before starting Phase 1 branches.
- Repo hygiene: `.gitignore`, untrack `node_modules`/`__pycache__`/`*.db`/`*.log`/uploads
- Split `main.py` into `routers/` + `helpers.py` (see `02-backend-api.md` for the exact router
  boundaries)
- Add `GET /health` (dependency-free) and `.github/workflows/keep-alive.yml`
  (see `07-deployment.md` for exact file contents)
- Add `.github/workflows/ci.yml` running `smoke_test.py` on push
- Apply the database schema in `01-database-schema.md` to a fresh Postgres instance
  (Supabase as primary with storage, or Neon as database-only fallback — see `07-deployment.md`)

**Done when**: `smoke_test.py` passes against the refactored, Postgres-backed app; `/health`
returns 200; the keep-alive workflow runs on schedule.

### Phase 1 — Backend core services (parallel, 4 agents, depends on Phase 0 merged)
Each agent owns distinct files — merge conflict risk is low if scoped exactly as below.
- **Agent A**: `services/lots.py`, `routers/lots.py` — lot CRUD, Smart Lot Management
  (split/combine with user-entered weights), Pickup Tracking states
- **Agent B**: `services/offers.py`, `routers/offers.py`, `services/matching.py` — multiple
  offers, counter-offer chain, recycler matching (verify existing filter survives refactor);
  integrates price anomaly checks before returning offers
- **Agent C**: `services/handover.py`, `services/payments.py`, `routers/handover.py`,
  `services/anomaly.py` — OTP/QR handover (staged as READY_TO_VERIFY offline, verified server-side online),
  canonical payment recording via `transactions` table (with `handovers` referencing `transaction_id`),
  and anomaly detection service (`services/anomaly.py`)
- **Agent D**: `services/notifications.py`, `routers/disputes.py`, `routers/notifications.py`,
  `services/admin.py`, `routers/admin.py`, `services/epr.py`, `routers/epr.py`,
  `services/uploads.py`, `routers/uploads.py` — disputes, in-app notifications queue,
  EPR-Ready Handover Record generation, verification-doc review, generic object storage uploads,
  audit trail, impact-summary aggregation

Full endpoint contracts for all of these: `02-backend-api.md`.

**Done when**: every endpoint in `02-backend-api.md` for these four areas responds correctly
against Postgres, with audit-log entries written for every state change.

### Phase 2 — AI/ML pipeline (parallel with Phase 1, independent)
- **Agent E**: dataset annotation + model training (Colab) — see `03-ai-ml-pipeline.md` in full.
  **Pre-requisite rule**: Freeze the exact detector architecture (Ultralytics YOLOv8n) and classifier
  architecture (MobileNetV2), lock the export pipeline to produce one known-good ONNX model and one
  known-good TFLite model, and run identical test images through both before integrating either into the apps.
- **Agent F**: `backend/inference.py`, `backend/ai_vision.py`, `services/classification.py`,
  `services/pricing.py`'s confidence-threshold branch — the explanation contract and the
  AI-only-where-data-supports-it rule, both specified in `03-ai-ml-pipeline.md`

**Done when**: `/ai/classify-material` returns a correct `{result, confidence, reasoning,
source}` shape for a real multi-item photo, both online and in airplane mode.

### Phase 3 — Channels (parallel, depends on Phase 1's `lots`/`offers`/`handover` services existing)
- **Agent G**: `routers/whatsapp.py`, the conversation-state machine — full spec in
  `06-whatsapp-bot.md`
- **Agent H**: web app screens — full spec in `04-web-app.md`
- **Agent I**: mobile app screens + on-device model bundling — full spec in `05-mobile-app.md`

**Done when**: a lot can be created and priced through all three channels, hitting the same
underlying service functions.

### Phase 4 — Deployment & reliability (start in parallel, finalize after Phase 1–3 merged)
- **Agent J**: full deployment per `07-deployment.md` — Supabase (primary, Postgres + Storage;
  Neon as database fallback), Render/Railway + keep-alive, Vercel, Upstash, Sentry, CI, load test

**Done when**: the checklist at the end of `07-deployment.md` is fully checked.

### Phase 5 — Validation & economics (independent track, runs the whole time, not code)
Start **immediately**, in parallel with everything above — don't wait for the app to be
finished. Full detail in `08-validation-economics.md`.
- Field research phase 1 (need-finding) — week 1
- Unit economics model — ongoing, finalized once real infra numbers exist
- Structured dataset export — built as part of Phase 1 Agent D, populated once real data exists
- Field research phase 2 (usability demo, filmed) — once a working prototype exists (after
  Phase 3)

---

## Merge order

Phase 0 → Phase 1 (A, then B, then C, then D — in that order, to minimize schema-dependency
surprises) → Phase 2 wired into Phase 1's lot-creation flow → Phase 3 (G, H, I, any order) →
Phase 4 → final smoke test + manual walkthrough of every feature in the feature list.

Run `smoke_test.py` after every merge. Stop and fix before merging the next branch if it fails.

---

## Definition of done — whole project

- Every Tier 1 feature and Tier 2 Flagship Five feature from `kabadilink-final-feature-list.md` works end to end,
  on all three channels where applicable; secondary Tier 2 features built strictly if time remains
- Every feature passes end-to-end integration tests through the shared service layer and relevant client(s)
- Transactions table is the single canonical source of truth for payments; handovers references payment completion
- Offline handover stages `READY_TO_VERIFY` / `HANDOVER_PENDING` with mutual acknowledgement; actual OTP verification is verified by the server when online
- EPR-Ready Handover Record (formatted for CPCB Form-2 filing support) generated on verified handover
- Zero paid services in use; keep-alive job running (treated as best-effort keep-alive with client-side cold start handling); `/health` green
- `smoke_test.py` (extended) passes in CI on every push
- Structured dataset export produces a real anonymized sample
- Unit economics model has real numbers, not placeholders
- Field research phase 1 is complete and documented; phase 2 is scheduled
- Demo narrative arc (from the feature list) rehearsed against the deployed, not local, app
