import 'dart:ui';

/// Represents detected hole from camera
class HoleDetection {
  /// Position in camera frame (0-1 normalized)
  final Offset position;
  
  /// Estimated real-world distance in meters
  final double estimatedDistance;
  
  /// Detection confidence 0-1
  final double confidence;
  
  /// Bounding box of detected hole
  final Rect? boundingBox;
  
  const HoleDetection({
    required this.position,
    required this.estimatedDistance,
    required this.confidence,
    this.boundingBox,
  });
  
  /// Check if hole is in center of frame
  bool get isCentered => (position.dx - 0.5).abs() < 0.1;
  
  factory HoleDetection.notFound() => const HoleDetection(
    position: Offset(0.5, 0.5),
    estimatedDistance: 0,
    confidence: 0,
  );
}