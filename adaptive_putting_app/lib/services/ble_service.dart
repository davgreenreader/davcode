import 'dart:async';
import 'dart:typed_data';
import 'dart:math' as math;
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import '../models/putter_alignment.dart';

/// BLE service for communicating with UWB hardware
class BleService {
  // UUIDs - these should match your hardware
  static const String SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
  static const String ALIGNMENT_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef1";
  static const String DISTANCE_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef2";
  static const String CONFIG_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef3";
  
  BluetoothDevice? _connectedDevice;
  BluetoothCharacteristic? _alignmentCharacteristic;
  BluetoothCharacteristic? _distanceCharacteristic;
  
  final StreamController<PutterAlignment> _alignmentController = 
      StreamController<PutterAlignment>.broadcast();
  final StreamController<BleConnectionState> _connectionStateController = 
      StreamController<BleConnectionState>.broadcast();
  
  Stream<PutterAlignment> get alignmentStream => _alignmentController.stream;
  Stream<BleConnectionState> get connectionStateStream => _connectionStateController.stream;
  
  bool get isConnected => _connectedDevice != null;
  
  /// Initialize BLE
  Future<void> initialize() async {
    if (await FlutterBluePlus.isSupported == false) {
      throw Exception('Bluetooth not supported on this device');
    }
    
    if (await FlutterBluePlus.adapterState.first != BluetoothAdapterState.on) {
      throw Exception('Please turn on Bluetooth');
    }
  }
  
  /// Scan for UWB devices
  Stream<List<ScanResult>> scanForDevices({Duration timeout = const Duration(seconds: 10)}) {
    FlutterBluePlus.startScan(
      timeout: timeout,
      withServices: [Guid(SERVICE_UUID)],
    );
    
    return FlutterBluePlus.scanResults;
  }
  
  /// Stop scanning
  Future<void> stopScan() async {
    await FlutterBluePlus.stopScan();
  }
  
  /// Connect to a device
  Future<bool> connectToDevice(BluetoothDevice device) async {
    try {
      _connectionStateController.add(BleConnectionState.connecting);
      
      await device.connect(timeout: const Duration(seconds: 15));
      _connectedDevice = device;
      
      List<BluetoothService> services = await device.discoverServices();
      
      BluetoothService? targetService;
      for (var service in services) {
        if (service.uuid.toString().toLowerCase() == SERVICE_UUID.toLowerCase()) {
          targetService = service;
          break;
        }
      }
      
      if (targetService == null) {
        throw Exception('UWB service not found on device');
      }
      
      for (var char in targetService.characteristics) {
        String uuid = char.uuid.toString().toLowerCase();
        if (uuid == ALIGNMENT_CHAR_UUID.toLowerCase()) {
          _alignmentCharacteristic = char;
        } else if (uuid == DISTANCE_CHAR_UUID.toLowerCase()) {
          _distanceCharacteristic = char;
        }
      }
      
      if (_alignmentCharacteristic != null) {
        await _alignmentCharacteristic!.setNotifyValue(true);
        _alignmentCharacteristic!.onValueReceived.listen(_handleAlignmentData);
      }
      
      _connectionStateController.add(BleConnectionState.connected);
      
      device.connectionState.listen((state) {
        if (state == BluetoothConnectionState.disconnected) {
          _handleDisconnection();
        }
      });
      
      return true;
    } catch (e) {
      _connectionStateController.add(BleConnectionState.error);
      print('Connection error: $e');
      return false;
    }
  }
  
  /// Handle incoming alignment data from UWB system
  void _handleAlignmentData(List<int> data) {
    try {
      if (data.length >= 9) {
        ByteData byteData = ByteData.sublistView(Uint8List.fromList(data));
        
        double angle = byteData.getFloat32(0, Endian.little);
        double distance = byteData.getFloat32(4, Endian.little);
        double confidence = data[8] / 255.0;
        
        PutterAlignment alignment = PutterAlignment(
          angleOffset: angle,
          distanceToHole: distance,
          confidence: confidence,
          timestamp: DateTime.now(),
        );
        
        _alignmentController.add(alignment);
      }
    } catch (e) {
      print('Error parsing alignment data: $e');
    }
  }
  
  /// Parse UWB position data and calculate alignment
  PutterAlignment calculateAlignmentFromUWB({
    required UWBPosition holePosition,
    required UWBPosition putterToe,
    required UWBPosition putterHeel,
  }) {
    double putterAngle = _calculateAngle(putterToe, putterHeel);
    
    UWBPosition putterCenter = UWBPosition(
      x: (putterToe.x + putterHeel.x) / 2,
      y: (putterToe.y + putterHeel.y) / 2,
    );
    double holeAngle = _calculateAngle(putterCenter, holePosition);
    
    double angleOffset = _normalizeAngle(holeAngle - putterAngle);
    
    double distance = _calculateDistance(putterCenter, holePosition);
    
    return PutterAlignment(
      angleOffset: angleOffset,
      distanceToHole: distance,
      confidence: 0.95,
      timestamp: DateTime.now(),
    );
  }
  
  double _calculateAngle(UWBPosition from, UWBPosition to) {
    return _radiansToDegrees(
      math.atan2(to.y - from.y, to.x - from.x)
    );
  }
  
  double _calculateDistance(UWBPosition a, UWBPosition b) {
    double dx = b.x - a.x;
    double dy = b.y - a.y;
    return math.sqrt(dx * dx + dy * dy);
  }
  
  double _normalizeAngle(double angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }
  
  double _radiansToDegrees(double radians) => radians * 180 / math.pi;
  
  /// Start mock data stream for testing
  void startMockDataStream() {
    int tick = 0;
    Timer.periodic(const Duration(milliseconds: 100), (timer) {
      double mockAngle = 20 * math.sin(tick * 0.05);
      tick++;
      
      _alignmentController.add(PutterAlignment(
        angleOffset: mockAngle,
        distanceToHole: 2.5,
        confidence: 0.9,
        timestamp: DateTime.now(),
      ));
    });
  }
  
  /// Disconnect from device
  Future<void> disconnect() async {
    await _connectedDevice?.disconnect();
    _handleDisconnection();
  }
  
  void _handleDisconnection() {
    _connectedDevice = null;
    _alignmentCharacteristic = null;
    _distanceCharacteristic = null;
    _connectionStateController.add(BleConnectionState.disconnected);
  }
  
  void dispose() {
    _alignmentController.close();
    _connectionStateController.close();
    disconnect();
  }
}

enum BleConnectionState {
  disconnected,
  scanning,
  connecting,
  connected,
  error,
}

/// Raw UWB position data
class UWBPosition {
  final double x;
  final double y;
  final double? z;
  
  const UWBPosition({required this.x, required this.y, this.z});
}