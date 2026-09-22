/**
 * roomThemes.ts — a small palette the user can pick for their room
 * (feedback: let the room feel like "theirs"). Each theme now carries
 * both an accent color (icon badges, progress bar, highlighted labels)
 * AND a dark background tint — per feedback, picking a theme should
 * re-color the background too, not just accent highlights. Backgrounds
 * stay dark (the camouflage intent is unchanged) — but tinted strongly
 * enough to actually read as "this room is green/blue/etc" at a glance,
 * not just barely-there hues indistinguishable from plain black (an
 * earlier pass used ~6% lightness here, which looked identical to
 * colors.background on a real screen — feedback: users couldn't tell the
 * background had changed at all).
 *
 * Rebuilt for the "Graphite & Brass" redesign (tokens.ts) — the old set
 * here was a leftover flat/muted-pastel palette from before that pass,
 * so every themed screen (VaultHome, Unlock, Dashboard, Settings,
 * Personalize — anything wrapped in ThemedBackground) still looked like
 * the old app even after tokens.ts shipped, since none of them read
 * tokens.colors directly. These 5 are richer, warmer jewel tones that
 * actually sit well against the new near-black base instead of clashing
 * with it, and the first one doubles as the exact brass accent used
 * everywhere else in the app.
 */
export interface RoomTheme {
  id: string;
  label: string;
  /** Accent — icon badges, progress bar fill, highlighted labels. */
  color: string;
  /** Screen background — a dark but clearly-tinted shade of the accent hue. */
  background: string;
}

export const ROOM_THEMES: RoomTheme[] = [
  { id: 'brass', label: 'ทองบรอนซ์', color: '#D9A441', background: '#211907' },
  { id: 'copper', label: 'ทองแดง', color: '#C97B4A', background: '#241407' },
  { id: 'emerald', label: 'มรกต', color: '#4FA692', background: '#0E211D' },
  { id: 'wine', label: 'ไวน์แดง', color: '#B15C6B', background: '#241019' },
  { id: 'indigo', label: 'คราม', color: '#7A8BD8', background: '#141830' },
];

export const DEFAULT_ROOM_THEME_ID = ROOM_THEMES[0].id;

export function getRoomTheme(themeId: string): RoomTheme {
  return ROOM_THEMES.find((t) => t.id === themeId) ?? ROOM_THEMES[0];
}

export function getRoomThemeColor(themeId: string): string {
  return getRoomTheme(themeId).color;
}

export function getRoomThemeBackground(themeId: string): string {
  return getRoomTheme(themeId).background;
}
