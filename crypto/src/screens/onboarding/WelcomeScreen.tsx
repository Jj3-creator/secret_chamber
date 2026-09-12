// Screen 1.1 — WELCOME
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.iconPlaceholder} />
      <View style={styles.textBlock}>
        <Text style={styles.title}>Secret Chamber</Text>
        <Text style={styles.subtitle}>
          พื้นที่เก็บไฟล์ที่เข้ารหัสในเครื่องคุณ ไม่มีบัญชี ไม่มีเซิร์ฟเวอร์ที่อ่านข้อมูลได้
        </Text>
      </View>
      <PrimaryButton label="สร้างห้องใหม่" onPress={() => navigation.navigate('Warning')} />
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
  iconPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xxl,
  },
  textBlock: { flex: 1, justifyContent: 'center' },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  subtitle: { ...typography.subtitle, color: colors.textSecondary },
});
