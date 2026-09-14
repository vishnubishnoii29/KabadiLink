# KabadiLink — Architecture Decision Document (consolidated)

Core principle: **one shared core service layer, thin adapters per channel.** Every decision
below either implements that principle or supports one of the four stated requirements —
flexible, explainable, scalable, deployable — plus reaching laptop, mobile, low-literacy, and
WhatsApp users specifically, at genuinely zero real-money cost.

---

## 1. Client layer

| Channel | Tech | Who it's for | Key property |
|---|---|---|---|
| Web app | React + Vite (existing) | Recyclers, admins, anyone on a laptop | Rich dashboards (impact view, verification queue); password or OTP login |
| Mobile app | Flutter (existing) | Collectors in the field | Offline-first (SQLite + sync outbox, already built), camera-first UX, on-device AI model bundled (TFLite), voice+visual low-literacy mode, ISL video guidance; password or OTP login |
| WhatsApp bot | Meta Cloud API webhook | Collectors with no app, or no comfort using one | Free for user-initiated conversations; no separate login — phone number *is* the identity inside WhatsApp |

None of these three talk to the database directly. All three call into the core service layer
below — web and mobile via REST, WhatsApp via a thin adapter that translates conversation
turns into the same service calls.

---

## 2. Channel adapter layer

- **REST API** (FastAPI) — used directly by web and mobile. Routers stay thin: parse the
  request, call a service function, return the response. No business logic in the router itself.
- **WhatsApp adapter** (`backend/routers/whatsapp.py`) — receives Meta webhook events, keeps a
  small conversation-state machine per phone number (state stored in Redis, not Postgres — it's
  short-lived), and calls the *same* service functions the REST routers call
  (`services.lots.create_lot(...)`, `services.pricing.estimate(...)`, etc.). This is the concrete
  mechanism behind "flexible" — a new channel is a new adapter file, not new logic. Only the
  collector-initiated reporting flow runs over WhatsApp; outbound notifications do not (see
  section 6).

---

## 3. Core service layer (the shared backbone)

Layered as: **routers/adapters → services (business logic) → repository/DB access** — the same
pattern your strongest competitor already uses (`routes → controllers → services → models`).

Service modules (each independently testable, each callable from any adapter):
- `auth` — registration, login (password + OTP option), session/JWT issuance
- `lots` — lot creation, listing, updates, and **lot splitting/combining** for multi-item photos
- `pricing` — the existing rule-based fair-price engine, extended with an explicit explanation
  string and a confidence tier per estimate
- `classification` — routes a photo to the on-device model result and, when online, to the
  cloud verification call; always returns `{result, confidence, reasoning, source}`; below a
  confidence threshold, flags for collector confirmation instead of auto-accepting
- `matching` — recycler matching (existing haversine + weighted scoring + material-compatibility
  hard filter, keep as-is)
