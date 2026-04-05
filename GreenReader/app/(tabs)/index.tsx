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

// ─── Calibration constants ────────────────────────────────────────────────────
// K_BREAK: inches per foot per degree of side slope (PGA/on-course calibrated)
const K_BREAK = 0.55;

// Zone caps — hard upper limits on aim offset to prevent sensor noise blowouts
// ≤6ft: scales linearly with distance (dist × 0.5) so a 2ft putt caps at 1",
//        a 4ft putt caps at 2", and a 6ft putt caps at 3" (just inside cup edge)
// 6–20ft: fixed 18" cap
// Green speed setting (slow/medium/fast) will scale these in a future update
const CAP_MID = 18.0; // 6–20ft
// 20+ft: no aim inches output (lag zone — pace is the priority)

// Pitch modifier constants (applied to aim offset AFTER zone cap)
// Uphill: ball moves faster through break zone → less break
// Downhill: ball slows sooner → more break
const PITCH_UP_FACTOR   = 0.07;  // reduces break per degree uphill
const PITCH_UP_FLOOR    = 0.65;  // max 35% reduction
const PITCH_DOWN_FACTOR = 0.12;  // increases break per degree downhill
const PITCH_DOWN_CEIL   = 1.65;  // max 65% increase

// Power cue: only announce when effective distance differs by ≥10%
const POWER_THRESHOLD = 0.10;
// Formula: effective_dist = dist + (pitch_deg × dist × 0.045)
// Positive pitch = uphill → adds distance; negative pitch = downhill → subtracts
const POWER_FACTOR = 0.045;

// Noise thresholds — readings below these are treated as flat/straight
const STRAIGHT_THRESHOLD = 0.5; // degrees
const FLAT_THRESHOLD     = 0.5; // degrees

// Lag zone threshold
const LAG_THRESHOLD = 20; // feet

// Samples to average — 30 × 100ms = 3 seconds (reduces sensor noise)
const SAMPLE_COUNT = 30;
// ─────────────────────────────────────────────────────────────────────────────

type ReadingResult = {
  aimInches: number;
  aimDir: 'LEFT' | 'RIGHT' | null;
  breakDir: string;
  slopeDir: string;
  powerCueFt: number | null;
  isLag: boolean;
  isShortPutt: boolean; // ≤6ft — use "lean" language
};

