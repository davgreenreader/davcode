import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state_provider.dart';
import '../widgets/accessibility_button.dart';
import 'hardware_mode_screen.dart';
import 'simulation_screen.dart';
import 'voice_alignment_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFFFF),
      body: SafeArea(
        child: Semantics(
          label: 'Adaptive Golf Putter Home Screen',
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 20),
                  
                  // App Title
                  Semantics(
                    header: true,
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: const Color(0xFF000000),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const FittedBox(
                        fit: BoxFit.fitWidth,
                        child: Text(
                          'ADAPTIVE GOLF PUTTER',
                          style: TextStyle(
                            fontSize: 100,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFFFFF00),
                            fontFamily: 'Arial',
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 24),
                  
                  // Status message
                  Consumer<AppStateProvider>(
                    builder: (context, state, _) => Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF000000), width: 2),
                      ),
                      child: Text(
                        state.statusMessage,
                        style: const TextStyle(
                          fontSize: 18,
                          color: Color(0xFF000000),
                          fontFamily: 'Arial',
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 32),
                  
                  // Section label
                  const Text(
                    'SELECT MODE:',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF000000),
                      fontFamily: 'Arial',
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  Container(height: 4, color: const Color(0xFF000000)),
                  
                  const SizedBox(height: 24),
                  
                  // Voice Alignment Mode (Primary)
                  AccessibilityButton(
                    label: 'VOICE ALIGNMENT',
                    semanticsHint: 'Align using voice commands and compass',
                    icon: Icons.mic,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const VoiceAlignmentScreen(),
                        ),
                      );
                    },
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // UWB Simulation Button
                  AccessibilityButton(
                    label: 'UWB SIMULATION',
                    semanticsHint: 'Test with simulated UWB sensor data',
                    icon: Icons.science,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const SimulationScreen(),
                        ),
                      );
                    },
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Hardware Mode Button
                  AccessibilityButton(
                    label: 'HARDWARE MODE',
                    semanticsHint: 'Connect to UWB putter system via Bluetooth',
                    icon: Icons.bluetooth,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const HardwareModeScreen(),
                        ),
                      );
                    },
                  ),
                  
                  const SizedBox(height: 32),
                  
                  Container(height: 4, color: const Color(0xFF000000)),
                  
                  const SizedBox(height: 24),
                  
                  const Text(
                    'SETTINGS:',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF000000),
                      fontFamily: 'Arial',
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Haptic Toggle
                  Consumer<AppStateProvider>(
                    builder: (context, state, _) => AccessibilityButton(
                      label: state.isHapticEnabled 
                          ? 'VIBRATION: ON ✓' 
                          : 'VIBRATION: OFF',
                      semanticsHint: 'Toggle vibration feedback on or off',
                      icon: state.isHapticEnabled 
                          ? Icons.vibration 
                          : Icons.phonelink_erase,
                      onPressed: () => state.toggleHaptic(),
                      isPrimary: false,
                    ),
                  ),
                  
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}