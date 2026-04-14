import { useState, useEffect, useRef, useCallback } from 'react';
import { BleManager, Device, Subscription, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

// ─── Pi BLE constants (must match ble_service.py) ────────────────────────────
const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const CHAR_UUID    = '12345678-1234-5678-1234-56789abcdef1';
const DEVICE_NAME  = 'PiDataServer';

// ─── Types ────────────────────────────────────────────────────────────────────
export type BLEStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TagData {
  /** Direction string from the Pi: "LEFT", "CENTER", "NO TAG", etc. */
  direction: string;
  /** Distance in cm if the Pi includes it (format "DIRECTION:distance"), or null */
  distance: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** BLE characteristic values are base64 encoded. Decode to a UTF-8 string. */
function decodeValue(b64: string): string {
  // atob is available globally in React Native
  return atob(b64);
}

/**
 * Parse the Pi's notification payload.
 * Supports:
 *   "CENTER"          → { direction: "CENTER", distance: null }
 *   "LEFT:-100:1"     → { direction: "LEFT", distance: null }   (pixel offset, ignored)
 *   "CENTER:45"       → { direction: "CENTER", distance: 45 }   (distance in cm)
 */
function parseTagData(raw: string): TagData {
  const parts = raw.trim().split(':');
  const direction = parts[0].trim().toUpperCase();

  // If a second segment is a plain positive number we treat it as distance (cm)
  let distance: number | null = null;
  if (parts.length === 2) {
    const n = parseFloat(parts[1]);
    if (!isNaN(n) && n >= 0) distance = n;
  }

  return { direction, distance };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBLE() {
  // One BleManager instance for the lifetime of the hook
  const managerRef = useRef<BleManager | null>(null);
  const deviceRef  = useRef<Device | null>(null);
  const monitorRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus]   = useState<BLEStatus>('idle');
  const [tagData, setTagData] = useState<TagData | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Create / destroy BleManager in sync with component lifecycle
  useEffect(() => {
    managerRef.current = new BleManager();
    return () => {
      cleanupConnections();
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal cleanup ───────────────────────────────────────────────────────
  function cleanupConnections() {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    monitorRef.current?.remove();
    monitorRef.current = null;
    managerRef.current?.stopDeviceScan();
    deviceRef.current?.cancelConnection().catch(() => {});
    deviceRef.current = null;
  }

  // ── Android runtime permissions ────────────────────────────────────────────
  async function requestAndroidPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(
      (r) => r === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;

    cleanupConnections();
    setError(null);
    setTagData(null);
    setStatus('scanning');

    if (!(await requestAndroidPermissions())) {
      setError('Bluetooth permissions required');
      setStatus('error');
      return;
    }

    const btState = await manager.state();
    if (btState !== State.PoweredOn) {
      setError('Bluetooth is off — please enable it and try again.');
      setStatus('error');
      return;
    }

    // Auto-cancel scan after 15s if the Pi isn't found
    scanTimeoutRef.current = setTimeout(() => {
      manager.stopDeviceScan();
      setError('Could not find "PiDataServer". Make sure the Pi is running and nearby.');
      setStatus('error');
    }, 15_000);

    manager.startDeviceScan(null, null, (scanErr, device) => {
      if (scanErr) {
        clearTimeout(scanTimeoutRef.current!);
        setError(scanErr.message);
        setStatus('error');
        return;
      }

      const deviceName = device?.name ?? device?.localName;
      if (!device || deviceName !== DEVICE_NAME) return;

      // Found it — stop the scan and connect
      clearTimeout(scanTimeoutRef.current!);
      manager.stopDeviceScan();
      setStatus('connecting');

      device
        .connect()
        .then((d) => d.discoverAllServicesAndCharacteristics())
        .then((d) => {
          deviceRef.current = d;
          setStatus('connected');

          // Listen for disconnection
          d.onDisconnected(() => {
            monitorRef.current?.remove();
            monitorRef.current = null;
            deviceRef.current = null;
            setTagData(null);
            setStatus('disconnected');
          });

          // Subscribe to characteristic notifications
          monitorRef.current = d.monitorCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUID,
            (monErr, char) => {
              if (monErr || !char?.value) return;
              const raw = decodeValue(char.value);
              setTagData(parseTagData(raw));
            },
          );
        })
        .catch((e) => {
          setError(e.message ?? 'Connection failed');
          setStatus('error');
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    cleanupConnections();
    setTagData(null);
    setStatus('idle');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, tagData, error, connect, disconnect };
}
