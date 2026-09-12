/**
 * OnboardingContext — holds the in-progress passphrase in memory ONLY.
 *
 * Deliberately not passed as a navigation route param: React Navigation
 * can serialize route params into its state tree (visible to devtools,
 * and persisted if the app ever enables navigation-state persistence) —
 * exactly the kind of accidental trace this app's "zero memory traces"
 * design (see crypto.ts) is trying to avoid. A plain React context that
 * gets cleared as soon as confirmation succeeds keeps the passphrase out
 * of anything that isn't this component tree.
 */
import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface OnboardingState {
  passphrase: string | null;
  /** 3 distinct word positions (1-12) the Confirm screen will ask about. */
  confirmPositions: number[];
}

interface OnboardingContextValue extends OnboardingState {
  setPassphrase: (passphrase: string, confirmPositions: number[]) => void;
  clear: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>({ passphrase: null, confirmPositions: [] });

  const setPassphrase = (passphrase: string, confirmPositions: number[]) =>
    setState({ passphrase, confirmPositions });

  const clear = () => setState({ passphrase: null, confirmPositions: [] });

  return (
    <OnboardingContext.Provider value={{ ...state, setPassphrase, clear }}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
