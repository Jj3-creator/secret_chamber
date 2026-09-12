// Landing screen right after onboarding completes — reached after the
// optional SetPin and DMSSetup steps.
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ThemedBackground } from '../../components/ThemedBackground';
import { colors, spacing, typography } from '../../theme/tokens';
import { useRoomTheme } from '../../theme/RoomThemeContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Done'>;

export function DoneScreen({ route, navigation }: Props) {
  const { accountId, kdf } = route.params;
  const [showTechDetails, setShowTechDetails] = useState(false);
  const { accentColor, backgroundColor } = useRoomTheme();

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
    {/* Padding lives on this inner View, not on SafeAreaView itself — on
        web, SafeAreaView applies its own safe-area padding-inline CSS
        that can win the cascade over horizontal padding set directly on
        the same element (observed: paddingHorizontal silently computed
        to 0 when set alongside justifyContent on the SafeAreaView here),
        leaving text flush against the screen edges. Every other screen in
        this flow puts padding + justifyContent on the SafeAreaView itself
        with no problem, so this split is a defensive fix scoped to this
        screen's exact combination rather than a change applied everywhere. */}
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>สร้างห้องลับของคุณสำเร็จแล้ว</Text>
        <Text style={styles.reassurance}>
          จำ 12 คำที่จดไว้ให้ดี — แค่นั้นพอ ไม่ต้องจดอะไรเพิ่มอีกแล้ว ระบบคำนวณทุกอย่างใหม่ได้เสมอจาก 12 คำนี้
        </Text>

        <Pressable onPress={() => setShowTechDetails((v) => !v)} accessibilityRole="button">
          <Text style={[styles.techToggle, { color: accentColor }]}>
            {showTechDetails ? 'ซ่อนรายละเอียดทางเทคนิค' : 'ดูรายละเอียดทางเทคนิค'}
          </Text>
        </Pressable>
        {showTechDetails && (
          <View style={styles.techBox}>
            <Text style={styles.techLabel}>รหัสห้อง (คำนวณจาก 12 คำ — ไม่ต้องจดแยก):</Text>
            <Text style={styles.techValue} numberOfLines={2}>
              {accountId}
            </Text>
            <Text style={styles.techLabel}>วิธีเข้ารหัส: {kdf}</Text>
          </View>
        )}
      </View>
      <PrimaryButton
        label="เข้าห้องลับของฉัน (My Secret Chamber)"
        onPress={() => navigation.navigate('VaultHome', { accountId })}
      />
      </View>
    </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  textBlock: { flex: 1, justifyContent: 'center' },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  reassurance: { ...typography.body, fontSize: 16, color: colors.textSecondary, lineHeight: 21, marginBottom: spacing.xl },
  techToggle: { ...typography.body, fontSize: 15, color: colors.accentTeal, marginBottom: spacing.md },
  techBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  techLabel: { ...typography.body, fontSize: 16, color: colors.textMuted, marginBottom: 4 },
  techValue: { ...typography.mono, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm },
});
