import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Speech from 'expo-speech';

import { useGreenSpeed, GREEN_SPEED_MODIFIER } from '@/contexts/green-speed';

// ─── Calibration constants ────────────────────────────────────────────────────
// K_BREAK: inches per foot per degree of side slope (PGA/on-course calibrated)
const K_BREAK = 0.55;

// Zone caps — hard upper limits on aim offset to prevent sensor noise blowouts
// ≤6ft: scales linearly with distance (dist × 0.5) so a 2ft putt caps at 1",
//        a 4ft putt caps at 2", and a 6ft putt caps at 3" (just inside cup edge)
// 6–20ft: fixed 18" cap
const CAP_MID = 18.0; // 6–20ft
// 20+ft: lag zone — no aim cue, focus on pace

// Pitch modifier constants (applied to aimInches AFTER zone cap)
// Uphill: golfer uses more power → less break
// Downhill: lighter touch → more break
const PITCH_UP_FACTOR   = 0.07;  // reduces break per degree uphill
const PITCH_UP_FLOOR    = 0.65;  // max 35% reduction from pitch alone
const PITCH_DOWN_FACTOR = 0.12;  // increases break per degree downhill
const PITCH_DOWN_CEIL   = 1.65;  // max 65% increase from pitch alone

// Uphill cup cap: for significant uphill (>1°) golfer is hitting harder so
// cap the aim cue to 2 cups max — the extra power kills the break
const UPHILL_SIGNIFICANT_DEG = 1.0;
const UPHILL_CUP_CAP         = 2.0; // cups

// Power cue threshold (commented out — pace handled by golfer)
// const POWER_THRESHOLD = 0.10;
// const POWER_FACTOR = 0.045;

// Noise thresholds — readings below these are treated as flat/straight
const STRAIGHT_THRESHOLD = 0.5; // degrees
const FLAT_THRESHOLD     = 0.5; // degrees

// Lag zone threshold
const LAG_THRESHOLD = 20; // feet

// Cup diameter in inches (standard golf hole = 4.25")
const CUP_DIAMETER = 4.25;

// Samples to average — 30 × 100ms = 3 seconds (reduces sensor noise)
const SAMPLE_COUNT = 30;
// ─────────────────────────────────────────────────────────────────────────────

type ReadingResult = {
  aimInches: number;   // raw inches before cup conversion (kept for reference)
  aimCups: number;     // final aim cue in cups (post all adjustments + caps)
  aimDir: 'LEFT' | 'RIGHT' | null;
  breakDir: string;
  slopeDir: string;
  updownDegs: number;  // absolute pitch angle, used for uphill cap check
  powerCueFt: number | null;
  isLag: boolean;
  isShortPutt: boolean;
};

