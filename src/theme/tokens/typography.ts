/**
 * Design Tokens - Typographie
 * Système de design pour Imo Prestige Mobile
 */

import type { TextStyle } from 'react-native';

export const TYPOGRAPHY_TOKENS = {
  // Titres
  heroTitle: {
    fontFamily: 'Roboto',
    fontSize: 22,
    fontWeight: '800' as TextStyle['fontWeight'],
    lineHeight: 28,
  },
  title: {
    fontFamily: 'Roboto',
    fontSize: 18,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: 'Roboto',
    fontSize: 16,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 22,
  },

  // Corps de texte
  body: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },

  // Étiquettes
  caption: {
    fontFamily: 'Roboto',
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 14,
  },

  // Boutons
  button: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 18,
  },

  // Tab labels
  tabLabel: {
    fontFamily: 'Roboto',
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 14,
  },

  // Badge
  badge: {
    fontFamily: 'Poppins',
    fontSize: 10,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 12,
  },
} as const;

export type TypographyToken = keyof typeof TYPOGRAPHY_TOKENS;

/**
 * Variantes d'état
 */
export const TYPOGRAPHY_VARIANTS = {
  primary: {
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  bold: {
    fontWeight: '800' as TextStyle['fontWeight'],
  },
  muted: {
    fontWeight: '400' as TextStyle['fontWeight'],
  },
} as const;