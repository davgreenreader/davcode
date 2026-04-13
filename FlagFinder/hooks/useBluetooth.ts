import { useEffect, useRef, useState, useCallback } from 'react';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';

// UUID constants; defined in pi ble_service code
export const PI_SERVICE_UUID        = "12345678-1234-5678-1234-56789abcdef0";
export const PI_CHARACTERISTIC_UUID = "12345678-1234-5678-1234-56789abcdef1";
export const PI_DEVICE_NAME         = "PiDataServer";

export type AlignmentStatus =
  | 'MOVE LEFT'
  | 'SLIGHT LEFT'
  | 'CENTERED'
  | 'SLIGHT RIGHT'
  | 'MOVE RIGHT'
  | 'SEARCHING';

export type BleStatus =
  | 'idle'
  | 'requesting_permission'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

const manager = new BleManager();

// ensure permissions are correct; ios permissions are handled in app.json and info.plist.
async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
    const perms =
      apiLevel >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(perms);
    return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  return true;
}

export function useBluetooth() {
  const [bleStatus, setBleStatus]           = useState<BleStatus>('idle');
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus>('SEARCHING');
  const [distFeet, setDistFeet]             = useState<number | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  const deviceRef         = useRef<Device | null>(null);
  const notifSubRef       = useRef<Subscription | null>(null);
  const disconnectSubRef  = useRef<Subscription | null>(null);
  const stateSubRef       = useRef<Subscription | null>(null);
  const isMountedRef      = useRef(true);

  // clean up ble after function is finished
  const cleanup = useCallback(() => {
    notifSubRef.current?.remove();
    disconnectSubRef.current?.remove();
    notifSubRef.current     = null;
    disconnectSubRef.current = null;

    if (deviceRef.current) {
      deviceRef.current.cancelConnection().catch(() => {});
      deviceRef.current = null;
    }

    manager.stopDeviceScan();
  }, []);

  // listen for notifications
  const subscribeToNotifications = useCallback((device: Device) => {
    notifSubRef.current?.remove();

    notifSubRef.current = device.monitorCharacteristicForService(
      PI_SERVICE_UUID,
      PI_CHARACTERISTIC_UUID,
      (err, characteristic) => {
        if (err || !characteristic?.value) return;

        // store byte string
        const raw = Buffer.from(characteristic.value, 'base64').toString('utf-8').trim();

        // convert to output for app
        const map: Record<string, AlignmentStatus> = {
          MOVE_LEFT:    'MOVE LEFT',
          SLIGHT_LEFT:  'SLIGHT LEFT',
          CENTERED:     'CENTERED',
          SLIGHT_RIGHT: 'SLIGHT RIGHT',
          MOVE_RIGHT:   'MOVE RIGHT',
        };

        if (map[raw]) setAlignmentStatus(map[raw]);
      }
    );
  }, []);

  // Connect to device
  const connectToDevice = useCallback(async (device: Device) => {
    if (!isMountedRef.current) return;
    setBleStatus('connecting');
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      deviceRef.current = connected;

      // Watch for disconnection
      disconnectSubRef.current = manager.onDeviceDisconnected(
        connected.id,
        (_err, _dev) => {
          if (!isMountedRef.current) return;
          deviceRef.current = null;
          setBleStatus('disconnected');
          setAlignmentStatus('SEARCHING');
        }
      );

      subscribeToNotifications(connected);
      setBleStatus('connected');
    } catch (e: any) {
      setError(e?.message ?? 'Connection failed');
      setBleStatus('error');
    }
  }, [subscribeToNotifications]);

  // Search for connection
  const connect = useCallback(async () => {
    // turn on BLE scanner
    setError(null);
    setBleStatus('requesting_permission');

    const granted = await requestPermissions();
    if (!granted) {
      setError('Bluetooth permission denied');
      setBleStatus('error');
      return;
    }

    setBleStatus('scanning');

    // Scan for pi
    stateSubRef.current?.remove();
    stateSubRef.current = manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        stateSubRef.current?.remove();
        manager.startDeviceScan(
          null,
          { allowDuplicates: false },
          (err, scannedDevice) => {
            if (err) {
              setError(err.message);
              setBleStatus('error');
              return;
            }
            if (scannedDevice?.name === PI_DEVICE_NAME) {
              manager.stopDeviceScan();
              connectToDevice(scannedDevice);
            }
          }
        );
      }
    }, true);
  }, [connectToDevice]);

  // Disconnect from device
  const disconnect = useCallback(() => {
    cleanup();
    setBleStatus('idle');
    setAlignmentStatus('SEARCHING');
    setDistFeet(null);
  }, [cleanup]);

  // clean clean up function after completed
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stateSubRef.current?.remove();
      cleanup();
      manager.destroy();
    };
  }, [cleanup]);

  return {
    bleStatus,
    alignmentStatus,
    distFeet,
    error,
    connect,
    disconnect,
    isConnected: bleStatus === 'connected',
  };
}