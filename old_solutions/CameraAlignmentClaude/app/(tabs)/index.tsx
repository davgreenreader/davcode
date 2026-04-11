import React, { useCallback, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
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
  VisionCameraProxy,
} from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';

import { AlignmentOverlay, AlignmentStatus } from '@/components/alignment-overlay';
import { ARUCO_MARKER_ID, FOCAL_LENGTH_BASE, KNOWN_WIDTH_CM } from '@/constants/calibration';

const CM_PER_FOOT = 30.48;
const SPEECH_INTERVAL_MS = 3500;
const CENTERED_HOLD_MS = 4000;
const SWEEP_CONFIRM_FRAMES = 3;
const SMOOTH_BUFFER = 3;

// Auto-zoom during align only
const ZOOM_STEP_FINE = 0.2;
const ZOOM_STEP_RECOVER = 0.5;
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 6.0;
const PIXEL_WIDTH_TARGET_LOW = 20;
const PIXEL_WIDTH_TARGET_HIGH = 80;

// Worklet-readable session values
const SESSION_INACTIVE = 0;
const SESSION_SWEEPING = 1;
const SESSION_ALIGNING = 2;

// Initialize native OpenCV ArUco plugin
const arucoPlugin = VisionCameraProxy.initFrameProcessorPlugin('detectAruco', {});


const SPEECH_CUE: Record<AlignmentStatus, string> = {
  'LEFT':         'Left',
  'LITTLE LEFT':  'Slightly left',
  'CENTER':       'Centered',
  'LITTLE RIGHT': 'Slightly right',
  'RIGHT':        'Right',
  'SEARCHING...': '',
};

function calculateDirection(centerY: number, frameH: number): AlignmentStatus {
  // frac: 0 = left edge of portrait screen, 1 = right edge
  const frac = (frameH - centerY) / frameH;
  if (frac < 0.30) return 'LEFT';
  if (frac < 0.45) return 'LITTLE LEFT';
  if (frac < 0.55) return 'CENTER';   // 10% center band (was 20%)
  if (frac < 0.70) return 'LITTLE RIGHT';
  return 'RIGHT';
}

interface AppState {
  status: AlignmentStatus;
  distFeet: number | null;
  debugZone: number;
  debugCenterY: number;
  corners: number[][] | null;
  frameW: number;
  frameH: number;
}

type SessionState = 'idle' | 'sweeping' | 'aligning' | 'aligned';

