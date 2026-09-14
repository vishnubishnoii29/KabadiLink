import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../../data/offline_db.dart';

class HandoverOtpPage extends StatefulWidget {
  final String lotId;
  final String lotCode;
  final String? serverOtp;

  const HandoverOtpPage({
    Key? key,
    required this.lotId,
    required this.lotCode,
    this.serverOtp,
  }) : super(key: key);

  @override
  State<HandoverOtpPage> createState() => _HandoverOtpPageState();
}

class _HandoverOtpPageState extends State<HandoverOtpPage> {
  String _paymentMethod = 'CASH';
  double? _measuredWeightKg;

  void _stageOfflineHandover() async {
    final clientUid = const Uuid().v4();
    final payload = {
      'lot_id': widget.lotId,
      'status': 'READY_TO_VERIFY',
      'payment_method': _paymentMethod,
      'actual_weight_kg': _measuredWeightKg,
      'staged_offline': true,
      'client_uid': clientUid,
    };

    // Queue in pending_ops per Offline Handover Security spec
    await OfflineDatabase.instance.queueOperation(
      clientUid: clientUid,
      opType: 'STAGE_OFFLINE_HANDOVER',
      payloadJson: payload.toString(),
    );

    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Handover Staged Offline'),
          content: const Text(
            'Handover intent and scale weight staged locally as READY_TO_VERIFY. '
            'Official server OTP verification will complete automatically once connectivity is restored.',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pop(context);
              },
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Handover: ${widget.lotCode}'),
        backgroundColor: Colors.teal,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Text(
              'Handover Verification Code',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
              decoration: BoxDecoration(
                color: Colors.teal.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.teal.shade300),
              ),
              child: Text(
                widget.serverOtp ?? 'OFFLINE',
                style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 6),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Payment Method:'),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ChoiceChip(
                  label: const Text('Cash'),
                  selected: _paymentMethod == 'CASH',
                  onSelected: (val) => setState(() => _paymentMethod = 'CASH'),
                ),
                const SizedBox(width: 12),
                ChoiceChip(
                  label: const Text('UPI / Digital'),
                  selected: _paymentMethod == 'DIGITAL',
                  onSelected: (val) => setState(() => _paymentMethod = 'DIGITAL'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            TextFormField(
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Actual Scale Weight at Pickup (kg)',
                border: OutlineInputBorder(),
              ),
              onChanged: (val) => _measuredWeightKg = double.tryParse(val),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.teal,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _stageOfflineHandover,
                child: const Text('Acknowledge Handover Intent', style: TextStyle(color: Colors.white, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
