import 'dart:math' as math;
import '../models/putter_alignment.dart';

/// Calculates putter alignment angle from UWB distance measurements
/// Based on the geometry from angle_demo.py
class AlignmentCalculator {
  // Tunable thresholds (matching Python code)
  static const double degStop = 1.0;   // Within +/- this = aligned
  static const double degFine = 4.0;   // Within +/- this = slight adjust

  /// Compute angle in degrees from UWB distances
  /// dL = distance from left sensor to hole (meters)
  /// dR = distance from right sensor to hole (meters)
  /// b = baseline distance between sensors on putter (meters)
  static double? computeThetaDeg(double dL, double dR, double b) {
    // x = (dL^2 - dR^2) / (2b)
    double x = (dL * dL - dR * dR) / (2.0 * b);
    
    // y^2 = (dL^2 + dR^2)/2 - b^2/4 - x^2
    double y2 = (dL * dL + dR * dR) / 2.0 - (b * b) / 4.0 - x * x;
    
    if (y2 < 0) {
      y2 = 0.0;
    }
    
    double y = math.sqrt(y2);
    
    if (y < 1e-6) {
      return null; // Unstable geometry
    }
    
    return _radiansToDegrees(math.atan2(x, y));
  }
  
  /// Get instruction based on angle
  /// +theta => putter is aimed RIGHT of hole => need to rotate LEFT
  /// -theta => putter is aimed LEFT of hole  => need to rotate RIGHT
  static AlignmentInstruction getInstruction(double thetaDeg) {
    double a = thetaDeg.abs();
    
    if (a <= degStop) {
      return AlignmentInstruction.aligned;
    }
    
    if (a <= degFine) {
      // FIXED: +theta (aimed right) means rotate LEFT to correct
      return thetaDeg > 0 
          ? AlignmentInstruction.slightlyLeft 
          : AlignmentInstruction.slightlyRight;
    }
    
    // FIXED: +theta (aimed right) means rotate LEFT to correct
    return thetaDeg > 0 
        ? AlignmentInstruction.rotateLeft 
        : AlignmentInstruction.rotateRight;
  }
  
  /// Convert to PutterAlignment model
  static PutterAlignment calculateAlignment({
    required double dL,
    required double dR,
    required double baseline,
  }) {
    double? theta = computeThetaDeg(dL, dR, baseline);
    
    if (theta == null) {
      return PutterAlignment(
        angleOffset: 0,
        distanceToHole: (dL + dR) / 2,
        confidence: 0.0,
        timestamp: DateTime.now(),
      );
    }
    
    return PutterAlignment(
      angleOffset: theta,
      distanceToHole: (dL + dR) / 2,
      confidence: 0.95,
      timestamp: DateTime.now(),
    );
  }
  
  static double _radiansToDegrees(double radians) => radians * 180 / math.pi;
}

enum AlignmentInstruction {
  aligned,
  slightlyLeft,
  slightlyRight,
  rotateLeft,
  rotateRight,
}