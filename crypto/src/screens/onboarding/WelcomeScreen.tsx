// Screen 1.1 — WELCOME
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { VaultMarkIcon } from '../../components/icons';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
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
  subtitle: { ...typography.subtitle, color: colors.textSecondary },
  recoverLink: { alignItems: 'center', paddingVertical: spacing.md },
  recoverLinkText: { ...typography.body, fontSize: 14, color: colors.accentTeal },
  footnote: { ...typography.body, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
