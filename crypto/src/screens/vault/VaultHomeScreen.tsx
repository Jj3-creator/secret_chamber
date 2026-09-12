// Screen 3.1 — หน้าหลัก (Vault Dashboard home)
//
// Storage stats and the Dead Man's Switch check-in card are wired to the
// REAL deployed backend (accounts row via PostgREST + RLS, dms-heartbeat
// Edge Function) — not mock data. The category rows ARE mock data: the
// backend has no per-category schema yet (blobs aren't grouped into named
// categories), so their file counts/sizes below just mirror the design's
// example numbers. Tapping one shows a placeholder alert rather than a
// real file list (section 04, "Upload / View item", isn't built yet).
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { ThemedBackground } from '../../components/ThemedBackground';
import { SafeGraphic } from '../../components/SafeGraphic';
import { appAlert } from '../../components/AppAlert';
import { GearIcon, ChartIcon, PlusIcon, CheckCircleIcon, DoorExitIcon, DocumentIcon } from '../../components/icons';
import { colors, spacing, typography } from '../../theme/tokens';
import { getAccountStatus, sendHeartbeat, type AccountStatus } from '../../services/backend';
import { loadRoomProfile, type RoomProfile } from '../../services/localProfile';
import { recordCheckin, loadCheckinLog, type CheckinLog } from '../../services/checkinLog';
import { loadGuardianContacts } from '../../services/guardianContacts';
import { loadCategoryAccess } from '../../services/categoryAccess';
import { loadAllCustomCategoryNames } from '../../services/customCategories';
import { getAvatarComponent } from '../../components/avatars';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { useFontScale } from '../../theme/FontScaleContext';
import { CATEGORIES } from '../../data/categories';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'VaultHome'>;

