// Screen 1.1 — WELCOME
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { appAlert } from '../../components/AppAlert';
import { VaultMarkIcon } from '../../components/icons';
import { colors, spacing, typography } from '../../theme/tokens';
import { useOnboarding } from './OnboardingContext';
import type { PassphraseLanguage } from '../../services/crypto';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const LANGUAGE_OPTIONS: { value: PassphraseLanguage; label: string }[] = [
  { value: 'th', label: 'ภาษาไทย' },
  { value: 'en', label: 'English' },
];

export function WelcomeScreen({ navigation }: Props) {
  const { passphraseLanguage, setPassphraseLanguage } = useOnboarding();

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      {/* Feedback: on a short real phone screen, fixed (non-scrolling)
          content above the button block could overflow with no way to
          reach the buttons — same class of bug as PassphraseScreen's.
          A flex:1 ScrollView here still lets the button block sit
          naturally at the bottom on tall screens (nothing to scroll,
          same look as before) while making it reachable by scrolling on
          short ones. */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <IconBadge size={60} style={styles.icon}>
          <VaultMarkIcon size={30} color={colors.textPrimary} />
        </IconBadge>
        <Text style={styles.title}>ห้องแห่งความลับของฉัน</Text>
        <Text style={styles.titleEn}>My Secret Chamber</Text>
        <Text style={styles.subtitle}>
          แอปนี้เก็บไฟล์ลับของคุณ โดยเข้ารหัสไว้ในมือถือคุณเองเท่านั้น{'\n'}
          ไม่มีใครเปิดดูได้ — แม้แต่คนสร้างแอปนี้ก็ตาม
        </Text>

        <Text style={styles.languageLabel}>ภาษาของกุญแจ 12 คำ (เลือกครั้งเดียวตอนสร้างห้อง)</Text>
        <View style={styles.languageRow}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = passphraseLanguage === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setPassphraseLanguage(opt.value)}
                style={[styles.languageChip, active && styles.languageChipActive]}
              >
                <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View>
        <PrimaryButton label="สร้างห้องใหม่" onPress={() => navigation.navigate('Warning')} />
        <Pressable
          style={styles.recoverLink}
          accessibilityRole="button"
          onPress={() => appAlert('กู้คืนด้วย 12 คำ', 'ฟีเจอร์นี้จะพร้อมใช้งานเร็วๆ นี้')}
        >
          <Text style={styles.recoverLinkText}>กู้คืนด้วย 12 คำ</Text>
        </Pressable>
        <Text style={styles.footnote}>ไม่เก็บอีเมล เบอร์โทร หรือข้อมูลระบุตัวตน</Text>
      </View>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  // Padding lives here, on an inner View, not on SafeAreaView itself — on
  // web, SafeAreaView applies its own safe-area padding-inline CSS that
  // can (non-deterministically, depending on atomic-CSS insertion order
  // across the app) win the cascade over padding set on the same element,
  // silently zeroing it and leaving content flush against the screen
  // edges. Splitting the two elements sidesteps the conflict.
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  icon: { marginBottom: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: 2 },
  titleEn: { ...typography.body, fontSize: 16, color: colors.textMuted, marginBottom: spacing.md },
  subtitle: { ...typography.subtitle, color: colors.textSecondary, marginBottom: spacing.xl },
  languageLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
  languageChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  languageChipActive: { borderColor: colors.accentTeal, backgroundColor: 'rgba(127,166,177,0.12)' },
  languageChipText: { ...typography.body, fontSize: 16, color: colors.textSecondary },
  languageChipTextActive: { color: colors.textPrimary, fontWeight: '600' },
  recoverLink: { alignItems: 'center', paddingVertical: spacing.md },
  recoverLinkText: { ...typography.body, fontSize: 16, color: colors.accentTeal },
  footnote: { ...typography.body, fontSize: 16, color: colors.textMuted, textAlign: 'center' },
});
