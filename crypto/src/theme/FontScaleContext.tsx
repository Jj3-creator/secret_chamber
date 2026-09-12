/**
 * FontScaleContext — a user-chosen text-size multiplier, picked from
 * SettingsScreen. Same shape/lifecycle as RoomThemeContext: set live in
 * memory when the user picks it, persisted into RoomProfile
 * (localProfile.ts) and restored on VaultHome's load, same as themeId.
 *
 * Scoped honestly: applied so far to VaultHomeScreen's and
 * CategoryDetailScreen's own text (the two screens people actually read
 * things on day-to-day) via useFontScale()'s `scaled()` helper — NOT yet
 * retrofitted across every screen in the app, since this app's styles are
 * static StyleSheet.create() objects computed once at module load, not
 * re-computed per render; wiring every single screen to read this context
 * is a larger follow-up, not a Settings-screen-sized change.
 */
import React, { createContext, useContext, useState, type ReactNode } from 'react';

export const FONT_SCALE_OPTIONS = [
  { id: 'normal', label: 'ปกติ', scale: 1 },
  { id: 'large', label: 'ใหญ่', scale: 1.15 },
  { id: 'xlarge', label: 'ใหญ่มาก', scale: 1.3 },
] as const;

export const DEFAULT_FONT_SCALE_ID = FONT_SCALE_OPTIONS[0].id;

interface FontScaleContextValue {
  fontScaleId: string;
  fontScale: number;
  setFontScaleId: (id: string) => void;
  /** Multiplies a base fontSize by the current scale, rounded to a whole pixel. */
  scaled: (baseSize: number) => number;
}

const FontScaleContext = createContext<FontScaleContextValue | null>(null);

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [fontScaleId, setFontScaleId] = useState(DEFAULT_FONT_SCALE_ID as string);
  const fontScale = FONT_SCALE_OPTIONS.find((o) => o.id === fontScaleId)?.scale ?? 1;

  const value: FontScaleContextValue = {
    fontScaleId,
    fontScale,
    setFontScaleId,
    scaled: (baseSize: number) => Math.round(baseSize * fontScale),
  };

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export function useFontScale(): FontScaleContextValue {
  const ctx = useContext(FontScaleContext);
  if (!ctx) throw new Error('useFontScale must be used within a FontScaleProvider');
  return ctx;
}
