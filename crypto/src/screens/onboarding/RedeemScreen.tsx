// Redeem — the guardian-facing half of the Dead Man's Switch flow, which
// (per feedback: "การใช้กุญแจ ใช้ยังไง") didn't exist at all until now.
// dms-request-share (backend) and dms-notify's reminder email were both
// real, but nothing in the app let a guardian actually DO anything with
// their recovery code — this screen is that missing piece.
//
// Reachable from WelcomeScreen, deliberately NOT from Unlock — a guardian
// is, by definition, someone who does not already have a PIN/device lock
// for this room (it's not their room).
//
// How the recovery code works: DMSSetupScreen's reveal screen now bundles
// account_id + share_index + threshold + token into one copy-pasteable
// string (see its own buildRecoveryCode) instead of showing the bare
// token and leaving the owner to somehow also communicate the other two
// pieces out-of-band. `threshold` tells THIS screen whether the unwrapped
// value is the complete master key already (threshold 1 — a solo
// guardian, or "any one of N" mode) or just one Shamir share that still
// needs combining with share(s) from other guardians (threshold >= 2,
// "all must agree" mode) — both cases decrypt to a same-length hex
// string, indistinguishable by shape alone, so the code has to say which.
//
// Multi-guardian (threshold >= 2) recovery is designed for one person —
// whoever is coordinating the recovery — pasting in EACH guardian's code
// one at a time on this same screen/session; shares accumulate in memory
// (never persisted) until there are enough to combine. Real coordination
// between separate guardians on separate devices (e.g. guardian A's
// share texted to guardian B) still has to happen out-of-band, same as
// the recovery codes themselves.
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ArrowLeftIcon } from '../../components/icons';
import { PrimaryButton } from '../../components/PrimaryButton';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { deriveKeyDeterministic, deriveAccountId } from '../../services/crypto';
import { unwrapVaultKey, recoverMasterKeyFromShares } from '../../services/vault';
import { requestGuardianShare, NotEligibleError, ShareNotFoundError } from '../../services/backend';
import { useOnboarding } from './OnboardingContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Redeem'>;

const ACCOUNT_ID_RE = /^[0-9a-f]{64}$/;

interface ParsedCode {
  accountId: string;
  shareIndex: number;
  threshold: number;
  token: string;
}

/** Inverse of DMSSetupScreen.tsx's buildRecoveryCode. Returns null for anything malformed. */
function parseRecoveryCode(raw: string): ParsedCode | null {
  const parts = raw.trim().split(':');
  if (parts.length !== 4) return null;
  const [accountId, shareIndexStr, thresholdStr, token] = parts;
  const shareIndex = Number(shareIndexStr);
  const threshold = Number(thresholdStr);
  if (!ACCOUNT_ID_RE.test(accountId)) return null;
  if (!Number.isInteger(shareIndex) || shareIndex < 1 || shareIndex > 255) return null;
  if (!Number.isInteger(threshold) || threshold < 1) return null;
  if (token.length < 16) return null;
  return { accountId, shareIndex, threshold, token };
}

