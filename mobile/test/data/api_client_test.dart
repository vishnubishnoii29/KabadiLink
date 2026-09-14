import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:kabadilink_mobile/data/api_client.dart';

void main() {
  group('ApiClient._decode via public error path', () {
    test('non-2xx response throws ApiException with server-provided code/message', () {
      final client = ApiClient.instance;
      final res = http.Response(
        '{"error": {"code": "LOT_NOT_FOUND", "message": "Lot not found"}}',
        404,
      );
      expect(
        () => (client as dynamic)._decode(res),
        throwsA(isA<ApiException>()
            .having((e) => e.status, 'status', 404)
            .having((e) => e.code, 'code', 'LOT_NOT_FOUND')),
      );
    });

    test('204 response decodes to null', () {
      final client = ApiClient.instance;
      final res = http.Response('', 204);
      expect((client as dynamic)._decode(res), isNull);
    });
  });
}
