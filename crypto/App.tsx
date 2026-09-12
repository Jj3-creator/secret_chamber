import './src/polyfills';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { RoomThemeProvider } from './src/theme/RoomThemeContext';
import { loadDeviceLock } from './src/services/deviceLock';
import { colors } from './src/theme/tokens';

export default function App() {
  // Feedback: typing the 12-word passphrase every app open is a lot to
  // ask — if this device already has a PIN set up for a room
  // (deviceLock.ts), skip straight to the PIN unlock screen instead of
  // Welcome. Checked once, before the navigator ever mounts, since
  // React Navigation needs a fixed initialRouteName at creation time —
  // a blank frame here is a few-millisecond AsyncStorage read, not a
  // real loading state.
  const [initialRoute, setInitialRoute] = useState<'Welcome' | 'Unlock' | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDeviceLock().then((lock) => {
      if (!cancelled) setInitialRoute(lock ? 'Unlock' : 'Welcome');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (initialRoute === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <RoomThemeProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <OnboardingNavigator initialRouteName={initialRoute} />
      </NavigationContainer>
    </RoomThemeProvider>
  );
}
