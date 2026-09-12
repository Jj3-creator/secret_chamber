import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { OnboardingProvider } from '../screens/onboarding/OnboardingContext';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { WarningScreen } from '../screens/onboarding/WarningScreen';
import { PassphraseScreen } from '../screens/onboarding/PassphraseScreen';
import { ConfirmScreen } from '../screens/onboarding/ConfirmScreen';
import { DoneScreen } from '../screens/onboarding/DoneScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Warning: undefined;
  Passphrase: undefined;
  Confirm: undefined;
  /**
   * Placeholder landing screen — the "1. Onboarding / Register" section of
   * the design ends at Confirm (screens 1.1-1.4); Vault Home hasn't been
   * designed/built yet. Done just proves the pipeline completed and shows
   * the derived account_id, nothing more.
   */
  Done: { accountId: string; kdf: string };
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
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
