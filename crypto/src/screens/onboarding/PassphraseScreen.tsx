// Screen 1.3 — 12-WORD PASSPHRASE
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { generatePassphrase } from '../../services/crypto';
import { useOnboarding } from './OnboardingContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Passphrase'>;

/** 3 distinct positions out of 12, sorted ascending — what Confirm will ask about. */
function pickConfirmPositions(): number[] {
  const pool = Array.from({ length: 12 }, (_, i) => i + 1);
  const picked: number[] = [];
  while (picked.length < 3) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

export function PassphraseScreen({ navigation }: Props) {
  const { setPassphrase } = useOnboarding();
  const [words, setWords] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    generatePassphrase().then((phrase) => {
      if (cancelled) return;
      setWords(phrase.split(' '));
      setPassphrase(phrase, pickConfirmPositions());
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount only — regenerating on every render would hand the
    // user a different phrase than the one Confirm is checking against.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!words) return [];
    const pairs: [string, string][] = [];
    for (let i = 0; i < words.length; i += 2) pairs.push([words[i], words[i + 1]]);
    return pairs;
  }, [words]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader step={2} totalSteps={4} onBack={() => navigation.goBack()} />
      <Text style={styles.title}>จด 12 คำนี้ตามลำดับ</Text>
      <Text style={styles.subtitle}>สร้างบนเครื่องคุณแบบออฟไลน์ ไม่ถูกส่งออกไปที่ไหน</Text>

      <View style={styles.grid}>
        {rows.map(([left, right], rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            <WordCell index={rowIdx * 2 + 1} word={left} revealed={revealed} />
            <WordCell index={rowIdx * 2 + 2} word={right} revealed={revealed} />
          </View>
        ))}
      </View>

      <View style={styles.actionsRow}>
        <PrimaryButton
          variant="secondary"
          label={revealed ? 'ซ่อนคำ' : 'แสดงคำ'}
          onPress={() => setRevealed((v) => !v)}
          style={styles.actionButton}
        />
        <PrimaryButton
          variant="secondary"
          label="พิมพ์แผ่นสำรอง"
          onPress={() => Alert.alert('พิมพ์แผ่นสำรอง', 'ยังไม่รองรับในเดโมนี้ — ใช้การจดด้วยลายมือไปก่อน')}
          style={styles.actionButton}
        />
      </View>

      <Text style={styles.footnote}>ปิดการจับภาพหน้าจอในหน้านี้ และไม่มีปุ่มคัดลอกไปคลิปบอร์ด</Text>

      <PrimaryButton label="จดครบแล้ว ยืนยันคำ" disabled={!words} onPress={() => navigation.navigate('Confirm')} />
    </SafeAreaView>
  );
}

function WordCell({ index, word, revealed }: { index: number; word: string; revealed: boolean }) {
  return (
    <View style={styles.wordCell}>
      <Text style={styles.wordIndex}>{String(index).padStart(2, '0')}</Text>
      <Text style={styles.wordText}>{revealed ? word : '••••••'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  title: { ...typography.title, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.subtitle, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  grid: { marginBottom: spacing.lg },
  gridRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  wordCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  wordIndex: { ...typography.label, color: colors.textMuted, fontSize: 12 },
  wordText: { ...typography.mono, color: colors.textPrimary },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionButton: { flex: 1 },
  footnote: { ...typography.body, fontSize: 12, color: colors.textMuted, marginBottom: spacing.lg },
});
