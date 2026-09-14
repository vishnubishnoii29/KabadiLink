import logging
from typing import Any, Dict, List, Optional

from backend.auth import generate_otp_code
from backend.helpers import api_error, audit
from backend.services.notifications import notify
from backend.services.payments import record_transaction

logger = logging.getLogger("kabadilink.services.handover")


def _get_handover(conn: Any, lot_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM handovers WHERE lot_id = %s;", (lot_id,))
        row = cur.fetchone()
    if not row:
        api_error(404, "HANDOVER_NOT_FOUND", "No handover exists for this lot yet — accept an offer first")
    return row


def get_handover(conn: Any, lot_id: str) -> Dict[str, Any]:
    handover = dict(_get_handover(conn, lot_id))
    transaction = None
    if handover.get("transaction_id"):
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transactions WHERE id = %s;", (handover["transaction_id"],))
            transaction = cur.fetchone()
    handover["transaction"] = dict(transaction) if transaction else None
    return handover


def generate_otp(conn: Any, lot_id: str, acting_user_id: str) -> Dict[str, Any]:
    handover = _get_handover(conn, lot_id)
    otp_code = generate_otp_code()

    with conn.cursor() as cur:
        cur.execute("UPDATE handovers SET otp_code = %s WHERE id = %s;", (otp_code, handover["id"]))

    audit(conn, acting_user_id, "HANDOVER_OTP_GENERATED", "handovers", str(handover["id"]), metadata={"lot_id": str(lot_id)})
    return {"otp_code": otp_code}


def verify_otp(conn: Any, lot_id: str, code: str, acting_user_id: str, actual_weight_kg: Optional[float] = None) -> Dict[str, Any]:
    handover = _get_handover(conn, lot_id)

    if not handover["otp_code"] or handover["otp_code"] != code:
        api_error(400, "INVALID_OTP", "Invalid handover OTP code")

    fields = ["otp_verified_at = NOW()"]
    params: List[Any] = []
    if actual_weight_kg is not None:
        fields.append("actual_weight_kg = %s")
        params.append(actual_weight_kg)
    params.append(handover["id"])

    with conn.cursor() as cur:
        cur.execute(f"UPDATE handovers SET {', '.join(fields)} WHERE id = %s RETURNING *;", params)
        updated = cur.fetchone()

    audit(conn, acting_user_id, "HANDOVER_OTP_VERIFIED", "handovers", str(handover["id"]), metadata={"lot_id": str(lot_id)})
    return {"ok": True, "handover": dict(updated)}


def stage_offline(conn: Any, lot_id: str, acting_user_id: str, actual_weight_kg: float) -> Dict[str, Any]:
    """Offline mode: stage handover intent locally; full completion still requires server OTP verification."""
    handover = _get_handover(conn, lot_id)

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE handovers SET status = 'READY_TO_VERIFY', actual_weight_kg = %s WHERE id = %s RETURNING *;",
            (actual_weight_kg, handover["id"]),
        )
        updated = cur.fetchone()

    audit(conn, acting_user_id, "HANDOVER_STAGED_OFFLINE", "handovers", str(handover["id"]), metadata={"lot_id": str(lot_id)})
    return {"status": updated["status"]}


def update_status(conn: Any, lot_id: str, status: str, acting_user_id: str) -> Dict[str, Any]:
    if status not in ("EN_ROUTE", "COMPLETED"):
        api_error(400, "INVALID_STATUS", "status must be EN_ROUTE or COMPLETED")

    handover = _get_handover(conn, lot_id)
    with conn.cursor() as cur:
        cur.execute("UPDATE handovers SET status = %s WHERE id = %s RETURNING *;", (status, handover["id"]))
        updated = cur.fetchone()

    audit(conn, acting_user_id, "HANDOVER_STATUS_UPDATED", "handovers", str(handover["id"]), metadata={"status": status})
    return dict(updated)


def record_payment(conn: Any, lot_id: str, acting_user_id: str, amount: float, method: str) -> Dict[str, Any]:
    handover = _get_handover(conn, lot_id)

    # Safe Handover (00-master-plan.md): identity must be OTP-verified before the transaction
    # that completes the handover is recorded.
    if not handover["otp_verified_at"]:
        api_error(400, "OTP_NOT_VERIFIED", "Handover OTP must be verified before payment can be recorded")
    # transactions is the single canonical source of truth for payments (00-master-plan.md) —
    # a second call must not create a second row and orphan the first payment.
    if handover["transaction_id"]:
        api_error(400, "PAYMENT_ALREADY_RECORDED", "A payment has already been recorded for this handover")

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT o.id, c.user_id AS collector_user_id, r.user_id AS recycler_user_id
            FROM offers o
            JOIN lots l ON l.id = o.lot_id
            JOIN collectors c ON c.id = l.collector_id
            JOIN recyclers r ON r.id = o.recycler_id
            WHERE o.lot_id = %s AND o.status = 'ACCEPTED'
            ORDER BY o.created_at DESC LIMIT 1;
            """,
            (lot_id,),
        )
        offer = cur.fetchone()
    offer_id = offer["id"] if offer else None

    transaction = record_transaction(conn, lot_id, offer_id, amount, method, acting_user_id)

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE handovers SET transaction_id = %s, status = 'COMPLETED' WHERE id = %s;",
            (transaction["id"], handover["id"]),
        )
        cur.execute("UPDATE lots SET status = 'COMPLETED' WHERE id = %s;", (lot_id,))

    audit(conn, acting_user_id, "HANDOVER_COMPLETED", "handovers", str(handover["id"]), metadata={"transaction_id": transaction["id"]})

    if offer:
        for party_user_id in (offer["collector_user_id"], offer["recycler_user_id"]):
            notify(conn, party_user_id, "payment_recorded", {"lot_id": str(lot_id), "amount": amount, "method": method})
            notify(conn, party_user_id, "handover_completed", {"lot_id": str(lot_id), "transaction_id": transaction["id"]})

    return transaction


def get_passport(conn: Any, lot_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT l.*, m.code AS material_code, m.name_en AS material_name FROM lots l "
            "LEFT JOIN materials m ON m.id = l.material_id WHERE l.id = %s;",
            (lot_id,),
        )
        lot = cur.fetchone()
        if not lot:
            api_error(404, "LOT_NOT_FOUND", "Lot not found")

        cur.execute("SELECT * FROM offers WHERE lot_id = %s ORDER BY created_at ASC;", (lot_id,))
        offers = cur.fetchall()

        cur.execute("SELECT * FROM handovers WHERE lot_id = %s;", (lot_id,))
        handover = cur.fetchone()

        transaction = None
        if handover and handover.get("transaction_id"):
            cur.execute("SELECT * FROM transactions WHERE id = %s;", (handover["transaction_id"],))
            transaction = cur.fetchone()

    return {
        "lot": dict(lot),
        "offers": [dict(o) for o in offers],
        "handover": dict(handover) if handover else None,
        "payment": dict(transaction) if transaction else None,
    }
