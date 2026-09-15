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

  group('buildClassifyMaterialRequest', () {
    test('builds a multipart POST with the photo field and auth header', () {
      final uri = Uri.parse('http://example.com/ai/classify-material');
      final request = buildClassifyMaterialRequest(uri, 'tok123', [1, 2, 3], 'photo.jpg');

      expect(request.method, 'POST');
      expect(request.url, uri);
      expect(request.headers['Authorization'], 'Bearer tok123');
      expect(request.files, hasLength(1));
      expect(request.files.single.field, 'photo');
      expect(request.files.single.filename, 'photo.jpg');
    });

    test('omits Authorization header when no token is set', () {
      final request = buildClassifyMaterialRequest(Uri.parse('http://example.com/x'), null, [1], 'a.jpg');
      expect(request.headers.containsKey('Authorization'), isFalse);
    });
  });

  group('classify-material response decoding', () {
    test('decodes a list of AIResult-shaped objects', () {
      final res = http.Response(
        '[{"result": "PCB", "confidence": 0.92, "reasoning": "matched shape", '
        '"source": "local_model", "needs_confirmation": false}]',
        200,
      );
      final decoded = decodeApiResponse(res) as List<dynamic>;
      expect(decoded, hasLength(1));
      final first = decoded.first as Map<String, dynamic>;
      expect(first['result'], 'PCB');
      expect(first['needs_confirmation'], false);
    });
  });
}
