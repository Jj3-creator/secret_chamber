// Screen 3.1 — หน้าหลัก (Vault Dashboard home)
//
// Storage stats and the Dead Man's Switch check-in card are wired to the
// REAL deployed backend (accounts row via PostgREST + RLS, dms-heartbeat
// Edge Function) — not mock data. The 6 category rows ARE mock data: the
// backend has no per-category schema yet (blobs aren't grouped into
// "Personal Memory Vault" / "Critical Documents" / etc.), so their file
// counts/sizes below just mirror the design's example numbers. Tapping one
// shows a placeholder alert rather than a real file list (section 04,
// "Upload / View item", isn't built yet).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { getAccountStatus, sendHeartbeat, type AccountStatus } from '../../services/backend';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'VaultHome'>;

const TOTAL_STORAGE_BYTES = 104_857_600; // 100 MB, matches the backend's get-upload-url cap
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface CategoryRow {
  name: string;
  caption: string;
}

// Mock — see file header. Matches the design's example data exactly.
const CATEGORIES: CategoryRow[] = [
  { name: 'Personal Memory Vault', caption: '18 ไฟล์ · 14.8 MB' },
  { name: 'Critical Documents', caption: '9 ไฟล์ · 11.2 MB' },
  { name: 'Health & Sensitive Personal', caption: '6 ไฟล์ · 4.1 MB' },
  { name: 'Ethical Will / Legacy', caption: '3 ไฟล์ · 1.9 MB · ผูกกับ DMS' },
  { name: 'High-Sensitivity Content', caption: 'ล็อกซ้อน · ต้องใส่ PIN อีกครั้ง' },
  { name: 'Decoy Chamber', caption: '12 ไฟล์ · จัดฉากไว้ให้ดู' },
];

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function describeDms(status: AccountStatus): string {
  if (status.dmsThresholdHours == null || status.dmsHeartbeatAt == null) {
    return 'ยังไม่ได้ตั้งค่า Dead Man’s Switch';
  }
  const eligibleAtMs = new Date(status.dmsHeartbeatAt).getTime() + status.dmsThresholdHours * 60 * 60 * 1000;
  const msRemaining = eligibleAtMs - Date.now();
  if (msRemaining <= 0) return 'เลยกำหนดเช็คอินแล้ว';
  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  return `ครบกำหนดอีก ${daysRemaining} วัน`;
}

export function VaultHomeScreen({ route }: Props) {
  const { accountId } = route.params;
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await getAccountStatus(accountId));
    } catch {
      setError('โหลดสถานะห้องไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

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
      } else {
        Alert.alert('เช็คอิน', 'บัญชีนี้ยังไม่ได้ตั้งค่า Dead Man’s Switch');
      }
    } catch {
      Alert.alert('เช็คอิน', 'เช็คอินไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setCheckingIn(false);
    }
  };

  const usedBytes = status?.storageUsedBytes ?? 0;
  const usedFraction = Math.min(1, usedBytes / TOTAL_STORAGE_BYTES);
  const dmsConfigured = status ? status.dmsThresholdHours != null : false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ห้องของฉัน</Text>
        <View style={styles.iconPlaceholder} />
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

          <View style={[styles.card, styles.dmsCard]}>
            <View style={styles.dmsTextBlock}>
              <Text style={styles.dmsTitle}>เช็คอินความปลอดภัย</Text>
              <Text style={styles.dmsSubtitle}>{status ? describeDms(status) : ''}</Text>
            </View>
            <PrimaryButton
              variant="secondary"
              label={checkingIn ? '...' : 'เช็คอิน'}
              disabled={checkingIn || !dmsConfigured}
              onPress={handleCheckIn}
              style={styles.checkinButton}
            />
          </View>

          <View style={styles.categoryList}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.name}
                style={styles.categoryRow}
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(cat.name, 'หน้ารายการไฟล์ในหมวดนี้ยังไม่ได้สร้าง (section 04 — placeholder)')
                }
              >
                <View style={styles.categoryIcon} />
                <View style={styles.categoryTextBlock}>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Text style={styles.categoryCaption}>{cat.caption}</Text>
                </View>
                <Text style={styles.chevron}>{'›'}</Text>
              </Pressable>
            ))}
          </View>
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
  title: { ...typography.title, fontSize: 24, color: colors.textPrimary },
  iconPlaceholder: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
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
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accentTeal, borderRadius: 3 },
  dmsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dmsTextBlock: { flex: 1, marginRight: spacing.md },
  dmsTitle: { ...typography.body, fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
  dmsSubtitle: { ...typography.body, fontSize: 12, color: colors.textMuted },
  checkinButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 88 },
  categoryList: { marginTop: spacing.xs, marginBottom: spacing.lg },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryTextBlock: { flex: 1 },
  categoryName: { ...typography.body, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  categoryCaption: { ...typography.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted },
});
