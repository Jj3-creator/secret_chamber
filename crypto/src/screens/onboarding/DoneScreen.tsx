// Landing screen right after onboarding completes. The design's section 1
// actually continues to 1.5 (set Real + Decoy PIN) before reaching the
// dashboard — not built yet — so this offers a direct shortcut into
// VaultHome, clearly marked as a temporary bridge rather than the real flow.
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Done'>;

export function DoneScreen({ route, navigation }: Props) {
  const { accountId, kdf } = route.params;
  const [showTechDetails, setShowTechDetails] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>สร้างห้องลับของคุณสำเร็จแล้ว</Text>
        <Text style={styles.reassurance}>
          จำ 12 คำที่จดไว้ให้ดี — แค่นั้นพอ ไม่ต้องจดอะไรเพิ่มอีกแล้ว ระบบคำนวณทุกอย่างใหม่ได้เสมอจาก 12 คำนี้
        </Text>

        <Pressable onPress={() => setShowTechDetails((v) => !v)} accessibilityRole="button">
          <Text style={styles.techToggle}>{showTechDetails ? 'ซ่อนรายละเอียดทางเทคนิค' : 'ดูรายละเอียดทางเทคนิค'}</Text>
        </Pressable>
        {showTechDetails && (
          <View style={styles.techBox}>
            <Text style={styles.techLabel}>account_id (คำนวณจาก 12 คำ — ไม่ต้องจดแยก):</Text>
            <Text style={styles.techValue} numberOfLines={2}>
              {accountId}
            </Text>
            <Text style={styles.techLabel}>key derivation: {kdf}</Text>
          </View>
        )}

        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>
            (ยังไม่ได้สร้างหน้า 1.5 ตั้ง Real/Decoy PIN และหน้า Login/Unlock — ปุ่มด้านล่างข้ามไปที่ห้องลับตรงๆ
            ชั่วคราว)
          </Text>
        </View>
      </View>
      <PrimaryButton
        label="เข้าห้องลับของฉัน (My Secret Chamber)"
        onPress={() => navigation.navigate('VaultHome', { accountId })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'space-between' },
  textBlock: { flex: 1, justifyContent: 'center' },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  reassurance: { ...typography.body, fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: spacing.xl },
  techToggle: { ...typography.body, fontSize: 13, color: colors.accentTeal, marginBottom: spacing.md },
  techBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  techLabel: { ...typography.body, fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  techValue: { ...typography.mono, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.sm },
  placeholderBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  placeholderText: { ...typography.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
});
