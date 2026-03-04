import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'dart:convert';

class VisionGuidance extends StatefulWidget {
  const VisionGuidance({super.key});

  @override
  State<VisionGuidance> createState() => _VisionGuidanceState();
}

class _VisionGuidanceState extends State<VisionGuidance> {
  // Mac host for phone integration
  final String serverUrl = 'ws://10.203.69.48:8765'; 
  late WebSocketChannel _channel;
  final FlutterTts _flutterTts = FlutterTts();

  // 1. Updated State Variables
  double _distance = 0.0;
  double _offset = 0.0;
  double _elevation = 0.0; // NEW: Track elevation
  bool _isAligned = false;
  bool _isConnected = false;
  
  bool _audioEnabled = false; 

  double? _lastAnnouncedDistance;
  bool _wasAligned = false;
  DateTime _lastDirectionTime = DateTime.now();
  
  // NEW: Flag to ensure elevation is only spoken once
  bool _hasAnnouncedInitialElevation = false; 

  @override
  void initState() {
    super.initState();
    _initTts();
    _connectWebSocket();
  }

  void _initTts() async {
    await _flutterTts.awaitSpeakCompletion(true);
    await _flutterTts.setSpeechRate(0.5); 
  }

  void _connectWebSocket() {
    _channel = WebSocketChannel.connect(Uri.parse(serverUrl));
    
    _channel.stream.listen(
      (message) {
        final data = jsonDecode(message as String);
        
        setState(() {
          _distance = data['distance_m'];
          _offset = data['offset_m'];
          // Safely parse elevation as a double just in case it comes in as an int
          _elevation = (data['elevation_px'] ?? 0).toDouble(); 
          _isAligned = data['aligned'];
          _isConnected = true;
        });

        if (_audioEnabled) {
          // Pass elevation into the audio logic
          _processAudioFeedback(_distance, _offset, _elevation, _isAligned);
        }
      },
      onError: (error) => print("WebSocket Error: $error"),
    );
  }

  // 2. Updated Audio Logic
  void _processAudioFeedback(double distance, double offset, double elevation, bool isAligned) async {
    String phraseToSpeak = "";
    
    // --- Distance Logic (Initial or +/- 2 meters) ---
    if (_lastAnnouncedDistance == null || (distance - _lastAnnouncedDistance!).abs() >= 2.0) {
      _lastAnnouncedDistance = distance;
      phraseToSpeak += "${distance.round()} meters. ";

      // NEW: Elevation Logic (Only appended on the very first announcement)
      if (!_hasAnnouncedInitialElevation) {
        phraseToSpeak += "Elevation ${elevation.round()} pixels. ";
        _hasAnnouncedInitialElevation = true; // Lock it so it never fires again
      }
    }

    // --- Alignment Logic ---
    final now = DateTime.now();
    
    if (isAligned) {
      if (!_wasAligned) {
        phraseToSpeak += "Aligned.";
        _wasAligned = true;
      }
    } else {
      _wasAligned = false; 
      
      if (now.difference(_lastDirectionTime).inSeconds >= 2) {
        _lastDirectionTime = now;
        
        if (offset > 0) {
          phraseToSpeak += "Aim right.";
        } else {
          phraseToSpeak += "Aim left.";
        }
      }
    }

    if (phraseToSpeak.isNotEmpty) {
      await _flutterTts.speak(phraseToSpeak.trim());
    }
  }

  @override
  void dispose() {
    _channel.sink.close();
    _flutterTts.stop();
    super.dispose();
  }

  // 3. Accessibility-Focused UI Overhaul
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black, // High contrast background
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text(
          'Target Tracking', 
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)
        ),
        centerTitle: true,
      ),
      body: Center(
        child: !_audioEnabled 
          ? Padding(
              padding: const EdgeInsets.all(20.0),
              child: SizedBox(
                width: double.infinity,
                height: 200, // Massive button area
                child: ElevatedButton(
                  onPressed: () async {
                    setState(() => _audioEnabled = true);
                    await _flutterTts.speak("Audio guidance enabled."); 
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blueAccent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  child: const Text(
                    'START TRACKING',
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ),
            )
          : _isConnected 
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Huge visual indicator
                  Icon(
                    _isAligned ? Icons.check_circle : Icons.warning_amber_rounded,
                    color: _isAligned ? Colors.greenAccent : Colors.amber,
                    size: 150,
                  ),
                  const SizedBox(height: 30),
                  
                  // High contrast text displays
                  _buildDataRow('DISTANCE', '${_distance.toStringAsFixed(1)} m'),
                  const SizedBox(height: 15),
                  _buildDataRow('OFFSET', '${_offset.toStringAsFixed(2)} m'),
                  const SizedBox(height: 15),
                  _buildDataRow('ELEVATION', '${_elevation.round()} px'),
                  
                  const SizedBox(height: 40),
                  Text(
                    _isAligned ? 'ALIGNED' : 'ADJUST AIM',
                    style: TextStyle(
                      fontSize: 40, 
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.0,
                      color: _isAligned ? Colors.greenAccent : Colors.redAccent,
                    ),
                  ),
                ],
              )
            : const CircularProgressIndicator(color: Colors.white), 
      ),
    );
  }

  // Helper widget to keep the UI code clean and consistently formatted
  Widget _buildDataRow(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.grey),
          ),
          Text(
            value,
            style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ],
      ),
    );
  }
}


