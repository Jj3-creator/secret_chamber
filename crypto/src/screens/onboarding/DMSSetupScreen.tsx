// DMS Setup (optional) — configures the Dead Man's Switch: check-in
// period + 2-3 guardians, each getting one Shamir share of the master
// key. Maps to design screens 1.5/5.1/5.2, built as one combined step
// since 1.5/5.x aren't separately built yet.
//
// Real crypto + real backend calls (vault.ts's createRecoveryShares +
// wrapVaultKey, backend.ts's setupDms — the same dms-setup Edge Function
// tested in Part 2). Automatic notification (see dms-notify/index.ts) now
// covers email (confirmed working end-to-end against a live Resend
// account), plus SMS via Twilio and LINE via the Messaging API (both
// wired up but not yet smoke-tested against real provider credentials —
// see that function's own header). Regardless of channel, the owner
// still separately hands over the actual recovery token out-of-band
// (print it, say it, write it down) — exactly like handing someone a
// physical spare key; no channel here ever transmits the token itself.
//
// Guardian key design: rather than requiring each guardian to have their
// own pre-existing app account/PIN (a much bigger feature), the random
// recovery token IS the guardian's credential — it both authenticates
// their dms-request-share call AND (via deriveMasterKey) derives the key
// that unwraps their share. Knowing the token is sufficient and necessary;
// nothing else to set up on the guardian's side.
//
// Feedback: the old dynamic "add a guardian" flow (a button that appended
// a new card below the fold) was unreachable on real mobile touch
// scrolling. Replaced with 3 always-rendered, clearly separate boxes
// (slot 1 required, 2/3 marked optional) — no add/remove interaction, no
// content that appears somewhere requiring a scroll to discover.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ScrollView, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ThemedBackground } from '../../components/ThemedBackground';
import { IconBadge } from '../../components/IconBadge';
import { Checkbox } from '../../components/Checkbox';
import { RadioOption } from '../../components/RadioOption';
import { KeyIcon } from '../../components/icons';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { generateRandomToken, sha256Hex, deriveKeyDeterministic } from '../../services/crypto';
import { createRecoveryShares, wrapVaultKey } from '../../services/vault';
import { setupDms, getAccountStatus } from '../../services/backend';
import { saveGuardianContacts, loadGuardianContacts } from '../../services/guardianContacts';
import { useOnboarding } from './OnboardingContext';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { useVaultSession } from '../vault/VaultSessionContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DMSSetup'>;

// ⚠️ Placeholder — swap for the real LINE Official Account's Basic ID
// (the "@xxxxx" LINE shows on its profile/QR page) once it exists. Shown
// to the owner on the reveal screen so they know which OA to tell the
// guardian to add as a friend before sending the link code.
const LINE_OA_ADD_FRIEND_HINT = 'ยังไม่ได้ตั้งค่า — ดูใน LINE Official Account Manager';

const PERIOD_OPTIONS = [
  { label: '7 วัน', hours: 7 * 24 },
  { label: '14 วัน', hours: 14 * 24 },
  { label: '30 วัน', hours: 30 * 24 },
  { label: '90 วัน', hours: 90 * 24 },
  { label: '180 วัน', hours: 180 * 24 },
];

// Feedback: forcing a minimum of 2 felt arbitrary — changed to "1 to 3,
// your choice". With exactly 1 guardian there's nothing to vote on (see
// handleSetup). With 2+, the owner now explicitly picks the threshold
// (how many must agree) instead of it being hard-coded to "always 2" —
// see the threshold picker below.
const MIN_GUARDIANS = 1;
// Feedback: reduced from 3 to 2 — a 2-name commitment is enough, and
// keeps the guardian step quick to fill in.
const MAX_GUARDIANS = 2;

interface Guardian {
  name: string;
  email: string;
  lineId: string;
  // Feedback: "ต้องการให้ notify line id, และ sms ได้" — phone is the SMS
  // equivalent of email above (see backend.ts's guardianPhone). lineId
  // above stays a local-only free-text note (unchanged) — it's a human
  // handle, not something LINE's API can message directly, so it can't
  // by itself drive real notifications; wantLine is the actual opt-in
  // for that (see the server-generated link code flow below).
  phone: string;
  wantLine: boolean;
}

const emptyGuardian = (): Guardian => ({ name: '', email: '', lineId: '', phone: '', wantLine: false });
const makeGuardianSlots = (): Guardian[] => Array.from({ length: MAX_GUARDIANS }, emptyGuardian);

