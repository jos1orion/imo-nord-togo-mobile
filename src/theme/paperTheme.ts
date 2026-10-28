import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { THEME_PALETTES, type ThemeMode } from './colors';

export const createPaperTheme = (mode: ThemeMode): MD3Theme => {
  const palette = THEME_PALETTES[mode];
  const baseTheme = mode === 'light' ? MD3LightTheme : MD3DarkTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
      secondary: palette.accent,
      onPrimary: mode === 'light' ? palette.white : palette.background,
      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceAlt,
      error: palette.danger,
      onSurface: palette.onSurface,
      onSurfaceVariant: palette.onSurfaceMuted,
      outline: palette.border,
      outlineVariant: palette.borderStrong,
    },
  };
};

export const lightPaperTheme = createPaperTheme('light');
export const darkPaperTheme = createPaperTheme('dark');
