// A single safe's own page — reached by tapping a tile on VaultHome.
// Feedback: "สร้างทางเข้าห้องของตู้เซฟต่างๆ" (a real way in, not just a
// placeholder alert) + "ตู้เซฟแต่ละตู้ควรจะมี authorize ... ให้อยู่ใน
// exit page ของแต่ละตู้" (each safe should let the owner say which
// heirs can access it, on this page).
//
// What's real: loading this safe's name/description (from data/categories.ts),
// loading/saving which guardians are authorized for it (categoryAccess.ts,
// local-only). What's NOT real: there's no actual file list, upload, or
// per-category encryption key yet — every safe is still a UI grouping
// over the single master key (see VaultHomeScreen.tsx's file header) —
// so the "authorize" list here records the owner's intent for later,
// it doesn't yet control anything a guardian could actually exercise.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { ThemedBackground } from '../../components/ThemedBackground';
import { Checkbox } from '../../components/Checkbox';
import { ArrowLeftIcon } from '../../components/icons';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { CATEGORIES, getCategory } from '../../data/categories';
import { loadGuardianContacts, type GuardianSetupRecord } from '../../services/guardianContacts';
import { loadCategoryAccess, saveCategoryAccess } from '../../services/categoryAccess';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CategoryDetail'>;

export function CategoryDetailScreen({ route, navigation }: Props) {
  const { accountId, categoryId } = route.params;
  const category = getCategory(categoryId);
  const { accentColor, backgroundColor } = useRoomTheme();

  const [guardians, setGuardians] = useState<GuardianSetupRecord | null>(null);
  const [authorized, setAuthorized] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [record, access] = await Promise.all([
        loadGuardianContacts(accountId),
        loadCategoryAccess(accountId, categoryId),
      ]);
      if (cancelled) return;
      setGuardians(record);
      setAuthorized(new Set(access));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, categoryId]);

  const toggleGuardian = (i: number) => {
    setAuthorized((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategoryAccess(accountId, categoryId, Array.from(authorized));
      appAlert('บันทึกแล้ว', 'อัปเดตรายชื่อผู้มีสิทธิ์เข้าถึงตู้เซฟนี้แล้ว');
    } finally {
      setSaving(false);
    }
  };

  if (!category) {
    // Shouldn't happen from normal navigation, but categoryId is just a
    // route param — guard against a stale/bad one rather than crash.
    return (
      <SafeAreaView style={styles.notFoundSafeArea}>
        <Text style={styles.notFoundText}>ไม่พบตู้เซฟนี้</Text>
        <PrimaryButton label="ย้อนกลับ" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const Icon = category.icon;
  const categoryIndex = CATEGORIES.findIndex((c) => c.id === categoryId);

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={12}>
              <ArrowLeftIcon size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>ตู้เซฟใบที่ {categoryIndex + 1}</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.heroCard}>
              <IconBadge size={56} tint={accentColor}>
                <Icon size={28} color={colors.textPrimary} />
              </IconBadge>
              <Text style={styles.categoryName}>
                {category.nameTh} <Text style={styles.categoryNameEn}>({category.nameEn})</Text>
              </Text>
              <Text style={styles.categoryDescription}>{category.description}</Text>
            </View>

            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>ยังไม่มีไฟล์ในตู้เซฟนี้ — การอัปโหลดไฟล์จะพร้อมใช้งานเร็วๆ นี้</Text>
            </View>

            <Text style={styles.sectionLabel}>ผู้มีสิทธิ์เข้าถึงตู้เซฟนี้</Text>
            {loading ? null : !guardians || guardians.guardians.length === 0 ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  ยังไม่ได้ตั้งค่าผู้ถือกุญแจสำรอง — ตั้งค่าได้ตอนสร้างห้อง (ขั้นตอน "กุญแจไขความลับสำหรับทายาท")
                  ก่อนถึงจะเลือกได้ว่าใครเข้าถึงตู้เซฟไหนได้บ้าง
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionExplainer}>
                  เลือกว่าทายาทคนไหนควรได้รับสิทธิ์เข้าถึงตู้เซฟใบนี้โดยเฉพาะ (ยังไม่บังคับใช้จริง — บันทึกความต้องการไว้ก่อน)
                </Text>
                {guardians.guardians.map((g, i) => (
                  <Checkbox
                    key={i}
                    checked={authorized.has(i)}
                    onToggle={() => toggleGuardian(i)}
                    label={`ทายาทลำดับที่ ${i + 1}: ${g.name}`}
                  />
                ))}
                <PrimaryButton
                  variant="secondary"
                  label={saving ? 'กำลังบันทึก…' : 'บันทึกรายชื่อผู้มีสิทธิ์'}
                  onPress={handleSave}
                  disabled={saving}
                  style={styles.saveButton}
                />
              </>
            )}
          </ScrollView>

          <PrimaryButton label="ปิดตู้เซฟนี้" variant="secondary" onPress={() => navigation.goBack()} style={styles.closeButton} />
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  notFoundSafeArea: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  notFoundText: { ...typography.body, color: colors.textSecondary },
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  headerTitle: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  categoryName: { ...typography.body, fontSize: 17, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  categoryNameEn: { fontWeight: '400', color: colors.textMuted, fontSize: 14 },
  categoryDescription: { ...typography.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyBoxText: { ...typography.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
  sectionLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  sectionExplainer: { ...typography.body, fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  noteBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  noteText: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 20 },
  saveButton: { marginTop: spacing.sm, marginBottom: spacing.lg },
  closeButton: { marginTop: spacing.md },
});
