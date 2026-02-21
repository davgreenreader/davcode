import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:audioplayers/audioplayers.dart';
import 'alignment_calculator.dart';

/// Handles audio feedback for alignment instructions
class AudioService {
  FlutterTts? _tts;
  AudioPlayer? _dingPlayer;
  DateTime? _lastSpokenTime;
  bool _isInitialized = false;
  
  // Cooldown between audio cues
  static const Duration speakCooldown = Duration(milliseconds: 700);
  
  AudioService() {
    _initAudio();
  }
  
  Future<void> _initAudio() async {
    try {
      // Initialize TTS
      _tts = FlutterTts();
      
      await _tts!.setLanguage('en-US');
      await _tts!.setSpeechRate(0.8);  // Faster speech (was 0.6)
      await _tts!.setVolume(1.0);
      await _tts!.setPitch(1.1);  // Slightly higher pitch for clarity
      
      if (kIsWeb) {
        await _tts!.awaitSpeakCompletion(false);
      }
      
      // Initialize ding player
      _dingPlayer = AudioPlayer();
      
      _isInitialized = true;
      print('Audio initialized successfully');
    } catch (e) {
      print('Audio initialization error: $e');
      _isInitialized = false;
    }
  }
  
  /// Speak the alignment instruction
  Future<void> speakInstruction(AlignmentInstruction instruction) async {
    final now = DateTime.now();
    
    // Check cooldown
    if (_lastSpokenTime != null && 
        now.difference(_lastSpokenTime!) < speakCooldown) {
      return;
    }
    
    _lastSpokenTime = now;
    
    // Play haptic feedback
    await _playHaptic(instruction);
    
    // If aligned, play ding sound instead of speech
    if (instruction == AlignmentInstruction.aligned) {
      await _playDingSound();
      print('🔔 DING! Aligned!');
    } else {
      // Speak the instruction
      String text = getInstructionText(instruction);
      await _speak(text);
      print('🔊 $text');
    }
  }
  
  /// Play a nice ding/chime sound for alignment success
  Future<void> _playDingSound() async {
    try {
      // Use a pleasant chime/ding sound from the web
      // This is a short success sound effect
      await _dingPlayer?.play(
        UrlSource('https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3'),
      );
    } catch (e) {
      print('Ding sound error: $e');
      // Fallback: speak "aligned" if sound fails
      await _speak('Aligned');
    }
  }
  
  Future<void> _speak(String text) async {
    if (!_isInitialized || _tts == null) {
      print('TTS not ready, text: $text');
      return;
    }
    
    try {
      await _tts!.speak(text);
    } catch (e) {
      print('TTS speak error: $e');
    }
  }
  
  Future<void> _playHaptic(AlignmentInstruction instruction) async {
    switch (instruction) {
      case AlignmentInstruction.aligned:
        // Triple heavy haptic for success
        await HapticFeedback.heavyImpact();
        await Future.delayed(const Duration(milliseconds: 80));
        await HapticFeedback.heavyImpact();
        await Future.delayed(const Duration(milliseconds: 80));
        await HapticFeedback.heavyImpact();
        break;
      case AlignmentInstruction.slightlyLeft:
      case AlignmentInstruction.slightlyRight:
        await HapticFeedback.mediumImpact();
        break;
      case AlignmentInstruction.rotateLeft:
      case AlignmentInstruction.rotateRight:
        await HapticFeedback.heavyImpact();
        await Future.delayed(const Duration(milliseconds: 50));
        await HapticFeedback.heavyImpact();
        break;
    }
  }
  
  /// Get the text for current instruction (shorter for faster speech)
  static String getInstructionText(AlignmentInstruction instruction) {
    switch (instruction) {
      case AlignmentInstruction.aligned:
        return 'Aligned';
      case AlignmentInstruction.slightlyLeft:
        return 'Slight left';
      case AlignmentInstruction.slightlyRight:
        return 'Slight right';
      case AlignmentInstruction.rotateLeft:
        return 'Left';
      case AlignmentInstruction.rotateRight:
        return 'Right';
    }
  }
  
  void dispose() {
    _tts?.stop();
    _dingPlayer?.dispose();
  }
}