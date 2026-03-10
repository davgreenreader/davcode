import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Speech from 'expo-speech';

export default function GreenReader() {
  // Variables (same as your global variables in App Inventor)
  const [rollAngle, setRollAngle] = useState(0);
  const [pitchAngle, setPitchAngle] = useState(0);
  const [distance, setDistance] = useState('10');
  const [lblLeftRight, setLblLeftRight] = useState('Left/Right: --');
  const [lblUpDown, setLblUpDown] = useState('Up/Down: --');
  const [lblRead, setLblRead] = useState('Tap READ SLOPE to begin');
  const [status, setStatus] = useState('Place phone flat on green');
  const [isReading, setIsReading] = useState(false);

  // READ SLOPE button (same as btnReadSlope.Click)
  const readSlope = () => {
    setIsReading(true);
    setStatus('Reading... hold still');

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

        // Calculate averages and convert to degrees
        const avgRoll = (sumX / 10) * 90;
        const avgPitch = (sumY / 10) * 90;

        setRollAngle(avgRoll);
        setPitchAngle(avgPitch);

        updateDisplay(avgRoll, avgPitch);

        setStatus('Reading complete!');
        setIsReading(false);
      }
    });
  };

  // updateDisplay procedure (same as your App Inventor procedure)
  const updateDisplay = (roll: number, pitch: number) => {
    setLblLeftRight(`Left/Right: ${roll.toFixed(1)}°`);
    setLblUpDown(`Up/Down: ${pitch.toFixed(1)}°`);

    // Determine break direction
    let breakDirection = '';
    if (roll > 1) {
      breakDirection = 'Left to Right';
    } else if (roll < -1) {
      breakDirection = 'Right to Left';
    } else {
      breakDirection = 'Straight';
    }

    // Determine slope direction
    let slopeDirection = '';
    if (pitch > 1) {
      slopeDirection = 'Downhill';
    } else if (pitch < -1) {
      slopeDirection = 'Uphill';
    } else {
      slopeDirection = 'Flat';
    }

    setLblRead(`${breakDirection}, ${slopeDirection}`);
  };

  // SPEAK button (same as btnSpeak.Click)
  const speakResult = () => {
    const speechText = `${distance} foot putt. ${lblRead}`;
    Speech.speak(speechText, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  // Reset button
  const resetReadings = () => {
    setRollAngle(0);
    setPitchAngle(0);
    setLblLeftRight('Left/Right: --');
    setLblUpDown('Up/Down: --');
    setLblRead('Tap READ SLOPE to begin');
    setStatus('Place phone flat on green');
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>GREEN READER</Text>

      {/* Distance Input */}
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

      {/* Raw Values Display */}
      <View style={styles.dataBox}>
        <Text style={styles.dataText}>{lblLeftRight}</Text>
        <Text style={styles.dataText}>{lblUpDown}</Text>
      </View>

      {/* Combined Reading */}
      <View style={styles.readingBox}>
        <Text style={styles.readingLabel}>READING:</Text>
        <Text
          style={styles.readingText}
          accessibilityLabel={`Slope reading: ${lblRead}`}
          accessibilityRole="text"
        >
          {lblRead}
        </Text>
      </View>

      {/* SPEAK Button */}
      <TouchableOpacity
        style={[styles.button, styles.speakButton]}
        onPress={speakResult}
        accessibilityLabel="Speak Result"
        accessibilityHint="Tap to hear the slope reading aloud"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>🔊 SPEAK RESULT</Text>
      </TouchableOpacity>

      {/* Status Label */}
      <Text style={styles.statusText}>{status}</Text>

      {/* Reset Button */}
      <TouchableOpacity
        style={[styles.button, styles.backButton]}
        onPress={resetReadings}
        accessibilityLabel="Reset"
        accessibilityHint="Tap to reset the readings"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>← RESET</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#16213e',
    padding: 15,
    borderRadius: 10,
  },
  inputLabel: {
    fontSize: 18,
    color: '#ffffff',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 5,
    fontSize: 18,
    textAlign: 'center',
  },
  button: {
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 8,
  },
  readButton: {
    backgroundColor: '#e94560',
  },
  speakButton: {
    backgroundColor: '#4CAF50',
  },
  backButton: {
    backgroundColor: '#666666',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  dataBox: {
    backgroundColor: '#16213e',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  dataText: {
    fontSize: 18,
    color: '#ffffff',
    marginVertical: 5,
  },
  readingBox: {
    backgroundColor: '#0f3460',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    borderWidth: 3,
    borderColor: '#e94560',
  },
  readingLabel: {
    fontSize: 14,
    color: '#aaaaaa',
    marginBottom: 5,
  },
  readingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginVertical: 10,
  },
});