import 'dart:async';
import 'dart:math' as math;
import '../models/putter_alignment.dart';
import 'alignment_calculator.dart';

/// Simulates UWB sensor data for testing
class SimulationService {
  Timer? _simulationTimer;
  final math.Random _random = math.Random();
  
  // Simulation parameters
  final double _baseline = 0.15; // 15cm between putter sensors
  final double _baseDistance = 2.5; // ~2.5m to hole
  
  // Simulated putter state
  double _currentAngle = 25.0; // Start 25 degrees off
  double _targetAngle = 0.0; // Target is aligned (0 degrees)
  bool _userIsAdjusting = false;
  
  final StreamController<PutterAlignment> _alignmentController =
      StreamController<PutterAlignment>.broadcast();
  final StreamController<SimulatedUWBData> _rawDataController =
      StreamController<SimulatedUWBData>.broadcast();
  
  Stream<PutterAlignment> get alignmentStream => _alignmentController.stream;
  Stream<SimulatedUWBData> get rawDataStream => _rawDataController.stream;
  
  bool get isRunning => _simulationTimer != null;
  double get currentAngle => _currentAngle;
  
  /// Start the simulation
  void startSimulation({bool autoAdjust = false}) {
    _userIsAdjusting = autoAdjust;
    
    // Reset to starting position
    _currentAngle = 20.0 + _random.nextDouble() * 10; // Random 20-30 degrees
    if (_random.nextBool()) _currentAngle = -_currentAngle; // Random direction
    
    _simulationTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      _updateSimulation();
    });
  }
  
  /// Stop the simulation
  void stopSimulation() {
    _simulationTimer?.cancel();
    _simulationTimer = null;
  }
  
  /// Simulate user rotating putter left
  void rotateLeft() {
    _currentAngle -= 3.0 + _random.nextDouble() * 2; // Rotate 3-5 degrees
    _emitCurrentState();
  }
  
  /// Simulate user rotating putter right
  void rotateRight() {
    _currentAngle += 3.0 + _random.nextDouble() * 2; // Rotate 3-5 degrees
    _emitCurrentState();
  }
  
  /// Main simulation update
  void _updateSimulation() {
    // Add small random noise to simulate real sensor jitter
    double noise = (_random.nextDouble() - 0.5) * 0.5; // +/- 0.25 degrees
    
    // If auto-adjusting, slowly move toward target
    if (_userIsAdjusting) {
      if (_currentAngle > _targetAngle + 1) {
        _currentAngle -= 2.0 + _random.nextDouble(); // Move 2-3 degrees toward target
      } else if (_currentAngle < _targetAngle - 1) {
        _currentAngle += 2.0 + _random.nextDouble();
      }
    }
    
    _emitCurrentState(noise: noise);
  }
  
  void _emitCurrentState({double noise = 0}) {
    double angleWithNoise = _currentAngle + noise;
    
    // Convert angle to simulated UWB distances
    SimulatedUWBData uwbData = _angleToUWBDistances(angleWithNoise);
    _rawDataController.add(uwbData);
    
    // Calculate alignment from UWB data (like real system would)
    PutterAlignment alignment = AlignmentCalculator.calculateAlignment(
      dL: uwbData.distanceLeft,
      dR: uwbData.distanceRight,
      baseline: _baseline,
    );
    
    _alignmentController.add(alignment);
  }
  
  /// Convert angle to simulated UWB distance measurements
  /// This reverses the angle calculation to generate realistic distances
  SimulatedUWBData _angleToUWBDistances(double angleDeg) {
    double angleRad = angleDeg * math.pi / 180;
    
    // Hole position (straight ahead at baseDistance)
    double holeX = 0;
    double holeY = _baseDistance;
    
    // Putter sensor positions (rotated by angle)
    double halfBaseline = _baseline / 2;
    
    // Left sensor position
    double leftX = -halfBaseline * math.cos(angleRad);
    double leftY = -halfBaseline * math.sin(angleRad);
    
    // Right sensor position  
    double rightX = halfBaseline * math.cos(angleRad);
    double rightY = halfBaseline * math.sin(angleRad);
    
    // Calculate distances
    double dL = math.sqrt(
      math.pow(holeX - leftX, 2) + math.pow(holeY - leftY, 2)
    );
    double dR = math.sqrt(
      math.pow(holeX - rightX, 2) + math.pow(holeY - rightY, 2)
    );
    
    // Add small measurement noise
    dL += (_random.nextDouble() - 0.5) * 0.002; // +/- 1mm noise
    dR += (_random.nextDouble() - 0.5) * 0.002;
    
    return SimulatedUWBData(
      distanceLeft: dL,
      distanceRight: dR,
      baseline: _baseline,
      timestamp: DateTime.now(),
    );
  }
  
  void dispose() {
    stopSimulation();
    _alignmentController.close();
    _rawDataController.close();
  }
}

/// Raw UWB distance data
class SimulatedUWBData {
  final double distanceLeft;
  final double distanceRight;
  final double baseline;
  final DateTime timestamp;
  
  const SimulatedUWBData({
    required this.distanceLeft,
    required this.distanceRight,
    required this.baseline,
    required this.timestamp,
  });
  
  @override
  String toString() => 
      'UWB(dL: ${distanceLeft.toStringAsFixed(3)}m, '
      'dR: ${distanceRight.toStringAsFixed(3)}m)';
}