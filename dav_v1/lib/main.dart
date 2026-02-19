import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:flutter_tts/flutter_tts.dart';

void main() => runApp(const PutterTestApp());

class PutterTestApp extends StatelessWidget {
  const PutterTestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: ThemeData(primarySwatch: Colors.green),
      home: const PutterTester(),
    );
  }
}

class PutterTester extends StatefulWidget {
  const PutterTester({super.key});

  @override
  State<PutterTester> createState() => _PutterTesterState();
}

class _PutterTesterState extends State<PutterTester> {
  // Controllers to get text out of the input boxes
  final TextEditingController _dLController = TextEditingController(text: "2.184");
  final TextEditingController _dRController = TextEditingController(text: "2.201");
  final TextEditingController _bController = TextEditingController(text: "0.120");

  final PutterLogic _logic = PutterLogic();
  final FlutterTts _flutterTts = FlutterTts(); // 2. Initialize TTS

  String _angleDisplay = "0.0°";
  String _instructionDisplay = "Enter values to start";
  DateTime _lastSpoken = DateTime.now(); // 3. For the cooldown

  Future<void> _speak(String text) async {
    // Only speak if it's been more than 1 second since the last message
    // This prevents the "stuttering" effect while you're typing
    if (DateTime.now().difference(_lastSpoken).inMilliseconds > 1000) {
      await _flutterTts.speak(text);
      _lastSpoken = DateTime.now();
    }
  }

  void _calculate() {
    double dL = double.tryParse(_dLController.text) ?? 0.0;
    double dR = double.tryParse(_dRController.text) ?? 0.0;
    double b = double.tryParse(_bController.text) ?? 0.12;

    double? theta = _logic.computeThetaDeg(dL, dR, b);

    setState(() {
      if (theta != null) {
        _angleDisplay = "${theta.toStringAsFixed(2)}°";
        _instructionDisplay = _logic.getInstruction(theta);
        
        // 4. Trigger the voice!
        _speak(_instructionDisplay);
      } else {
        _angleDisplay = "Error";
        _instructionDisplay = "Invalid Geometry";
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Golf UWB Tester")),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            // Input Fields
            _buildInput(_dLController, "Left Distance (dL)", "meters"),
            _buildInput(_dRController, "Right Distance (dR)", "meters"),
            _buildInput(_bController, "Putter Baseline (b)", "meters"),
            
            const SizedBox(height: 30),
            
            // Output Display
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                children: [
                  Text("Computed Angle: $_angleDisplay", 
                       style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  Text(_instructionDisplay, 
                       style: const TextStyle(fontSize: 24, color: Colors.green, fontWeight: FontWeight.w900)),
                ],
              ),
            ),
            
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _calculate, 
              child: const Text("Calculate Direction")
            ),
          ],
        ),
      ),
    );
  }

  // Helper function to build text fields quickly
  Widget _buildInput(TextEditingController controller, String label, String suffix) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(labelText: label, suffixText: suffix),
      onChanged: (_) => _calculate(), // Calculate instantly as user types
    );
  }
}

// --- LOGIC CLASS ---
class PutterLogic {
  final double degStop = 1.0;
  final double degFine = 4.0;

  double? computeThetaDeg(double dL, double dR, double b) {
    double x = (dL * dL - dR * dR) / (2.0 * b);
    double y2 = (dL * dL + dR * dR) / 2.0 - (math.pow(b, 2) / 4.0) - (math.pow(x, 2));
    if (y2 < 0) y2 = 0.0;
    double y = math.sqrt(y2);
    if (y < 1e-6) return null;
    return math.atan2(x, y) * 180 / math.pi;
  }

  String getInstruction(double thetaDeg) {
    double a = thetaDeg.abs();
    if (a <= degStop) return "Aligned. Stop.";
    if (a <= degFine) return thetaDeg > 0 ? "Slightly right." : "Slightly left.";
    return thetaDeg > 0 ? "Rotate right." : "Rotate left.";
  }
}