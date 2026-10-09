import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { THEME_PALETTES } from './colors';

export const lightPaperTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: THEME_PALETTES.light.primary,
    primaryContainer: THEME_PALETTES.light.primaryContainer,
    secondary: THEME_PALETTES.light.accent,
    onPrimary: THEME_PALETTES.light.white,
    background: THEME_PALETTES.light.background,
    surface: THEME_PALETTES.light.surface,
    surfaceVariant: THEME_PALETTES.light.surfaceAlt,
    error: THEME_PALETTES.light.danger,
    onSurface: THEME_PALETTES.light.onSurface,
    onSurfaceVariant: THEME_PALETTES.light.onSurfaceMuted,
    outline: THEME_PALETTES.light.border,
    outlineVariant: THEME_PALETTES.light.borderStrong,
  },
};

export const darkPaperTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: THEME_PALETTES.dark.primary,
    primaryContainer: THEME_PALETTES.dark.primaryContainer,
    secondary: THEME_PALETTES.dark.accent,
    onPrimary: THEME_PALETTES.dark.background,
    background: THEME_PALETTES.dark.background,
    surface: THEME_PALETTES.dark.surface,
    surfaceVariant: THEME_PALETTES.dark.surfaceAlt,
    error: THEME_PALETTES.dark.danger,
    onSurface: THEME_PALETTES.dark.onSurface,
    onSurfaceVariant: THEME_PALETTES.dark.onSurfaceMuted,
    outline: THEME_PALETTES.dark.borderStrong,
    outlineVariant: THEME_PALETTES.dark.border,
  },
};
