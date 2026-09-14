import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import requests

from backend.config import settings
from backend.db import get_db_connection
from backend.helpers import audit
from backend.services.classification import classify_photo, REASONING_TEMPLATES
from backend.services.lots import create_lot_manual
from backend.services.pricing import estimate_fair_price
from backend.services.offers import accept_offer, create_counter_offer
from backend.services.handover import generate_otp as handover_generate_otp

logger = logging.getLogger("kabadilink.services.whatsapp")

# In-memory session cache fallback when Redis is offline
# Structure: {phone: {"state": str, "data": dict, "updated_at": float}}
_MEM_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 1800  # 30 minutes per 06-whatsapp-bot.md

# Rate limit cache: {phone: [timestamp, ...]}
_RATE_LIMITS: Dict[str, List[float]] = {}
RATE_LIMIT_MAX = 30  # Max 30 messages per minute
RATE_LIMIT_WINDOW = 60.0

# Supported material aliases for conversational matching
MATERIAL_ALIASES = {
    "pcb": "PCB", "circuit": "PCB", "board": "PCB", "motherboard": "PCB",
    "battery": "BATTERY", "cell": "BATTERY", "lithium": "BATTERY",
    "cable": "CABLE", "wire": "CABLE", "copper": "CABLE",
    "lcd": "LCD", "screen": "LCD", "display": "LCD",
    "crt": "CRT", "monitor": "CRT", "tube": "CRT",
    "motor": "MOTOR", "pump": "MOTOR",
    "magnet": "MAGNET",
    "plastic": "PLASTIC", "body": "PLASTIC", "casing": "PLASTIC",
    "other": "OTHER", "mixed": "OTHER", "scrap": "OTHER"
}


def _get_redis_client():
    """Returns a connected Redis client if reachable, else None."""
    try:
        import redis
        client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.5)
        client.ping()
        return client
    except Exception:
        return None


def get_session(phone: str) -> Dict[str, Any]:
    """Retrieves conversation state and contextual data for a given phone number."""
    r = _get_redis_client()
    if r:
        try:
            val = r.get(f"wa_session:{phone}")
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")

    # In-memory fallback
    now = time.time()
    session = _MEM_SESSIONS.get(phone)
    if session and (now - session["updated_at"] < SESSION_TTL_SECONDS):
        return session["data"]
    
    # Default IDLE state
    new_data = {"state": "IDLE"}
    _MEM_SESSIONS[phone] = {"state": "IDLE", "data": new_data, "updated_at": now}
    return new_data


def set_session(phone: str, data: Dict[str, Any]) -> None:
    """Saves conversation state with 30-minute TTL."""
    r = _get_redis_client()
    if r:
        try:
            r.setex(f"wa_session:{phone}", SESSION_TTL_SECONDS, json.dumps(data))
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")

    _MEM_SESSIONS[phone] = {"state": data.get("state", "IDLE"), "data": data, "updated_at": time.time()}


def clear_session(phone: str) -> None:
    """Resets conversation state to IDLE."""
    r = _get_redis_client()
    if r:
        try:
            r.delete(f"wa_session:{phone}")
        except Exception:
            pass
    _MEM_SESSIONS.pop(phone, None)


def check_rate_limit(phone: str) -> bool:
    """Returns True if within rate limit, False if rate limited."""
    now = time.time()
    timestamps = _RATE_LIMITS.get(phone, [])
    # Filter within sliding window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(timestamps) >= RATE_LIMIT_MAX:
        return False
    timestamps.append(now)
    _RATE_LIMITS[phone] = timestamps
    return True


def get_or_create_collector_user(conn: Any, phone: str) -> Tuple[str, str]:
    """
    Finds or registers a user and collector profile mapped to the phone number.
    Returns (user_id, collector_id).
    """
    with conn.cursor() as cur:
        cur.execute("SELECT id, role FROM users WHERE phone = %s;", (phone,))
        user = cur.fetchone()
        if not user:
            cur.execute(
                """
                INSERT INTO users (phone, role, preferred_language, is_adult)
                VALUES (%s, 'COLLECTOR', 'en', true)
                RETURNING id;
                """,
                (phone,)
            )
            user_id = str(cur.fetchone()["id"])
            cur.execute(
                """
                INSERT INTO collectors (user_id, name)
                VALUES (%s, %s)
                RETURNING id;
                """,
                (user_id, f"WA-Collector-{phone[-4:]}")
            )
            collector_id = str(cur.fetchone()["id"])
            audit(conn, user_id, "WA_USER_AUTOREGISTERED", "users", user_id, metadata={"phone": phone})
            return user_id, collector_id

        user_id = str(user["id"])
        cur.execute("SELECT id FROM collectors WHERE user_id = %s;", (user_id,))
        collector = cur.fetchone()
        if not collector:
            cur.execute(
                """
                INSERT INTO collectors (user_id, name)
                VALUES (%s, %s)
                RETURNING id;
                """,
                (user_id, f"WA-Collector-{phone[-4:]}")
            )
            collector_id = str(cur.fetchone()["id"])
        else:
            collector_id = str(collector["id"])

        return user_id, collector_id


