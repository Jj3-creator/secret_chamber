/**
 * Minimal placeholder entry so this package boots as a real Expo app.
 * The actual deliverable is src/services/crypto.ts — this file just proves
 * the module wires into an Expo screen without crashing.
 */
import React, { useState } from 'react';
import { SafeAreaView, Text, View, StyleSheet } from 'react-native';
import {
  generatePassphrase,
  deriveMasterKey,
  deriveAccountId,
} from './src/services/crypto';

export default function App() {
  const [status, setStatus] = useState('Tap to generate a passphrase');

  const run = async () => {
    const phrase = await generatePassphrase();
    const { masterKeyHex, saltHex, kdf } = await deriveMasterKey(phrase);
    const accountId = deriveAccountId(masterKeyHex);
    setStatus(`kdf=${kdf} salt=${saltHex.slice(0, 8)}… account_id=${accountId.slice(0, 12)}…`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Secret Chamber — Crypto Core</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.link} onPress={run}>
        Run generatePassphrase() → deriveMasterKey() → deriveAccountId()
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  status: { fontSize: 13, textAlign: 'center' },
  link: { color: '#3b82f6', marginTop: 16 },
});
