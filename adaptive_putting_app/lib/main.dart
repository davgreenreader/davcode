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
        
        // HIGH CONTRAST LIGHT THEME for VI users
        theme: ThemeData(
          // High contrast color scheme - black on white/yellow
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF000000),       // Black
            onPrimary: Color(0xFFFFFFFF),     // White text on black
            secondary: Color(0xFF0000AA),     // Deep blue
            onSecondary: Color(0xFFFFFF00),   // Yellow on blue
            surface: Color(0xFFFFFFFF),       // White background
            onSurface: Color(0xFF000000),     // Black text
            error: Color(0xFFCC0000),         // Dark red for errors
            onError: Color(0xFFFFFFFF),       // White text on red
          ),
          
          // Clean, bright background
          scaffoldBackgroundColor: const Color(0xFFFFFFFF),
          
          // High contrast app bar
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF000000),
            foregroundColor: Color(0xFFFFFFFF),
            elevation: 0,
            centerTitle: true,
            titleTextStyle: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFFFFF),
              fontFamily: 'Arial',
            ),
          ),
          
          // Clean sans-serif typography with large sizes (18pt minimum)
          textTheme: const TextTheme(
            // Main titles - 32pt
            headlineLarge: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
              height: 1.2,
            ),
            // Section headers - 24pt
            headlineMedium: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
              height: 1.2,
            ),
            // Subsection headers - 20pt
            headlineSmall: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
              height: 1.2,
            ),
            // Body text - 18pt minimum
            bodyLarge: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.normal,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
              height: 1.4,
            ),
            // Secondary body text - 18pt
            bodyMedium: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.normal,
              color: Color(0xFF333333),
              fontFamily: 'Arial',
              height: 1.4,
            ),
            // Labels - 18pt
            labelLarge: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
            ),
          ),
          
          // Large, high-contrast buttons
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF000000),
              foregroundColor: const Color(0xFFFFFFFF),
              minimumSize: const Size(double.infinity, 72),
              textStyle: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                fontFamily: 'Arial',
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              elevation: 0,
            ),
          ),
          
          // High contrast input fields
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: const Color(0xFFF5F5F5),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF000000), width: 2),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF000000), width: 2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF0000AA), width: 3),
            ),
            labelStyle: const TextStyle(
              fontSize: 18,
              color: Color(0xFF000000),
              fontWeight: FontWeight.bold,
            ),
            hintStyle: const TextStyle(
              fontSize: 18,
              color: Color(0xFF666666),
            ),
          ),
          
          useMaterial3: true,
        ),
        home: const HomeScreen(),
      ),
    );
  }
}