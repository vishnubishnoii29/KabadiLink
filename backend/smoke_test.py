import sys
import os
import unittest
from fastapi.testclient import TestClient

# Ensure workspace root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app
from backend.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    generate_otp_code
)
from backend.helpers import next_lot_id
from backend.services.matching import haversine_km
from backend.services.pricing import estimate_fair_price
from backend.services.anomaly import check_price_anomaly
from backend import inference as inference_module
from backend import ai_vision as ai_vision_module
from backend.services.classification import classify_photo


# --- Minimal fakes for DB-free unit tests of the pure business-logic branches ---

class _FakeCursor:
    def __init__(self, fetchall_result=None, fetchone_result=None):
        self._fetchall_result = fetchall_result or []
        self._fetchone_result = fetchone_result

    def execute(self, *args, **kwargs):
        pass

    def fetchall(self):
        return self._fetchall_result

    def fetchone(self):
        return self._fetchone_result

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor


# Phase 1 (02-backend-api.md) endpoints, as {method: path}
PHASE1_EXPECTED_ROUTES = {
    ("POST", "/lots/photo"), ("POST", "/lots/from-photo"), ("POST", "/lots"),
    ("GET", "/lots"), ("GET", "/lots/{lot_id}"), ("PUT", "/lots/{lot_id}"), ("DELETE", "/lots/{lot_id}"),
    ("GET", "/pickup-groups"), ("POST", "/pickup-groups"),
    ("GET", "/lots/{lot_id}/price-estimate"), ("GET", "/lots/{lot_id}/recyclers"),
    ("POST", "/lots/{lot_id}/offers"), ("GET", "/lots/{lot_id}/offers"),
    ("POST", "/offers/{offer_id}/counter"), ("POST", "/offers/{offer_id}/accept"), ("POST", "/offers/{offer_id}/reject"),
    ("GET", "/handover/{lot_id}"), ("POST", "/handover/{lot_id}/otp/generate"), ("POST", "/handover/{lot_id}/otp/verify"),
    ("POST", "/handover/{lot_id}/stage-offline"), ("POST", "/handover/{lot_id}/status"),
    ("POST", "/handover/{lot_id}/payment"), ("GET", "/passport/{lot_id}"),
    ("POST", "/lots/{lot_id}/disputes"), ("GET", "/disputes"), ("POST", "/disputes/{dispute_id}/resolve"),
    ("GET", "/recyclers/{recycler_id}"), ("PUT", "/recyclers/{recycler_id}"),
    ("POST", "/recyclers/{recycler_id}/verification-docs"),
    ("GET", "/recyclers/{recycler_id}/lots"), ("GET", "/recyclers/{recycler_id}/pickups"),
    ("POST", "/uploads/file"),
    ("GET", "/notifications"), ("POST", "/notifications/{notification_id}/read"),
    ("GET", "/lots/{lot_id}/epr-record"), ("GET", "/lots/{lot_id}/epr-certificate"),
    ("GET", "/admin/overview"), ("GET", "/admin/verification-queue"),
    ("POST", "/admin/verification-docs/{doc_id}/review"), ("GET", "/admin/audit-log"),
    ("GET", "/admin/impact-summary"), ("GET", "/collectors/{collector_id}/impact-summary"),
    ("POST", "/admin/dataset-export"), ("GET", "/admin/dataset-export/{export_id}"),
}

class SmokeTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_01_root_endpoint(self):
        """Test root / returns 200 with metadata."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")
        self.assertIn("docs", data)

    def test_02_health_dependency_free(self):
        """Test /health returns 200 with zero external dependencies."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("uptime_seconds", data)

    def test_03_password_hashing(self):
        """Test bcrypt password hashing and verification."""
        password = "SecurePassword123!"
        hashed = get_password_hash(password)
        self.assertNotEqual(password, hashed)
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_04_jwt_generation(self):
        """Test JWT token creation and payload structure."""
        user_id = "123e4567-e89b-12d3-a456-426614174000"
        token = create_access_token({"sub": user_id, "role": "COLLECTOR", "phone": "9876543210"})
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 20)

    def test_05_otp_generation(self):
        """Test numeric 6-digit OTP generator."""
        code = generate_otp_code()
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())

    def test_06_schema_sql_exists_and_valid(self):
        """Test that schema.sql is populated with the DDL definitions."""
        schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts", "schema.sql"))
        self.assertTrue(os.path.exists(schema_path), "schema.sql must exist")
        with open(schema_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("CREATE TABLE IF NOT EXISTS users", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS lots", content)
        self.assertIn("lot_code TEXT UNIQUE NOT NULL", content)
        self.assertIn("hazard_flags TEXT[]", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS transactions", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS epr_handover_records", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS audit_log", content)

    def test_07_phase1_routes_registered(self):
        """Test every Phase 1 endpoint (02-backend-api.md) is wired into the app."""
        openapi = self.client.get("/openapi.json").json()
        registered = {
            (method.upper(), path)
            for path, methods in openapi["paths"].items()
            for method in methods
        }
        missing = PHASE1_EXPECTED_ROUTES - registered
        self.assertEqual(missing, set(), f"Missing Phase 1 routes: {missing}")

    def test_08_haversine_distance(self):
        """Test the distance function used by recycler matching and pickup-group routing."""
        # Mumbai CST to Mumbai Airport, roughly 25-30km apart
        distance = haversine_km(18.9398, 72.8355, 19.0896, 72.8656)
        self.assertGreater(distance, 15)
        self.assertLess(distance, 40)
        self.assertAlmostEqual(haversine_km(12.34, 56.78, 12.34, 56.78), 0.0)

    def test_09_price_estimate_confidence_tiers(self):
        """Test the AI/ML-only-where-data-supports-it confidence-tier rule (03-ai-ml-pipeline.md)."""
        # No samples -> zeroed low-confidence result, not a fabricated number
        conn = _FakeConn(_FakeCursor(fetchall_result=[]))
        estimate = estimate_fair_price(conn, material_id=1)
        self.assertEqual(estimate["confidence"], "low")
        self.assertEqual(estimate["source"], "rule_based")
        self.assertEqual(estimate["sample_size"], 0)

        # Below MIN_SAMPLES_FOR_CONFIDENCE (8) -> low confidence, real range
        rows = [{"buying_price": float(p)} for p in [10, 12, 11, 9, 13]]
        conn = _FakeConn(_FakeCursor(fetchall_result=rows))
        estimate = estimate_fair_price(conn, material_id=1)
        self.assertEqual(estimate["confidence"], "low")
        self.assertEqual(estimate["sample_size"], 5)
        self.assertEqual(estimate["min"], 9)
        self.assertEqual(estimate["max"], 13)

        # >= MIN_SAMPLES_FOR_HIGH_CONFIDENCE (24) -> high confidence
        rows = [{"buying_price": float(p)} for p in range(1, 31)]
        conn = _FakeConn(_FakeCursor(fetchall_result=rows))
        estimate = estimate_fair_price(conn, material_id=1)
        self.assertEqual(estimate["confidence"], "high")
        self.assertEqual(estimate["sample_size"], 30)

    def test_10_price_anomaly_detection(self):
        """Test the rule-based deviation-from-mean anomaly thresholds."""
        # Not enough history -> NORMAL, no false positive
        conn = _FakeConn(_FakeCursor(fetchone_result={"avg_price": None, "n": 0}))
        result = check_price_anomaly(conn, material_id=1, price=1000, weight_kg=10)
        self.assertEqual(result["status"], "NORMAL")
        self.assertEqual(result["severity"], "none")

        # Price per kg matches average -> NORMAL
        conn = _FakeConn(_FakeCursor(fetchone_result={"avg_price": 100.0, "n": 10}))
        result = check_price_anomaly(conn, material_id=1, price=1000, weight_kg=10)
        self.assertEqual(result["status"], "NORMAL")

        # 70% above average -> high severity anomaly
        conn = _FakeConn(_FakeCursor(fetchone_result={"avg_price": 100.0, "n": 10}))
        result = check_price_anomaly(conn, material_id=1, price=1700, weight_kg=10)
        self.assertEqual(result["status"], "ANOMALOUS")
        self.assertEqual(result["severity"], "high")

    def test_11_error_response_shape(self):
        """Test every error comes back as {error:{code,message}}, not FastAPI's default {detail:...} envelope."""
        response = self.client.get("/auth/me")  # no Authorization header -> 401 via get_current_user
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertIn("error", data)
        self.assertIn("code", data["error"])
        self.assertIn("message", data["error"])
        self.assertNotIn("detail", data)

    def test_12_whatsapp_webhook_handshake(self):
        """Test Meta WhatsApp webhook verification handshake."""
        # Success handshake
        res = self.client.get("/whatsapp/webhook?hub.mode=subscribe&hub.challenge=12345678&hub.verify_token=kabadilink_verify_token")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.text, "12345678")

        # Invalid token rejection
        res_fail = self.client.get("/whatsapp/webhook?hub.mode=subscribe&hub.challenge=12345678&hub.verify_token=wrong_token")
        self.assertEqual(res_fail.status_code, 403)

    def test_13_whatsapp_webhook_inbound_ack(self):
        """Test Meta inbound webhook returns 200 immediately (<500ms)."""
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "messages": [{"from": "919876543210", "type": "text", "text": {"body": "help"}}]
                    }
                }]
            }]
        }
        res = self.client.post("/whatsapp/webhook", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "ok"})

    def test_14_whatsapp_simulate_help(self):
        """Test standing 'help' command returns command menu via simulate endpoint."""
        res = self.client.post("/whatsapp/simulate", json={"phone": "919876543210", "text": "help"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("KabadiLink Bot Commands", data["reply"])
        self.assertIn("sell", data["reply"])

    def test_15_ai_routes_registered(self):
        """Test the Phase 2 AI/ML pipeline endpoints (02-backend-api.md's routers/ai.py) are wired in."""
        openapi = self.client.get("/openapi.json").json()
        registered = {
            (method.upper(), path)
            for path, methods in openapi["paths"].items()
            for method in methods
        }
        expected = {
            ("POST", "/ai/classify-material"),
            ("GET", "/ai/estimate-price"),
            ("POST", "/ai/anomaly-check"),
        }
        self.assertEqual(expected - registered, set())

    def test_16_inference_reports_unavailable_without_trained_models(self):
        """Test detect_and_classify() degrades to [] rather than crashing when no ONNX models exist yet."""
        self.assertFalse(inference_module.models_available())
        self.assertEqual(inference_module.detect_and_classify(b"not-a-real-image"), [])

    def test_17_classify_photo_falls_back_to_rule_based(self):
        """Test the full pipeline still returns a contract-shaped result with no trained model or Gemini key."""
        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (100, 80), color=(10, 20, 30)).save(buf, format="JPEG")
        image_bytes = buf.getvalue()

        detections = classify_photo(image_bytes)
        self.assertEqual(len(detections), 1)
        d = detections[0]
        self.assertEqual(d["source"], "rule_based")
        self.assertEqual(d["material"], "OTHER")
        self.assertIn("reasoning", d)
        self.assertIn("needs_confirmation", d)
        self.assertTrue(d["needs_confirmation"])  # confidence 0.5 < AI_CONFIDENCE_THRESHOLD 0.70
        self.assertEqual(d["bbox"], [0, 0, 100, 80])

    def test_18_ai_vision_falls_back_without_api_key(self):
        """Test cloud verification is a no-op passthrough when GEMINI_API_KEY isn't configured (zero-cost fallback)."""
        local_detections = [{"bbox": [0, 0, 10, 10], "material": "PCB", "confidence": 0.6, "source": "local_model"}]
        result = ai_vision_module.verify_material_batch(b"fake-image-bytes", local_detections)
        self.assertEqual(result, local_detections)

    def test_19_classify_material_endpoint_returns_ai_result_contract(self):
        """Test POST /ai/classify-material's wire response matches the shared AIResult contract, not the internal detection shape."""
        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (60, 40), color=(5, 5, 5)).save(buf, format="JPEG")

        token = create_access_token({"sub": "123e4567-e89b-12d3-a456-426614174000", "role": "COLLECTOR", "phone": "9876543210"})
        res = self.client.post(
            "/ai/classify-material",
            files={"photo": ("test.jpg", buf.getvalue(), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        item = data[0]
        self.assertIn("result", item)
        self.assertIn("confidence", item)
        self.assertIn("reasoning", item)
        self.assertIn("source", item)
        self.assertEqual(item["result"], "OTHER")
        self.assertNotIn("material", item)  # AIResult uses "result", not the internal detection key

    def test_20_attach_role_scoped_id_collector(self):
        """Test /auth/me enrichment adds collector_id for COLLECTOR role."""
        from backend.services.users import attach_role_scoped_id
        conn = _FakeConn(_FakeCursor(fetchone_result={"id": "c-123"}))
        profile = {"id": "u-1", "role": "COLLECTOR", "phone": "9999999999"}
        result = attach_role_scoped_id(conn, profile)
        self.assertEqual(result["collector_id"], "c-123")
        self.assertNotIn("recycler_id", result)

    def test_21_attach_role_scoped_id_recycler_missing_row(self):
        """Test /auth/me enrichment returns None, not a crash, when no recycler row exists yet."""
        from backend.services.users import attach_role_scoped_id
        conn = _FakeConn(_FakeCursor(fetchone_result=None))
        profile = {"id": "u-2", "role": "RECYCLER", "phone": "8888888888"}
        result = attach_role_scoped_id(conn, profile)
        self.assertIsNone(result["recycler_id"])

    def test_22_attach_role_scoped_id_admin_untouched(self):
        """Test /auth/me enrichment is a no-op for ADMIN (no collectors/recyclers row to look up)."""
        from backend.services.users import attach_role_scoped_id
        conn = _FakeConn(_FakeCursor(fetchone_result=None))
        profile = {"id": "u-3", "role": "ADMIN", "phone": "7777777777"}
        result = attach_role_scoped_id(conn, profile)
        self.assertNotIn("collector_id", result)
        self.assertNotIn("recycler_id", result)

    def test_23_list_safety_content_filters(self):
        """Test list_safety_content returns rows and defaults language to 'en'."""
        from backend.services.safety import list_safety_content
        rows = [{"id": 1, "material_code": "BATTERY", "language": "en",
                 "content_type": "ISL_VIDEO", "content_url": "https://example.com/isl-battery.mp4"}]
        conn = _FakeConn(_FakeCursor(fetchall_result=rows))
        result = list_safety_content(conn, "BATTERY", content_type="ISL_VIDEO")
        self.assertEqual(result, rows)

    def test_24_safety_content_route_registered(self):
        """Test GET /safety-content is wired into the app."""
        openapi = self.client.get("/openapi.json").json()
        registered = {
            (method.upper(), path)
            for path, methods in openapi["paths"].items()
            for method in methods
        }
        self.assertIn(("GET", "/safety-content"), registered)

    def test_25_list_safety_content_accepts_pagination(self):
        """Test list_safety_content threads limit/offset through without error (02-backend-api.md's
        cross-cutting list-endpoint pagination convention: default limit 50)."""
        from backend.services.safety import list_safety_content
        rows = [{"id": 1, "material_code": "BATTERY", "language": "en",
                 "content_type": "ISL_VIDEO", "content_url": "https://example.com/isl-battery.mp4"}]
        conn = _FakeConn(_FakeCursor(fetchall_result=rows))
        result = list_safety_content(conn, "BATTERY", limit=10, offset=20)
        self.assertEqual(result, rows)

if __name__ == "__main__":
    print("Running KabadiLink Smoke Tests...")
    unittest.main(verbosity=2)
