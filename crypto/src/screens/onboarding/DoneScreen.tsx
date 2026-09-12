// Placeholder landing screen after onboarding completes. Not part of the
// "1. Onboarding / Register" design section (screens 1.1-1.4 end at
// Confirm) — Vault Home hasn't been designed/built yet. This just proves
// the pipeline produced a real account_id and shows which KDF ran.
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Done'>;

export function DoneScreen({ route }: Props) {
  const { accountId, kdf } = route.params;
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>ห้องถูกสร้างแล้ว</Text>
      <Text style={styles.subtitle}>account_id (สร้างในเครื่อง — ค่าเดียวที่ส่งให้ server):</Text>
      <Text style={styles.accountId} numberOfLines={2}>
        {accountId}
      </Text>
      <Text style={styles.note}>key derivation: {kdf}</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>
          (หน้านี้เป็น placeholder — หน้าจอ Vault Home ยังไม่ได้ออกแบบ/สร้าง)
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.lg },
  subtitle: { ...typography.body, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  accountId: { ...typography.mono, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.md },
  note: { ...typography.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.xxl },
  placeholderBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  placeholderText: { ...typography.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
});
