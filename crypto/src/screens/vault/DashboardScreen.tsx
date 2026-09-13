// Dashboard — usage summary + activity log + room-status overview.
// Reachable from VaultHome's chart icon.
//
// Feedback: "icon กราฟ ... ควรเป็น Dashboard - activity log, memory
// status, วันที่ที่ข้อมูลจะถูก notify third party, วันที่ที่ข้อมูลจะถูก
// delete, basic info setting completion% ... แต่กลับมีแค่ activity log"
// — this used to be just storage + activity log; now also shows:
//   - "สถานะความทรงจำ": how many of the 12 safes have a note saved
//     (a cheap local existence check — see categoryNotes.ts's
//     hasCategoryNote — not a real per-safe content browser)
//   - the actual date guardians become eligible to request the recovery
//     key (from the account's own dms_heartbeat_at + dms_threshold_hours)
//   - the actual date this room is due for permanent auto-deletion
//     (last_active_at + 1 year — the same policy WarningScreen/
//     DMSSetupScreen already warn about)
//   - a "setup completion" percentage combining PIN/guardian/nickname
//     setup + how many safes have content, as one at-a-glance number
//
// Real: overall storage used/remaining, the activity list, and all of
// the above (all read from the real accounts row / activity_log table
// / local AsyncStorage). NOT real: a per-category storage BYTE
// breakdown — `blobs` has category_id now (see 0005_blob_metadata.sql)
// but nothing here sums bytes per category yet, so storage stays a
// single overall bar rather than fabricating a breakdown.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ArrowLeftIcon, ChartIcon, CheckCircleIcon, DocumentIcon, LockClosedIcon } from '../../components/icons';
import { IconBadge } from '../../components/IconBadge';
import { ThemedBackground } from '../../components/ThemedBackground';
import { colors, spacing, typography } from '../../theme/tokens';
import { getAccountStatus, getActivityLog, type ActivityLogEntry } from '../../services/backend';
import { loadDeviceLock } from '../../services/deviceLock';
import { loadRoomProfile } from '../../services/localProfile';
import { hasCategoryNote } from '../../services/categoryNotes';
import { CATEGORIES } from '../../data/categories';
import { useRoomTheme } from '../../theme/RoomThemeContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Dashboard'>;

const TOTAL_STORAGE_BYTES = 104_857_600; // 100 MB, matches get-upload-url's cap
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AUTO_DELETE_DAYS = 365;
const CUSTOM_SLOT_IDS = Array.from({ length: 6 }, (_, i) => `custom-${i + 1}`);
const ALL_SLOT_IDS = [...CATEGORIES.map((c) => c.id), ...CUSTOM_SLOT_IDS];

const EVENT_LABELS: Record<ActivityLogEntry['eventType'], string> = {
  upload: 'อัปโหลดไฟล์',
  heartbeat: 'เช็คอินความปลอดภัย',
  dms_setup: 'ตั้งค่ากุญแจไขความลับสำหรับทายาท',
};

