import logging
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("kabadilink.services.anomaly")

MIN_SAMPLES_FOR_ANOMALY_CHECK = 3
MEDIUM_DEVIATION_THRESHOLD = 0.30
HIGH_DEVIATION_THRESHOLD = 0.60


def get_price_stats(conn: Any, material_id: int) -> Tuple[Optional[float], int]:
    """(avg_buying_price, sample_size) over the last 90 days for a material. Query once, reuse."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT AVG(buying_price) AS avg_price, COUNT(*) AS n
            FROM prices
            WHERE material_id = %s AND price_date >= CURRENT_DATE - 90
            """,
            (material_id,),
        )
        row = cur.fetchone()
    avg_price = float(row["avg_price"]) if row and row["avg_price"] is not None else None
    sample_size = row["n"] if row else 0
    return avg_price, sample_size


def evaluate_anomaly(
    avg_price: Optional[float],
    sample_size: int,
    price: float,
    weight_kg: Optional[float] = None,
) -> Dict[str, Any]:
    """Pure deviation-from-mean rule — no DB access, so callers can reuse one stats fetch across many offers."""
    price_per_kg = (price / weight_kg) if weight_kg else price

    if avg_price is None or sample_size < MIN_SAMPLES_FOR_ANOMALY_CHECK:
        return {
            "status": "NORMAL",
            "reason": "Insufficient recent price history for this material to compare against.",
            "severity": "none",
        }

    deviation = abs(price_per_kg - avg_price) / avg_price

    if deviation > HIGH_DEVIATION_THRESHOLD:
        severity, status = "high", "ANOMALOUS"
    elif deviation > MEDIUM_DEVIATION_THRESHOLD:
        severity, status = "medium", "ANOMALOUS"
    else:
        severity, status = "none", "NORMAL"

    reason = (
        f"Offer price ₹{price_per_kg:.2f}/kg deviates {deviation * 100:.0f}% from the recent "
        f"90-day average of ₹{avg_price:.2f}/kg ({sample_size} samples)."
        if status == "ANOMALOUS"
        else f"Offer price ₹{price_per_kg:.2f}/kg is within the normal range of the recent "
        f"90-day average of ₹{avg_price:.2f}/kg."
    )

    return {"status": status, "reason": reason, "severity": severity}


def check_price_anomaly(
    conn: Any,
    material_id: int,
    price: float,
    weight_kg: Optional[float] = None,
) -> Dict[str, Any]:
    """Single-offer convenience wrapper: fetch stats + evaluate in one call."""
    avg_price, sample_size = get_price_stats(conn, material_id)
    return evaluate_anomaly(avg_price, sample_size, price, weight_kg)
