/**
 * Main screen — replicates elevation_V2.py in React Native.
 *
 * Pipeline:
 *   Camera frame → vision-camera-resize-plugin (resize to 640×480 RGB)
 *   → runOnJS → js-aruco2 (detect marker 121)
 *   → estimatePose (JS solvePnP approximation)
 *   → calculateElevation (sensor fusion with IMU pitch)
 *   → ElevationOverlay HUD
 */
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { resize } from 'vision-camera-resize-plugin';
import { runOnJS } from 'react-native-reanimated';

import { useImuPitch } from '@/hooks/use-imu-pitch';
import { ElevationOverlay } from '@/components/elevation-overlay';
import { detectArucoMarkers } from '@/utils/aruco-detector';
import { estimatePose } from '@/utils/solve-pnp';
import { calculateElevation } from '@/utils/elevation';
import {
  FOCAL_LENGTH,
  CAMERA_HEIGHT_CM,
  TAG_HEIGHT_CM,
  ARUCO_MARKER_ID,
  KNOWN_WIDTH_CM,
} from '@/constants/calibration';

// Resolution used for ArUco processing (matches Python's typical webcam frame)
const PROCESS_WIDTH = 640;
const PROCESS_HEIGHT = 480;

interface ElevationState {
  distIn: number;
  pitchDeg: number;
  elevationCm: number;
  markerFound: boolean;
  screenCorners: number[][] | null;
}

export default function HomeScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const pitch = useImuPitch();

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const [state, setState] = useState<ElevationState>({
    distIn: 0,
    pitchDeg: 0,
    elevationCm: 0,
    markerFound: false,
    screenCorners: null,
  });

  // Principal point at center of processing frame
  const cx = PROCESS_WIDTH / 2;
  const cy = PROCESS_HEIGHT / 2;

  // Runs on JS thread — called from frame processor via runOnJS
  const processFrame = useCallback(
    (rgbData: Uint8Array, frameWidth: number, frameHeight: number) => {
      const markers = detectArucoMarkers(rgbData, frameWidth, frameHeight);
      const target = markers.find((m) => m.id === ARUCO_MARKER_ID);

      if (!target) {
        setState((prev) => ({ ...prev, markerFound: false, screenCorners: null }));
        return;
      }

      const corners: [[number, number], [number, number], [number, number], [number, number]] =
        [
          [target.corners[0].x, target.corners[0].y],
          [target.corners[1].x, target.corners[1].y],
          [target.corners[2].x, target.corners[2].y],
          [target.corners[3].x, target.corners[3].y],
        ];

      const pose = estimatePose(corners, FOCAL_LENGTH, cx, cy, KNOWN_WIDTH_CM);
      if (!pose) return;

      const distIn = pose.dist / 2.54;
      const elevationCm = calculateElevation(pose.tvec, pitch, CAMERA_HEIGHT_CM, TAG_HEIGHT_CM);

      // Scale corners from processing resolution to screen resolution
      const scaleX = screenWidth / frameWidth;
      const scaleY = screenHeight / frameHeight;
      const screenCorners = corners.map(([x, y]) => [x * scaleX, y * scaleY]);

      setState({
        distIn,
        pitchDeg: pitch,
        elevationCm,
        markerFound: true,
        screenCorners,
      });
    },
    [pitch, cx, cy, screenWidth, screenHeight]
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const resized = resize(frame, {
        scale: { width: PROCESS_WIDTH, height: PROCESS_HEIGHT },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });
      runOnJS(processFrame)(resized, PROCESS_WIDTH, PROCESS_HEIGHT);
    },
    [processFrame]
  );

  // --- Permission gate ---
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>Camera permission required</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={Platform.OS !== 'web' ? frameProcessor : undefined}
        pixelFormat="yuv"
      />
      <ElevationOverlay
        distIn={state.distIn}
        pitchDeg={state.pitchDeg}
        elevationCm={state.elevationCm}
        markerFound={state.markerFound}
        screenCorners={state.screenCorners}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1a0d',
    gap: 16,
  },
  permText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
