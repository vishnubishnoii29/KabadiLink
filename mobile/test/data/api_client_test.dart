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
