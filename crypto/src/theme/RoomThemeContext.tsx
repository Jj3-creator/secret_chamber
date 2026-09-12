/**
 * RoomThemeContext — the currently-active room theme, shared across every
 * screen reached after Personalize (Personalize itself, DMSSetup, Done,
 * VaultHome, Dashboard). Feedback: picking a theme should re-color every
 * screen immediately, and be restored automatically next time that room
 * is opened — not just apply to whichever single screen read it.
 *
 * Screens BEFORE a theme is ever chosen (Welcome/Warning/Passphrase/
 * Confirm) have no room yet, so they stay on the static default palette
 * from theme/tokens.ts — there's nothing to theme until Personalize runs.
 */
import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { DEFAULT_ROOM_THEME_ID, getRoomThemeColor, getRoomThemeBackground } from './roomThemes';

interface RoomThemeContextValue {
  themeId: string;
  accentColor: string;
  backgroundColor: string;
  /** Personalize calls this immediately on tap (live preview); VaultHome calls it once after loading the saved profile, to restore it on a fresh app open. */
  setThemeId: (themeId: string) => void;
}

const RoomThemeContext = createContext<RoomThemeContextValue | null>(null);

export function RoomThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState(DEFAULT_ROOM_THEME_ID);

  const value: RoomThemeContextValue = {
    themeId,
    accentColor: getRoomThemeColor(themeId),
    backgroundColor: getRoomThemeBackground(themeId),
    setThemeId,
  };

  return <RoomThemeContext.Provider value={value}>{children}</RoomThemeContext.Provider>;
}

export function useRoomTheme(): RoomThemeContextValue {
  const ctx = useContext(RoomThemeContext);
  if (!ctx) throw new Error('useRoomTheme must be used within a RoomThemeProvider');
  return ctx;
}
