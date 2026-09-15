import io
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from PIL import Image

from backend.helpers import api_error, audit, next_lot_id
from backend.services.classification import classify_photo
from backend.services.matching import haversine_km

logger = logging.getLogger("kabadilink.services.lots")


def compute_phash(image_bytes: bytes) -> Optional[str]:
    """8x8 average-hash for duplicate/fraud detection (Tier 2 #9). None if the image can't be read."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("L").resize((8, 8), Image.LANCZOS)
        pixels = list(img.getdata())
        avg = sum(pixels) / len(pixels)
        bits = "".join("1" if p >= avg else "0" for p in pixels)
        return f"{int(bits, 2):016x}"
    except Exception as e:
        logger.warning(f"Failed to compute phash: {e}")
        return None


def create_lot_photo(
    conn: Any,
    collector_id: str,
    raw_photo_url: str,
    image_bytes: bytes,
    lat: Optional[float],
    lon: Optional[float],
) -> Dict[str, Any]:
    phash = compute_phash(image_bytes)
    detections = classify_photo(image_bytes)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO lot_photos (collector_id, raw_photo_url, phash, detections_json, latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, collector_id, raw_photo_url, phash, detections_json, latitude, longitude, created_at
            """,
            (collector_id, raw_photo_url, phash, json.dumps(detections), lat, lon),
        )
        row = cur.fetchone()

    return {
        "lot_photo_id": str(row["id"]),
        "phash": row["phash"],
        "detections": detections,
    }


