import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  bool _showAngle = true; // Toggle for showing/hiding angle
  int _lastSpokenDingCount = 0;
  
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
      _lastSpokenDingCount = 0;
    });
    
    _addLog('Simulation started');
    _simulation.startSimulation(
      autoAdjust: _autoMode,
      onAutoStop: _onAlignmentAutoStop,
    );
    
    // Audio feedback timer
    _audioTimer = Timer.periodic(const Duration(milliseconds: 600), (timer) {
      if (_currentAlignment != null) {
        _provideAudioFeedback();
      }
    });
  }
  
  void _provideAudioFeedback() {
    // If aligned, limit dings
    if (_currentInstruction == AlignmentInstruction.aligned) {
      if (_simulation.alignedDingCount > _lastSpokenDingCount && 
          _simulation.alignedDingCount <= 3) {
        _audio.speakInstruction(_currentInstruction);
        _addLog('${AudioService.getInstructionText(_currentInstruction)} (${_simulation.alignedDingCount}/3)');
        _lastSpokenDingCount = _simulation.alignedDingCount;
      }
    } else {
      // Not aligned - give regular feedback
      _lastSpokenDingCount = 0;
      _audio.speakInstruction(_currentInstruction);
      _addLog(AudioService.getInstructionText(_currentInstruction));
    }
  }
  
  void _onAlignmentAutoStop() {
    setState(() {
      _isRunning = false;
    });
    
    _audioTimer?.cancel();
    _addLog('✓ ALIGNMENT COMPLETE - Auto-stopped after 2 seconds aligned');
    
    // Final confirmation
    HapticFeedback.heavyImpact();
    _audio.speakText('Alignment complete. You may putt.');
  }
  
  void _stopSimulation() {
    setState(() {
      _isRunning = false;
    });
    
    _simulation.stopSimulation();
    _audioTimer?.cancel();
    _addLog('Simulation stopped');
  }
  
  void _toggleAngleVisibility() {
    setState(() {
      _showAngle = !_showAngle;
    });
    _addLog(_showAngle ? 'Angle visible' : 'Angle hidden (audio-only mode)');
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
      backgroundColor: const Color(0xFFFFFFFF),
      appBar: AppBar(
        title: const Text('UWB SIMULATION'),
        backgroundColor: const Color(0xFF000000),
        foregroundColor: const Color(0xFFFFFFFF),
        actions: [
          // Toggle angle visibility button in app bar
          IconButton(
            onPressed: _toggleAngleVisibility,
            icon: Icon(_showAngle ? Icons.visibility : Icons.visibility_off),
            tooltip: _showAngle ? 'Hide angle (test mode)' : 'Show angle',
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Alignment Visualization
              _buildAlignmentVisualization(),
              
              const SizedBox(height: 20),
              
              // Data Display (only if showing angle)
              if (_showAngle) _buildDataDisplay(),
              
              if (_showAngle) const SizedBox(height: 20),
              
              // Manual Controls
              if (_isRunning && !_autoMode) _buildManualControls(),
              
              const SizedBox(height: 20),
              
              // Control Buttons
              _buildControlButtons(),
              
              const SizedBox(height: 20),
              
              // Log Display
              _buildLogDisplay(),
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildAlignmentVisualization() {
    double angle = _currentAlignment?.angleOffset ?? 0;
    AlignmentInstruction instruction = _currentInstruction;
    
    // High contrast colors with redundant signaling
    Color backgroundColor;
    Color foregroundColor;
    String statusText;
    IconData statusIcon;
    
    switch (instruction) {
      case AlignmentInstruction.aligned:
        backgroundColor = const Color(0xFF006600);  // Dark green
        foregroundColor = const Color(0xFFFFFFFF);
        statusText = '✓ ALIGNED';
        statusIcon = Icons.check_circle;
        break;
      case AlignmentInstruction.slightlyLeft:
        backgroundColor = const Color(0xFFFFCC00);  // Yellow
        foregroundColor = const Color(0xFF000000);
        statusText = '← SLIGHT LEFT';
        statusIcon = Icons.arrow_back;
        break;
      case AlignmentInstruction.slightlyRight:
        backgroundColor = const Color(0xFFFFCC00);  // Yellow
        foregroundColor = const Color(0xFF000000);
        statusText = 'SLIGHT RIGHT →';
        statusIcon = Icons.arrow_forward;
        break;
      case AlignmentInstruction.rotateLeft:
        backgroundColor = const Color.fromARGB(255, 204, 0, 0);  // Red
        foregroundColor = const Color(0xFFFFFFFF);
        statusText = '⟵ ROTATE LEFT';
        statusIcon = Icons.rotate_left;
        break;
      case AlignmentInstruction.rotateRight:
        backgroundColor = const Color.fromARGB(255, 204, 0, 0);  // Red
        foregroundColor = const Color(0xFFFFFFFF);
        statusText = 'ROTATE RIGHT ⟶';
        statusIcon = Icons.rotate_right;
        break;
    }
    
    // Aim description for redundant signaling
    String aimDescription = '';
    if (_showAngle && angle.abs() > 1) {
      aimDescription = angle > 0 
          ? '(Currently aimed RIGHT of hole)' 
          : '(Currently aimed LEFT of hole)';
    }
    
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF000000), width: 3),
      ),
      child: Column(
        children: [
          // Icon for redundant signaling
          Icon(
            statusIcon,
            size: 60,
            color: foregroundColor,
          ),
          
          const SizedBox(height: 12),
          
          // Angle display (conditional)
          if (_showAngle)
            Text(
              '${angle.toStringAsFixed(1)}°',
              style: TextStyle(
                fontSize: 48,
                fontWeight: FontWeight.bold,
                color: foregroundColor,
                fontFamily: 'Arial',
              ),
            )
          else
            Text(
              '---',
              style: TextStyle(
                fontSize: 48,
                fontWeight: FontWeight.bold,
                color: foregroundColor.withOpacity(0.5),
                fontFamily: 'Arial',
              ),
            ),
          
          const SizedBox(height: 8),
          
          // Status text
          Text(
            statusText,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: foregroundColor,
              fontFamily: 'Arial',
            ),
          ),
          
          if (aimDescription.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              aimDescription,
              style: TextStyle(
                fontSize: 18,
                color: foregroundColor.withOpacity(0.9),
                fontFamily: 'Arial',
              ),
            ),
          ],
          
          // Audio-only mode indicator
          if (!_showAngle) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: foregroundColor.withOpacity(0.2),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                '🎧 AUDIO-ONLY MODE',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: foregroundColor,
                  fontFamily: 'Arial',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
  
  Widget _buildDataDisplay() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF000000), width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'SENSOR DATA:',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildDataItem(
                'Left (dL)',
                _currentUWBData?.distanceLeft.toStringAsFixed(3) ?? '-.---',
                'meters',
              ),
              Container(width: 2, height: 50, color: const Color(0xFF000000)),
              _buildDataItem(
                'Right (dR)',
                _currentUWBData?.distanceRight.toStringAsFixed(3) ?? '-.---',
                'meters',
              ),
              Container(width: 2, height: 50, color: const Color(0xFF000000)),
              _buildDataItem(
                'Baseline',
                _currentUWBData?.baseline.toStringAsFixed(3) ?? '0.150',
                'meters',
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
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Color(0xFF333333),
            fontFamily: 'Arial',
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Color(0xFF000000),
            fontFamily: 'Arial',
          ),
        ),
        Text(
          unit,
          style: const TextStyle(
            fontSize: 14,
            color: Color(0xFF666666),
            fontFamily: 'Arial',
          ),
        ),
      ],
    );
  }
  
  Widget _buildManualControls() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'MANUAL CONTROL:',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF000000),
            fontFamily: 'Arial',
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {
                  _simulation.rotateLeft();
                  _addLog('Rotated left');
                },
                icon: const Icon(Icons.rotate_left, size: 28),
                label: const Text('LEFT', style: TextStyle(fontSize: 18)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0000AA),
                  foregroundColor: const Color(0xFFFFFFFF),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: const BorderSide(color: Color(0xFF000000), width: 2),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {
                  _simulation.rotateRight();
                  _addLog('Rotated right');
                },
                icon: const Icon(Icons.rotate_right, size: 28),
                label: const Text('RIGHT', style: TextStyle(fontSize: 18)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0000AA),
                  foregroundColor: const Color(0xFFFFFFFF),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: const BorderSide(color: Color(0xFF000000), width: 2),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
  
  Widget _buildControlButtons() {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      // Toggle angle visibility button
      GestureDetector(
        onTap: _toggleAngleVisibility,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _showAngle ? const Color(0xFFF5F5F5) : const Color(0xFF333333),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: Row(
            children: [
              Icon(
                _showAngle ? Icons.visibility : Icons.visibility_off,
                color: _showAngle ? const Color(0xFF000000) : const Color(0xFFFFFFFF),
                size: 28,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _showAngle ? 'ANGLE VISIBLE' : 'ANGLE HIDDEN',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: _showAngle ? const Color(0xFF000000) : const Color(0xFFFFFFFF),
                        fontFamily: 'Arial',
                      ),
                    ),
                    Text(
                      _showAngle ? 'Tap to hide (audio-only test)' : 'Tap to show angle',
                      style: TextStyle(
                        fontSize: 12,
                        color: _showAngle ? const Color(0xFF666666) : const Color(0xFFCCCCCC),
                        fontFamily: 'Arial',
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.touch_app,
                color: _showAngle ? const Color(0xFF666666) : const Color(0xFFCCCCCC),
                size: 24,
              ),
            ],
          ),
        ),
      ),
      
      const SizedBox(height: 16),
      
      // Auto mode toggle
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F5F5),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF000000), width: 2),
        ),
        child: Row(
          children: [
            Checkbox(
              value: _autoMode,
              onChanged: _isRunning ? null : (value) {
                setState(() {
                  _autoMode = value ?? false;
                });
              },
              activeColor: const Color(0xFF000000),
              checkColor: const Color(0xFFFFFFFF),
              side: const BorderSide(color: Color(0xFF000000), width: 2),
            ),
            const Expanded(
              child: Text(
                'Auto-adjust mode (simulates following instructions)',
                style: TextStyle(
                  fontSize: 16,
                  color: Color(0xFF000000),
                  fontFamily: 'Arial',
                ),
              ),
            ),
          ],
        ),
      ),
      
      const SizedBox(height: 16),
      
      // Start/Stop button
      AccessibilityButton(
        label: _isRunning ? 'STOP SIMULATION' : 'START SIMULATION',
        semanticsHint: _isRunning ? 'Stop the simulation' : 'Start the simulation',
        icon: _isRunning ? Icons.stop : Icons.play_arrow,
        onPressed: _isRunning ? _stopSimulation : _startSimulation,
        isPrimary: !_isRunning,
      ),
    ],
  );
}
  
  Widget _buildLogDisplay() {
    return Container(
      height: 200,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF000000), width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.list_alt, size: 20, color: Color(0xFF000000)),
              SizedBox(width: 8),
              Text(
                'AUDIO LOG:',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF000000),
                  fontFamily: 'Arial',
                ),
              ),
            ],
          ),
          const Divider(color: Color(0xFF000000), thickness: 1),
          Expanded(
            child: ListView.builder(
              itemCount: _logMessages.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    _logMessages[index],
                    style: const TextStyle(
                      fontSize: 14,
                      fontFamily: 'Arial',
                      color: Color(0xFF333333),
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