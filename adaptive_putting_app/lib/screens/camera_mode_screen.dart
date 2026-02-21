import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'dart:convert';
import '../widgets/accessibility_button.dart';

class CameraModeScreen extends StatefulWidget {
  const CameraModeScreen({super.key});

  @override
  State<CameraModeScreen> createState() => _CameraModeScreenState();
}

class _CameraModeScreenState extends State<CameraModeScreen> {
  WebSocketChannel? _channel;
  final FlutterTts _flutterTts = FlutterTts();

  final TextEditingController _ipController = TextEditingController(text: '127.0.0.1');
  final TextEditingController _portController = TextEditingController(text: '8765');

  double _distance = 0.0;
  double _offset = 0.0;
  bool _isAligned = false;
  bool _isConnected = false;
  bool _isConnecting = false;
  String _errorMessage = '';
  bool _audioEnabled = false; 

  double? _lastAnnouncedDistance;
  bool _wasAligned = false;
  DateTime _lastDirectionTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _initTts();
  }

  void _initTts() async {
    await _flutterTts.awaitSpeakCompletion(true);
    await _flutterTts.setSpeechRate(0.5);
    await _flutterTts.setVolume(1.0);
  }

  void _connectWebSocket() {
    setState(() {
      _isConnecting = true;
      _errorMessage = '';
    });

    String ip = _ipController.text.trim();
    String port = _portController.text.trim();
    String serverUrl = 'ws://$ip:$port';

    try {
      _channel = WebSocketChannel.connect(Uri.parse(serverUrl));
      
      _channel!.stream.listen(
        (message) {
          final data = jsonDecode(message as String);
          
          setState(() {
            _distance = (data['distance_m'] as num).toDouble();
            _offset = (data['offset_m'] as num).toDouble();
            _isAligned = data['aligned'] as bool;
            _isConnected = true;
            _isConnecting = false;
          });

          if (_audioEnabled) {
            _processAudioFeedback(_distance, _offset, _isAligned);
          }
        },
        onError: (error) {
          setState(() {
            _errorMessage = 'Connection error: $error';
            _isConnected = false;
            _isConnecting = false;
          });
        },
        onDone: () {
          setState(() {
            _isConnected = false;
            _isConnecting = false;
          });
        },
      );
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to connect: $e';
        _isConnecting = false;
      });
    }
  }

  void _disconnect() {
    _channel?.sink.close();
    setState(() {
      _isConnected = false;
      _channel = null;
    });
  }

  void _processAudioFeedback(double distance, double offset, bool isAligned) async {
    String phraseToSpeak = "";
    
    if (_lastAnnouncedDistance == null || (distance - _lastAnnouncedDistance!).abs() >= 2.0) {
      _lastAnnouncedDistance = distance;
      phraseToSpeak += "${distance.round()} meters. ";
    }

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

  void _enableAudio() async {
    setState(() => _audioEnabled = true);
    await _flutterTts.speak("Audio guidance enabled.");
  }

  @override
  void dispose() {
    _channel?.sink.close();
    _flutterTts.stop();
    _ipController.dispose();
    _portController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFFFF),
      appBar: AppBar(
        title: const Text('VISION TRACKING'),
        backgroundColor: const Color(0xFF000000),
        foregroundColor: const Color(0xFFFFFFFF),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (!_isConnected && !_isConnecting) {
      return _buildConnectionSettings();
    }

    if (_isConnecting) {
      return _buildConnectingView();
    }

    if (!_audioEnabled) {
      return _buildEnableAudioView();
    }

    return _buildTrackingView();
  }

  Widget _buildConnectionSettings() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Title section
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF000000),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Column(
            children: [
              Icon(Icons.camera_alt, size: 60, color: Color(0xFFFFFFFF)),
              SizedBox(height: 12),
              Text(
                'APRILTAG TRACKING',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  fontFamily: 'Arial',
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 24),

        // Instructions
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: const Text(
            'Connect to the Python vision server running on your computer.',
            style: TextStyle(
              fontSize: 18,
              color: Color(0xFF000000),
              fontFamily: 'Arial',
            ),
            textAlign: TextAlign.center,
          ),
        ),

        const SizedBox(height: 24),

        // Connection settings
        const Text(
          'SERVER SETTINGS:',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF000000),
            fontFamily: 'Arial',
          ),
        ),
        
        const SizedBox(height: 12),

        // IP Address input
        TextField(
          controller: _ipController,
          style: const TextStyle(fontSize: 20, color: Color(0xFF000000)),
          decoration: const InputDecoration(
            labelText: 'Server IP Address',
            hintText: '127.0.0.1',
            prefixIcon: Icon(Icons.computer, color: Color(0xFF000000)),
          ),
        ),
        
        const SizedBox(height: 16),

        // Port input
        TextField(
          controller: _portController,
          style: const TextStyle(fontSize: 20, color: Color(0xFF000000)),
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Port',
            hintText: '8765',
            prefixIcon: Icon(Icons.settings_ethernet, color: Color(0xFF000000)),
          ),
        ),

        const SizedBox(height: 16),

        // Error message
        if (_errorMessage.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFCC0000),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF000000), width: 2),
            ),
            child: Row(
              children: [
                const Icon(Icons.error, color: Color(0xFFFFFFFF), size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _errorMessage,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Color(0xFFFFFFFF),
                      fontFamily: 'Arial',
                    ),
                  ),
                ),
              ],
            ),
          ),

        const SizedBox(height: 24),

        // Connect button
        AccessibilityButton(
          label: 'CONNECT',
          semanticsHint: 'Connect to the vision server',
          icon: Icons.link,
          onPressed: _connectWebSocket,
        ),
      ],
    );
  }

  Widget _buildConnectingView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 100),
        const CircularProgressIndicator(
          color: Color(0xFF000000),
          strokeWidth: 4,
        ),
        const SizedBox(height: 24),
        const Text(
          'CONNECTING...',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Color(0xFF000000),
            fontFamily: 'Arial',
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'ws://${_ipController.text}:${_portController.text}',
          style: const TextStyle(
            fontSize: 18,
            color: Color(0xFF666666),
            fontFamily: 'Arial',
          ),
        ),
      ],
    );
  }

  Widget _buildEnableAudioView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Connected status
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF006600),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, color: Color(0xFFFFFFFF), size: 28),
              SizedBox(width: 12),
              Text(
                '✓ CONNECTED',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  fontFamily: 'Arial',
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 40),

        // Audio enable section
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: const Column(
            children: [
              Icon(Icons.volume_up, size: 80, color: Color(0xFF000000)),
              SizedBox(height: 16),
              Text(
                'ENABLE AUDIO',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF000000),
                  fontFamily: 'Arial',
                ),
              ),
              SizedBox(height: 12),
              Text(
                'Tap the button below to enable audio feedback for alignment guidance.',
                style: TextStyle(
                  fontSize: 18,
                  color: Color(0xFF333333),
                  fontFamily: 'Arial',
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Enable audio button
        AccessibilityButton(
          label: 'START TRACKING',
          semanticsHint: 'Enable audio guidance and start tracking',
          icon: Icons.play_arrow,
          onPressed: _enableAudio,
        ),
      ],
    );
  }

  Widget _buildTrackingView() {
    // High contrast colors with redundant signaling
    Color backgroundColor;
    Color foregroundColor;
    String statusText;
    IconData statusIcon;
    String directionText;
    
    if (_isAligned) {
      backgroundColor = const Color(0xFF006600);  // Dark green
      foregroundColor = const Color(0xFFFFFFFF);
      statusText = '✓ ALIGNED';
      statusIcon = Icons.check_circle;
      directionText = 'Ready to putt!';
    } else {
      backgroundColor = const Color(0xFFCC6600);  // Orange
      foregroundColor = const Color(0xFFFFFFFF);
      statusText = 'ADJUST AIM';
      statusIcon = Icons.adjust;
      directionText = _offset > 0 ? '→ AIM RIGHT' : '← AIM LEFT';
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Connection status bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF006600),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.check_circle, color: Color(0xFFFFFFFF), size: 20),
                  SizedBox(width: 8),
                  Text(
                    '✓ CONNECTED',
                    style: TextStyle(
                      color: Color(0xFFFFFFFF),
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Arial',
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: _disconnect,
                child: const Text(
                  'DISCONNECT',
                  style: TextStyle(
                    color: Color(0xFFFFFFFF),
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Arial',
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Main alignment indicator
        Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF000000), width: 3),
          ),
          child: Column(
            children: [
              Icon(statusIcon, color: foregroundColor, size: 80),
              const SizedBox(height: 16),
              Text(
                statusText,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: foregroundColor,
                  fontFamily: 'Arial',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                directionText,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: foregroundColor,
                  fontFamily: 'Arial',
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Data display
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: Column(
            children: [
              const Text(
                'MEASUREMENTS:',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF000000),
                  fontFamily: 'Arial',
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildDataColumn('DISTANCE', '${_distance.toStringAsFixed(2)}', 'meters'),
                  Container(width: 2, height: 60, color: const Color(0xFF000000)),
                  _buildDataColumn('OFFSET', '${_offset.toStringAsFixed(2)}', 'meters'),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Audio status indicator
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF0000AA),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF000000), width: 2),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.volume_up, color: Color(0xFFFFFFFF), size: 24),
              SizedBox(width: 12),
              Text(
                '♪ AUDIO GUIDANCE ACTIVE',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  fontFamily: 'Arial',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDataColumn(String label, String value, String unit) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Color(0xFF333333),
            fontFamily: 'Arial',
          ),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: Color(0xFF000000),
            fontFamily: 'Arial',
          ),
        ),
        Text(
          unit,
          style: const TextStyle(
            fontSize: 16,
            color: Color(0xFF666666),
            fontFamily: 'Arial',
          ),
        ),
      ],
    );
  }
}