export default function GreenReader() {
  const { greenSpeed } = useGreenSpeed();

  const [rollAngle, setRollAngle] = useState(0);
  const [pitchAngle, setPitchAngle] = useState(0);
  const [distance, setDistance] = useState('10');
  const [status, setStatus] = useState('Place phone flat on green');
  const [isReading, setIsReading] = useState(false);
  const [hasReading, setHasReading] = useState(false);
  const [result, setResult] = useState<ReadingResult | null>(null);

  // =====================
  // READ SLOPE
  // =====================
  const readSlope = () => {
    setIsReading(true);
    setStatus('Reading... hold still (3 sec)');
    setHasReading(false);
    setResult(null);

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(data => {
      sumX += data.x;
      sumY += data.y;
      count++;

      if (count >= SAMPLE_COUNT) {
        subscription.remove();

        const avgRoll  = (sumX / SAMPLE_COUNT) * 90;
        const avgPitch = (sumY / SAMPLE_COUNT) * 90;

        setRollAngle(avgRoll);
        setPitchAngle(avgPitch);

        const r = processReading(avgRoll, avgPitch);
        setResult(r);
        speakReading(r);

        setStatus('Reading complete!');
        setIsReading(false);
        setHasReading(true);
      }
    });
  };

  // =====================
  // ALGORITHM
  // =====================
  const processReading = (roll: number, pitch: number): ReadingResult => {
    const dist        = parseFloat(distance) || 10;
    const sideDegs    = Math.abs(roll);
    const updownDegs  = Math.abs(pitch);
    const isLag       = dist > LAG_THRESHOLD;
    const speedMod    = GREEN_SPEED_MODIFIER[greenSpeed];

    // ── Break direction ──────────────────────────────────────────────────────
    // roll > 0 → slopes left-to-right → ball curves right → AIM LEFT
    // roll < 0 → slopes right-to-left → ball curves left  → AIM RIGHT
    let breakDir: string;
    if (sideDegs < STRAIGHT_THRESHOLD) breakDir = 'Straight';
    else if (roll > 0)                 breakDir = 'Left to Right';
    else                               breakDir = 'Right to Left';

    // ── Slope direction ──────────────────────────────────────────────────────
    // pitch > 0 → Downhill; pitch < 0 → Uphill
    let slopeDir: string;
    if (updownDegs < FLAT_THRESHOLD) slopeDir = 'Flat';
    else if (pitch > 0)              slopeDir = 'Downhill';
    else                             slopeDir = 'Uphill';

    // ── Aim offset ───────────────────────────────────────────────────────────
    let aimInches = 0;
    let aimCups   = 0;
    let aimDir: 'LEFT' | 'RIGHT' | null = null;

    if (!isLag && breakDir !== 'Straight') {
      // Step 1: Raw break
      const raw = dist * sideDegs * K_BREAK;

      // Step 2: Zone cap
      const cap    = dist <= 6 ? dist * 0.5 : CAP_MID;
      const capped = Math.min(raw, cap);

      // Step 3: Pitch modifier
      // Uphill → less break (more power used); Downhill → more break (lighter touch)
      let pitchMod = 1.0;
      if (slopeDir === 'Uphill') {
        pitchMod = Math.max(1.0 - updownDegs * PITCH_UP_FACTOR, PITCH_UP_FLOOR);
      } else if (slopeDir === 'Downhill') {
        pitchMod = Math.min(1.0 + updownDegs * PITCH_DOWN_FACTOR, PITCH_DOWN_CEIL);
      }

      aimInches = capped * pitchMod;

      // Step 4: Green speed modifier (slower → less break; faster → more break)
      const speedAdjusted = aimInches * speedMod;

      // Step 5: Convert to cups
      aimCups = speedAdjusted / CUP_DIAMETER;

      // Step 6: Uphill cap — significant uphill means golfer is hitting harder,
      // so cap aim cue at UPHILL_CUP_CAP regardless of other factors
      if (slopeDir === 'Uphill' && updownDegs > UPHILL_SIGNIFICANT_DEG) {
        aimCups = Math.min(aimCups, UPHILL_CUP_CAP);
      }

      // Left-to-Right break → aim LEFT; Right-to-Left break → aim RIGHT
      aimDir = breakDir === 'Left to Right' ? 'LEFT' : 'RIGHT';
    }

    // ── Power cue (commented out — pace handled by golfer) ───────────────────
    // const effectiveDist = Math.round(dist - pitch * dist * POWER_FACTOR);
    // const diffPct = Math.abs(effectiveDist - dist) / dist;
    // const powerCueFt = diffPct >= POWER_THRESHOLD ? effectiveDist : null;
    const powerCueFt = null;

    return {
      aimInches,
      aimCups,
      aimDir,
      breakDir,
      slopeDir,
      updownDegs,
      powerCueFt,
      isLag,
      isShortPutt: dist <= 6,
    };
  };

  // =====================
  // SPEECH
  // =====================
  const speakReading = (r: ReadingResult) => {
    const parts: string[] = [];

    // 1. Slope — always spoken, including Flat
    parts.push(`${r.slopeDir}.`);

    // 2. Break direction + aim cue in cups
    if (r.isLag || r.breakDir === 'Straight') {
      parts.push('Straight putt.');
    } else {
      // State which way the ball breaks
      parts.push(`${r.breakDir}.`);

      // Aim cue in cups (1 cup = 4.25")
      const dir = r.aimDir === 'LEFT' ? 'left' : 'right';
      if (r.aimCups < 0.4) {
        parts.push('Play it straight.');
      } else {
        const cupsRounded = Math.round(r.aimCups * 2) / 2; // nearest 0.5
        let cupsStr: string;
        if (cupsRounded === 0.5)      cupsStr = 'half a cup';
        else if (cupsRounded === 1.0) cupsStr = 'one cup';
        else                          cupsStr = `${cupsRounded} cups`;
        parts.push(`Aim ${cupsStr} ${dir}.`);
      }
    }

    // Power cue (commented out)
    // if (r.powerCueFt !== null) {
    //   parts.push(`Treat as a ${r.powerCueFt} foot putt.`);
    // }

    Speech.speak(parts.join(' '), { language: 'en', pitch: 1.0, rate: 0.85 });
  };

  const speakAgain = () => {
    if (result) speakReading(result);
  };

  // =====================
  // RESET
  // =====================
  const resetAll = () => {
    setRollAngle(0);
    setPitchAngle(0);
    setResult(null);
    setStatus('Place phone flat on green');
    setHasReading(false);
  };

  // =====================
  // RENDER HELPERS
  // =====================
  const renderResult = () => {
    if (!hasReading || !result) {
      return <Text style={styles.placeholderText}>Read the green to see your line</Text>;
    }

    // Primary aim cue
    const aimText =
      result.breakDir === 'Straight' || result.isLag
        ? 'STRAIGHT'
        : `AIM ${result.aimDir}`;

    // Secondary info: always show slope (including Flat) + break direction if not straight
    const subParts: string[] = [];
    subParts.push(result.slopeDir); // Flat, Uphill, or Downhill — always shown
    if (result.breakDir !== 'Straight') subParts.push(result.breakDir);
    const subText = subParts.join(' · ');

    // Commented out — aimInches kept for reference / future debugging
    // const aimInchesDisplay = `${result.aimInches.toFixed(1)}"`;

    return (
      <>
        <Text style={styles.aimText}>{aimText}</Text>
        <Text style={styles.breakSub}>{subText}</Text>
      </>
    );
  };

  // Green speed indicator label
  const speedLabel = { SLOW: 'SLOW', NORMAL: 'NORMAL', FAST: 'FAST' }[greenSpeed];
  const speedColor = { SLOW: '#4488ff', NORMAL: '#FFD700', FAST: '#ff6644' }[greenSpeed];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>GREEN READER</Text>

      {/* INPUT + READ */}
      <View style={styles.phaseBox}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Distance (ft):</Text>
          <TextInput
            style={styles.textInput}
            value={distance}
            onChangeText={setDistance}
            keyboardType="numeric"
            accessibilityLabel="Distance in feet"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.readButton]}
          onPress={readSlope}
          disabled={isReading}
          accessibilityLabel="Read Slope"
        >
          <Text style={styles.buttonText}>
            {isReading ? 'READING...' : '📐 READ SLOPE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* RESULT */}
      <View style={styles.resultBox}>
        <View style={styles.resultContent}>
          {renderResult()}
        </View>
        {/* Green speed badge — bottom-left of result box */}
        <View style={styles.speedBadge}>
          <Text style={[styles.speedBadgeText, { color: speedColor }]}>Green Speed: {speedLabel}</Text>
        </View>
      </View>

      {/* POWER CUE — commented out */}
      {/* {hasReading && result?.powerCueFt !== null && result?.powerCueFt !== undefined && (
        <View style={styles.powerBox}>
          <Text style={styles.powerLabel}>PACE</Text>
          <Text style={styles.powerValue}>
            Treat as a {result.powerCueFt} ft putt
          </Text>
        </View>
      )} */}

      {/* RAW DEBUG */}
      <Text style={styles.rawText}>
        Roll: {rollAngle.toFixed(2)}° | Pitch: {pitchAngle.toFixed(2)}°
      </Text>

      {/* CONTROLS */}
      <TouchableOpacity
        style={[styles.button, styles.speakButton, !hasReading && styles.buttonDisabled]}
        onPress={speakAgain}
        disabled={!hasReading}
        accessibilityLabel="Speak Read"
      >
        <Text style={styles.buttonText}>🔊 SPEAK READ</Text>
      </TouchableOpacity>

      <Text style={styles.statusText}>{status}</Text>

      <TouchableOpacity
        style={[styles.button, styles.resetButton]}
        onPress={resetAll}
        accessibilityLabel="Reset All"
      >
        <Text style={styles.buttonText}>↺ RESET</Text>
      </TouchableOpacity>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 15,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 2,
  },
  phaseBox: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333333',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 38, // extra bottom room for the speed badge
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  resultContent: {
    alignItems: 'center',
  },
  speedBadge: {
    position: 'absolute',
    bottom: 10,
    left: 14,
  },
  speedBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
    fontStyle: 'italic',
  },
  // Primary aim cue — slightly reduced from 72 so STRAIGHT fits on one line
  aimText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#FFD700',
    lineHeight: 68,
    textAlign: 'center',
  },
  breakSub: {
    fontSize: 22,
    color: '#ffffff',
    marginTop: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Power cue styles — kept for re-enabling later
  powerBox: {
    backgroundColor: '#1a1a00',
    borderRadius: 12,
    padding: 22,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  powerLabel: {
    fontSize: 13,
    color: '#FFD700',
    marginBottom: 4,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  powerValue: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  rawText: {
    fontSize: 13,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 6,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  readButton: {
    backgroundColor: '#cc0000',
  },
  speakButton: {
    backgroundColor: '#006600',
  },
  resetButton: {
    backgroundColor: '#333333',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginVertical: 8,
  },
});
