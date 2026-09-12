// Screen 1.2 — คำเตือนก่อนสร้าง (warning before creating)
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Checkbox } from '../../components/Checkbox';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Warning'>;

const ACKNOWLEDGEMENTS = [
  'ฉันเข้าใจว่าถ้าทำ 12 คำนี้หาย ไฟล์ทั้งหมดจะเข้าถึงไม่ได้อย่างถาวร',
  'ฉันเข้าใจว่าการคัดลอก พิมพ์ หรือบันทึกภาพหน้าจอ 12 คำนี้เป็นความเสี่ยงของฉันเอง แอปไม่รับผิดชอบหากข้อมูลรั่วไหล',
  'ฉันเข้าใจว่าแอปนี้ไม่สำรองข้อมูลให้อัตโนมัติ',
];

export function WarningScreen({ navigation }: Props) {
  const [checked, setChecked] = useState<boolean[]>(ACKNOWLEDGEMENTS.map(() => false));
  const allChecked = checked.every(Boolean);

  const toggle = (i: number) => setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader step={1} totalSteps={4} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>ลืมแล้วกู้คืนไม่ได้</Text>
          <Text style={styles.warningBody}>
            กุญแจถอดรหัสสร้างจาก 12 คำนี้เท่านั้น เราไม่เก็บสำเนา ไม่มีปุ่ม "ลืมรหัส" ไม่มีเจ้าหน้าที่ช่วยกู้คืน
          </Text>
        </View>
        <View style={styles.checkboxGroup}>
          {ACKNOWLEDGEMENTS.map((label, i) => (
            <Checkbox key={label} checked={checked[i]} onToggle={() => toggle(i)} label={label} />
          ))}
        </View>
      </ScrollView>
      <PrimaryButton
        label="เข้าใจแล้ว สร้างต่อ"
        disabled={!allChecked}
        onPress={() => navigation.navigate('Passphrase')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  scroll: { paddingBottom: spacing.lg },
  warningBox: {
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningTitle: { ...typography.label, fontSize: 16, color: colors.dangerText, marginBottom: spacing.xs },
  warningBody: { ...typography.body, color: colors.dangerText, lineHeight: 21 },
  checkboxGroup: { marginTop: spacing.sm },
});
