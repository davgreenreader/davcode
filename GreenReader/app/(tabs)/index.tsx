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

export default function GreenReader() {
  // State variables
  const [rollAngle, setRollAngle] = useState(0);
  const [pitchAngle, setPitchAngle] = useState(0);
  const [distance, setDistance] = useState('10');
  const [status, setStatus] = useState('Place phone flat on green');
  const [isReading, setIsReading] = useState(false);

  // Results
  const [terrainInfo, setTerrainInfo] = useState('--');
  const [breakDirection, setBreakDirection] = useState('--');
  const [slopeDirection, setSlopeDirection] = useState('--');
  const [hasReading, setHasReading] = useState(false);

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

    // Determine break direction (left/right)
    let breakDir = '';
    if (roll > 1) {
      breakDir = 'Left to Right';
    } else if (roll < -1) {
      breakDir = 'Right to Left';
    } else {
      breakDir = 'Straight';
    }
    setBreakDirection(breakDir);

    // Determine slope direction (uphill/downhill)
    let slopeDir = '';
    if (pitch > 1) {
      slopeDir = 'Downhill';
    } else if (pitch < -1) {
      slopeDir = 'Uphill';
    } else {
      slopeDir = 'Flat';
    }
    setSlopeDirection(slopeDir);

    // Build terrain summary
    setTerrainInfo(`${Math.round(dist)} feet`);

    // Auto-speak result
    speakResult(dist, slopeDir, breakDir);
  };

  // =====================
  // SPEECH
  // =====================
  const speakResult = (dist: number, slope: string, breakDir: string) => {
    let speech = `${Math.round(dist)} foot putt.`;

    if (slope !== 'Flat') {
      speech += ` ${slope}.`;
    }

    if (breakDir !== 'Straight') {
      speech += ` ${breakDir}.`;
    }

    if (slope === 'Flat' && breakDir === 'Straight') {
      speech += ' Flat and straight.';
    }

    Speech.speak(speech, {
      language: 'en',
      pitch: 1.0,
      rate: 0.85,
    });
  };

  const speakAgain = () => {
    const dist = parseFloat(distance) || 10;
    speakResult(dist, slopeDirection, breakDirection);
  };

  // Reset
  const resetReadings = () => {
    setRollAngle(0);
    setPitchAngle(0);
    setTerrainInfo('--');
    setBreakDirection('--');
    setSlopeDirection('--');
    setStatus('Place phone flat on green');
    setHasReading(false);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>GREEN READER</Text>

      {/* Distance Input */}
      <View style={styles.inputSection}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Distance (ft):</Text>
          <TextInput
            style={styles.textInput}
            value={distance}
            onChangeText={setDistance}
            keyboardType="numeric"
            accessibilityLabel="Distance in feet"
            accessibilityHint="Enter the distance to the hole in feet"
          />
        </View>
      </View>

      {/* READ SLOPE Button */}
      <TouchableOpacity
        style={[styles.button, styles.readButton]}
        onPress={readSlope}
        disabled={isReading}
        accessibilityLabel="Read Slope"
        accessibilityHint="Place phone flat on green then tap to read slope"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {isReading ? 'READING...' : '📐 READ SLOPE'}
        </Text>
      </TouchableOpacity>

      {/* Results */}
      <View style={styles.resultsSection}>
        {/* Distance */}
        <View style={styles.resultBox}>
          <Text style={styles.boxLabel}>DISTANCE</Text>
          <Text style={styles.resultText}>{terrainInfo}</Text>
        </View>

        {/* Left/Right Break */}
        <View style={styles.resultBox}>
          <Text style={styles.boxLabel}>BREAK</Text>
          <Text style={styles.resultText}>{breakDirection}</Text>
          <Text style={styles.rawText}>Roll: {rollAngle.toFixed(1)}°</Text>
        </View>

        {/* Uphill/Downhill */}
        <View style={styles.resultBox}>
          <Text style={styles.boxLabel}>ELEVATION</Text>
          <Text style={styles.resultText}>{slopeDirection}</Text>
          <Text style={styles.rawText}>Pitch: {pitchAngle.toFixed(1)}°</Text>
        </View>
      </View>

      {/* Speak Button */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.speakButton,
          !hasReading && styles.buttonDisabled,
        ]}
        onPress={speakAgain}
        disabled={!hasReading}
        accessibilityLabel="Speak Result"
        accessibilityHint="Tap to hear the reading again"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>🔊 SPEAK AGAIN</Text>
      </TouchableOpacity>

      {/* Status */}
      <Text style={styles.statusText}>{status}</Text>

      {/* Reset */}
      <TouchableOpacity
        style={[styles.button, styles.resetButton]}
        onPress={resetReadings}
        accessibilityLabel="Reset"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>↺ RESET</Text>
      </TouchableOpacity>

      {/* Spacer */}
      <View style={{ height: 40 }} />
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputSection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 18,
    color: '#ffffff',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    fontSize: 20,
    textAlign: 'center',
  },
  resultsSection: {
    marginBottom: 15,
  },
  resultBox: {
    backgroundColor: '#16213e',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  boxLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 5,
    fontWeight: 'bold',
  },
  resultText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  rawText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 5,
  },
  button: {
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 8,
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
    backgroundColor: '#666666',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statusText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginVertical: 10,
  },
});