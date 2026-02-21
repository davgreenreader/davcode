import 'dart:async';
import 'package:flutter/material.dart';
import '../services/simulation_service.dart';
import '../services/alignment_calculator.dart';
import '../services/audio_service.dart';
import '../models/putter_alignment.dart';
import '../widgets/accessibility_button.dart';

class SimulationScreen extends StatefulWidget {
  const SimulationScreen({super.key});

  @override
  State<SimulationScreen> createState() => _SimulationScreenState();
}

class _SimulationScreenState extends State<SimulationScreen> {
  final SimulationService _simulation = SimulationService();
  final AudioService _audio = AudioService();
  
  PutterAlignment? _currentAlignment;
  SimulatedUWBData? _currentUWBData;
  AlignmentInstruction _currentInstruction = AlignmentInstruction.rotateRight;
  List<String> _logMessages = [];
  bool _isRunning = false;
  bool _autoMode = false;
  
  StreamSubscription? _alignmentSub;
  StreamSubscription? _uwbDataSub;
  Timer? _audioTimer;
  
  @override
  void initState() {
    super.initState();
    _setupListeners();
  }
  
  void _setupListeners() {
    _alignmentSub = _simulation.alignmentStream.listen((alignment) {
      setState(() {
        _currentAlignment = alignment;
        _currentInstruction = AlignmentCalculator.getInstruction(alignment.angleOffset);
      });
    });
    
    _uwbDataSub = _simulation.rawDataStream.listen((data) {
      setState(() {
        _currentUWBData = data;
      });
    });
  }
  
