import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { OnboardingProvider } from '../screens/onboarding/OnboardingContext';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { WarningScreen } from '../screens/onboarding/WarningScreen';
import { PassphraseScreen } from '../screens/onboarding/PassphraseScreen';
import { ConfirmScreen } from '../screens/onboarding/ConfirmScreen';
import { DoneScreen } from '../screens/onboarding/DoneScreen';
import { VaultHomeScreen } from '../screens/vault/VaultHomeScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Warning: undefined;
  Passphrase: undefined;
  Confirm: undefined;
  /**
   * Placeholder landing screen right after Confirm. The design's section
   * "1. Onboarding / Register" actually continues to 1.5 (set Real + Decoy
   * PIN) before reaching the dashboard — not built yet, so Done offers a
   * direct shortcut into VaultHome instead, clearly labeled as a temporary
   * bridge rather than the real flow.
   */
  Done: { accountId: string; kdf: string };
  /** Screen 3.1 — Vault Dashboard home. See VaultHomeScreen.tsx for what's real vs. mock. */
  VaultHome: { accountId: string };
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <OnboardingProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Warning" component={WarningScreen} />
        <Stack.Screen name="Passphrase" component={PassphraseScreen} />
        <Stack.Screen name="Confirm" component={ConfirmScreen} />
        <Stack.Screen name="Done" component={DoneScreen} />
        <Stack.Screen name="VaultHome" component={VaultHomeScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
