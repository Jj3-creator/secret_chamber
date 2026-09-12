/**
 * OnboardingContext — holds the in-progress passphrase (and, briefly, the
 * derived master key) in memory ONLY.
 *
 * Deliberately not passed as a navigation route param: React Navigation
 * can serialize route params into its state tree (visible to devtools,
 * and persisted if the app ever enables navigation-state persistence) —
 * exactly the kind of accidental trace this app's "zero memory traces"
 * design (see crypto.ts) is trying to avoid. A plain React context that
 * gets cleared as soon as it's no longer needed keeps secrets out of
 * anything that isn't this component tree.
 *
 * masterKeyHex only exists here transiently, between Confirm (where it's
 * derived) and whichever screen last needs it (DMS Setup, if the owner
 * configures it now — otherwise Personalize) — `clear()` drops it either
 * way before reaching Done.
 */
import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { PassphraseLanguage } from '../../services/crypto';

interface OnboardingState {
  passphrase: string | null;
  /** 3 distinct word positions (1-12) the Confirm screen will ask about. */
  confirmPositions: number[];
  /** Chosen once on Welcome, per feedback — not every Thai user reads English comfortably. */
  passphraseLanguage: PassphraseLanguage;
  /** Transient — only alive between Confirm and DMS Setup/Personalize. */
  masterKeyHex: string | null;
}

interface OnboardingContextValue extends OnboardingState {
  setPassphraseLanguage: (language: PassphraseLanguage) => void;
  setPassphrase: (passphrase: string, confirmPositions: number[]) => void;
  setMasterKeyHex: (masterKeyHex: string) => void;
  /** Drops just the passphrase (Confirm succeeded) — masterKeyHex may still be needed by DMS Setup. */
  clearPassphrase: () => void;
  /** Full reset, once masterKeyHex is no longer needed either (DMS Setup done/skipped). */
  clear: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const INITIAL_STATE: OnboardingState = {
  passphrase: null,
  confirmPositions: [],
  passphraseLanguage: 'th',
  masterKeyHex: null,
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  const setPassphraseLanguage = (passphraseLanguage: PassphraseLanguage) =>
    setState((prev) => ({ ...prev, passphraseLanguage }));

  const setPassphrase = (passphrase: string, confirmPositions: number[]) =>
    setState((prev) => ({ ...prev, passphrase, confirmPositions }));

  const setMasterKeyHex = (masterKeyHex: string) => setState((prev) => ({ ...prev, masterKeyHex }));

  const clearPassphrase = () => setState((prev) => ({ ...prev, passphrase: null, confirmPositions: [] }));

  const clear = () => setState((prev) => ({ ...INITIAL_STATE, passphraseLanguage: prev.passphraseLanguage }));

  return (
    <OnboardingContext.Provider
      value={{ ...state, setPassphraseLanguage, setPassphrase, setMasterKeyHex, clearPassphrase, clear }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
