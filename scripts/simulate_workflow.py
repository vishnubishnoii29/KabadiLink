import sys
import os
import uuid
import time
from dotenv import load_dotenv

# Ensure root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv()

from fastapi.testclient import TestClient
from backend.main import app

def run_simulation():
    print("=" * 80)
    print("STARTING KABADILINK END-TO-END WORKFLOW SIMULATION (CODE ONLY)")
    print("=" * 80)
    client = TestClient(app)

    unique_suffix = str(int(time.time()))[-6:]
    collector_phone = f"9876{unique_suffix}"
    recycler_phone = f"9123{unique_suffix}"
    admin_phone = f"9000{unique_suffix}"
    password = "SecurePassword123!"

    # -------------------------------------------------------------
    # 1. Health Probe
    # -------------------------------------------------------------
    print("\n[Step 1] Checking API Root & Health Probe...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("  -> Health check OK:", res.json())

    res_db = client.get("/health/db")
    print("  -> DB Heartbeat probe:", res_db.json())
    assert res_db.status_code == 200, f"DB probe failed: {res_db.text}"

    # -------------------------------------------------------------
    # 2. Admin Pre-Registration
    # -------------------------------------------------------------
    print(f"\n[Step 2] Registering Admin ({admin_phone})...")
    res = client.post("/auth/register", json={
        "phone": admin_phone,
        "password": password,
        "role": "ADMIN",
        "name": f"CPCB Officer {unique_suffix}"
    })
    assert res.status_code == 201, f"Admin registration failed: {res.text}"
    admin_token = res.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  -> Admin registered and authenticated.")

    # -------------------------------------------------------------
    # 3. Collector Registration & Profile
    # -------------------------------------------------------------
    print(f"\n[Step 3] Registering Informal Collector ({collector_phone})...")
    res = client.post("/auth/register", json={
        "phone": collector_phone,
        "password": password,
        "role": "COLLECTOR",
        "name": f"Ramesh Kabadiwala {unique_suffix}",
        "preferred_language": "hi",
        "latitude": 19.0760,
        "longitude": 72.8777
    })
    print(f"  -> Status: {res.status_code}")
    assert res.status_code == 201, f"Collector registration failed: {res.text}"
    collector_data = res.json()
    collector_token = collector_data["token"]
    collector_headers = {"Authorization": f"Bearer {collector_token}"}

    # Verify Collector Profile (/auth/me)
    res = client.get("/auth/me", headers=collector_headers)
    assert res.status_code == 200, f"Collector /auth/me failed: {res.text}"
    collector_profile = res.json()
    collector_id = collector_profile.get("collector_id")
    print(f"  -> Collector Profile verified. User ID: {collector_profile.get('id')}, Collector ID: {collector_id}")
    assert collector_id is not None, "Collector ID missing from profile"

    # -------------------------------------------------------------
    # 4. Recycler Registration, Document Upload & Admin Approval
    # -------------------------------------------------------------
    print(f"\n[Step 4] Registering Authorized Recycler ({recycler_phone})...")
    res = client.post("/auth/register", json={
        "phone": recycler_phone,
        "password": password,
        "role": "RECYCLER",
        "name": f"EcoRecyclers MMR {unique_suffix}",
        "preferred_language": "en",
        "latitude": 19.0850,
        "longitude": 72.8850
    })
    print(f"  -> Status: {res.status_code}")
    assert res.status_code == 201, f"Recycler registration failed: {res.text}"
    recycler_data = res.json()
    recycler_token = recycler_data["token"]
    recycler_headers = {"Authorization": f"Bearer {recycler_token}"}

    res = client.get("/auth/me", headers=recycler_headers)
    assert res.status_code == 200, f"Recycler /auth/me failed: {res.text}"
    recycler_profile = res.json()
    recycler_id = recycler_profile.get("recycler_id")
    print(f"  -> Recycler Profile verified. User ID: {recycler_profile.get('id')}, Recycler ID: {recycler_id}")
    assert recycler_id is not None, "Recycler ID missing from profile"

    # Configure materials accepted and CPCB registration number
    res = client.put(f"/recyclers/{recycler_id}", headers=recycler_headers, json={
        "materials_accepted": ["PCB", "CABLE", "BATTERY"],
        "pickup_available": True,
        "service_area_km": 50.0,
        "cpcb_reg_number": f"CPCB-EW-{unique_suffix}"
    })
    assert res.status_code == 200, f"Recycler profile update failed: {res.text}"
    print(f"  -> Recycler configured: Accepts {res.json().get('materials_accepted')}, CPCB Reg={res.json().get('cpcb_reg_number')}")

    # Recycler uploads CPCB Authorization Document
    print("  -> Recycler uploads CPCB authorization certificate...")
    res = client.post(
        f"/recyclers/{recycler_id}/verification-docs",
        headers=recycler_headers,
        data={"doc_type": "CPCB_AUTHORIZATION", "doc_url": "https://cpcb.gov.in/auth/cert_2026.pdf"}
    )
    assert res.status_code == 200, f"Doc upload failed: {res.text}"
    doc_id = res.json()["id"]
    print(f"  -> Verification Doc uploaded: ID={doc_id}, Status={res.json().get('status')}")

    # Admin reviews and approves the document
    print(f"  -> Admin reviews and APPROVES doc ID {doc_id}...")
    res = client.post(f"/admin/verification-docs/{doc_id}/review", headers=admin_headers, json={"status": "APPROVED"})
    assert res.status_code == 200, f"Admin review failed: {res.text}"

    # Verify Recycler is now VERIFIED
    res = client.get(f"/recyclers/{recycler_id}", headers=recycler_headers)
    assert res.json()["authorization_status"] == "VERIFIED"
    print("  -> Recycler status successfully upgraded to VERIFIED!")

    # -------------------------------------------------------------
    # 5. Collector Creates a Scrap Lot
    # -------------------------------------------------------------
    print("\n[Step 5] Collector creates a new Lot of Printed Circuit Boards (PCB)...")
    res = client.post("/lots", headers=collector_headers, json={
        "material_code": "PCB",
        "weight_kg": 25.5,
        "condition": "grade_a_sorted",
        "photo_url": "https://example.com/photos/pcb_batch_01.jpg",
        "lat": 19.0760,
        "lon": 72.8777,
        "client_uid": f"uid-{uuid.uuid4()}"
    })
    print(f"  -> Status: {res.status_code}")
    assert res.status_code in (200, 201), f"Lot creation failed: {res.text}"
    lot_data = res.json()
    lot_id = lot_data["id"]
    print(f"  -> Lot Created: ID={lot_id}, Code={lot_data.get('lot_code')}, Status={lot_data.get('status')}")

    # -------------------------------------------------------------
    # 6. Price Estimation & Nearby Recycler Matching
    # -------------------------------------------------------------
    print(f"\n[Step 6] Checking AI Fair Price Estimate & Recycler Matching for Lot {lot_id}...")
    res = client.get(f"/lots/{lot_id}/price-estimate", headers=collector_headers)
    assert res.status_code == 200, f"Price estimate failed: {res.text}"
    print(f"  -> Price Estimate: {res.json().get('explanation')} (Confidence: {res.json().get('confidence')})")

    res = client.get(f"/lots/{lot_id}/recyclers", headers=collector_headers)
    assert res.status_code == 200, f"Recycler match failed: {res.text}"
    matched_recyclers = res.json()
    print(f"  -> Matching Recyclers nearby: {len(matched_recyclers)}")
    assert len(matched_recyclers) > 0, "Expected at least 1 matched recycler"

    # -------------------------------------------------------------
    # 7. Recycler Browses Open Lots & Submits an Offer
    # -------------------------------------------------------------
    print(f"\n[Step 7] Recycler browses open lots and submits an offer on Lot {lot_id}...")
    res = client.get("/lots", headers=recycler_headers, params={"status": "OPEN"})
    assert res.status_code == 200, f"Browsing lots failed: {res.text}"
    open_lots = res.json()
    print(f"  -> Recycler found {len(open_lots)} open lot(s) in marketplace")
    assert any(l["id"] == lot_id for l in open_lots), f"Lot {lot_id} not found in open lots"

    offer_amount = 3500.0  # ₹3,500 total
    res = client.post(f"/lots/{lot_id}/offers", headers=recycler_headers, json={
        "price": offer_amount,
    })
    print(f"  -> Status: {res.status_code}")
    assert res.status_code in (200, 201), f"Offer submission failed: {res.text}"
    offer_data = res.json()
    offer_id = offer_data["id"]
    print(f"  -> Offer Created: ID={offer_id}, Price=INR {offer_data.get('price')}, Status={offer_data.get('status')}")

    # -------------------------------------------------------------
    # 8. Collector Reviews Offers & Accepts
    # -------------------------------------------------------------
    print(f"\n[Step 8] Collector reviews offers for Lot {lot_id} and accepts Offer {offer_id}...")
    res = client.get(f"/lots/{lot_id}/offers", headers=collector_headers)
    assert res.status_code == 200, f"Listing offers failed: {res.text}"
    offers_list = res.json()
    print(f"  -> Collector retrieved {len(offers_list)} offer(s)")
    assert any(o["id"] == offer_id for o in offers_list), "Submitted offer not listed"

    res = client.post(f"/offers/{offer_id}/accept", headers=collector_headers)
    print(f"  -> Status: {res.status_code}")
    assert res.status_code == 200, f"Accept offer failed: {res.text}"

    # Verify Lot Status updated to ACCEPTED
    res = client.get(f"/lots/{lot_id}", headers=collector_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ACCEPTED", f"Expected lot status ACCEPTED, got {res.json()['status']}"
    print("  -> Lot status transitioned to ACCEPTED successfully.")

    # -------------------------------------------------------------
    # 9. Physical Handover: OTP Generation & Verification
    # -------------------------------------------------------------
    print(f"\n[Step 9] Initiating Physical Handover for Lot {lot_id}...")
    res = client.get(f"/handover/{lot_id}", headers=collector_headers)
    assert res.status_code == 200, f"Get handover failed: {res.text}"
    print(f"  -> Handover record verified. Status: {res.json().get('status')}")

    print("  -> Collector generates Handover OTP...")
    res = client.post(f"/handover/{lot_id}/otp/generate", headers=collector_headers)
    assert res.status_code == 200, f"Generate handover OTP failed: {res.text}"
    otp_code = res.json()["otp_code"]
    print(f"  -> Handover OTP generated: '{otp_code}'")

    print(f"  -> Recycler verifies OTP '{otp_code}' at physical scale...")
    res = client.post(f"/handover/{lot_id}/otp/verify", headers=recycler_headers, json={
        "code": otp_code,
        "actual_weight_kg": 25.4,
    })
    print(f"  -> Status: {res.status_code}")
    assert res.status_code == 200, f"Verify handover OTP failed: {res.text}"
    print("  -> OTP verified! Weight confirmed at 25.4 kg.")

    # -------------------------------------------------------------
    # 10. Payment Settlement
    # -------------------------------------------------------------
    print("\n[Step 10] Recording instant digital payment settlement...")
    res = client.post(f"/handover/{lot_id}/payment", headers=recycler_headers, json={
        "amount": 3500.0,
        "method": "DIGITAL",
    })
    print(f"  -> Status: {res.status_code}")
    assert res.status_code == 200, f"Payment recording failed: {res.text}"
    tx = res.json()
    print(f"  -> Payment settled! Transaction ID: {tx.get('id')}, Amount: INR {tx.get('amount')}")

    # -------------------------------------------------------------
    # 11. Digital Passport & EPR Form 6 Manifest Generation
    # -------------------------------------------------------------
    print(f"\n[Step 11] Generating Digital Product Passport & CPCB Form 6 Certificate...")
    res = client.get(f"/passport/{lot_id}", headers=collector_headers)
    assert res.status_code == 200, f"Digital passport failed: {res.text}"
    passport = res.json()
    print(f"  -> Passport: Lot {passport['lot']['lot_code']} has {len(passport['offers'])} offer history events, Handover: {passport['handover']['status']}")

    res = client.get(f"/lots/{lot_id}/epr-record", headers=recycler_headers)
    assert res.status_code == 200, f"EPR record failed: {res.text}"
    epr_rec = res.json()
    print(f"  -> EPR Form 2/6 Handover Record: ID={epr_rec.get('record_id')}, PDF={epr_rec.get('pdf_url')}")

    res = client.get(f"/lots/{lot_id}/epr-certificate", headers=recycler_headers)
    assert res.status_code == 200, f"EPR Certificate failed: {res.text}"
    print("  -> EPR Certificate generated successfully for regulatory filing.")

    # -------------------------------------------------------------
    # 12. Admin Observability & Audit Log Verification
    # -------------------------------------------------------------
    print("\n[Step 12] Admin checks Platform Overview KPIs & Tamper-Evident Audit Trail...")
    res = client.get("/admin/overview", headers=admin_headers)
    assert res.status_code == 200, f"Admin overview failed: {res.text}"
    print("  -> Admin Platform Overview KPIs:", res.json())

    res = client.get("/admin/audit-log", headers=admin_headers)
    assert res.status_code == 200, f"Admin audit log failed: {res.text}"
    events = res.json()
    print(f"  -> Admin Audit Log: {len(events)} tamper-evident audit events recorded.")

    # -------------------------------------------------------------
    # 13. Counter-Offer Chain (second lot)
    # -------------------------------------------------------------
    print(f"\n[Step 13] Counter-offer negotiation on a second lot...")
    res = client.post("/lots", headers=collector_headers, json={
        "material_code": "PCB",
        "weight_kg": 10.0,
        "condition": "grade_b_mixed",
        "photo_url": "https://example.com/photos/pcb_batch_02.jpg",
        "lat": 19.0760,
        "lon": 72.8777,
        "client_uid": f"uid-{uuid.uuid4()}"
    })
    assert res.status_code == 201, f"Second lot creation failed: {res.text}"
    lot2_id = res.json()["id"]
    print(f"  -> Second Lot Created: ID={lot2_id}")

    res = client.post(f"/lots/{lot2_id}/offers", headers=recycler_headers, json={"price": 1000.0})
    assert res.status_code == 201, f"Initial offer failed: {res.text}"
    offer2_id = res.json()["id"]
    print(f"  -> Recycler makes initial offer: Offer ID={offer2_id}, Price=INR 1000.0")

    res = client.post(f"/offers/{offer2_id}/counter", headers=collector_headers, json={"price": 1400.0})
    assert res.status_code == 200, f"Collector counter-offer failed: {res.text}"
    counter_id = res.json()["id"]
    print(f"  -> Collector counters: New Offer ID={counter_id}, Price=INR 1400.0, Status={res.json().get('status')}")

    res = client.post(f"/offers/{counter_id}/accept", headers=recycler_headers)
    assert res.status_code == 200, f"Recycler accept of counter-offer failed: {res.text}"
    print("  -> Recycler accepts the counter-offer. Negotiation complete.")

    # -------------------------------------------------------------
    # 14. Dispute Filing & Admin Resolution
    # -------------------------------------------------------------
    print(f"\n[Step 14] Collector files a dispute on Lot {lot2_id}...")
    res = client.post(f"/lots/{lot2_id}/disputes", headers=collector_headers, json={
        "type": "WEIGHT_MISMATCH",
        "description": "Scale reading at pickup was 2kg lower than agreed weight.",
    })
    assert res.status_code in (200, 201), f"Dispute creation failed: {res.text}"
    dispute_id = res.json()["id"]
    print(f"  -> Dispute filed: ID={dispute_id}, Status={res.json().get('status')}")

    res = client.get("/disputes", headers=admin_headers)
    assert res.status_code == 200, f"Admin dispute listing failed: {res.text}"
    print(f"  -> Admin sees {len(res.json())} open dispute(s)")

    res = client.post(f"/disputes/{dispute_id}/resolve", headers=admin_headers, json={
        "resolution_note": "Verified weighbridge log; adjusted payment already reflects the shortfall.",
        "status": "RESOLVED",
    })
    assert res.status_code == 200, f"Dispute resolution failed: {res.text}"
    print(f"  -> Admin resolves dispute: Status={res.json().get('status')}")

    # -------------------------------------------------------------
    # 15. In-App Notifications Queue
    # -------------------------------------------------------------
    print(f"\n[Step 15] Collector checks in-app notifications...")
    res = client.get("/notifications", headers=collector_headers)
    assert res.status_code == 200, f"Notifications list failed: {res.text}"
    notifications = res.json()
    print(f"  -> Collector has {len(notifications)} notification(s)")
    if notifications:
        notif_id = notifications[0]["id"]
        res = client.post(f"/notifications/{notif_id}/read", headers=collector_headers)
        assert res.status_code == 200, f"Mark notification read failed: {res.text}"
        print(f"  -> Marked notification {notif_id} as read.")

    # -------------------------------------------------------------
    # 16. Recycler Pickup Group (Smart Lot Management - COMBINE)
    # -------------------------------------------------------------
    print(f"\n[Step 16] Recycler groups accepted lots into a pickup run...")
    res = client.post("/pickup-groups", headers=recycler_headers, json={"lot_ids": [lot_id]})
    assert res.status_code in (200, 201), f"Pickup group creation failed: {res.text}"
    print(f"  -> Pickup group created: {res.json()}")

    res = client.get("/pickup-groups", headers=recycler_headers, params={"recycler_id": recycler_id})
    assert res.status_code == 200, f"Pickup group listing failed: {res.text}"
    print(f"  -> Recycler has {len(res.json())} pickup group(s)")

    # -------------------------------------------------------------
    # 17. AI Multi-Item Detection & Classification (real image bytes)
    # -------------------------------------------------------------
    print(f"\n[Step 17] Collector snaps a photo for AI classification...")
    from io import BytesIO
    from PIL import Image
    img_buf = BytesIO()
    Image.new("RGB", (224, 224), color=(120, 90, 40)).save(img_buf, format="JPEG")
    img_buf.seek(0)
    res = client.post(
        "/ai/classify-material",
        headers=collector_headers,
        files={"photo": ("scrap.jpg", img_buf, "image/jpeg")},
    )
    assert res.status_code == 200, f"AI classify-material failed: {res.text}"
    ai_results = res.json()
    print(f"  -> AI returned {len(ai_results)} classification result(s)")
    if ai_results:
        first = ai_results[0]
        for key in ("result", "confidence", "reasoning", "source"):
            assert key in first, f"AI result missing required contract key '{key}': {first}"
        print(f"  -> Contract verified: result={first['result']}, confidence={first['confidence']}, source={first['source']}")

    print("\n" + "=" * 80)
    print("[SUCCESS] FULL WORKFLOW SIMULATION PASSED: ALL 17 STAGES SUCCEEDED WITH 0 ERRORS!")
    print("=" * 80)

if __name__ == "__main__":
    run_simulation()
