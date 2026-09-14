# KabadiLink — Final Feature List (consolidated)

Synthesized from: the original feature list, four competing repos researched for this same
SIH problem statement (26229) — including your teammate's own prototype and
`Prabhnoor106/KabadiwalaConnect` — external review feedback, the official problem statement's
explicit requirements, and a full pass on real-world budget constraints. This version
supersedes all earlier drafts.

---

## Tier 1 — MUST-HAVE (table stakes — build all of these, no exceptions)

These are either already in the base repo, things at least one competitor already has, or
explicit requirements in the official problem statement — skipping any of them risks looking
*behind* the pack or missing a mandatory requirement, not being ahead of it.

**Core marketplace**
- Role-based auth: collector / recycler / admin, JWT sessions — plus an **OTP login option**.
  OTP delivery stays zero-cost: log the OTP server-side for development/demo (a competitor's
  repo already does exactly this), or deliver it by email (free-tier transactional email) or
  as a WhatsApp reply (free, since the collector messages first). No paid SMS gateway.
- Snap & Estimate — photo → material identification + condition → user-entered weight → estimated value
  (weight is explicitly entered by the user; photo AI only predicts material and condition)
- Smart Lot Management — split a multi-item photo into material-specific lots, or sell as one
  combined lot with user-confirmed weights. Not optional once Multi-item Detection exists — detecting several items in one
  photo needs somewhere to go
- Fair Price Intelligence & Prediction — observed local price range + recent recycler offers +
  historical transactions + material/weight/location/condition, always shown with a confidence
  level and a plain-language explanation of why the number is what it is (which material,
  which condition, which comparable offers) — not a bare figure
