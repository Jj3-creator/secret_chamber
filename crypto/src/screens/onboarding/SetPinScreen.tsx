// Screen 1.5 — ตั้ง PIN ปลดล็อก (not part of the original design's numbered
// screens as a standalone step, but exactly the gap DoneScreen's own
// comment used to flag: "ยังไม่ได้สร้างหน้า 1.5 ตั้ง Real/Decoy PIN").
//
// Feedback: typing the 12-word passphrase every time you open the app is
// a lot to ask for daily use ("จำ password แค่ตัวเดียวได้ไม๊"). Answer:
// keep the 12 words as the root key (setup + recovery only), and let a
// short PIN unlock THIS device day-to-day instead — see deviceLock.ts for
// how the PIN never touches the server and the 12 words are never stored
// anywhere, only their derived key, wrapped under the PIN.
//
// This is a Real-PIN-only version of vault.ts's setupDualPin — the Decoy
// PIN half of that design (a second PIN opening a harmless decoy vault)
// is a separate, bigger feature (needs its own decoy-vault UI) and isn't
// wired in here; this screen only solves "remember one short thing
// instead of 12 words", which is what was actually asked for.
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { derivePinKey, wrapVaultKey } from '../../services/vault';
import { saveDeviceLock } from '../../services/deviceLock';
import { useOnboarding } from './OnboardingContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetPin'>;

const MIN_PIN_LENGTH = 4;

export function SetPinScreen({ navigation, route }: Props) {
  const { accountId, kdf } = route.params;
  const { masterKeyHex } = useOnboarding();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const goNext = () => navigation.navigate('Personalize', { accountId, kdf });

  const handleSkip = () => goNext();

  const handleSetPin = async () => {
    if (!masterKeyHex) {
      appAlert('ผิดพลาด', 'ไม่พบกุญแจสำหรับตั้งค่า — ลองเริ่มใหม่จากขั้นตอนสร้างห้อง');
      return;
    }
    if (pin.length < MIN_PIN_LENGTH) {
      appAlert('สั้นเกินไป', `PIN ต้องมีอย่างน้อย ${MIN_PIN_LENGTH} ตัวอักษร`);
      return;
    }
    if (pin !== confirmPin) {
      appAlert('ไม่ตรงกัน', 'PIN ทั้งสองช่องต้องเหมือนกัน');
      return;
    }

    setSubmitting(true);
    try {
      const pinKey = await derivePinKey(pin);
      const wrapped = await wrapVaultKey(masterKeyHex, pinKey.masterKeyHex);
      await saveDeviceLock({
        accountId,
        wrapped,
        saltHex: pinKey.saltHex,
        kdf: pinKey.kdf,
        iterations: pinKey.iterations,
      });
      goNext();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      appAlert('ตั้งค่าไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Same short-screen overflow fix as PassphraseScreen/DoneScreen/
            WelcomeScreen — content scrolls, both buttons stay reachable. */}
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>ตั้ง PIN ปลดล็อก</Text>
          <Text style={styles.subtitle}>
            จำ PIN สั้นๆ นี้ไว้ปลดล็อกเข้าห้องบนเครื่องนี้ทุกวัน โดยไม่ต้องพิมพ์ 12 คำซ้ำ — 12 คำที่จดไว้ยังต้องเก็บรักษาไว้เหมือนเดิม
            (ใช้ตอนกู้คืนห้องบนเครื่องใหม่ หรือถ้าลืม PIN)
          </Text>

          <Text style={styles.fieldLabel}>ตั้ง PIN (อย่างน้อย {MIN_PIN_LENGTH} ตัว)</Text>
          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="เช่น 194829"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>พิมพ์ PIN อีกครั้ง</Text>
          <TextInput
            value={confirmPin}
            onChangeText={setConfirmPin}
            placeholder="พิมพ์ PIN เดิมอีกครั้ง"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />
        </ScrollView>

        <PrimaryButton
          label={submitting ? 'กำลังตั้งค่า…' : 'ตั้ง PIN และดำเนินต่อ'}
          onPress={handleSetPin}
          disabled={submitting}
          style={styles.confirmButton}
        />
        <PrimaryButton
          variant="secondary"
          label="ข้ามไปก่อน (พิมพ์ 12 คำทุกครั้งที่เข้าห้อง)"
          onPress={handleSkip}
          disabled={submitting}
          style={styles.skipButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  // Padding lives here, on an inner View, not on SafeAreaView itself — see
  // the identical comment in DoneScreen.tsx for why.
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  title: { ...typography.title, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, fontSize: 15, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.xl },
  fieldLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    ...typography.mono,
  },
  scrollArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  confirmButton: { marginTop: spacing.sm },
  skipButton: { marginTop: spacing.sm },
});
