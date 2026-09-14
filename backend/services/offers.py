import logging
from typing import Any, Dict, List

from backend.helpers import api_error, audit
from backend.services import matching as matching_service
from backend.services import pricing as pricing_service
from backend.services.anomaly import check_price_anomaly, evaluate_anomaly, get_price_stats
from backend.services.notifications import notify

logger = logging.getLogger("kabadilink.services.offers")


def _get_lot(conn: Any, lot_id: str) -> Dict[str, Any]:
    # LEFT JOIN: lots.material_id is nullable in schema — an INNER JOIN would silently 404 a
    # real lot that hasn't been classified yet instead of surfacing it with material_code=None.
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT l.*, m.code AS material_code, c.user_id AS collector_user_id
            FROM lots l
            LEFT JOIN materials m ON m.id = l.material_id
            JOIN collectors c ON c.id = l.collector_id
            WHERE l.id = %s;
            """,
            (lot_id,),
        )
        lot = cur.fetchone()
    if not lot:
        api_error(404, "LOT_NOT_FOUND", "Lot not found")
    return lot


def get_price_estimate(conn: Any, lot_id: str, acting_user_id: str) -> Dict[str, Any]:
    lot = _get_lot(conn, lot_id)
    estimate = pricing_service.estimate_fair_price(conn, lot["material_id"], lot["weight_kg"])

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO price_estimates (lot_id, min_price, max_price, median_price, confidence, explanation_text, source, sample_size)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (
                lot_id, estimate["min"], estimate["max"], estimate["median"],
                estimate["confidence"], estimate["explanation"], estimate["source"], estimate["sample_size"],
            ),
        )

    audit(
        conn, acting_user_id, "PRICE_ESTIMATE_GENERATED", "lots", lot_id,
        ai_source=estimate["source"], metadata={"confidence": estimate["confidence"]},
    )
    return estimate


def get_recyclers_for_lot(conn: Any, lot_id: str) -> List[Dict[str, Any]]:
    lot = _get_lot(conn, lot_id)
    return matching_service.match_recyclers(conn, lot["material_code"], lot["latitude"], lot["longitude"])


def create_offer(conn: Any, lot_id: str, recycler_id: str, acting_user_id: str, price: float) -> Dict[str, Any]:
    lot = _get_lot(conn, lot_id)
    anomaly = check_price_anomaly(conn, lot["material_id"], price, lot["weight_kg"])

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO offers (lot_id, recycler_id, price, status, proposed_by)
            VALUES (%s, %s, %s, 'PENDING', 'RECYCLER')
            RETURNING *;
            """,
            (lot_id, recycler_id, price),
        )
        offer = cur.fetchone()

    audit(
        conn, acting_user_id, "OFFER_CREATED", "offers", str(offer["id"]),
        ai_source="rule_based" if anomaly["status"] == "ANOMALOUS" else None,
        metadata={"anomaly": anomaly},
    )
    notify(conn, lot["collector_user_id"], "offer_received", {"offer_id": offer["id"], "lot_id": str(lot_id), "price": offer["price"]})

    result = dict(offer)
    result["anomaly"] = anomaly
    return result


def list_offers_for_lot(conn: Any, lot_id: str) -> List[Dict[str, Any]]:
    lot = _get_lot(conn, lot_id)
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM offers WHERE lot_id = %s ORDER BY created_at DESC;", (lot_id,))
        offers = cur.fetchall()

    # Fetch the material's price stats once and reuse — all offers on a lot share one material_id.
    avg_price, sample_size = get_price_stats(conn, lot["material_id"])

    results = []
    for offer in offers:
        anomaly = evaluate_anomaly(avg_price, sample_size, offer["price"], lot["weight_kg"])
        item = dict(offer)
        item["anomaly"] = anomaly
        results.append(item)
    return results


def _get_offer_with_context(conn: Any, offer_id: int) -> Dict[str, Any]:
    """Offer row plus the user_id of each of its two parties, for ownership checks."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT o.*, c.user_id AS collector_user_id, r.user_id AS recycler_user_id
            FROM offers o
            JOIN lots l ON l.id = o.lot_id
            JOIN collectors c ON c.id = l.collector_id
            JOIN recyclers r ON r.id = o.recycler_id
            WHERE o.id = %s;
            """,
            (offer_id,),
        )
        row = cur.fetchone()
    if not row:
        api_error(404, "OFFER_NOT_FOUND", "Offer not found")
    return row


