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
        await _db.markOperationFailed(op['id'] as int);
        failed++; // Left PENDING; retried next time syncPendingOps() runs.
      }
    }
    return SyncResult(synced, failed);
  }
}
