/**
 * roomThemes.ts — a small palette the user can pick for their room
 * (feedback: let the room feel like "theirs"). Each theme now carries
 * both an accent color (icon badges, progress bar, highlighted labels)
 * AND a near-black background tint — per feedback, picking a theme
 * should re-color the background too, not just accent highlights.
 * Backgrounds stay very dark (the camouflage intent is unchanged) — just
 * a faint hue instead of literally neutral black.
 */
export interface RoomTheme {
  id: string;
  label: string;
  /** Accent — icon badges, progress bar fill, highlighted labels. */
  color: string;
  /** Screen background — a barely-there tint of the accent hue, not a real background. */
  background: string;
}

export const ROOM_THEMES: RoomTheme[] = [
  { id: 'teal', label: 'ฟ้าอมเขียว', color: '#7FA6B1', background: '#0A0F10' },
  { id: 'amber', label: 'อำพัน', color: '#C9975B', background: '#100D08' },
  { id: 'sage', label: 'เขียวเซจ', color: '#8FA87F', background: '#0C100A' },
  { id: 'rose', label: 'กุหลาบฝุ่น', color: '#B98A93', background: '#100B0D' },
  { id: 'slate', label: 'น้ำเงินหม่น', color: '#7C8AA6', background: '#0A0C10' },
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
