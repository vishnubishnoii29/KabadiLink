import csv
import io
import logging
from typing import Any, Dict, List, Optional

from backend.helpers import api_error, audit
from backend.services.uploads import save_file

logger = logging.getLogger("kabadilink.services.admin")

# Rough zero-cost estimate: informal scrap rates run ~15-20% below the platform's rule-based
# fair-price median. Used only for the impact dashboard, not for pricing decisions.
ASSUMED_INFORMAL_MARKET_DISCOUNT_PCT = 18.0


def get_overview(conn: Any) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM users;")
        total_users = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM lots;")
        total_lots = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM lots WHERE status = 'COMPLETED';")
        completed_lots = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM offers;")
        total_offers = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM disputes WHERE status IN ('OPEN', 'UNDER_REVIEW');")
        open_disputes = cur.fetchone()["n"]
        cur.execute("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE status = 'COMPLETED';")
        total_paid_out = cur.fetchone()["total"]

    return {
        "total_users": total_users,
        "total_lots": total_lots,
        "completed_lots": completed_lots,
        "total_offers": total_offers,
        "open_disputes": open_disputes,
        "total_paid_out": float(total_paid_out),
    }


def get_verification_queue(conn: Any, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM verification_documents WHERE status = 'PENDING' ORDER BY uploaded_at ASC LIMIT %s OFFSET %s;",
            (limit, offset),
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def review_verification_doc(conn: Any, doc_id: int, status: str, reviewed_by: str) -> Dict[str, Any]:
    if status not in ("APPROVED", "REJECTED"):
        api_error(400, "INVALID_STATUS", "status must be APPROVED or REJECTED")

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE verification_documents SET status = %s, reviewed_by = %s, reviewed_at = NOW()
            WHERE id = %s RETURNING *;
            """,
            (status, reviewed_by, doc_id),
        )
        doc = cur.fetchone()
        if not doc:
            api_error(404, "DOC_NOT_FOUND", "Verification document not found")

        recycler_status = "VERIFIED" if status == "APPROVED" else "REJECTED"
        cur.execute("UPDATE recyclers SET authorization_status = %s WHERE id = %s;", (recycler_status, doc["recycler_id"]))

    audit(conn, reviewed_by, "VERIFICATION_DOC_REVIEWED", "verification_documents", str(doc_id), metadata={"status": status})
    return dict(doc)


def get_audit_log(conn: Any, entity_type: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        if entity_type:
            cur.execute(
                "SELECT * FROM audit_log WHERE entity_type = %s ORDER BY created_at DESC LIMIT %s OFFSET %s;",
                (entity_type, limit, offset),
            )
        else:
            cur.execute("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT %s OFFSET %s;", (limit, offset))
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def get_impact_summary(conn: Any) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(actual_weight_kg), 0) AS total_weight
            FROM handovers
            WHERE status = 'COMPLETED';
            """
        )
        row = cur.fetchone()
        cur.execute("SELECT COUNT(*) AS n FROM lots WHERE hazard_flags != '{}';")
        hazard_flagged = cur.fetchone()["n"]

    return {
        "total_weight_kg": float(row["total_weight"]),
        "income_uplift_pct": ASSUMED_INFORMAL_MARKET_DISCOUNT_PCT,
        "hazardous_practices_avoided_estimate": hazard_flagged,
    }


def get_collector_impact_summary(conn: Any, collector_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(h.actual_weight_kg), 0) AS total_weight
            FROM handovers h
            JOIN lots l ON l.id = h.lot_id
            WHERE l.collector_id = %s AND h.status = 'COMPLETED';
            """,
            (collector_id,),
        )
        row = cur.fetchone()

    return {
        "total_weight_kg": float(row["total_weight"]),
        "income_uplift_pct": ASSUMED_INFORMAL_MARKET_DISCOUNT_PCT,
        "personal_certificate_url": None,
    }


def create_dataset_export(conn: Any, export_type: str, acting_user_id: str) -> Dict[str, Any]:
    """
    No background job queue is wired up yet (Redis is configured but no worker runs against it) —
    exports run synchronously inline and are returned already COMPLETED. Swap for a real queued
    job in `jobs/` if export volume ever makes this endpoint slow.
    """
    if export_type != "transactions_anonymized":
        api_error(400, "UNSUPPORTED_EXPORT_TYPE", f"Unsupported export_type: {export_type}")

    # Anonymized means no per-transaction id, no precise timestamp/location that could
    # re-identify a specific handover — date-only and ~1.1km-precision coordinates instead.
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.amount, t.payment_method, t.paid_at::date AS paid_date, m.code AS material_code,
                   l.weight_kg, ROUND(l.latitude::numeric, 2) AS latitude, ROUND(l.longitude::numeric, 2) AS longitude
            FROM transactions t
            JOIN lots l ON l.id = t.lot_id
            LEFT JOIN materials m ON m.id = l.material_id
            WHERE t.status = 'COMPLETED';
            """
        )
        rows = cur.fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["amount", "payment_method", "paid_date", "material_code", "weight_kg", "latitude", "longitude"])
    for r in rows:
        writer.writerow([r["amount"], r["payment_method"], r["paid_date"], r["material_code"], r["weight_kg"], r["latitude"], r["longitude"]])

    file_url = save_file(buf.getvalue().encode("utf-8"), f"{export_type}.csv", "text/csv")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO dataset_exports (export_type, file_url, row_count, generated_at)
            VALUES (%s, %s, %s, NOW())
            RETURNING *;
            """,
            (export_type, file_url, len(rows)),
        )
        export = cur.fetchone()

    audit(conn, acting_user_id, "DATASET_EXPORT_GENERATED", "dataset_exports", str(export["id"]), metadata={"row_count": len(rows)})
    return dict(export)


def get_dataset_export(conn: Any, export_id: int) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM dataset_exports WHERE id = %s;", (export_id,))
        row = cur.fetchone()
    if not row:
        api_error(404, "EXPORT_NOT_FOUND", "Dataset export not found")
    result = dict(row)
    result["status"] = "COMPLETED" if result.get("file_url") else "PENDING"
    return result
