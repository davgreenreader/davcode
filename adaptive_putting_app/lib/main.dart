import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'providers/app_state_provider.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Lock to portrait mode
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  
  runApp(const AdaptiveGolfApp());
}

class AdaptiveGolfApp extends StatelessWidget {
  const AdaptiveGolfApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppStateProvider(),
      child: MaterialApp(
        title: 'Adaptive Golf Putter',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          // High contrast theme for low vision users
          colorScheme: const ColorScheme.dark(
            primary: Colors.greenAccent,
            secondary: Colors.white,
            surface: Colors.black,
            background: Color(0xFF121212),
          ),
          // Large text for accessibility
          textTheme: const TextTheme(
            headlineLarge: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
            headlineMedium: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
            bodyLarge: TextStyle(
              fontSize: 20,
              color: Colors.white,
            ),
            bodyMedium: TextStyle(
              fontSize: 18,
              color: Colors.white70,
            ),
          ),
          // Large touch targets
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(200, 80),
              textStyle: const TextStyle(fontSize: 24),
            ),
          ),
          useMaterial3: true,
        ),
        home: const HomeScreen(),
      ),
    );
  }
}