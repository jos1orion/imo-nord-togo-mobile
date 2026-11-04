/**
 * Design Tokens - Espacement & Rayons
 * Système de design pour Imo Prestige Mobile
 */

export const SPACING_TOKENS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export type SpacingToken = keyof typeof SPACING_TOKENS;

export const RADIUS_TOKENS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export type RadiusToken = keyof typeof RADIUS_TOKENS;

/**
 * Dimensions écran standard
 */
export const DIMENSIONS = {
  screenWidth: 'width',
  screenHeight: 'height',
} as const;

/**
 * Hit slop pour interactions
 */
export const HIT_SLOP = {
  small: 8,
  medium: 12,
  large: 20,
} as const;