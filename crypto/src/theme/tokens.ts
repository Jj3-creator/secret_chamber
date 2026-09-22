/**
 * tokens.ts — shared design tokens for the whole app
 * ===========================================================
 * Palette: "Graphite & Brass" — from the Sep 2026 mobile redesign handoff
 * (design_handoff_secret_chamber/README.md §4.1), a single warm dark
 * palette replacing the earlier plain-neutral one. Still deliberately
 * understated (no bright/saturated brand color, low visual "this is a
 * secret vault" signal at a glance) — just warmer and with one consistent
 * brass accent instead of a flat cream one.
 *
 * Deliberate deviation from the handoff doc: its own type scale (21/18/
 * 16/14.5.../9.5) is NOT used here. This app's base sizes were
 * specifically bumped to a 16px floor earlier per direct feedback ("text
 * was too small/low-contrast for older users to read comfortably") —
 * that accessibility requirement outranks the redesign's smaller
 * reference sizes, so only color/radius/shadow values were adopted, not
 * type size. Per-screen explicit fontSize overrides (very common
 * throughout this codebase) are unaffected either way.
 */
import { Platform, type TextStyle } from 'react-native';

// Thai script has no spaces between words. Native text layout (iOS/Android)
// handles that fine, but on web the browser needs dictionary-based
// segmentation to find a line-break point in an unbroken Thai sentence —
// and this preview's Chromium build doesn't ship that dictionary, so long
// text just runs off the edge of the screen instead of wrapping (looks like
// text is missing/cut off). Force a hard-wrap fallback, web only.
const webTextWrapFix = (
  Platform.OS === 'web' ? { overflowWrap: 'anywhere', wordBreak: 'break-word' } : {}
) as TextStyle;

export const colors = {
  background: '#100F0D',
  surface: '#1A1917',
  // Buttons/list-items-within-sheets/thumbnails — the handoff's "surface2".
  // Kept as the existing `surfaceAlt` key so no call site needs touching.
  surfaceAlt: '#242320',
  /** Hairline card borders — the handoff's "borderSoft". */
  borderSoft: '#302E2A',
  // Feedback (still true under the new palette): borders need to stay
  // clearly visible against a near-black background for older users —
  // this is the stronger border, for inputs/secondary buttons/handles.
  border: '#4A4842',
  textPrimary: '#F5F2EC',
  textSecondary: '#B4AFA4',
  textMuted: '#9A958A',
  /** Single brand accent — buttons, tile numbers, active status. Never for body text color (handoff rule). */
  accent: '#D9A441',
  accentText: '#1A1400',
  /** Deep end of the accent gradient (progress bar fill, button gradients). */
  accentDeep: '#B98436',
  // accentTeal used to be a distinct muted teal for status/progress
  // indicators; the redesign consolidates to one accent everywhere, so
  // this now just aliases `accent` rather than every call site needing
  // to be found and rewritten.
  accentTeal: '#D9A441',
  /** Guardian-assigned safes, "encrypted"/confirmed states. */
  success: '#8FB98A',
  danger: '#2B1216',
  dangerBorder: '#4A2228',
  dangerText: '#FFA9A6',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

// Feedback: text was too small/low-contrast for older users to read
// comfortably — bumped every base size to at least 16px (system font,
// no license concerns). Screens that explicitly overrode a smaller size
// were bumped the same way at their own call sites. (Kept as-is under
// the new palette — see this file's own header comment.)
export const typography: Record<string, TextStyle> = {
  title: { fontSize: 28, fontWeight: '700', ...webTextWrapFix },
  subtitle: { fontSize: 16, fontWeight: '400', lineHeight: 23, ...webTextWrapFix },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.5, ...webTextWrapFix },
  body: { fontSize: 16, fontWeight: '400', ...webTextWrapFix },
  mono: { fontSize: 16, fontWeight: '600', ...webTextWrapFix },
};
