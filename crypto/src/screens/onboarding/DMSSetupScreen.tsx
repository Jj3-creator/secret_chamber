// DMS Setup (optional) — configures the Dead Man's Switch: check-in
// period + 2-3 guardians, each getting one Shamir share of the master
// key. Maps to design screens 1.5/5.1/5.2, built as one combined step
// since 1.5/5.x aren't separately built yet.
//
// Real crypto + real backend calls (vault.ts's createRecoveryShares +
// wrapVaultKey, backend.ts's setupDms — the same dms-setup Edge Function
// tested in Part 2). What's NOT real: actually notifying anyone by SMS/
// LINE — that needs a third-party provider (Twilio, LINE Messaging API)
// and API keys this session doesn't have. What this screen produces
// instead is a recovery token per guardian, which the owner hands over
// out-of-band (print it, say it, write it down) — exactly like handing
// someone a physical spare key.
//
// Guardian key design: rather than requiring each guardian to have their
// own pre-existing app account/PIN (a much bigger feature), the random
// recovery token IS the guardian's credential — it both authenticates
// their dms-request-share call AND (via deriveMasterKey) derives the key
// that unwraps their share. Knowing the token is sufficient and necessary;
// nothing else to set up on the guardian's side.
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ScrollView, Switch, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ThemedBackground } from '../../components/ThemedBackground';
import { colors, spacing, typography } from '../../theme/tokens';
import { generateRandomToken, sha256Hex, deriveMasterKey } from '../../services/crypto';
import { createRecoveryShares, wrapVaultKey } from '../../services/vault';
import { setupDms } from '../../services/backend';
import { useOnboarding } from './OnboardingContext';
import { useRoomTheme } from '../../theme/RoomThemeContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DMSSetup'>;

const PERIOD_OPTIONS = [
  { label: '7 วัน', hours: 7 * 24 },
  { label: '14 วัน', hours: 14 * 24 },
  { label: '30 วัน', hours: 30 * 24 },
  { label: '90 วัน', hours: 90 * 24 },
  { label: '180 วัน', hours: 180 * 24 },
];

const MIN_GUARDIANS = 2;
const MAX_GUARDIANS = 3;

interface RevealedGuardian {
  nickname: string;
  token: string;
}