def _get_lot_photo(conn: Any, lot_photo_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM lot_photos WHERE id = %s;", (lot_photo_id,))
        row = cur.fetchone()
    if not row:
        api_error(404, "LOT_PHOTO_NOT_FOUND", "Lot photo not found")
    return row


def _material_id_for_code(conn: Any, material_code: str) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM materials WHERE code = %s;", (material_code,))
        row = cur.fetchone()
    if not row:
        api_error(400, "INVALID_MATERIAL", f"Unknown material code: {material_code}")
    return row["id"]


def _insert_lot(
    conn: Any,
    collector_id: str,
    material_id: int,
    lot_photo_id: Optional[str],
    lot_group_id: Optional[str],
    weight_kg: float,
    condition: Optional[str],
    photo_url: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
    acting_user_id: Optional[str],
    ai_source: Optional[str] = None,
    client_uid: Optional[str] = None,
) -> Dict[str, Any]:
    lot_code = next_lot_id(conn)
    columns = [
        "lot_code", "collector_id", "material_id", "lot_photo_id", "lot_group_id",
        "weight_kg", "condition", "photo_url", "status", "latitude", "longitude",
    ]
    values = [
        lot_code, collector_id, material_id, lot_photo_id, lot_group_id,
        weight_kg, condition, photo_url, lat, lon,
    ]
    placeholders = ["%s", "%s", "%s", "%s", "%s", "%s", "%s", "%s", "'OPEN'", "%s", "%s"]
    if client_uid is not None:
        columns.append("client_uid")
        placeholders.append("%s")
        values.append(client_uid)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO lots ({", ".join(columns)})
            VALUES ({", ".join(placeholders)})
            RETURNING *;
            """,
            tuple(values),
        )
        row = cur.fetchone()
    audit(conn, acting_user_id, "LOT_CREATED", "lots", str(row["id"]), ai_source=ai_source, metadata={"lot_code": lot_code})
    return dict(row)


def create_lots_from_photo(
    conn: Any,
    collector_id: str,
    acting_user_id: str,
    lot_photo_id: str,
    mode: str,
    items: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    photo = _get_lot_photo(conn, lot_photo_id)
    detections = photo["detections_json"] or []
    created: List[Dict[str, Any]] = []

    if mode == "SPLIT":
        # A shared group id lets these lots later be offered/sold "as one combined lot"
        # (01-database-schema.md's lot_group_id note) even though each is a separate row.
        lot_group_id = str(uuid.uuid4()) if len(items) > 1 else None
        for item in items:
            idx = item["bbox_index"]
            if idx < 0 or idx >= len(detections):
                api_error(400, "INVALID_BBOX_INDEX", f"bbox_index {idx} out of range for this photo")
            detection = detections[idx]
            material_id = _material_id_for_code(conn, detection["material"])
            lot = _insert_lot(
                conn, collector_id, material_id, lot_photo_id, lot_group_id,
                item["weight_kg"], item.get("condition"), photo["raw_photo_url"],
                photo["latitude"], photo["longitude"],
                acting_user_id, ai_source=detection.get("source"),
            )
            created.append(lot)
        if lot_group_id:
            with conn.cursor() as cur:
                cur.execute("UPDATE lot_photos SET lot_group_id = %s WHERE id = %s;", (lot_group_id, lot_photo_id))
    elif mode == "COMBINE":
        if not items:
            api_error(400, "NO_ITEMS", "COMBINE mode requires at least one item")
        first_idx = items[0]["bbox_index"]
        detection = detections[first_idx] if detections and 0 <= first_idx < len(detections) else {"material": "OTHER", "source": "rule_based"}
        material_id = _material_id_for_code(conn, detection["material"])
        total_weight = sum(item["weight_kg"] for item in items)
        condition = items[0].get("condition")
        lot = _insert_lot(
            conn, collector_id, material_id, lot_photo_id, None,
            total_weight, condition, photo["raw_photo_url"],
            photo["latitude"], photo["longitude"],
            acting_user_id, ai_source=detection.get("source"),
        )
        created.append(lot)
    else:
        api_error(400, "INVALID_MODE", "mode must be SPLIT or COMBINE")

    return created


def create_lot_manual(
    conn: Any,
    collector_id: str,
    acting_user_id: str,
    material_code: str,
    weight_kg: float,
    condition: Optional[str],
    photo_url: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
    client_uid: Optional[str] = None,
) -> Dict[str, Any]:
    # Idempotency for the mobile offline outbox: if the client already submitted this
    # client_uid (and only the response was lost), return that lot instead of inserting
    # a duplicate. The UNIQUE constraint on lots.client_uid is the hard backstop.
    if client_uid:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM lots WHERE client_uid = %s;", (client_uid,))
            existing = cur.fetchone()
        if existing:
            return dict(existing)

    material_id = _material_id_for_code(conn, material_code)
    return _insert_lot(
        conn, collector_id, material_id, None, None, weight_kg, condition, photo_url, lat, lon,
        acting_user_id, client_uid=client_uid,
    )


def list_lots(
    conn: Any,
    status: Optional[str] = None,
    material: Optional[str] = None,
    collector_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    clauses, params = [], []
    if status:
        clauses.append("l.status = %s")
        params.append(status)
    if material:
        clauses.append("m.code = %s")
        params.append(material)
    if collector_id:
        clauses.append("l.collector_id = %s")
        params.append(collector_id)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.extend([limit, offset])

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT l.* FROM lots l
            JOIN materials m ON m.id = l.material_id
            {where_sql}
            ORDER BY l.created_at DESC
            LIMIT %s OFFSET %s;
            """,
            params,
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def get_lot(conn: Any, lot_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM lots WHERE id = %s;", (lot_id,))
        lot = cur.fetchone()
        if not lot:
            api_error(404, "LOT_NOT_FOUND", "Lot not found")

        cur.execute(
            """
            SELECT lot_id, min_price AS min, max_price AS max, median_price AS median,
                   confidence, explanation_text, source, sample_size, created_at
            FROM price_estimates WHERE lot_id = %s ORDER BY created_at DESC LIMIT 1;
            """,
            (lot_id,),
        )
        price_estimate = cur.fetchone()

        cur.execute("SELECT * FROM offers WHERE lot_id = %s ORDER BY created_at DESC;", (lot_id,))
        offers = cur.fetchall()

        cur.execute("SELECT * FROM handovers WHERE lot_id = %s;", (lot_id,))
        handover = cur.fetchone()

    result = dict(lot)
    result["price_estimate"] = dict(price_estimate) if price_estimate else None
    result["offers"] = [dict(o) for o in offers]
    result["handover"] = dict(handover) if handover else None
    return result


def get_lot_owner_user_id(conn: Any, lot_id: str) -> Optional[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT c.user_id FROM lots l JOIN collectors c ON c.id = l.collector_id WHERE l.id = %s;",
            (lot_id,),
        )
        row = cur.fetchone()
    return str(row["user_id"]) if row else None


def update_lot(conn: Any, lot_id: str, fields: Dict[str, Any], acting_user_id: str) -> Dict[str, Any]:
    if not fields:
        return get_lot(conn, lot_id)

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    params = list(fields.values()) + [lot_id]

    with conn.cursor() as cur:
        cur.execute(f"UPDATE lots SET {set_clause} WHERE id = %s RETURNING *;", params)
        row = cur.fetchone()
        if not row:
            api_error(404, "LOT_NOT_FOUND", "Lot not found")

    audit(conn, acting_user_id, "LOT_UPDATED", "lots", lot_id, metadata={"fields": list(fields.keys())})
    return dict(row)


def delete_lot(conn: Any, lot_id: str, acting_user_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM lots WHERE id = %s;", (lot_id,))
        row = cur.fetchone()
        if not row:
            api_error(404, "LOT_NOT_FOUND", "Lot not found")
        if row["status"] not in ("DRAFT", "OPEN"):
            api_error(400, "LOT_NOT_DELETABLE", "Only DRAFT or OPEN lots can be deleted")

        cur.execute("DELETE FROM lots WHERE id = %s;", (lot_id,))

    audit(conn, acting_user_id, "LOT_DELETED", "lots", lot_id)


def create_pickup_group(conn: Any, recycler_id: str, acting_user_id: str, lot_ids: List[str]) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, latitude, longitude FROM lots WHERE id = ANY(%s);",
            (lot_ids,),
        )
        lots = cur.fetchall()

    # Simple nearest-neighbor ordering starting from the first lot — good enough for a
    # small same-day pickup route without pulling in a routing service dependency.
    route: List[Dict[str, Any]] = []
    remaining = list(lots)
    if remaining:
        current = remaining.pop(0)
        route.append({"lot_id": str(current["id"]), "lat": current["latitude"], "lon": current["longitude"]})
        while remaining:
            nearest_idx = min(
                range(len(remaining)),
                key=lambda i: haversine_km(
                    current["latitude"] or 0, current["longitude"] or 0,
                    remaining[i]["latitude"] or 0, remaining[i]["longitude"] or 0,
                ),
            )
            current = remaining.pop(nearest_idx)
            route.append({"lot_id": str(current["id"]), "lat": current["latitude"], "lon": current["longitude"]})

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO pickup_groups (recycler_id, lot_ids, route_order_json, status)
            VALUES (%s, %s, %s, 'PLANNED')
            RETURNING *;
            """,
            (recycler_id, lot_ids, json.dumps(route)),
        )
        row = cur.fetchone()

    audit(conn, acting_user_id, "PICKUP_GROUP_CREATED", "pickup_groups", str(row["id"]), metadata={"lot_count": len(lot_ids)})
    return dict(row)


def list_pickup_groups(conn: Any, recycler_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        if recycler_id:
            cur.execute("SELECT * FROM pickup_groups WHERE recycler_id = %s ORDER BY created_at DESC;", (recycler_id,))
        else:
            cur.execute("SELECT * FROM pickup_groups ORDER BY created_at DESC;")
        rows = cur.fetchall()
    return [dict(r) for r in rows]