def send_whatsapp_message(to_phone: str, text: str) -> bool:
    """
    Dispatches outbound message via Meta WhatsApp Cloud API.
    In local development / demo without credentials, logs to server-side dev log.
    """
    token = settings.WHATSAPP_ACCESS_TOKEN
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID

    if not token or not phone_id:
        logger.info(f"[WHATSAPP OUTBOUND (DEV_LOG)] To: {to_phone} | Message: {text}")
        return True

    url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": text}
    }
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=5.0)
        if res.status_code >= 400:
            logger.error(f"WhatsApp Meta API error: {res.status_code} - {res.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Failed to post to WhatsApp Meta API: {e}")
        return False


def handle_standing_command(conn: Any, phone: str, user_id: str, text: str) -> Optional[str]:
    """
    Executes standing commands available from any state:
    - 'status <lot_code>'
    - 'accept <offer_id>'
    - 'counter <offer_id> <price>'
    - 'otp <lot_code>'
    - 'help'
    - 'login' / 'otp'
    """
    cleaned = text.strip().lower()

    # 1. HELP
    if cleaned in ("help", "menu", "?"):
        return (
            "🤖 *KabadiLink Bot Commands*:\n\n"
            "• *sell* — Start listing e-waste\n"
            "• *status <lot_code>* — Check offers and progress\n"
            "• *accept <offer_id>* — Accept an offer\n"
            "• *counter <offer_id> <price>* — Send counter-offer\n"
            "• *otp <lot_code>* — View handover code\n"
            "• *login* — Request login OTP for web/app\n"
            "• *cancel* — Reset conversation"
        )

    # 2. LOGIN / OTP REQUEST (Web/Mobile delivery path)
    if cleaned in ("login", "otp"):
        with conn.cursor() as cur:
            from backend.auth import create_and_store_otp
            code = create_and_store_otp(conn, phone, user_id=user_id, channel="WHATSAPP")
        return f"🔐 Your KabadiLink login code is: *{code}*. Enter this code in your browser or app to sign in. It expires in 10 minutes."

    # 3. CANCEL
    if cleaned in ("cancel", "stop", "reset"):
        clear_session(phone)
        return "Conversation reset. Text *sell* whenever you're ready to list scrap."

    # 4. STATUS <lot_code>
    if cleaned.startswith("status"):
        parts = text.strip().split()
        if len(parts) < 2:
            return "Please provide the lot code: e.g. *status KL-LOT-000001*"
        lot_code = parts[1].strip().upper()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT l.id, l.lot_code, l.status, l.weight_kg, m.name_en AS material_name
                FROM lots l
                LEFT JOIN materials m ON m.id = l.material_id
                JOIN collectors c ON c.id = l.collector_id
                WHERE (l.lot_code = %s OR l.id::text = %s) AND c.user_id = %s;
                """,
                (lot_code, lot_code, user_id)
            )
            lot = cur.fetchone()
            if not lot:
                return f"No lot found with code {lot_code} registered to your phone."

            lot_id = str(lot["id"])
            # Query offers
            cur.execute(
                """
                SELECT o.id, o.price, o.status, r.name AS recycler_name
                FROM offers o
                JOIN recyclers r ON r.id = o.recycler_id
                WHERE o.lot_id = %s
                ORDER BY o.created_at DESC LIMIT 5;
                """,
                (lot_id,)
            )
            offers = cur.fetchall()

            # Query handover
            cur.execute("SELECT status, otp_code FROM handovers WHERE lot_id = %s;", (lot_id,))
            handover = cur.fetchone()

        msg = [f"📦 *Lot {lot['lot_code']}*"]
        msg.append(f"• Material: {lot['material_name'] or 'Unclassified'}")
        msg.append(f"• Weight: {lot['weight_kg']} kg")
        msg.append(f"• Lot Status: *{lot['status']}*")

        if handover:
            msg.append(f"• Handover Status: *{handover['status']}*")
            if handover["otp_code"]:
                msg.append(f"• Handover OTP: *{handover['otp_code']}*")

        if offers:
            msg.append("\n*Offers:*")
            for off in offers:
                msg.append(f"- Offer #{off['id']} by {off['recycler_name']}: ₹{off['price']:.2f} ({off['status']})")
            msg.append("\nTo accept an offer, reply: *accept <offer_id>*")
            msg.append("To counter, reply: *counter <offer_id> <new_price>*")
        else:
            msg.append("\nNo offers received yet. Recyclers in your area are being notified.")

        return "\n".join(msg)

    # 5. ACCEPT <offer_id>
    if cleaned.startswith("accept"):
        parts = text.strip().split()
        if len(parts) < 2 or not parts[1].isdigit():
            return "Please specify the offer ID: e.g. *accept 12*"
        offer_id = int(parts[1])
        try:
            accept_offer(conn, offer_id, acting_user_id=user_id)
            # Find lot_id to generate OTP
            with conn.cursor() as cur:
                cur.execute("SELECT lot_id FROM offers WHERE id = %s;", (offer_id,))
                row = cur.fetchone()
                lot_id = str(row["lot_id"])
            otp_res = handover_generate_otp(conn, lot_id, acting_user_id=user_id)
            return (
                f"✅ Offer #{offer_id} accepted!\n\n"
                f"Handover is scheduled. When the recycler arrives for pickup, share this OTP to complete handover:\n"
                f"🔑 OTP: *{otp_res['otp_code']}*"
            )
        except Exception as e:
            return f"❌ Could not accept offer #{offer_id}: {str(e)}"

    # 6. COUNTER <offer_id> <price>
    if cleaned.startswith("counter"):
        parts = text.strip().split()
        if len(parts) < 3:
            return "Format: *counter <offer_id> <price>*\nExample: *counter 12 450*"
        if not parts[1].isdigit():
            return "Invalid offer ID."
        try:
            offer_id = int(parts[1])
            new_price = float(parts[2])
            res = create_counter_offer(conn, offer_id, new_price, acting_user_id=user_id)
            return f"🤝 Counter-offer of ₹{new_price:.2f} sent to recycler for Offer #{offer_id}."
        except Exception as e:
            return f"❌ Could not send counter-offer: {str(e)}"

    # 7. OTP <lot_code>
    if cleaned.startswith("otp"):
        parts = text.strip().split()
        if len(parts) < 2:
            return "Please provide the lot code: e.g. *otp KL-LOT-000001*"
        lot_code = parts[1].strip().upper()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT h.otp_code, h.status
                FROM handovers h
                JOIN lots l ON l.id = h.lot_id
                JOIN collectors c ON c.id = l.collector_id
                WHERE (l.lot_code = %s OR l.id::text = %s) AND c.user_id = %s;
                """,
                (lot_code, lot_code, user_id)
            )
            row = cur.fetchone()
        if not row or not row["otp_code"]:
            return f"No active handover OTP found for {lot_code}."
        return f"🔑 Handover OTP for {lot_code}: *{row['otp_code']}* (Status: {row['status']})"

    return None


