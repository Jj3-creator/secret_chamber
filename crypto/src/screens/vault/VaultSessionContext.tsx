/**
 * VaultSessionContext — holds the real master key in memory ONLY for as
 * long as the room stays unlocked this session (set once by UnlockScreen
 * right after a correct PIN, read by CategoryDetailScreen to actually
 * encrypt/decrypt each safe's content).
 *
 * Same "zero memory traces" reasoning as OnboardingContext.tsx: a plain
 * React context, never a navigation route param, never persisted —
 * cleared the moment the room is locked again (VaultHomeScreen's "ปิด
 * ห้องลับ" action) or the app reloads. Nothing here ever touches
 * AsyncStorage or the server.
 */
import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface VaultSessionValue {
  masterKeyHex: string | null;
  setMasterKeyHex: (key: string | null) => void;
}

const VaultSessionContext = createContext<VaultSessionValue | null>(null);

export function VaultSessionProvider({ children }: { children: ReactNode }) {
  const [masterKeyHex, setMasterKeyHex] = useState<string | null>(null);
  return (
    <VaultSessionContext.Provider value={{ masterKeyHex, setMasterKeyHex }}>{children}</VaultSessionContext.Provider>
  );
}

export function useVaultSession(): VaultSessionValue {
  const ctx = useContext(VaultSessionContext);
  if (!ctx) throw new Error('useVaultSession must be used within a VaultSessionProvider');
  return ctx;
}
