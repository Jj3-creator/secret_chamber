// Screen 1.3 — 12-WORD PASSPHRASE
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
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

function buildBackupSheetHtml(words: string[]): string {
  const rows = words
    .map((w, i) => `<tr><td style="padding:6px 12px;color:#888">${String(i + 1).padStart(2, '0')}</td><td style="padding:6px 12px;font-weight:600">${w}</td></tr>`)
    .join('');
  return `
    <html><body style="font-family:sans-serif;padding:24px">
      <h2>Secret Chamber — แผ่นสำรองกุญแจ 12 คำ</h2>
      <table style="border-collapse:collapse;margin-top:16px">${rows}</table>
      <p style="margin-top:24px;font-size:12px;color:#b00">
        แอปนี้ไม่เก็บข้อมูลใดๆ ของคุณ และไม่รับผิดชอบต่อการรั่วไหลของข้อมูลไม่ว่าจะเกิดจากสาเหตุใดก็ตาม
        รวมถึงการที่คุณพิมพ์ บันทึก หรือแชร์แผ่นนี้ไปที่อื่นเอง เก็บกระดาษนี้ไว้ในที่ปลอดภัยด้วยตัวคุณเอง
      </p>
    </body></html>`;
}

export function PassphraseScreen({ navigation }: Props) {
  const { setPassphrase, passphraseLanguage } = useOnboarding();
  const [words, setWords] = useState<string[] | null>(null);
  // Default HIDDEN per the design ("ค่าเริ่มต้นคือซ่อนคำทั้งหมด กดเพื่อเปิดดูทีละส่วน") — a
  // previous version of this screen defaulted to shown, which was a bug, not a design choice.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    generatePassphrase(passphraseLanguage).then((phrase) => {
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

  const handleCopy = async () => {
    if (!words) return;
    await Clipboard.setStringAsync(words.join(' '));
    Alert.alert('คัดลอกแล้ว', 'คัดลอก 12 คำไปยังคลิปบอร์ดแล้ว — ล้างคลิปบอร์ดเองหลังนำไปเก็บที่ปลอดภัย');
  };

  const handlePrint = async () => {
    if (!words) return;
    try {
      await Print.printAsync({ html: buildBackupSheetHtml(words) });
    } catch {
      Alert.alert('พิมพ์ไม่สำเร็จ', 'อุปกรณ์นี้ไม่รองรับการพิมพ์ ลองใช้ปุ่มคัดลอกแทน');
    }
  };

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

      <PrimaryButton
        variant="secondary"
        label={revealed ? 'ซ่อนคำ' : 'แสดงคำ'}
        onPress={() => setRevealed((v) => !v)}
        style={styles.revealButton}
      />

      <View style={styles.actionsRow}>
        <PrimaryButton variant="secondary" label="คัดลอก" onPress={handleCopy} disabled={!words} style={styles.actionButton} />
        <PrimaryButton
          variant="secondary"
          label="พิมพ์แผ่นสำรอง"
          onPress={handlePrint}
          disabled={!words}
          style={styles.actionButton}
        />
      </View>

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          แอปนี้ไม่เก็บข้อมูลใดๆ ของคุณ และไม่รับผิดชอบต่อการรั่วไหลของข้อมูล ไม่ว่าจะเกิดจากสาเหตุใดก็ตาม
          รวมถึงกรณีที่คุณคัดลอก พิมพ์ บันทึกภาพหน้าจอ หรือแชร์ข้อมูลนี้ไปที่อื่นด้วยตัวเอง
        </Text>
      </View>

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
  grid: { marginBottom: spacing.md },
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
  revealButton: { marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionButton: { flex: 1 },
  disclaimerBox: {
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  disclaimerText: { ...typography.body, fontSize: 12, color: colors.dangerText, lineHeight: 18 },
});
