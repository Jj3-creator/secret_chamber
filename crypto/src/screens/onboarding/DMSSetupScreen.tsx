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
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ScrollView, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ThemedBackground } from '../../components/ThemedBackground';
import { IconBadge } from '../../components/IconBadge';
import { KeyIcon } from '../../components/icons';
import { appAlert } from '../../components/AppAlert';
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

// Feedback: forcing a minimum of 2 felt arbitrary — changed to "1 to 3,
// your choice", with the trade-off spelled out in the UI instead of
// hidden behind a hard rule. Threshold still requires 2-of-N whenever
// there's more than 1 guardian (nobody can act alone), and drops to a
// plain 1-of-1 handoff — no secret-splitting, no checks-and-balances —
// only when the user deliberately picks a single guardian.
const MIN_GUARDIANS = 1;
const MAX_GUARDIANS = 3;
function thresholdFor(guardianCount: number): number {
  return guardianCount <= 1 ? 1 : 2;
}

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
  // Preference only for now — there is no real SMS/LINE sending built (see
  // the noteBox below), so this doesn't change what the app actually does
  // yet. Kept as a separate, honestly-labeled toggle rather than silently
  // ignored, so the choice is at least recorded for when that's built.
  const [notifyEnabled, setNotifyEnabled] = useState(true);
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
      appAlert('ผิดพลาด', 'ไม่พบกุญแจสำหรับตั้งค่า — ลองเริ่มใหม่จากขั้นตอนสร้างห้อง');
      return;
    }
    const names = guardianNames.map((n) => n.trim());
    if (names.some((n) => !n) || names.length < MIN_GUARDIANS) {
      appAlert('กรอกไม่ครบ', `ใส่ชื่อผู้ถือกุญแจสำรองอย่างน้อย ${MIN_GUARDIANS} คน`);
      return;
    }

    setSubmitting(true);
    try {
      const tokens = await Promise.all(names.map(() => generateRandomToken()));
      const guardianKeys = await Promise.all(tokens.map((t) => deriveMasterKey(t)));

      // With exactly 1 guardian there's nothing to "split" — Shamir's
      // library correctly refuses a threshold below 2 (a 1-of-1 share IS
      // the secret, not a share of it). Wrap the real master key straight
      // to that one person instead; anything >= 2 guardians goes through
      // real 2-of-N secret splitting as before.
      const rows =
        names.length === 1
          ? [{ shareIndex: 1, tokenHash: sha256Hex(tokens[0]), wrapped: await wrapVaultKey(masterKeyHex, guardianKeys[0].masterKeyHex) }]
          : await (async () => {
              const { shares } = await createRecoveryShares(masterKeyHex, {
                guardians: names.length,
                threshold: thresholdFor(names.length),
              });
              const wrapped = await Promise.all(
                shares.map((s, i) => wrapVaultKey(s.valueHex, guardianKeys[i].masterKeyHex))
              );
              return shares.map((s, i) => ({
                shareIndex: s.index,
                tokenHash: sha256Hex(tokens[i]),
                wrapped: wrapped[i],
              }));
            })();

      await setupDms(accountId, periodHours, rows);

      setRevealed(names.map((nickname, i) => ({ nickname, token: tokens[i] })));
    } catch (err) {
      // Surface the real reason (e.g. the backend's own validation message)
      // instead of a generic string — a silent "try again" here is exactly
      // what made the 1-guardian backend-vs-client mismatch hard to see.
      const reason = err instanceof Error ? err.message : String(err);
      appAlert('ตั้งค่าไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyToken = async (token: string) => {
    await Clipboard.setStringAsync(token);
    appAlert('คัดลอกแล้ว', 'ส่งรหัสนี้ให้ผู้รับด้วยตัวเอง (นอกแอป) แล้วลบออกจากคลิปบอร์ดของคุณ');
  };

  if (revealed) {
    return (
      <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
      {/* Padding lives on this inner View, not on SafeAreaView — see the
          container style comment below for why. */}
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView>
          <Text style={styles.title}>รหัสกุญแจสำรองสำหรับแต่ละคน</Text>
          <Text style={styles.subtitle}>
            แสดงครั้งเดียวเท่านั้น — คัดลอกส่งให้แต่ละคนด้วยตัวเอง (นอกแอป) ระบบไม่เก็บรหัสนี้ซ้ำอีก
          </Text>
          {revealed.map((g, i) => (
            <View key={g.nickname} style={styles.tokenCard}>
              <Text style={styles.tokenNickname}>ผู้ถือกุญแจสำรอง: {g.nickname}</Text>
              <Text style={styles.tokenLabel}>รหัสกุญแจสำรอง {i + 1}</Text>
              <Text style={styles.tokenValue} numberOfLines={2}>
                {g.token}
              </Text>
              <PrimaryButton variant="secondary" label="คัดลอก" onPress={() => handleCopyToken(g.token)} />
            </View>
          ))}
        </ScrollView>
        <PrimaryButton label="เสร็จสิ้น" onPress={finish} />
      </View>
      </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <IconBadge size={56} tint={accentColor} style={styles.headerIcon}>
          <KeyIcon size={28} color={colors.textPrimary} />
        </IconBadge>
        <Text style={styles.title}>กุญแจไขความลับสำหรับทายาท (ไม่บังคับ)</Text>
        <Text style={styles.subtitle}>
          กุญแจนี้จะถูกส่งให้คนที่คุณระบุตัวตนไว้ (ทายาท/คนที่คุณไว้ใจ) ก็ต่อเมื่อห้องของคุณขาดการเช็คอินเกินเวลาที่คุณกำหนด
          {guardianNames.length <= 1
            ? ' (มีผู้ถือกุญแจแค่คนเดียว คนนั้นจึงกู้คืนได้ทันทีด้วยรหัสของตัวเอง — ไม่มีใครช่วยตรวจสอบถ่วงดุล แนะนำให้เพิ่มเป็น 2-3 คนเพื่อความปลอดภัย)'
            : ' (ต้องมีอย่างน้อย 2 คนยินยอมร่วมกันถึงจะกู้คืนได้ — กันไม่ให้คนใดคนหนึ่งแอบกู้คืนคนเดียว)'}
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
            <Text style={styles.periodExplainer}>
              ความหมาย: ถ้าคุณไม่กดปุ่ม "เช็คอิน" ในห้องลับเลยเกิน{' '}
              {PERIOD_OPTIONS.find((o) => o.hours === periodHours)?.label ?? ''} นับจากครั้งล่าสุด ระบบจะเริ่มให้ผู้ถือกุญแจสำรองกู้คืนกุญแจได้
            </Text>

            <View style={[styles.toggleRow, { marginBottom: spacing.xs }]}>
              <Text style={styles.toggleLabel}>แจ้งเตือนทายาทเมื่อครบกำหนด</Text>
              <Switch value={notifyEnabled} onValueChange={setNotifyEnabled} />
            </View>
            <Text style={styles.notifyCaveat}>
              (ตอนนี้แอปยังส่งแจ้งเตือนอัตโนมัติไม่ได้จริง — ค่านี้แค่บันทึกความต้องการของคุณไว้ก่อน จนกว่าจะเชื่อมระบบส่ง SMS/LINE จริง)
            </Text>

            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                ปุ่ม "เช็คอิน" เดียวกันนี้ใช้นับเวลาสำหรับการลบห้องอัตโนมัติด้วย — ถ้าคุณไม่เช็คอินเลยเกิน 1 ปี ห้องนี้และไฟล์ทั้งหมดจะถูกลบถาวรโดยอัตโนมัติ
                กู้คืนไม่ได้ ไม่ว่าจะตั้งค่าผู้ถือกุญแจสำรองไว้หรือไม่ก็ตาม
              </Text>
            </View>

            <Text style={styles.fieldLabel}>ผู้ถือกุญแจสำรอง ({MIN_GUARDIANS}-{MAX_GUARDIANS} คน)</Text>
            {guardianNames.map((name, i) => (
              <View key={i} style={styles.guardianRow}>
                <TextInput
                  value={name}
                  onChangeText={(v) => updateGuardian(i, v)}
                  placeholder={`ชื่อผู้ถือกุญแจสำรอง คนที่ ${i + 1}`}
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
                <Text style={styles.addLinkText}>+ เพิ่มผู้ถือกุญแจสำรอง</Text>
              </Pressable>
            )}

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                แอปนี้ไม่ส่ง SMS หรือ LINE แจ้งผู้ถือกุญแจสำรองให้อัตโนมัติ —
                คุณต้องคัดลอกรหัสที่จะแสดงในขั้นถัดไปแล้วส่งให้แต่ละคนด้วยตัวเอง (นอกแอป) เอง
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
    </View>
    </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  // Padding lives here, on an inner View, rather than directly on
  // SafeAreaView — on web, SafeAreaView applies its own safe-area
  // padding-inline CSS that can (non-deterministically, depending on
  // atomic-CSS insertion order across the app) win the cascade over
  // paddingHorizontal set on the same element, silently zeroing it and
  // leaving content flush against the screen edges. Splitting the two
  // elements sidesteps the conflict regardless of insertion order.
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  headerIcon: { marginBottom: spacing.md },
  title: { ...typography.title, fontSize: 19, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, fontSize: 15, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.lg },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  toggleLabel: { ...typography.body, fontSize: 15, color: colors.textPrimary },
  fieldLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  periodExplainer: { ...typography.body, fontSize: 16, color: colors.textMuted, lineHeight: 17, marginBottom: spacing.lg },
  notifyCaveat: { ...typography.body, fontSize: 16, color: colors.textMuted, fontStyle: 'italic', lineHeight: 16, marginBottom: spacing.lg },
  warnBox: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.danger,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warnText: { ...typography.body, fontSize: 16, color: colors.dangerText, lineHeight: 18 },
  periodChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  periodChipActive: { borderColor: colors.accentTeal, backgroundColor: 'rgba(127,166,177,0.12)' },
  periodChipText: { ...typography.body, fontSize: 15, color: colors.textSecondary },
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
  removeButtonText: { ...typography.body, fontSize: 15, color: colors.dangerText },
  addLink: { marginBottom: spacing.lg },
  addLinkText: { ...typography.body, fontSize: 16, color: colors.accentTeal },
  noteBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  noteText: { ...typography.body, fontSize: 16, color: colors.textMuted, lineHeight: 18 },
  footer: { gap: spacing.sm },
  skipLink: { alignItems: 'center', paddingVertical: spacing.sm },
  skipLinkText: { ...typography.body, fontSize: 15, color: colors.textMuted },
  tokenCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tokenNickname: { ...typography.body, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  tokenLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginTop: -4 },
  tokenValue: { ...typography.mono, fontSize: 16, color: colors.textSecondary },
});
