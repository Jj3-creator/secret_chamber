// Screen 1.1 — WELCOME
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
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
    <SafeAreaView style={styles.container}>
      <IconBadge size={60} style={styles.icon}>
        <VaultMarkIcon size={30} color={colors.textPrimary} />
      </IconBadge>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Secret Chamber</Text>
        <Text style={styles.subtitle}>
          พื้นที่เก็บไฟล์ที่เข้ารหัสในเครื่องคุณ ไม่มีบัญชี ไม่มีเซิร์ฟเวอร์ที่อ่านข้อมูลได้
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
      </View>
      <View>
        <PrimaryButton label="สร้างห้องใหม่" onPress={() => navigation.navigate('Warning')} />
        <Pressable
          style={styles.recoverLink}
          accessibilityRole="button"
          onPress={() => Alert.alert('กู้คืนด้วย 12 คำ', 'หน้ากู้คืน (section 02) ยังไม่ได้สร้าง')}
        >
          <Text style={styles.recoverLinkText}>กู้คืนด้วย 12 คำ</Text>
        </Pressable>
        <Text style={styles.footnote}>ไม่เก็บอีเมล เบอร์โทร หรือข้อมูลระบุตัวตน</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  icon: { marginTop: spacing.xxl },
  textBlock: { flex: 1, justifyContent: 'center' },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  subtitle: { ...typography.subtitle, color: colors.textSecondary, marginBottom: spacing.xl },
  languageLabel: { ...typography.label, fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
  languageChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  languageChipActive: { borderColor: colors.accentTeal, backgroundColor: 'rgba(127,166,177,0.12)' },
  languageChipText: { ...typography.body, fontSize: 14, color: colors.textSecondary },
  languageChipTextActive: { color: colors.textPrimary, fontWeight: '600' },
  recoverLink: { alignItems: 'center', paddingVertical: spacing.md },
  recoverLinkText: { ...typography.body, fontSize: 14, color: colors.accentTeal },
  footnote: { ...typography.body, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
