import './src/polyfills';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { RoomThemeProvider } from './src/theme/RoomThemeContext';

export default function App() {
  return (
    <RoomThemeProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <OnboardingNavigator />
      </NavigationContainer>
    </RoomThemeProvider>
  );
}
