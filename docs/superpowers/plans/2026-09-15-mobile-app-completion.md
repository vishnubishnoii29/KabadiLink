# Mobile App Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `mobile/` up to the screens and offline-sync behavior required by `05-mobile-app.md`, wiring it to the already-complete backend (`backend/`) the same way `web/src/api.js` does.

**Architecture:** Add a thin `ApiClient` (HTTP + JWT) and a `Repository` facade (offline-aware: queues writes to the existing `pending_ops` outbox when offline, calls the API directly when online, and drains the outbox on reconnect) that every screen calls instead of touching `OfflineDatabase` or `http` directly. Build the three missing screens (`lots_page.dart`, `passport_page.dart`, `earnings_page.dart`) and fix the two existing ones (`sell_wizard.dart`, `handover_page.dart`) to use the new layer instead of a broken hand-rolled offline queue. Add a minimal OTP login screen and a low-literacy display toggle, since neither exists yet and the repository layer needs an authenticated identity to call anything.

**Tech Stack:** Flutter (existing: sqflite, http, shared_preferences, uuid, camera, flutter_tts, tflite_flutter), FastAPI/Postgres backend (existing, unchanged except two additive endpoints).

**Spec:** `05-mobile-app.md` (mobile screens), `02-backend-api.md` (endpoint contracts), `07-deployment.md` (n/a to this plan). Executors should read `05-mobile-app.md` in full before Task 7 onward.

## Global Constraints

- **Weight is always entered manually by the collector, never estimated from a photo** (`05-mobile-app.md`, `00-master-plan.md` rule 2) — every screen that touches weight must keep this.
- **Offline handover**: intent + measured weight stage locally as `READY_TO_VERIFY`, queued in `pending_ops` with `client_uid` dedup; actual `COMPLETED` status is never set client-side — only the server, via `POST /handover/{lot_id}/otp/verify`, after connectivity returns (`05-mobile-app.md`).
- **Every AI-producing response is `{result, confidence, reasoning, source}`** — this plan does not touch AI responses directly, but any screen that renders one must show `confidence` and `reasoning`, not just the number (`00-master-plan.md` rule 2).
- **Don't invent a second offline-sync mechanism** — every offline-created write goes through `OfflineDatabase.queueOperation()` (existing `pending_ops` + `client_uid` pattern), never a new local table or queue.
- **No SMS, no proactive push** — OTP delivery in this plan uses `DEV_LOG` (existing backend default), matching `07-deployment.md`.
- **This session's environment has no Flutter/Dart SDK installed.** Every step below that would normally run `flutter test` / `flutter analyze` / `flutter pub get` is written as a step for **you (the human or the executor running with real tool access)** to run locally — the plan-writer could not execute or verify any Dart code in this repo. Treat every "Run (you, locally):" line as unverified until you've actually run it, and report failures back before moving to the next task.
- Backend changes in Task 1 run in a real `.venv` with `pytest` — those **are** executable and must actually pass before moving on.

---

## Task 1: Backend — expose `collector_id`/`recycler_id` on `/auth/me`, add `GET /safety-content`

The mobile app has no way to learn its own `collector_id` (needed to filter "my lots"/"my earnings") and there is no endpoint at all for `safety_content` (needed for the ISL video screen in Task 12). Both are small, additive, backend-only gaps blocking the mobile work — fix them first, the mobile client depends on both.

**Files:**
- Create: `backend/services/users.py`
- Create: `backend/services/safety.py`
- Create: `backend/routers/safety.py`
- Modify: `backend/routers/auth.py` (the `get_me` function, currently `backend/routers/auth.py:164-167`)
- Modify: `backend/main.py` (router registration, `backend/main.py:11-14` and `:77-89`)
- Test: `backend/smoke_test.py`

**Interfaces:**
- Produces: `backend.services.users.attach_role_scoped_id(conn, profile: dict) -> dict` — takes the `current_user` dict (`id`, `phone`, `role`, ...), returns it with `collector_id` (if role is `COLLECTOR`) or `recycler_id` (if role is `RECYCLER`) added, `None` if no matching row exists yet.
- Produces: `backend.services.safety.list_safety_content(conn, material_code: str, content_type: Optional[str] = None, language: str = "en") -> list[dict]` — rows from `safety_content` filtered by `material_code` (required), `content_type` (optional, one of `TEXT`/`AUDIO`/`ISL_VIDEO`), `language` (default `en`).
- Consumes: existing `backend.db.get_db_connection`, existing `backend.auth.get_current_user`, existing `backend.helpers.api_error`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/smoke_test.py`, after `test_08_haversine_distance` (keep numbering sequential with whatever the last test number is when you land this — check the file first, don't guess a number that collides):

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Users\vishn\Personal\GREAT AIM\Sihh" && .venv/Scripts/python.exe -m pytest backend/smoke_test.py -k "test_20 or test_21 or test_22 or test_23 or test_24" -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'backend.services.users'` (and similar for `safety`).

- [ ] **Step 3: Create `backend/services/users.py`**

```python
import logging
from typing import Any, Dict

logger = logging.getLogger("kabadilink.services.users")


def attach_role_scoped_id(conn: Any, profile: Dict[str, Any]) -> Dict[str, Any]:
    """Adds collector_id or recycler_id to a /auth/me profile dict, based on role.

    The JWT only carries the user's row in `users`; clients (mobile especially) need
    their `collectors.id` / `recyclers.id` to scope "my lots" / "my earnings" queries,
    and there was previously no way to learn it after login.
    """
    role = profile.get("role")
    if role == "COLLECTOR":
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM collectors WHERE user_id = %s;", (profile["id"],))
            row = cur.fetchone()
        profile["collector_id"] = str(row["id"]) if row else None
    elif role == "RECYCLER":
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recyclers WHERE user_id = %s;", (profile["id"],))
            row = cur.fetchone()
        profile["recycler_id"] = str(row["id"]) if row else None
    return profile
```

- [ ] **Step 4: Create `backend/services/safety.py`**

```python
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("kabadilink.services.safety")


def list_safety_content(
    conn: Any,
    material_code: str,
    content_type: Optional[str] = None,
    language: str = "en",
) -> List[Dict[str, Any]]:
    clauses = ["material_code = %s", "language = %s"]
    params: List[Any] = [material_code, language]
    if content_type:
        clauses.append("content_type = %s")
        params.append(content_type)

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id, material_code, language, content_type, content_url "
            f"FROM safety_content WHERE {' AND '.join(clauses)} ORDER BY id;",
            params,
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]
```

- [ ] **Step 5: Create `backend/routers/safety.py`**

```python
import logging
from typing import Optional

from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.services import safety as safety_service

logger = logging.getLogger("kabadilink.routers.safety")
router = APIRouter(tags=["Safety"])


@router.get("/safety-content")
def get_safety_content(
    material_code: str,
    content_type: Optional[str] = None,
    language: str = "en",
    current_user: dict = Depends(get_current_user),
):
    with get_db_connection() as conn:
        return safety_service.list_safety_content(conn, material_code, content_type, language)
```

- [ ] **Step 6: Modify `backend/routers/auth.py`'s `get_me`**

Find (`backend/routers/auth.py:164-167`):

```python
@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the authenticated user profile."""
    return current_user
```

Replace with:

```python
@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the authenticated user profile, plus collector_id/recycler_id if applicable."""
    with get_db_connection() as conn:
        return users_service.attach_role_scoped_id(conn, dict(current_user))
```

Add the import near the top of the file, alongside the existing `from backend.helpers import audit`:

```python
from backend.services import users as users_service
```

And confirm `get_db_connection` is imported (it already is, `backend/routers/auth.py:5`).

- [ ] **Step 7: Register the new router in `backend/main.py`**

Find (`backend/main.py:11-14`):

```python
from backend.routers import (
    health, auth, lots, offers, recyclers, handover, disputes,
    notifications, epr, admin, uploads, whatsapp, ai,
)
```

Replace with:

```python
from backend.routers import (
    health, auth, lots, offers, recyclers, handover, disputes,
    notifications, epr, admin, uploads, whatsapp, ai, safety,
)
```

