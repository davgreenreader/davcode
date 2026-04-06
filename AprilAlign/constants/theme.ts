import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#4f8ef7',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#4f8ef7',
  },
  dark: {
    text: '#ECEDEE',
    background: '#0a0a1a',
    tint: '#4f8ef7',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#4f8ef7',
  },
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
