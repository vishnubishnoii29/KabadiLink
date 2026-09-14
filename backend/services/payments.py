import logging
from typing import Any, Dict, Optional

from backend.helpers import audit

logger = logging.getLogger("kabadilink.services.payments")


def record_transaction(
    conn: Any,
    lot_id: str,
    offer_id: Optional[int],
    amount: float,
    payment_method: str,
    acting_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Writes the canonical payment record. `transactions` is the single source of truth for payments."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO transactions (lot_id, offer_id, amount, payment_method, status, paid_at)
            VALUES (%s, %s, %s, %s, 'COMPLETED', NOW())
            RETURNING *;
            """,
            (lot_id, offer_id, amount, payment_method),
        )
        row = cur.fetchone()

    audit(conn, acting_user_id, "PAYMENT_RECORDED", "transactions", str(row["id"]), metadata={"lot_id": str(lot_id), "amount": amount})
    return dict(row)