Find (`backend/main.py:88-89`):

```python
app.include_router(whatsapp.router)
app.include_router(ai.router)
```

Replace with:

```python
app.include_router(whatsapp.router)
app.include_router(ai.router)
app.include_router(safety.router)
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd "C:\Users\vishn\Personal\GREAT AIM\Sihh" && .venv/Scripts/python.exe -m pytest backend/smoke_test.py -v`

Expected: all tests pass, including the 5 new ones and the pre-existing 19.

- [ ] **Step 9: Commit**

```bash
git add backend/services/users.py backend/services/safety.py backend/routers/safety.py backend/routers/auth.py backend/main.py backend/smoke_test.py
git commit -m "feat(backend): expose collector_id/recycler_id on /auth/me, add GET /safety-content"
```

---

## Task 2: Mobile — `lib/data/api_client.dart`

The HTTP client every other mobile task depends on. Mirrors `web/src/api.js` method-for-method so the two clients stay in sync with the same backend contract.

**Files:**
- Create: `mobile/lib/data/api_client.dart`
- Test: `mobile/test/data/api_client_test.dart`

**Interfaces:**
- Consumes: `mobile/lib/core/config.dart`'s `AppConfig.apiUrl` (existing).
- Produces: `ApiClient.instance` (singleton), `ApiException(status, code, message)`, and the methods listed in Step 3 below — every later mobile task calls these, not raw `http`.

- [ ] **Step 1: Write `mobile/lib/data/api_client.dart`**

```dart
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../core/config.dart';

class ApiException implements Exception {
  final int status;
  final String code;
  final String message;
  ApiException(this.status, this.code, this.message);

  @override
  String toString() => message;
}

/// Decodes an HTTP response the same way `web/src/api.js`'s `request()` does:
/// only a 204 short-circuits to null unconditionally; any other empty or
/// unparseable body decodes to null and falls through to the status check,
/// so a non-2xx response with an empty/malformed body still throws
/// ApiException instead of being silently treated as success. Top-level
/// (not a private method on ApiClient) so it's directly testable — Dart's
/// per-library privacy means a test file in a different library can't
/// reach a `_`-prefixed instance method via a `dynamic` cast.
@visibleForTesting
dynamic decodeApiResponse(http.Response res) {
  if (res.statusCode == 204) return null;
  dynamic data;
  try {
    data = res.body.isEmpty ? null : jsonDecode(res.body);
  } catch (_) {
    data = null;
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    final err = (data is Map) ? data['error'] : null;
    throw ApiException(
      res.statusCode,
      (err is Map ? err['code'] as String? : null) ?? 'API_ERROR',
      (err is Map ? err['message'] as String? : null) ?? (res.reasonPhrase ?? 'Request failed'),
    );
  }
  return data;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  String? _token;

  bool get isAuthenticated => _token != null;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('kabadilink_token');
  }

  Future<void> setToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('kabadilink_token', token);
  }

  Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('kabadilink_token');
  }

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final cleanQuery = <String, String>{};
    query?.forEach((k, v) {
      if (v != null) cleanQuery[k] = v.toString();
    });
    return Uri.parse('${AppConfig.apiUrl}$path')
        .replace(queryParameters: cleanQuery.isEmpty ? null : cleanQuery);
  }

  Map<String, String> _headers() {
    final h = <String, String>{'Content-Type': 'application/json'};
    if (_token != null) h['Authorization'] = 'Bearer $_token';
    return h;
  }

  dynamic _decode(http.Response res) => decodeApiResponse(res);

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final res = await http.get(_uri(path, query), headers: _headers()).timeout(const Duration(seconds: 15));
    return _decode(res);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final res = await http
        .post(_uri(path), headers: _headers(), body: body != null ? jsonEncode(body) : null)
        .timeout(const Duration(seconds: 15));
    return _decode(res);
  }

  Future<bool> isOnline() async {
    try {
      final res = await http.get(Uri.parse('${AppConfig.apiUrl}/health')).timeout(const Duration(seconds: 3));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // --- Auth ---
  Future<Map<String, dynamic>> requestOtp(String phone, {String delivery = 'DEV_LOG'}) async =>
      (await post('/auth/otp/request', body: {'phone': phone, 'delivery': delivery})) as Map<String, dynamic>;

  Future<Map<String, dynamic>> verifyOtp(String phone, String code) async =>
      (await post('/auth/otp/verify', body: {'phone': phone, 'code': code})) as Map<String, dynamic>;

  Future<Map<String, dynamic>> getMe() async => (await get('/auth/me')) as Map<String, dynamic>;

  // --- Lots ---
  Future<Map<String, dynamic>> createLotManual(Map<String, dynamic> payload) async =>
      (await post('/lots', body: payload)) as Map<String, dynamic>;

  Future<List<dynamic>> listLots({String? status, String? collectorId}) async =>
      (await get('/lots', query: {'status': status, 'collector_id': collectorId})) as List<dynamic>;

  Future<Map<String, dynamic>> getLot(String id) async => (await get('/lots/$id')) as Map<String, dynamic>;

  Future<Map<String, dynamic>> getPriceEstimate(String lotId) async =>
      (await get('/lots/$lotId/price-estimate')) as Map<String, dynamic>;

  // --- Offers ---
  Future<List<dynamic>> listOffersForLot(String lotId) async =>
      (await get('/lots/$lotId/offers')) as List<dynamic>;

  Future<Map<String, dynamic>> acceptOffer(String offerId) async =>
      (await post('/offers/$offerId/accept')) as Map<String, dynamic>;

  Future<Map<String, dynamic>> rejectOffer(String offerId) async =>
      (await post('/offers/$offerId/reject')) as Map<String, dynamic>;

  Future<Map<String, dynamic>> counterOffer(String offerId, double price) async =>
      (await post('/offers/$offerId/counter', body: {'price': price})) as Map<String, dynamic>;

  // --- Handover ---
  Future<Map<String, dynamic>> getHandover(String lotId) async =>
      (await get('/handover/$lotId')) as Map<String, dynamic>;

  Future<Map<String, dynamic>> generateHandoverOtp(String lotId) async =>
      (await post('/handover/$lotId/otp/generate')) as Map<String, dynamic>;

  Future<Map<String, dynamic>> verifyHandoverOtp(String lotId, String code, {double? actualWeightKg}) async =>
      (await post('/handover/$lotId/otp/verify', body: {
        'code': code,
        if (actualWeightKg != null) 'actual_weight_kg': actualWeightKg,
      })) as Map<String, dynamic>;

  Future<Map<String, dynamic>> stageHandoverOffline(String lotId, double actualWeightKg) async =>
      (await post('/handover/$lotId/stage-offline', body: {'actual_weight_kg': actualWeightKg}))
          as Map<String, dynamic>;

  Future<Map<String, dynamic>> recordPayment(String lotId, double amount, String method) async =>
      (await post('/handover/$lotId/payment', body: {'amount': amount, 'method': method}))
          as Map<String, dynamic>;

  Future<Map<String, dynamic>> getPassport(String lotId) async =>
      (await get('/passport/$lotId')) as Map<String, dynamic>;

  Future<Map<String, dynamic>> getEprRecord(String lotId) async =>
      (await get('/lots/$lotId/epr-record')) as Map<String, dynamic>;

  // --- Disputes ---
  Future<Map<String, dynamic>> createDispute(String lotId, Map<String, dynamic> payload) async =>
      (await post('/lots/$lotId/disputes', body: payload)) as Map<String, dynamic>;

  // --- Notifications ---
  Future<List<dynamic>> getNotifications() async => (await get('/notifications')) as List<dynamic>;

  Future<void> markNotificationRead(String id) => post('/notifications/$id/read');

  // --- Impact ---
  Future<Map<String, dynamic>> getCollectorImpact(String collectorId) async =>
      (await get('/collectors/$collectorId/impact-summary')) as Map<String, dynamic>;

  // --- Safety content ---
  Future<List<dynamic>> getSafetyContent({required String materialCode, String? contentType}) async =>
      (await get('/safety-content', query: {
        'material_code': materialCode,
        'content_type': contentType,
      })) as List<dynamic>;
}
```

