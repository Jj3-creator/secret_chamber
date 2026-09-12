// A single safe's own page — reached by tapping a tile on VaultHome.
// Feedback: "สร้างทางเข้าห้องของตู้เซฟต่างๆ" (a real way in, not just a
// placeholder alert) + "ตู้เซฟแต่ละตู้ควรจะมี authorize ... ให้อยู่ใน
// exit page ของแต่ละตู้" (each safe should let the owner say which
// heirs can access it, on this page) + "พื้นที่ตู้เซฟทุกใบ ควรเป็นเหมือน
// white board ใส่ได้ทั้ง text และ file" (a whiteboard-style content area).
//
// What's real: loading this safe's name/description (data/categories.ts),
// loading/saving which single guardian (if any) is authorized for it
// (categoryAccess.ts, local-only), and a REAL encrypted text note per
// safe — encrypted with the actual room master key (crypto.ts's
// encryptData/decryptData) via VaultSessionContext, stored locally.
//
// What's NOT real yet: file attachments (Word/PDF/PNG/JPEG/HTML/...) —
// that needs a file-picker dependency this session doesn't have yet,
// plus real upload wiring to the get-upload-url backend (built in Part
// 2, never connected to a UI). This screen only does the TEXT half of
// "whiteboard" for now. Also unenforced: nothing actually restricts a
// guardian from seeing a safe they're not authorized for — there's no
// per-category encryption key yet, only one master key for the whole
// room (see VaultHomeScreen.tsx's file header) — the authorization
// choice here records the owner's intent for later.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { ThemedBackground } from '../../components/ThemedBackground';
import { RadioOption } from '../../components/RadioOption';
import { ArrowLeftIcon } from '../../components/icons';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { CATEGORIES, getCategory } from '../../data/categories';
import { loadGuardianContacts, type GuardianSetupRecord } from '../../services/guardianContacts';
import { loadCategoryAccess, saveCategoryAccess, type CategoryAccess } from '../../services/categoryAccess';
import { loadCategoryNote, saveCategoryNote } from '../../services/categoryNotes';
import { useVaultSession } from './VaultSessionContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CategoryDetail'>;

function accessKey(access: CategoryAccess): string {
  return access.type === 'guardian' ? `guardian:${access.index}` : access.type;
}

export function CategoryDetailScreen({ route, navigation }: Props) {
  const { accountId, categoryId } = route.params;
  const category = getCategory(categoryId);
  const { accentColor, backgroundColor } = useRoomTheme();
  const { masterKeyHex } = useVaultSession();

  const [guardians, setGuardians] = useState<GuardianSetupRecord | null>(null);
  const [access, setAccess] = useState<CategoryAccess>({ type: 'unspecified' });
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [record, savedAccess] = await Promise.all([
        loadGuardianContacts(accountId),
        loadCategoryAccess(accountId, categoryId),
      ]);
      if (cancelled) return;
      setGuardians(record);
      setAccess(savedAccess);
      if (masterKeyHex) {
        const text = await loadCategoryNote(accountId, categoryId, masterKeyHex);
        if (!cancelled) setNote(text ?? '');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, categoryId, masterKeyHex]);

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    try {
      await saveCategoryAccess(accountId, categoryId, access);
      appAlert('บันทึกแล้ว', 'อัปเดตผู้มีสิทธิ์เข้าถึงตู้เซฟนี้แล้ว');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSaveNote = async () => {
    if (!masterKeyHex) return;
    setSavingNote(true);
    try {
      await saveCategoryNote(accountId, categoryId, note, masterKeyHex);
      appAlert('บันทึกแล้ว', 'บันทึกข้อความในตู้เซฟนี้แล้ว (เข้ารหัสไว้แล้ว)');
    } finally {
      setSavingNote(false);
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

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.heroCard}>
              <IconBadge size={56} tint={accentColor}>
                <Icon size={28} color={colors.textPrimary} />
              </IconBadge>
              <Text style={styles.categoryName}>
                {category.nameTh} <Text style={styles.categoryNameEn}>({category.nameEn})</Text>
              </Text>
              <Text style={styles.categoryDescription}>{category.description}</Text>
            </View>

            <Text style={styles.sectionLabel}>เนื้อหาในตู้เซฟนี้</Text>
            {!masterKeyHex ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>ต้องปลดล็อกห้องด้วย PIN ก่อนถึงจะดู/บันทึกเนื้อหาในตู้เซฟนี้ได้</Text>
              </View>
            ) : (
              <>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="พิมพ์ข้อความที่อยากเก็บไว้ในตู้เซฟนี้…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.whiteboard}
                />
                <Text style={styles.whiteboardHint}>
                  ข้อความนี้เข้ารหัสด้วยกุญแจของห้องคุณเองก่อนบันทึก — แนบไฟล์ (Word/PDF/รูปภาพ/ฯลฯ) จะพร้อมใช้งานเร็วๆ นี้
                </Text>
                <PrimaryButton
                  variant="secondary"
                  label={savingNote ? 'กำลังบันทึก…' : 'บันทึกข้อความ'}
                  onPress={handleSaveNote}
                  disabled={savingNote}
                  style={styles.saveButton}
                />
              </>
            )}

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
                  เลือกได้ 1 ทาง (ยังไม่บังคับใช้จริง — บันทึกความต้องการไว้ก่อน)
                </Text>
                <RadioOption
                  selected={access.type === 'unspecified'}
                  onSelect={() => setAccess({ type: 'unspecified' })}
                  label="ไม่ระบุ (ทุกคนที่มีชื่อเป็นผู้รับรหัสกุญแจสำรอง)"
                />
                {guardians.guardians.map((g, i) => (
                  <RadioOption
                    key={i}
                    selected={access.type === 'guardian' && access.index === i}
                    onSelect={() => setAccess({ type: 'guardian', index: i })}
                    label={`ผู้รับรหัสลำดับที่ ${i + 1}: ${g.name}`}
                  />
                ))}
                <RadioOption
                  selected={access.type === 'secret'}
                  onSelect={() => setAccess({ type: 'secret' })}
                  label="ไม่บอกใคร (เก็บเป็นความลับเฉพาะฉันคนเดียว)"
                />
                <PrimaryButton
                  variant="secondary"
                  label={savingAccess ? 'กำลังบันทึก…' : 'บันทึกผู้มีสิทธิ์'}
                  onPress={handleSaveAccess}
                  disabled={savingAccess}
                  style={styles.saveButton}
                  key={accessKey(access)}
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
  whiteboard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
    ...typography.body,
  },
  whiteboardHint: { ...typography.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.md },
  sectionLabel: { ...typography.label, fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  sectionExplainer: { ...typography.body, fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  noteBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  noteText: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 20 },
  saveButton: { marginTop: spacing.sm, marginBottom: spacing.lg },
  closeButton: { marginTop: spacing.md },
});
