import 'dart:typed_data';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

/// Live camera preview + capture. Pops with the captured JPEG bytes
/// (Uint8List) on success, or null if the user backs out.
class CameraCapturePage extends StatefulWidget {
  const CameraCapturePage({Key? key}) : super(key: key);

  @override
  State<CameraCapturePage> createState() => _CameraCapturePageState();
}

class _CameraCapturePageState extends State<CameraCapturePage> {
  CameraController? _controller;
  String? _error;
  bool _capturing = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _error = 'No camera available on this device.');
        return;
      }
      final controller = CameraController(cameras.first, ResolutionPreset.medium, enableAudio: false);
      await controller.initialize();
      if (!mounted) {
        await controller.dispose(); // Screen was popped mid-init — don't leak the controller.
        return;
      }
      setState(() => _controller = controller);
    } catch (e) {
      // Covers permission-denied and any other platform/plugin failure.
      if (mounted) setState(() => _error = 'Could not open camera: $e');
    }
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || _capturing) return;
    setState(() => _capturing = true);
    try {
      final file = await controller.takePicture();
      final Uint8List bytes = await file.readAsBytes();
      if (mounted) Navigator.pop(context, bytes);
    } catch (e) {
      if (mounted) {
        setState(() {
          _capturing = false;
          _error = 'Could not capture photo: $e';
        });
      }
    }
  }

  @override
  void dispose() {
    _controller?.dispose(); // Required: CameraController not disposed on exit is a well-known plugin leak/crash source.
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      appBar: AppBar(title: const Text('Photograph the material'), backgroundColor: Colors.teal),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(16), child: Text(_error!)))
          : (controller == null || !controller.value.isInitialized)
              ? const Center(child: CircularProgressIndicator())
              : Stack(
                  fit: StackFit.expand,
                  children: [
                    CameraPreview(controller),
                    Positioned(
                      bottom: 24,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: ElevatedButton.icon(
                          onPressed: _capturing ? null : _capture,
                          icon: _capturing
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.camera_alt),
                          label: Text(_capturing ? 'Capturing...' : 'Capture'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.teal,
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
