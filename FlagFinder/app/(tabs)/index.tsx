import React, { useCallback, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
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
import { ARUCO_MARKER_ID, KNOWN_WIDTH_CM, FOCAL_LENGTH_BASE, DIST_CORR_SCALE, DIST_CORR_OFFSET } from '@/constants/calibration';

// ─── Constants ────────────────────────────────────────────────────────────────
const CM_PER_FOOT = 30.48;
const SPEECH_INTERVAL_MS = 3000;   // ms before repeating the same cue
const CENTERED_HOLD_MS = 2500;    // ms to hold centered before declaring aligned
const SMOOTH_BUFFER_SIZE = 4;     // Frames to average for stable position

// ─── Auto-zoom constants ──────────────────────────────────────────────────────
// Steps the camera through discrete zoom levels based on marker pixel size.
// At 10cm marker / 640px frame: expect ~37px at 10ft, ~18px at 20ft, ~7px at 50ft.
const ZOOM_STEPS = [1.0, 1.5, 2.0, 3.0];
const ZOOM_UP_PX   = 28;   // step zoom in  when marker < this many px
const ZOOM_DOWN_PX = 80;   // step zoom out when marker > this many px
const ZOOM_DEBOUNCE_MS = 1200; // min ms between zoom changes (prevents oscillation)

// ─── Native ArUco plugin (VisionCamera Frame Processor) ──────────────────────
const arucoPlugin = VisionCameraProxy.initFrameProcessorPlugin('detectAruco', {});

// ─── Speech cues ──────────────────────────────────────────────────────────────
const SPEECH_CUE: Record<AlignmentStatus, string> = {
  'MOVE LEFT':   'Move left',
  'SLIGHT LEFT': 'Slight left',
  'CENTERED':    'Centered',
  'SLIGHT RIGHT': 'Slight right',
  'MOVE RIGHT':  'Move right',
  'SEARCHING':   '',
};

// ─── Direction logic (portrait mode) ─────────────────────────────────────────
// Camera frame is landscape. After 90° rotation: frame-Y maps to screen-X.
// frac near 0 → tag on RIGHT of screen → user moves RIGHT to center it
// frac near 1 → tag on LEFT of screen  → user moves LEFT to center it
function calculateStatus(centerY: number, frameH: number): AlignmentStatus {
  const frac = (frameH - centerY) / frameH;
  if (frac < 0.32) return 'MOVE LEFT';
  if (frac < 0.45) return 'SLIGHT LEFT';
  if (frac < 0.55) return 'CENTERED';   // tightened from 16% to 10% band
  if (frac < 0.68) return 'SLIGHT RIGHT';
  return 'MOVE RIGHT';
}

interface FrameState {
  status: AlignmentStatus;
  distFeet: number | null;
  corners: number[][] | null;
  frameW: number;
  frameH: number;
}

const IDLE_STATE: FrameState = {
  status: 'SEARCHING',
  distFeet: null,
  corners: null,
  frameW: 0,
  frameH: 0,
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FlagFinderScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const isBusy = useSharedValue(false);
  const isActive = useSharedValue(false);

  const lastSpokenAt     = useRef(0);
  const lastSpokenStatus = useRef<AlignmentStatus | null>(null);
  const centeredSince    = useRef<number | null>(null);
  const smoothBuf        = useRef<number[]>([]);
  const zoomRef          = useRef(1.0);
  const zoomStepIdx      = useRef(0);
  const lastZoomChange   = useRef(0);
  const missedFrames     = useRef(0);

  const [isScanning, setIsScanning]     = useState(false);
  const [isDone, setIsDone]             = useState(false);
  const [zoom, setZoom]                 = useState(1.0);
  const [frameState, setFrameState]     = useState<FrameState>(IDLE_STATE);
  const [viewSize, setViewSize]         = useState({ width: 0, height: 0 });
  const [finalDist, setFinalDist]       = useState<number | null>(null);

  // ── Called from worklet thread → JS thread ───────────────────────────────
  const processResult = useCallback(
    (result: Record<string, unknown>) => {
      try {
        if (!isActive.value) return;

        const found = result.found as boolean;

        if (!found) {
          missedFrames.current += 1;
          // Only drop to SEARCHING after 8 consecutive missed frames (~0.5s).
          // This prevents the oscillating SEARCHING flash when detection is spotty at distance.
          if (missedFrames.current >= 8) {
            smoothBuf.current = [];
            setFrameState((prev) =>
              prev.status === 'SEARCHING' ? prev : { ...IDLE_STATE }
            );
          }
          return;
        }
        missedFrames.current = 0;

        const markers = result.markers as Array<Record<string, unknown>>;
        const target  = markers.find((m) => (m.id as number) === ARUCO_MARKER_ID);
        if (!target) return;

        const centerY    = target.centerY    as number;
        const pixelWidth = target.pixelWidth as number;
        const frameW     = target.frameWidth  as number;
        const frameH     = target.frameHeight as number;
        const corners    = target.corners     as number[][];

        // ── Auto-zoom: step in/out based on marker pixel size ──────────────
        const nowZoom = Date.now();
        if (pixelWidth > 5 && nowZoom - lastZoomChange.current > ZOOM_DEBOUNCE_MS) {
          const idx = zoomStepIdx.current;
          if (pixelWidth < ZOOM_UP_PX && idx < ZOOM_STEPS.length - 1) {
            const newIdx  = idx + 1;
            const newZoom = ZOOM_STEPS[newIdx];
            zoomStepIdx.current    = newIdx;
            zoomRef.current        = newZoom;
            lastZoomChange.current = nowZoom;
            setZoom(newZoom);
          } else if (pixelWidth > ZOOM_DOWN_PX && idx > 0) {
            const newIdx  = idx - 1;
            const newZoom = ZOOM_STEPS[newIdx];
            zoomStepIdx.current    = newIdx;
            zoomRef.current        = newZoom;
            lastZoomChange.current = nowZoom;
            setZoom(newZoom);
          }
        }

        // Smooth Y position
        const buf = smoothBuf.current;
        buf.push(centerY);
        if (buf.length > SMOOTH_BUFFER_SIZE) buf.shift();
        const smoothY = buf.reduce((a, b) => a + b, 0) / buf.length;

        const status = calculateStatus(smoothY, frameH);

        // Distance estimate — raw formula then empirical linear correction.
        // Correction fit: actual = 0.837 × raw + 0.908 (from 4-point field test).
        const focalScaled = FOCAL_LENGTH_BASE * (frameW / 640.0);
        const rawDist = pixelWidth > 5
          ? (focalScaled * zoomRef.current * KNOWN_WIDTH_CM) / pixelWidth / 2 / CM_PER_FOOT
          : null;
        const distFeet = rawDist !== null
          ? rawDist * DIST_CORR_SCALE + DIST_CORR_OFFSET
          : null;

        setFrameState({ status, distFeet, corners, frameW, frameH });

        const now = Date.now();

        // Hold centered for 2.5s → aligned
        if (status === 'CENTERED') {
          if (centeredSince.current === null) centeredSince.current = now;
          else if (now - centeredSince.current >= CENTERED_HOLD_MS) {
            isActive.value = false;
            setIsScanning(false);
            setIsDone(true);
            setFinalDist(distFeet);
            Speech.speak('Aligned! Ready to putt.', { rate: 0.9 });
            return;
          }
        } else {
          centeredSince.current = null;
        }

        // Speak immediately when status changes, then wait full interval before repeating same cue
        const cue = SPEECH_CUE[status];
        if (
          cue &&
          (status !== lastSpokenStatus.current ||
            now - lastSpokenAt.current >= SPEECH_INTERVAL_MS)
        ) {
          Speech.speak(cue, { rate: 0.95 });
          lastSpokenAt.current    = now;
          lastSpokenStatus.current = status;
        }
      } finally {
        isBusy.value = false;
      }
    },
    [isBusy, isActive]
  );

  const processResultOnJS = useRunOnJS(processResult, [processResult]);

  // ── Frame processor (runs on worklet thread, every camera frame) ──────────
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (isBusy.value || !isActive.value) return;
      if (!arucoPlugin) return;
      isBusy.value = true;
      // @ts-ignore — native plugin returns NSDictionary bridged to JS object
      const result = arucoPlugin.call(frame) as Record<string, unknown>;
      processResultOnJS(result);
    },
    [processResultOnJS, isBusy, isActive]
  );

  // ── Session controls ──────────────────────────────────────────────────────
  const startScan = useCallback(() => {
    smoothBuf.current      = [];
    centeredSince.current  = null;
    lastSpokenAt.current   = 0;
    lastSpokenStatus.current = null;
    isBusy.value  = false;
    isActive.value = true;
    zoomRef.current        = 1.0;
    zoomStepIdx.current    = 0;
    lastZoomChange.current = 0;
    missedFrames.current   = 0;
    setZoom(1.0);
    setFrameState(IDLE_STATE);
    setFinalDist(null);
    setIsDone(false);
    setIsScanning(true);
  }, [isBusy, isActive]);

  const stopScan = useCallback(() => {
    isActive.value = false;
    isBusy.value   = false;
    setIsScanning(false);
    setFrameState(IDLE_STATE);
  }, [isBusy, isActive]);

  // ── Permission screen ─────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.titleText}>Camera Access Required</Text>
        <Text style={styles.subtitleText}>
          Flag Finder needs your camera to detect the AruCo tag on the flag.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.titleText}>No Camera Found</Text>
      </View>
    );
  }

  // ── Idle screen ───────────────────────────────────────────────────────────
  if (!isScanning && !isDone) {
    return (
      <View style={styles.centered}>
        <Text style={styles.titleText}>Flag Finder</Text>
        <Text style={styles.subtitleText}>
          Stand in your sideways stance at the ball.{'\n'}
          Prepare to adjust so that the camera is aligned with the tag.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={startScan}>
          <Text style={styles.primaryBtnText}>Start</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Aligned / done screen ─────────────────────────────────────────────────
  if (isDone) {
    return (
      <View style={styles.centered}>
        <Text style={styles.alignedText}>ALIGNED</Text>
        <Text style={styles.subtitleText}>Ready to putt</Text>
        {finalDist !== null && (
          <Text style={styles.finalDistText}>{finalDist.toFixed(1)} ft</Text>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={startScan}>
          <Text style={styles.primaryBtnText}>Scan Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera scanning screen ────────────────────────────────────────────────
  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setViewSize({ width, height });
      }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        zoom={zoom}
        frameProcessor={Platform.OS !== 'web' ? frameProcessor : undefined}
        pixelFormat="yuv"
      />

      <AlignmentOverlay
        status={frameState.status}
        distFeet={frameState.distFeet}
        screenWidth={viewSize.width}
        screenHeight={viewSize.height}
        corners={frameState.corners}
        frameW={frameState.frameW}
        frameH={frameState.frameH}
      />

      <TouchableOpacity style={styles.cancelBtn} onPress={stopScan}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
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
    gap: 20,
    paddingHorizontal: 32,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  alignedText: {
    color: '#00e676',
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: 3,
  },
  finalDistText: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 1,
  },
  primaryBtn: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 20,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
