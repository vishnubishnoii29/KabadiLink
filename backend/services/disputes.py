import logging
from typing import Any, Dict, List, Optional

from backend.helpers import api_error, audit

logger = logging.getLogger("kabadilink.services.disputes")


def create_dispute(
    conn: Any,
    lot_id: str,
    reported_by: str,
    dispute_type: str,
    description: str,
    evidence_photo_url: Optional[str] = None,
) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO disputes (lot_id, reported_by, type, description, evidence_photo_url, status)
            VALUES (%s, %s, %s, %s, %s, 'OPEN')
            RETURNING *;
            """,
            (lot_id, reported_by, dispute_type, description, evidence_photo_url),
        )
        dispute = cur.fetchone()

        cur.execute("UPDATE lots SET status = 'DISPUTED' WHERE id = %s;", (lot_id,))
        cur.execute("UPDATE handovers SET status = 'DISPUTED' WHERE lot_id = %s;", (lot_id,))

    audit(conn, reported_by, "DISPUTE_CREATED", "disputes", str(dispute["id"]), metadata={"lot_id": str(lot_id), "type": dispute_type})
    return dict(dispute)


def list_disputes(conn: Any, status: Optional[str] = None) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        if status:
            cur.execute("SELECT * FROM disputes WHERE status = %s ORDER BY created_at DESC;", (status,))
        else:
            cur.execute("SELECT * FROM disputes ORDER BY created_at DESC;")
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def resolve_dispute(conn: Any, dispute_id: int, resolution_note: str, status: str, resolved_by: str) -> Dict[str, Any]:
    if status not in ("RESOLVED", "DISMISSED"):
        api_error(400, "INVALID_STATUS", "status must be RESOLVED or DISMISSED")

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE disputes SET status = %s, resolution_note = %s, resolved_at = NOW()
            WHERE id = %s RETURNING *;
            """,
            (status, resolution_note, dispute_id),
        )
        dispute = cur.fetchone()
        if not dispute:
            api_error(404, "DISPUTE_NOT_FOUND", "Dispute not found")

        cascade_status = "COMPLETED" if status == "RESOLVED" else "CANCELLED"
        cur.execute("UPDATE lots SET status = %s WHERE id = %s;", (cascade_status, dispute["lot_id"]))
        # handovers.status has no CANCELLED value in its CHECK constraint (scripts/schema.sql), so
        # a DISMISSED dispute (lot -> CANCELLED) can't set a matching terminal handover status —
        # leaving it at DISPUTED is the closest honest state ("did not complete") rather than
        # fabricating a COMPLETED/REQUESTED value the schema doesn't support for this outcome.
        # RULING: flagging for a schema decision (add handovers.CANCELLED) rather than guessing.
        if status == "RESOLVED":
            cur.execute("UPDATE handovers SET status = 'COMPLETED' WHERE lot_id = %s;", (dispute["lot_id"],))

    audit(conn, resolved_by, "DISPUTE_RESOLVED", "disputes", str(dispute_id), metadata={"status": status})
    return dict(dispute)