- Smart Recycler Matching — price, distance, authorization, pickup availability, reliability,
  hard-filtered to recyclers actually equipped for the detected material (**already
  implemented** — `match_recyclers()` in the base repo already excludes incompatible recyclers
  before scoring; verify it survives the router refactor, don't rebuild it)
- Multiple Offers with Counter-offer — one lot, competing offers from several recyclers;
  collector can accept, reject, or counter any offer, not just take-it-or-leave-it
- AI Confidence & Verification — every AI-assisted decision shows its confidence; below a
  stated threshold, the app asks the collector to confirm rather than presenting the AI as
  always right
- Scrap Passport — Lot ID + QR: origin, photo, weight, GPS, timestamp, offers, payment, pickup
  status, and verified handover history in one record
- Pickup Tracking — explicit status states: requested → accepted → collector en route →
  pickup completed → handover verified
- Safe Handover — verified-recycler identity, optional live location sharing, OTP/QR-based
  handover confirmation, and payment confirmation as part of the same step. When offline, handover
  is staged as READY_TO_VERIFY / HANDOVER_PENDING with mutual acknowledgment; official verification and
  completion require server-side OTP confirmation upon reconnecting.
- Handover Dispute Reporting — flag a wrong weight, payment mismatch, damaged material, or
  pickup problem, with photo evidence attached
- Earnings Tracker — records both cash and digital payments, not digital-only (a competitor
  explicitly avoids forcing digital-only payment — most real transactions in this sector are
  still cash, and forcing digital would work against adoption, not for it). Uses the `transactions` table
  as the canonical source of truth for payment records.
- Smart Notifications — offer received/changed, pickup scheduled/approaching, payment
  recorded, handover completed. **In-app notifications via database queue (`/notifications` polling) first**,
  with optional Firebase Cloud Messaging (free) for background push. A WhatsApp-delivered version of these
  is a real per-message cost under Meta's pricing (unlike the free user-initiated reporting flow) — not built now;
  noted in Tier 3 as a future option if there's ever budget for it
- Group Pickup, with basic route ordering so combined pickups are actually efficient
- Safety Guidance — vernacular (Hindi/Marathi) pictorial + audio, by e-waste type
- AI Material Detection — a real trained model, not a lookup/heuristic
- Transaction Anomaly Detection — flags suspicious/lowball price patterns
- AI/ML only where data supports it — when sample size for a material/location is thin, fall
  back to a documented rule-based estimate with a stated low-confidence tier instead of forcing
  a prediction from insufficient data. The price engine already does this — state the principle
  explicitly in the pitch, since the official problem statement specifically tests for
  AI-for-decoration vs. AI actually justified by data
- Recycler self-service — recyclers manage their own buying rates, availability, and pickup
  slots directly (a competitor has this; without it your recycler side looks admin-managed and
  less real)
- Recycler verification-document upload + admin review (not just a status toggle)
- Admin console — verification queue, anomaly review, audit trail, overview
- Voice + visual, low-literacy interface — minimal text, large icons, voice guidance
- Offline-first sync (mobile) — create/update lots offline, queue actions locally, sync
  automatically when connectivity returns. Duplicate/conflict protection is **already
  implemented** (`client_uid` dedup in the pending-ops outbox, per the base repo's README) —
  verify it, don't rebuild it

**Non-negotiable engineering readiness** (not a "feature" a judge clicks, but without these
your "scalable," "real AI," and "deployable" claims don't survive questioning):
- Postgres (not SQLite) in production — **Supabase as primary** (providing both Postgres and
  Supabase Storage for media/docs), with **Neon as a database-only fallback**. Neither expires after 30 days
  (unlike Render's free Postgres).
- A dependency-free `/health` endpoint, plus a scheduled keep-alive ping (GitHub Actions cron
  every 10 minutes, optionally backed up by a free UptimeRobot/cron-job.org monitor). This is
  a best-effort keep-alive; clients must handle potential initial cold starts gracefully with clear loading UI.
- Basic CI (tests run on push), monitoring/error tracking
- At least one load-test result with recorded metrics: concurrency, requests/sec, p50, p95 latency, and error rate
- Clean repo (no committed `node_modules`/db files/logs)
- **Zero real-cost infrastructure by design**: every piece of the stack runs on a genuine free
  tier (free-tier hosting + keep-alive, Supabase primary / Neon fallback, Vercel web, Upstash Redis,
  Gemini's free Flash-tier quota, sandbox-mode payments, no paid SMS or WhatsApp business
  messages). No feature may have a hard dependency on a service whose free availability has not been
  verified immediately before implementation; every external service gets a documented zero-cost fallback.
  The GitHub Student Developer Pack (DigitalOcean and Azure credit, GitHub Pro) is
  claimed and held in reserve as a fallback, not spent unless the free-tier approach genuinely
  fails in testing

**Mandatory validation & data deliverables** (explicit requirements in the official problem
statement, not optional extras — start these in week 1, don't squeeze them in at the end):
- **Field research, phase 1 (need-finding)** — a real conversation with at least two working
  collectors/aggregators, done early enough to actually inform product decisions, not just
  validate ones already made
- **Field research, phase 2 (usability demo)** — a filmed session of one of those same
  collectors/aggregators actually using the working prototype on a real task, friction and all
  — a distinct deliverable from a team-led demo to judges, planned and shot in advance
- **Structured dataset** — a defined schema/data dictionary for what the platform structures
  (materials, prices, transactions, locations, mineral-recovery estimates), plus a real sample
  anonymized export — a data deliverable, not a code feature
- **Unit economics model** — actual numbers: cost per transaction (which is close to ₹0 given
  the free-tier infrastructure above — state that explicitly, it's a strength, not a gap), a
  stated revenue model, collector income-uplift figures with a defensible basis, and a stated
  path to sustainability. Document the cost that *would* apply if any currently-avoided paid
  feature (SMS OTP, WhatsApp business notifications) were switched on later — shows you
  understand the cost structure, not just that you dodged it

---

## Tier 2 — UNIQUE & RARE (the features that actually win this)

Split into what is **mandatory to build deeply** vs. what is **strictly optional/stretch**.
Do not spread effort evenly — the Flagship Five are mandatory differentiators; secondary features
are built strictly if time remains after Tier 1 and Flagship 5 are solid and integrated.

### Flagship five (MANDATORY — build these deeply, make each one judge-testable live)

Chosen by **rarity** — checked against real competing repos for this problem statement, not
guessed. This is your engineering-hours priority list, not the order you demo them in (see the
narrative arc below).

1. **Multi-item detection from one photo** — object detection (bounding box per item), not a
   single-label classifier. Matches how collectors actually hand over mixed piles; almost every
   competing team will assume one-item-per-photo.
2. **Fully on-device AI** (Ultralytics YOLOv8n detector + MobileNetV2 classifier exported to TFLite
   for Flutter mobile, and ONNX for server inference) paired with a cloud verification layer (Gemini) that
   adds reasoning when online. Testable live in airplane mode — a concrete engineering claim,
   not a slide.
3. **EPR-Ready Handover Record / Certificate** — each verified handover produces an auditable
   chain-of-custody record structured per CPCB EPR Form-2 requirements to assist authorized recyclers
   with their regulatory filing (clarifying KabadiLink facilitates compliance records, not acting as the regulatory issuer).
4. **WhatsApp-based lot reporting** — for collectors with no app, or no comfort using one.
   Free to run (user-initiated conversations aren't charged by Meta) — this is the one WhatsApp
   feature that's actually being built; proactive WhatsApp notifications are not (see Tier 1).
5. **One-directional ISL video guidance** — pre-recorded Indian Sign Language clips for safety
   and key workflow steps, for deaf collectors. Two-way sign *recognition* is not reliable
   enough to demo live — don't attempt it. Source the clips by partnering with your college's
   disability-support cell or a local Deaf-education NGO to record a few real ones for free —
   don't reuse existing copyrighted ISL video content from another app or archive.

**Note on Fair Price Intelligence and Scrap Passport**: strong candidates for "flagship" by
narrative feel, but not by rarity — at least two competing repos for this problem statement
already have equivalents (rule-based valuation + live prices; a chain-of-custody receipt).
Build them solidly as Tier 1 must-haves; don't spend flagship-level differentiation effort on
them.

### Demo narrative arc (a different list, for a different purpose)

The five above are where your best engineering hours go. The live demo shouldn't present them
as a disconnected feature dump, though — walk judges through one coherent story that includes
your Tier 1 must-haves too:

**See** (multi-item photo capture) → **Understand** (AI classification + confidence, explained)
→ **Get a fair price** (explainable price + competitive offers, counter if needed) → **Find a
buyer** (compatibility-filtered recycler matching) → **Sell safely** (OTP/QR handover + payment
confirmation) → **Track the waste** (Scrap Passport → EPR-Ready Handover Record)

Your differentiators sit inside this arc at the point they naturally occur — multi-item
detection and on-device AI at "See/Understand," WhatsApp as an alternate path in for collectors
without the app, ISL guidance woven through as accessibility, EPR-Ready Handover Record as the payoff at
"Track the waste" — rather than tacked on at the end as a separate list.

### Secondary Tier 2 — OPTIONAL / STRETCH (build strictly if time remains after Tier 1 and Flagship 5 are solid and integrated)
6. Minimum-age onboarding safeguard — a real integrity signal, trivial to build, kept as a
   small compliance feature rather than a headline one
7. Personal Collector Impact Certificate — reuses data you already have, high demo/emotional value
8. "Scrap or sell?" decision screen — shows scrap value vs. resale value side by side when the
   item looks functional (the in-app, demoable version of reuse-before-recycle)
9. Fraud/duplicate-image detection — perceptual-hash check, near-free once the image pipeline exists
10. Impact Dashboard — tons diverted, income uplift %, hazardous practices avoided. Keep the
    weight/transaction-count metrics solid; don't present precise critical-mineral quantities
    unless you actually have real conversion-factor data behind them — the same "AI/ML only
    where data supports it" principle applied to the dashboard, not just the price engine
11. Battery-specific hazard detection — flags visible swelling/corrosion, a targeted warning
    tied to the actual fire-risk category in this waste stream

---

## Tier 3 — FUTURE ROADMAP (pitch as vision, don't build now)

Genuinely good ideas that lose on time-per-impact right now, or that cost real money the
project doesn't need to spend yet. Mentioning these in your pitch as "what we'd build next"
shows depth without costing build hours or budget you don't have to spare.

- WhatsApp-delivered proactive notifications (pickup approaching, offer received) — real
  per-message cost under Meta's pricing; revisit only if there's ever budget or a sponsor
- EPR Value-Back — producer-funded bounties on hard-to-collect categories (CRTs, old LCDs)
- Green Credit Programme integration — India's real GCP has a Waste Management credit category
  separate from EPR; your verified data could feed both
- Peer/community trust ratings — collector-to-collector ratings on recyclers, on top of admin
  verification; admin verification + transaction history already carries this for the initial
  product, so this is a later addition, not a launch requirement
- Micro-accident insurance partnership for hazardous handling
- Portable financial identity — verified earnings history as future microloan/credit input
- Women SHG-focused onboarding (aligns with missions like DAY-NULM)
- Health-data-informed rollout targeting (prioritize high-pollution-complaint wards)
- Consolidation hub / micro-warehousing logistics model
- AI negotiation coach in the offer/counter-offer flow
- Voice-note lot reporting (speak the item instead of a form)
- "Sell now or wait" price-trend forecasting
- AR-guided safe dismantling (narrow prototype only if ever attempted — 2–3 device types max)
- Photo-based weight estimation (flag as high-risk if ever attempted; don't let a judge test it
  live on an odd-shaped item)
- Full payment gateway integration (UPI/Razorpay) beyond sandbox, and paid always-on hosting
  via the GitHub Student Pack's DigitalOcean/Azure credit — both are reserved fallbacks, not
  needed given the free-tier-plus-keep-alive approach already covers reliability

---

## Note on field research and evidence

Field research is folded into Tier 1's mandatory validation deliverables above, because the
official problem statement makes it with real collectors/aggregators a required part of the
submission, not an extra. Treat it with the same priority as any must-have feature — start it
in week 1.
