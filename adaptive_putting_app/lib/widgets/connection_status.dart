import 'package:flutter/material.dart';
import '../services/ble_service.dart';

class ConnectionStatus extends StatelessWidget {
  final BleConnectionState state;
  
  const ConnectionStatus({
    super.key,
    required this.state,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: 'Connection status: ${_getStatusText()}',
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _getBackgroundColor(),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildIcon(),
            const SizedBox(width: 12),
            Text(
              _getStatusText(),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildIcon() {
    switch (state) {
      case BleConnectionState.disconnected:
        return const Icon(Icons.bluetooth_disabled, size: 28);
      case BleConnectionState.scanning:
        return const SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 3),
        );
      case BleConnectionState.connecting:
        return const SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 3),
        );
      case BleConnectionState.connected:
        return const Icon(Icons.bluetooth_connected, size: 28, color: Colors.greenAccent);
      case BleConnectionState.error:
        return const Icon(Icons.error, size: 28, color: Colors.red);
    }
  }
  
  String _getStatusText() {
    switch (state) {
      case BleConnectionState.disconnected:
        return 'Disconnected';
      case BleConnectionState.scanning:
        return 'Scanning...';
      case BleConnectionState.connecting:
        return 'Connecting...';
      case BleConnectionState.connected:
        return 'Connected';
      case BleConnectionState.error:
        return 'Error';
    }
  }
  
  Color _getBackgroundColor() {
    switch (state) {
      case BleConnectionState.disconnected:
        return Colors.grey[800]!;
      case BleConnectionState.scanning:
        return Colors.blue[900]!;
      case BleConnectionState.connecting:
        return Colors.orange[900]!;
      case BleConnectionState.connected:
        return Colors.green[900]!;
      case BleConnectionState.error:
        return Colors.red[900]!;
    }
  }
}