// // import 'package:flutter/material.dart';
// // import 'package:web_socket_channel/web_socket_channel.dart';
// // import 'dart:convert';

// // class VisionGuidance extends StatefulWidget {
// //   const VisionGuidance({super.key});

// //   @override
// //   State<VisionGuidance> createState() => _VisionGuidanceState();
// // }

// // class _VisionGuidanceState extends State<VisionGuidance> {
// //   // REPLACE THIS IP WITH YOUR LAPTOP's LOCAL IP ADDRESS
// //   final String serverUrl = 'ws://10.203.7.1:8765'; 
// //   late WebSocketChannel _channel;

// //   @override
// //   void initState() {
// //     super.initState();
// //     // Connect to the Python vision server
// //     _channel = WebSocketChannel.connect(Uri.parse(serverUrl));
// //   }

// //   @override
// //   void dispose() {
// //     // Clean up the connection when the widget is destroyed
// //     _channel.sink.close();
// //     super.dispose();
// //   }

// //   @override
// //   Widget build(BuildContext context) {
// //     return Scaffold(
// //       appBar: AppBar(title: const Text('Alignment Tracker')),
// //       body: Center(
// //         child: StreamBuilder(
// //           stream: _channel.stream,
// //           builder: (context, snapshot) {
// //             // 1. Handle errors
// //             if (snapshot.hasError) {
// //               return Text('Connection Error: ${snapshot.error}');
// //             }

// //             // 2. Show a loading spinner until the first frame of data arrives
// //             if (!snapshot.hasData) {
// //               return const CircularProgressIndicator();
// //             }

// //             // 3. Parse the JSON data from the Python server
// //             final data = jsonDecode(snapshot.data as String);
// //             final double distance = data['distance_m'];
// //             final double offset = data['offset_m'];
// //             final bool isAligned = data['aligned'];

// //             // 4. Display the live data on screen
// //             return Column(
// //               mainAxisAlignment: MainAxisAlignment.center,
// //               children: [
// //                 Icon(
// //                   isAligned ? Icons.check_circle : Icons.warning,
// //                   color: isAligned ? Colors.green : Colors.orange,
// //                   size: 100,
// //                 ),
// //                 const SizedBox(height: 20),
// //                 Text(
// //                   'Distance: ${distance.toStringAsFixed(2)} meters',
// //                   style: const TextStyle(fontSize: 24),
// //                 ),
// //                 const SizedBox(height: 10),
// //                 Text(
// //                   'Horizontal Offset: ${offset.toStringAsFixed(2)} meters',
// //                   style: const TextStyle(fontSize: 20),
// //                 ),
// //                 const SizedBox(height: 30),
// //                 Text(
// //                   isAligned ? 'ALIGNED - READY TO PUTT' : 'ADJUST AIM',
// //                   style: TextStyle(
// //                     fontSize: 22, 
// //                     fontWeight: FontWeight.bold,
// //                     color: isAligned ? Colors.green : Colors.red,
// //                   ),
// //                 ),
// //               ],
// //             );
// //           },
// //         ),
// //       ),
// //     );
// //   }
// // }

// import 'package:flutter/material.dart';
// import 'package:web_socket_channel/web_socket_channel.dart';
// import 'package:flutter_tts/flutter_tts.dart';
// import 'dart:convert';

// class VisionGuidance extends StatefulWidget {
//   const VisionGuidance({super.key});

//   @override
//   State<VisionGuidance> createState() => _VisionGuidanceState();
// }