export default function HomeScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const isBusy = useSharedValue(false);
  const sessionShared = useSharedValue(SESSION_INACTIVE);

  const lastSpokenAt = useRef(0);
  const lastSpokenStatus = useRef<AlignmentStatus | null>(null);
  const centeredSince = useRef<number | null>(null);
  const sweepConfirmCount = useRef(0);
  const smoothBuffer = useRef<number[]>([]);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const [session, setSession] = useState<SessionState>('idle');
  const sessionRef = useRef<SessionState>('idle');

  const [appState, setAppState] = useState<AppState>({
    status: 'SEARCHING...',
    distFeet: null,
    debugZone: -1,
    debugCenterY: -1,
    corners: null,
    frameW: 0,
    frameH: 0,
  });

  const deviceMaxZoom = Math.min(device?.maxZoom ?? ZOOM_MAX, ZOOM_MAX);
  const zoomRef = useRef(ZOOM_MIN);
  const [zoom, setZoom] = useState(ZOOM_MIN);

  const updateZoom = useCallback((newZoom: number) => {
    zoomRef.current = newZoom;
    setZoom(newZoom);
  }, []);

  const startSweep = useCallback(() => {
    sweepConfirmCount.current = 0;
    smoothBuffer.current = [];
    centeredSince.current = null;
    lastSpokenAt.current = 0;
    lastSpokenStatus.current = null;
    isBusy.value = false;
    zoomRef.current = ZOOM_MIN;
    setZoom(ZOOM_MIN);
    setAppState({ status: 'SEARCHING...', distFeet: null, debugZone: -1, debugCenterY: -1, corners: null, frameW: 0, frameH: 0 });
    sessionRef.current = 'sweeping';
    sessionShared.value = SESSION_SWEEPING;
    setSession('sweeping');
  }, [isBusy, sessionShared]);

  const processResult = useCallback(
    (result: Record<string, unknown>) => {
      try {
        const currentSession = sessionRef.current;
        if (currentSession !== 'sweeping' && currentSession !== 'aligning') return;

        const found = result.found as boolean;

        if (!found) {
          sweepConfirmCount.current = 0;
          smoothBuffer.current = [];
          centeredSince.current = null;

          if (currentSession === 'aligning') {
            setAppState((prev) =>
              prev.status === 'SEARCHING...'
                ? prev
                : { status: 'SEARCHING...', distFeet: null, debugZone: -1, debugCenterY: -1, corners: null, frameW: 0, frameH: 0 }
            );
            const nextZoom = Math.max(zoomRef.current - ZOOM_STEP_RECOVER, ZOOM_MIN);
            if (nextZoom !== zoomRef.current) updateZoom(nextZoom);
          }
          return;
        }

        const markers = result.markers as Array<Record<string, unknown>>;
        const target = markers.find((m) => (m.id as number) === ARUCO_MARKER_ID);
        if (!target) return;

        const centerY = target.centerY as number;
        const pixelWidth = target.pixelWidth as number;
        const frameW = target.frameWidth as number;
        const frameH = target.frameHeight as number;
        const corners = target.corners as number[][];

        // --- Sweep phase ---
        if (currentSession === 'sweeping') {
          sweepConfirmCount.current += 1;
          if (sweepConfirmCount.current >= SWEEP_CONFIRM_FRAMES) {
            sessionRef.current = 'aligning';
            sessionShared.value = SESSION_ALIGNING;
            setSession('aligning');
            Speech.speak('Pin detected. Now align.', { rate: 0.9 });
          }
          return;
        }

        // --- Align phase ---

        // Auto-zoom based on pixel width
        if (pixelWidth < PIXEL_WIDTH_TARGET_LOW) {
          const nextZoom = Math.min(zoomRef.current + ZOOM_STEP_FINE, deviceMaxZoom);
          if (nextZoom !== zoomRef.current) updateZoom(nextZoom);
        } else if (pixelWidth > PIXEL_WIDTH_TARGET_HIGH) {
          const nextZoom = Math.max(zoomRef.current - ZOOM_STEP_FINE, ZOOM_MIN);
          if (nextZoom !== zoomRef.current) updateZoom(nextZoom);
        }

        // Scale focal length to match actual frame resolution (calibrated at 640px)
        const focalLengthScaled = FOCAL_LENGTH_BASE * (frameW / 640.0);
        const distCm = pixelWidth > 5
          ? (focalLengthScaled * zoomRef.current * KNOWN_WIDTH_CM) / pixelWidth / 2
          : null;
        const distFeet = distCm !== null ? distCm / CM_PER_FOOT : null;

        // Smooth Y center
        const buf = smoothBuffer.current;
        buf.push(centerY);
        if (buf.length > SMOOTH_BUFFER) buf.shift();
        const smoothCenterY = buf.reduce((a, b) => a + b, 0) / buf.length;

        const status = calculateDirection(smoothCenterY, frameH);
        const debugZone = Math.min(Math.floor((frameH - smoothCenterY) / (frameH / 5)), 4);

        setAppState({ status, distFeet, debugZone, debugCenterY: Math.round(smoothCenterY), corners, frameW, frameH });

        const now = Date.now();

        if (status === 'CENTER') {
          if (centeredSince.current === null) centeredSince.current = now;
          else if (now - centeredSince.current >= CENTERED_HOLD_MS) {
            sessionRef.current = 'aligned';
            sessionShared.value = SESSION_INACTIVE;
            setSession('aligned');
            Speech.speak('Aligned! Pivot 90 degrees and set your stance.', { rate: 0.9 });
            return;
          }
        } else {
          centeredSince.current = null;
        }

        const cue = SPEECH_CUE[status];
        if (cue && (status !== lastSpokenStatus.current || now - lastSpokenAt.current >= SPEECH_INTERVAL_MS)) {
          Speech.speak(cue, { rate: 0.9 });
          lastSpokenAt.current = now;
          lastSpokenStatus.current = status;
        }
      } finally {
        isBusy.value = false;
      }
    },
    [isBusy, sessionShared, deviceMaxZoom, updateZoom]
  );

  const processResultOnJS = useRunOnJS(processResult, [processResult]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (isBusy.value) return;
      const s = sessionShared.value;
      if (s === SESSION_INACTIVE) return;
      if (!arucoPlugin) return;
      isBusy.value = true;

      // @ts-ignore — native plugin returns NSDictionary bridged to JS object
      const result = arucoPlugin.call(frame) as Record<string, unknown>;
      processResultOnJS(result);
    },
    [processResultOnJS, isBusy, sessionShared]
  );

  const cancelToIdle = useCallback(() => {
    sessionShared.value = SESSION_INACTIVE;
    sessionRef.current = 'idle';
    setSession('idle');
  }, [sessionShared]);

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

  if (session === 'idle') {
    return (
      <View style={styles.centered}>
        <Text style={styles.titleText}>Pin Alignment</Text>
        <Text style={styles.subtitleText}>Stand behind the ball and slowly sweep toward the pin</Text>
        <TouchableOpacity style={styles.startBtn} onPress={startSweep}>
          <Text style={styles.startBtnText}>Start</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (session === 'aligned') {
    return (
      <View style={styles.centered}>
        <Text style={styles.alignedText}>ALIGNED</Text>
        <Text style={styles.subtitleText}>Pivot 90° to address the ball</Text>
        <TouchableOpacity style={styles.btn} onPress={cancelToIdle}>
          <Text style={styles.btnText}>Reset</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        zoom={zoom}
        frameProcessor={Platform.OS !== 'web' ? frameProcessor : undefined}
        pixelFormat="yuv"
      />

      {session === 'sweeping' ? (
        <View style={styles.sweepBanner}>
          <Text style={styles.sweepText}>Slowly sweep toward the pin...</Text>
        </View>
      ) : (
        <AlignmentOverlay
          status={appState.status}
          distFeet={appState.distFeet}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          corners={appState.corners}
          frameW={appState.frameW}
          frameH={appState.frameH}
        />
      )}

      <View style={styles.debugBadge}>
        <Text style={styles.debugText}>
          Y:{appState.debugCenterY} zone:{appState.debugZone}
        </Text>
      </View>

      <View style={styles.zoomBadge}>
        <Text style={styles.zoomText}>{zoom.toFixed(1)}×</Text>
      </View>

      <TouchableOpacity style={styles.cancelBtn} onPress={cancelToIdle}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d1a0d', gap: 20, paddingHorizontal: 32,
  },
  titleText: { color: '#ffffff', fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  subtitleText: { color: 'rgba(255,255,255,0.65)', fontSize: 15, textAlign: 'center' },
  alignedText: { color: '#00e676', fontSize: 52, fontWeight: '800', letterSpacing: 3 },
  permText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  startBtn: {
    backgroundColor: '#4caf50', paddingHorizontal: 40,
    paddingVertical: 18, borderRadius: 12, marginTop: 8,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 20 },
  btn: {
    backgroundColor: '#4caf50', paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  sweepBanner: {
    position: 'absolute', top: 60, left: 0, right: 0,
    alignItems: 'center', gap: 8,
  },
  sweepText: {
    color: '#ffffff', fontSize: 22, fontWeight: '700',
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 6,
  },
  debugBadge: {
    position: 'absolute', top: 110, left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 6,
  },
  debugText: { color: '#ffeb3b', fontSize: 13, fontWeight: '600' },
  zoomBadge: {
    position: 'absolute', top: 60, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 6,
  },
  zoomText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 28,
    paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
