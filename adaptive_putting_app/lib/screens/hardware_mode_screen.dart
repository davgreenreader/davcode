import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import '../providers/app_state_provider.dart';
import '../services/ble_service.dart';
import '../models/putter_alignment.dart';
import '../widgets/alignment_indicator.dart';
import '../widgets/connection_status.dart';
import '../widgets/accessibility_button.dart';

class HardwareModeScreen extends StatefulWidget {
  const HardwareModeScreen({super.key});

  @override
  State<HardwareModeScreen> createState() => _HardwareModeScreenState();
}

class _HardwareModeScreenState extends State<HardwareModeScreen> {
  List<ScanResult> _scanResults = [];
  bool _isScanning = false;
  
  @override
  void initState() {
    super.initState();
    _requestPermissions();
  }
  
  Future<void> _requestPermissions() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();
  }
  
  Future<void> _startScan() async {
    final provider = context.read<AppStateProvider>();
    
    try {
      await provider.bleService.initialize();
      
      setState(() {
        _isScanning = true;
        _scanResults = [];
      });
      
      provider.bleService.scanForDevices().listen((results) {
        setState(() {
          _scanResults = results;
        });
      });
      
      await Future.delayed(const Duration(seconds: 10));
      await provider.bleService.stopScan();
      
      setState(() {
        _isScanning = false;
      });
    } catch (e) {
      _showError(e.toString());
    }
  }
  
  Future<void> _connectToDevice(BluetoothDevice device) async {
    final provider = context.read<AppStateProvider>();
    
    bool success = await provider.bleService.connectToDevice(device);
    
    if (success) {
      _announceConnection('Connected to ${device.platformName}');
    } else {
      _showError('Failed to connect');
    }
  }
  
  void _announceConnection(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontSize: 18)),
        duration: const Duration(seconds: 2),
      ),
    );
  }
  
  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontSize: 18)),
        backgroundColor: Colors.red,
      ),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: const Text('Hardware Mode'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Consumer<AppStateProvider>(
        builder: (context, state, _) {
          if (state.bleState == BleConnectionState.connected) {
            return _buildConnectedView(state);
          } else {
            return _buildScanView(state);
          }
        },
      ),
    );
  }
  
  Widget _buildScanView(AppStateProvider state) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ConnectionStatus(state: state.bleState),
            
            const SizedBox(height: 24),
            
            AccessibilityButton(
              label: _isScanning ? 'Scanning...' : 'Scan for Devices',
              semanticsHint: 'Search for UWB putter system',
              icon: _isScanning ? Icons.bluetooth_searching : Icons.bluetooth,
              onPressed: _isScanning ? null : _startScan,
            ),
            
            const SizedBox(height: 24),
            
            Expanded(
              child: _scanResults.isEmpty
                  ? Center(
                      child: Text(
                        _isScanning 
                            ? 'Searching for devices...' 
                            : 'No devices found.\nTap Scan to search.',
                        style: Theme.of(context).textTheme.bodyLarge,
                        textAlign: TextAlign.center,
                      ),
                    )
                  : ListView.builder(
                      itemCount: _scanResults.length,
                      itemBuilder: (context, index) {
                        final result = _scanResults[index];
                        final name = result.device.platformName.isNotEmpty
                            ? result.device.platformName
                            : 'Unknown Device';
                        
                        return Semantics(
                          button: true,
                          label: 'Connect to $name',
                          child: Card(
                            color: Colors.grey[900],
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(16),
                              leading: const Icon(
                                Icons.bluetooth,
                                size: 40,
                                color: Colors.greenAccent,
                              ),
                              title: Text(
                                name,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              subtitle: Text(
                                'Signal: ${result.rssi} dBm',
                                style: const TextStyle(fontSize: 16),
                              ),
                              onTap: () => _connectToDevice(result.device),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildConnectedView(AppStateProvider state) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ConnectionStatus(state: state.bleState),
            
            const SizedBox(height: 32),
            
            Expanded(
              child: AlignmentIndicator(
                alignment: state.currentAlignment,
              ),
            ),
            
            const SizedBox(height: 32),
            
            Semantics(
              liveRegion: true,
              child: Text(
                _getAlignmentMessage(state.currentAlignment),
                style: Theme.of(context).textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
            ),
            
            const SizedBox(height: 16),
            
            Text(
              'Distance: ${state.currentAlignment.distanceToHole.toStringAsFixed(1)}m',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            
            const SizedBox(height: 32),
            
            AccessibilityButton(
              label: 'Disconnect',
              semanticsHint: 'Disconnect from UWB device',
              icon: Icons.bluetooth_disabled,
              onPressed: () => state.bleService.disconnect(),
              isPrimary: false,
            ),
          ],
        ),
      ),
    );
  }
  
  String _getAlignmentMessage(PutterAlignment alignment) {
    if (alignment.confidence < 0.3) {
      return 'Searching...';
    }
    
    if (alignment.direction == AlignmentDirection.centered) {
      return 'ALIGNED!';
    } else if (alignment.direction == AlignmentDirection.aimLeft) {
      return 'Aim ${alignment.angleOffset.abs().toStringAsFixed(0)}° LEFT';
    } else {
      return 'Aim ${alignment.angleOffset.abs().toStringAsFixed(0)}° RIGHT';
    }
  }
}