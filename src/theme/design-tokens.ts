/**
 * Design Tokens - Export principal
 * Système de design centralisé pour Imo Prestige Mobile
 *
 * Usage :
 * import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/theme/design-tokens'
 */

import { COLOR_TOKENS, THEMES, type ColorToken, type ColorTheme, DARK_COLOR_TOKENS } from './tokens/colors';
import { TYPOGRAPHY_TOKENS, type TypographyToken } from './tokens/typography';
import { SPACING_TOKENS, RADIUS_TOKENS, type SpacingToken, type RadiusToken } from './tokens/spacing';

// Export des tokens
export const COLORS = COLOR_TOKENS;
export const TYPOGRAPHY = TYPOGRAPHY_TOKENS;
export const SPACING = SPACING_TOKENS;
export const RADIUS = RADIUS_TOKENS;
export { THEMES };

export type { ColorToken, ColorTheme, TypographyToken, SpacingToken, RadiusToken };
export { DARK_COLOR_TOKENS };

// Raccourcis communs
export const { primary, primaryDark, accent, background, surface, onSurface, border, danger, success, warning, info } = COLORS;

/**
 * Helper pour obtenir un token de couleur par thème
 */
export const getToken = (theme: string, key: string): string => {
  const themeColors = THEMES[theme as keyof typeof THEMES];
  return themeColors?.[key as keyof typeof themeColors] ?? COLORS[key as keyof typeof COLORS];
};

export default {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  THEMES,
};