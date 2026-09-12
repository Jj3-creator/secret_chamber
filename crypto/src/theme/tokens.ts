/**
 * tokens.ts — shared design tokens for the Onboarding flow
 * ===========================================================
 * Matches the "Secret Chamber Flow" Claude Design canvas: 360×760 mobile,
 * dark neutral palette, no bright brand color (intentionally styled to
 * read like a plain file-storage utility, not an obviously "secret" app).
 */
import type { TextStyle } from 'react-native';

export const colors = {
  background: '#0B0B0D',
  surface: '#17171B',
  surfaceAlt: '#1F1F24',
  border: '#2A2A30',
  textPrimary: '#F2F2F0',
  textSecondary: '#9B9BA3',
  textMuted: '#6B6B75',
  accent: '#E7E5DF',
  accentText: '#111114',
  danger: '#3A1518',
  dangerBorder: '#5C2228',
  dangerText: '#F3B7BB',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const typography: Record<string, TextStyle> = {
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  body: { fontSize: 15, fontWeight: '400' },
  mono: { fontSize: 16, fontWeight: '600' },
};
