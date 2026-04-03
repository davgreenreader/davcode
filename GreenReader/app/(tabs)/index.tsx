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
// K_BREAK: inches of break per foot of putt per degree of side slope (stimp 9.5)
// Derived from: 9ft putt, 0.687° side (=1.2%), 0.401° uphill → 5.8" (competitor)
const K_BREAK = 1.05;

// K_GRADE: how much one degree of up/downhill modifies break
// Uphill putts break less (ball faster through zone); downhill putts break more
const K_GRADE = 0.26;

// K_POWER: divisor for effective-distance formula (degrees)
// Derived from: 0.401° uphill → 113% pace → k = 0.401 / 0.13 = 3.085
const K_POWER = 3.085;

// Experts: play 0.75° more break on downhill to allow ball to die in hole
const DOWNHILL_BREAK_BONUS = 0.75;

// Threshold below which side slope is called "Straight" (phone noise floor)
const STRAIGHT_THRESHOLD = 0.5; // degrees
const FLAT_THRESHOLD = 0.5;     // degrees

// Samples to average — 30 × 100 ms = 3 seconds (reduces sensor noise)
const SAMPLE_COUNT = 30;
// ─────────────────────────────────────────────────────────────────────────────

export default function GreenReader() {
  const [rollAngle, setRollAngle] = useState(0);
  const [pitchAngle, setPitchAngle] = useState(0);
  const [distance, setDistance] = useState('10');
  const [status, setStatus] = useState('Place phone flat on green');
  const [isReading, setIsReading] = useState(false);
  const [hasReading, setHasReading] = useState(false);

  const [breakDirection, setBreakDirection] = useState('--');
  const [slopeDirection, setSlopeDirection] = useState('--');
  const [breakInches, setBreakInches] = useState(0);
  const [effectiveDistance, setEffectiveDistance] = useState(0);

  // =====================
  // READ SLOPE
  // =====================
  const readSlope = () => {
    setIsReading(true);
    setStatus('Reading... hold still (3 sec)');
    setHasReading(false);

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

        const avgRoll = (sumX / SAMPLE_COUNT) * 90;
        const avgPitch = (sumY / SAMPLE_COUNT) * 90;

        setRollAngle(avgRoll);
        setPitchAngle(avgPitch);
        processReading(avgRoll, avgPitch);

        setStatus('Reading complete!');
        setIsReading(false);
        setHasReading(true);
      }
    });
  };

  const processReading = (roll: number, pitch: number) => {
    const dist = parseFloat(distance) || 10;

    // Raw angle magnitudes in degrees
    const sideDegs = Math.abs(roll);
    const updownDegs = Math.abs(pitch);

    // ── Directions ──────────────────────────────────────────────────────────
    // roll > 0 → green tilts left-to-right → ball breaks right → AIM LEFT
    // roll < 0 → green tilts right-to-left → ball breaks left  → AIM RIGHT
    let breakDir: string;
    if (sideDegs < STRAIGHT_THRESHOLD) breakDir = 'Straight';
    else if (roll > 0) breakDir = 'Left to Right'; // ball curves right
    else breakDir = 'Right to Left';               // ball curves left

    // pitch > 0 → Downhill  (negative y-accel when top of phone is low)
    // pitch < 0 → Uphill
    let slopeDir: string;
    if (updownDegs < FLAT_THRESHOLD) slopeDir = 'Flat';
    else if (pitch > 0) slopeDir = 'Downhill';
    else slopeDir = 'Uphill';

    // ── Break calculation ────────────────────────────────────────────────────
    // Downhill experts tip: play 0.75° more break so ball dies in the hole
    const effectiveSideDegs =
      slopeDir === 'Downhill' ? sideDegs + DOWNHILL_BREAK_BONUS : sideDegs;

    // Grade factor: uphill → less break, downhill → more break
    let gradeFactor = 1;
    if (slopeDir === 'Uphill') {
      gradeFactor = 1 / (1 + K_GRADE * updownDegs);
    } else if (slopeDir === 'Downhill') {
      gradeFactor = 1 + K_GRADE * updownDegs;
    }

    const calcBreakInches =
      breakDir === 'Straight' ? 0 : dist * effectiveSideDegs * K_BREAK * gradeFactor;

    // ── Effective distance for power ─────────────────────────────────────────
    // Uphill needs more pace; downhill needs less. Clamped to sane range.
    let effectiveDist = dist;
    if (slopeDir === 'Uphill') {
      effectiveDist = dist * (1 + updownDegs / K_POWER);
    } else if (slopeDir === 'Downhill') {
      effectiveDist = dist * (1 - updownDegs / K_POWER);
    }
    // Clamp: at minimum 25% of distance, at maximum 350%
    effectiveDist = Math.max(dist * 0.25, Math.min(dist * 3.5, effectiveDist));

    setBreakDirection(breakDir);
    setSlopeDirection(slopeDir);
    setBreakInches(calcBreakInches);
    setEffectiveDistance(effectiveDist);

    speakReading(dist, slopeDir, breakDir, calcBreakInches, effectiveDist);
  };

  // =====================
  // SPEECH
  // =====================
  const speakReading = (
    dist: number,
    slope: string,
    breakDir: string,
    breakIn: number,
    effectiveDist: number
  ) => {
    let speech = `${Math.round(dist)} foot putt.`;

    if (breakDir === 'Straight') {
      speech += ' Straight putt.';
    } else {
      // aim direction is opposite of break direction
      const aimDir = breakDir === 'Left to Right' ? 'left' : 'right';
      speech += ` Aim ${breakIn.toFixed(1)} inches ${aimDir}.`;
    }

    if (slope === 'Uphill' || slope === 'Downhill') {
      speech += ` ${slope}. Treat as a ${Math.round(effectiveDist)} foot putt for pace.`;
    }

    Speech.speak(speech, { language: 'en', pitch: 1.0, rate: 0.85 });
  };

  const speakAgain = () => {
    const dist = parseFloat(distance) || 10;
    speakReading(dist, slopeDirection, breakDirection, breakInches, effectiveDistance);
  };

  // =====================
  // RESET
  // =====================
  const resetAll = () => {
    setRollAngle(0);
    setPitchAngle(0);
    setBreakDirection('--');
    setSlopeDirection('--');
    setBreakInches(0);
    setEffectiveDistance(0);
    setStatus('Place phone flat on green');
    setHasReading(false);
  };

  // =====================
  // RENDER
  // =====================
  // Left-to-Right break → ball curves right → AIM LEFT
  // Right-to-Left break → ball curves left  → AIM RIGHT
  const aimLabel =
    breakDirection === 'Left to Right'
      ? 'LEFT'
      : breakDirection === 'Right to Left'
      ? 'RIGHT'
      : null;

  const showPower =
    hasReading && (slopeDirection === 'Uphill' || slopeDirection === 'Downhill');

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

      {/* BREAK RESULT */}
      <View style={styles.resultBox}>
        {!hasReading ? (
          <Text style={styles.placeholderText}>Read the green to see your line</Text>
        ) : aimLabel ? (
          <>
            <Text style={styles.breakInches}>{breakInches.toFixed(1)}"</Text>
            <Text style={styles.aimLabel}>{aimLabel}</Text>
            <Text style={styles.breakSub}>
              {slopeDirection} · {breakDirection}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.breakInches}>STRAIGHT</Text>
            <Text style={styles.breakSub}>{slopeDirection}</Text>
          </>
        )}
      </View>

      {/* POWER RECOMMENDATION */}
      {showPower && (
        <View style={styles.powerBox}>
          <Text style={styles.powerLabel}>PACE</Text>
          <Text style={styles.powerValue}>
            Treat as a {Math.round(effectiveDistance)} ft putt
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
    backgroundColor: '#1a1a2e',
    padding: 15,
    paddingTop: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 15,
  },
  phaseBox: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
    fontSize: 18,
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 24,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#555577',
    fontStyle: 'italic',
  },
  breakInches: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: 64,
  },
  aimLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e94560',
    marginTop: 4,
  },
  breakSub: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
  },
  powerBox: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  powerLabel: {
    fontSize: 12,
    color: '#6688aa',
    marginBottom: 4,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  powerValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  rawText: {
    fontSize: 11,
    color: '#444466',
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 6,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  readButton: {
    backgroundColor: '#e94560',
  },
  speakButton: {
    backgroundColor: '#4CAF50',
  },
  resetButton: {
    backgroundColor: '#555555',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statusText: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    marginVertical: 8,
  },
});
