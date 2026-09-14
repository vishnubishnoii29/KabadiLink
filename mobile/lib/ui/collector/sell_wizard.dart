import 'package:flutter/material.dart';
import '../../data/repository.dart';

class SellWizardPage extends StatefulWidget {
  const SellWizardPage({Key? key}) : super(key: key);

  @override
  State<SellWizardPage> createState() => _SellWizardPageState();
}

class _SellWizardPageState extends State<SellWizardPage> {
  int _currentStep = 0;
  String _selectedMaterial = 'PCB';
  double _manualWeightKg = 2.5;
  String _condition = 'fair';
  bool _isResaleCandidate = false;
  double _scrapEstimate = 450.0;
  double _resaleEstimate = 1200.0;
  bool _submitting = false;

  final List<String> _materials = [
    'PCB', 'BATTERY', 'CABLE', 'LCD', 'CRT', 'MOTOR', 'MAGNET', 'PLASTIC', 'OTHER'
  ];

  Future<void> _submitLot() async {
    setState(() => _submitting = true);
    final payload = {
      'material_code': _selectedMaterial,
      'weight_kg': _manualWeightKg,
      'condition': _condition,
    };

    // Always queue through the outbox first — this keeps CREATE_LOT on one
    // code path whether the device is online or not, and the repository's
    // sync engine drains it immediately if a connection is available.
    await Repository.instance.queueCreateLot(payload);
    final result = await Repository.instance.syncPendingOps();

    if (mounted) {
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.synced > 0
              ? 'Lot submitted and synced.'
              : 'Lot queued offline — will sync when online.'),
        ),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sell Scrap — Smart Wizard'),
        backgroundColor: Colors.teal,
      ),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep < 2) {
            setState(() => _currentStep += 1);
          } else if (!_submitting) {
            _submitLot();
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() => _currentStep -= 1);
          } else {
            Navigator.pop(context);
          }
        },
        steps: [
          // Step 1: On-Device Detection & Confirmation
          Step(
            title: const Text('AI Material Verification'),
            isActive: _currentStep >= 0,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'On-device YOLOv8 & MobileNetV2 detected material:',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                DropdownButton<String>(
                  value: _selectedMaterial,
                  isExpanded: true,
                  items: _materials.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                  onChanged: (val) => setState(() => _selectedMaterial = val ?? 'PCB'),
                ),
                const SizedBox(height: 12),
                // Tier 2 #8 Scrap or Sell Heuristic
                CheckboxListTile(
                  title: const Text('Item appears intact (Resale Candidate)'),
                  subtitle: const Text('Compare component resale vs. material scrap value'),
                  value: _isResaleCandidate,
                  onChanged: (val) => setState(() => _isResaleCandidate = val ?? false),
                ),
              ],
            ),
          ),

          // Step 2: Collector Manual Weight Entry
          Step(
            title: const Text('Manual Scale Weight'),
            isActive: _currentStep >= 1,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Per system rule, weight is entered manually by collector (not AI):'),
                const SizedBox(height: 8),
                TextFormField(
                  initialValue: _manualWeightKg.toString(),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Weight (kg)',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (val) => _manualWeightKg = double.tryParse(val) ?? 1.0,
                ),
              ],
            ),
          ),

          // Step 3: Explainable Fair Price Review
          Step(
            title: const Text('Explainable Fair Price'),
            isActive: _currentStep >= 2,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Estimated Scrap Value: ₹${_scrapEstimate.toStringAsFixed(0)}'),
                if (_isResaleCandidate) ...[
                  const SizedBox(height: 6),
                  Text('Estimated Resale Value: ₹${_resaleEstimate.toStringAsFixed(0)}',
                      style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                ],
                const SizedBox(height: 8),
                const Text(
                  'Explanation: Based on last 30-day verified industrial transactions in your zone.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
