import type { TextStyle } from 'react-native';

export const typography = {
  heroTitle: {
    fontSize: 22,
    fontWeight: '800' as TextStyle['fontWeight'],
    lineHeight: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 14,
  },
  button: {
    fontSize: 14,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 18,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 14,
  },
} as const;
