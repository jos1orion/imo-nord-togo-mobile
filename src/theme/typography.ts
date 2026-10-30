import type { TextStyle } from 'react-native';

export const typography = {
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
  body: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'Roboto',
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 14,
  },
  button: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 18,
  },
  tabLabel: {
    fontFamily: 'Roboto',
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 14,
  },
  badge: {
    fontFamily: 'Poppins',
    fontSize: 10,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 12,
  },
} as const;
