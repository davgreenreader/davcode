import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state_provider.dart';
import '../widgets/accessibility_button.dart';
import 'hardware_mode_screen.dart';
import 'camera_mode_screen.dart';
import 'simulation_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: SafeArea(
        child: Semantics(
          label: 'Adaptive Golf Putter Home Screen',
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // App Title
                Semantics(
                  header: true,
                  child: Text(
                    'Adaptive\nGolf Putter',
                    style: Theme.of(context).textTheme.headlineLarge,
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 16),
                
                // Status message
                Consumer<AppStateProvider>(
                  builder: (context, state, _) => Semantics(
                    liveRegion: true,
                    child: Text(
                      state.statusMessage,
                      style: Theme.of(context).textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
                
                const SizedBox(height: 48),
                
                // Simulation Mode Button (NEW!)
                AccessibilityButton(
                  label: 'UWB Simulation',
                  semanticsHint: 'Test with simulated UWB data',
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
                
                const SizedBox(height: 24),
                
                // Hardware Mode Button
                AccessibilityButton(
                  label: 'Hardware Mode',
                  semanticsHint: 'Connect to UWB putter system',
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
                
                const SizedBox(height: 24),
                
                // Camera Mode Button
                AccessibilityButton(
                  label: 'Camera Mode',
                  semanticsHint: 'Use phone camera to detect hole',
                  icon: Icons.camera_alt,
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const CameraModeScreen(),
                      ),
                    );
                  },
                ),
                
                const SizedBox(height: 48),
                
                // Haptic Toggle
                Consumer<AppStateProvider>(
                  builder: (context, state, _) => AccessibilityButton(
                    label: state.isHapticEnabled 
                        ? 'Haptic: ON' 
                        : 'Haptic: OFF',
                    semanticsHint: 'Toggle vibration feedback',
                    icon: state.isHapticEnabled 
                        ? Icons.vibration 
                        : Icons.phonelink_erase,
                    onPressed: () => state.toggleHaptic(),
                    isPrimary: false,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}