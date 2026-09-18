import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { OnboardingProvider } from '../screens/onboarding/OnboardingContext';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { WarningScreen } from '../screens/onboarding/WarningScreen';
import { RecoverScreen } from '../screens/onboarding/RecoverScreen';
import { RedeemScreen } from '../screens/onboarding/RedeemScreen';
import { PassphraseScreen } from '../screens/onboarding/PassphraseScreen';
import { ConfirmScreen } from '../screens/onboarding/ConfirmScreen';
import { SetPinScreen } from '../screens/onboarding/SetPinScreen';
import { UnlockScreen } from '../screens/onboarding/UnlockScreen';
import { PersonalizeScreen } from '../screens/onboarding/PersonalizeScreen';
import { DMSSetupScreen } from '../screens/onboarding/DMSSetupScreen';
import { DoneScreen } from '../screens/onboarding/DoneScreen';
import { VaultHomeScreen } from '../screens/vault/VaultHomeScreen';
import { DashboardScreen } from '../screens/vault/DashboardScreen';
import { CategoryDetailScreen } from '../screens/vault/CategoryDetailScreen';
import { ExitScreen } from '../screens/vault/ExitScreen';
import { SettingsScreen } from '../screens/vault/SettingsScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  /** Real "กู้คืนด้วย 12 คำ" flow — reachable from Welcome and Unlock's forgot-PIN link. See RecoverScreen.tsx. */
  Recover: undefined;
  /** Guardian-facing "use my recovery code" flow — reachable from Welcome only (a guardian, by definition, has no PIN/device lock for this room). See RedeemScreen.tsx. */
  Redeem: undefined;
  Warning: undefined;
  Passphrase: undefined;
  Confirm: undefined;
  /**
   * Screen 1.5 — set a short PIN that unlocks this same room on this
   * device from now on, so the 12-word passphrase doesn't need to be
   * re-typed every time. See SetPinScreen.tsx / deviceLock.ts.
   */
  SetPin: { accountId: string; kdf: string };
  /**
   * Shown instead of Welcome when this device already has a room set up
   * (App.tsx checks deviceLock.ts before deciding the initial route). No
   * params — reads the device's stored lock itself. See UnlockScreen.tsx.
   */
  Unlock: undefined;
  /** Nickname/avatar/theme, stored locally only — not part of the original design, added per feedback. */
  Personalize: { accountId: string; kdf: string };
  /** Optional — check-in period + guardians, real crypto + real backend calls. See DMSSetupScreen.tsx. */
  /** mode: 'reconfigure' when reached from SettingsScreen (post-onboarding, room already unlocked) instead of fresh onboarding — kdf is unused in that mode (never navigates to Done), so it's optional there. */
  DMSSetup: { accountId: string; kdf?: string; mode?: 'reconfigure' };
  /** Landing screen right after onboarding completes (after the optional SetPin + DMSSetup steps). */
  Done: { accountId: string; kdf: string };
  /** Screen 3.1 — Vault Dashboard home. See VaultHomeScreen.tsx for what's real vs. mock. */
  VaultHome: { accountId: string };
  /** Usage summary + activity log — not part of the original design, added per feedback. */
  Dashboard: { accountId: string };
  /** One safe's own page — name/description, and which guardians can access it. See CategoryDetailScreen.tsx. */
  CategoryDetail: { accountId: string; categoryId: string };
  /** Exit / close-room confirmation page — reached from VaultHome's lock icon. See ExitScreen.tsx. */
  Exit: undefined;
  /** Theme/font-size/notify-date settings — reached from VaultHome's sun icon. See SettingsScreen.tsx. */
  Settings: { accountId: string };
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

interface Props {
  /** 'Unlock' when this device already has a room set up (see App.tsx), else 'Welcome'. */
  initialRouteName: 'Welcome' | 'Unlock';
}

export function OnboardingNavigator({ initialRouteName }: Props) {
  return (
    <OnboardingProvider>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Recover" component={RecoverScreen} />
        <Stack.Screen name="Redeem" component={RedeemScreen} />
        <Stack.Screen name="Unlock" component={UnlockScreen} />
        <Stack.Screen name="Warning" component={WarningScreen} />
        <Stack.Screen name="Passphrase" component={PassphraseScreen} />
        <Stack.Screen name="Confirm" component={ConfirmScreen} />
        <Stack.Screen name="SetPin" component={SetPinScreen} />
        <Stack.Screen name="Personalize" component={PersonalizeScreen} />
        <Stack.Screen name="DMSSetup" component={DMSSetupScreen} />
        <Stack.Screen name="Done" component={DoneScreen} />
        <Stack.Screen name="VaultHome" component={VaultHomeScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
        <Stack.Screen name="Exit" component={ExitScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
