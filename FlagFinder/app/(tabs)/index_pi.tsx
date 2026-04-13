import React, { useRef, useCallback , useEffect, useState } from 'react';
import * as Speech from 'expo-speech';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';

import { AlignmentOverlay, AlignmentStatus } from '@/components/alignment-overlay';
import { useBluetooth } from '@/hooks/useBluetooth';

// constants for speech and central calibration
const SPEECH_INTERVAL_MS  = 3000;
const CENTERED_HOLD_MS    = 2500;

const SPEECH_CUE: Record<AlignmentStatus, string> = {
  'MOVE LEFT':    'Rotate left',
  'SLIGHT LEFT':  'Slight left',
  'CENTERED':     'Centered',
  'SLIGHT RIGHT': 'Slight right',
  'MOVE RIGHT':   'Rotate right',
  'SEARCHING':    '',
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FlagFinderScreen() {
  const { bleStatus, alignmentStatus, distFeet, error, connect, disconnect, isConnected } =
    useBluetooth();

  const [isScanning, setIsScanning] = useState(false);
  const [isDone, setIsDone]         = useState(false);
  const [finalDist, setFinalDist]   = useState<number | null>(null);

  const lastSpokenAt      = useRef(0);
  const lastSpokenStatus  = useRef<AlignmentStatus | null>(null);
  const centeredSince     = useRef<number | null>(null);
  const isActiveRef       = useRef(false);

  // handle case where pi camera is centered
  useEffect(() => {
    if (!isActiveRef.current || !isConnected) return;

    const now    = Date.now();
    const status = alignmentStatus;

    if (status === 'CENTERED') {
      if (centeredSince.current === null) centeredSince.current = now;
      else if (now - centeredSince.current >= CENTERED_HOLD_MS) {
        isActiveRef.current = false;
        setIsScanning(false);
        setIsDone(true);
        setFinalDist(distFeet);
        Speech.speak('Aligned! Ready to putt.', { rate: 0.9 });
        return;
      }
    } else {
      centeredSince.current = null;
    }

    const cue = SPEECH_CUE[status];
    if (cue && now - lastSpokenAt.current >= SPEECH_INTERVAL_MS) {
      Speech.speak(cue, { rate: 0.85 });
      lastSpokenAt.current    = now;
      lastSpokenStatus.current = status;
    }
  }, [alignmentStatus, isConnected, distFeet]);

  // ── Session controls ───────────────────────────────────────────────────────
  const startScan = useCallback(() => {
    centeredSince.current    = null;
    lastSpokenAt.current     = 0;
    lastSpokenStatus.current = null;
    isActiveRef.current      = true;
    setFinalDist(null);
    setIsDone(false);
    setIsScanning(true);
    connect();
  }, [connect]);

  const stopScan = useCallback(() => {
    isActiveRef.current = false;
    setIsScanning(false);
    disconnect();
  }, [disconnect]);

  // ── Connecting / scanning screen ───────────────────────────────────────────
  if (bleStatus === 'scanning' || bleStatus === 'connecting' || bleStatus === 'requesting_permission') {
    return (
      <View style={styles.centered}>
        <Text style={styles.titleText}>
          {bleStatus === 'scanning'    ? 'Searching for device…'  :
           bleStatus === 'connecting'  ? 'Connecting…'            :
                                         'Requesting permission…'}
        </Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={stopScan}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Error screen ───────────────────────────────────────────────────────────
  if (bleStatus === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.titleText}>Connection Error</Text>
        <Text style={styles.subtitleText}>{error ?? 'Unknown error'}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={startScan}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Disconnected banner (show on idle/disconnected before user taps Start) ─
  if (bleStatus === 'disconnected') {
    return (
      <View style={styles.centered}>
        <Text style={styles.titleText}>Device Disconnected</Text>
        <Text style={styles.subtitleText}>The flag device went out of range or was turned off.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={startScan}>
          <Text style={styles.primaryBtnText}>Reconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Aligned / done screen ──────────────────────────────────────────────────
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

  // ── Active scanning screen (connected) ────────────────────────────────────
  if (isScanning && isConnected) {
    return (
      <View style={styles.container}>
        <AlignmentOverlay
          status={alignmentStatus}
          distFeet={distFeet}
          screenWidth={0}
          screenHeight={0}
          corners={null}
          frameW={0}
          frameH={0}
        />
        <TouchableOpacity style={styles.cancelBtn} onPress={stopScan}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Idle screen ────────────────────────────────────────────────────────────
  return (
    <View style={styles.centered}>
      <Text style={styles.titleText}>Flag Finder</Text>
      <Text style={styles.subtitleText}>
        Stand sideways at the ball in your putting stance, phone pointed at the flag.{'\n\n'}
        Youll hear <Text style={styles.highlightText}>Rotate left</Text> or{' '}
        <Text style={styles.highlightText}>Rotate right.</Text>
        {'\n'}Shuffle your feet until you hear{' '}
        <Text style={styles.highlightText}>Centered</Text>.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={startScan}>
        <Text style={styles.primaryBtnText}>Start</Text>
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
  highlightText: {
    color: '#ffffff',
    fontWeight: '600',
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
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
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