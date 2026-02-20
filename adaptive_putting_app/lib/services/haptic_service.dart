import 'dart:async';
import 'package:flutter/services.dart';
import 'package:vibration/vibration.dart';
import '../models/putter_alignment.dart';

/// Provides haptic and audio feedback for alignment guidance
class HapticService {
  Timer? _feedbackTimer;
  bool _isRunning = false;
  
  static const int _shortPulse = 50;
  static const int _mediumPulse = 100;
  static const int _longPulse = 200;
  
  /// Start continuous feedback based on alignment
  void startContinuousFeedback(Stream<PutterAlignment> alignmentStream) {
    _isRunning = true;
    alignmentStream.listen((alignment) {
      if (_isRunning) {
        provideFeedback(alignment);
      }
    });
  }
  
  /// Stop all feedback
  void stopFeedback() {
    _isRunning = false;
    _feedbackTimer?.cancel();
  }
  
  /// Provide feedback based on current alignment (public method)
  Future<void> provideFeedback(PutterAlignment alignment) async {
    if (alignment.confidence < 0.3) {
      await _playSearchingFeedback();
      return;
    }
    
    switch (alignment.direction) {
      case AlignmentDirection.centered:
        await _playAlignedFeedback();
        break;
      case AlignmentDirection.aimLeft:
        await _playDirectionalFeedback(isLeft: true, intensity: alignment.offsetIntensity);
        break;
      case AlignmentDirection.aimRight:
        await _playDirectionalFeedback(isLeft: false, intensity: alignment.offsetIntensity);
        break;
    }
  }
  
  /// Feedback when aligned correctly
  Future<void> _playAlignedFeedback() async {
    if (await Vibration.hasVibrator() ?? false) {
      await Vibration.vibrate(
        pattern: [0, _longPulse, 100, _longPulse],
        intensities: [0, 255, 0, 255],
      );
    }
    
    await HapticFeedback.heavyImpact();
  }
  
  /// Directional feedback
  Future<void> _playDirectionalFeedback({
    required bool isLeft,
    required double intensity,
  }) async {
    final int pauseDuration = (500 * (1 - intensity)).toInt().clamp(100, 500);
    final int pulseDuration = (_mediumPulse * (0.5 + intensity * 0.5)).toInt();
    
    if (await Vibration.hasVibrator() ?? false) {
      if (isLeft) {
        await Vibration.vibrate(
          pattern: [0, _shortPulse, 50, pulseDuration],
          intensities: [0, 128, 0, (255 * intensity).toInt()],
        );
      } else {
        await Vibration.vibrate(
          pattern: [0, pulseDuration, 50, _shortPulse],
          intensities: [0, (255 * intensity).toInt(), 0, 128],
        );
      }
    }
    
    await Future.delayed(Duration(milliseconds: pauseDuration));
  }
  
  /// Feedback when searching
  Future<void> _playSearchingFeedback() async {
    if (await Vibration.hasVibrator() ?? false) {
      await Vibration.vibrate(duration: _shortPulse);
    }
    await Future.delayed(const Duration(milliseconds: 1000));
  }
  
  /// Announce direction with haptics
  Future<void> announceDirection(PutterAlignment alignment) async {
    switch (alignment.direction) {
      case AlignmentDirection.centered:
        await HapticFeedback.heavyImpact();
        await HapticFeedback.heavyImpact();
        break;
      case AlignmentDirection.aimLeft:
        await HapticFeedback.lightImpact();
        await Future.delayed(const Duration(milliseconds: 100));
        await HapticFeedback.mediumImpact();
        break;
      case AlignmentDirection.aimRight:
        await HapticFeedback.mediumImpact();
        await Future.delayed(const Duration(milliseconds: 100));
        await HapticFeedback.lightImpact();
        break;
    }
  }
  
  void dispose() {
    stopFeedback();
  }
}