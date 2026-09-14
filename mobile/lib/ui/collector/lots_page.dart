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

  void _proceedToHandover() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => HandoverOtpPage(
          lotId: widget.lotId,
          lotCode: _lot!['lot_code']?.toString() ?? widget.lotId,
        ),
      ),
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _lot == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final status = _lot!['status']?.toString() ?? '';
    final canDispute = status == 'COMPLETED' || status == 'DISPUTED';
    final canHandover = status == 'ACCEPTED' || status == 'HANDOVER_PENDING';
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
            if (canHandover) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _proceedToHandover,
                  icon: const Icon(Icons.local_shipping_outlined),
                  label: const Text('Proceed to Handover'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
                ),
              ),
            ],
            const SizedBox(height: 16),
            const Text('Offers', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (_offers.isEmpty) const Text('No offers yet.'),
            ..._offers.map((o) {
              final offer = o as Map<String, dynamic>;
              final offerId = offer['id'].toString();
              final offerStatus = offer['status']?.toString() ?? '';
              final isAnomalous = (offer['anomaly'] as Map?)?['status'] == 'ANOMALOUS';
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('₹${offer['price']} — $offerStatus'),
                      if (isAnomalous)
                        const Text('⚠ Flagged as unusual price', style: TextStyle(color: Colors.orange)),
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
