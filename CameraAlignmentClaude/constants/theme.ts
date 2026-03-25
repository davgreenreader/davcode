import { Platform } from 'react-native';

const tintColorLight = '#4caf50';
const tintColorDark = '#81c784';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#0d1a0d',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const ElevationColors = {
  level: '#00ff00',    // Green: within 2cm — flat lie
  slope: '#00ffff',   // Cyan: outside 2cm — sloped
  noTarget: '#ffffff',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    mono: 'monospace',
  },
});
