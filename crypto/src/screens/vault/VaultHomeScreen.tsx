// Screen 3.1 — หน้าหลัก (Vault Dashboard home)
//
// Storage stats and the Dead Man's Switch check-in card are wired to the
// REAL deployed backend (accounts row via PostgREST + RLS, dms-heartbeat
// Edge Function) — not mock data. The category rows ARE mock data: the
// backend has no per-category schema yet (blobs aren't grouped into named
// categories), so their file counts/sizes below just mirror the design's
// example numbers. Tapping one shows a placeholder alert rather than a
// real file list (section 04, "Upload / View item", isn't built yet).
import React, { useCallback, useEffect, useState, type ComponentType } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { ThemedBackground } from '../../components/ThemedBackground';
import { appAlert, appConfirm } from '../../components/AppAlert';
import {
  type IconProps,
  ImageStackIcon,
  DocumentIcon,
  HeartPulseIcon,
  FeatherIcon,
  LockIcon,
  GearIcon,
  ChartIcon,
  ChevronRightIcon,
  PlusIcon,
  CheckCircleIcon,
  LockClosedIcon,
} from '../../components/icons';
import { colors, spacing, typography } from '../../theme/tokens';
import { getAccountStatus, sendHeartbeat, type AccountStatus } from '../../services/backend';
import { loadRoomProfile, type RoomProfile } from '../../services/localProfile';
import { recordCheckin, loadCheckinLog, type CheckinLog } from '../../services/checkinLog';
import { loadDeviceLock } from '../../services/deviceLock';
import { getAvatarComponent } from '../../components/avatars';
import { useRoomTheme } from '../../theme/RoomThemeContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'VaultHome'>;

const TOTAL_STORAGE_BYTES = 104_857_600; // 100 MB, matches the backend's get-upload-url cap
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// 5 real categories (Decoy Chamber deliberately excluded — see comment
// below) + 7 blank custom slots = 12 total ("ครบโหล" per feedback).
const CUSTOM_SLOT_COUNT = 7;

interface CategoryRow {
  /** Thai name — primary label per feedback (Thai first, English keyword secondary). */
  nameTh: string;
  nameEn: string;
  /** What this safe is meant to hold — shown as a third line under the name. */
  description: string;
  caption: string;
  icon: ComponentType<IconProps>;
}