- [ ] **Step 2: Write `mobile/test/data/api_client_test.dart`**

This tests the pure, network-free logic (URI building, error decoding) without hitting a real server.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:kabadilink_mobile/data/api_client.dart';

void main() {
  group('decodeApiResponse', () {
    test('non-2xx response throws ApiException with server-provided code/message', () {
      final res = http.Response(
        '{"error": {"code": "LOT_NOT_FOUND", "message": "Lot not found"}}',
        404,
      );
      expect(
        () => decodeApiResponse(res),
        throwsA(isA<ApiException>()
            .having((e) => e.status, 'status', 404)
            .having((e) => e.code, 'code', 'LOT_NOT_FOUND')),
      );
    });

    test('204 response decodes to null', () {
      final res = http.Response('', 204);
      expect(decodeApiResponse(res), isNull);
    });

    test('non-2xx response with an empty body still throws, not silently null', () {
      final res = http.Response('', 500);
      expect(() => decodeApiResponse(res), throwsA(isA<ApiException>().having((e) => e.status, 'status', 500)));
    });

    test('non-2xx response with a malformed (non-JSON) body throws ApiException, not FormatException', () {
      final res = http.Response('<html>Bad Gateway</html>', 502);
      expect(() => decodeApiResponse(res), throwsA(isA<ApiException>().having((e) => e.status, 'status', 502)));
    });
  });
}
```

- [ ] **Step 3: Run tests (you, locally — flutter SDK not available in this session)**

Run: `cd mobile && flutter pub get && flutter test test/data/api_client_test.dart`

Expected: PASS, all 4 cases.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/data/api_client.dart mobile/test/data/api_client_test.dart
git commit -m "feat(mobile): add ApiClient HTTP layer mirroring web/src/api.js"
```

---

## Task 3: Mobile — `lib/data/repository.dart` (offline-aware facade + sync engine)

**Files:**
- Create: `mobile/lib/data/repository.dart`
- Modify: `mobile/lib/data/offline_db.dart` (no schema change — just confirms the JSON-encoding bug fix lives in the repository, not here)
- Test: `mobile/test/data/repository_sync_test.dart`

**Interfaces:**
- Consumes: `ApiClient.instance` (Task 2), `OfflineDatabase.instance` (existing, `mobile/lib/data/offline_db.dart`).
- Produces: `Repository.instance` with `bootstrap()`, `isAuthenticated`, `collectorId`, `loginWithOtp()`, `requestOtp()`, `logout()`, `isOnline()`, `queueCreateLot()`, `getMyLots()`, `getLot()`, `getPriceEstimate()`, `getOffers()`, `acceptOffer()`, `rejectOffer()`, `counterOffer()`, `getHandover()`, `generateHandoverOtp()`, `verifyHandoverOtp()`, `recordPayment()`, `queueOfflineHandover()`, `getPassport()`, `getEprRecord()`, `createDispute()`, `getNotifications()`, `markNotificationRead()`, `getImpactSummary()`, `getSafetyContent()`, `syncPendingOps()` — every screen task from here on calls only these, never `ApiClient`/`OfflineDatabase` directly.

- [ ] **Step 1: Write `mobile/lib/data/repository.dart`**

```dart
import 'dart:convert';
import 'package:uuid/uuid.dart';
import 'api_client.dart';
import 'offline_db.dart';

class SyncResult {
  final int synced;
  final int failed;
  const SyncResult(this.synced, this.failed);
}

class Repository {
  Repository._();
  static final Repository instance = Repository._();

  final ApiClient _api = ApiClient.instance;
  final OfflineDatabase _db = OfflineDatabase.instance;

  String? collectorId;
  String? userId;

  bool get isAuthenticated => _api.isAuthenticated;

  Future<void> bootstrap() async {
    await _api.loadToken();
    if (!_api.isAuthenticated) return;
    try {
      final me = await _api.getMe();
      userId = me['id']?.toString();
      collectorId = me['collector_id']?.toString();
    } catch (_) {
      // Token expired or server unreachable at startup; screens check
      // isAuthenticated + collectorId and fall back to empty states.
    }
  }

  Future<void> requestOtp(String phone) => _api.requestOtp(phone, delivery: 'DEV_LOG');

  Future<void> loginWithOtp(String phone, String code) async {
    final result = await _api.verifyOtp(phone, code);
    await _api.setToken(result['token'] as String);
    final me = await _api.getMe();
    userId = me['id']?.toString();
    collectorId = me['collector_id']?.toString();
  }

  Future<void> logout() async {
    await _api.clearToken();
    userId = null;
    collectorId = null;
  }

  Future<bool> isOnline() => _api.isOnline();

  // --- Lots ---
  Future<void> queueCreateLot(Map<String, dynamic> payload) async {
    final clientUid = const Uuid().v4();
    payload['client_uid'] = clientUid;
    await _db.queueOperation(
      clientUid: clientUid,
      opType: 'CREATE_LOT',
      payloadJson: jsonEncode(payload),
    );
  }

  Future<List<dynamic>> getMyLots({String? status}) {
    if (collectorId == null) return Future.value(const []);
    return _api.listLots(status: status, collectorId: collectorId);
  }

  Future<Map<String, dynamic>> getLot(String lotId) => _api.getLot(lotId);
  Future<Map<String, dynamic>> getPriceEstimate(String lotId) => _api.getPriceEstimate(lotId);

  // --- Offers ---
  Future<List<dynamic>> getOffers(String lotId) => _api.listOffersForLot(lotId);
  Future<void> acceptOffer(String offerId) => _api.acceptOffer(offerId);
  Future<void> rejectOffer(String offerId) => _api.rejectOffer(offerId);
  Future<void> counterOffer(String offerId, double price) => _api.counterOffer(offerId, price);

  // --- Handover ---
  Future<Map<String, dynamic>> getHandover(String lotId) => _api.getHandover(lotId);

  Future<String> generateHandoverOtp(String lotId) async {
    final res = await _api.generateHandoverOtp(lotId);
    return res['otp_code'] as String;
  }

  Future<void> verifyHandoverOtp(String lotId, String code, {double? actualWeightKg}) =>
      _api.verifyHandoverOtp(lotId, code, actualWeightKg: actualWeightKg);

  Future<void> recordPayment(String lotId, double amount, String method) =>
      _api.recordPayment(lotId, amount, method);

  Future<void> queueOfflineHandover(String lotId, double actualWeightKg, String paymentMethod) async {
    final clientUid = const Uuid().v4();
    final payload = {
      'lot_id': lotId,
      'actual_weight_kg': actualWeightKg,
      'payment_method': paymentMethod,
      'client_uid': clientUid,
    };
    await _db.queueOperation(
      clientUid: clientUid,
      opType: 'STAGE_OFFLINE_HANDOVER',
      payloadJson: jsonEncode(payload),
    );
  }

  Future<Map<String, dynamic>> getPassport(String lotId) => _api.getPassport(lotId);
  Future<Map<String, dynamic>> getEprRecord(String lotId) => _api.getEprRecord(lotId);

  // --- Disputes ---
  Future<void> createDispute(String lotId, String type, String description, {String? evidencePhotoUrl}) =>
      _api.createDispute(lotId, {
        'type': type,
        'description': description,
        if (evidencePhotoUrl != null) 'evidence_photo_url': evidencePhotoUrl,
      });

  // --- Notifications ---
  Future<List<dynamic>> getNotifications() => _api.getNotifications();
  Future<void> markNotificationRead(String id) => _api.markNotificationRead(id);

  // --- Impact ---
  Future<Map<String, dynamic>?> getImpactSummary() {
    if (collectorId == null) return Future.value(null);
    return _api.getCollectorImpact(collectorId!);
  }

  // --- Safety content ---
  Future<List<dynamic>> getSafetyContent(String materialCode, {String contentType = 'ISL_VIDEO'}) =>
      _api.getSafetyContent(materialCode: materialCode, contentType: contentType);

  // --- Sync engine: drains pending_ops to the backend, in FIFO order ---
  Future<SyncResult> syncPendingOps() async {
    if (!_api.isAuthenticated) return const SyncResult(0, 0);
    final ops = await _db.getPendingOperations();
    int synced = 0, failed = 0;
    for (final op in ops) {
      final opType = op['op_type'] as String;
      if (opType != 'CREATE_LOT' && opType != 'STAGE_OFFLINE_HANDOVER') {
        continue; // Unrecognized op from a different build; leave PENDING for manual review.
      }
      try {
        // Decode inside the try: a malformed payload_json (should never happen —
        // both queue methods write via jsonEncode — but if it ever did) must fail
        // just this one op, not abort the loop for every later PENDING row.
        final payload = jsonDecode(op['payload_json'] as String) as Map<String, dynamic>;
        if (opType == 'CREATE_LOT') {
          await _api.createLotManual(payload);
        } else {
          await _api.stageHandoverOffline(
            payload['lot_id'] as String,
            (payload['actual_weight_kg'] as num).toDouble(),
          );
        }
        await _db.markOperationCompleted(op['id'] as int);
        synced++;
      } catch (_) {
        failed++; // Left PENDING; retried next time syncPendingOps() runs.
      }
    }
    return SyncResult(synced, failed);
  }
}
```

