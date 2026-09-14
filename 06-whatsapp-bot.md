# KabadiLink — WhatsApp Bot Spec (06 of 9)

The one channel-specific rule that matters most: **only the collector-initiated reporting flow
runs here.** Never send a message the user didn't ask for — that's what keeps this channel at
zero cost. No proactive "pickup approaching" pushes over WhatsApp (that's in-app only, see
`02-backend-api.md` notifications section).

---

## Setup (one-time, do this early — it can block testing if left until later)
1. Create a Meta developer app, enable the WhatsApp product, get a test phone number.
2. Register a webhook URL pointing at `POST /whatsapp/webhook` on your deployed backend
   (must be HTTPS — the free-tier deploy in `07-deployment.md` already gives you this).
3. Set the verify token (used in Meta's webhook verification handshake) as an env var,
   `WHATSAPP_VERIFY_TOKEN`.
4. Store the access token as `WHATSAPP_ACCESS_TOKEN` — never commit it.
5. Confirm current setup steps against Meta's own developer docs at build time — webhook
   verification and API versioning details do change.

---

## Conversation state machine

State stored in Redis, keyed by phone number, with a short TTL (e.g. 30 minutes of inactivity
resets the conversation to IDLE). Each state transition is driven by the incoming message text
or a button/list reply if using WhatsApp's interactive message types.

```
IDLE
  → user sends any message / "sell" / "kabadi" →  ASK_PHOTO
ASK_PHOTO
  → user sends a photo → runs detect_and_classify() server-side (same inference.py as the
    rest of the backend) → shows detected item(s) + confidence → CONFIRM_MATERIAL
  → user sends text instead of photo → ASK_MATERIAL_TEXT (fallback path, no photo AI)
CONFIRM_MATERIAL
  → user confirms → ASK_WEIGHT
  → user corrects (replies with a material name) → re-runs price lookup with corrected
    material → ASK_WEIGHT
ASK_WEIGHT
  → user sends a number → calls the same price-estimate service as the API → SHOW_PRICE
SHOW_PRICE
  → shows price range + explanation text (Explainable Fair Price, same contract as everywhere
    else) → asks "create this lot?" → ASK_CONFIRM_LOT
ASK_CONFIRM_LOT
  → yes → calls services.lots.create_lot(...) with a WHATSAPP source tag → LOT_CREATED
  → no → IDLE
LOT_CREATED
  → sends the Lot ID and a note that offers will come through and can be checked by messaging
    "status <lot id>" → IDLE
```

Additional standing commands, available from any state:
- `"status <lot_code>"` → looks up and replies with lot details, current offers (`offer_id`, `recycler_name`, `price`), and handover status
- `"accept <offer_id>"` → accepts the offer, creates handover, generates handover OTP, and replies with the code
- `"counter <offer_id> <price>"` → sends counter-offer to the recycler without leaving WhatsApp
- `"otp <lot_code>"` → retrieves current handover OTP for an accepted lot
- `"help"` → sends a short menu of all bot commands

---

## Identity inside WhatsApp vs. OTP-via-WhatsApp for Web/Mobile

1. **Inside WhatsApp (Zero Login)**:
   The collector interacting with the WhatsApp bot requires **no separate login, password, or OTP**.
   The incoming WhatsApp phone number *is* the identity key mapped directly to `users.phone`.

2. **OTP-via-WhatsApp (Free Delivery Path for Web/Mobile Login)**:
   This flow exists strictly to provide a zero-cost OTP delivery channel for users logging into the **web or mobile app**:
   - User requests OTP on web/mobile and selects WhatsApp delivery.
   - The client renders a direct link `https://wa.me/<BOT_PHONE_NUMBER>?text=LOGIN` so the user initiates the chat with one tap (remaining zero-cost under Meta's pricing).
   - Backend generates an OTP (`services/auth`, stored in `otp_codes` with `delivery_channel = WHATSAPP`) and replies with the 6-digit code in that conversation.
   - User enters that code into the web or mobile app to complete login.
   - Never send an unprompted outbound push over WhatsApp.

---

## Implementation notes
- `routers/whatsapp.py` has exactly one route (`POST /whatsapp/webhook`).
- **Meta 3-Second Webhook Timeout Protection**: Meta's Cloud API requires the webhook to return HTTP 200 within
  3 seconds, or it considers the hook failed and retries repeatedly. To guarantee response times < 500ms:
  - The webhook endpoint verifies the payload and Meta signature, immediately schedules the conversation
    processing task via FastAPI `BackgroundTasks`, and returns `{"status": "ok"}` (HTTP 200).
  - The asynchronous background task handles photo download, inference, Redis conversation state updates,
    and dispatches the reply message to Meta's Cloud API.
- Rate-limit the webhook endpoint (Redis-based, per phone number) to prevent abuse driving up
  accidental costs or hammering the AI endpoints.
- Log every inbound/outbound message type (not full content, to respect privacy) to
  `audit_log` with `entity_type = "whatsapp_conversation"`.
- Test the full flow with Meta's test number before relying on it for the field-research
  usability session — a broken webhook mid-demo is the single easiest thing to avoid by testing
  early.