- `offers` — multiple competing offers plus accept/reject/**counter-offer** state transitions
- `anomaly` — offer anomaly detection (existing in `services/anomaly.py`, called during offer creation)
- `epr` — generates the EPR-Ready Handover Record (formatted per CPCB Form-2 requirements) per verified handover
- `handover` / `payments` — handover confirmation (OTP/QR, staged offline as READY_TO_VERIFY, verified server-side online),
  canonical payment recording via the `transactions` table (the single source of truth for payment, referenced by `handovers`),
  and **dispute reporting** with attached evidence
- `notifications` — in-app notifications queue (`/notifications` polling) as primary, with optional Firebase Cloud Messaging push; no outbound WhatsApp sends
- `admin` — verification queue, audit trail, impact-summary aggregation, structured-dataset export

**Every AI-touching service returns the same explanation contract**: `result`, `confidence`,
`reasoning`, `source` (`local_model` / `cloud_verified` / `rule_based`). This is a single
architectural rule that makes every AI feature explainable the same way, instead of each one
inventing its own response shape.

**AI/ML only where data supports it — an explicit architectural rule, not an accident.** The
`source` field above isn't just for explainability — it's the mechanism that enforces this
principle. `pricing` and `classification` must check sample size / model confidence *before*
returning an ML-based result; below a stated threshold, they return `source: rule_based` with a
low-confidence flag instead of forcing a prediction from insufficient data. This needs to be a
real branch in the code and stated explicitly in the pitch, since the official problem statement
is specifically testing for AI-for-decoration vs. AI actually justified by data.

---

## 4. AI layer

- **On-device models** (mobile): Stage 1 object detector (Ultralytics YOLOv8n fine-tuned on e-waste item boxes) + Stage 2 classifier (MobileNetV2 fine-tuned on 9-class e-waste materials), both exported to **TFLite** and bundled in the Flutter app assets. Runs with zero connectivity.
- **Same model architecture, server-side** (`backend/inference.py`, via `onnxruntime`): The identical Stage 1 YOLOv8n detector and Stage 2 MobileNetV2 classifier exported to **ONNX**. Used when the web app or WhatsApp bot submits a photo.
- **Model Pipeline Freeze Rule**: Freeze the exact detector architecture and export pipeline before model training. Produce one known-good ONNX model and one known-good TFLite model and run identical test images through both before integrating either into the apps.
- **Cloud verification** (`backend/ai_vision.py`, Gemini Vision, free Flash-tier quota — roughly
  10–15 requests/minute and up to ~1,000/day, comfortably enough for demo and pilot-scale use):
  called from the core service layer when online, for a second opinion + a human-readable
  reasoning string. Never a hard dependency — every classification works with this layer
  entirely absent.

---

## 5. Data layer

| Store | Used for | Why this one |
|---|---|---|
| Postgres (Supabase as primary, Neon as DB fallback — **not Render's own free Postgres**, which expires after 30 days) | Source of truth — users, lots, offers, transactions, audit log | Schema already shaped for it; relational integrity matters for financial/compliance records; Supabase/Neon persist indefinitely on free tier |
| Redis (Upstash, free tier) | WhatsApp conversation state, rate limiting, caching hot reads (price ranges, recycler lists) | Short-lived, high-churn state — wrong fit for Postgres, right fit for a key-value store |
| Object storage (Supabase Storage, free tier) | Lot photos, ISL video clips, verification documents, dataset exports | Needs to survive redeploys, which local disk (current setup) does not; Supabase provides both Postgres and storage in one project |
| Mobile SQLite (existing, unchanged) | Offline cache + sync outbox, with existing `client_uid` dedup | Already built and working — no change needed |

**Structured dataset as a first-class data-layer output, not an afterthought.** The official
problem statement asks for structured datasets explicitly. Concretely: a documented
schema/data dictionary for materials, prices, transactions, locations, and mineral-recovery
estimates, plus an export job (part of the background-jobs system below) that produces a real
anonymized sample extract from Postgres.

---

## 6. Cross-cutting concerns

- **Background jobs** (Celery/RQ over Redis, or FastAPI `BackgroundTasks` if load is light
  enough to not need a separate worker): cloud AI calls, EPR certificate/PDF generation, the
  structured-dataset export — anything slow enough to otherwise block a WhatsApp reply or a web
  request.
- **Audit log** (existing table, extended): every state-changing action — including offer
  counters, disputes, and which AI path (local/cloud/rule-based) was used for each
  classification — feeds both explainability and the EPR certificate's chain-of-custody section.
- **Auth & OTP delivery, at zero real cost**:
  - Inside WhatsApp: Phone number *is* the identity key; no separate password or login required.
  - Inside Web & Mobile: Users log in via password OR request an OTP. OTP delivery avoids paid SMS gateway:
    options are logging server-side for dev/demo, sending via free-tier transactional email, or receiving
    an OTP reply via WhatsApp (free because the user initiated interaction).
- **Safe Handover Security**:
  - Offline mode prepares and stages the handover as `READY_TO_VERIFY` / `HANDOVER_PENDING` with mutual intent.
  - Official handover verification and transition to `COMPLETED` requires server-side OTP validation upon reconnecting.
  - The `transactions` table is the single canonical source of truth for payment; `handovers` references `transaction_id`.
- **Notifications**: In-app database notification queue (`/notifications` polling) is primary.
  Firebase Cloud Messaging (FCM) is an optional push enhancer. No outbound WhatsApp-delivered notifications
  in the current build — those are business-initiated conversations and cost real money under Meta's pricing; kept as a Tier 3 future item.
- **Security**: rate limiting via Redis (especially on the webhook and any AI endpoint, since
  those are the expensive ones to abuse), encrypted sensitive fields, HTTPS everywhere.
- **Observability**: Sentry (free tier) for error tracking, FastAPI's built-in OpenAPI/Swagger
  docs kept switched on and current, structured logging.
- **Reliability without paying for it**: a dependency-free `GET /health` endpoint (no DB query,
  no auth — just confirms the process is alive), paired with a scheduled GitHub Actions workflow
  that pings it every 10 minutes, kept comfortably under the free-tier host's inactivity
  timeout. This is a best-effort keep-alive; clients must handle initial cold starts gracefully with clear loading UI.
  Optionally backed up by a free external monitor (UptimeRobot or cron-job.org) for redundancy during demo week.

---

## 7. Deployment

| Piece | Where | Why |
|---|---|---|
| Backend API + worker | Render or Railway free tier, kept warm by the keep-alive job above | Git-push deploy, no DevOps overhead, genuinely $0 |
| Web app | Vercel | CDN by default, zero-config for a Vite build, free |
| Postgres + object storage | Supabase as primary (Neon as DB-only fallback) | One provider for both Postgres and storage, free tier persists indefinitely, matches the existing schema |
| Redis | Upstash | Serverless, free tier, no server to manage |
| WhatsApp | Meta Cloud API direct | No platform fee; free for user-initiated conversations |

**Reserved fallback, not the primary plan**: the GitHub Student Developer Pack is claimed
(DigitalOcean App Platform credit, Azure credit, GitHub Pro for more CI minutes). If the
free-tier-plus-keep-alive approach ever genuinely fails in testing — not as a default upgrade —
DigitalOcean App Platform (no sleep-after-inactivity behavior, paid for by credit rather than
real money) is the documented fallback for backend hosting. Nothing about the architecture
needs to change to make that swap; it's a hosting-target change, not a design change.

Deliberately **not** using Kubernetes or a multi-region setup — that complexity buys nothing at
this stage and costs time that isn't available. The stateless-API + background-job design means
you *can* scale horizontally later on any of these managed platforms without re-architecting,
which is the actual definition of "scalable" that matters here: not "we run on Kubernetes," but
"nothing in the design prevents running more than one instance."

---

## 8. What NOT to add, and why

- **No microservices split beyond AI-as-a-shared-module.** Splitting the core API into separate
  deployable services adds operational overhead with zero benefit at this scale — the layered
  monolith already gives you the separation of concerns that matters.
- **No blockchain / "immutable ledger."** The audit-log table already gives you the
  traceability story. Bolting on a distributed ledger without a functional reason reads as a
  buzzword, not an architecture decision, to anyone technical on the judging panel.
- **No full payment gateway integration in production mode.** Sandbox/test mode only — live
  money handling is a separate regulatory conversation, not a hackathon-week architecture
  decision.
- **No paid hosting tier before demo day**, unless the free-tier keep-alive approach genuinely
  proves unreliable in testing — try the $0 path first; the credit is there if it's actually
  needed, not because it's more convenient.
- **No outbound WhatsApp notifications.** They cost real money per message; in-app push covers
  the same need for free.

---

## 9. Outside this document's scope, but mandatory

Field research (2+ collectors/aggregators, need-finding plus a filmed usability demo) and the
unit-economics model are explicit requirements in the official problem statement — but they're
process and business deliverables, not system architecture, so they're tracked in the feature
list and build plan rather than here. Their absence from this document doesn't mean lower
priority; they're must-haves, just not ones this document is the right place for.
