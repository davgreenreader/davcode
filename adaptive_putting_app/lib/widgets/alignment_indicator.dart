import 'package:flutter/material.dart';
import '../models/putter_alignment.dart';

/// Visual indicator showing alignment direction
class AlignmentIndicator extends StatelessWidget {
  final PutterAlignment alignment;
  final bool compact;
  
  const AlignmentIndicator({
    super.key,
    required this.alignment,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: AlignmentPainter(
        alignment: alignment,
        compact: compact,
      ),
      child: Container(),
    );
  }
}

class AlignmentPainter extends CustomPainter {
  final PutterAlignment alignment;
  final bool compact;
  
  AlignmentPainter({
    required this.alignment,
    required this.compact,
  });
  
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = compact ? size.width * 0.3 : size.width * 0.35;
    
    // Background circle
    final bgPaint = Paint()
      ..color = Colors.grey[900]!
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, bgPaint);
    
    // Outer ring
    final ringPaint = Paint()
      ..color = _getColor()
      ..style = PaintingStyle.stroke
      ..strokeWidth = compact ? 4 : 8;
    canvas.drawCircle(center, radius, ringPaint);
    
    // Direction indicator (arrow)
    if (alignment.confidence > 0.3 && !alignment.isAligned) {
      _drawArrow(canvas, center, radius);
    }
    
    // Center dot (target)
    final centerPaint = Paint()
      ..color = alignment.isAligned ? Colors.greenAccent : Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, compact ? 8 : 15, centerPaint);
    
    // Current position indicator
    if (alignment.confidence > 0.3) {
      final positionOffset = Offset(
        center.dx + (alignment.angleOffset / 45 * radius * 0.7),
        center.dy,
      );
      
      final posPaint = Paint()
        ..color = Colors.greenAccent
        ..style = PaintingStyle.fill;
      canvas.drawCircle(positionOffset, compact ? 12 : 20, posPaint);
    }
  }
  
  Color _getColor() {
    if (alignment.confidence < 0.3) return Colors.grey;
    if (alignment.isAligned) return Colors.greenAccent;
    if (alignment.isCloseToAligned) return Colors.yellow;
    return Colors.orange;
  }
  
  void _drawArrow(Canvas canvas, Offset center, double radius) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    
    final direction = alignment.direction == AlignmentDirection.aimLeft ? -1 : 1;
    final arrowX = center.dx + direction * radius * 0.5;
    
    final path = Path();
    if (direction < 0) {
      // Left arrow
      path.moveTo(arrowX - 20, center.dy);
      path.lineTo(arrowX, center.dy - 15);
      path.lineTo(arrowX, center.dy + 15);
    } else {
      // Right arrow
      path.moveTo(arrowX + 20, center.dy);
      path.lineTo(arrowX, center.dy - 15);
      path.lineTo(arrowX, center.dy + 15);
    }
    path.close();
    
    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(covariant AlignmentPainter oldDelegate) {
    return oldDelegate.alignment.angleOffset != alignment.angleOffset ||
           oldDelegate.alignment.confidence != alignment.confidence;
  }
}