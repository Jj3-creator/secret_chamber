// Exit / close-room page — item 21's "ยังขาด exit page" /
// "มีหน้าปิดสุดท้าย เตือนอีกครั้งว่า ... creator ไม่สามารถดึงหรือกู้ข้อมูล
// อะไรให้ท่านได้ทั้งนั้น". Reached from VaultHomeScreen's lock icon
// (replaces the earlier inline appConfirm dialog with a full page, since
// this warning deserves more room and more deliberate confirmation than
// a popup allows).
//
// Closing the room means: drop the in-memory master key
// (VaultSessionContext) and go back to Unlock (if this device has a PIN
// set up) or all the way to Welcome. Nothing is deleted — the encrypted
// data on the server and the device's PIN wrapping are untouched; this
// only ends the current unlocked session.
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { ThemedBackground } from '../../components/ThemedBackground';
import { DoorExitIcon } from '../../components/icons';
import { colors, spacing, typography } from '../../theme/tokens';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { useVaultSession } from './VaultSessionContext';
import { loadDeviceLock } from '../../services/deviceLock';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Exit'>;

export function ExitScreen({ navigation }: Props) {
  const { accentColor, backgroundColor } = useRoomTheme();
  const { setMasterKeyHex } = useVaultSession();
  const [closing, setClosing] = useState(false);

  const handleCloseRoom = async () => {
    setClosing(true);
    try {
      // Zero the in-memory master key — same "zero memory traces"
      // reasoning as everywhere else in this app: never leave the real
      // key sitting in context after the room is meant to be closed.
      setMasterKeyHex(null);
      const lock = await loadDeviceLock();
      navigation.reset({ index: 0, routes: [lock ? { name: 'Unlock' } : { name: 'Welcome' }] });
    } finally {
      setClosing(false);
    }
  };

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.iconWrap}>
              <IconBadge size={64} tint={accentColor}>
                <DoorExitIcon size={30} color={colors.textPrimary} />
              </IconBadge>
            </View>
            <Text style={styles.title}>ปิดห้องลับ</Text>

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>คำเตือนอีกครั้ง</Text>
              <Text style={styles.warningText}>
                ผู้ดูแล/ผู้สร้างแอปนี้ ไม่สามารถดึงหรือกู้ข้อมูลใดๆ ให้ท่านได้ทั้งสิ้น ท่านต้องเก็บรักษา PIN และรหัสกุญแจ 12 คำ
                ด้วยตัวเองอย่างระมัดระวัง — หากลืมทั้งสองอย่าง ข้อมูลในห้องนี้จะไม่มีทางกู้คืนได้อีก
              </Text>
            </View>

            <Text style={styles.note}>
              การปิดห้องเพียงแค่ออกจากรอบการใช้งานนี้ ข้อมูลที่เข้ารหัสไว้ในห้องยังอยู่ครบ — ครั้งหน้าเข้าห้องได้เหมือนเดิมด้วย PIN
              หรือรหัสกุญแจ 12 คำ
            </Text>
          </ScrollView>

          <PrimaryButton
            label={closing ? 'กำลังปิดห้อง…' : 'ปิดห้อง'}
            onPress={handleCloseRoom}
            disabled={closing}
            style={styles.closeButton}
          />
          <PrimaryButton
            label="ยกเลิก กลับไปหน้าห้อง"
            variant="secondary"
            onPress={() => navigation.goBack()}
            disabled={closing}
          />
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  iconWrap: { marginBottom: spacing.lg, marginTop: spacing.lg },
  title: { ...typography.title, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.lg, textAlign: 'center' },
  warningBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerText,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    width: '100%',
  },
  warningTitle: { ...typography.label, fontSize: 16, color: colors.dangerText, marginBottom: spacing.sm },
  warningText: { ...typography.body, fontSize: 16, color: colors.textPrimary, lineHeight: 22 },
  note: { ...typography.body, fontSize: 14, color: colors.textMuted, lineHeight: 20, textAlign: 'center' },
  closeButton: { marginBottom: spacing.sm },
});