function formatThaiDateTime(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function describeEntry(entry: ActivityLogEntry): string | null {
  if (entry.eventType === 'upload' && entry.detail && typeof entry.detail.file_size_bytes === 'number') {
    return `${(entry.detail.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (entry.eventType === 'dms_setup' && entry.detail && typeof entry.detail.guardian_count === 'number') {
    return `${entry.detail.guardian_count} ผู้รับ`;
  }
  return null;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

interface RoomStatus {
  hasPin: boolean;
  hasNickname: boolean;
  dmsConfigured: boolean;
  notesFilledCount: number;
  notifyDueAt: string | null;
  autoDeleteAt: string | null;
}

export function DashboardScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [usedBytes, setUsedBytes] = useState(0);
  const [activity, setActivity] = useState<ActivityLogEntry[] | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accentColor, backgroundColor } = useRoomTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [status, log, lock, profile, noteFlags] = await Promise.all([
          getAccountStatus(accountId),
          getActivityLog(accountId),
          loadDeviceLock(),
          loadRoomProfile(accountId),
          Promise.all(ALL_SLOT_IDS.map((id) => hasCategoryNote(accountId, id))),
        ]);
        if (cancelled) return;
        setUsedBytes(status.storageUsedBytes);
        setActivity(log);

        const notifyDueAt =
          status.dmsHeartbeatAt != null && status.dmsThresholdHours != null
            ? new Date(new Date(status.dmsHeartbeatAt).getTime() + status.dmsThresholdHours * 60 * 60 * 1000).toISOString()
            : null;
        const autoDeleteAt =
          status.lastActiveAt != null
            ? new Date(new Date(status.lastActiveAt).getTime() + AUTO_DELETE_DAYS * MS_PER_DAY).toISOString()
            : null;

        setRoomStatus({
          hasPin: lock != null && lock.accountId === accountId,
          hasNickname: !!profile?.nickname,
          dmsConfigured: status.dmsThresholdHours != null,
          notesFilledCount: noteFlags.filter(Boolean).length,
          notifyDueAt,
          autoDeleteAt,
        });
      } catch {
        if (!cancelled) setError('โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const usedFraction = Math.min(1, usedBytes / TOTAL_STORAGE_BYTES);

  // 4 equally-weighted milestones: PIN set, guardians configured,
  // nickname personalized, and how many of the 12 safes have a note.
  const completionPercent = roomStatus
    ? Math.round(
        ((roomStatus.hasPin ? 1 : 0) +
          (roomStatus.dmsConfigured ? 1 : 0) +
          (roomStatus.hasNickname ? 1 : 0) +
          roomStatus.notesFilledCount / ALL_SLOT_IDS.length) *
          25
      )
    : 0;

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={12}>
          <ArrowLeftIcon size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>แดชบอร์ด</Text>
        <View style={{ width: 20 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <IconBadge size={32} tint={accentColor}>
                <CheckCircleIcon size={16} color={colors.textPrimary} />
              </IconBadge>
              <Text style={styles.cardTitle}>ตั้งค่าเสร็จแล้ว {completionPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionPercent}%`, backgroundColor: accentColor }]} />
            </View>
            <Text style={styles.cardSubtext}>
              {[
                roomStatus?.hasPin ? 'ตั้ง PIN แล้ว' : 'ยังไม่ได้ตั้ง PIN',
                roomStatus?.dmsConfigured ? 'มีผู้ถือกุญแจสำรองแล้ว' : 'ยังไม่มีผู้ถือกุญแจสำรอง',
                roomStatus?.hasNickname ? 'ตั้งชื่อห้องแล้ว' : 'ยังไม่ได้ตั้งชื่อห้อง',
                `มีข้อความ ${roomStatus?.notesFilledCount ?? 0}/${ALL_SLOT_IDS.length} ตู้`,
              ].join(' · ')}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.storageRow}>
              <Text style={styles.storageText}>ใช้ไป {formatMB(usedBytes)} MB</Text>
              <Text style={styles.storageText}>เหลือ {formatMB(TOTAL_STORAGE_BYTES - usedBytes)} MB</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${usedFraction * 100}%`, backgroundColor: accentColor }]} />
            </View>
          </View>

          {/* Feedback: "แดชบอรด์ ตาราง activity log หายไป" — it never
              actually left the code, but the 3 new date/status cards
              below pushed it far enough down that it read as gone on a
              real phone screen. Moved back up right after storage (where
              it always was) so it's visible without much scrolling; the
              newer status cards now come after it instead of before. */}
          <Text style={styles.sectionLabel}>กิจกรรมล่าสุด</Text>
          {activity && activity.length === 0 && <Text style={styles.emptyText}>ยังไม่มีกิจกรรม</Text>}
          {activity?.map((entry, i) => {
            const detail = describeEntry(entry);
            return (
              <View key={i} style={styles.activityRow}>
                <IconBadge size={36} tint={accentColor}>
                  <ChartIcon size={16} color={colors.textPrimary} />
                </IconBadge>
                <View style={styles.activityTextBlock}>
                  <Text style={styles.activityLabel}>{EVENT_LABELS[entry.eventType]}</Text>
                  <Text style={styles.activityTime}>
                    {formatThaiDateTime(entry.createdAt)}
                    {detail ? ` · ${detail}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}

          <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>สถานะห้อง</Text>
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <IconBadge size={32} tint={accentColor}>
                <DocumentIcon size={16} color={colors.textPrimary} />
              </IconBadge>
              <Text style={styles.cardTitle}>สถานะความทรงจำ</Text>
            </View>
            <Text style={styles.cardSubtext}>
              {roomStatus?.notesFilledCount ?? 0} จาก {ALL_SLOT_IDS.length} ตู้มีข้อความบันทึกไว้แล้ว (ยังไม่นับไฟล์แนบ)
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <IconBadge size={32} tint={colors.dangerText}>
                <LockClosedIcon size={16} color={colors.textPrimary} />
              </IconBadge>
              <Text style={styles.cardTitle}>วันที่ผู้ถือกุญแจสำรองเริ่มกู้คืนได้</Text>
            </View>
            <Text style={styles.cardSubtext}>
              {roomStatus?.notifyDueAt
                ? `${formatThaiDate(roomStatus.notifyDueAt)} — ถ้าคุณไม่เข้าห้องนี้เลยก่อนวันนี้ (ระบบข้อความแจ้งเตือนอัตโนมัติถึงผู้ถูกระบุชื่อให้ถือรหัสสำรอง — ฟีเจอร์นี้ยังไม่เปิดใช้งาน)`
                : 'ยังไม่ได้ตั้งค่ากุญแจไขความลับสำหรับทายาท'}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <IconBadge size={32} tint={colors.dangerText}>
                <DocumentIcon size={16} color={colors.textPrimary} />
              </IconBadge>
              <Text style={styles.cardTitle}>วันที่ห้องนี้จะถูกลบอัตโนมัติ</Text>
            </View>
            <Text style={styles.cardSubtext}>
              {roomStatus?.autoDeleteAt
                ? `${formatThaiDate(roomStatus.autoDeleteAt)} — นับจากวันเช็คอิน/ใช้งานล่าสุด หากไม่เช็คอินหรือเข้าห้องเลยก่อนวันนี้`
                : 'ยังไม่มีข้อมูลการใช้งาน'}
            </Text>
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
  title: { ...typography.title, fontSize: 18, color: colors.textPrimary },
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
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { ...typography.body, fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  cardSubtext: { ...typography.body, fontSize: 14, color: colors.textSecondary, lineHeight: 19 },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  storageText: { ...typography.body, fontSize: 15, color: colors.textSecondary },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.accentTeal, borderRadius: 3 },
  sectionLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { ...typography.body, fontSize: 15, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.lg },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityTextBlock: { flex: 1 },
  activityLabel: { ...typography.body, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  activityTime: { ...typography.body, fontSize: 16, color: colors.textMuted, marginTop: 2 },
});
