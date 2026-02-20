import 'dart:math';

/// Represents the alignment data from UWB sensors or camera
class PutterAlignment {
  /// Angle in degrees: negative = aim left, positive = aim right, 0 = perfect
  final double angleOffset;
  
  /// Distance to hole in meters
  final double distanceToHole;
  
  /// Confidence level 0-1
  final double confidence;
  
  /// Timestamp of reading
  final DateTime timestamp;
  
  const PutterAlignment({
    required this.angleOffset,
    required this.distanceToHole,
    required this.confidence,
    required this.timestamp,
  });
  
  /// Check if alignment is within acceptable range
  bool get isAligned => angleOffset.abs() < 2.0; // Within 2 degrees
  
  /// Check if close to aligned
  bool get isCloseToAligned => angleOffset.abs() < 5.0;
  
  /// Get direction hint for user
  AlignmentDirection get direction {
    if (isAligned) return AlignmentDirection.centered;
    return angleOffset < 0 
        ? AlignmentDirection.aimRight 
        : AlignmentDirection.aimLeft;
  }
  
  /// Calculate how far off (for haptic intensity)
  double get offsetIntensity => min(1.0, angleOffset.abs() / 45.0);
  
  factory PutterAlignment.empty() => PutterAlignment(
    angleOffset: 0,
    distanceToHole: 0,
    confidence: 0,
    timestamp: DateTime.now(),
  );
  
  @override
  String toString() => 'PutterAlignment(angle: ${angleOffset.toStringAsFixed(1)}°, '
      'distance: ${distanceToHole.toStringAsFixed(2)}m, '
      'confidence: ${(confidence * 100).toStringAsFixed(0)}%)';
}

enum AlignmentDirection {
  aimLeft,
  centered,
  aimRight,
}