// class _VisionGuidanceState extends State<VisionGuidance> {
//   // final String serverUrl = 'ws://127.0.0.1:8765'; // Keeping localhost for Chrome
//   final String serverUrl = 'ws://10.203.69.48:8765'; // Mac host for phone integration
//   late WebSocketChannel _channel;
//   final FlutterTts _flutterTts = FlutterTts();

//   double _distance = 0.0;
//   double _offset = 0.0;
//   bool _isAligned = false;
//   bool _isConnected = false;
  
//   // NEW: Gatekeeper for Chrome's audio policy
//   bool _audioEnabled = false; 

//   double? _lastAnnouncedDistance;
//   bool _wasAligned = false;
//   DateTime _lastDirectionTime = DateTime.now();

//   @override
//   void initState() {
//     super.initState();
//     _initTts();
//     _connectWebSocket();
//   }

//   void _initTts() async {
//     await _flutterTts.awaitSpeakCompletion(true);
//     await _flutterTts.setSpeechRate(0.5); 
//   }

//   void _connectWebSocket() {
//     _channel = WebSocketChannel.connect(Uri.parse(serverUrl));
    
//     _channel.stream.listen(
//       (message) {
//         final data = jsonDecode(message as String);
        
//         setState(() {
//           _distance = data['distance_m'];
//           _offset = data['offset_m'];
//           _isAligned = data['aligned'];
//           _isConnected = true;
//         });

//         // Only process audio if the user has clicked the button
//         if (_audioEnabled) {
//           _processAudioFeedback(_distance, _offset, _isAligned);
//         }
//       },
//       onError: (error) => print("WebSocket Error: $error"),
//     );
//   }

//   void _processAudioFeedback(double distance, double offset, bool isAligned) async {
//     String phraseToSpeak = "";
    
//     // --- 1. Distance Logic (Initial or +/- 2 meters) ---
//     if (_lastAnnouncedDistance == null || (distance - _lastAnnouncedDistance!).abs() >= 2.0) {
//       _lastAnnouncedDistance = distance;
//       phraseToSpeak += "${distance.round()} meters. ";
//     }

//     // --- 2. Alignment Logic ---
//     final now = DateTime.now();
    
//     if (isAligned) {
//       if (!_wasAligned) {
//         // Only say "Aligned" once when crossing the threshold
//         phraseToSpeak += "Aligned.";
//         _wasAligned = true;
//       }
//     } else {
//       _wasAligned = false; // Reset so it can say "Aligned" again later
      
//       // Throttle instructions: Only add a direction every 2 seconds to avoid overlap
//       if (now.difference(_lastDirectionTime).inSeconds >= 2) {
//         _lastDirectionTime = now;
        
//         if (offset > 0) {
//           phraseToSpeak += "Aim right.";
//         } else {
//           phraseToSpeak += "Aim left.";
//         }
//       }
//     }

//     // --- 3. Speak the combined phrase ---
//     if (phraseToSpeak.isNotEmpty) {
//       await _flutterTts.speak(phraseToSpeak.trim());
//     }
//   }

//   @override
//   void dispose() {
//     _channel.sink.close();
//     _flutterTts.stop();
//     super.dispose();
//   }

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       appBar: AppBar(title: const Text('Audio Guidance Active')),
//       body: Center(
//         // NEW: Check if audio is enabled first
//         child: !_audioEnabled 
//           ? ElevatedButton(
//               onPressed: () async {
//                 setState(() => _audioEnabled = true);
//                 // Speak immediately on click to prove Chrome unlocked the audio
//                 await _flutterTts.speak("Audio guidance enabled."); 
//               },
//               style: ElevatedButton.styleFrom(
//                 padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 20),
//                 textStyle: const TextStyle(fontSize: 24),
//               ),
//               child: const Text('Start Tracking'),
//             )
//           : _isConnected 
//             ? Column(
//                 mainAxisAlignment: MainAxisAlignment.center,
//                 children: [
//                   Icon(
//                     _isAligned ? Icons.check_circle : Icons.warning,
//                     color: _isAligned ? Colors.green : Colors.orange,
//                     size: 100,
//                   ),
//                   const SizedBox(height: 20),
//                   Text(
//                     'Distance: ${_distance.toStringAsFixed(2)} meters',
//                     style: const TextStyle(fontSize: 24),
//                   ),
//                   const SizedBox(height: 10),
//                   Text(
//                     'Offset: ${_offset.toStringAsFixed(2)} meters',
//                     style: const TextStyle(fontSize: 20),
//                   ),
//                 ],
//               )
//             : const CircularProgressIndicator(), 
//       ),
//     );
//   }
// }
