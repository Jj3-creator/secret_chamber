/**
 * roomThemes.ts — a small palette of accent colors the user can pick for
 * their room (feedback: let the room feel like "theirs", not identical
 * to everyone else's). Each swap only the one accent color used for
 * highlights (icon badge glow, progress bar) — not a full re-theme of the
 * app's dark background, which stays constant for the camouflage intent.
 */
export interface RoomTheme {
  id: string;
  label: string;
  color: string;
}

export const ROOM_THEMES: RoomTheme[] = [
  { id: 'teal', label: 'ฟ้าอมเขียว', color: '#7FA6B1' }, // default, matches the original design export
  { id: 'amber', label: 'อำพัน', color: '#C9975B' },
  { id: 'sage', label: 'เขียวเซจ', color: '#8FA87F' },
  { id: 'rose', label: 'กุหลาบฝุ่น', color: '#B98A93' },
  { id: 'slate', label: 'น้ำเงินหม่น', color: '#7C8AA6' },
];

export function getRoomThemeColor(themeId: string): string {
  return ROOM_THEMES.find((t) => t.id === themeId)?.color ?? ROOM_THEMES[0].color;
}
