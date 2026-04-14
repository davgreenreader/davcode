import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useBLE, TagData } from '@/hooks/use-ble';

// ─── Constants ────────────────────────────────────────────────────────────────
const SPEECH_INTERVAL_MS = 3000;  // Don't repeat the same cue within 3s
const CENTERED_HOLD_MS   = 2500;  // Hold CENTER this long to declare aligned

// ─── Direction → display / speech maps ───────────────────────────────────────
// Keys match what main.py sends via BLE (uppercase, after parseTagData trims)
const DISPLAY_TEXT: Record<string, string> = {
  'FAR LEFT':       'FAR LEFT',
  'LEFT':           'PIVOT LEFT',
  'SLIGHTLY LEFT':  'SLIGHTLY LEFT',
  '5 LEFT':         'SLIGHTLY LEFT',
  'CENTER':         'CENTERED',
  '5 RIGHT':        'SLIGHTLY RIGHT',
  'SLIGHTLY RIGHT': 'SLIGHTLY RIGHT',
  'RIGHT':          'PIVOT RIGHT',
  'FAR RIGHT':      'FAR RIGHT',
};

const SPEECH_CUE: Record<string, string> = {
  'FAR LEFT':       'Move far left',
  'LEFT':           'Pivot left',
  'SLIGHTLY LEFT':  'Slightly left',
  '5 LEFT':         'Slightly left',
  'CENTER':         'Centered',
  '5 RIGHT':        'Slightly right',
  'SLIGHTLY RIGHT': 'Slightly right',
  'RIGHT':          'Pivot right',
  'FAR RIGHT':      'Move far right',
};

// Color per direction zone
function directionColor(direction: string): string {
  switch (direction) {
    case 'FAR LEFT':
    case 'FAR RIGHT':
      return '#ef5350'; // red
    case 'LEFT':
    case 'RIGHT':
      return '#ff9800'; // orange
    case 'SLIGHTLY LEFT':
    case 'SLIGHTLY RIGHT':
    case '5 LEFT':
    case '5 RIGHT':
      return '#ffeb3b'; // yellow
    case 'CENTER':
      return '#00e676'; // green
    default:
      return '#888888'; // grey (searching)
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AprilAlignScreen() {
  const { status, tagData, error, connect, disconnect } = useBLE();

  const lastSpokenStatus  = useRef<string | null>(null);
  const lastSpokenAt      = useRef(0);
  const centeredSince     = useRef<number | null>(null);
  const lastKnownTagData  = useRef<TagData | null>(null);

  const [isDone, setIsDone] = useState(false);

  const isNoTag = (d: string) => d === 'NO TAG' || d === 'NO_TAG';

  // ── Speech + centered-hold logic ──────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected' || !tagData) {
      centeredSince.current = null;
      return;
    }

    const { direction } = tagData;
    const now = Date.now();

    if (!isNoTag(direction)) {
      // Tag is visible — update last known
      lastKnownTagData.current = tagData;

      // Centered hold timer
      if (direction === 'CENTER') {
        if (centeredSince.current === null) {
          centeredSince.current = now;
        } else if (now - centeredSince.current >= CENTERED_HOLD_MS) {
          Speech.speak('Aligned! You are centered on the tag.', { rate: 0.9 });
          setIsDone(true);
          return;
        }
      } else {
        centeredSince.current = null;
      }
    }

    // Use last known direction for speech when tag is lost
    const effectiveDirection = isNoTag(direction)
      ? (lastKnownTagData.current?.direction ?? null)
      : direction;

    if (!effectiveDirection) return;

    // Speak on a pure time gate — first detection is instant (lastSpokenAt starts at 0)
    const cue = SPEECH_CUE[effectiveDirection] ?? '';
    if (cue && now - lastSpokenAt.current >= SPEECH_INTERVAL_MS) {
      Speech.speak(cue, { rate: 0.95 });
      lastSpokenAt.current     = now;
      lastSpokenStatus.current = effectiveDirection;
    }
  }, [tagData, status]);

  // ── Restart session ───────────────────────────────────────────────────────
  const restart = useCallback(() => {
    centeredSince.current    = null;
    lastSpokenAt.current     = 0;
    lastSpokenStatus.current = null;
    setIsDone(false);
    connect();
  }, [connect]);

  // ── Permission / idle screen ──────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>AprilAlign</Text>
        <Text style={styles.subtitle}>
          Connects to the Pi camera over Bluetooth and guides you into alignment
          with the AprilTag using audio cues.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={connect}>
          <Text style={styles.primaryBtnText}>Connect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Scanning / connecting screen ──────────────────────────────────────────
  if (status === 'scanning' || status === 'connecting') {
    const label = status === 'scanning' ? 'Scanning for Pi...' : 'Connecting...';
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f8ef7" style={{ marginBottom: 24 }} />
        <Text style={styles.statusLabel}>{label}</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={disconnect}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Error screen ──────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={connect}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Disconnected screen ───────────────────────────────────────────────────
  if (status === 'disconnected') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Disconnected</Text>
        <Text style={styles.subtitle}>The Pi connection was lost.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={connect}>
          <Text style={styles.primaryBtnText}>Reconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Aligned / done screen ─────────────────────────────────────────────────
  if (isDone) {
    return (
      <View style={styles.centered}>
        <Text style={styles.alignedText}>ALIGNED</Text>
        <Text style={styles.subtitle}>You are centered on the AprilTag.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={restart}>
          <Text style={styles.primaryBtnText}>Scan Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={disconnect}>
          <Text style={styles.secondaryBtnText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Connected / live screen ───────────────────────────────────────────────
  const rawDirection  = tagData?.direction ?? 'NO TAG';
  const tagLost       = isNoTag(rawDirection);
  const activeTagData = tagLost ? lastKnownTagData.current : tagData;
  const direction     = activeTagData?.direction ?? 'NO TAG';
  const color         = tagLost
    ? directionColor(direction) + '88'   // dim the color when tag is lost
    : directionColor(direction);
  const display = DISPLAY_TEXT[direction] ?? direction;

  const distLabel = activeTagData?.distance != null
    ? `${Math.round(activeTagData.distance)} cm`
    : null;

  return (
    <View style={styles.container}>
      {/* Status card */}
      <View style={[styles.statusCard, { borderColor: color }]}>
        <Text style={[styles.directionText, { color }]}>{display}</Text>
        {tagLost && (
          <Text style={styles.lastKnownLabel}>tag not visible — last known</Text>
        )}
        {distLabel && !tagLost && (
          <Text style={styles.distanceText}>{distLabel}</Text>
        )}
      </View>

      {/* Connection badge */}
      <View style={styles.connectedBadge}>
        <View style={styles.connectedDot} />
        <Text style={styles.connectedLabel}>Connected to PiDataServer</Text>
      </View>

      <TouchableOpacity style={styles.secondaryBtn} onPress={disconnect}>
        <Text style={styles.secondaryBtnText}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a1a',
    gap: 20,
    paddingHorizontal: 32,
  },
  title: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#111128',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  directionText: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  distanceText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
  },
  lastKnownLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00e676',
  },
  connectedLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  alignedText: {
    color: '#00e676',
    fontSize: 60,
    fontWeight: '800',
    letterSpacing: 4,
  },
  errorTitle: {
    color: '#ef5350',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: '#4f8ef7',
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
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 16,
  },
});
