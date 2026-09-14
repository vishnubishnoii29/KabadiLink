import io
import logging
from typing import Any, Dict

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from backend.helpers import api_error, audit, next_record_id
from backend.services.uploads import save_file

logger = logging.getLogger("kabadilink.services.epr")


def _render_pdf(record: Dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 60

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "EPR-Ready Handover Record")
    y -= 20
    c.setFont("Helvetica", 9)
    c.drawString(50, y, "Formatted to assist authorized recyclers with CPCB EPR Form-2 filing.")
    y -= 30

    c.setFont("Helvetica", 11)
    fields = [
        ("Record ID", record["record_id"]),
        ("Lot ID", str(record["lot_id"])),
        ("Material", record["material_code"]),
        ("Verified Weight (kg)", str(record["weight_kg"])),
        ("Recycler Authorization ID", record["recycler_authorization_id"] or "N/A"),
        ("Handover Verified At", str(record["handover_verified_at"])),
        ("Generated At", str(record["generated_at"])),
    ]
    for label, value in fields:
        c.drawString(50, y, f"{label}: {value}")
        y -= 20

    c.showPage()
    c.save()
    return buf.getvalue()


def get_or_generate_epr_record(conn: Any, lot_id: str, acting_user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM epr_handover_records WHERE lot_id = %s;", (lot_id,))
        existing = cur.fetchone()
        if existing:
            return dict(existing)

        cur.execute(
            "SELECT l.*, m.code AS material_code FROM lots l LEFT JOIN materials m ON m.id = l.material_id WHERE l.id = %s;",
            (lot_id,),
        )
        lot = cur.fetchone()
        if not lot:
            api_error(404, "LOT_NOT_FOUND", "Lot not found")

        cur.execute("SELECT * FROM handovers WHERE lot_id = %s;", (lot_id,))
        handover = cur.fetchone()
        if not handover or handover["status"] != "COMPLETED" or not handover["transaction_id"]:
            api_error(
                400, "HANDOVER_NOT_COMPLETE",
                "EPR record is only available once handover is COMPLETED with a confirmed payment",
            )
        if not handover["otp_verified_at"]:
            api_error(
                400, "HANDOVER_NOT_OTP_VERIFIED",
                "EPR record requires a server-verified handover OTP for chain-of-custody",
            )

        cur.execute(
            """
            SELECT r.id, r.cpcb_reg_number, r.authorization_status FROM offers o
            JOIN recyclers r ON r.id = o.recycler_id
            WHERE o.lot_id = %s AND o.status = 'ACCEPTED'
            ORDER BY o.created_at DESC LIMIT 1;
            """,
            (lot_id,),
        )
        recycler = cur.fetchone()
        if not recycler or recycler["authorization_status"] != "VERIFIED":
            api_error(
                400, "RECYCLER_NOT_VERIFIED",
                "EPR record requires a CPCB-verified recycler on the accepted offer",
            )

        # 02-backend-api.md requires the record to pull both authorization_status AND
        # doc-verified status — a VERIFIED authorization alone isn't enough without at least
        # one APPROVED supporting document on file.
        cur.execute(
            "SELECT id FROM verification_documents WHERE recycler_id = %s AND status = 'APPROVED' LIMIT 1;",
            (recycler["id"],),
        )
        if not cur.fetchone():
            api_error(
                400, "RECYCLER_DOCS_NOT_APPROVED",
                "EPR record requires the recycler to have at least one APPROVED verification document",
            )

        record_id = next_record_id(conn)
        cur.execute(
            """
            INSERT INTO epr_handover_records (
                lot_id, record_id, material_code, weight_kg, recycler_authorization_id,
                handover_verified_at, generated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            RETURNING *;
            """,
            (
                lot_id, record_id, lot["material_code"],
                handover["actual_weight_kg"] or lot["weight_kg"],
                recycler["cpcb_reg_number"], handover["otp_verified_at"],
            ),
        )
        record = dict(cur.fetchone())

    pdf_bytes = _render_pdf(record)
    pdf_url = save_file(pdf_bytes, f"{record['record_id']}.pdf", "application/pdf")

    with conn.cursor() as cur:
        cur.execute("UPDATE epr_handover_records SET pdf_url = %s WHERE id = %s RETURNING *;", (pdf_url, record["id"]))
        record = dict(cur.fetchone())

    audit(conn, acting_user_id, "EPR_RECORD_GENERATED", "epr_handover_records", str(record["id"]), metadata={"lot_id": str(lot_id)})
    return record