def _require_offer_party(offer_ctx: Dict[str, Any], acting_user_id: str) -> str:
    """Returns 'COLLECTOR' or 'RECYCLER' — whichever party acting_user_id is on this offer's lot."""
    if str(offer_ctx["collector_user_id"]) == str(acting_user_id):
        return "COLLECTOR"
    if str(offer_ctx["recycler_user_id"]) == str(acting_user_id):
        return "RECYCLER"
    api_error(403, "FORBIDDEN", "You are not a party to this offer")


def create_counter_offer(conn: Any, offer_id: int, price: float, acting_user_id: str) -> Dict[str, Any]:
    ctx = _get_offer_with_context(conn, offer_id)
    if ctx["status"] != "PENDING":
        api_error(400, "INVALID_OFFER_STATE", "Only a PENDING offer can be countered")
    party = _require_offer_party(ctx, acting_user_id)

    with conn.cursor() as cur:
        cur.execute("UPDATE offers SET status = 'COUNTERED' WHERE id = %s;", (offer_id,))
        cur.execute(
            """
            INSERT INTO offers (lot_id, recycler_id, price, status, parent_offer_id, proposed_by)
            VALUES (%s, %s, %s, 'PENDING', %s, %s)
            RETURNING *;
            """,
            (ctx["lot_id"], ctx["recycler_id"], price, offer_id, party),
        )
        new_offer = cur.fetchone()

    audit(conn, acting_user_id, "OFFER_COUNTERED", "offers", str(new_offer["id"]), metadata={"parent_offer_id": offer_id})
    other_party_user_id = ctx["recycler_user_id"] if party == "COLLECTOR" else ctx["collector_user_id"]
    notify(conn, other_party_user_id, "offer_changed", {"offer_id": new_offer["id"], "lot_id": str(ctx["lot_id"]), "status": "COUNTERED", "price": new_offer["price"]})
    return dict(new_offer)


def accept_offer(conn: Any, offer_id: int, acting_user_id: str) -> Dict[str, Any]:
    ctx = _get_offer_with_context(conn, offer_id)
    if ctx["status"] != "PENDING":
        api_error(400, "INVALID_OFFER_STATE", "Only a PENDING offer can be accepted")
    party = _require_offer_party(ctx, acting_user_id)
    if ctx["proposed_by"] == party:
        api_error(400, "CANNOT_ACCEPT_OWN_OFFER", "You cannot accept an offer you proposed — the other party must accept")

    with conn.cursor() as cur:
        cur.execute("UPDATE offers SET status = 'ACCEPTED' WHERE id = %s;", (offer_id,))
        cur.execute("UPDATE lots SET status = 'ACCEPTED' WHERE id = %s;", (ctx["lot_id"],))
        cur.execute(
            """
            INSERT INTO handovers (lot_id, status)
            VALUES (%s, 'REQUESTED')
            ON CONFLICT (lot_id) DO NOTHING
            RETURNING *;
            """,
            (ctx["lot_id"],),
        )
        handover = cur.fetchone()

    audit(conn, acting_user_id, "OFFER_ACCEPTED", "offers", str(offer_id), metadata={"lot_id": str(ctx["lot_id"])})
    if handover:
        audit(conn, acting_user_id, "HANDOVER_CREATED", "handovers", str(handover["id"]), metadata={"lot_id": str(ctx["lot_id"])})

    for party_user_id in (ctx["collector_user_id"], ctx["recycler_user_id"]):
        notify(conn, party_user_id, "offer_changed", {"offer_id": offer_id, "lot_id": str(ctx["lot_id"]), "status": "ACCEPTED"})

    return {"ok": True}


def reject_offer(conn: Any, offer_id: int, acting_user_id: str) -> Dict[str, Any]:
    ctx = _get_offer_with_context(conn, offer_id)
    if ctx["status"] != "PENDING":
        api_error(400, "INVALID_OFFER_STATE", "Only a PENDING offer can be rejected")
    _require_offer_party(ctx, acting_user_id)

    with conn.cursor() as cur:
        cur.execute("UPDATE offers SET status = 'REJECTED' WHERE id = %s;", (offer_id,))
    audit(conn, acting_user_id, "OFFER_REJECTED", "offers", str(offer_id))

    other_party_user_id = ctx["recycler_user_id"] if str(ctx["collector_user_id"]) == str(acting_user_id) else ctx["collector_user_id"]
    notify(conn, other_party_user_id, "offer_changed", {"offer_id": offer_id, "lot_id": str(ctx["lot_id"]), "status": "REJECTED"})
    return {"ok": True}
