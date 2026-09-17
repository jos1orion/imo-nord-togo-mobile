import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import COLORS from './colors';

export const lightPaperTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    primaryContainer: COLORS.infoBg,
    secondary: COLORS.accent,
    onPrimary: '#FFFFFF',
    background: COLORS.background,
    surface: COLORS.card,
    surfaceVariant: COLORS.chipBg,
    error: COLORS.error,
    onSurface: COLORS.text,
    onSurfaceVariant: COLORS.textMuted,
    outline: COLORS.border,
    outlineVariant: COLORS.borderSoft,
  },
};

export const darkPaperTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#60A5FA',
    primaryContainer: '#1E3A5F',
    secondary: COLORS.accent,
    onPrimary: '#0F172A',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceVariant: '#334155',
    error: COLORS.error,
    onSurface: '#F1F5F9',
    onSurfaceVariant: '#94A3B8',
    outline: '#475569',
    outlineVariant: '#334155',
  },
};