function formatThaiDateTime(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

interface CollectedShare {
  index: number;
  valueHex: string;
}

export function RedeemScreen({ navigation }: Props) {
  const { setMasterKeyHex, setIsRecovering } = useOnboarding();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // Once the first code from an account is redeemed, subsequent codes
  // must match its account_id/threshold — a code from a different room
  // pasted in by mistake is caught here rather than silently combined
  // into nonsense.
  const [accountId, setAccountId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [shares, setShares] = useState<CollectedShare[]>([]);

  const handleSubmit = async () => {
    const parsed = parseRecoveryCode(code);
    if (!parsed) {
      appAlert(
        'รหัสไม่ถูกต้อง',
        'ตรวจสอบว่าคัดลอกรหัสมาครบทั้งหมด (ควรเป็นข้อความยาวหนึ่งบรรทัด คั่นด้วยเครื่องหมาย : จำนวน 3 จุด)'
      );
      return;
    }
    if (accountId && parsed.accountId !== accountId) {
      appAlert('รหัสไม่ตรงห้อง', 'รหัสนี้เป็นของห้องอื่น ไม่ใช่ห้องเดียวกับรหัสที่ใส่ไปก่อนหน้านี้');
      return;
    }
    if (shares.some((s) => s.index === parsed.shareIndex)) {
      appAlert('รหัสซ้ำ', 'ใส่รหัสของผู้ถือคนนี้ไปแล้ว — รอรหัสจากอีกคนแทน');
      return;
    }

    setBusy(true);
    try {
      const { wrapped } = await requestGuardianShare(parsed.accountId, parsed.shareIndex, parsed.token);
      const guardianKey = await deriveKeyDeterministic(parsed.token);
      const unwrapped = await unwrapVaultKey(wrapped, guardianKey.masterKeyHex);
      if (!unwrapped) {
        appAlert('เปิดรหัสไม่สำเร็จ', 'รหัสนี้อาจไม่ถูกต้อง หรือข้อมูลเสียหาย ลองตรวจสอบแล้วลองใหม่');
        return;
      }

      if (parsed.threshold === 1) {
        // The unwrapped value IS the master key already — proceed exactly
        // like RecoverScreen.tsx's own 12-word recovery does, re-joining
        // normal onboarding at SetPin so this device gets its own PIN
        // pointing at the recovered room.
        const recoveredAccountId = deriveAccountId(unwrapped);
        setMasterKeyHex(unwrapped);
        setIsRecovering(true);
        navigation.reset({ index: 0, routes: [{ name: 'SetPin', params: { accountId: recoveredAccountId, kdf: 'pbkdf2-sha256' } }] });
        return;
      }

      // threshold >= 2: this is only ONE Shamir share. Accumulate it and
      // ask for more until there are enough to combine.
      const nextShares = [...shares, { index: parsed.shareIndex, valueHex: unwrapped }];
      setAccountId(parsed.accountId);
      setThreshold(parsed.threshold);
      setShares(nextShares);
      setCode('');

      if (nextShares.length >= parsed.threshold) {
        const masterKeyHex = recoverMasterKeyFromShares(nextShares);
        const recoveredAccountId = deriveAccountId(masterKeyHex);
        setMasterKeyHex(masterKeyHex);
        setIsRecovering(true);
        navigation.reset({ index: 0, routes: [{ name: 'SetPin', params: { accountId: recoveredAccountId, kdf: 'pbkdf2-sha256' } }] });
      } else {
        appAlert(
          'รับรหัสนี้แล้ว',
          `ได้ ${nextShares.length} จาก ${parsed.threshold} คนที่ต้องการ — ใส่รหัสของอีกคนต่อเพื่อกู้คืนห้องให้สำเร็จ`
        );
      }
    } catch (err) {
      if (err instanceof NotEligibleError) {
        appAlert(
          'ยังไม่ถึงเวลา',
          err.eligibleAtIso
            ? `ห้องนี้ยังไม่ขาดการล็อกอินนานพอ — จะใช้รหัสนี้ได้ตั้งแต่วันที่ ${formatThaiDateTime(err.eligibleAtIso)}`
            : 'ห้องนี้ยังไม่ขาดการล็อกอินนานพอ ลองใหม่ภายหลัง'
        );
        return;
      }
      if (err instanceof ShareNotFoundError) {
        appAlert('ไม่พบรหัสนี้', 'ตรวจสอบว่าคัดลอกรหัสมาถูกต้องครบถ้วน หรือติดต่อผู้ที่ให้รหัสนี้กับคุณเพื่อยืนยันอีกครั้ง');
        return;
      }
      const reason = err instanceof Error ? err.message : String(err);
      appAlert('ดำเนินการไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={12}>
            <ArrowLeftIcon size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={{ width: 20 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>ใช้รหัสกุญแจสำรอง</Text>
          <Text style={styles.subtitle}>
            สำหรับ "บุคคลที่ได้รับความเชื่อถือ" ที่ได้รับรหัสจากเจ้าของห้องไว้แล้ว (นอกแอป) — วางรหัสนั้นด้านล่างเพื่อช่วยกู้คืนห้อง
          </Text>

          {threshold != null && threshold > 1 && (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                ห้องนี้ต้องการรหัสจาก {threshold} คนร่วมกัน — ตอนนี้ได้ {shares.length} จาก {threshold} แล้ว
                {shares.length < threshold ? ' ใส่รหัสของอีกคนต่อด้านล่าง' : ''}
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>รหัสกุญแจสำรอง</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="วางรหัสที่ได้รับที่นี่"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              ระบบไม่รู้จักตัวตนของคุณ — ใครก็ตามที่ถือรหัสนี้สามารถใช้ได้ ดังนั้นควรใช้รหัสนี้เฉพาะกรณีที่เจ้าของห้องตั้งใจมอบให้คุณจริงๆ เท่านั้น
            </Text>
          </View>

          {busy ? (
            <ActivityIndicator color={colors.textSecondary} style={{ marginTop: spacing.md }} />
          ) : (
            <PrimaryButton label="ดำเนินการต่อ" onPress={handleSubmit} disabled={code.trim().length === 0} />
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.title, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, fontSize: 15, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
    ...typography.mono,
    fontSize: 14,
  },
  noteBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  noteText: { ...typography.body, fontSize: 16, color: colors.textMuted, lineHeight: 18 },
  warnBox: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.danger,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warnText: { ...typography.body, fontSize: 15, color: colors.dangerText, lineHeight: 19 },
});
