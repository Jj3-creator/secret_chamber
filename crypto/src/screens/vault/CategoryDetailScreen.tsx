// A single safe's own page — reached by tapping a tile on VaultHome.
// Feedback: "สร้างทางเข้าห้องของตู้เซฟต่างๆ" (a real way in, not just a
// placeholder alert) + "ตู้เซฟแต่ละตู้ควรจะมี authorize ... ให้อยู่ใน
// exit page ของแต่ละตู้" (each safe should let the owner say which
// heirs can access it, on this page) + "พื้นที่ตู้เซฟทุกใบ ควรเป็นเหมือน
// white board ใส่ได้ทั้ง text และ file" (a whiteboard-style content area).
//
// What's real: loading this safe's name/description (data/categories.ts),
// loading/saving which single guardian (if any) is authorized for it
// (categoryAccess.ts, local-only), a REAL encrypted text note per safe
// (crypto.ts's encryptData/decryptData via VaultSessionContext), AND real
// file attachments — pick any file type, encrypted on-device, uploaded as
// opaque ciphertext to the real backend (get-upload-url/get-download-url,
// see categoryFiles.ts). Also unenforced: nothing actually restricts a
// guardian from seeing a safe they're not authorized for — there's no
// per-category encryption key yet, only one master key for the whole
// room (see VaultHomeScreen.tsx's file header) — the authorization
// choice here records the owner's intent for later.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, TextInput, ActivityIndicator, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { ThemedBackground } from '../../components/ThemedBackground';
import { SafeGraphic } from '../../components/SafeGraphic';
import { RadioOption } from '../../components/RadioOption';
import { ArrowLeftIcon, DocumentIcon } from '../../components/icons';
import { appAlert, appConfirm, appChoice } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { CATEGORIES, getCategory } from '../../data/categories';
import { loadGuardianContacts, type GuardianSetupRecord } from '../../services/guardianContacts';
import { loadCategoryAccess, saveCategoryAccess, type CategoryAccess } from '../../services/categoryAccess';
import { loadCategoryNote, saveCategoryNote } from '../../services/categoryNotes';
import { loadCustomCategoryName, saveCustomCategoryName } from '../../services/customCategories';
import {
  pickAndUploadFile,
  listFilesForCategory,
  deleteFile,
  downloadAndOpenFile,
  formatFileSize,
  PickCanceledError,
  FileTooLargeError,
  type BlobMeta,
  type FileOpenChoice,
} from '../../services/categoryFiles';
import { useVaultSession } from './VaultSessionContext';
import { useFontScale } from '../../theme/FontScaleContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CategoryDetail'>;

function accessKey(access: CategoryAccess): string {
  return access.type === 'guardian' ? `guardian:${access.index}` : access.type;
}

