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
  { id: 'teal', label: 'ฟ้าอมเขียว', color: '#7FA6B1', background: '#14282C' },
  { id: 'amber', label: 'อำพัน', color: '#C9975B', background: '#2A2013' },
  { id: 'sage', label: 'เขียวเซจ', color: '#8FA87F', background: '#1C2814' },
  { id: 'rose', label: 'กุหลาบฝุ่น', color: '#B98A93', background: '#2A1620' },
  { id: 'slate', label: 'น้ำเงินหม่น', color: '#7C8AA6', background: '#16202C' },
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
