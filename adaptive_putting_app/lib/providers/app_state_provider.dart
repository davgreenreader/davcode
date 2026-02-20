import 'package:flutter/foundation.dart';
import '../models/putter_alignment.dart';
import '../services/ble_service.dart';
import '../services/camera_service.dart';
import '../services/haptic_service.dart';

enum AppMode {
  home,
  hardware,
  camera,
}

class AppStateProvider extends ChangeNotifier {
  final BleService _bleService = BleService();
  final CameraService _cameraService = CameraService();
  final HapticService _hapticService = HapticService();
  
  AppMode _currentMode = AppMode.home;
  PutterAlignment _currentAlignment = PutterAlignment.empty();
  BleConnectionState _bleState = BleConnectionState.disconnected;
  bool _isHapticEnabled = true;
  String _statusMessage = 'Welcome! Select a mode to begin.';
  
  // Getters
  AppMode get currentMode => _currentMode;
  PutterAlignment get currentAlignment => _currentAlignment;
  BleConnectionState get bleState => _bleState;
  bool get isHapticEnabled => _isHapticEnabled;
  String get statusMessage => _statusMessage;
  BleService get bleService => _bleService;
  CameraService get cameraService => _cameraService;
  HapticService get hapticService => _hapticService;
  
  AppStateProvider() {
    _init();
  }
  
  Future<void> _init() async {
    _bleService.connectionStateStream.listen((state) {
      _bleState = state;
      _updateStatusMessage();
      notifyListeners();
    });
    
    _bleService.alignmentStream.listen((alignment) {
      _currentAlignment = alignment;
      if (_isHapticEnabled) {
        _hapticService.provideFeedback(alignment);
      }
      notifyListeners();
    });
  }
  
  void setMode(AppMode mode) {
    _currentMode = mode;
    _updateStatusMessage();
    notifyListeners();
  }
  
  void toggleHaptic() {
    _isHapticEnabled = !_isHapticEnabled;
    if (!_isHapticEnabled) {
      _hapticService.stopFeedback();
    }
    notifyListeners();
  }
  
  void updateAlignment(PutterAlignment alignment) {
    _currentAlignment = alignment;
    if (_isHapticEnabled) {
      _hapticService.provideFeedback(alignment);
    }
    notifyListeners();
  }
  
  void _updateStatusMessage() {
    switch (_currentMode) {
      case AppMode.home:
        _statusMessage = 'Welcome! Select a mode to begin.';
        break;
      case AppMode.hardware:
        switch (_bleState) {
          case BleConnectionState.disconnected:
            _statusMessage = 'Tap to scan for UWB device';
            break;
          case BleConnectionState.scanning:
            _statusMessage = 'Scanning for devices...';
            break;
          case BleConnectionState.connecting:
            _statusMessage = 'Connecting...';
            break;
          case BleConnectionState.connected:
            _statusMessage = 'Connected! Align your putter.';
            break;
          case BleConnectionState.error:
            _statusMessage = 'Connection error. Tap to retry.';
            break;
        }
        break;
      case AppMode.camera:
        _statusMessage = 'Point camera at the hole';
        break;
    }
  }
  
  @override
  void dispose() {
    _bleService.dispose();
    _cameraService.dispose();
    _hapticService.dispose();
    super.dispose();
  }
}