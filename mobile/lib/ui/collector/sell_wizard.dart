import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../data/repository.dart';
import 'camera_capture_page.dart';

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
  bool _submitting = false;

  Map<String, dynamic>? _aiResult;
  bool _classifying = false;
  String? _classifyError;

  Map<String, dynamic>? _priceEstimate;
  bool _priceLoading = false;
  String? _priceError;

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
    }
  }

  Future<void> _takePhoto() async {
    final bytes = await Navigator.push<Uint8List>(
      context,
      MaterialPageRoute(builder: (_) => const CameraCapturePage()),
    );
    if (bytes == null || !mounted) return; // user backed out of the camera screen
    await _classifyPhoto(bytes);
  }

  Future<void> _classifyPhoto(Uint8List bytes) async {
    setState(() {
      _classifying = true;
      _classifyError = null;
    });
    try {
      final results = await Repository.instance.classifyMaterial(bytes);
      if (results.isEmpty) {
        if (mounted) setState(() => _classifyError = 'No material detected — please select manually.');
        return;
      }
      final top = results.cast<Map<String, dynamic>>().reduce(
          (a, b) => (a['confidence'] as num) >= (b['confidence'] as num) ? a : b);
      if (mounted) {
        setState(() {
          _aiResult = top;
          if (_materials.contains(top['result'])) _selectedMaterial = top['result'] as String;
        });
      }
    } catch (_) {
      // Offline, no camera support server-side, timeout, etc. — never block the wizard.
      if (mounted) setState(() => _classifyError = 'Could not classify photo — please select the material manually.');
    } finally {
      if (mounted) setState(() => _classifying = false);
    }
  }

  Future<void> _fetchPriceEstimate() async {
    setState(() {
      _priceLoading = true;
      _priceError = null;
    });
    try {
      final estimate = await Repository.instance.getPriceEstimatePreview(
        material: _selectedMaterial,
        weight: _manualWeightKg,
        condition: _condition,
      );
      if (mounted) setState(() => _priceEstimate = estimate);
    } catch (_) {
      if (mounted) setState(() => _priceError = 'Could not fetch a price estimate right now.');
    } finally {
      if (mounted) setState(() => _priceLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // This is tab 0 of CollectorHomeScreen's bottom nav, which already supplies the
    // Scaffold and AppBar — returning the Stepper bare avoids a second stacked app bar.
    return Stepper(
      currentStep: _currentStep,
      onStepContinue: () {
        if (_currentStep < 2) {
          setState(() => _currentStep += 1);
          if (_currentStep == 2) _fetchPriceEstimate();
        } else if (!_submitting) {
          _submitLot();
        }
      },
      onStepCancel: () {
        if (_currentStep > 0) {
          setState(() => _currentStep -= 1);
        }
        // At step 0 there is nothing beneath this root tab to pop to — do nothing.
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
                  'Take a photo for an AI-suggested material match, or choose manually below:',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _classifying ? null : _takePhoto,
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: Text(_classifying ? 'Analyzing photo...' : 'Take Photo'),
                ),
                if (_classifying) const Padding(padding: EdgeInsets.only(top: 8), child: LinearProgressIndicator()),
                if (_classifyError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_classifyError!, style: const TextStyle(color: Colors.orange, fontSize: 12)),
                  ),
                if (_aiResult != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'AI suggestion: ${_aiResult!['result']} '
                    '(${(((_aiResult!['confidence'] as num?) ?? 0) * 100).toStringAsFixed(0)}% confidence)',
                    style: const TextStyle(fontStyle: FontStyle.italic),
                  ),
                  if ((_aiResult!['reasoning'] as String?)?.isNotEmpty ?? false)
                    Text(_aiResult!['reasoning'] as String, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  if (_aiResult!['needs_confirmation'] == true)
                    const Text('Low confidence — please confirm or correct the material below.',
                        style: TextStyle(fontSize: 12, color: Colors.orange, fontWeight: FontWeight.bold)),
                ],
                const SizedBox(height: 12),
                const Text('Material (edit if needed):'),
                DropdownButton<String>(
                  value: _selectedMaterial,
                  isExpanded: true,
                  items: _materials.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                  onChanged: (val) => setState(() => _selectedMaterial = val ?? 'PCB'),
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
                if (_priceLoading)
                  const Center(child: CircularProgressIndicator())
                else if (_priceError != null) ...[
                  Text(_priceError!, style: const TextStyle(color: Colors.red)),
                  TextButton(onPressed: _fetchPriceEstimate, child: const Text('Retry')),
                ] else if (_priceEstimate != null) ...[
                  Text(
                    'Estimated Scrap Value: ₹${_priceEstimate!['min']} – ₹${_priceEstimate!['max']} '
                    '(median ₹${_priceEstimate!['median']})',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text('Confidence: ${_priceEstimate!['confidence']}'),
                  const SizedBox(height: 8),
                  Text(
                    _priceEstimate!['explanation']?.toString() ?? '',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ] else
                  const Text('Continue from the previous step to see a price estimate.'),
              ],
            ),
          ),
      ],
    );
  }
}
