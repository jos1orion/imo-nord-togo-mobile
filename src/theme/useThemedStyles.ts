import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

type StyleValues = Record<string, unknown>;

const DARK_TEXT: Record<string, string> = {
  '#0B0F14': '#F1F5F9',
  '#0F172A': '#F1F5F9',
  '#111827': '#F1F5F9',
  '#1E293B': '#F1F5F9',
  '#1F2937': '#E2E8F0',
  '#333': '#E2E8F0',
  '#334155': '#E2E8F0',
  '#374151': '#CBD5E1',
  '#475569': '#CBD5E1',
  '#666': '#94A3B8',
  '#64748B': '#94A3B8',
  '#6B7280': '#94A3B8',
  '#999': '#94A3B8',
  '#9CA3AF': '#94A3B8',
  '#1D4ED8': '#93C5FD',
  '#E0E7FF': '#A5B4FC',
  '#166534': '#86EFAC',
  '#92400E': '#FCD34D',
  '#991B1B': '#FCA5A5',
};

const DARK_BACKGROUNDS: Record<string, string> = {
  '#FFF': '#1E293B',
  '#FFFFFF': '#1E293B',
  '#F5F7FA': '#0F172A',
  '#F4F7FB': '#0F172A',
  '#F3F4F6': '#0F172A',
  '#F0F0F0': '#0F172A',
  '#F5F5F5': '#0F172A',
  '#F8FAFC': '#1E293B',
  '#F1F5F9': '#1E293B',
  '#E2E8F0': '#334155',
  '#EEF2F7': '#1E293B',
  '#E8EDF4': '#1E293B',
  '#E6EBF2': '#1E293B',
  '#E0E0E0': '#334155',
  '#CBD5F5': '#1E3A5F',
  '#E0E7FF': '#1E3A5F',
  '#EEF2FF': '#1E3A5F',
  '#EFF6FF': '#1E3A5F',
  '#DBEAFE': '#1E3A5F',
  '#F0FDF4': '#14532D',
  '#DCFCE7': '#14532D',
  '#BBF7D0': '#166534',
  '#FEF3C7': '#78350F',
  '#FFF7ED': '#7C2D12',
  '#FED7AA': '#7C2D12',
  '#FFF1F2': '#881337',
  '#FEF2F2': '#7F1D1D',
  '#FEE2E2': '#7F1D1D',
};

const DARK_BORDERS: Record<string, string> = {
  '#E5E7EB': '#334155',
  '#E2E8F0': '#334155',
  '#E6EBF2': '#334155',
  '#E8EDF4': '#334155',
  '#EEF2F7': '#334155',
  '#F0F0F0': '#334155',
  '#F1F5F9': '#334155',
  '#F3F4F6': '#334155',
  '#E0E0E0': '#334155',
  '#DBEAFE': '#1E3A5F',
  '#CCC': '#475569',
  '#FCD34D': '#92400E',
  '#FECACA': '#7F1D1D',
  '#BBF7D0': '#166534',
  '#86EFAC': '#166534',
  '#93C5FD': '#1D4ED8',
  '#FCA5A5': '#7F1D1D',
  '#FED7AA': '#7C2D12',
};

const recolorStyles = (style: unknown): unknown => {
  if (Array.isArray(style)) return style.map(recolorStyles);
  if (style === null || typeof style !== 'object') return style;

  const result: StyleValues = {};
  for (const [property, value] of Object.entries(style)) {
    if (typeof value !== 'string') {
      result[property] = recolorStyles(value);
      continue;
    }

    const color = value.toUpperCase();
    if (property === 'backgroundColor') {
      result[property] = DARK_BACKGROUNDS[color] ?? value;
    } else if (property === 'color' || property === 'placeholderTextColor') {
      result[property] = DARK_TEXT[color] ?? value;
    } else if (property.toLowerCase().includes('border') && property.toLowerCase().includes('color')) {
      result[property] = DARK_BORDERS[color] ?? value;
    } else {
      result[property] = value;
    }
  }
  return result;
};

export const useThemedStyles = <T extends Record<string, object>>(styles: T): T => {
  const { theme } = useApp();

  return useMemo(() => {
    if (theme === 'light') return styles;
    return Object.fromEntries(
      Object.entries(styles).map(([name, style]) => [name, recolorStyles(style)])
    ) as T;
  }, [styles, theme]);
};
