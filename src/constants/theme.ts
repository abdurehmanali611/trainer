/**
 * FitPilot theme — near-black base, vivid green/lime brand, colourful accents.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#F0FDFA',
    background: '#070B14',
    backgroundElement: '#101826',
    backgroundSelected: '#16222F',
    textSecondary: '#94A3B8',
    primary: '#34D860',
    accent: '#A3E635',
  },
  dark: {
    text: '#F0FDFA',
    background: '#070B14',
    backgroundElement: '#101826',
    backgroundSelected: '#16222F',
    textSecondary: '#94A3B8',
    primary: '#34D860',
    accent: '#A3E635',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "Spline Sans, Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
