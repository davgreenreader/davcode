import 'package:flutter/material.dart';
import 'vision_guidance.dart'; // Import the file you just created

void main() {
  runApp(const GolfTrackerApp());
}

class GolfTrackerApp extends StatelessWidget {
  const GolfTrackerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Golf Vision Tracker',
      theme: ThemeData(
        primarySwatch: Colors.green,
        useMaterial3: true,
      ),
      // This sets your new WebSocket screen as the very first thing the app loads
      home: const VisionGuidance(), 
    );
  }
}