def process_incoming_message(
    phone: str,
    text: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    image_url: Optional[str] = None
) -> str:
    """
    Main state machine driver for WhatsApp collector-initiated flow.
    Returns the reply string dispatched to the user.
    """
    if not check_rate_limit(phone):
        return "⚠️ You are sending messages too quickly. Please wait a moment."

    # Check static standing commands that don't need a database connection
    if text:
        cleaned_quick = text.strip().lower()
        if cleaned_quick in ("help", "menu", "?"):
            reply = (
                "🤖 *KabadiLink Bot Commands*:\n\n"
                "• *sell* — Start listing e-waste\n"
                "• *status <lot_code>* — Check offers and progress\n"
                "• *accept <offer_id>* — Accept an offer\n"
                "• *counter <offer_id> <price>* — Send counter-offer\n"
                "• *otp <lot_code>* — View handover code\n"
                "• *login* — Request login OTP for web/app\n"
                "• *cancel* — Reset conversation"
            )
            send_whatsapp_message(phone, reply)
            return reply
        if cleaned_quick in ("cancel", "stop", "reset"):
            clear_session(phone)
            reply = "Conversation reset. Text *sell* whenever you're ready to list scrap."
            send_whatsapp_message(phone, reply)
            return reply

    try:
        with get_db_connection() as conn:
            user_id, collector_id = get_or_create_collector_user(conn, phone)

            # Audit log the inbound message type (not full text to preserve privacy)
            audit(
                conn, user_id, "WHATSAPP_MESSAGE_RECEIVED", "whatsapp_conversation", phone,
                metadata={"has_image": image_bytes is not None or image_url is not None}
            )

            # Check remaining standing commands requiring DB
            if text:
                cmd_reply = handle_standing_command(conn, phone, user_id, text)
                if cmd_reply:
                    send_whatsapp_message(phone, cmd_reply)
                    return cmd_reply

            session = get_session(phone)
            current_state = session.get("state", "IDLE")
    except Exception as e:
        logger.error(f"Database error in WhatsApp message handler: {e}")
        return "⚠️ Service is temporarily offline. Please verify database connection and try again."

        # -------------------------------------------------------------
        # STATE 1: IDLE
        # -------------------------------------------------------------
        if current_state == "IDLE":
            session = {"state": "ASK_PHOTO"}
            set_session(phone, session)
            reply = (
                "👋 Welcome to *KabadiLink*!\n\n"
                "Please send a clear *photo* of the scrap items you wish to sell.\n"
                "(Or reply with the material name if you cannot take a photo, e.g. *pcb*, *battery*, *cables*)."
            )
            send_whatsapp_message(phone, reply)
            return reply

        # -------------------------------------------------------------
        # STATE 2: ASK_PHOTO
        # -------------------------------------------------------------
        elif current_state == "ASK_PHOTO":
            if image_bytes:
                # Run multi-item detection & classification
                detections = classify_photo(image_bytes)
                primary = detections[0] if detections else {"material": "OTHER", "confidence": 0.5}
                mat_code = primary.get("material", "OTHER")
                conf_pct = int(primary.get("confidence", 0.5) * 100)

                session = {
                    "state": "CONFIRM_MATERIAL",
                    "material_code": mat_code,
                    "confidence": primary.get("confidence", 0.5),
                    "image_url": image_url or "uploaded_via_whatsapp",
                    "detections": detections
                }
                set_session(phone, session)

                reply = (
                    f"🔍 AI detected: *{mat_code}* ({conf_pct}% confidence).\n"
                    f"_{REASONING_TEMPLATES.get(mat_code, '')}_\n\n"
                    f"Is this correct? Reply *yes* to proceed, or reply with the correct material (e.g. *pcb*, *battery*, *cables*)."
                )
                send_whatsapp_message(phone, reply)
                return reply
            elif text:
                # User sent text fallback instead of photo
                matched_mat = None
                for word in re.findall(r"\w+", text.lower()):
                    if word in MATERIAL_ALIASES:
                        matched_mat = MATERIAL_ALIASES[word]
                        break
                mat_code = matched_mat or "OTHER"
                session = {
                    "state": "ASK_WEIGHT",
                    "material_code": mat_code,
                    "confidence": 1.0,
                    "image_url": None
                }
                set_session(phone, session)
                reply = f"Selected material: *{mat_code}*.\n\nPlease enter the approximate *weight in kg* (e.g. *5.5* or *12*):"
                send_whatsapp_message(phone, reply)
                return reply
            else:
                reply = "Please send a photo or reply with the scrap material name to continue."
                send_whatsapp_message(phone, reply)
                return reply

        # -------------------------------------------------------------
        # STATE 3: CONFIRM_MATERIAL
        # -------------------------------------------------------------
        elif current_state == "CONFIRM_MATERIAL":
            cleaned = (text or "").strip().lower()
            if cleaned in ("yes", "y", "correct", "ha", "haan", "sahi"):
                session["state"] = "ASK_WEIGHT"
                set_session(phone, session)
                reply = f"Great! Please enter the approximate *weight in kg* (e.g. *2.5* or *10*):"
                send_whatsapp_message(phone, reply)
                return reply
            else:
                # Check if user typed an alternative material
                matched_mat = None
                for word in re.findall(r"\w+", cleaned):
                    if word in MATERIAL_ALIASES:
                        matched_mat = MATERIAL_ALIASES[word]
                        break
                if matched_mat:
                    session["material_code"] = matched_mat
                    session["state"] = "ASK_WEIGHT"
                    set_session(phone, session)
                    reply = f"Updated material to *{matched_mat}*.\n\nPlease enter the approximate *weight in kg*:"
                    send_whatsapp_message(phone, reply)
                    return reply
                else:
                    reply = (
                        "Could not recognize that material. Reply *yes* to confirm "
                        f"*{session.get('material_code')}*, or enter one of: *pcb*, *battery*, *cables*, *lcd*, *motors*, *plastic*."
                    )
                    send_whatsapp_message(phone, reply)
                    return reply

        # -------------------------------------------------------------
        # STATE 4: ASK_WEIGHT
        # -------------------------------------------------------------
        elif current_state == "ASK_WEIGHT":
            # Extract number from message
            match = re.search(r"(\d+(?:\.\d+)?)", text or "")
            if not match:
                reply = "Please send a valid number for the weight in kilograms (e.g. *4.5* or *10*):"
                send_whatsapp_message(phone, reply)
                return reply

            weight_kg = float(match.group(1))
            if weight_kg <= 0 or weight_kg > 10000:
                reply = "Please enter a realistic weight between 0.1 kg and 10,000 kg."
                send_whatsapp_message(phone, reply)
                return reply

            session["weight_kg"] = weight_kg

            # Look up material_id
            mat_code = session.get("material_code", "OTHER")
            with conn.cursor() as cur:
                cur.execute("SELECT id, name_en FROM materials WHERE code = %s;", (mat_code,))
                mat_row = cur.fetchone()
                material_id = mat_row["id"] if mat_row else 9

            estimate = estimate_fair_price(conn, material_id, weight_kg)
            session["estimate"] = estimate
            session["material_id"] = material_id
            session["state"] = "SHOW_PRICE"
            set_session(phone, session)

            reply = (
                f"⚖️ *Estimated Fair Price* for {weight_kg} kg of {mat_code}:\n"
                f"💰 *₹{estimate['min']:.0f} – ₹{estimate['max']:.0f}* (Median: ₹{estimate['median']:.0f})\n"
                f"• Confidence: *{estimate['confidence'].upper()}*\n"
                f"• Explanation: {estimate['explanation']}\n\n"
                f"Would you like to list this lot on the marketplace? Reply *yes* to create lot, or *no* to cancel."
            )
            send_whatsapp_message(phone, reply)
            return reply

        # -------------------------------------------------------------
        # STATE 5: SHOW_PRICE / ASK_CONFIRM_LOT
        # -------------------------------------------------------------
        elif current_state in ("SHOW_PRICE", "ASK_CONFIRM_LOT"):
            cleaned = (text or "").strip().lower()
            if cleaned in ("yes", "y", "create", "list", "ok", "haan"):
                # Call canonical services.lots.create_lot
                mat_code = session.get("material_code", "OTHER")
                material_id = session.get("material_id", 9)
                weight_kg = session.get("weight_kg", 1.0)
                image_url = session.get("image_url")

                lot = create_lot_manual(
                    conn=conn,
                    collector_id=collector_id,
                    acting_user_id=user_id,
                    material_code=mat_code,
                    weight_kg=weight_kg,
                    condition="fair",
                    photo_url=image_url,
                    lat=None,
                    lon=None
                )

                lot_code = lot.get("lot_code", str(lot["id"]))
                clear_session(phone)

                reply = (
                    f"🎉 *Lot Created Successfully!*\n\n"
                    f"• Lot ID: *{lot_code}*\n"
                    f"• Material: {mat_code}\n"
                    f"• Weight: {weight_kg} kg\n\n"
                    f"Authorized recyclers in your area are now viewing this lot. "
                    f"When offers arrive, check status anytime by messaging:\n"
                    f"👉 *status {lot_code}*"
                )
                send_whatsapp_message(phone, reply)
                return reply
            else:
                clear_session(phone)
                reply = "Lot listing cancelled. Text *sell* whenever you'd like to list another lot."
                send_whatsapp_message(phone, reply)
                return reply

        else:
            clear_session(phone)
            reply = "Session refreshed. Text *sell* to list your scrap."
            send_whatsapp_message(phone, reply)
            return reply
