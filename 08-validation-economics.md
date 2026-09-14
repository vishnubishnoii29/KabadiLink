# KabadiLink — Validation & Economics (08 of 9)

These are explicit requirements in the official problem statement, not optional extras. This
track is not code — start it in week 1, run it in parallel with everything else, don't leave it
until the app is "ready" (it never fully is, and this needs real time regardless).

---

## Field research, phase 1 — need-finding (week 1, before more product decisions get locked in)

Talk to at least two working collectors/aggregators. Goal: inform decisions, not confirm ones
already made. Sample question areas (adapt in the local language, ideally conducted by a
Hindi/Marathi speaker on the team):
- How do you currently decide what a scrap item is worth? Who do you sell to, and why them?
- What's the biggest frustration in your current process — price, trust, distance, payment
  timing, something else?
- Do you have a smartphone? If not, what phone do you have, and would you use something over
  WhatsApp or SMS instead?
- What happens when a buyer's offer feels unfair? Do you ever push back, or just accept it?
- Would a paper/photo record of a sale matter to you? Why or why not?
- What would make you trust a new buyer you haven't worked with before?

Document: who you spoke to (role, location, rough scale of their work), what you learned, and
specifically what it changed or confirmed about a product decision already made in the feature
list — this last part matters for the submission, not just internal learning.

## Field research, phase 2 — usability demo (after Phase 3 in `00-master-plan.md` completes)

Film one of the same collectors/aggregators actually using the working prototype (or just the
WhatsApp flow, if that's simpler to arrange) on a real task — reporting a real lot, seeing a
real price. Don't script their reactions. Capture friction honestly; a demo that shows you
noticing and responding to a real problem is stronger than one that shows a flawless run.

This is a distinct deliverable from your team-led pitch demo to judges — plan and shoot it in
advance, don't try to improvise it at the venue.

---

## Structured dataset

Implemented in code as `POST /admin/dataset-export` (see `02-backend-api.md`), backed by a
background job (see `00-master-plan.md`'s `jobs/` folder). Concretely:

**Schema/data dictionary** (document this as its own short doc, exported alongside the data):
- `materials`: code, category, name (no PII)
- `transactions_anonymized`: material_code, weight_kg, price_paid, location (ward/city level
  only, not exact GPS), payment_method, timestamp — collector_id and recycler_id replaced with
  non-reversible hashed IDs, not their real IDs
- `lot_photos_metadata` (optional, no images): material detections + confidence + source, no
  actual photo data
- `impact_summary`: aggregated weight diverted, uplift estimates, by time period

**Anonymization approach**: hash user-facing IDs with a salted hash before export (never export
raw `user_id`/`phone`/`name`); round GPS coordinates to a coarse grid or drop to ward/city level;
never include free-text dispute descriptions or photos in the export.

**Export job**: pulls from Postgres, writes a CSV/JSON to object storage, logs the run in
`dataset_exports`. Run it once real transaction data exists (even demo-seeded data counts for
showing the export works, but the submission should include a description of what a real
production-scale export would contain, not just a schema on paper).

---

## Unit economics model

Build this as an actual spreadsheet or structured doc, not a bullet on a slide. Required rows:

**Cost side** (per transaction, and per month at an assumed volume):
| Line item | Cost | Notes |
|---|---|---|
| Hosting (backend, web, DB, Redis) | ₹0 | free tiers, per `07-deployment.md` |
| Cloud AI verification (Gemini) | ₹0 within free-tier quota | note the per-request cost that *would* apply beyond free tier, for the "what happens at scale" question |
| WhatsApp (user-initiated reporting) | ₹0 | free under Meta's pricing |
| WhatsApp (if proactive notifications were ever enabled) | ~₹0.115–0.13/message (utility) | documented but not currently incurred — shows you understand the cost structure even though you avoided it |
| SMS OTP (not used) | N/A | avoided entirely; note why (see `01-database-schema.md`'s `otp_codes.delivery_channel`) |
| Payment gateway (sandbox) | ₹0 | live-mode fees (~2%) noted as a future cost, not incurred now |

**Revenue model** (pick and justify one, or a combination):
- Small commission per completed transaction
- Recycler subscription/premium listing tier
- Value of the structured dataset / EPR-Ready Handover Record data to producers under EPR obligations
  (a real, if longer-term, revenue angle given the CPCB EPR credit trading system — facilitating Form-2 verification)

**Income uplift**: state your basis explicitly — ideally grounded in what phase-1 field
research collectors actually said about current per-kg prices vs. what your fair-price engine's
observed ranges show, rather than an assumed percentage pulled from a competitor's marketing
claim.

**Sustainability path**: one paragraph — who pays, why they keep paying, what happens as usage
grows (does any currently-free piece of infrastructure need to become paid, and at what volume?
Answer this using the actual free-tier limits documented in `07-deployment.md`, not a guess).
