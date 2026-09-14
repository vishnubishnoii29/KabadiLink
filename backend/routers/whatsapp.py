import base64
import logging
from typing import Optional
import requests
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from backend.config import settings
from backend.services.whatsapp import process_incoming_message, get_session

logger = logging.getLogger("kabadilink.routers.whatsapp")
router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Conversational Bot"])


class SimulateMessageRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, description="Sender's phone number")
    text: Optional[str] = Field(None, description="Inbound text message")
    image_base64: Optional[str] = Field(None, description="Optional base64-encoded image bytes")
    image_url: Optional[str] = Field(None, description="Optional image URL")


def _download_media(media_id: str) -> Optional[bytes]:
    """Fetches media binary from Meta WhatsApp Cloud API."""
    token = settings.WHATSAPP_ACCESS_TOKEN
    if not token or not media_id:
        return None
    try:
        url = f"https://graph.facebook.com/v19.0/{media_id}"
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(url, headers=headers, timeout=5.0)
        if res.status_code == 200:
            media_url = res.json().get("url")
            if media_url:
                bin_res = requests.get(media_url, headers=headers, timeout=10.0)
                if bin_res.status_code == 200:
                    return bin_res.content
    except Exception as e:
        logger.error(f"Failed to download WhatsApp media {media_id}: {e}")
    return None


def _background_process_meta_payload(payload: dict):
    """Parses Meta Cloud API inbound webhook payload and triggers state machine."""
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])
                for msg in messages:
                    sender = msg.get("from")
                    if not sender:
                        continue

                    msg_type = msg.get("type")
                    text = None
                    image_bytes = None

                    if msg_type == "text":
                        text = msg.get("text", {}).get("body")
                    elif msg_type == "image":
                        media_id = msg.get("image", {}).get("id")
                        image_bytes = _download_media(media_id)
                        text = msg.get("image", {}).get("caption")
                    elif msg_type == "interactive":
                        # Button or list reply
                        interactive = msg.get("interactive", {})
                        if "button_reply" in interactive:
                            text = interactive["button_reply"].get("title")
                        elif "list_reply" in interactive:
                            text = interactive["list_reply"].get("title")

                    process_incoming_message(
                        phone=sender,
                        text=text,
                        image_bytes=image_bytes,
                        image_url=None
                    )
    except Exception as e:
        logger.error(f"Error in background WhatsApp processor: {e}", exc_info=True)


@router.get("/webhook")
def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    """
    Meta Webhook Verification Handshake.
    Must return the hub.challenge integer as plain text when verify token matches.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("Meta WhatsApp webhook verified successfully.")
        return Response(content=hub_challenge or "", media_type="text/plain")

    logger.warning("WhatsApp webhook verification token mismatch.")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification token mismatch"
    )


@router.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Meta WhatsApp Cloud API Inbound Webhook.
    Per 06-whatsapp-bot.md Meta 3-Second Webhook Timeout Protection:
    Returns HTTP 200 within < 500ms immediately, while offloading
    inference and reply dispatch to FastAPI BackgroundTasks.
    """
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Schedule background processing to avoid Meta 3-second timeout
    background_tasks.add_task(_background_process_meta_payload, payload)
    return {"status": "ok"}


@router.post("/simulate")
def simulate_message(payload: SimulateMessageRequest):
    """
    Test & Demo endpoint: Synchronously simulates an inbound WhatsApp message
    and returns the bot's response and conversation state.
    """
    image_bytes = None
    if payload.image_base64:
        try:
            image_bytes = base64.b64decode(payload.image_base64)
        except Exception:
            image_bytes = None

    reply = process_incoming_message(
        phone=payload.phone,
        text=payload.text,
        image_bytes=image_bytes,
        image_url=payload.image_url
    )

    session = get_session(payload.phone)
    return {
        "reply": reply,
        "phone": payload.phone,
        "session_state": session.get("state", "IDLE")
    }
