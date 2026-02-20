import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import '../providers/app_state_provider.dart';
import '../widgets/alignment_indicator.dart';
import '../widgets/accessibility_button.dart';
import '../models/putter_alignment.dart';

class CameraModeScreen extends StatefulWidget {
  const CameraModeScreen({super.key});

  @override
  State<CameraModeScreen> createState() => _CameraModeScreenState();
}

class _CameraModeScreenState extends State<CameraModeScreen> {
  bool _isInitialized = false;
  bool _isDetecting = false;
  String _errorMessage = '';
  
  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }
  
  Future<void> _initializeCamera() async {
    // Request camera permission
    final status = await Permission.camera.request();
    
    if (status.isGranted) {
      try {
        final provider = context.read<AppStateProvider>();
        await provider.cameraService.initialize();
        
        // Listen to alignment updates
        provider.cameraService.alignmentStream.listen((alignment) {
          provider.updateAlignment(alignment);
        });
        
        setState(() {
          _isInitialized = true;
        });
      } catch (e) {
        setState(() {
          _errorMessage = 'Failed to initialize camera: $e';
        });
      }
    } else {
      setState(() {
        _errorMessage = 'Camera permission required';
      });
    }
  }
  
  Future<void> _toggleDetection() async {
    final provider = context.read<AppStateProvider>();
    
    if (_isDetecting) {
      await provider.cameraService.stopDetection();
      provider.hapticService.stopFeedback();
    } else {
      await provider.cameraService.startDetection();
    }
    
    setState(() {
      _isDetecting = !_isDetecting;
    });
  }
  
  @override
  void dispose() {
    final provider = context.read<AppStateProvider>();
    provider.cameraService.stopDetection();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.background,
      appBar: AppBar(
        title: const Text('Camera Mode'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _errorMessage.isNotEmpty
          ? _buildErrorView()
          : _isInitialized
              ? _buildCameraView()
              : _buildLoadingView(),
    );
  }
  
  Widget _buildLoadingView() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(
            color: Colors.greenAccent,
          ),
          SizedBox(height: 24),
          Text(
            'Initializing camera...',
            style: TextStyle(fontSize: 20),
          ),
        ],
      ),
    );
  }
  
  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 80,
              color: Colors.red,
            ),
            const SizedBox(height: 24),
            Text(
              _errorMessage,
              style: const TextStyle(fontSize: 20),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            AccessibilityButton(
              label: 'Retry',
              semanticsHint: 'Try initializing camera again',
              icon: Icons.refresh,
              onPressed: () {
                setState(() {
                  _errorMessage = '';
                });
                _initializeCamera();
              },
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildCameraView() {
    final provider = context.read<AppStateProvider>();
    final controller = provider.cameraService.controller;
    
    if (controller == null || !controller.value.isInitialized) {
      return _buildLoadingView();
    }
    
    return SafeArea(
      child: Column(
        children: [
          // Camera Preview
          Expanded(
            flex: 2,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Camera Feed
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: CameraPreview(controller),
                ),
                
                // Crosshair Overlay
                if (_isDetecting)
                  CustomPaint(
                    size: Size.infinite,
                    painter: CrosshairPainter(),
                  ),
                
                // Detection Status
                Positioned(
                  top: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: _isDetecting 
                          ? Colors.green.withOpacity(0.8)
                          : Colors.grey.withOpacity(0.8),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _isDetecting ? 'DETECTING' : 'PAUSED',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Alignment Indicator
          Expanded(
            flex: 1,
            child: Consumer<AppStateProvider>(
              builder: (context, state, _) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    // Visual alignment indicator
                    Expanded(
                      child: AlignmentIndicator(
                        alignment: state.currentAlignment,
                        compact: true,
                      ),
                    ),
                    
                    const SizedBox(height: 8),
                    
                    // Text feedback
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        _getDirectionText(state.currentAlignment),
                        style: Theme.of(context).textTheme.headlineMedium,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Control Button
          Padding(
            padding: const EdgeInsets.all(24),
            child: AccessibilityButton(
              label: _isDetecting ? 'Stop Detection' : 'Start Detection',
              semanticsHint: _isDetecting 
                  ? 'Stop hole detection' 
                  : 'Begin detecting golf hole',
              icon: _isDetecting ? Icons.stop : Icons.play_arrow,
              onPressed: _toggleDetection,
            ),
          ),
        ],
      ),
    );
  }
  
  String _getDirectionText(PutterAlignment alignment) {
    if (alignment.confidence < 0.3) {
      return 'Point camera at hole';
    }
    
    switch (alignment.direction) {
      case AlignmentDirection.centered:
        return 'HOLE CENTERED!';
      case AlignmentDirection.aimLeft:
        return '← Move LEFT';
      case AlignmentDirection.aimRight:
        return 'Move RIGHT →';
    }
  }
}

/// Crosshair overlay painter
class CrosshairPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.greenAccent.withOpacity(0.8)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width * 0.1;
    
    // Draw circle
    canvas.drawCircle(center, radius, paint);
    
    // Draw crosshairs
    canvas.drawLine(
      Offset(center.dx - radius * 1.5, center.dy),
      Offset(center.dx - radius * 0.5, center.dy),
      paint,
    );
    canvas.drawLine(
      Offset(center.dx + radius * 0.5, center.dy),
      Offset(center.dx + radius * 1.5, center.dy),
      paint,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy - radius * 1.5),
      Offset(center.dx, center.dy - radius * 0.5),
      paint,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy + radius * 0.5),
      Offset(center.dx, center.dy + radius * 1.5),
      paint,
    );
  }
  
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}