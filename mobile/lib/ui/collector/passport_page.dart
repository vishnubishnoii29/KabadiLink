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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Could not load Scrap Passport: $_error'),
            const SizedBox(height: 8),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
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
      final passport = await Repository.instance.getPassport(widget.lotId);
      setState(() => _passport = passport);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
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
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null || _passport == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Passport'), backgroundColor: Colors.teal),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Could not load passport: ${_error ?? 'not found'}'),
              const SizedBox(height: 8),
              ElevatedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
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
            Text('Paid ₹${payment['amount']} via ${payment['payment_method']}'),
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
