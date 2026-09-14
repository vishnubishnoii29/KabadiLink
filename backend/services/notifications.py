import json
import logging
from typing import Any, Dict, List, Optional

from backend.helpers import api_error

logger = logging.getLogger("kabadilink.services.notifications")


def notify(conn: Any, user_id: str, notif_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """In-app notification queue. Called internally by other services — not a public endpoint."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO notifications (user_id, type, payload_json, channel)
            VALUES (%s, %s, %s, 'IN_APP')
            RETURNING *;
            """,
            (user_id, notif_type, json.dumps(payload)),
        )
        row = cur.fetchone()
    return dict(row)


def list_notifications(conn: Any, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT * FROM notifications
            WHERE user_id = %s
            ORDER BY (read_at IS NULL) DESC, created_at DESC
            LIMIT %s OFFSET %s;
            """,
            (user_id, limit, offset),
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def mark_read(conn: Any, notification_id: int, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE notifications SET read_at = NOW() WHERE id = %s AND user_id = %s RETURNING *;",
            (notification_id, user_id),
        )
        row = cur.fetchone()
    if not row:
        api_error(404, "NOTIFICATION_NOT_FOUND", "Notification not found")
    return {"ok": True}
