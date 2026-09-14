import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

class SafetyGuidePage extends StatefulWidget {
  final String materialCode;

  const SafetyGuidePage({Key? key, required this.materialCode}) : super(key: key);

  @override
  State<SafetyGuidePage> createState() => _SafetyGuidePageState();
}

class _SafetyGuidePageState extends State<SafetyGuidePage> {
  final FlutterTts _tts = FlutterTts();
  bool _isPlayingTts = false;

  final Map<String, String> _safetyAlerts = {
    'BATTERY': 'WARNING: Risk of thermal runaway and chemical burns. Do not puncture, crush, or expose to heat. Store in non-conductive sand or insulated container.',
    'CRT': 'WARNING: High vacuum implosion hazard and leaded glass toxicity. Do not break CRT tube neck or funnel glass.',
    'PCB': 'NOTICE: Wear safety gloves and dust mask. Solder pads contain lead and cadmium particulates. Avoid open flame burning.',
    'CABLE': 'NOTICE: Use mechanical wire strippers. Open burning of PVC insulation produces carcinogenic dioxins and is illegal under CPCB rules.',
  };

  @override
  void initState() {
    super.initState();
    _initTts();
  }

  void _initTts() async {
    await _tts.setLanguage('en-IN');
    await _tts.setPitch(1.0);
    _tts.setCompletionHandler(() {
      setState(() => _isPlayingTts = false);
    });
  }

  void _speakSafetyText() async {
    final text = _safetyAlerts[widget.materialCode] ?? 'Handle e-waste with puncture-resistant gloves and proper eye protection.';
    if (_isPlayingTts) {
      await _tts.stop();
      setState(() => _isPlayingTts = false);
    } else {
      setState(() => _isPlayingTts = true);
      await _tts.speak(text);
    }
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alertText = _safetyAlerts[widget.materialCode] ??
        'Handle e-waste with puncture-resistant gloves and proper eye protection.';

    return Scaffold(
      appBar: AppBar(
        title: Text('Safety Guidance: ${widget.materialCode}'),
        backgroundColor: Colors.deepOrange,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // TTS Voice Guide Button (Low-literacy feature)
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepOrange,
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              ),
              onPressed: _speakSafetyText,
              icon: Icon(_isPlayingTts ? Icons.stop : Icons.volume_up, color: Colors.white),
              label: Text(
                _isPlayingTts ? 'Stop Voice Prompt' : 'Listen Aloud (Voice Guidance)',
                style: const TextStyle(color: Colors.white),
              ),
            ),
            const SizedBox(height: 16),

            // Hazard Warning Card
            Card(
              color: Colors.amber.shade50,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: Colors.deepOrange),
                        SizedBox(width: 8),
                        Text('CPCB Handling Protocol', style: TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(alertText, style: const TextStyle(fontSize: 14)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Tier 2 #10 ISL Video Guidance Placeholder
            const Text(
              'Indian Sign Language (ISL) Video Demo',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              height: 200,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.play_circle_fill, size: 54, color: Colors.white70),
                    SizedBox(height: 8),
                    Text(
                      'ISL Demonstration: Safe Handling\n(Playing from safety_content repository)',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
