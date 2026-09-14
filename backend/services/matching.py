import logging
import math
from typing import Any, Dict, List, Optional

from backend.helpers import api_error, audit

logger = logging.getLogger("kabadilink.services.matching")

MAX_SCORE_DISTANCE_KM = 50.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def match_recyclers(
    conn: Any,
    material_code: str,
    lat: Optional[float],
    lon: Optional[float],
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Ranks verified recyclers for a lot's material.
    Hard filter: material_code must be in the recycler's materials_accepted array.
    Soft scoring: distance (closer is better, capped at service_area_km) + reliability_score.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, name, latitude, longitude, materials_accepted,
                   pickup_available, service_area_km, reliability_score, authorization_status
            FROM recyclers
            WHERE %s = ANY(materials_accepted)
            """,
            (material_code,),
        )
        rows = cur.fetchall()

    results: List[Dict[str, Any]] = []
    for r in rows:
        distance_km: Optional[float] = None
        reasons = [f"Accepts {material_code}"]

        if lat is not None and lon is not None and r["latitude"] is not None and r["longitude"] is not None:
            distance_km = haversine_km(lat, lon, r["latitude"], r["longitude"])
            service_area = r["service_area_km"] or 25.0
            if distance_km > service_area:
                # Hard filter: outside this recycler's declared service radius.
                continue
            reasons.append(f"{distance_km:.1f} km away (within {service_area:.0f} km service area)")

        reliability = r["reliability_score"] if r["reliability_score"] is not None else 0.8
        distance_score = 1.0 - min((distance_km or MAX_SCORE_DISTANCE_KM) / MAX_SCORE_DISTANCE_KM, 1.0)
        score = round((0.6 * distance_score) + (0.4 * reliability), 4)

        if r["authorization_status"] == "VERIFIED":
            reasons.append("CPCB-verified recycler")

        results.append(
            {
                "recycler_id": str(r["id"]),
                "name": r["name"],
                "score": score,
                "distance_km": round(distance_km, 2) if distance_km is not None else None,
                "reliability_score": reliability,
                "authorization_status": r["authorization_status"],
                "pickup_available": r["pickup_available"],
                "reasons": reasons,
            }
        )

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


# --- Recycler self-service (routers/recyclers.py) --------------------------------------------

def get_recycler(conn: Any, recycler_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM recyclers WHERE id = %s;", (recycler_id,))
        row = cur.fetchone()
    if not row:
        api_error(404, "RECYCLER_NOT_FOUND", "Recycler not found")
    return dict(row)


def get_recycler_owner_user_id(conn: Any, recycler_id: str) -> Optional[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT user_id FROM recyclers WHERE id = %s;", (recycler_id,))
        row = cur.fetchone()
    return str(row["user_id"]) if row else None


def update_recycler(conn: Any, recycler_id: str, fields: Dict[str, Any], acting_user_id: str) -> Dict[str, Any]:
    if not fields:
        return get_recycler(conn, recycler_id)

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    params = list(fields.values()) + [recycler_id]

    with conn.cursor() as cur:
        cur.execute(f"UPDATE recyclers SET {set_clause} WHERE id = %s RETURNING *;", params)
        row = cur.fetchone()
    if not row:
        api_error(404, "RECYCLER_NOT_FOUND", "Recycler not found")

    audit(conn, acting_user_id, "RECYCLER_PROFILE_UPDATED", "recyclers", recycler_id, metadata={"fields": list(fields.keys())})
    return dict(row)


def add_verification_document(conn: Any, recycler_id: str, acting_user_id: str, doc_url: str, doc_type: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO verification_documents (recycler_id, doc_url, doc_type, status, uploaded_at)
            VALUES (%s, %s, %s, 'PENDING', NOW())
            RETURNING *;
            """,
            (recycler_id, doc_url, doc_type),
        )
        row = cur.fetchone()

    audit(conn, acting_user_id, "VERIFICATION_DOC_UPLOADED", "verification_documents", str(row["id"]), metadata={"recycler_id": recycler_id})
    return dict(row)


def get_recycler_lots(conn: Any, recycler_id: str) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT l.* FROM lots l
            JOIN offers o ON o.lot_id = l.id
            WHERE o.recycler_id = %s
            ORDER BY l.created_at DESC;
            """,
            (recycler_id,),
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def get_recycler_pickups(conn: Any, recycler_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
    clauses = ["o.recycler_id = %s", "o.status = 'ACCEPTED'"]
    params: List[Any] = [recycler_id]
    if status:
        clauses.append("h.status = %s")
        params.append(status)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT h.* FROM handovers h
            JOIN offers o ON o.lot_id = h.lot_id
            WHERE {' AND '.join(clauses)}
            ORDER BY h.created_at DESC;
            """,
            params,
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]