export function DMSSetupScreen({ navigation, route }: Props) {
  const { accountId, kdf } = route.params;
  const { masterKeyHex, clear } = useOnboarding();
  const { accentColor, backgroundColor } = useRoomTheme();

  const [enabled, setEnabled] = useState(false);
  const [periodHours, setPeriodHours] = useState(PERIOD_OPTIONS[1].hours); // 14 days default
  const [guardianNames, setGuardianNames] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState<RevealedGuardian[] | null>(null);

  const addGuardian = () => {
    if (guardianNames.length < MAX_GUARDIANS) setGuardianNames((prev) => [...prev, '']);
  };
  const removeGuardian = (i: number) => {
    if (guardianNames.length > MIN_GUARDIANS) setGuardianNames((prev) => prev.filter((_, idx) => idx !== i));
  };
  const updateGuardian = (i: number, value: string) =>
    setGuardianNames((prev) => prev.map((v, idx) => (idx === i ? value : v)));

  const finish = () => {
    clear(); // done with masterKeyHex either way
    navigation.navigate('Done', { accountId, kdf });
  };

  const handleSkip = () => finish();

  const handleSetup = async () => {
    if (!masterKeyHex) {
      Alert.alert('ผิดพลาด', 'ไม่พบกุญแจสำหรับตั้งค่า — ลองเริ่มใหม่จากขั้นตอนสร้างห้อง');
      return;
    }
    const names = guardianNames.map((n) => n.trim());
    if (names.some((n) => !n) || names.length < MIN_GUARDIANS) {
      Alert.alert('กรอกไม่ครบ', `ใส่ชื่อผู้รับอย่างน้อย ${MIN_GUARDIANS} คน`);
      return;
    }

    setSubmitting(true);
    try {
      const tokens = await Promise.all(names.map(() => generateRandomToken()));
      const { shares } = await createRecoveryShares(masterKeyHex, {
        guardians: names.length,
        threshold: MIN_GUARDIANS,
      });
      const guardianKeys = await Promise.all(tokens.map((t) => deriveMasterKey(t)));
      const wrapped = await Promise.all(
        shares.map((s, i) => wrapVaultKey(s.valueHex, guardianKeys[i].masterKeyHex))
      );

      await setupDms(
        accountId,
        periodHours,
        shares.map((s, i) => ({
          shareIndex: s.index,
          tokenHash: sha256Hex(tokens[i]),
          wrapped: wrapped[i],
        }))
      );

      setRevealed(names.map((nickname, i) => ({ nickname, token: tokens[i] })));
    } catch {
      Alert.alert('ตั้งค่าไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyToken = async (token: string) => {
    await Clipboard.setStringAsync(token);
    Alert.alert('คัดลอกแล้ว', 'ส่งรหัสนี้ให้ผู้รับด้วยตัวเอง (นอกแอป) แล้วลบออกจากคลิปบอร์ดของคุณ');
  };

  if (revealed) {
    return (
      <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <Text style={styles.title}>รหัสสำหรับผู้รับแต่ละคน</Text>
          <Text style={styles.subtitle}>
            แสดงครั้งเดียวเท่านั้น — คัดลอกส่งให้แต่ละคนด้วยตัวเอง (นอกแอป) ระบบไม่เก็บรหัสนี้ซ้ำอีก
          </Text>
          {revealed.map((g) => (
            <View key={g.nickname} style={styles.tokenCard}>
              <Text style={styles.tokenNickname}>{g.nickname}</Text>
              <Text style={styles.tokenValue} numberOfLines={2}>
                {g.token}
              </Text>
              <PrimaryButton variant="secondary" label="คัดลอก" onPress={() => handleCopyToken(g.token)} />
            </View>
          ))}
        </ScrollView>
        <PrimaryButton label="เสร็จสิ้น" onPress={finish} />
      </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
    <SafeAreaView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>ตั้งค่า Dead Man's Switch (ไม่บังคับ)</Text>
        <Text style={styles.subtitle}>
          ถ้าคุณไม่เช็คอินนานเกินกำหนด ระบบจะเริ่มปล่อยกุญแจให้ผู้รับที่ตั้งไว้ (ต้องมีอย่างน้อย 2 ใน{' '}
          {guardianNames.length} คนร่วมกันถึงจะกู้คืนได้)
        </Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>เปิดใช้งาน</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>

        {enabled && (
          <>
            <Text style={styles.fieldLabel}>รอบเช็คอิน</Text>
            <View style={styles.periodRow}>
              {PERIOD_OPTIONS.map((opt) => {
                const active = periodHours === opt.hours;
                return (
                  <Pressable
                    key={opt.hours}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setPeriodHours(opt.hours)}
                    style={[styles.periodChip, active && { borderColor: accentColor, backgroundColor: `${accentColor}1F` }]}
                  >
                    <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>ผู้รับ (อย่างน้อย {MIN_GUARDIANS} คน)</Text>
            {guardianNames.map((name, i) => (
              <View key={i} style={styles.guardianRow}>
                <TextInput
                  value={name}
                  onChangeText={(v) => updateGuardian(i, v)}
                  placeholder={`ชื่อผู้รับคนที่ ${i + 1}`}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
                {guardianNames.length > MIN_GUARDIANS && (
                  <Pressable onPress={() => removeGuardian(i)} accessibilityRole="button" style={styles.removeButton}>
                    <Text style={styles.removeButtonText}>ลบ</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {guardianNames.length < MAX_GUARDIANS && (
              <Pressable onPress={addGuardian} accessibilityRole="button" style={styles.addLink}>
                <Text style={styles.addLinkText}>+ เพิ่มผู้รับ</Text>
              </Pressable>
            )}

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                แอปนี้ไม่ส่ง SMS หรือ LINE แจ้งผู้รับให้อัตโนมัติ — คุณต้องคัดลอกรหัสที่จะแสดงในขั้นถัดไปแล้วส่งให้แต่ละคนด้วยตัวเอง
                (นอกแอป) เอง
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleSkip} accessibilityRole="button" style={styles.skipLink}>
          <Text style={styles.skipLinkText}>ข้ามขั้นตอนนี้ไปก่อน</Text>
        </Pressable>
        {enabled && (
          <PrimaryButton
            label={submitting ? 'กำลังตั้งค่า…' : 'ตั้งค่าและสร้างรหัส'}
            onPress={handleSetup}
            disabled={submitting}
          />
        )}
      </View>
    </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...typography.title, fontSize: 19, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.lg },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  toggleLabel: { ...typography.body, fontSize: 15, color: colors.textPrimary },
  fieldLabel: { ...typography.label, fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  periodChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  periodChipActive: { borderColor: colors.accentTeal, backgroundColor: 'rgba(127,166,177,0.12)' },
  periodChipText: { ...typography.body, fontSize: 13, color: colors.textSecondary },
  periodChipTextActive: { color: colors.textPrimary, fontWeight: '600' },
  guardianRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  removeButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  removeButtonText: { ...typography.body, fontSize: 13, color: colors.dangerText },
  addLink: { marginBottom: spacing.lg },
  addLinkText: { ...typography.body, fontSize: 14, color: colors.accentTeal },
  noteBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  noteText: { ...typography.body, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  footer: { gap: spacing.sm },
  skipLink: { alignItems: 'center', paddingVertical: spacing.sm },
  skipLinkText: { ...typography.body, fontSize: 13, color: colors.textMuted },
  tokenCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tokenNickname: { ...typography.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  tokenValue: { ...typography.mono, fontSize: 12, color: colors.textSecondary },
});
