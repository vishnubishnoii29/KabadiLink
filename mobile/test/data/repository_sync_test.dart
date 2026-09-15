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
