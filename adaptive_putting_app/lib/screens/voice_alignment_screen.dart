import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_compass/flutter_compass.dart';
import '../services/audio_service.dart';
import '../services/alignment_calculator.dart';
import '../widgets/accessibility_button.dart';

class VoiceAlignmentScreen extends StatefulWidget {
  const VoiceAlignmentScreen({super.key});

  @override
  State<VoiceAlignmentScreen> createState() => _VoiceAlignmentScreenState();
}

class _VoiceAlignmentScreenState extends State<VoiceAlignmentScreen> {
  // Services
  final AudioService _audio = AudioService();
  
  // Compass state
  StreamSubscription? _compassSubscription;
  double? _targetHeading;
  double _currentHeading = 0.0;
  
  // App state
  AppPhase _currentPhase = AppPhase.ready;
  bool _sensorsAvailable = true;
  String _statusMessage = 'Tap START to begin';
  
  // Alignment feedback
  Timer? _alignmentTimer;
  bool _alignedAnnounced = false;
  AlignmentInstruction _currentInstruction = AlignmentInstruction.rotateLeft;
  
  // Thresholds
  static const double alignedThreshold = 3.0;
  static const double slightThreshold = 8.0;

  @override
  void initState() {
    super.initState();
    _checkCompass();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  /// Check if compass is available
  Future<void> _checkCompass() async {
    try {
      final stream = FlutterCompass.events;
      bool available = stream != null;
      setState(() {
        _sensorsAvailable = available;
        if (!available) {
          _statusMessage = 'Compass not available on this device';
        }
      });
    } catch (e) {
      setState(() {
        _sensorsAvailable = false;
        _statusMessage = 'Compass not available';
      });
    }
  }

  /// Start the alignment process
  Future<void> _startProcess() async {
    setState(() {
      _currentPhase = AppPhase.atHole;
      _statusMessage = 'Walk to the hole.\nGet in putting stance.\nTap SAVE when ready.';
      _targetHeading = null;
    });
  }

  /// Save current compass direction
  Future<void> _saveDirection() async {
    // Immediate feedback
    HapticFeedback.heavyImpact();

    try {
      // Get current compass heading
      final event = await FlutterCompass.events?.first;
      
      if (event?.heading != null) {
        _targetHeading = event!.heading!;
        
        setState(() {
          _currentPhase = AppPhase.walkingBack;
          _statusMessage = 'Direction saved!\nWalk back to your ball.';
        });
        
        print('✓ Saved heading: $_targetHeading°');
      } else {
        setState(() {
          _statusMessage = 'Could not read compass.\nTap SAVE to try again.';
        });
      }
    } catch (e) {
      print('Save error: $e');
      setState(() {
        _statusMessage = 'Error saving.\nTap SAVE to try again.';
      });
    }
  }

  /// Start alignment feedback
  Future<void> _startAlignment() async {
    setState(() {
      _currentPhase = AppPhase.aligning;
      _statusMessage = 'Aligning...\nTurn until you hear ALIGNED';
      _alignedAnnounced = false;
    });

    // Start compass listening
    _compassSubscription = FlutterCompass.events?.listen((event) {
      if (event.heading != null) {
        setState(() {
          _currentHeading = event.heading!;
        });
      }
    });

    // Start alignment feedback loop
    _alignmentTimer = Timer.periodic(const Duration(milliseconds: 600), (timer) {
      _provideAlignmentFeedback();
    });
  }

  /// Provide audio feedback based on current alignment
  Future<void> _provideAlignmentFeedback() async {
    if (_targetHeading == null) return;

    double diff = _normalizeAngle(_currentHeading - _targetHeading!);
    AlignmentInstruction instruction = _getInstruction(diff);
    
    setState(() {
      _currentInstruction = instruction;
    });

    if (instruction == AlignmentInstruction.aligned) {
      if (!_alignedAnnounced) {
        _alignedAnnounced = true;
        HapticFeedback.heavyImpact();
        await _audio.speakInstruction(AlignmentInstruction.aligned);
      }
    } else {
      _alignedAnnounced = false;
      await _audio.speakInstruction(instruction);
    }
  }

  /// Get instruction based on angle difference
  AlignmentInstruction _getInstruction(double diff) {
    double absDiff = diff.abs();
    
    if (absDiff <= alignedThreshold) {
      return AlignmentInstruction.aligned;
    }
    
    if (absDiff <= slightThreshold) {
      return diff > 0
          ? AlignmentInstruction.slightlyLeft
          : AlignmentInstruction.slightlyRight;
    }
    
    return diff > 0
        ? AlignmentInstruction.rotateLeft
        : AlignmentInstruction.rotateRight;
  }

  /// Normalize angle to -180 to +180
  double _normalizeAngle(double angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  /// Stop alignment
  void _stopAlignment() {
    _alignmentTimer?.cancel();
    _compassSubscription?.cancel();
    setState(() {
      _currentPhase = AppPhase.walkingBack;
      _statusMessage = 'Alignment paused.\nTap ALIGN to continue.';
    });
  }

  /// Reset everything
  void _reset() {
    _alignmentTimer?.cancel();
    _compassSubscription?.cancel();
    
    setState(() {
      _currentPhase = AppPhase.ready;
      _targetHeading = null;
      _statusMessage = 'Tap START to begin';
      _alignedAnnounced = false;
    });
  }

  @override
  void dispose() {
    _alignmentTimer?.cancel();
    _compassSubscription?.cancel();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFFFF),
      appBar: AppBar(
        title: const Text('BODY ALIGNMENT'),
        backgroundColor: const Color(0xFF000000),
        foregroundColor: const Color(0xFFFFFFFF),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _reset,
            tooltip: 'Start over',
          ),
        ],
      ),
      body: SafeArea(
        child: _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildPhaseIndicator(),
          const SizedBox(height: 20),
          _buildStatusCard(),
          const SizedBox(height: 24),
          _buildPhaseContent(),
          const SizedBox(height: 24),
          _buildActionButton(),
          const SizedBox(height: 24),
          _buildDebugInfo(),
        ],
      ),
    );
  }

  Widget _buildPhaseIndicator() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF000000), width: 2),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildPhaseDot('1', 'START', _currentPhase == AppPhase.ready),
          _buildPhaseLine(_currentPhase.index >= 1),
          _buildPhaseDot('2', 'SAVE', _currentPhase == AppPhase.atHole),
          _buildPhaseLine(_currentPhase.index >= 2),
          _buildPhaseDot('3', 'WALK', _currentPhase == AppPhase.walkingBack),
          _buildPhaseLine(_currentPhase.index >= 3),
          _buildPhaseDot('4', 'ALIGN', _currentPhase == AppPhase.aligning),
        ],
      ),
    );
  }

  Widget _buildPhaseDot(String number, String label, bool isActive) {
    return Column(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? const Color(0xFF000000) : const Color(0xFFCCCCCC),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: Center(
            child: Text(
              number,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: isActive ? const Color(0xFFFFFFFF) : const Color(0xFF666666),
                fontFamily: 'Arial',
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: isActive ? const Color(0xFF000000) : const Color(0xFF999999),
            fontFamily: 'Arial',
          ),
        ),
      ],
    );
  }

  Widget _buildPhaseLine(bool isActive) {
    return Container(
      width: 20,
      height: 3,
      color: isActive ? const Color(0xFF000000) : const Color(0xFFCCCCCC),
    );
  }

  Widget _buildStatusCard() {
    Color bgColor;
    Color fgColor;
    IconData icon;

    switch (_currentPhase) {
      case AppPhase.ready:
        bgColor = const Color(0xFFF5F5F5);
        fgColor = const Color(0xFF000000);
        icon = Icons.sports_golf;
        break;
      case AppPhase.atHole:
        bgColor = const Color(0xFF0000AA);
        fgColor = const Color(0xFFFFFFFF);
        icon = Icons.flag;
        break;
      case AppPhase.walkingBack:
        bgColor = const Color(0xFF006600);
        fgColor = const Color(0xFFFFFFFF);
        icon = Icons.directions_walk;
        break;
      case AppPhase.aligning:
        bgColor = _getAlignmentColor();
        fgColor = _getAlignmentTextColor();
        icon = _getAlignmentIcon();
        break;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF000000), width: 3),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: fgColor),
          const SizedBox(height: 12),
          Text(
            _statusMessage,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: fgColor,
              fontFamily: 'Arial',
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Color _getAlignmentColor() {
    switch (_currentInstruction) {
      case AlignmentInstruction.aligned:
        return const Color(0xFF006600);
      case AlignmentInstruction.slightlyLeft:
      case AlignmentInstruction.slightlyRight:
        return const Color(0xFFFFCC00);
      case AlignmentInstruction.rotateLeft:
      case AlignmentInstruction.rotateRight:
        return const Color(0xFFCC6600);
    }
  }

  Color _getAlignmentTextColor() {
    switch (_currentInstruction) {
      case AlignmentInstruction.slightlyLeft:
      case AlignmentInstruction.slightlyRight:
        return const Color(0xFF000000);
      default:
        return const Color(0xFFFFFFFF);
    }
  }

  IconData _getAlignmentIcon() {
    switch (_currentInstruction) {
      case AlignmentInstruction.aligned:
        return Icons.check_circle;
      case AlignmentInstruction.slightlyLeft:
      case AlignmentInstruction.rotateLeft:
        return Icons.rotate_left;
      case AlignmentInstruction.slightlyRight:
      case AlignmentInstruction.rotateRight:
        return Icons.rotate_right;
    }
  }

  Widget _buildPhaseContent() {
    switch (_currentPhase) {
      case AppPhase.ready:
        return _buildReadyContent();
      case AppPhase.atHole:
        return _buildAtHoleContent();
      case AppPhase.walkingBack:
        return _buildWalkingContent();
      case AppPhase.aligning:
        return _buildAligningContent();
    }
  }

  Widget _buildReadyContent() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF000000), width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'HOW IT WORKS:',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
            ),
          ),
          const SizedBox(height: 16),
          _buildInstructionRow('1', 'Tap START below'),
          _buildInstructionRow('2', 'Walk to the hole'),
          _buildInstructionRow('3', 'Get in putting stance facing your ball'),
          _buildInstructionRow('4', 'Tap SAVE DIRECTION'),
          _buildInstructionRow('5', 'Walk back to your ball'),
          _buildInstructionRow('6', 'Get in putting stance'),
          _buildInstructionRow('7', 'Tap ALIGN'),
          _buildInstructionRow('8', 'Turn until you hear "ALIGNED"'),
        ],
      ),
    );
  }

  Widget _buildInstructionRow(String number, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: const Color(0xFF000000),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  fontFamily: 'Arial',
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 18,
                color: Color(0xFF000000),
                fontFamily: 'Arial',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAtHoleContent() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF0000AA),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF000000), width: 3),
      ),
      child: const Column(
        children: [
          Icon(
            Icons.flag,
            size: 80,
            color: Color(0xFFFFFF00),
          ),
          SizedBox(height: 16),
          Text(
            'AT THE HOLE',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFFFFF),
              fontFamily: 'Arial',
            ),
          ),
          SizedBox(height: 16),
          Text(
            'Get in your putting stance\nfacing toward your ball.\n\nTap SAVE DIRECTION when ready.',
            style: TextStyle(
              fontSize: 18,
              color: Color(0xFFFFFFFF),
              fontFamily: 'Arial',
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildWalkingContent() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF006600),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF000000), width: 3),
      ),
      child: Column(
        children: [
          const Icon(Icons.check_circle, size: 60, color: Color(0xFFFFFFFF)),
          const SizedBox(height: 12),
          const Text(
            '✓ DIRECTION SAVED',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFFFFF),
              fontFamily: 'Arial',
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Heading: ${_targetHeading?.toStringAsFixed(0)}°',
            style: const TextStyle(
              fontSize: 20,
              color: Color(0xFFFFFFFF),
              fontFamily: 'Arial',
            ),
          ),
          const SizedBox(height: 24),
          const Icon(Icons.directions_walk, size: 60, color: Color(0xFFFFFFFF)),
          const SizedBox(height: 12),
          const Text(
            'Walk back to your ball.\nGet in putting stance.\nTap ALIGN when ready.',
            style: TextStyle(
              fontSize: 18,
              color: Color(0xFFFFFFFF),
              fontFamily: 'Arial',
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildAligningContent() {
    double diff = _targetHeading != null 
        ? _normalizeAngle(_currentHeading - _targetHeading!)
        : 0;

    String instructionText;
    Color bgColor = _getAlignmentColor();
    Color textColor = _getAlignmentTextColor();

    switch (_currentInstruction) {
      case AlignmentInstruction.aligned:
        instructionText = '✓ ALIGNED\nTAKE YOUR SHOT!';
        break;
      case AlignmentInstruction.slightlyLeft:
        instructionText = '← SLIGHT LEFT';
        break;
      case AlignmentInstruction.slightlyRight:
        instructionText = 'SLIGHT RIGHT →';
        break;
      case AlignmentInstruction.rotateLeft:
        instructionText = '⟵ TURN LEFT';
        break;
      case AlignmentInstruction.rotateRight:
        instructionText = 'TURN RIGHT ⟶';
        break;
    }

    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF000000), width: 4),
      ),
      child: Column(
        children: [
          Icon(_getAlignmentIcon(), size: 100, color: textColor),
          const SizedBox(height: 16),
          Text(
            instructionText,
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: textColor,
              fontFamily: 'Arial',
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            '${diff.toStringAsFixed(1)}° off',
            style: TextStyle(
              fontSize: 24,
              color: textColor.withOpacity(0.9),
              fontFamily: 'Arial',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton() {
    switch (_currentPhase) {
      case AppPhase.ready:
        return AccessibilityButton(
          label: 'START',
          semanticsHint: 'Begin the alignment process',
          icon: Icons.play_arrow,
          onPressed: _startProcess,
        );
      
      case AppPhase.atHole:
        return AccessibilityButton(
          label: 'SAVE DIRECTION',
          semanticsHint: 'Save your current facing direction',
          icon: Icons.save,
          onPressed: _saveDirection,
        );
      
      case AppPhase.walkingBack:
        return AccessibilityButton(
          label: 'ALIGN',
          semanticsHint: 'Start alignment feedback',
          icon: Icons.compass_calibration,
          onPressed: _startAlignment,
        );
      
      case AppPhase.aligning:
        return AccessibilityButton(
          label: 'STOP',
          semanticsHint: 'Stop alignment',
          icon: Icons.stop,
          onPressed: _stopAlignment,
          isPrimary: false,
        );
    }
  }

  Widget _buildDebugInfo() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF000000), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'STATUS:',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Color(0xFF666666),
              fontFamily: 'Arial',
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                _sensorsAvailable ? Icons.check_circle : Icons.error,
                size: 16,
                color: _sensorsAvailable ? const Color(0xFF006600) : const Color(0xFFCC0000),
              ),
              const SizedBox(width: 8),
              Text(
                'Compass: ${_sensorsAvailable ? "Available" : "Not available"}',
                style: const TextStyle(fontSize: 14, fontFamily: 'Arial'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Current heading: ${_currentHeading.toStringAsFixed(1)}°',
            style: const TextStyle(fontSize: 14, fontFamily: 'Arial'),
          ),
          Text(
            'Target heading: ${_targetHeading?.toStringAsFixed(1) ?? "Not set"}°',
            style: const TextStyle(fontSize: 14, fontFamily: 'Arial'),
          ),
        ],
      ),
    );
  }
}

enum AppPhase {
  ready,
  atHole,
  walkingBack,
  aligning,
}