// Landing screen right after onboarding completes. The design's section 1
// actually continues to 1.5 (set Real + Decoy PIN) before reaching the
// dashboard — not built yet — so this offers a direct shortcut into
// VaultHome, clearly marked as a temporary bridge rather than the real flow.
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Done'>;

export function DoneScreen({ route, navigation }: Props) {
  const { accountId, kdf } = route.params;
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>ห้องถูกสร้างแล้ว</Text>
        <Text style={styles.subtitle}>account_id (สร้างในเครื่อง — ค่าเดียวที่ส่งให้ server):</Text>
        <Text style={styles.accountId} numberOfLines={2}>
          {accountId}
        </Text>
        <Text style={styles.note}>key derivation: {kdf}</Text>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>
            (ยังไม่ได้สร้างหน้า 1.5 ตั้ง Real/Decoy PIN และหน้า Login/Unlock — ปุ่มด้านล่างข้ามไปที่ Vault Home
            ตรงๆ ชั่วคราว)
          </Text>
        </View>
      </View>
      <PrimaryButton label="ไปที่ห้องของฉัน (Vault Home)" onPress={() => navigation.navigate('VaultHome', { accountId })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'space-between' },
  textBlock: { flex: 1, justifyContent: 'center' },
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
