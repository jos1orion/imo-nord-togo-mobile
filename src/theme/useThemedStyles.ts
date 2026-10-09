import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { resolveColorToken, THEME_PALETTES, type ThemePalette } from './colors';

type StyleValues = Record<string, unknown>;

const resolveStyleTokens = (style: unknown, mode: 'light' | 'dark'): unknown => {
  if (Array.isArray(style)) return style.map(value => resolveStyleTokens(value, mode));
  if (style === null || typeof style !== 'object') {
    return typeof style === 'string' ? resolveColorToken(style, mode) : style;
  }

  return Object.fromEntries(
    Object.entries(style as StyleValues).map(([key, value]) => [
      key,
      resolveStyleTokens(value, mode),
    ])
  );
};

export const useThemeColors = (): ThemePalette => {
  const { theme } = useApp();
  return THEME_PALETTES[theme];
};

export const useThemedStyles = <T extends Record<string, object>>(styles: T): T => {
  const { theme } = useApp();
  return useMemo(
    () => Object.fromEntries(
      Object.entries(styles).map(([name, style]) => [name, resolveStyleTokens(style, theme)])
    ) as T,
    [styles, theme]
  );
};
