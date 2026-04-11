import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { GreenSpeed, GREEN_SPEED_MODIFIER, useGreenSpeed } from '@/contexts/green-speed';

const SPEED_OPTIONS: { key: GreenSpeed; label: string; stimp: string; description: string }[] = [
  {
    key: 'SLOW',
    label: 'SLOW',
    stimp: 'Stimp ~8',
    description: 'Firm stroke needed. Less break — ball won\'t curve as much.',
  },
  {
    key: 'NORMAL',
    label: 'NORMAL',
    stimp: 'Stimp ~10',
    description: 'Standard conditions. Aim cues at full value.',
  },
  {
    key: 'FAST',
    label: 'FAST',
    stimp: 'Stimp ~12+',
    description: 'Light touch required. More break — account for extra curve.',
  },
];

export default function Settings() {
  const { greenSpeed, setGreenSpeed } = useGreenSpeed();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>SETTINGS</Text>

      <Text style={styles.sectionLabel}>GREEN SPEED</Text>
      <Text style={styles.sectionHint}>
        Select the stimp rating of today's greens. This scales how many cups to aim — slower greens need more power (less break), faster greens need a lighter touch (more break).
      </Text>

      {SPEED_OPTIONS.map(option => {
        const isSelected = greenSpeed === option.key;
        const modifier = GREEN_SPEED_MODIFIER[option.key];
        const modifierLabel =
          modifier === 1.0
            ? 'No adjustment'
            : modifier < 1.0
            ? `−${Math.round((1 - modifier) * 100)}% break`
            : `+${Math.round((modifier - 1) * 100)}% break`;

        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.speedButton, isSelected && styles.speedButtonSelected]}
            onPress={() => setGreenSpeed(option.key)}
            accessibilityLabel={`Green speed ${option.label}`}
            accessibilityState={{ selected: isSelected }}
          >
            <View style={styles.speedRow}>
              <View>
                <Text style={[styles.speedLabel, isSelected && styles.speedLabelSelected]}>
                  {option.label}
                </Text>
                <Text style={styles.stimpText}>{option.stimp}</Text>
              </View>
              <View style={styles.modifierBadge}>
                <Text style={[styles.modifierText, isSelected && styles.modifierTextSelected]}>
                  {modifierLabel}
                </Text>
              </View>
            </View>
            <Text style={styles.speedDescription}>{option.description}</Text>
          </TouchableOpacity>
        );
      })}

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
    marginBottom: 20,
    letterSpacing: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 18,
    lineHeight: 20,
  },
  speedButton: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333333',
  },
  speedButtonSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#1a1800',
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  speedLabel: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 2,
  },
  speedLabelSelected: {
    color: '#FFD700',
  },
  stimpText: {
    fontSize: 13,
    color: '#555555',
    marginTop: 2,
  },
  modifierBadge: {
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modifierText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666666',
  },
  modifierTextSelected: {
    color: '#FFD700',
  },
  speedDescription: {
    fontSize: 14,
    color: '#aaaaaa',
    lineHeight: 20,
  },
});
