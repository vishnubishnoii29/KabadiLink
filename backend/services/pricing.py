import logging
from typing import Any, Dict, Optional

from backend.helpers import api_error

logger = logging.getLogger("kabadilink.services.pricing")

# AI/ML only where data supports it (03-ai-ml-pipeline.md): below this sample size the estimate
# falls back to the broader rule-based range rather than asserting confidence it doesn't have.
MIN_SAMPLES_FOR_CONFIDENCE = 8
MIN_SAMPLES_FOR_HIGH_CONFIDENCE = 24


def get_material_id_by_code(conn: Any, material_code: str) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM materials WHERE code = %s;", (material_code,))
        row = cur.fetchone()
    if not row:
        api_error(400, "INVALID_MATERIAL", f"Unknown material code: {material_code}")
    return row["id"]


def estimate_fair_price(
    conn: Any,
    material_id: int,
    weight_kg: Optional[float] = None,
    location: Optional[str] = None,
    condition: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Rule-based fair price estimate from recent `prices` observations for this material.
    Source is always "rule_based" here — services/classification.py (Phase 2) layers
    local_model / cloud_verified detection on top of this for the material identification step,
    not the price computation itself.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT buying_price
            FROM prices
            WHERE material_id = %s AND price_date >= CURRENT_DATE - 90
            ORDER BY price_date DESC
            LIMIT 200
            """,
            (material_id,),
        )
        rows = cur.fetchall()

    values = sorted(float(r["buying_price"]) for r in rows)
    sample_size = len(values)

    if sample_size == 0:
        return {
            "min": 0.0,
            "max": 0.0,
            "median": 0.0,
            "confidence": "low",
            "explanation": "No historical price data available for this material yet.",
            "source": "rule_based",
            "sample_size": 0,
        }

    mid = sample_size // 2
    median = values[mid] if sample_size % 2 == 1 else (values[mid - 1] + values[mid]) / 2

    if sample_size < MIN_SAMPLES_FOR_CONFIDENCE:
        confidence = "low"
        explanation = (
            "Not enough recent local sales for a confident estimate — "
            "showing the broader regional range instead."
        )
    elif sample_size < MIN_SAMPLES_FOR_HIGH_CONFIDENCE:
        confidence = "medium"
        explanation = f"Estimate based on {sample_size} recent comparable local transactions."
    else:
        confidence = "high"
        explanation = (
            f"Estimate based on {sample_size} recent comparable local transactions "
            "— strong sample size."
        )

    return {
        "min": values[0],
        "max": values[-1],
        "median": median,
        "confidence": confidence,
        "explanation": explanation,
        "source": "rule_based",
        "sample_size": sample_size,
    }
