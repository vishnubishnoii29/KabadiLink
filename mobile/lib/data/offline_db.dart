import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class OfflineDatabase {
  static final OfflineDatabase instance = OfflineDatabase._init();
  static Database? _database;

  OfflineDatabase._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('kabadilink_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 2,
      onCreate: _createDB,
      onUpgrade: _upgradeDB,
    );
  }

  Future _createDB(Database db, int version) async {
    // 1. Pending Operations Outbox with client_uid deduplication
    await db.execute('''
      CREATE TABLE pending_ops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_uid TEXT UNIQUE NOT NULL,
        op_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    ''');

    // 2. Local Lots Cache
    await db.execute('''
      CREATE TABLE local_lots (
        id TEXT PRIMARY KEY,
        lot_code TEXT,
        material_code TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        condition TEXT NOT NULL,
        photo_path TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN',
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        created_at TEXT NOT NULL
      )
    ''');

    // 3. Local Prices Cache
    await db.execute('''
      CREATE TABLE cached_prices (
        material_code TEXT PRIMARY KEY,
        avg_price REAL NOT NULL,
        sample_size INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
  }

  Future _upgradeDB(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      // Ensure pending_ops has retry_count
      await db.execute('ALTER TABLE pending_ops ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;');
    }
  }

  Future<int> queueOperation({
    required String clientUid,
    required String opType,
    required String payloadJson,
  }) async {
    final db = await instance.database;
    return await db.insert(
      'pending_ops',
      {
        'client_uid': clientUid,
        'op_type': opType,
        'payload_json': payloadJson,
        'status': 'PENDING',
        'retry_count': 0,
        'created_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.ignore, // Deduplication guarantee
    );
  }

  Future<List<Map<String, dynamic>>> getPendingOperations() async {
    final db = await instance.database;
    return await db.query(
      'pending_ops',
      where: 'status = ?',
      whereArgs: ['PENDING'],
      orderBy: 'id ASC',
    );
  }

  Future<void> markOperationCompleted(int id) async {
    final db = await instance.database;
    await db.update(
      'pending_ops',
      {'status': 'COMPLETED'},
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
