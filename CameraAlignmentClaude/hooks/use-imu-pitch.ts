/**
 * Returns the current putter/device pitch in degrees using DeviceMotion.
 * Positive = tilted up, Negative = tilted down (matches Python IMU convention).
 * Falls back to 0.0 when sensor is unavailable (matches Python get_imu_pitch placeholder).
 */
import { useState, useEffect } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { Platform } from 'react-native';

export function useImuPitch(): number {
  const [pitch, setPitch] = useState(0.0);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let sub: ReturnType<typeof DeviceMotion.addListener> | null = null;

    DeviceMotion.isAvailableAsync().then((available) => {
      if (!available) return;
      DeviceMotion.setUpdateInterval(100);
      sub = DeviceMotion.addListener((data) => {
        if (data.rotation?.gamma != null) {
          // gamma = pitch around the X-axis, convert radians → degrees
          setPitch((data.rotation.gamma * 180) / Math.PI);
        }
      });
    });

    return () => {
      sub?.remove();
    };
  }, []);

  return pitch;
}