interface RevealedGuardian {
  nickname: string;
  token: string;
  shareIndex: number;
  // Same value for every guardian in one setup batch — how many of them
  // (including this one) must redeem before the room can actually be
  // recovered. Bundled into the recovery code below so RedeemScreen.tsx
  // knows whether an unwrapped value IS the master key (threshold 1) or
  // just one Shamir share that still needs combining with others.
  threshold: number;
  // Set only if this guardian opted into LINE — the 6-digit code they
  // send as a LINE message to link their account (see line-webhook's own
  // comment). Shown alongside the recovery code, not part of it.
  lineLinkCode: string | null;
}

/**
 * Feedback (answering "การใช้กุญแจ ใช้ยังไง"): a guardian needs THREE
 * pieces of information to redeem their share — account_id, share_index,
 * and the token itself — and the old UI only ever showed the token,
 * leaving the owner to somehow also communicate the other two. Bundling
 * all of it into one copy-pasteable string removes that whole class of
 * "I have the token but nothing else" support question. See
 * RedeemScreen.tsx's parseRecoveryCode for the inverse operation.
 */
function buildRecoveryCode(accountId: string, g: RevealedGuardian): string {
  return `${accountId}:${g.shareIndex}:${g.threshold}:${g.token}`;
}

export function DMSSetupScreen({ navigation, route }: Props) {
  const { accountId, kdf, mode } = route.params;
  // Feedback: "ปุ่ม setting ให้เพิ่มการตั้งผู้รับกุญแจสำรอง เงื่อนไขการ
  // เปิดห้อง กำหนดดิวเดท ... ให้มาปรากฎ/เปลี่ยนค่าได้จากปุ่ม setting นี้" —
  // reusing this exact screen (not building a second copy) for
  // reconfiguring later from SettingsScreen, rather than only at
  // first-time onboarding. The only real difference: the master key comes
  // from VaultSessionContext (the room is already unlocked) instead of
  // OnboardingContext, and finishing goes back to Settings instead of
  // forward to Done.
  const isReconfigure = mode === 'reconfigure';
  const onboarding = useOnboarding();
  const vaultSession = useVaultSession();
  const masterKeyHex = isReconfigure ? vaultSession.masterKeyHex : onboarding.masterKeyHex;
  const { accentColor, backgroundColor } = useRoomTheme();
  const { setMasterKeyHex: setSessionMasterKeyHex } = useVaultSession();

  // Feedback: "ให้มีปุ่ม trigger ว่าจะตั้งค่าไม๊" — fresh onboarding now
  // asks explicitly before showing the whole form, instead of a Switch
  // defaulted to off. Reconfigure mode skips this gate entirely (arriving
  // here from Settings' "แก้ไข..." button already implies the intent),
  // and always shows the form — same as before.
  const [gateChoice, setGateChoice] = useState<'yes' | 'no' | null>(isReconfigure ? 'yes' : null);
  const showForm = isReconfigure || gateChoice === 'yes';
  const [prefilled, setPrefilled] = useState(!isReconfigure); // true once existing config (if any) has loaded, or immediately for fresh onboarding
  const [periodHours, setPeriodHours] = useState(PERIOD_OPTIONS[1].hours); // 14 days default
  // Feedback: "นอกจากปุ่ม ที่ fixed จำนวนวันแล้ว ควรมี อีก 1 กล่องให้ใส่
  // จำนวนวันเอง (flexible)" — a free-text days box alongside the fixed
  // chips. usingCustomPeriod just tracks which UI element is "selected"
  // for the highlight; periodHours (the value actually submitted) is set
  // by whichever one the owner last touched.
  const [customDaysInput, setCustomDaysInput] = useState('');
  const [usingCustomPeriod, setUsingCustomPeriod] = useState(false);
  // Preference only for now — there is no real SMS/LINE sending built (see
  // the noteBox below), so this doesn't change what the app actually does
  // yet. Kept as a separate, honestly-labeled toggle rather than silently
  // ignored, so the choice is at least recorded for when that's built.
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  // Always exactly 3 slots, rendered as 3 separate boxes — slot 1 is the
  // only one that must actually have a name; 2/3 are optional and simply
  // ignored (not sent, not counted) if left blank. See the file header
  // comment for why this replaced the old dynamic add/remove list.
  const [guardians, setGuardians] = useState<Guardian[]>(makeGuardianSlots());
  // Feedback: simplified from a "pick a number from 2..N" slider to a
  // plain binary choice — 'any' means one guardian's confirmation alone
  // is enough (OR); 'all' means every single guardian must confirm
  // together (AND). Only shown/meaningful once there are 2+ guardians.
  const [verifyMode, setVerifyMode] = useState<'any' | 'all'>('all');
  const [notifyConsent, setNotifyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState<RevealedGuardian[] | null>(null);
  // Feedback: "ช่องผู้ถือกุญแจสำรอง ... ควรมี 2 ขั้นตอน [] ต้องการแก้ไข
  // [] คงเดิมไม่แก้ไข ถ้า tick ต้องการแก้ไข ค่อยโผล่ template" — reconfigure
  // mode only; defaults to 'keep' (the safer default — nothing changes
  // unless explicitly opted into). Fresh onboarding has no "existing" data
  // to gate behind this, so it always shows the form directly.
  const [guardianEditChoice, setGuardianEditChoice] = useState<'edit' | 'keep'>('keep');
  // The guardian names as they were BEFORE any edits — kept separately
  // from `guardians` (which IS what gets submitted) purely so the
  // "(เดิม: xxx) แก้เป็น: ___" template below has something to show.
  const [originalGuardians, setOriginalGuardians] = useState<Guardian[]>(makeGuardianSlots());

  // Reconfigure mode only: load the existing setup so the owner adjusts
  // it rather than starting from a blank form. Recovery tokens themselves
  // were never stored anywhere (shown once, by design — see the file
  // header) so they can't be prefilled; saving always generates fresh
  // ones for everyone, explained in the warning box below.
  useEffect(() => {
    if (!isReconfigure) return;
    let cancelled = false;
    (async () => {
      const [record, status] = await Promise.all([loadGuardianContacts(accountId), getAccountStatus(accountId)]);
      if (cancelled) return;
      if (status.dmsThresholdHours != null) setPeriodHours(status.dmsThresholdHours);
      if (record && record.guardians.length > 0) {
        const slots = makeGuardianSlots();
        record.guardians.slice(0, MAX_GUARDIANS).forEach((g, i) => {
          // phone/wantLine aren't in guardianContacts.ts's stored record
          // yet (it predates this feedback) — reconfigure just starts
          // those blank/off; re-submitting still works fine either way.
          slots[i] = { name: g.name, email: g.email ?? '', lineId: g.lineId ?? '', phone: '', wantLine: false };
        });
        setGuardians(slots);
        setOriginalGuardians(slots);
        setVerifyMode(record.threshold >= record.guardians.length && record.guardians.length > 1 ? 'all' : 'any');
      }
      setPrefilled(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReconfigure, accountId]);

  const updateGuardian = (i: number, field: keyof Guardian, value: string) =>
    setGuardians((prev) => prev.map((g, idx) => (idx === i ? { ...g, [field]: value } : g)));

  // The guardians that actually count — slot 2/3 left blank simply don't
  // participate, no explicit "remove" action needed.
  const activeGuardians = guardians.filter((g) => g.name.trim().length > 0);

  const finish = () => {
    if (isReconfigure) {
      // Already reading the real key from VaultSessionContext (the room
      // was already unlocked to get here) — nothing to carry over, just
      // return to wherever Settings was.
      navigation.goBack();
      return;
    }
    // Carry the real key into VaultSessionContext before OnboardingContext
    // drops it — so this brand-new room's very first VaultHome visit can
    // already encrypt/decrypt safe content, the same as a PIN-unlocked one.
    if (masterKeyHex) setSessionMasterKeyHex(masterKeyHex);
    onboarding.clear(); // done with OnboardingContext's own copy either way
    // kdf is always a real string on this (non-reconfigure) path — every
    // route that leads here (Confirm -> SetPin -> Personalize) passes it
    // through; it's only optional in the type because reconfigure mode
    // (which never reaches this line) doesn't have one.
    navigation.navigate('Done', { accountId, kdf: kdf! });
  };

  const handleSkip = () => {
    if (isReconfigure) {
      navigation.goBack();
      return;
    }
    finish();
  };

  const handleSetup = async () => {
    if (!masterKeyHex) {
      appAlert('ผิดพลาด', 'ไม่พบกุญแจสำหรับตั้งค่า — ลองเริ่มใหม่จากขั้นตอนสร้างห้อง');
      return;
    }
    const names = activeGuardians.map((g) => g.name.trim());
    if (names.length < MIN_GUARDIANS) {
      appAlert('กรอกไม่ครบ', `ใส่ชื่อผู้ถือกุญแจสำรองอย่างน้อย ${MIN_GUARDIANS} คน (ช่องที่ 1)`);
      return;
    }
    if (!notifyConsent) {
      appAlert(
        'ยังไม่ได้ยืนยัน',
        'กรุณายืนยันว่าคุณจะเป็นผู้แจ้งรหัสกุญแจสำรองให้ผู้รับด้วยตัวเอง ก่อนตั้งค่าต่อ'
      );
      return;
    }
    // any = 1-of-N (one guardian alone is enough); all = N-of-N (everyone
    // must agree). A single guardian makes the choice moot either way.
    const effectiveThreshold = names.length === 1 ? 1 : verifyMode === 'all' ? names.length : 1;

    // Feedback: "อยากให้ APP แจ้งเตือน id line และ อีเมล์เลยได้ไม๊" /
    // "ต้องการให้ notify line id, และ sms ได้" — all three channels are
    // gated the same way: only for guardians who actually gave that
    // contact info (or opted into LINE), AND only if the
    // "แจ้งเตือน...เมื่อครบกำหนด" switch above is on — that switch is this
    // feature's real master control, not just a decorative preference, so
    // turning it off means nothing extra is sent to the server at all.
    const emails = notifyEnabled ? activeGuardians.map((g) => g.email.trim() || null) : activeGuardians.map(() => null);
    const phones = notifyEnabled ? activeGuardians.map((g) => g.phone.trim() || null) : activeGuardians.map(() => null);
    const wantLines = notifyEnabled ? activeGuardians.map((g) => g.wantLine) : activeGuardians.map(() => false);

    setSubmitting(true);
    try {
      const tokens = await Promise.all(names.map(() => generateRandomToken()));
      // Deterministic derivation (fixed salt), not deriveMasterKey's own
      // default random salt — a guardian later re-supplying this exact
      // token must re-derive the SAME key to unwrap their share. A random
      // salt with nowhere persisted to store it would make that
      // impossible. See crypto.ts's DETERMINISTIC_SALT_HEX.
      const guardianKeys = await Promise.all(tokens.map((t) => deriveKeyDeterministic(t)));

      // threshold === 1 (either only 1 guardian exists, or "any one
      // guardian" was chosen) means there's nothing to "split" — Shamir's
      // library correctly refuses a threshold below 2 (a 1-of-1 share IS
      // the secret, not a share of it). Wrap the real master key straight
      // to EACH guardian independently instead — any one of them can
      // unwrap it alone. threshold >= 2 ("all must agree") goes through
      // real N-of-N secret splitting so no subset smaller than all of
      // them can reconstruct it.
      const rows =
        effectiveThreshold === 1
          ? await Promise.all(
              names.map(async (_, i) => ({
                shareIndex: i + 1,
                tokenHash: sha256Hex(tokens[i]),
                wrapped: await wrapVaultKey(masterKeyHex, guardianKeys[i].masterKeyHex),
                guardianEmail: emails[i],
                guardianPhone: phones[i],
                wantLine: wantLines[i],
              }))
            )
          : await (async () => {
              const { shares } = await createRecoveryShares(masterKeyHex, {
                guardians: names.length,
                threshold: effectiveThreshold,
              });
              const wrapped = await Promise.all(
                shares.map((s, i) => wrapVaultKey(s.valueHex, guardianKeys[i].masterKeyHex))
              );
              return shares.map((s, i) => ({
                shareIndex: s.index,
                tokenHash: sha256Hex(tokens[i]),
                wrapped: wrapped[i],
                guardianEmail: emails[i],
                guardianPhone: phones[i],
                wantLine: wantLines[i],
              }));
            })();

      const { lineLinkCodes } = await setupDms(accountId, periodHours, rows);

      // Local-only record of who the guardians are (name + how to reach
      // them) and the chosen threshold — never sent to the server (see
      // guardianContacts.ts). Used later to let the owner pick which
      // guardians can access which safe.
      await saveGuardianContacts(accountId, {
        guardians: activeGuardians.map((g) => ({
          name: g.name.trim(),
          email: g.email.trim() || undefined,
          lineId: g.lineId.trim() || undefined,
        })),
        threshold: effectiveThreshold,
      });

      setRevealed(
        names.map((nickname, i) => ({
          nickname,
          token: tokens[i],
          shareIndex: rows[i].shareIndex,
          threshold: effectiveThreshold,
          lineLinkCode: lineLinkCodes.find((c) => c.shareIndex === rows[i].shareIndex)?.lineLinkCode ?? null,
        }))
      );
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

  const handleCopyToken = async (code: string) => {
    await Clipboard.setStringAsync(code);
    appAlert(
      'คัดลอกแล้ว',
      'กรุณาจัดเก็บและจัดส่งรหัสนี้ ให้ผู้ที่ท่านระบุชื่อ (ในหน้าที่แล้ว) เอง — รหัสนี้ใช้กับหน้า "ใช้รหัสกุญแจสำรอง" ในแอป (จากหน้าแรก)'
    );
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
          {/* User question worth answering right here, not just in chat:
              "ชื่อและรหัสมีการผูกกันไม๊" — no. The server never learns the
              name at all (see guardianContacts.ts — local-only, never
              sent). It only checks the token itself; whoever presents it
              can redeem it. The name below is purely this device's own
              reminder of who you gave which token to. */}
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              ชื่อที่แสดงเป็นเพียงบันทึกส่วนตัวในเครื่องนี้ — ระบบไม่ได้ผูกชื่อกับรหัสจริง ผู้ใดก็ตามที่ถือรหัสนี้สามารถใช้กู้คืนได้ทันที
              จึงควรส่งรหัสนี้ให้ตรงคนที่ตั้งใจไว้เท่านั้น และเก็บรักษาเหมือนกุญแจจริงชิ้นหนึ่ง
            </Text>
          </View>
          {revealed.map((g, i) => {
            const code = buildRecoveryCode(accountId, g);
            return (
              <View key={g.nickname} style={styles.tokenCard}>
                <Text style={styles.tokenNickname}>บุคคลที่คุณเชื่อถือ: {g.nickname}</Text>
                <Text style={styles.tokenLabel}>รหัสกุญแจสำรอง {i + 1}</Text>
                <Text style={styles.tokenValue} numberOfLines={3}>
                  {code}
                </Text>
                <PrimaryButton variant="secondary" label="คัดลอก" onPress={() => handleCopyToken(code)} />
                {g.lineLinkCode && (
                  <View style={styles.lineLinkBox}>
                    <Text style={styles.lineLinkText}>
                      ให้ {g.nickname} เพิ่มเพื่อน LINE OA ของแอปนี้ก่อน ({LINE_OA_ADD_FRIEND_HINT}) แล้วพิมพ์รหัสนี้ส่งเป็นข้อความ เพื่อเชื่อมบัญชี LINE สำหรับรับการแจ้งเตือนอัตโนมัติ:
                    </Text>
                    <Text style={styles.tokenValue}>{g.lineLinkCode}</Text>
                    <PrimaryButton
                      variant="secondary"
                      label="คัดลอกรหัสเชื่อม LINE"
                      onPress={() => handleCopyToken(g.lineLinkCode!)}
                    />
                  </View>
                )}
              </View>
            );
          })}
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
        <Text style={styles.title}>
          {isReconfigure
            ? 'แก้ไขผู้ถือกุญแจสำรอง / กรอบเวลาเปิดสิทธิ์'
            : 'ขั้นตอนตั้งค่าแจ้งเตือนอัตโนมัติเมื่อบัญชีนิ่ง (Auto-Notify on Inactivity)'}
        </Text>
        {isReconfigure && !prefilled && <Text style={styles.subtitle}>กำลังโหลดค่าปัจจุบัน…</Text>}
        {isReconfigure && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              การบันทึกจะสร้างรหัสกุญแจสำรองชุดใหม่ทั้งหมด — รหัสเดิมที่เคยแจกไปแล้วจะใช้ไม่ได้อีก ต้องแจกรหัสใหม่ให้ทุกคนอีกครั้ง
            </Text>
          </View>
        )}

        {/* Feedback: "ให้มีปุ่ม trigger ว่าจะตั้งค่าไม๊" — fresh onboarding
            only; reconfigure mode (accessed from Settings) skips straight
            to the form below. */}
        {!isReconfigure && (
          <>
            <Text style={styles.subtitle}>
              ต้องการตั้งค่าแจ้งเตือนอัตโนมัติให้บุคคลที่คุณเชื่อถือ เมื่อคุณขาดการล็อกอินห้องนี้นานเกินไปหรือไม่?
            </Text>
            <View style={styles.periodRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: gateChoice === 'yes' }}
                onPress={() => setGateChoice('yes')}
                style={[styles.periodChip, gateChoice === 'yes' && { borderColor: accentColor, backgroundColor: `${accentColor}1F` }]}
              >
                <Text style={[styles.periodChipText, gateChoice === 'yes' && styles.periodChipTextActive]}>ตั้งค่า (Yes)</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: gateChoice === 'no' }}
                onPress={() => setGateChoice('no')}
                style={[styles.periodChip, gateChoice === 'no' && { borderColor: accentColor, backgroundColor: `${accentColor}1F` }]}
              >
                <Text style={[styles.periodChipText, gateChoice === 'no' && styles.periodChipTextActive]}>ไม่ตั้งค่า (No)</Text>
              </Pressable>
            </View>
          </>
        )}

        {gateChoice === 'no' && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              หากคุณขาดการล็อกอินแอปนี้เกิน 1 ปี ความลับในห้องนี้จะหายไปพร้อมคุณตลอดไป
            </Text>
          </View>
        )}

        {showForm && (
          <>
            <Text style={styles.subtitle}>
              กุญแจนี้จะถูกส่งให้บุคคลที่คุณเชื่อถือ ก็ต่อเมื่อห้องของคุณขาดการล็อกอินเกินเวลาที่คุณกำหนด
              {activeGuardians.length <= 1
                ? ' (หากกำหนดไว้เพียงคนเดียว คนนั้นจะกู้ห้องลับคืนได้โดยลำพัง — ไม่มีใครช่วยตรวจสอบถ่วงดุล แนะนำให้เพิ่มเป็น 2 คนเพื่อความปลอดภัย)'
                : verifyMode === 'all'
                  ? ` (ต้องได้รับความยินยอมจากทุกคนทั้ง ${activeGuardians.length} คน — ปลอดภัยที่สุด แต่ถ้าติดต่อใครคนหนึ่งไม่ได้ก็กู้คืนไม่ได้)`
                  : ` (แค่คนใดคนหนึ่งใน ${activeGuardians.length} คนก็กู้คืนได้ — สะดวกกว่า แต่บุคคลนั้นก็สามารถกู้คืนคนเดียวได้เช่นกัน)`}
            </Text>

            <Text style={styles.popupTitle}>
              ตั้งค่าระยะเวลาไร้เคลื่อนไหวที่ระบบจะแจ้งเตือนบุคคลที่คุณเชื่อถือโดยอัตโนมัติ
            </Text>

            <Text style={styles.fieldLabel}>กำหนดช่วงเวลาไร้เคลื่อนไหว (Inactive Period)</Text>
            <View style={styles.periodRow}>
              {PERIOD_OPTIONS.map((opt) => {
                const active = !usingCustomPeriod && periodHours === opt.hours;
                return (
                  <Pressable
                    key={opt.hours}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setPeriodHours(opt.hours);
                      setUsingCustomPeriod(false);
                    }}
                    style={[styles.periodChip, active && { borderColor: accentColor, backgroundColor: `${accentColor}1F` }]}
                  >
                    <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
              <View
                style={[
                  styles.periodChip,
                  styles.customPeriodChip,
                  usingCustomPeriod && { borderColor: accentColor, backgroundColor: `${accentColor}1F` },
                ]}
              >
                <TextInput
                  value={customDaysInput}
                  onChangeText={(v) => {
                    const digits = v.replace(/[^0-9]/g, '');
                    setCustomDaysInput(digits);
                    const n = parseInt(digits, 10);
                    if (!isNaN(n) && n > 0) {
                      setPeriodHours(n * 24);
                      setUsingCustomPeriod(true);
                    } else {
                      setUsingCustomPeriod(false);
                    }
                  }}
                  placeholder="กำหนดเอง"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.customPeriodInput}
                />
                <Text style={styles.periodChipText}>วัน</Text>
              </View>
            </View>
            <Text style={styles.periodExplainer}>
              ความหมาย: ถ้าคุณไม่ log in ห้องลับนี้เกิน{' '}
              {PERIOD_OPTIONS.find((o) => o.hours === periodHours)?.label ?? `${Math.round(periodHours / 24)} วัน`} นับจากครั้งล่าสุด
              ระบบจะอนุญาตให้บุคคลที่คุณเชื่อถือ log in เข้าห้องลับของคุณได้
            </Text>

            <View style={[styles.toggleRow, { marginBottom: spacing.xs }]}>
              <Text style={styles.toggleLabel}>แจ้งเตือนบุคคลที่คุณเชื่อถือเมื่อครบกำหนด</Text>
              <Switch value={notifyEnabled} onValueChange={setNotifyEnabled} />
            </View>
            <Text style={styles.notifyCaveat}>
              (ถ้าเปิดไว้ ระบบจะแจ้งเตือนบุคคลที่คุณเชื่อถือโดยอัตโนมัติเมื่อครบกำหนด ผ่านทุกช่องทางที่กรอกไว้ให้ (อีเมล/เบอร์โทร/LINE ที่เชื่อมบัญชีแล้ว) —
              ข้อความนี้เป็นแค่การเตือนให้ใช้รหัสกุญแจสำรองที่คุณให้ไปแล้ว ไม่ใช่การส่งรหัสกุญแจสำรองเอง ระบบไม่เคยเก็บรหัสกุญแจสำรองไว้ที่ server เลย)
            </Text>

            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                การล็อกอินเข้าห้องนี้ใช้นับเวลาสำหรับการลบห้องอัตโนมัติด้วย — ถ้าคุณไม่ล็อกอินเลยเกิน 1 ปี ห้องนี้และไฟล์ทั้งหมดจะถูกลบถาวรโดยอัตโนมัติ
                กู้คืนไม่ได้ ไม่ว่าจะตั้งค่าบุคคลที่คุณเชื่อถือไว้หรือไม่ก็ตาม
              </Text>
            </View>

            <Text style={styles.fieldLabel}>บุคคลที่คุณเชื่อถือ ({MIN_GUARDIANS}-{MAX_GUARDIANS} คน)</Text>
            <Text style={styles.contactNote}>
              (ถ้าเปิด "แจ้งเตือน...เมื่อครบกำหนด" ด้านบนไว้ ระบบจะเตือนบุคคลเหล่านี้ผ่านช่องทางที่กรอกไว้ให้ใช้รหัสกุญแจสำรองที่คุณให้ไปแล้ว — ไม่ใช่ส่งรหัสกุญแจสำรองเอง)
            </Text>
            <Text style={styles.contactNote}>
              ช่องที่ 1 จำเป็นต้องใส่ — ช่องที่ 2 ไม่บังคับ เว้นว่างไว้ได้ถ้าไม่ต้องการ อีเมลและเบอร์โทรที่กรอกจะถูกส่งขึ้น server เพื่อใช้แจ้งเตือนเท่านั้น (ถ้าเปิดใช้งาน) —
              LINE ID (ช่องบันทึกไว้ดูเอง) ยังคงเก็บไว้ในเครื่องนี้เท่านั้น ไม่ส่งขึ้น server — ถ้าต้องการแจ้งเตือนผ่าน LINE ให้ติ๊กช่องด้านล่างแทน ระบบจะสร้างรหัสเชื่อมบัญชีแยกต่างหากให้
            </Text>

            {isReconfigure && (
              <>
                <RadioOption
                  selected={guardianEditChoice === 'keep'}
                  onSelect={() => setGuardianEditChoice('keep')}
                  label="คงเดิมไม่แก้ไข"
                />
                <RadioOption
                  selected={guardianEditChoice === 'edit'}
                  onSelect={() => setGuardianEditChoice('edit')}
                  label="ต้องการแก้ไข"
                />
              </>
            )}

            {isReconfigure && guardianEditChoice === 'keep' ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  {activeGuardians.length > 0
                    ? `บุคคลที่คุณเชื่อถือในปัจจุบัน: ${activeGuardians.map((g) => g.name).join(', ')}`
                    : 'ยังไม่มีบุคคลที่คุณเชื่อถือ'}
                  {' — จะบันทึกด้วยรายชื่อเดิมนี้ (รหัสกุญแจสำรองจะถูกสร้างใหม่ทั้งหมดตามปกติ)'}
                </Text>
              </View>
            ) : (
              guardians.map((guardian, i) => (
                <View key={i} style={styles.guardianCard}>
                  <Text style={styles.guardianCardTitle}>
                    ผู้รับรหัสลำดับที่ {i + 1} {i === 0 ? '(จำเป็น)' : '(ไม่บังคับ)'}
                    {isReconfigure ? ` (เดิม: ${originalGuardians[i].name || 'ว่าง'})` : ''}
                  </Text>
                  <TextInput
                    value={guardian.name}
                    onChangeText={(v) => updateGuardian(i, 'name', v)}
                    placeholder={isReconfigure ? `แก้เป็น… (เว้นว่าง = ไม่เปลี่ยน)` : `ชื่อผู้รับรหัสลำดับที่ ${i + 1}`}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                  <View style={styles.guardianRow}>
                    <TextInput
                      value={guardian.email}
                      onChangeText={(v) => updateGuardian(i, 'email', v)}
                      placeholder="อีเมล (ไม่บังคับ)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={[styles.input, styles.inputHalf]}
                    />
                    <TextInput
                      value={guardian.phone}
                      onChangeText={(v) => updateGuardian(i, 'phone', v)}
                      placeholder="เบอร์โทร (ไม่บังคับ)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      style={[styles.input, styles.inputHalf]}
                    />
                  </View>
                  <TextInput
                    value={guardian.lineId}
                    onChangeText={(v) => updateGuardian(i, 'lineId', v)}
                    placeholder="LINE ID (บันทึกไว้ดูเองเท่านั้น — ไม่บังคับ)"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                  <Checkbox
                    checked={guardian.wantLine}
                    onToggle={() =>
                      setGuardians((prev) => prev.map((g, idx) => (idx === i ? { ...g, wantLine: !g.wantLine } : g)))
                    }
                    label='รับแจ้งเตือนผ่าน LINE ด้วย — ระบบจะสร้างรหัสเชื่อมบัญชี LINE ให้ในขั้นถัดไป (ต้องให้ผู้รับ "เพิ่มเพื่อน" LINE OA ของแอปก่อน)'
                  />
                </View>
              ))
            )}

            {activeGuardians.length >= 2 && (
              <>
                <Text style={styles.fieldLabel}>วิธียืนยันร่วมกัน</Text>
                <View style={styles.periodRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: verifyMode === 'any' }}
                    onPress={() => setVerifyMode('any')}
                    style={[styles.periodChip, verifyMode === 'any' && { borderColor: accentColor, backgroundColor: `${accentColor}1F` }]}
                  >
                    <Text style={[styles.periodChipText, verifyMode === 'any' && styles.periodChipTextActive]}>
                      คนใดคนหนึ่ง (OR)
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: verifyMode === 'all' }}
                    onPress={() => setVerifyMode('all')}
                    style={[styles.periodChip, verifyMode === 'all' && { borderColor: accentColor, backgroundColor: `${accentColor}1F` }]}
                  >
                    <Text style={[styles.periodChipText, verifyMode === 'all' && styles.periodChipTextActive]}>
                      ทุกคนร่วมกัน (AND)
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.periodExplainer}>
                  {verifyMode === 'all'
                    ? `เลือก "ทุกคนร่วมกัน" (AND) — หมายความว่าคุณตั้งผู้รับกุญแจสำรองไว้ ${activeGuardians.length} คน ต้องใช้รหัสยืนยันครบทั้ง ${activeGuardians.length} คนจึงจะเปิดห้องได้ ปลอดภัยสูงสุด แต่ถ้ามีใครติดต่อไม่ได้แม้แต่คนเดียว จะกู้คืนไม่ได้เลย`
                    : `เลือก "คนใดคนหนึ่ง" (OR) — แค่คนใดคนหนึ่งในผู้รับกุญแจสำรองที่ตั้งไว้ยืนยันก็เปิดห้องได้ทันที สะดวกกว่า แต่ทายาทคนใดคนหนึ่งก็สามารถกู้คืนคนเดียวได้เช่นกัน โดยไม่ต้องรอคนอื่น`}
                </Text>
              </>
            )}

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                คุณควรคัดลอกรหัสที่จะแสดงในขั้นถัดไปและสามารถหาแจ้งรหัสนี้ให้บุคคลที่คุณเชื่อถือด้วยตัวเอง (นอกแอป) ตามวิธีที่คุณสะดวก
              </Text>
            </View>

            <Checkbox
              checked={notifyConsent}
              onToggle={() => setNotifyConsent((v) => !v)}
              label="ฉันเข้าใจและยืนยันว่าจะเป็นผู้แจ้งรหัสกุญแจสำรองนี้ให้ผู้รับด้วยตัวเอง — ผู้สร้างแอปไม่มีส่วนรับผิดชอบต่อความลับหรือข้อมูลใดๆ ของฉัน"
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleSkip} accessibilityRole="button" style={styles.skipLink}>
          <Text style={styles.skipLinkText}>
            {isReconfigure ? 'ยกเลิก กลับไปหน้าตั้งค่า' : gateChoice === 'no' ? 'ดำเนินการต่อ (ไม่ตั้งค่า)' : 'ข้ามขั้นตอนนี้ไปก่อน'}
          </Text>
        </Pressable>
        {showForm && (
          <PrimaryButton
            label={submitting ? 'กำลังตั้งค่า…' : isReconfigure ? 'บันทึกและสร้างรหัสใหม่' : 'ตั้งค่าและสร้างรหัส'}
            onPress={handleSetup}
            disabled={submitting || (isReconfigure && !prefilled)}
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
  popupTitle: {
    ...typography.label,
    fontSize: 17,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
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
  customPeriodChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  customPeriodInput: {
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
    minWidth: 44,
    paddingVertical: 0,
  },
  guardianCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  guardianRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
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
  inputHalf: { fontSize: 14 },
  contactNote: { ...typography.body, fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.lg },
  guardianCardTitle: { ...typography.label, fontSize: 15, color: colors.textMuted },
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
  lineLinkBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  lineLinkText: { ...typography.body, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