export function CategoryDetailScreen({ route, navigation }: Props) {
  const { accountId, categoryId } = route.params;
  const category = getCategory(categoryId);
  // Feedback: "ตู้ที่ 7-12 ยังไม่เปิดให้ใส่ชื่อและข้อความ" — those 6 slots
  // aren't in the static CATEGORIES list at all; they're user-named via
  // customCategories.ts instead. Detected by id prefix (VaultHomeScreen
  // always passes 'custom-1'..'custom-6' for them).
  const isCustom = categoryId.startsWith('custom-');
  const { accentColor, backgroundColor } = useRoomTheme();
  const { scaled } = useFontScale();
  const { masterKeyHex } = useVaultSession();

  const [guardians, setGuardians] = useState<GuardianSetupRecord | null>(null);
  const [access, setAccess] = useState<CategoryAccess>({ type: 'unspecified' });
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [customName, setCustomName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [files, setFiles] = useState<BlobMeta[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyBlobId, setBusyBlobId] = useState<string | null>(null);

  const refreshFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const rows = await listFilesForCategory(accountId, categoryId);
      setFiles(rows);
    } catch {
      // Offline / backend hiccup — leave whatever list was already shown
      // rather than blank it out over a transient network error.
    } finally {
      setFilesLoading(false);
    }
  }, [accountId, categoryId]);

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
      if (isCustom) {
        const savedName = await loadCustomCategoryName(accountId, categoryId);
        if (!cancelled) setCustomName(savedName ?? '');
      }
      if (masterKeyHex) {
        const text = await loadCategoryNote(accountId, categoryId, masterKeyHex);
        if (!cancelled) setNote(text ?? '');
      }
      setLoading(false);
    })();
    refreshFiles();
    return () => {
      cancelled = true;
    };
  }, [accountId, categoryId, masterKeyHex, refreshFiles]);

  const handleAttachFile = async () => {
    if (!masterKeyHex) return;
    setUploading(true);
    try {
      await pickAndUploadFile(accountId, categoryId, masterKeyHex);
      await refreshFiles();
    } catch (err) {
      if (err instanceof PickCanceledError) {
        // User closed the picker — not an error, nothing to say.
      } else if (err instanceof FileTooLargeError) {
        appAlert('ไฟล์ใหญ่เกินไป', err.message);
      } else {
        const reason = err instanceof Error ? err.message : String(err);
        appAlert('แนบไฟล์ไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const runFileAction = async (file: BlobMeta, choice: FileOpenChoice) => {
    setBusyBlobId(file.blobId);
    try {
      await downloadAndOpenFile(accountId, file, masterKeyHex!, choice);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      appAlert('เปิดไฟล์ไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
    } finally {
      setBusyBlobId(null);
    }
  };

  // Feedback: "ถ้า click ที่ file ควรให้เลือกว่าจะเปิด หรือ save หรือ
  // เปิดและ save" — web has no OS-level chooser the way native's share
  // sheet already offers one, so a plain tap used to just force-download
  // with no way to simply view the file first. Native keeps its existing
  // one-tap-into-share-sheet behavior (that sheet already IS the choice).
  const handleOpenFile = (file: BlobMeta) => {
    if (!masterKeyHex) return;
    if (Platform.OS !== 'web') {
      runFileAction(file, 'save');
      return;
    }
    appChoice(file.fileName, 'ต้องการเปิดไฟล์นี้ หรือบันทึกลงเครื่อง?', [
      { text: 'เปิด', onPress: () => runFileAction(file, 'open') },
      { text: 'บันทึก', onPress: () => runFileAction(file, 'save') },
      { text: 'ทั้งเปิดและบันทึก', onPress: () => runFileAction(file, 'both') },
    ]);
  };

  const handleDeleteFile = (file: BlobMeta) => {
    appConfirm(
      'ลบไฟล์นี้',
      `ลบ "${file.fileName}" ออกจากตู้เซฟนี้ถาวร — ยกเลิกไม่ได้`,
      async () => {
        setBusyBlobId(file.blobId);
        try {
          await deleteFile(accountId, file.blobId);
          await refreshFiles();
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          appAlert('ลบไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
        } finally {
          setBusyBlobId(null);
        }
      },
      { confirmText: 'ลบ', cancelText: 'ยกเลิก', destructive: true }
    );
  };

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await saveCustomCategoryName(accountId, categoryId, customName);
      appAlert('บันทึกแล้ว', 'บันทึกชื่อตู้เซฟนี้แล้ว');
    } finally {
      setSavingName(false);
    }
  };

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

  if (!category && !isCustom) {
    // Shouldn't happen from normal navigation, but categoryId is just a
    // route param — guard against a stale/bad one rather than crash.
    return (
      <SafeAreaView style={styles.notFoundSafeArea}>
        <Text style={styles.notFoundText}>ไม่พบตู้เซฟนี้</Text>
        <PrimaryButton label="ย้อนกลับ" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const Icon = category?.icon ?? DocumentIcon;
  // Static categories are numbered by their position in CATEGORIES (1-6);
  // custom slots continue the sequence (7-12) based on their own slot
  // number, e.g. 'custom-1' -> CATEGORIES.length + 1 = 7.
  const categoryIndex = isCustom
    ? CATEGORIES.length + (parseInt(categoryId.replace('custom-', ''), 10) || 1) - 1
    : CATEGORIES.findIndex((c) => c.id === categoryId);

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
              {/* Feedback: match the safe-graphic tile art used on
                  VaultHome's grid, instead of a plain icon badge here. */}
              <View style={styles.heroArt}>
                <SafeGraphic width={90} height={100} color={accentColor} />
                <IconBadge size={56} tint={accentColor}>
                  <Icon size={28} color={colors.textPrimary} />
                </IconBadge>
              </View>
              {isCustom ? (
                // Feedback: safes 7-12 are user-defined topics — let the
                // owner name (and rename) this one right here, instead of
                // a placeholder alert. Also feedback: this box was getting
                // confused for "who can access this safe" (a separate
                // section further down, using tick/radio choices, not
                // typing) — an explicit "ชื่อตู้เซฟนี้" label above the
                // input makes clear it's just this safe's own name.
                <>
                  <Text style={styles.nameFieldLabel}>ชื่อตู้เซฟนี้</Text>
                  <TextInput
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="เช่น รหัสผ่านสำคัญ, สัญญาต่างๆ"
                    placeholderTextColor={colors.textMuted}
                    style={styles.nameInput}
                  />
                  <PrimaryButton
                    variant="secondary"
                    label={savingName ? 'กำลังบันทึก…' : 'บันทึกชื่อ'}
                    onPress={handleSaveName}
                    disabled={savingName || !customName.trim()}
                    style={styles.saveNameButton}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.categoryName, { fontSize: scaled(17) }]}>
                    {category!.nameTh} <Text style={styles.categoryNameEn}>({category!.nameEn})</Text>
                  </Text>
                  <Text style={[styles.categoryDescription, { fontSize: scaled(14) }]}>{category!.description}</Text>
                </>
              )}
            </View>

            <Text style={[styles.sectionLabel, { fontSize: scaled(16) }]}>เนื้อหาในตู้เซฟนี้</Text>
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
                <Text style={styles.whiteboardHint}>ข้อความนี้เข้ารหัสด้วยกุญแจของห้องคุณเองก่อนบันทึก</Text>
                <PrimaryButton
                  variant="secondary"
                  label={savingNote ? 'กำลังบันทึก…' : 'บันทึกข้อความ'}
                  onPress={handleSaveNote}
                  disabled={savingNote}
                  style={styles.saveButton}
                />

                <Text style={[styles.sectionLabel, { marginTop: 0 }]}>ไฟล์แนบ</Text>
                {filesLoading ? (
                  <ActivityIndicator color={colors.textSecondary} style={{ marginBottom: spacing.md }} />
                ) : (
                  files.map((file) => {
                    const busy = busyBlobId === file.blobId;
                    return (
                      <View key={file.blobId} style={styles.fileRow}>
                        <DocumentIcon size={20} color={colors.textSecondary} />
                        <Pressable
                          style={styles.fileInfo}
                          onPress={() => handleOpenFile(file)}
                          disabled={busy}
                          accessibilityRole="button"
                        >
                          <Text style={styles.fileName} numberOfLines={1}>
                            {file.fileName}
                          </Text>
                          <Text style={styles.fileMeta}>{formatFileSize(file.fileSizeBytes)}</Text>
                        </Pressable>
                        {busy ? (
                          <ActivityIndicator color={colors.textSecondary} />
                        ) : (
                          <Pressable
                            onPress={() => handleDeleteFile(file)}
                            accessibilityRole="button"
                            hitSlop={8}
                            style={styles.fileDeleteButton}
                          >
                            <Text style={styles.fileDeleteText}>ลบ</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                )}
                {!filesLoading && files.length === 0 && (
                  <Text style={styles.whiteboardHint}>ยังไม่มีไฟล์แนบในตู้เซฟนี้</Text>
                )}
                <PrimaryButton
                  variant="secondary"
                  label={uploading ? 'กำลังอัปโหลด…' : '+ แนบไฟล์ (Word/PDF/รูปภาพ/ฯลฯ)'}
                  onPress={handleAttachFile}
                  disabled={uploading}
                  style={styles.saveButton}
                />
              </>
            )}

            <Text style={[styles.sectionLabel, { fontSize: scaled(16) }]}>ผู้มีสิทธิ์เข้าถึงตู้เซฟนี้ (เลือก 1 ข้อ)</Text>
            {loading ? null : !guardians || guardians.guardians.length === 0 ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  ยังไม่ได้ตั้งค่าผู้ถือกุญแจสำรอง — ตั้งค่าได้ตอนสร้างห้อง (ขั้นตอน "ตั้งกุญแจสำหรับบุคคลที่คุณไว้ใจ")
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
  heroArt: { width: 90, height: 100, alignItems: 'center', justifyContent: 'center' },
  categoryName: { ...typography.body, fontSize: 17, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  categoryNameEn: { fontWeight: '400', color: colors.textMuted, fontSize: 14 },
  categoryDescription: { ...typography.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  nameFieldLabel: { ...typography.label, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 2 },
  nameInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    textAlign: 'center',
    ...typography.body,
    fontSize: 16,
  },
  saveNameButton: { width: '100%', marginTop: spacing.xs },
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
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  fileInfo: { flex: 1 },
  fileName: { ...typography.body, fontSize: 15, color: colors.textPrimary },
  fileMeta: { ...typography.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  fileDeleteButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  fileDeleteText: { ...typography.body, fontSize: 14, color: colors.dangerText },
});