- [ ] **Step 2: Write `mobile/test/data/repository_sync_test.dart`**

This is the test that actually matters most in this task: it catches the `payload.toString()` bug (a Dart `Map.toString()` is not valid JSON — `{material_code: PCB, weight_kg: 2.5}` not `{"material_code":"PCB","weight_kg":2.5}`) that both existing screens currently have. It verifies `queueCreateLot` writes real, parseable JSON.

```dart
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:kabadilink_mobile/data/repository.dart';
import 'package:kabadilink_mobile/data/offline_db.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  test('queueCreateLot writes valid, round-trippable JSON to pending_ops', () async {
    await Repository.instance.queueCreateLot({
      'material_code': 'PCB',
      'weight_kg': 2.5,
      'condition': 'fair',
    });

    final ops = await OfflineDatabase.instance.getPendingOperations();
    expect(ops, isNotEmpty);
    final last = ops.last;
    expect(last['op_type'], 'CREATE_LOT');

    // The regression this guards against: json.decode must not throw.
    final decoded = jsonDecode(last['payload_json'] as String) as Map<String, dynamic>;
    expect(decoded['material_code'], 'PCB');
    expect(decoded['weight_kg'], 2.5);
    expect(decoded['client_uid'], isNotEmpty);
  });
}
```

Add `sqflite_common_ffi` as a dev dependency (needed to run `sqflite` against an in-memory DB under plain `flutter test`, since the plugin's real implementation needs a device/emulator):

Modify `mobile/pubspec.yaml`'s `dev_dependencies:` block (currently `mobile/pubspec.yaml:21-24`):

```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
  sqflite_common_ffi: ^2.3.3
```

- [ ] **Step 3: Run tests (you, locally)**

Run: `cd mobile && flutter pub get && flutter test test/data/repository_sync_test.dart`

Expected: PASS, and specifically confirms `jsonDecode` doesn't throw — this is the regression check for the bug in the current `sell_wizard.dart`/`handover_page.dart`.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/data/repository.dart mobile/test/data/repository_sync_test.dart mobile/pubspec.yaml
git commit -m "feat(mobile): add offline-aware Repository facade with a JSON-safe sync engine"
```

---

## Task 4: Mobile — `lib/core/app_settings.dart` (low-literacy mode toggle)

Standalone, no dependency on Tasks 2/3. Cross-cutting per `05-mobile-app.md`'s "Voice + visual, low-literacy mode" section.

**Files:**
- Create: `mobile/lib/core/app_settings.dart`

**Interfaces:**
- Produces: `AppSettings.instance` with `lowLiteracyMode` (a `ValueNotifier<bool>`), `load()`, `setLowLiteracyMode(bool)` — consumed by Task 6 (`main.dart`) for the font-scale toggle and by Task 7/9 for voice-guided prompts.

- [ ] **Step 1: Write `mobile/lib/core/app_settings.dart`**

```dart
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppSettings {
  AppSettings._();
  static final AppSettings instance = AppSettings._();

  final ValueNotifier<bool> lowLiteracyMode = ValueNotifier<bool>(false);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    lowLiteracyMode.value = prefs.getBool('low_literacy_mode') ?? false;
  }

  Future<void> setLowLiteracyMode(bool value) async {
    lowLiteracyMode.value = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('low_literacy_mode', value);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/core/app_settings.dart
git commit -m "feat(mobile): add AppSettings singleton for the low-literacy display toggle"
```

---

## Task 5: Mobile — `lib/ui/auth/login_page.dart`

Not explicitly listed as a screen in `05-mobile-app.md` (the spec assumes an identity already exists), but without it `Repository` has no token to attach to requests and nothing else in this plan can call the API. Uses the existing `DEV_LOG` OTP delivery mode already wired in the backend (`backend/config.py:33`, `02-backend-api.md`'s `/auth/otp/request`).

**Files:**
- Create: `mobile/lib/ui/auth/login_page.dart`

**Interfaces:**
- Consumes: `Repository.instance.requestOtp()`, `Repository.instance.loginWithOtp()` (Task 3).
- Produces: `LoginPage(onLoggedIn: VoidCallback)` — consumed by Task 6's `_AuthGate`.

- [ ] **Step 1: Write `mobile/lib/ui/auth/login_page.dart`**

```dart
import 'package:flutter/material.dart';
import '../../data/repository.dart';

class LoginPage extends StatefulWidget {
  final VoidCallback onLoggedIn;
  const LoginPage({Key? key, required this.onLoggedIn}) : super(key: key);

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  bool _otpSent = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _requestOtp() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Repository.instance.requestOtp(_phoneController.text.trim());
      setState(() => _otpSent = true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Repository.instance.loginWithOtp(_phoneController.text.trim(), _codeController.text.trim());
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KabadiLink Login'), backgroundColor: Colors.teal),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              enabled: !_otpSent,
              decoration: const InputDecoration(labelText: 'Phone number', border: OutlineInputBorder()),
            ),
            if (_otpSent) ...[
              const SizedBox(height: 16),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'OTP code', border: OutlineInputBorder()),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
              onPressed: _loading ? null : (_otpSent ? _verifyOtp : _requestOtp),
              child: _loading
                  ? const SizedBox(
                      width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text(_otpSent ? 'Verify & Log In' : 'Send OTP', style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/ui/auth/login_page.dart
git commit -m "feat(mobile): add OTP login screen (DEV_LOG delivery)"
```

---

## Task 6: Mobile — rewire `main.dart` (auth gate, 5-tab nav, low-literacy toggle)

**Files:**
- Modify: `mobile/lib/main.dart` (full-file rewrite — current file is only 60 lines and every part of it changes)

**Interfaces:**
- Consumes: `AppSettings.instance` (Task 4), `Repository.instance` (Task 3), `LoginPage` (Task 5), `SellWizardPage` (existing, fixed in Task 7), `LotsPage` (Task 9), `PassportPage` (Task 10), `EarningsPage` (Task 11), `SafetyGuidePage` (existing, fixed in Task 12).

- [ ] **Step 1: Replace `mobile/lib/main.dart` in full**

```dart
import 'package:flutter/material.dart';
import 'core/app_settings.dart';
import 'core/config.dart';
import 'data/repository.dart';
import 'ui/auth/login_page.dart';
import 'ui/collector/sell_wizard.dart';
import 'ui/collector/lots_page.dart';
import 'ui/collector/passport_page.dart';
import 'ui/collector/earnings_page.dart';
import 'ui/collector/safety_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppSettings.instance.load();
  await Repository.instance.bootstrap();
  runApp(const KabadiLinkMobileApp());
}

class KabadiLinkMobileApp extends StatelessWidget {
  const KabadiLinkMobileApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: AppSettings.instance.lowLiteracyMode,
      builder: (context, lowLiteracy, _) {
        return MaterialApp(
          title: AppConfig.appName,
          theme: ThemeData(
            primarySwatch: Colors.teal,
            useMaterial3: true,
            visualDensity: lowLiteracy ? VisualDensity.comfortable : VisualDensity.standard,
            textTheme: lowLiteracy
                ? Typography.material2021().black.apply(fontSizeFactor: 1.35)
                : Typography.material2021().black,
          ),
          home: const _AuthGate(),
        );
      },
    );
  }
}

class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  late bool _loggedIn;

  @override
  void initState() {
    super.initState();
    _loggedIn = Repository.instance.isAuthenticated;
  }

  @override
  Widget build(BuildContext context) {
    if (!_loggedIn) {
      return LoginPage(onLoggedIn: () => setState(() => _loggedIn = true));
    }
    return const CollectorHomeScreen();
  }
}

class CollectorHomeScreen extends StatefulWidget {
  const CollectorHomeScreen({Key? key}) : super(key: key);

  @override
  State<CollectorHomeScreen> createState() => _CollectorHomeScreenState();
}

class _CollectorHomeScreenState extends State<CollectorHomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    SellWizardPage(),
    LotsPage(),
    PassportPage(),
    EarningsPage(),
    SafetyGuidePage(materialCode: 'BATTERY'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('KabadiLink'),
        backgroundColor: Colors.teal,
        actions: [
          ValueListenableBuilder<bool>(
            valueListenable: AppSettings.instance.lowLiteracyMode,
            builder: (context, enabled, _) => IconButton(
              icon: Icon(enabled ? Icons.accessibility_new : Icons.accessibility_new_outlined),
              tooltip: 'Large text / voice-guided mode',
              onPressed: () => AppSettings.instance.setLowLiteracyMode(!enabled),
            ),
          ),
        ],
      ),
      body: _tabs[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.add_a_photo), label: 'Sell'),
          BottomNavigationBarItem(icon: Icon(Icons.list_alt), label: 'Lots'),
          BottomNavigationBarItem(icon: Icon(Icons.badge), label: 'Passport'),
          BottomNavigationBarItem(icon: Icon(Icons.payments), label: 'Earnings'),
          BottomNavigationBarItem(icon: Icon(Icons.health_and_safety), label: 'Safety'),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Run analyzer (you, locally)**

