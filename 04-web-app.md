# KabadiLink — Web App Spec (04 of 9)

Existing stack: React + Vite, role-scoped areas (`CollectorApp.jsx`, `RecyclerApp.jsx`,
`AdminApp.jsx`, `Login.jsx`, existing `api.js`, `auth.jsx`, `i18n.jsx`). Extend these, don't
replace the structure. Web is primarily for recyclers and admins per the architecture doc
(laptop-oriented dashboards); collector-facing screens here matter less than mobile/WhatsApp
but should still work.

All screens call the endpoints in `02-backend-api.md` via `web/src/api.js` — add one function
per new endpoint there, following the existing pattern.

---

## Login / Auth (`Login.jsx`)
- Add an OTP tab alongside the existing password login.
- OTP request → show a "code sent" state; in dev/demo mode, also show the code directly on
  screen (reads from the `DEV_LOG` response) so the team can log in without needing real
  email/WhatsApp delivery wired up yet.

## CollectorApp.jsx (extend)
- **Sell-scrap wizard**: after photo upload, show the multi-item detection result — one card
  per detected item with a bounding-box crop, material guess, confidence. If any item is
  `needs_confirmation`, show an inline confirm/correct control before proceeding (AI Confidence
  & Verification). Collector then enters the weight for each item (weight is entered manually by the user,
  never estimated by AI).
- **Smart Lot Management step**: after detection and weight entry, offer "Sell as separate lots" vs. "Sell as
  one combined lot" — calls `POST /lots/from-photo` with the chosen mode and user-entered weights.
- **Price estimate display**: show the explanation text and confidence badge next to the
  number, not just the number (Explainable Fair Price).
- **Offers list**: show incoming offers with Accept / Reject / Counter buttons. Counter opens a
  price input, posts to `/offers/{id}/counter`.
- **Handover screen**: show OTP to give the recycler (or QR to scan), a "mark en route/complete"
  toggle if applicable, and a payment-method selector (cash/digital) with a confirm button.
- **Dispute button**: visible once handover is COMPLETED or DISPUTED — opens a form (type,
  description, optional photo) posting to `/lots/{id}/disputes`.
- **Scrap Passport view**: full existing view, extended with the new fields (offers history,
  payment, pickup status).
- **EPR-Ready Handover Record download** button, visible once a handover completes and payment is confirmed — links to
  `/lots/{id}/epr-record` (or alias `/lots/{id}/epr-certificate`) to download the record formatted for CPCB Form-2 filing support.
- **Earnings tracker**: extend existing view to show payment method (cash/digital) per
  transaction, reading from the canonical `transactions` table, not just amount.
- **Notifications bell**: polls `/notifications` for database-queued in-app notifications, shows unread count.

## RecyclerApp.jsx (extend)
- **Self-service settings panel**: edit `materials_accepted`, `pickup_available`,
  `service_area_km` directly — wire to `PUT /recyclers/{id}`.
- **Verification-doc upload**: a simple file-upload form posting to
  `/recyclers/{id}/verification-docs`, showing current status (PENDING/APPROVED/REJECTED).
- **Marketplace / offers screen**: existing lot-browsing view, extended with a Counter button
  next to each offer's status, and anomaly warnings shown inline (existing feature, keep).
- **Pickups screen**: extend with the Pickup Tracking states and the handover
  confirm-OTP/payment-confirm flow (recycler side of the same handover endpoints collector uses).

## AdminApp.jsx (extend)
- **Verification queue**: extend to actually render the uploaded document (image/PDF preview),
  not just a status toggle — Approve/Reject buttons call
  `/admin/verification-docs/{id}/review`.
- **Dispute review panel** (new tab): list from `GET /disputes`, detail view with resolve
  action.
- **Impact dashboard** (new tab): charts for total weight diverted, income-uplift %, hazardous
  practices avoided, from `/admin/impact-summary`. **Do not** display precise critical-mineral
  quantities unless real conversion-factor data backs them — show weight/transaction-count
  metrics prominently, mineral estimates only as a clearly-labeled rough figure if included at
  all.
- **Dataset export** (new tab): a button that calls `POST /admin/dataset-export`, polls
  `GET /admin/dataset-export/{id}` for status, shows a download link when ready.
- **Audit log viewer**: extend existing view with the `ai_source` column so admins/judges can
  see which AI path was used per decision.

## Cross-cutting
- Every price/material/anomaly result rendered anywhere in the web app must show its
  `confidence` and, on hover or expand, its `reasoning` — this is the explanation contract
  surfaced in the UI, not just returned by the API.
- Tri-lingual strings for every new piece of UI text go through the existing `i18n.jsx` pattern
  — don't hardcode English strings in new components.