const TOTAL_STORAGE_BYTES = 104_857_600; // 100 MB, matches the backend's get-upload-url cap
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// 6 real categories (Decoy Chamber deliberately excluded — see categories.ts)
// + 6 blank custom slots = 12 total ("ครบโหล" per feedback).
const CUSTOM_SLOT_COUNT = 6;
const CUSTOM_SLOT_IDS = Array.from({ length: CUSTOM_SLOT_COUNT }, (_, i) => `custom-${i + 1}`);

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function formatThaiDateTime(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

function describeDms(status: AccountStatus): string {
  if (status.dmsThresholdHours == null || status.dmsHeartbeatAt == null) {
    return 'ยังไม่ได้ตั้งค่ากุญแจไขความลับสำหรับทายาท';
  }
  const eligibleAtMs = new Date(status.dmsHeartbeatAt).getTime() + status.dmsThresholdHours * 60 * 60 * 1000;
  const msRemaining = eligibleAtMs - Date.now();
  if (msRemaining <= 0) return 'เลยกำหนดเช็คอินแล้ว';
  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  return `ครบกำหนดอีก ${daysRemaining} วัน`;
}

export function VaultHomeScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [profile, setProfile] = useState<RoomProfile | null>(null);
  const [checkinLog, setCheckinLog] = useState<CheckinLog | null>(null);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accentColor, backgroundColor, setThemeId } = useRoomTheme();
  const { setFontScaleId, scaled } = useFontScale();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [accountStatus, roomProfile, log] = await Promise.all([
        getAccountStatus(accountId),
        loadRoomProfile(accountId),
        loadCheckinLog(accountId),
      ]);
      setStatus(accountStatus);
      setProfile(roomProfile);
      setCheckinLog(log);
      // Restore the saved theme/font-size into the shared contexts —
      // covers opening this screen fresh (e.g. a future direct
      // re-entry/unlock flow) rather than relying on Personalize/Settings
      // having just set it live.
      if (roomProfile?.themeId) setThemeId(roomProfile.themeId);
      if (roomProfile?.fontScaleId) setFontScaleId(roomProfile.fontScaleId);
    } catch {
      setError('โหลดสถานะห้องไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }, [accountId, setThemeId, setFontScaleId]);

  useEffect(() => {
    load();
  }, [load]);

  // Which authorized-guardian name (if any) to show under each tile —
  // feedback: "ใต้ตู้ ระบุชื่อผู้มีสิทธิเปิดตู้ (ในกรณีไม่กำหนด specific
  // ก็ไม่ต้องระบุชื่อ)". Reloaded on focus (not just mount) so coming
  // back from CategoryDetailScreen after saving shows the new name
  // immediately, without needing a full remount.
  const [categoryAuthNames, setCategoryAuthNames] = useState<Record<string, string | null>>({});
  // Custom slot (safes 7-12) names — feedback: "ตู้ที่ 7-12 ยังไม่เปิดให้
  // ใส่ชื่อและข้อความ". Reloaded on focus too, same reason as above (a
  // name just set in CategoryDetailScreen should show up immediately on
  // returning here).
  const [customNames, setCustomNames] = useState<Record<string, string | null>>({});
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const contacts = await loadGuardianContacts(accountId);
        const entries = await Promise.all(
          CATEGORIES.map(async (cat) => {
            const access = await loadCategoryAccess(accountId, cat.id);
            const name = access.type === 'guardian' ? contacts?.guardians[access.index]?.name ?? null : null;
            return [cat.id, name] as const;
          })
        );
        if (!cancelled) setCategoryAuthNames(Object.fromEntries(entries));
        const customEntries = await loadAllCustomCategoryNames(accountId, CUSTOM_SLOT_IDS);
        if (!cancelled) setCustomNames(customEntries);
      })();
      return () => {
        cancelled = true;
      };
    }, [accountId])
  );

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const result = await sendHeartbeat(accountId);
      if (result) {
        setStatus((prev) =>
          prev ? { ...prev, dmsHeartbeatAt: result.dmsHeartbeatAt, dmsThresholdHours: result.dmsThresholdHours } : prev
        );
        // Feedback: the countdown text often reads identical before and
        // after a successful check-in (it just resets to the same
        // starting value, e.g. "ครบกำหนดอีก 14 วัน" both times), so
        // pressing the button looked like it did nothing. This local
        // counter + timestamp always visibly changes.
        const log = await recordCheckin(accountId);
        setCheckinLog(log);
        setJustCheckedIn(true);
        setTimeout(() => setJustCheckedIn(false), 2500);
      } else {
        appAlert('เช็คอิน', 'บัญชีนี้ยังไม่ได้ตั้งค่ากุญแจไขความลับสำหรับทายาท');
      }
    } catch {
      appAlert('เช็คอิน', 'เช็คอินไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setCheckingIn(false);
    }
  };

  const usedBytes = status?.storageUsedBytes ?? 0;
  const usedFraction = Math.min(1, usedBytes / TOTAL_STORAGE_BYTES);
  const dmsConfigured = status ? status.dmsThresholdHours != null : false;

  const themeColor = accentColor;
  const Avatar = getAvatarComponent(profile?.avatarId ?? 'cat');
  const roomTitle = profile?.nickname ? `ห้องลับของ${profile.nickname}` : 'ห้องของฉัน';

  // Feedback: there should be a way to explicitly close the room on
  // exit, with one more reminder that nobody — including the app's own
  // creator — can recover anything if the owner loses their own PIN/12
  // words. This used to be an inline confirm dialog; now a full page
  // (ExitScreen.tsx) since the warning deserves more room than a popup.
  const handleLockRoom = () => {
    navigation.navigate('Exit');
  };

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar size={40} />
          <Text style={[styles.title, { fontSize: scaled(20) }]}>{roomTitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Dashboard', { accountId })}>
            <IconBadge size={40}>
              <ChartIcon size={18} color={colors.textPrimary} />
            </IconBadge>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Settings', { accountId })}
          >
            <IconBadge size={40}>
              <GearIcon size={20} color={colors.textPrimary} />
            </IconBadge>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleLockRoom}>
            <IconBadge size={40}>
              <DoorExitIcon size={19} color={colors.textPrimary} />
            </IconBadge>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.card}>
            <View style={styles.storageRow}>
              <Text style={styles.storageText}>ใช้ไป {formatMB(usedBytes)} MB</Text>
              <Text style={styles.storageText}>เหลือ {formatMB(TOTAL_STORAGE_BYTES - usedBytes)} MB</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${usedFraction * 100}%`, backgroundColor: themeColor }]} />
            </View>
          </View>

          {/* Feedback: the old side-by-side row (long paragraph squeezed
              next to the button) read badly on a narrow phone and made
              the button hard to hit reliably. Stacked layout instead —
              text on top, full-width button below, always reachable. */}
          <View style={[styles.card, styles.dmsCard]}>
            <View style={styles.dmsTextBlock}>
              <Text style={[styles.dmsTitle, { fontSize: scaled(16) }]}>เช็คอินความปลอดภัย</Text>
              <Text style={[styles.dmsExplainer, { fontSize: scaled(15) }]}>
                อย่าลืมกดปุ่ม Check in ทุกครั้ง เพื่อยืนยันว่า "ฉันยังอยู่และยังควบคุมข้อมูลของฉันเอง" หากคุณไม่กดปุ่มนี้ภายใน{' '}
                {status?.dmsThresholdHours != null ? Math.round(status.dmsThresholdHours / 24) : '14'} วัน (ตามที่คุณเลือกในหน้าก่อน)
                เราจะส่งรหัสกุญแจสำรองการเข้าห้องลับให้ตามชื่อที่ท่านระบุไว้ในหน้า "ระบุชื่อผู้รับรหัสกุญแจสำรอง"
              </Text>
              <Text style={styles.dmsSubtitle}>{status ? describeDms(status) : ''}</Text>
              {checkinLog && (
                <Text style={styles.checkinLogText}>
                  เช็คอินครั้งที่ {checkinLog.count} — ล่าสุด {formatThaiDateTime(checkinLog.lastCheckinAt)}
                </Text>
              )}
              {!dmsConfigured && (
                <Text style={styles.dmsHint}>ปุ่มนี้จะกดได้เมื่อตั้งค่ากุญแจไขความลับสำหรับทายาทแล้ว</Text>
              )}
            </View>
            {justCheckedIn ? (
              <View style={[styles.checkinButton, styles.checkinSuccess, { borderColor: accentColor }]}>
                <CheckCircleIcon size={18} color={accentColor} />
                <Text style={[styles.checkinSuccessText, { color: accentColor }]}>เช็คอินแล้ว</Text>
              </View>
            ) : (
              <PrimaryButton
                variant="secondary"
                label={checkingIn ? 'กำลังเช็คอิน…' : 'เช็คอิน'}
                disabled={checkingIn || !dmsConfigured}
                onPress={handleCheckIn}
                style={styles.checkinButton}
              />
            )}
          </View>

          {/* Feedback: laid out as a 3x4 grid of "safe" tiles — empty
              slots read as visibly empty at a glance (dashed border,
              muted "+"), and unnamed custom slots show a big standalone
              number rather than a full text row, per the exact request. */}
          <View style={styles.grid}>
            {CATEGORIES.map((cat, i) => {
              const Icon = cat.icon;
              const authName = categoryAuthNames[cat.id];
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.tile, { borderColor: `${themeColor}55` }]}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('CategoryDetail', { accountId, categoryId: cat.id })}
                >
                  <SafeGraphic width={100} height={112} color={themeColor} />
                  <Text style={[styles.tileNumber, { color: themeColor }]}>{i + 1}</Text>
                  <IconBadge size={36} tint={themeColor} style={styles.tileIcon}>
                    <Icon size={18} color={colors.textPrimary} />
                  </IconBadge>
                  <Text style={[styles.tileName, { fontSize: scaled(13) }]} numberOfLines={2}>
                    {cat.nameTh}
                  </Text>
                  {/* Feedback: show who's authorized, but only when a
                      specific heir was actually chosen — "unspecified"
                      and "secret" deliberately show nothing here. */}
                  {authName && (
                    <Text style={styles.tileAuthName} numberOfLines={1}>
                      สิทธิ์: {authName}
                    </Text>
                  )}
                </Pressable>
              );
            })}

            {CUSTOM_SLOT_IDS.map((slotId, i) => {
              const safeNumber = CATEGORIES.length + i + 1;
              const customName = customNames[slotId];
              // Feedback: these 6 slots used to just show a "coming soon"
              // alert — now they're real, nameable safes like the other
              // 6, styled the same once named (or still visibly "empty"
              // until then, tapping either way opens CategoryDetail).
              return (
                <Pressable
                  key={slotId}
                  style={[styles.tile, customName ? { borderColor: `${themeColor}55` } : styles.tileEmpty]}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('CategoryDetail', { accountId, categoryId: slotId })}
                >
                  {customName ? (
                    <>
                      <SafeGraphic width={100} height={112} color={themeColor} />
                      <Text style={[styles.tileNumber, { color: themeColor }]}>{safeNumber}</Text>
                      <IconBadge size={36} tint={themeColor} style={styles.tileIcon}>
                        <DocumentIcon size={18} color={colors.textPrimary} />
                      </IconBadge>
                      <Text style={[styles.tileName, { fontSize: scaled(13) }]} numberOfLines={2}>
                        {customName}
                      </Text>
                    </>
                  ) : (
                    <>
                      <SafeGraphic width={100} height={112} color={colors.textMuted} opacity={0.3} />
                      <Text style={styles.tileEmptyNumber}>{safeNumber}</Text>
                      <PlusIcon size={16} color={colors.textMuted} />
                      <Text style={styles.tileEmptyLabel}>ว่าง — แตะเพื่อตั้งชื่อ</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
    </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  // Padding lives here, on an inner View, not on SafeAreaView itself — see
  // the identical comment in DoneScreen.tsx for why.
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, paddingRight: spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, fontSize: 20, color: colors.textPrimary, flexShrink: 1 },
  loader: { marginTop: spacing.xxl },
  error: { color: colors.dangerText, marginBottom: spacing.md },
  // Feedback: "app ยังดูไม่น่าใช้" — flat bordered boxes read as plain
  // wireframes. A soft shadow gives cards actual depth against the
  // background instead of just a thin outline.
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  storageText: { ...typography.body, fontSize: 15, color: colors.textSecondary },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accentTeal, borderRadius: 3 },
  dmsCard: { flexDirection: 'column' },
  dmsTextBlock: { marginBottom: spacing.md },
  dmsTitle: { ...typography.body, fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  dmsExplainer: { ...typography.body, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 21 },
  dmsSubtitle: { ...typography.body, fontSize: 16, color: colors.textMuted },
  dmsHint: { ...typography.body, fontSize: 16, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  checkinLogText: { ...typography.body, fontSize: 13, color: colors.textMuted, marginTop: 6 },
  checkinButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, width: '100%' },
  checkinSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderRadius: 14,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    width: '100%',
  },
  checkinSuccessText: { ...typography.label, fontSize: 14 },
  // 3-column grid of "safe" tiles (feedback: rows of text felt like a
  // file list, not a room of safes — this reads more like a wall of
  // safes at a glance, with empty ones visibly empty).
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  tile: {
    width: '31%',
    aspectRatio: 0.92,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  tileNumber: { ...typography.label, fontSize: 13, position: 'absolute', top: 8, left: 10 },
  tileIcon: { marginBottom: spacing.xs },
  tileName: { ...typography.body, fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  tileAuthName: { ...typography.body, fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  // Unnamed custom slots — a big standalone number instead of a text
  // row, so it's obviously a placeholder waiting to be named, not a
  // real safe with content.
  tileEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  tileEmptyNumber: { ...typography.title, fontSize: 30, color: colors.textMuted, marginBottom: 2 },
  tileEmptyLabel: { ...typography.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
