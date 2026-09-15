import 'package:flutter/material.dart';
import '../../data/repository.dart';

class HandoverOtpPage extends StatefulWidget {
  final String lotId;
  final String lotCode;

  const HandoverOtpPage({
    Key? key,
    required this.lotId,
    required this.lotCode,
  }) : super(key: key);

  @override
  State<HandoverOtpPage> createState() => _HandoverOtpPageState();
}

class _HandoverOtpPageState extends State<HandoverOtpPage> {
  String _paymentMethod = 'CASH';
  double? _measuredWeightKg;
  double? _offerAmount;
  String? _serverOtp;
  Map<String, dynamic>? _handover;
  bool _online = true;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final online = await Repository.instance.isOnline();
    Map<String, dynamic>? handover;
    double? offerAmount;
    if (online) {
      try {
        handover = await Repository.instance.getHandover(widget.lotId);
      } catch (_) {
        handover = null; // No handover row yet (no accepted offer) — page still renders.
      }
      try {
        // The payment amount is the accepted offer's price — never the scale weight.
        final offers = await Repository.instance.getOffers(widget.lotId);
        for (final o in offers) {
          final offer = o as Map<String, dynamic>;
          if (offer['status']?.toString() == 'ACCEPTED') {
            offerAmount = (offer['price'] as num).toDouble();
            break;
          }
        }
      } catch (_) {
        offerAmount = null; // No accepted offer yet is a valid state, not an error.
      }
    }
    setState(() {
      _online = online;
      _handover = handover;
      _offerAmount = offerAmount;
      _loading = false;
    });
  }

  Future<void> _generateOtp() async {
    final code = await Repository.instance.generateHandoverOtp(widget.lotId);
    setState(() => _serverOtp = code);
  }

  Future<void> _confirmPayment() async {
    // transactions.amount is canonical and can only be written once per handover —
    // it must be the accepted offer price, not the measured scale weight.
    if (_offerAmount == null) return;
    await Repository.instance.recordPayment(widget.lotId, _offerAmount!, _paymentMethod);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _stageOfflineHandover() async {
    if (_measuredWeightKg == null) return;
    await Repository.instance.queueOfflineHandover(widget.lotId, _measuredWeightKg!, _paymentMethod);
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Handover Staged Offline'),
        content: const Text(
          'Handover intent and scale weight staged locally as READY_TO_VERIFY. '
          'This syncs automatically once you are back online, but you will still need to come '
          'back to this screen to generate/complete OTP verification and confirm payment — '
          'it does not finish on its own.',
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final otpVerified = _handover?['otp_verified_at'] != null;
    return Scaffold(
      appBar: AppBar(
        title: Text('Handover: ${widget.lotCode}'),
        backgroundColor: Colors.teal,
      ),
      // The OTP is verified by the recycler on their own device, so this screen
      // only learns about otp_verified_at by re-fetching. Pull-to-refresh is that path.
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (!_online)
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text('Offline — handover will stage locally.', style: TextStyle(color: Colors.orange)),
                ),
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
                  _serverOtp ?? (_online ? 'Tap Generate' : 'OFFLINE'),
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 6),
                ),
              ),
              if (_online && _serverOtp == null) ...[
                const SizedBox(height: 12),
                ElevatedButton(onPressed: _generateOtp, child: const Text('Generate OTP')),
              ],
              const SizedBox(height: 24),
              if (_offerAmount != null) ...[
                Text(
                  'Payment Amount: ₹${_offerAmount!.toStringAsFixed(0)}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
              ],
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
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.teal,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _online
                      ? (otpVerified && _offerAmount != null ? _confirmPayment : null)
                      : _stageOfflineHandover,
                  child: Text(
                    _online
                        ? (otpVerified ? 'Confirm Payment' : 'Waiting for OTP verification…')
                        : 'Acknowledge Handover Intent',
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
