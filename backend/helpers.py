import json
import logging
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from fastapi import HTTPException

logger = logging.getLogger("kabadilink.helpers")

def audit(
    conn: Any,
    user_id: Optional[str],
    event_type: str,
    entity_type: str,
    entity_id: str,
    ai_source: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Writes an immutable event entry to the audit_log table.
    Feeds both explainability and the EPR certificate chain of custody.
    """
    if metadata is None:
        metadata = {}

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_log (user_id, event_type, entity_type, entity_id, ai_source, metadata_json, created_at)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
                """,
                (
                    user_id,
                    event_type,
                    entity_type,
                    str(entity_id),
                    ai_source,
                    json.dumps(metadata),
                    datetime.now(timezone.utc)
                )
            )
    except Exception as e:
        logger.error(f"Failed to record audit log event {event_type} on {entity_type}:{entity_id}: {e}")
        # Audit logging failure should not crash the primary transaction unless strict compliance is required

def next_lot_id(conn: Any) -> str:
    """
    Generates an atomic, sequential human-readable lot code (format: KL-LOT-XXXXXX).
    Uses PostgreSQL sequence lot_code_seq if present, with graceful fallback.
    """
    with conn.cursor() as cur:
        try:
            cur.execute("SELECT nextval('lot_code_seq') AS val;")
            row = cur.fetchone()
            val = row["val"] if row else 1
            return f"KL-LOT-{val:06d}"
        except Exception:
            conn.rollback()
            cur.execute("SELECT COUNT(*) AS count FROM lots;")
            row = cur.fetchone()
            count = (row["count"] if row else 0) + 1
            return f"KL-LOT-{count:06d}"

def next_record_id(conn: Any) -> str:
    """
    Generates an atomic, sequential EPR-Ready Handover Record ID (format: KL-EPR-XXXXXX).
    Uses PostgreSQL sequence record_id_seq if present, with graceful fallback.
    """
    with conn.cursor() as cur:
        try:
            cur.execute("SELECT nextval('record_id_seq') AS val;")
            row = cur.fetchone()
            val = row["val"] if row else 1
            return f"KL-EPR-{val:06d}"
        except Exception:
            conn.rollback()
            cur.execute("SELECT COUNT(*) AS count FROM epr_handover_records;")
            row = cur.fetchone()
            count = (row["count"] if row else 0) + 1
            return f"KL-EPR-{count:06d}"

def api_error(status_code: int, code: str, message: str) -> None:
    """Standardized error response formatter matching {error: {code, message}}."""
    raise HTTPException(
        status_code=status_code,
        detail={"error": {"code": code, "message": message}}
    )