export default function GreenReader() {
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
        speakReading(r, parseFloat(distance) || 10);

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
    const dist = parseFloat(distance) || 10;
    const sideDegs   = Math.abs(roll);
    const updownDegs = Math.abs(pitch);
    const isLag      = dist > LAG_THRESHOLD;

    // ── Break direction ──────────────────────────────────────────────────────
    // roll > 0 → green slopes left-to-right → ball curves right → AIM LEFT
    // roll < 0 → green slopes right-to-left → ball curves left  → AIM RIGHT
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

    // ── Aim offset (short/mid range only) ───────────────────────────────────
    let aimInches = 0;
    let aimDir: 'LEFT' | 'RIGHT' | null = null;

    if (!isLag && breakDir !== 'Straight') {
      // Step 1: Raw break
      const raw = dist * sideDegs * K_BREAK;

      // Step 2: Zone cap (BEFORE pitch modifier)
      const cap    = dist <= 6 ? dist * 0.5 : CAP_MID;
      const capped = Math.min(raw, cap);

      // Step 3: Pitch modifier (applied AFTER cap so downhill can't exceed cap)
      let pitchMod = 1.0;
      if (slopeDir === 'Uphill') {
        pitchMod = Math.max(1.0 - updownDegs * PITCH_UP_FACTOR, PITCH_UP_FLOOR);
      } else if (slopeDir === 'Downhill') {
        pitchMod = Math.min(1.0 + updownDegs * PITCH_DOWN_FACTOR, PITCH_DOWN_CEIL);
      }

      aimInches = capped * pitchMod;
      aimDir    = breakDir === 'Left to Right' ? 'LEFT' : 'RIGHT';
    }

    // ── Power cue ────────────────────────────────────────────────────────────
    // effective_dist = dist + (pitch_deg × dist × POWER_FACTOR)
    // positive pitch (uphill) adds distance; negative (downhill) subtracts
    const effectiveDist = Math.round(dist - pitch * dist * POWER_FACTOR);
    const diffPct       = Math.abs(effectiveDist - dist) / dist;
    const powerCueFt    = diffPct >= POWER_THRESHOLD ? effectiveDist : null;

    return { aimInches, aimDir, breakDir, slopeDir, powerCueFt, isLag, isShortPutt: dist <= 6 };
  };

  // =====================
  // SPEECH
  // =====================
  const speakReading = (r: ReadingResult, dist: number) => {
    const parts: string[] = [];

    // 1. Distance
    parts.push(`${Math.round(dist)} foot putt.`);

    // 2. Uphill / downhill (skip if flat)
    if (r.slopeDir !== 'Flat') {
      parts.push(`${r.slopeDir}.`);
    }

    // 3. Break direction + 4. Aim point
    if (r.isLag) {
      parts.push('Straight putt. Focus on pace.');
    } else if (r.breakDir === 'Straight') {
      parts.push('Straight putt.');
    } else {
      const dir = r.aimDir === 'LEFT' ? 'left' : 'right';
      parts.push(`Breaking ${dir}.`);
      if (r.isShortPutt) {
        parts.push(r.aimInches < 1
          ? `Barely lean ${dir}.`
          : `Lean about ${r.aimInches.toFixed(1)} inches ${dir}.`);
      } else {
        parts.push(`Aim ${r.aimInches.toFixed(1)} inches ${dir} of the cup.`);
      }
    }

    // 5. Power cue (if triggered)
    if (r.powerCueFt !== null) {
      parts.push(`Treat as a ${r.powerCueFt} foot putt.`);
    }

    Speech.speak(parts.join(' '), { language: 'en', pitch: 1.0, rate: 0.85 });
  };

  const speakAgain = () => {
    if (result) speakReading(result, parseFloat(distance) || 10);
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

    if (result.isLag) {
      return (
        <>
          <Text style={styles.lagText}>STRAIGHT</Text>
          <Text style={styles.breakSub}>{result.slopeDir} · Focus on pace</Text>
        </>
      );
    }

    // Short / mid range — show aim inches
    if (result.breakDir === 'Straight') {
      return (
        <>
          <Text style={styles.breakInches}>STRAIGHT</Text>
          <Text style={styles.breakSub}>{result.slopeDir}</Text>
        </>
      );
    }

    const aimLabel = result.isShortPutt
      ? `LEAN ${result.aimDir}`
      : result.aimDir!;

    return (
      <>
        <Text style={styles.breakInches}>{result.aimInches.toFixed(1)}"</Text>
        <Text style={styles.aimLabel}>{aimLabel}</Text>
        <Text style={styles.breakSub}>
          {result.slopeDir} · {result.breakDir}
        </Text>
      </>
    );
  };

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
        {renderResult()}
      </View>

      {/* POWER CUE */}
      {hasReading && result?.powerCueFt !== null && result?.powerCueFt !== undefined && (
        <View style={styles.powerBox}>
          <Text style={styles.powerLabel}>PACE</Text>
          <Text style={styles.powerValue}>
            Treat as a {result.powerCueFt} ft putt
          </Text>
        </View>
      )}

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
    padding: 28,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
    fontStyle: 'italic',
  },
  // Lag zone STRAIGHT — smaller to fit on one line
  lagText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    lineHeight: 56,
  },
  // Short/mid range — bright yellow for sunlight readability
  breakInches: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#FFD700',
    lineHeight: 80,
  },
  aimLabel: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  breakSub: {
    fontSize: 16,
    color: '#aaaaaa',
    marginTop: 10,
    fontWeight: '600',
  },
  // Power cue — high contrast yellow-on-dark
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
    fontSize: 11,
    color: '#333355',
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
