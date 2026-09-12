// Dashboard — usage summary + activity log (feature D).
// Reachable from VaultHome's new chart icon. "แต่ละห้องใช้ capacity ไปเท่าไหร่
// เหลือเท่าไหร่ ... activity การเข้าใช้งาน" per feedback.
//
// Real: overall storage used/remaining (same accounts row VaultHome
// already reads) and the activity list (activity_log table — real rows
// written by get-upload-url / dms-heartbeat / dms-setup, see
// 0004_activity_log.sql). NOT real: a per-category storage breakdown —
// `blobs` has no category column yet (uploads aren't tagged with a
// category since section 04's upload UI isn't built), so this screen
// says that honestly instead of fabricating numbers.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ArrowLeftIcon, ImageStackIcon, ChartIcon } from '../../components/icons';
import { IconBadge } from '../../components/IconBadge';
import { colors, spacing, typography } from '../../theme/tokens';
import { getAccountStatus, getActivityLog, type ActivityLogEntry } from '../../services/backend';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Dashboard'>;

const TOTAL_STORAGE_BYTES = 104_857_600; // 100 MB, matches get-upload-url's cap

const EVENT_LABELS: Record<ActivityLogEntry['eventType'], string> = {
  upload: 'อัปโหลดไฟล์',
  heartbeat: 'เช็คอินความปลอดภัย',
  dms_setup: 'ตั้งค่า Dead Man’s Switch',
};

function formatThaiDateTime(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
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

export function DashboardScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [usedBytes, setUsedBytes] = useState(0);
  const [activity, setActivity] = useState<ActivityLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [status, log] = await Promise.all([getAccountStatus(accountId), getActivityLog(accountId)]);
        if (cancelled) return;
        setUsedBytes(status.storageUsedBytes);
        setActivity(log);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={12}>
          <ArrowLeftIcon size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>สรุปการใช้งาน</Text>
        <View style={{ width: 20 }} />
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
              <View style={[styles.progressFill, { width: `${usedFraction * 100}%` }]} />
            </View>
          </View>

          <View style={styles.noteBox}>
            <IconBadge size={32} tint={colors.textMuted}>
              <ImageStackIcon size={16} color={colors.textMuted} />
            </IconBadge>
            <Text style={styles.noteText}>
              ยังไม่มีข้อมูลแยกพื้นที่ใช้งานตามหมวด — ไฟล์ที่อัปโหลดยังไม่ได้ผูกกับหมวดเก็บของ (หน้าอัปโหลด/section 04
              ยังไม่ได้สร้าง)
            </Text>
          </View>

          <Text style={styles.sectionLabel}>กิจกรรมล่าสุด</Text>
          {activity && activity.length === 0 && <Text style={styles.emptyText}>ยังไม่มีกิจกรรม</Text>}
          {activity?.map((entry, i) => {
            const detail = describeEntry(entry);
            return (
              <View key={i} style={styles.activityRow}>
                <IconBadge size={36}>
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
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
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  storageText: { ...typography.body, fontSize: 13, color: colors.textSecondary },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accentTeal, borderRadius: 3 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  noteText: { ...typography.body, fontSize: 12, color: colors.textMuted, flex: 1, lineHeight: 17 },
  sectionLabel: { ...typography.label, fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { ...typography.body, fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.lg },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityTextBlock: { flex: 1 },
  activityLabel: { ...typography.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  activityTime: { ...typography.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
