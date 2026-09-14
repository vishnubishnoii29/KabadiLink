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
