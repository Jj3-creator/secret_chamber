import './src/polyfills';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <OnboardingNavigator />
    </NavigationContainer>
  );
}