  void _startSimulation() {
    setState(() {
      _isRunning = true;
      _logMessages = [];
    });
    
    _addLog('🚀 Simulation started');
    _simulation.startSimulation(autoAdjust: _autoMode);
    
    // Audio feedback every 1 second
    _audioTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_currentAlignment != null) {
        _audio.speakInstruction(_currentInstruction);
        _addLog(AudioService.getInstructionText(_currentInstruction));
      }
    });
  }
  
  void _stopSimulation() {
    setState(() {
      _isRunning = false;
    });
    
    _simulation.stopSimulation();
    _audioTimer?.cancel();
    _addLog('🛑 Simulation stopped');
  }
  
  void _addLog(String message) {
    setState(() {
      _logMessages.insert(0, '${DateTime.now().toString().substring(11, 19)} - $message');
      if (_logMessages.length > 20) {
        _logMessages.removeLast();
      }
    });
  }
  
  @override
  void dispose() {
    _alignmentSub?.cancel();
    _uwbDataSub?.cancel();
    _audioTimer?.cancel();
    _simulation.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: const Text('UWB Simulation'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Alignment Visualization
              _buildAlignmentVisualization(),
              
              const SizedBox(height: 16),
              
              // Data Display
              _buildDataDisplay(),
              
              const SizedBox(height: 16),
              
              // Manual Controls
              if (_isRunning && !_autoMode) _buildManualControls(),
              
              const SizedBox(height: 16),
              
              // Control Buttons
              _buildControlButtons(),
              
              const SizedBox(height: 16),
              
              // Log Display
              Expanded(child: _buildLogDisplay()),
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildAlignmentVisualization() {
  double angle = _currentAlignment?.angleOffset ?? 0;
  AlignmentInstruction instruction = _currentInstruction;
  
  Color indicatorColor;
  String statusText;
  
  // Determine which side the aim is currently pointing
  String aimSide = '';
  if (angle.abs() > 1) {
    aimSide = angle > 0 ? '(aimed right of hole)' : '(aimed left of hole)';
  }
  
  switch (instruction) {
    case AlignmentInstruction.aligned:
      indicatorColor = Colors.green;
      statusText = '✓ ALIGNED';
      break;
    case AlignmentInstruction.slightlyLeft:
      indicatorColor = Colors.yellow;
      statusText = '← Rotate Left (slight)';
      break;
    case AlignmentInstruction.slightlyRight:
      indicatorColor = Colors.yellow;
      statusText = 'Rotate Right (slight) →';
      break;
    case AlignmentInstruction.rotateLeft:
      indicatorColor = Colors.orange;
      statusText = '⟵ Rotate Left';
      break;
    case AlignmentInstruction.rotateRight:
      indicatorColor = Colors.orange;
      statusText = 'Rotate Right ⟶';
      break;
  }
  
  return Container(
    height: 200,
    decoration: BoxDecoration(
      color: Colors.grey[900],
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: indicatorColor, width: 3),
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Angle display
        Text(
          '${angle.toStringAsFixed(1)}°',
          style: TextStyle(
            fontSize: 48,
            fontWeight: FontWeight.bold,
            color: indicatorColor,
          ),
        ),
        
        const SizedBox(height: 4),
        
        // Shows where putter is currently aimed
        Text(
          aimSide,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.white54,
          ),
        ),
        
        const SizedBox(height: 8),
        
        // Instruction - which way to rotate
        Text(
          statusText,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: indicatorColor,
          ),
        ),
        
        const SizedBox(height: 16),
        
        // Visual angle indicator
        _buildAngleIndicator(angle, indicatorColor),
      ],
    ),
  );
}
  
  Widget _buildAngleIndicator(double angle, Color color) {
    return SizedBox(
      width: 200,
      height: 40,
      child: CustomPaint(
        painter: AngleIndicatorPainter(angle: angle, color: color),
      ),
    );
  }
  
  Widget _buildDataDisplay() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[850],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Simulated UWB Data',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildDataItem(
                'Left Sensor (dL)',
                _currentUWBData?.distanceLeft.toStringAsFixed(3) ?? '-.---',
                'm',
              ),
              _buildDataItem(
                'Right Sensor (dR)',
                _currentUWBData?.distanceRight.toStringAsFixed(3) ?? '-.---',
                'm',
              ),
              _buildDataItem(
                'Baseline (b)',
                _currentUWBData?.baseline.toStringAsFixed(3) ?? '0.150',
                'm',
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  Widget _buildDataItem(String label, String value, String unit) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Colors.white54),
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                fontFamily: 'monospace',
              ),
            ),
            Text(
              unit,
              style: const TextStyle(fontSize: 14, color: Colors.white54),
            ),
          ],
        ),
      ],
    );
  }
  
  Widget _buildManualControls() {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              _simulation.rotateLeft();
              _addLog('👈 User rotated left');
            },
            icon: const Icon(Icons.rotate_left, size: 32),
            label: const Text('Rotate Left', style: TextStyle(fontSize: 18)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue[700],
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              _simulation.rotateRight();
              _addLog('👉 User rotated right');
            },
            icon: const Icon(Icons.rotate_right, size: 32),
            label: const Text('Rotate Right', style: TextStyle(fontSize: 18)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue[700],
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
      ],
    );
  }
  
  Widget _buildControlButtons() {
    return Column(
      children: [
        // Auto mode toggle
        Row(
          children: [
            Checkbox(
              value: _autoMode,
              onChanged: _isRunning ? null : (value) {
                setState(() {
                  _autoMode = value ?? false;
                });
              },
              activeColor: Colors.greenAccent,
            ),
            const Text(
              'Auto-adjust mode (simulates user following instructions)',
              style: TextStyle(fontSize: 14),
            ),
          ],
        ),
        
        const SizedBox(height: 8),
        
        // Start/Stop button
        AccessibilityButton(
          label: _isRunning ? 'Stop Simulation' : 'Start Simulation',
          semanticsHint: _isRunning ? 'Stop the UWB simulation' : 'Start the UWB simulation',
          icon: _isRunning ? Icons.stop : Icons.play_arrow,
          onPressed: _isRunning ? _stopSimulation : _startSimulation,
          isPrimary: !_isRunning,
        ),
      ],
    );
  }
  
  Widget _buildLogDisplay() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[800]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.terminal, size: 16, color: Colors.greenAccent),
              SizedBox(width: 8),
              Text(
                'Audio Log',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.greenAccent,
                ),
              ),
            ],
          ),
          const Divider(color: Colors.grey),
          Expanded(
            child: ListView.builder(
              itemCount: _logMessages.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    _logMessages[index],
                    style: const TextStyle(
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: Colors.white70,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Custom painter for the angle indicator
class AngleIndicatorPainter extends CustomPainter {
  final double angle;
  final Color color;
  
  AngleIndicatorPainter({required this.angle, required this.color});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey[700]!
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    
    // Draw background line
    canvas.drawLine(
      Offset(0, size.height / 2),
      Offset(size.width, size.height / 2),
      paint,
    );
    
    // Draw center mark
    paint.color = Colors.white54;
    canvas.drawLine(
      Offset(size.width / 2, size.height / 2 - 10),
      Offset(size.width / 2, size.height / 2 + 10),
      paint,
    );
    
    // Draw current position indicator
    // Map angle (-45 to +45) to position (0 to width)
    double normalizedAngle = (angle.clamp(-45, 45) + 45) / 90;
    double indicatorX = normalizedAngle * size.width;
    
    final indicatorPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    
    // Draw triangle indicator
    final path = Path();
    path.moveTo(indicatorX, size.height / 2 - 15);
    path.lineTo(indicatorX - 10, size.height / 2 + 10);
    path.lineTo(indicatorX + 10, size.height / 2 + 10);
    path.close();
    
    canvas.drawPath(path, indicatorPaint);
  }
  
  @override
  bool shouldRepaint(covariant AngleIndicatorPainter oldDelegate) {
    return oldDelegate.angle != angle || oldDelegate.color != color;
  }
}