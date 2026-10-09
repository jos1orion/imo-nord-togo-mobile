export const THEME_PALETTES = {
  light: {
    primary: '#C2410C',
    primaryDark: '#9A3412',
    accent: '#16A34A',
    background: '#FAF7F2',
    surface: '#FFFFFF',
    surfaceAlt: '#F7F2E9',
    surfaceMuted: '#F1EAE1',
    onSurface: '#10233F',
    onSurfaceMuted: '#5B6B80',
    onSurfaceSoft: '#7B8BA1',
    border: '#E7DED2',
    borderStrong: '#DED3C5',
    primaryContainer: '#FFF1E6',
    onPrimaryContainer: '#9A3412',
    success: '#15803D',
    successContainer: '#DCFCE7',
    onSuccessContainer: '#166534',
    warning: '#B45309',
    warningContainer: '#FEF3C7',
    onWarningContainer: '#92400E',
    danger: '#B91C1C',
    dangerContainer: '#FEE2E2',
    onDangerContainer: '#991B1B',
    info: '#2563EB',
    infoContainer: '#DBEAFE',
    onInfoContainer: '#1D4ED8',
    brand: '#10233F',
    onBrand: '#FFFFFF',
    brandAccent: '#F4C76B',
    onBrandMuted: '#DCE7F7',
    gold: '#F59E0B',
    onGold: '#292524',
    white: '#FFFFFF',
    black: '#000000',
    shadow: '#0F172A',
    overlay: '#00000008',
    socialGoogle: '#4285F4',
    socialFacebook: '#1877F2',
    socialInstagram: '#E4405F',
    socialTwitter: '#1DA1F2',
    cyan: '#0EA5A4',
    pink: '#FB7185',
    purple: '#4F46E5',
    occupied: '#92400E',
  },
  dark: {
    primary: '#FDBA74',
    primaryDark: '#C2410C',
    accent: '#4ADE80',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceAlt: '#334155',
    surfaceMuted: '#0B1220',
    onSurface: '#F1F5F9',
    onSurfaceMuted: '#94A3B8',
    onSurfaceSoft: '#64748B',
    border: '#334155',
    borderStrong: '#475569',
    primaryContainer: '#7C2D12',
    onPrimaryContainer: '#FDBA74',
    success: '#4ADE80',
    successContainer: '#14532D',
    onSuccessContainer: '#86EFAC',
    warning: '#FBBF24',
    warningContainer: '#78350F',
    onWarningContainer: '#FCD34D',
    danger: '#FB7185',
    dangerContainer: '#7F1D1D',
    onDangerContainer: '#FCA5A5',
    info: '#93C5FD',
    infoContainer: '#1E3A5F',
    onInfoContainer: '#93C5FD',
    brand: '#10233F',
    onBrand: '#FFFFFF',
    brandAccent: '#F4C76B',
    onBrandMuted: '#B9C8DC',
    gold: '#FBBF24',
    onGold: '#292524',
    white: '#FFFFFF',
    black: '#000000',
    shadow: '#000000',
    overlay: '#00000080',
    socialGoogle: '#4285F4',
    socialFacebook: '#1877F2',
    socialInstagram: '#E4405F',
    socialTwitter: '#1DA1F2',
    cyan: '#22D3EE',
    pink: '#FB7185',
    purple: '#A5B4FC',
    occupied: '#FCD34D',
  },
} as const;

export type ThemeMode = keyof typeof THEME_PALETTES;
export type ThemeColorName = keyof typeof THEME_PALETTES.light;
export type ThemePalette = Record<ThemeColorName, string>;

const token = <T extends ThemeColorName>(name: T): `@${T}` => `@${name}`;

const COLOR_TOKENS = Object.fromEntries(
  Object.keys(THEME_PALETTES.light).map(name => [name, token(name as ThemeColorName)])
) as { [K in ThemeColorName]: `@${K}` };

export const COLORS = {
  ...COLOR_TOKENS,
} as const;

export const resolveColorToken = (value: string, mode: ThemeMode): string => {
  if (!value.startsWith('@')) return value;
  const name = value.slice(1) as ThemeColorName;
  return THEME_PALETTES[mode][name] ?? value;
};

export default COLORS;