// Mock — see file header. Content matches the design's example data;
// Thai-primary naming + descriptions added per user feedback.
const CATEGORIES: CategoryRow[] = [
  {
    nameTh: 'ความทรงจำส่วนตัว',
    nameEn: 'Personal Memory Vault',
    description: 'รูปภาพ วิดีโอ ไดอารี่ หรือความทรงจำที่มีความหมายกับคุณ',
    caption: '18 ไฟล์ · 14.8 MB',
    icon: ImageStackIcon,
  },
  {
    nameTh: 'เอกสารสำคัญ',
    nameEn: 'Critical Documents',
    description: 'พาสปอร์ต สัญญา โฉนดที่ดิน เอกสารราชการ',
    caption: '9 ไฟล์ · 11.2 MB',
    icon: DocumentIcon,
  },
  {
    nameTh: 'สุขภาพและเรื่องอ่อนไหว',
    nameEn: 'Health & Sensitive Personal',
    description: 'ผลตรวจสุขภาพ ประวัติการรักษา ข้อมูลส่วนตัวที่ละเอียดอ่อน',
    caption: '6 ไฟล์ · 4.1 MB',
    icon: HeartPulseIcon,
  },
  {
    nameTh: 'พินัยกรรม/มรดกข้อมูล',
    nameEn: 'Ethical Will / Legacy',
    description: 'สิ่งที่อยากส่งต่อให้คนที่รัก หลังจากคุณจากไป',
    caption: '3 ไฟล์ · 1.9 MB · ผูกกับ DMS',
    icon: FeatherIcon,
  },
  {
    nameTh: 'เนื้อหาความอ่อนไหวสูง',
    nameEn: 'High-Sensitivity Content',
    description: 'ต้องใส่ PIN ซ้ำอีกชั้นก่อนเข้าดู',
    caption: 'ล็อกซ้อน · ต้องใส่ PIN อีกครั้ง',
    icon: LockIcon,
  },
  // NO "Decoy Chamber" entry here — on purpose. This screen is what the
  // REAL PIN unlocks. If the decoy vault showed up as just another row in
  // this list, anyone who coerces the owner into unlocking the real vault
  // would immediately see "there's a decoy" and know to demand the other
  // PIN too — defeating the entire point of having one. Per the design
  // (screen 2.3, "ผลลัพธ์: DECOY CHAMBER"), the decoy vault is its own
  // completely separate screen, reachable ONLY by entering the Decoy PIN
  // at unlock (section 02, not built yet) — never listed inside this one.
];

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
      // Restore the saved theme into the shared context — covers opening
      // this screen fresh (e.g. a future direct re-entry/unlock flow)
      // rather than relying on Personalize having just set it live.
      if (roomProfile?.themeId) setThemeId(roomProfile.themeId);
    } catch {
      setError('โหลดสถานะห้องไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }, [accountId, setThemeId]);

  useEffect(() => {
    load();
  }, [load]);

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
  // words. Re-locks to the PIN screen if this device has one set up
  // (SetPinScreen), otherwise all the way back to Welcome.
  const handleLockRoom = () => {
    appConfirm(
      'ปิดห้องลับ',
      'คำเตือนอีกครั้ง: แอปนี้ ผู้ดูแล/ผู้สร้างแอป ไม่สามารถดึงหรือกู้ข้อมูลใดๆ ให้ท่านได้ทั้งนั้น ท่านต้องเก็บรักษา PIN และ 12 คำด้วยตัวเองอย่างระมัดระวัง',
      async () => {
        const lock = await loadDeviceLock();
        navigation.reset({
          index: 0,
          routes: [lock ? { name: 'Unlock' } : { name: 'Welcome' }],
        });
      },
      { confirmText: 'ปิดห้อง', cancelText: 'ยกเลิก' }
    );
  };

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar size={40} />
          <Text style={styles.title}>{roomTitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Dashboard', { accountId })}>
            <IconBadge size={40}>
              <ChartIcon size={18} color={colors.textPrimary} />
            </IconBadge>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => appAlert('ตั้งค่า', 'หน้าตั้งค่า (section 05) ยังไม่ได้สร้าง')}
          >
            <IconBadge size={40}>
              <GearIcon size={20} color={colors.textPrimary} />
            </IconBadge>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleLockRoom}>
            <IconBadge size={40}>
              <LockClosedIcon size={19} color={colors.textPrimary} />
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

          <View style={[styles.card, styles.dmsCard]}>
            <View style={styles.dmsTextBlock}>
              <Text style={styles.dmsTitle}>เช็คอินความปลอดภัย</Text>
              <Text style={styles.dmsExplainer}>
                กดปุ่มนี้เป็นระยะเพื่อบอกระบบว่า "ฉันยังอยู่" ถ้าคุณหายไปนานเกินกำหนด ระบบจะเริ่มส่งกุญแจของหมวด
                พินัยกรรม/มรดกข้อมูล ให้ผู้ถือกุญแจสำรองที่คุณตั้งไว้
              </Text>
              <Text style={styles.dmsSubtitle}>{status ? describeDms(status) : ''}</Text>
              {checkinLog && (
                <Text style={styles.checkinLogText}>
                  เช็คอินครั้งที่ {checkinLog.count} — ล่าสุด {formatThaiDateTime(checkinLog.lastCheckinAt)}
                </Text>
              )}
              {!dmsConfigured && (
                <Text style={styles.dmsHint}>
                  ปุ่มนี้จะกดได้เมื่อตั้งค่ากุญแจไขความลับสำหรับทายาทแล้ว (หน้าตั้งค่ายังไม่ได้สร้าง)
                </Text>
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
                label={checkingIn ? '...' : 'เช็คอิน'}
                disabled={checkingIn || !dmsConfigured}
                onPress={handleCheckIn}
                style={styles.checkinButton}
              />
            )}
          </View>

          <View style={styles.categoryList}>
            {CATEGORIES.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <Pressable
                  key={cat.nameEn}
                  style={styles.categoryRow}
                  accessibilityRole="button"
                  onPress={() =>
                    appAlert(cat.nameTh, 'หน้ารายการไฟล์ในหมวดนี้ยังไม่ได้สร้าง (section 04 — placeholder)')
                  }
                >
                  <IconBadge size={44} tint={themeColor}>
                    <Icon size={22} color={colors.textPrimary} />
                  </IconBadge>
                  <View style={styles.categoryTextBlock}>
                    <Text style={[styles.safeLabel, { color: themeColor }]}>ตู้เซฟใบที่ {i + 1}</Text>
                    <Text style={styles.categoryName}>
                      {cat.nameTh} <Text style={styles.categoryNameEn}>({cat.nameEn})</Text>
                    </Text>
                    <Text style={styles.categoryDescription}>{cat.description}</Text>
                    <Text style={styles.categoryCaption}>{cat.caption}</Text>
                  </View>
                  <ChevronRightIcon size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}

            {Array.from({ length: CUSTOM_SLOT_COUNT }, (_, i) => {
              const safeNumber = CATEGORIES.length + i + 1;
              return (
                <Pressable
                  key={`custom-${safeNumber}`}
                  style={styles.categoryRow}
                  accessibilityRole="button"
                  onPress={() => appAlert('ตั้งชื่อตู้เซฟของคุณ', 'การสร้างหมวดเองยังไม่ได้สร้าง (placeholder)')}
                >
                  <IconBadge size={44} tint={colors.textMuted}>
                    <PlusIcon size={20} color={colors.textMuted} />
                  </IconBadge>
                  <View style={styles.categoryTextBlock}>
                    <Text style={styles.safeLabel}>ตู้เซฟใบที่ {safeNumber}</Text>
                    <Text style={styles.emptySlotText}>แตะเพื่อตั้งชื่อหมวดของคุณเอง</Text>
                  </View>
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
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  dmsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dmsTextBlock: { flex: 1, marginRight: spacing.md },
  dmsTitle: { ...typography.body, fontSize: 16, color: colors.textPrimary, marginBottom: 2 },
  dmsExplainer: { ...typography.body, fontSize: 16, color: colors.textSecondary, marginBottom: 4, lineHeight: 17 },
  dmsSubtitle: { ...typography.body, fontSize: 16, color: colors.textMuted },
  dmsHint: { ...typography.body, fontSize: 16, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  checkinLogText: { ...typography.body, fontSize: 13, color: colors.textMuted, marginTop: 6 },
  checkinButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 88 },
  checkinSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderRadius: 14,
    justifyContent: 'center',
  },
  checkinSuccessText: { ...typography.label, fontSize: 14 },
  categoryList: { marginTop: spacing.xs, marginBottom: spacing.lg },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  categoryTextBlock: { flex: 1, marginRight: spacing.xs },
  safeLabel: { ...typography.label, fontSize: 16, color: colors.accentTeal, marginBottom: 2 },
  categoryName: { ...typography.body, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  categoryNameEn: { fontWeight: '400', color: colors.textMuted, fontSize: 15 },
  categoryDescription: { ...typography.body, fontSize: 16, color: colors.textSecondary, marginTop: 2 },
  categoryCaption: { ...typography.body, fontSize: 16, color: colors.textMuted, marginTop: 2 },
  emptySlotText: { ...typography.body, fontSize: 15, color: colors.textMuted, fontStyle: 'italic' },
});
