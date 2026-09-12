// Screen 1.4 — ยืนยัน 3 คำ (confirm 3 words)
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { wordlists } from 'bip39';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { deriveMasterKey, deriveAccountId } from '../../services/crypto';
import { THAI_WORDLIST } from '../../services/wordlists/thai';
import { useOnboarding } from './OnboardingContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Confirm'>;

const MAX_SUGGESTIONS = 3;
const THAI_ORDINALS = ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ', 'สิบเอ็ด', 'สิบสอง'];

export function ConfirmScreen({ navigation }: Props) {
  const { passphrase, confirmPositions, passphraseLanguage, setMasterKeyHex, clearPassphrase } = useOnboarding();
  const targetWords = useMemo(() => passphrase?.split(' ') ?? [], [passphrase]);
  const wordlist = passphraseLanguage === 'th' ? THAI_WORDLIST : wordlists.english;

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [activePosition, setActivePosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => {
    if (activePosition === null) return [];
    const query = (answers[activePosition] ?? '').trim().toLowerCase();
    if (!query) return [];
    return wordlist.filter((w) => w.startsWith(query)).slice(0, MAX_SUGGESTIONS);
  }, [activePosition, answers, wordlist]);

  const allFilled = confirmPositions.every((p) => (answers[p] ?? '').trim().length > 0);

  const handleConfirm = async () => {
    setError(null);
    const correct = confirmPositions.every(
      (p) => (answers[p] ?? '').trim().toLowerCase() === targetWords[p - 1]
    );
    if (!correct) {
      setError('คำที่พิมพ์ไม่ตรงกับที่จดไว้ ลองตรวจสอบอีกครั้ง');
      return;
    }
    if (!passphrase) return;

    setBusy(true);
    try {
      const { masterKeyHex, kdf } = await deriveMasterKey(passphrase);
      const accountId = deriveAccountId(masterKeyHex);
      setMasterKeyHex(masterKeyHex); // SetPin/DMS Setup may still need it — cleared once DMS Setup finishes/skips
      clearPassphrase(); // done with the passphrase itself either way
      navigation.navigate('SetPin', { accountId, kdf });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <ScreenHeader step={3} totalSteps={4} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>ยืนยัน 3 คำ</Text>
        <Text style={styles.subtitle}>
          เพื่อยืนยันว่าคุณจดไว้จริง ระบบสุ่มถามตำแหน่งที่ {confirmPositions.join(', ')}
        </Text>

        {confirmPositions.map((position) => (
          <View key={position} style={styles.field}>
            <Text style={styles.fieldLabel}>คำที่ {String(position).padStart(2, '0')}</Text>
            <TextInput
              value={answers[position] ?? ''}
              onChangeText={(text) => setAnswers((prev) => ({ ...prev, [position]: text }))}
              onFocus={() => setActivePosition(position)}
              placeholder={`พิมพ์คำที่${THAI_ORDINALS[position - 1] ?? position}`}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {activePosition === position && suggestions.length > 0 && (
              <View style={styles.suggestionRow}>
                {suggestions.map((word) => (
                  <Pressable
                    key={word}
                    accessibilityRole="button"
                    style={styles.suggestionChip}
                    onPress={() => setAnswers((prev) => ({ ...prev, [position]: word }))}
                  >
                    <Text style={styles.suggestionText}>{word}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}

        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.footnote}>ตัวช่วยเติมคำจาก BIP-39 wordlist ทำงานในเครื่อง</Text>
      </ScrollView>

      <PrimaryButton label={busy ? 'กำลังตรวจสอบ…' : 'ยืนยัน'} disabled={!allFilled || busy} onPress={handleConfirm} />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  // Padding lives here, on an inner View, not on SafeAreaView itself — see
  // the identical comment in DoneScreen.tsx for why.
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { ...typography.title, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.subtitle, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.lg },
  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...typography.mono,
  },
  suggestionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  suggestionChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  suggestionText: { ...typography.body, fontSize: 15, color: colors.textPrimary },
  error: { color: colors.dangerText, marginBottom: spacing.md },
  footnote: { ...typography.body, fontSize: 16, color: colors.textMuted, marginBottom: spacing.lg },
});