Run: `cd mobile && flutter analyze`

Expected: no errors from `main.dart` itself (errors from screens not yet created in earlier tasks are expected until Tasks 7–12 land — if executing in order, ignore "file not found" for `lots_page.dart`/`passport_page.dart`/`earnings_page.dart` until those tasks complete; if you're running this analyzer pass after all tasks are done, expect zero errors).

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/main.dart
git commit -m "feat(mobile): add auth gate, 5-tab nav, and low-literacy toggle to app shell"
```

---

## Task 7: Mobile — fix `sell_wizard.dart`

Fixes the `payload.toString()` JSON bug (Task 3's test guards the repository side; this task fixes the call site) and routes lot creation through `Repository` instead of `OfflineDatabase` directly, so it participates in the shared sync engine. On-device model inference (camera capture + TFLite) is explicitly out of scope for this task — `03-ai-ml-pipeline.md` confirms no trained model files exist yet (`backend/models/README.md`), so the manual material dropdown stays as the input method until that pipeline exists; this task only fixes the data-flow bug and wires real submission.

**Files:**
- Modify: `mobile/lib/ui/collector/sell_wizard.dart`

**Interfaces:**
- Consumes: `Repository.instance.queueCreateLot()` (Task 3).

- [ ] **Step 1: Replace the offline-save logic**

Find (`mobile/lib/ui/collector/sell_wizard.dart:1-46`):

```dart
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../../data/offline_db.dart';

class SellWizardPage extends StatefulWidget {
  const SellWizardPage({Key? key}) : super(key: key);

  @override
  State<SellWizardPage> createState() => _SellWizardPageState();
}

class _SellWizardPageState extends State<SellWizardPage> {
  int _currentStep = 0;
  String _selectedMaterial = 'PCB';
  double _manualWeightKg = 2.5;
  String _condition = 'fair';
  bool _isResaleCandidate = false;
  double _scrapEstimate = 450.0;
  double _resaleEstimate = 1200.0;

  final List<String> _materials = [
    'PCB', 'BATTERY', 'CABLE', 'LCD', 'CRT', 'MOTOR', 'MAGNET', 'PLASTIC', 'OTHER'
  ];

  void _saveLotOffline() async {
    final clientUid = const Uuid().v4();
    final payload = {
      'material_code': _selectedMaterial,
      'weight_kg': _manualWeightKg,
      'condition': _condition,
      'client_uid': clientUid,
    };

    await OfflineDatabase.instance.queueOperation(
      clientUid: clientUid,
      opType: 'CREATE_LOT',
      payloadJson: payload.toString(),
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lot queued offline in pending_ops! Will sync when online.')),
      );
      Navigator.pop(context);
    }
  }
```

Replace with:

```dart
import 'package:flutter/material.dart';
import '../../data/repository.dart';

class SellWizardPage extends StatefulWidget {
  const SellWizardPage({Key? key}) : super(key: key);

  @override
  State<SellWizardPage> createState() => _SellWizardPageState();
}

class _SellWizardPageState extends State<SellWizardPage> {
  int _currentStep = 0;
  String _selectedMaterial = 'PCB';
  double _manualWeightKg = 2.5;
  String _condition = 'fair';
  bool _isResaleCandidate = false;
  double _scrapEstimate = 450.0;
  double _resaleEstimate = 1200.0;
  bool _submitting = false;

  final List<String> _materials = [
    'PCB', 'BATTERY', 'CABLE', 'LCD', 'CRT', 'MOTOR', 'MAGNET', 'PLASTIC', 'OTHER'
  ];

  Future<void> _submitLot() async {
    setState(() => _submitting = true);
    final payload = {
      'material_code': _selectedMaterial,
      'weight_kg': _manualWeightKg,
      'condition': _condition,
    };

    // Always queue through the outbox first — this keeps CREATE_LOT on one
    // code path whether the device is online or not, and the repository's
    // sync engine drains it immediately if a connection is available.
    await Repository.instance.queueCreateLot(payload);
    final result = await Repository.instance.syncPendingOps();

    if (mounted) {
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.synced > 0
              ? 'Lot submitted and synced.'
              : 'Lot queued offline — will sync when online.'),
        ),
      );
      Navigator.pop(context);
    }
  }
```

- [ ] **Step 2: Update the call site**

Find, in the same file's `build()` (`mobile/lib/ui/collector/sell_wizard.dart`, the `Stepper`'s `onStepContinue`):

```dart
        onStepContinue: () {
          if (_currentStep < 2) {
            setState(() => _currentStep += 1);
          } else {
            _saveLotOffline();
          }
        },
```

Replace with:

```dart
        onStepContinue: () {
          if (_currentStep < 2) {
            setState(() => _currentStep += 1);
          } else if (!_submitting) {
            _submitLot();
          }
        },
```

The rest of the file (the three `Step`s in the `Stepper`) is unchanged.

- [ ] **Step 3: Run analyzer (you, locally)**

Run: `cd mobile && flutter analyze lib/ui/collector/sell_wizard.dart`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/ui/collector/sell_wizard.dart
git commit -m "fix(mobile): route sell wizard through Repository, fixing invalid-JSON offline payload"
```

---

## Task 8: Mobile — fix `handover_page.dart` (real online OTP path)

Currently the page only offers offline staging, even when the device is online — it never calls the server to generate/verify an OTP. Adds the online branch per `05-mobile-app.md`'s Offline Handover Security section: online → real server-issued OTP + `POST /handover/{lot_id}/payment` once verified; offline (unchanged behavior, JSON bug fixed) → stage locally.

**Files:**
- Modify: `mobile/lib/ui/collector/handover_page.dart` (full-file rewrite — the online path is new control flow throughout, not a localized patch)

**Interfaces:**
- Consumes: `Repository.instance.isOnline()`, `.getHandover()`, `.generateHandoverOtp()`, `.recordPayment()`, `.queueOfflineHandover()` (Task 3).

