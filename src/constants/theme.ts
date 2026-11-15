/**
 * Dark system theme — teal primary on slate navy (hotcol-aligned).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#F1F5F9',
    background: '#0B1220',
    backgroundElement: '#1A2332',
    backgroundSelected: '#243044',
    textSecondary: '#94A3B8',
    primary: '#2DD4BF',
    accent: '#F5B042',
  },
  dark: {
    text: '#F1F5F9',
    background: '#0B1220',
    backgroundElement: '#1A2332',
    backgroundSelected: '#243044',
    textSecondary: '#94A3B8',
    primary: '#2DD4BF',
    accent: '#F5B042',
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
