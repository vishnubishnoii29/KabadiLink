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