- [ ] **Step 1: Replace `mobile/lib/ui/collector/handover_page.dart` in full**

```dart
import 'package:flutter/material.dart';
import '../../data/repository.dart';

class HandoverOtpPage extends StatefulWidget {
  final String lotId;
  final String lotCode;

  const HandoverOtpPage({
    Key? key,
    required this.lotId,
    required this.lotCode,
  }) : super(key: key);

  @override
  State<HandoverOtpPage> createState() => _HandoverOtpPageState();
}

class _HandoverOtpPageState extends State<HandoverOtpPage> {
  String _paymentMethod = 'CASH';
  double? _measuredWeightKg;
  String? _serverOtp;
  Map<String, dynamic>? _handover;
  bool _online = true;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final online = await Repository.instance.isOnline();
    Map<String, dynamic>? handover;
    if (online) {
      try {
        handover = await Repository.instance.getHandover(widget.lotId);
      } catch (_) {
        handover = null; // No handover row yet (no accepted offer) — page still renders.
      }
    }
    setState(() {
      _online = online;
      _handover = handover;
      _loading = false;
    });
  }

  Future<void> _generateOtp() async {
    final code = await Repository.instance.generateHandoverOtp(widget.lotId);
    setState(() => _serverOtp = code);
  }

  Future<void> _confirmPayment() async {
    if (_measuredWeightKg == null) return;
    await Repository.instance.recordPayment(widget.lotId, _measuredWeightKg!, _paymentMethod);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _stageOfflineHandover() async {
    if (_measuredWeightKg == null) return;
    await Repository.instance.queueOfflineHandover(widget.lotId, _measuredWeightKg!, _paymentMethod);
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Handover Staged Offline'),
        content: const Text(
          'Handover intent and scale weight staged locally as READY_TO_VERIFY. '
          'Official server OTP verification will complete automatically once connectivity is restored.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context);
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final otpVerified = _handover?['otp_verified_at'] != null;
    return Scaffold(
      appBar: AppBar(
        title: Text('Handover: ${widget.lotCode}'),
        backgroundColor: Colors.teal,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (!_online)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text('Offline — handover will stage locally.', style: TextStyle(color: Colors.orange)),
              ),
            const Text(
              'Handover Verification Code',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
              decoration: BoxDecoration(
                color: Colors.teal.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.teal.shade300),
              ),
              child: Text(
                _serverOtp ?? (_online ? 'Tap Generate' : 'OFFLINE'),
                style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 6),
              ),
            ),
            if (_online && _serverOtp == null) ...[
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _generateOtp, child: const Text('Generate OTP')),
            ],
            const SizedBox(height: 24),
            const Text('Payment Method:'),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ChoiceChip(
                  label: const Text('Cash'),
                  selected: _paymentMethod == 'CASH',
                  onSelected: (val) => setState(() => _paymentMethod = 'CASH'),
                ),
                const SizedBox(width: 12),
                ChoiceChip(
                  label: const Text('UPI / Digital'),
                  selected: _paymentMethod == 'DIGITAL',
                  onSelected: (val) => setState(() => _paymentMethod = 'DIGITAL'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            TextFormField(
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Actual Scale Weight at Pickup (kg)',
                border: OutlineInputBorder(),
              ),
              onChanged: (val) => _measuredWeightKg = double.tryParse(val),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.teal,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _online ? (otpVerified ? _confirmPayment : null) : _stageOfflineHandover,
                child: Text(
                  _online
                      ? (otpVerified ? 'Confirm Payment' : 'Waiting for OTP verification…')
                      : 'Acknowledge Handover Intent',
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Run analyzer (you, locally)**

Run: `cd mobile && flutter analyze lib/ui/collector/handover_page.dart`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/ui/collector/handover_page.dart
git commit -m "feat(mobile): add real online OTP generate/verify path to handover screen"
```

---

## Task 9: Mobile — create `lots_page.dart` (offers, pickup tracking, disputes)

Per `05-mobile-app.md`'s `lots_page.dart` section: offers list with Accept/Reject/Counter, Pickup Tracking status, dispute button + form.

**Files:**
- Create: `mobile/lib/ui/collector/lots_page.dart`

