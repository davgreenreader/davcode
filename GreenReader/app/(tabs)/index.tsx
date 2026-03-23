import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Vibration,
  Platform,
} from 'react-native';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import * as Speech from 'expo-speech';

export default function GreenReader() {
  // =====================
  // SLOPE READING STATE
  // =====================
  const [rollAngle, setRollAngle] = useState(0);
  const [pitchAngle, setPitchAngle] = useState(0);
  const [distance, setDistance] = useState('10');
  const [status, setStatus] = useState('Place phone flat on green');
  const [isReading, setIsReading] = useState(false);

  // Terrain results
  const [terrainInfo, setTerrainInfo] = useState('--');
  const [breakDirection, setBreakDirection] = useState('--');
  const [slopeDirection, setSlopeDirection] = useState('--');
  const [hasReading, setHasReading] = useState(false);

  // =====================
  // COMPASS/ALIGNMENT STATE
  // =====================
  const [currentHeading, setCurrentHeading] = useState(0);
  const [targetHeading, setTargetHeading] = useState<number | null>(null);
  const [isAligning, setIsAligning] = useState(false);
  const [alignmentStatus, setAlignmentStatus] = useState('--');
  const [isCurrentlyAligned, setIsCurrentlyAligned] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Refs for tracking state in listeners
  const magnetometerSubscription = useRef<any>(null);
  const vibrationInterval = useRef<any>(null);
  const alignedStartTimeRef = useRef<number | null>(null);
  const isCurrentlyAlignedRef = useRef(false);
  const isLockedRef = useRef(false);
  const targetHeadingRef = useRef<number | null>(null);

  // Constants
  const ALIGNMENT_THRESHOLD = 2; // degrees
  const HOLD_TIME = 1500; // ms to hold alignment before "locked"

  // =====================
  // VIBRATION HELPERS
  // =====================
  const startContinuousVibration = () => {
    stopContinuousVibration();

    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 200, 100], true);
    } else {
      Vibration.vibrate(200);
      vibrationInterval.current = setInterval(() => {
        Vibration.vibrate(200);
      }, 300);
    }
  };

  const stopContinuousVibration = () => {
    Vibration.cancel();
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
      vibrationInterval.current = null;
    }
  };

  // =====================
  // COMPASS HELPERS
  // =====================
  const calculateHeading = (magnetometerData: { x: number; y: number; z: number }) => {
    const { x, y } = magnetometerData;
    let heading = Math.atan2(y, x) * (180 / Math.PI);
    if (heading < 0) heading += 360;
    return heading;
  };

  const normalizeAngleDiff = (diff: number) => {
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  };

  // =====================
  // READ SLOPE
  // =====================
  const readSlope = () => {
    setIsReading(true);
    setStatus('Reading... hold still');
    setHasReading(false);

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(data => {
      sumX += data.x;
      sumY += data.y;
      count++;

      if (count >= 10) {
        subscription.remove();

        const avgRoll = (sumX / 10) * 90;
        const avgPitch = (sumY / 10) * 90;

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

    let breakDir = '';
    if (roll > 1) {
      breakDir = 'Left to Right';
    } else if (roll < -1) {
      breakDir = 'Right to Left';
    } else {
      breakDir = 'Straight';
    }
    setBreakDirection(breakDir);

    let slopeDir = '';
    if (pitch > 1) {
      slopeDir = 'Downhill';
    } else if (pitch < -1) {
      slopeDir = 'Uphill';
    } else {
      slopeDir = 'Flat';
    }
    setSlopeDirection(slopeDir);

    setTerrainInfo(`${Math.round(dist)} feet`);
    speakTerrain(dist, slopeDir, breakDir);
  };

  // =====================
  // SET TARGET HEADING
  // =====================
  const setTarget = () => {
    const heading = currentHeading;
    setTargetHeading(heading);
    targetHeadingRef.current = heading;
    setAlignmentStatus('Sweep slowly to find target');
    setIsLocked(false);
    isLockedRef.current = false;
    alignedStartTimeRef.current = null;

    Speech.speak(
      'Target locked. Slowly sweep left and right. You will feel vibration when aligned.',
      { language: 'en', rate: 0.85 }
    );

    Vibration.vibrate(300);
  };

  // =====================
  // START/STOP ALIGNMENT
  // =====================
  const startAlignment = () => {
    setIsAligning(true);
    setIsCurrentlyAligned(false);
    isCurrentlyAlignedRef.current = false;
    setIsLocked(false);
    isLockedRef.current = false;
    alignedStartTimeRef.current = null;
    setAlignmentStatus('Point at hole, then SET TARGET');

    Magnetometer.setUpdateInterval(50);

    magnetometerSubscription.current = Magnetometer.addListener(data => {
      const heading = calculateHeading(data);
      setCurrentHeading(heading);

      const target = targetHeadingRef.current;
      if (target !== null && !isLockedRef.current) {
        const diff = normalizeAngleDiff(heading - target);
        const absDiff = Math.abs(diff);
        const nowAligned = absDiff <= ALIGNMENT_THRESHOLD;

        // Entered alignment zone
        if (nowAligned && !isCurrentlyAlignedRef.current) {
          isCurrentlyAlignedRef.current = true;
          setIsCurrentlyAligned(true);
          alignedStartTimeRef.current = Date.now();
          setAlignmentStatus('ALIGNED - Hold still!');
          startContinuousVibration();
          Speech.speak('Aligned', { language: 'en', rate: 1.0 });
        }

        // Left alignment zone
        if (!nowAligned && isCurrentlyAlignedRef.current) {
          isCurrentlyAlignedRef.current = false;
          setIsCurrentlyAligned(false);
          alignedStartTimeRef.current = null;
          setAlignmentStatus('Sweep slowly to find target');
          stopContinuousVibration();
        }

        // Check if held long enough
        if (nowAligned && alignedStartTimeRef.current) {
          const heldTime = Date.now() - alignedStartTimeRef.current;
          if (heldTime >= HOLD_TIME) {
            isLockedRef.current = true;
            setIsLocked(true);
            stopContinuousVibration();
            setAlignmentStatus('READY TO PUTT');

            Vibration.vibrate([0, 100, 100, 100, 100, 300]);
            Speech.speak('Aligned. Ready to putt.', { language: 'en', rate: 0.85 });
          }
        }
      }
    });

    Speech.speak('Alignment started. Point phone at the hole and tap Set Target.', {
      language: 'en',
      rate: 0.85,
    });
  };

  const stopAlignment = () => {
    setIsAligning(false);
    setTargetHeading(null);
    targetHeadingRef.current = null;
    setAlignmentStatus('--');
    setIsCurrentlyAligned(false);
    isCurrentlyAlignedRef.current = false;
    setIsLocked(false);
    isLockedRef.current = false;
    alignedStartTimeRef.current = null;

    stopContinuousVibration();

    if (magnetometerSubscription.current) {
      magnetometerSubscription.current.remove();
      magnetometerSubscription.current = null;
    }
  };

  const resetAlignment = () => {
    setIsLocked(false);
    isLockedRef.current = false;
    setIsCurrentlyAligned(false);
    isCurrentlyAlignedRef.current = false;
    alignedStartTimeRef.current = null;
    setAlignmentStatus('Sweep slowly to find target');
    stopContinuousVibration();

    Speech.speak('Reset. Sweep again to align.', { language: 'en', rate: 0.9 });
  };

  // =====================
  // SPEECH
  // =====================
  const speakTerrain = (dist: number, slope: string, breakDir: string) => {
    let speech = `${Math.round(dist)} foot putt.`;
    if (slope !== 'Flat') speech += ` ${slope}.`;
    if (breakDir !== 'Straight') speech += ` ${breakDir}.`;
    if (slope === 'Flat' && breakDir === 'Straight') speech += ' Flat and straight.';

    Speech.speak(speech, { language: 'en', pitch: 1.0, rate: 0.85 });
  };

  const speakAgain = () => {
    const dist = parseFloat(distance) || 10;
    speakTerrain(dist, slopeDirection, breakDirection);
  };

  // =====================
  // RESET ALL
  // =====================
  const resetAll = () => {
    stopAlignment();
    setRollAngle(0);
    setPitchAngle(0);
    setTerrainInfo('--');
    setBreakDirection('--');
    setSlopeDirection('--');
    setStatus('Place phone flat on green');
    setHasReading(false);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopContinuousVibration();
      if (magnetometerSubscription.current) {
        magnetometerSubscription.current.remove();
      }
    };
  }, []);

  // =====================
  // RENDER
  // =====================
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>GREEN READER</Text>

      {/* PHASE 1: READ SLOPE */}
      <View style={styles.phaseBox}>
        <Text style={styles.phaseTitle}>STEP 1: READ THE GREEN</Text>

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

        <View style={styles.resultsRow}>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>BREAK</Text>
            <Text style={styles.resultValue}>{breakDirection}</Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>ELEVATION</Text>
            <Text style={styles.resultValue}>{slopeDirection}</Text>
          </View>
        </View>

        <Text style={styles.rawText}>
          Roll: {rollAngle.toFixed(1)}° | Pitch: {pitchAngle.toFixed(1)}°
        </Text>
      </View>

      {/* PHASE 2: ALIGNMENT */}
      <View style={[styles.phaseBox, styles.alignmentPhase]}>
        <Text style={styles.phaseTitle}>STEP 2: ALIGN YOUR PUTT</Text>

        {!isAligning ? (
          <TouchableOpacity
            style={[styles.button, styles.alignButton]}
            onPress={startAlignment}
            accessibilityLabel="Start Alignment"
          >
            <Text style={styles.buttonText}>🧭 START ALIGNMENT</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={styles.compassDisplay}>
              <Text style={styles.compassLabel}>CURRENT HEADING</Text>
              <Text style={styles.compassValue}>{Math.round(currentHeading)}°</Text>
            </View>

            {targetHeading === null ? (
              <TouchableOpacity
                style={[styles.button, styles.setTargetButton]}
                onPress={setTarget}
                accessibilityLabel="Set Target"
              >
                <Text style={styles.buttonText}>🎯 SET TARGET</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <View style={styles.targetDisplay}>
                  <Text style={styles.targetLabel}>TARGET</Text>
                  <Text style={styles.targetValue}>{Math.round(targetHeading)}°</Text>
                </View>

                <View
                  style={[
                    styles.alignmentStatusBox,
                    isCurrentlyAligned && styles.alignedBox,
                    isLocked && styles.lockedBox,
                  ]}
                >
                  <Text style={styles.alignmentStatusText}>{alignmentStatus}</Text>
                  {isCurrentlyAligned && !isLocked && (
                    <Text style={styles.holdText}>Hold still...</Text>
                  )}
                  {isLocked && <Text style={styles.readyText}>✓ LOCKED IN</Text>}
                </View>

                <View style={styles.sweepIndicator}>
                  <View style={styles.sweepTrack}>
                    <View style={styles.targetZone} />
                    <View
                      style={[
                        styles.currentIndicator,
                        isCurrentlyAligned && styles.currentIndicatorAligned,
                        {
                          left: `${50 + Math.max(-45, Math.min(45, normalizeAngleDiff(currentHeading - targetHeading) * 1.5))}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.sweepHint}>
                    {isLocked
                      ? '✓ Aligned and ready!'
                      : isCurrentlyAligned
                      ? 'Hold position...'
                      : '← Sweep slowly →'}
                  </Text>
                </View>

                {isLocked && (
                  <TouchableOpacity
                    style={[styles.button, styles.realignButton]}
                    onPress={resetAlignment}
                    accessibilityLabel="Re-align"
                  >
                    <Text style={styles.buttonText}>↻ RE-ALIGN</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopAlignment}
              accessibilityLabel="Stop Alignment"
            >
              <Text style={styles.buttonText}>⏹ STOP</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.instructionText}>
          {!isAligning
            ? 'Tap to start compass alignment'
            : targetHeading === null
            ? 'Point phone at the hole, then tap SET TARGET'
            : isLocked
            ? 'You are aligned! Take your putt.'
            : 'Slowly sweep left and right until you feel vibration'}
        </Text>
      </View>

      {/* BOTTOM CONTROLS */}
      <TouchableOpacity
        style={[styles.button, styles.speakButton, !hasReading && styles.buttonDisabled]}
        onPress={speakAgain}
        disabled={!hasReading}
        accessibilityLabel="Speak Terrain"
      >
        <Text style={styles.buttonText}>🔊 SPEAK TERRAIN</Text>
      </TouchableOpacity>

      <Text style={styles.statusText}>{status}</Text>

      <TouchableOpacity
        style={[styles.button, styles.resetButton]}
        onPress={resetAll}
        accessibilityLabel="Reset All"
      >
        <Text style={styles.buttonText}>↺ RESET ALL</Text>
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
  alignmentPhase: {
    borderWidth: 2,
    borderColor: '#7b2cbf',
  },
  phaseTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 12,
    textAlign: 'center',
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
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  resultItem: {
    alignItems: 'center',
    flex: 1,
  },
  resultLabel: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  rawText: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    marginTop: 10,
  },
  compassDisplay: {
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  compassLabel: {
    fontSize: 11,
    color: '#888888',
  },
  compassValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  targetDisplay: {
    backgroundColor: '#1b4332',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  targetLabel: {
    fontSize: 11,
    color: '#68a67d',
  },
  targetValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#95d5b2',
  },
  alignmentStatusBox: {
    backgroundColor: '#2d2d44',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: '#444466',
  },
  alignedBox: {
    backgroundColor: '#1b4332',
    borderColor: '#4CAF50',
  },
  lockedBox: {
    backgroundColor: '#0d5c2e',
    borderColor: '#00ff00',
  },
  alignmentStatusText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  holdText: {
    fontSize: 14,
    color: '#ffcc00',
    marginTop: 5,
  },
  readyText: {
    fontSize: 18,
    color: '#00ff00',
    fontWeight: 'bold',
    marginTop: 5,
  },
  sweepIndicator: {
    marginVertical: 15,
  },
  sweepTrack: {
    height: 40,
    backgroundColor: '#0f3460',
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  targetZone: {
    position: 'absolute',
    left: '45%',
    width: '10%',
    height: '100%',
    backgroundColor: 'rgba(76, 175, 80, 0.4)',
  },
  currentIndicator: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e94560',
    top: 8,
    marginLeft: -12,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  currentIndicatorAligned: {
    backgroundColor: '#4CAF50',
    width: 28,
    height: 28,
    borderRadius: 14,
    top: 6,
    marginLeft: -14,
  },
  sweepHint: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginTop: 8,
  },
  instructionText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 18,
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
  alignButton: {
    backgroundColor: '#7b2cbf',
  },
  setTargetButton: {
    backgroundColor: '#2196F3',
  },
  stopButton: {
    backgroundColor: '#666666',
  },
  realignButton: {
    backgroundColor: '#ff9800',
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