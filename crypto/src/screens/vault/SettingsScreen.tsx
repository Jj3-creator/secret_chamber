// Settings — reachable from VaultHome's sun icon.
// Feedback: "icon พระอาทิตย์ ... setting, ควรเข้าถึงได้เลย เช่น font,
// theme, notify due date" — this used to be a placeholder alert
// ("หน้าตั้งค่าจะพร้อมใช้งานเร็วๆ นี้"); now a real settings page.
//
// Theme picker: fully real, same RoomThemeContext + ROOM_THEMES already
// used by PersonalizeScreen — picking one here re-colors the whole app
// immediately and persists via localProfile.ts, same mechanism.
//
// Font size: a real, persisted preference (FontScaleContext.tsx) —
// honestly scoped so far to VaultHomeScreen + CategoryDetailScreen's own
// text (the screens people actually read day-to-day), not yet retrofitted
// to every single screen in the app (this app's styles are static
// StyleSheet.create() objects, not context-aware — doing that everywhere
// is a bigger follow-up than a Settings screen).
//
// Notify due date: read-only info pulled from the same account status
// DashboardScreen already computes it from (dms_heartbeat_at +
// dms_threshold_hours) — shown here too since it's exactly the kind of
// thing a "notify due date" settings entry means.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ArrowLeftIcon } from '../../components/icons';
import { ThemedBackground } from '../../components/ThemedBackground';
import { colors, spacing, typography } from '../../theme/tokens';
import { ROOM_THEMES } from '../../theme/roomThemes';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { FONT_SCALE_OPTIONS, useFontScale } from '../../theme/FontScaleContext';
import { loadRoomProfile, saveRoomProfile } from '../../services/localProfile';
import { getAccountStatus } from '../../services/backend';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Settings'>;

function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function SettingsScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const { themeId, accentColor, backgroundColor, setThemeId } = useRoomTheme();
  const { fontScaleId, setFontScaleId, scaled } = useFontScale();
  const [notifyDueAt, setNotifyDueAt] = useState<string | null>(null);
  const [loadingNotify, setLoadingNotify] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAccountStatus(accountId)
      .then((status) => {
        if (cancelled) return;
        if (status.dmsHeartbeatAt != null && status.dmsThresholdHours != null) {
          setNotifyDueAt(
            new Date(new Date(status.dmsHeartbeatAt).getTime() + status.dmsThresholdHours * 60 * 60 * 1000).toISOString()
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingNotify(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const persist = async (patch: Partial<{ themeId: string; fontScaleId: string }>) => {
    const existing = await loadRoomProfile(accountId);
    await saveRoomProfile(accountId, {
      nickname: existing?.nickname ?? '',
      avatarId: existing?.avatarId ?? 'cat',
      themeId: patch.themeId ?? existing?.themeId ?? themeId,
      fontScaleId: patch.fontScaleId ?? existing?.fontScaleId ?? fontScaleId,
    });
  };

  const handlePickTheme = (id: string) => {
    setThemeId(id);
    persist({ themeId: id });
  };

  const handlePickFontScale = (id: string) => {
    setFontScaleId(id);
    persist({ fontScaleId: id });
  };

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={12}>
              <ArrowLeftIcon size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.title}>ตั้งค่า</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>โทนสีห้อง</Text>
            <View style={styles.themeRow}>
              {ROOM_THEMES.map((t) => {
                const active = themeId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => handlePickTheme(t.id)}
                    style={styles.themeSwatchWrapper}
                  >
                    <View style={[styles.themeSwatch, { backgroundColor: t.color }, active && styles.themeSwatchActive]} />
                    <Text style={styles.themeLabel}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>ขนาดตัวอักษร</Text>
            <View style={styles.fontRow}>
              {FONT_SCALE_OPTIONS.map((opt) => {
                const active = fontScaleId === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => handlePickFontScale(opt.id)}
                    style={[styles.fontChip, active && { borderColor: accentColor, backgroundColor: `${accentColor}1F` }]}
                  >
                    <Text style={[styles.fontChipText, { fontSize: scaled(15) }, active && styles.fontChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fontNote}>
              ใช้ได้แล้วในหน้าห้องของฉันและหน้าตู้เซฟ — หน้าอื่นๆ จะทยอยรองรับเพิ่มเติม
            </Text>

            <Text style={styles.sectionLabel}>วันแจ้งเตือนผู้ถือกุญแจสำรอง</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {loadingNotify
                  ? 'กำลังโหลด…'
                  : notifyDueAt
                    ? `${formatThaiDate(notifyDueAt)} — ถ้าคุณไม่เช็คอินก่อนวันนี้ ผู้ถือกุญแจสำรองจะขอรหัสได้`
                    : 'ยังไม่ได้ตั้งค่ากุญแจไขความลับสำหรับทายาท'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  sectionLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  themeSwatchWrapper: { alignItems: 'center', gap: spacing.xs },
  themeSwatch: { width: 36, height: 36, borderRadius: 18 },
  themeSwatchActive: { borderWidth: 2, borderColor: colors.textPrimary },
  themeLabel: { ...typography.body, fontSize: 12, color: colors.textSecondary },
  fontRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  fontChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  fontChipText: { ...typography.body, color: colors.textSecondary },
  fontChipTextActive: { color: colors.textPrimary, fontWeight: '600' },
  fontNote: { ...typography.body, fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.md },
  infoBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  infoText: { ...typography.body, fontSize: 15, color: colors.textSecondary, lineHeight: 20 },
});