**Interfaces:**
- Consumes: `Repository.instance.getMyLots()`, `.getLot()`, `.getOffers()`, `.acceptOffer()`, `.rejectOffer()`, `.counterOffer()`, `.getHandover()`, `.createDispute()` (Task 3); `HandoverOtpPage({required lotId, required lotCode})` (Task 8 — depends on Task 8 landing first if run out of order; the offer's `anomaly` field is `{status, reason, severity}` per `backend/services/anomaly.py::evaluate_anomaly`, not a boolean flag).
- Produces: `LotsPage` (const constructor, no args) — used by Task 6's bottom nav.

- [ ] **Step 1: Write `mobile/lib/ui/collector/lots_page.dart`**

```dart
import 'package:flutter/material.dart';
import '../../data/repository.dart';
import 'handover_page.dart';

class LotsPage extends StatefulWidget {
  const LotsPage({Key? key}) : super(key: key);

  @override
  State<LotsPage> createState() => _LotsPageState();
}

class _LotsPageState extends State<LotsPage> {
  List<dynamic> _lots = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final lots = await Repository.instance.getMyLots();
      setState(() => _lots = lots);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  void _openDetail(Map<String, dynamic> lot) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => LotDetailPage(lotId: lot['id'].toString())),
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Could not load lots: $_error'),
            const SizedBox(height: 8),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_lots.isEmpty) {
      return const Center(child: Text('No lots yet. Sell some scrap to get started.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: _lots.length,
        itemBuilder: (context, i) {
          final lot = _lots[i] as Map<String, dynamic>;
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: ListTile(
              title: Text(lot['lot_code']?.toString() ?? lot['id'].toString()),
              subtitle: Text('${lot['weight_kg']} kg · ${lot['status']}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _openDetail(lot),
            ),
          );
        },
      ),
    );
  }
}

class LotDetailPage extends StatefulWidget {
  final String lotId;
  const LotDetailPage({Key? key, required this.lotId}) : super(key: key);

  @override
  State<LotDetailPage> createState() => _LotDetailPageState();
}

class _LotDetailPageState extends State<LotDetailPage> {
  Map<String, dynamic>? _lot;
  List<dynamic> _offers = [];
  Map<String, dynamic>? _handover;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final lot = await Repository.instance.getLot(widget.lotId);
    final offers = await Repository.instance.getOffers(widget.lotId);
    Map<String, dynamic>? handover;
    try {
      handover = await Repository.instance.getHandover(widget.lotId);
    } catch (_) {
      handover = null; // No handover yet — no offer accepted.
    }
    setState(() {
      _lot = lot;
      _offers = offers;
      _handover = handover;
      _loading = false;
    });
  }

  Future<void> _accept(String offerId) async {
    await Repository.instance.acceptOffer(offerId);
    await _load();
  }

  Future<void> _reject(String offerId) async {
    await Repository.instance.rejectOffer(offerId);
    await _load();
  }

  Future<void> _counter(String offerId, double currentPrice) async {
    final controller = TextEditingController(text: currentPrice.toString());
    final price = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Counter-offer'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Your price (₹)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, double.tryParse(controller.text)),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (price != null) {
      await Repository.instance.counterOffer(offerId, price);
      await _load();
    }
  }

  Future<void> _openDispute() async {
    String type = 'WEIGHT_MISMATCH';
    final descController = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Report a Dispute'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButton<String>(
                value: type,
                isExpanded: true,
                items: const [
                  DropdownMenuItem(value: 'WEIGHT_MISMATCH', child: Text('Weight mismatch')),
                  DropdownMenuItem(value: 'PRICE_DISPUTE', child: Text('Price dispute')),
                  DropdownMenuItem(value: 'NO_SHOW', child: Text('Recycler no-show')),
                  DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                ],
                onChanged: (val) => setDialogState(() => type = val ?? 'WEIGHT_MISMATCH'),
              ),
              TextField(
                controller: descController,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'What happened?'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit')),
          ],
        ),
      ),
    );
    if (submitted == true) {
      await Repository.instance.createDispute(widget.lotId, type, descController.text);
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _lot == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final status = _lot!['status']?.toString() ?? '';
    final canDispute = status == 'COMPLETED' || status == 'DISPUTED';
    return Scaffold(
      appBar: AppBar(
        title: Text(_lot!['lot_code']?.toString() ?? 'Lot'),
        backgroundColor: Colors.teal,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Status: $status', style: const TextStyle(fontWeight: FontWeight.bold)),
            if (_handover != null) ...[
              const SizedBox(height: 8),
              Text('Pickup: ${_handover!['status']}'),
            ],
            const SizedBox(height: 16),
            if (status == 'ACCEPTED' || status == 'HANDOVER_PENDING')
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => HandoverOtpPage(
                        lotId: widget.lotId,
                        lotCode: _lot!['lot_code']?.toString() ?? widget.lotId,
                      ),
                    ),
                  ).then((_) => _load()),
                  icon: const Icon(Icons.handshake_outlined),
                  label: const Text('Proceed to Handover'),
                ),
              ),
            const Text('Offers', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (_offers.isEmpty) const Text('No offers yet.'),
            ..._offers.map((o) {
              final offer = o as Map<String, dynamic>;
              final offerId = offer['id'].toString();
              final offerStatus = offer['status']?.toString() ?? '';
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('₹${offer['price']} — $offerStatus'),
                      if ((offer['anomaly'] as Map?)?['status'] == 'ANOMALOUS')
                        Text(
                          '⚠ ${(offer['anomaly'] as Map)['reason'] ?? 'Flagged as an unusual price'}',
                          style: const TextStyle(color: Colors.orange),
                        ),
                      if (offerStatus == 'PENDING') ...[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          children: [
                            ElevatedButton(onPressed: () => _accept(offerId), child: const Text('Accept')),
                            OutlinedButton(onPressed: () => _reject(offerId), child: const Text('Reject')),
                            OutlinedButton(
                              onPressed: () => _counter(offerId, (offer['price'] as num).toDouble()),
                              child: const Text('Counter'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 24),
            if (canDispute)
              OutlinedButton.icon(
                onPressed: _openDispute,
                icon: const Icon(Icons.report_problem_outlined),
                label: const Text('Report a Dispute'),
              ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Run analyzer (you, locally)**

Run: `cd mobile && flutter analyze lib/ui/collector/lots_page.dart`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/ui/collector/lots_page.dart
git commit -m "feat(mobile): add lots/offers screen with accept/reject/counter and disputes"
```

---

## Task 10: Mobile — create `passport_page.dart` (Scrap Passport + EPR record)

**Files:**
- Create: `mobile/lib/ui/collector/passport_page.dart`

**Interfaces:**
- Consumes: `Repository.instance.getMyLots()`, `.getPassport()`, `.getEprRecord()` (Task 3).
- Produces: `PassportPage` (const constructor, no args) — used by Task 6's bottom nav.

- [ ] **Step 1: Write `mobile/lib/ui/collector/passport_page.dart`**

```dart
import 'package:flutter/material.dart';
import '../../data/repository.dart';

class PassportPage extends StatefulWidget {
  const PassportPage({Key? key}) : super(key: key);

  @override
  State<PassportPage> createState() => _PassportPageState();
}

class _PassportPageState extends State<PassportPage> {
  List<dynamic> _lots = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final lots = await Repository.instance.getMyLots();
    setState(() {
      _lots = lots;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_lots.isEmpty) return const Center(child: Text('No Scrap Passport entries yet.'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: _lots.length,
        itemBuilder: (context, i) {
          final lot = _lots[i] as Map<String, dynamic>;
          return ListTile(
            leading: const Icon(Icons.badge_outlined),
            title: Text(lot['lot_code']?.toString() ?? lot['id'].toString()),
            subtitle: Text('${lot['weight_kg']} kg · ${lot['status']}'),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => PassportDetailPage(lotId: lot['id'].toString())),
            ),
          );
        },
      ),
    );
  }
}

class PassportDetailPage extends StatefulWidget {
  final String lotId;
  const PassportDetailPage({Key? key, required this.lotId}) : super(key: key);

  @override
  State<PassportDetailPage> createState() => _PassportDetailPageState();
}

class _PassportDetailPageState extends State<PassportDetailPage> {
  Map<String, dynamic>? _passport;
  bool _loading = true;
  bool _loadingEpr = false;
  String? _eprError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final passport = await Repository.instance.getPassport(widget.lotId);
    setState(() {
      _passport = passport;
      _loading = false;
    });
  }

  Future<void> _viewEprRecord() async {
    setState(() {
      _loadingEpr = true;
      _eprError = null;
    });
    try {
      final record = await Repository.instance.getEprRecord(widget.lotId);
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('EPR-Ready Handover Record'),
          content: SingleChildScrollView(child: Text(record.toString())),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
        ),
      );
    } catch (e) {
      setState(() => _eprError = e.toString());
    } finally {
      setState(() => _loadingEpr = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _passport == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final lot = _passport!['lot'] as Map<String, dynamic>;
    final handover = _passport!['handover'] as Map<String, dynamic>?;
    final payment = _passport!['payment'] as Map<String, dynamic>?;
    final offers = (_passport!['offers'] as List<dynamic>? ?? []);
    return Scaffold(
      appBar: AppBar(title: Text('Passport: ${lot['lot_code']}'), backgroundColor: Colors.teal),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Material: ${lot['material_code']}'),
          Text('Weight: ${lot['weight_kg']} kg'),
          Text('Status: ${lot['status']}'),
          Text('Created: ${lot['created_at']}'),
          const Divider(height: 32),
          Text('Offers history (${offers.length})', style: const TextStyle(fontWeight: FontWeight.bold)),
          ...offers.map((o) => Text('₹${(o as Map)['price']} — ${o['status']}')),
          const Divider(height: 32),
          if (handover != null)
            Text('Pickup status: ${handover['status']}', style: const TextStyle(fontWeight: FontWeight.bold)),
          if (payment != null) ...[
            const SizedBox(height: 8),
            Text('Paid ₹${payment['amount']} via ${payment['method']}'),
          ],
          const SizedBox(height: 24),
          if (handover != null && handover['status'] == 'COMPLETED' && payment != null)
            ElevatedButton.icon(
              onPressed: _loadingEpr ? null : _viewEprRecord,
              icon: const Icon(Icons.description_outlined),
              label: Text(_loadingEpr ? 'Loading…' : 'View EPR-Ready Handover Record'),
            ),
          if (_eprError != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_eprError!, style: const TextStyle(color: Colors.red)),
            ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Run analyzer (you, locally)**

Run: `cd mobile && flutter analyze lib/ui/collector/passport_page.dart`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/ui/collector/passport_page.dart
git commit -m "feat(mobile): add Scrap Passport list/detail screen with EPR record view"
```

---

## Task 11: Mobile — create `earnings_page.dart`

Per `05-mobile-app.md`: show payment method (cash/digital) per transaction, from the canonical `transactions` table. There is no dedicated `/earnings` endpoint (checked `02-backend-api.md` — it doesn't exist), so this screen composes `GET /lots?status=COMPLETED&collector_id=` with a `GET /passport/{lot_id}` per completed lot, same as `web/src/CollectorApp.jsx`'s earnings view does implicitly through its passport calls.

**Files:**
- Create: `mobile/lib/ui/collector/earnings_page.dart`

**Interfaces:**
- Consumes: `Repository.instance.getMyLots(status: 'COMPLETED')`, `.getPassport()` (Task 3).
- Produces: `EarningsPage` (const constructor, no args) — used by Task 6's bottom nav.

- [ ] **Step 1: Write `mobile/lib/ui/collector/earnings_page.dart`**

```dart
import 'package:flutter/material.dart';
import '../../data/repository.dart';

class EarningsPage extends StatefulWidget {
  const EarningsPage({Key? key}) : super(key: key);

  @override
  State<EarningsPage> createState() => _EarningsPageState();
}

class _EarningsPageState extends State<EarningsPage> {
  List<Map<String, dynamic>> _payments = [];
  bool _loading = true;
  double _total = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final lots = await Repository.instance.getMyLots(status: 'COMPLETED');
    final payments = <Map<String, dynamic>>[];
    double total = 0;
    for (final lot in lots) {
      final lotMap = lot as Map<String, dynamic>;
      try {
        final passport = await Repository.instance.getPassport(lotMap['id'].toString());
        final payment = passport['payment'] as Map<String, dynamic>?;
        if (payment != null) {
          total += (payment['amount'] as num).toDouble();
          payments.add({
            'lot_code': lotMap['lot_code'],
            'amount': payment['amount'],
            'method': payment['method'],
            'paid_at': payment['created_at'],
          });
        }
      } catch (_) {
        // No payment recorded yet for this lot — skip it in the earnings list.
      }
    }
    setState(() {
      _payments = payments;
      _total = total;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Colors.teal.shade50,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text('Total Earnings', style: TextStyle(fontSize: 14)),
                  Text(
                    '₹${_total.toStringAsFixed(0)}',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.teal),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (_payments.isEmpty) const Text('No completed sales yet.'),
          ..._payments.map(
            (p) => Card(
              child: ListTile(
                leading: Icon(
                  p['method'] == 'CASH' ? Icons.payments_outlined : Icons.account_balance_wallet_outlined,
                ),
                title: Text('${p['lot_code']}'),
                subtitle: Text('${p['method']} · ${p['paid_at']}'),
                trailing: Text('₹${p['amount']}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Run analyzer (you, locally)**

Run: `cd mobile && flutter analyze lib/ui/collector/earnings_page.dart`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/ui/collector/earnings_page.dart
git commit -m "feat(mobile): add earnings screen showing payment method per completed lot"
```

---

## Task 12: Mobile — wire `safety_page.dart` to real ISL video content

Currently the ISL section is a static placeholder box with no data behind it. Per `05-mobile-app.md`: source from `safety_content` where `content_type = ISL_VIDEO` (now available via Task 1's `GET /safety-content`). One-directional playback only — this task adds an "Open ISL Video" action via the system video player/browser (`url_launcher`), not an embedded player widget, since embedding a full video player is out of scope for what the spec asks (playback, not in-app UI polish) and avoids a new heavyweight dependency.

**Files:**
- Modify: `mobile/lib/ui/collector/safety_page.dart`
- Modify: `mobile/pubspec.yaml` (add `url_launcher`)

**Interfaces:**
- Consumes: `Repository.instance.getSafetyContent()` (Task 3).

- [ ] **Step 1: Add `url_launcher` to `mobile/pubspec.yaml`**

Find (`mobile/pubspec.yaml:9-19`):

```yaml
dependencies:
  flutter:
    sdk: flutter
  sqflite: ^2.3.0
  path: ^1.8.3
  http: ^1.2.0
  shared_preferences: ^2.2.2
  uuid: ^4.3.3
  tflite_flutter: ^0.10.4
  camera: ^0.10.5+9
  flutter_tts: ^3.8.5
```

Replace with:

```yaml
dependencies:
  flutter:
    sdk: flutter
  sqflite: ^2.3.0
  path: ^1.8.3
  http: ^1.2.0
  shared_preferences: ^2.2.2
  uuid: ^4.3.3
  tflite_flutter: ^0.10.4
  camera: ^0.10.5+9
  flutter_tts: ^3.8.5
  url_launcher: ^6.2.5
```

- [ ] **Step 2: Modify `mobile/lib/ui/collector/safety_page.dart`**

Find the imports and state fields (`mobile/lib/ui/collector/safety_page.dart:1-16`):

```dart
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

class SafetyGuidePage extends StatefulWidget {
  final String materialCode;

  const SafetyGuidePage({Key? key, required this.materialCode}) : super(key: key);

  @override
  State<SafetyGuidePage> createState() => _SafetyGuidePageState();
}

class _SafetyGuidePageState extends State<SafetyGuidePage> {
  final FlutterTts _tts = FlutterTts();
  bool _isPlayingTts = false;
```

Replace with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/repository.dart';

class SafetyGuidePage extends StatefulWidget {
  final String materialCode;

  const SafetyGuidePage({Key? key, required this.materialCode}) : super(key: key);

  @override
  State<SafetyGuidePage> createState() => _SafetyGuidePageState();
}

class _SafetyGuidePageState extends State<SafetyGuidePage> {
  final FlutterTts _tts = FlutterTts();
  bool _isPlayingTts = false;
  String? _islVideoUrl;
  bool _loadingIsl = true;
```

Find `initState` (`mobile/lib/ui/collector/safety_page.dart:24-28`):

```dart
  @override
  void initState() {
    super.initState();
    _initTts();
  }
```

Replace with:

```dart
  @override
  void initState() {
    super.initState();
    _initTts();
    _loadIslVideo();
  }

  Future<void> _loadIslVideo() async {
    try {
      final results = await Repository.instance.getSafetyContent(widget.materialCode, contentType: 'ISL_VIDEO');
      if (results.isNotEmpty) {
        setState(() => _islVideoUrl = (results.first as Map)['content_url'] as String?);
      }
    } catch (_) {
      // No connectivity or no content configured yet — the placeholder card below covers this.
    } finally {
      setState(() => _loadingIsl = false);
    }
  }

  Future<void> _openIslVideo() async {
    final url = _islVideoUrl;
    if (url == null) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
```

Find the ISL placeholder block (`mobile/lib/ui/collector/safety_page.dart:109-136`):

```dart
            // Tier 2 #10 ISL Video Guidance Placeholder
            const Text(
              'Indian Sign Language (ISL) Video Demo',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              height: 200,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.play_circle_fill, size: 54, color: Colors.white70),
                    SizedBox(height: 8),
                    Text(
                      'ISL Demonstration: Safe Handling\n(Playing from safety_content repository)',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
```

Replace with:

```dart
            // Indian Sign Language (ISL) video guidance — one-directional playback only,
            // sourced from safety_content where content_type = ISL_VIDEO. No sign
            // *recognition* is attempted (05-mobile-app.md explicitly excludes it).
            const Text(
              'Indian Sign Language (ISL) Video Guidance',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: _islVideoUrl != null ? _openIslVideo : null,
              child: Container(
                height: 200,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: _loadingIsl
                      ? const CircularProgressIndicator(color: Colors.white70)
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              _islVideoUrl != null ? Icons.play_circle_fill : Icons.videocam_off,
                              size: 54,
                              color: Colors.white70,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _islVideoUrl != null
                                  ? 'Tap to play ISL demonstration'
                                  : 'No ISL video available for ${widget.materialCode} yet',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white70, fontSize: 12),
                            ),
                          ],
                        ),
                ),
              ),
            ),
```

- [ ] **Step 3: Run analyzer (you, locally)**

Run: `cd mobile && flutter pub get && flutter analyze lib/ui/collector/safety_page.dart`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/ui/collector/safety_page.dart mobile/pubspec.yaml
git commit -m "feat(mobile): wire ISL video guidance to GET /safety-content"
```

---

## Final check (you, locally, after all 12 tasks land)

Run, in order, and fix anything that fails before considering this plan done:

1. `cd "C:\Users\vishn\Personal\GREAT AIM\Sihh" && .venv/Scripts/python.exe -m pytest backend/smoke_test.py -v` — must still be all-green (Task 1's additions plus the pre-existing 19).
2. `cd mobile && flutter pub get`
3. `flutter analyze` — zero errors across the whole `lib/` tree.
4. `flutter test` — all tests in `test/` pass, including Task 2's and Task 3's.
5. Point `mobile/lib/core/config.dart`'s `AppConfig.defaultApiUrl` at a running backend (local `uvicorn backend.main:app` is enough for this check) and manually walk: login → sell wizard → lots/offers → handover → passport/EPR → earnings → safety ISL tap. This is the actual acceptance test — static analysis alone doesn't prove the screens work against the real API shapes.
