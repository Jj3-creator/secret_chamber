// Settings — reachable from VaultHome's sun icon.
// Feedback: "icon พระอาทิตย์ ... setting, ควรเข้าถึงได้เลย เช่น font,
// theme, notify due date" — this used to be a placeholder alert
// ("หน้าตั้งค่าจะพร้อมใช้งานเร็วๆ นี้"); now a real settings page.
//
// Later feedback: "ปุ่ม setting ให้เพิ่มการตั้งผู้รับกุญแจสำรอง เงื่อนไข
// การเปิดห้อง กำหนดดิวเดท ... การเปลี่ยน pin และข้อมูลที่อยู่หน้าตอน
// entry ครั้งแรก ... ให้มาปรากฎ/เปลี่ยนค่าได้จากปุ่ม setting นี้รวมถึง
// การเปลี่ยนชื่อห้อง" — everything that used to be one-time-only at
// onboarding should be reachable/editable here too. This screen now
// covers: theme, font size, room name (nickname), PIN, and guardians/
// check-in period (via reusing DMSSetupScreen in "reconfigure" mode) —
// no backend changes needed for any of it (dms-setup already does
// replace-all semantics; PIN is 100% local/client-side).
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
// Change PIN: fully real — derives a new PIN key (vault.ts's
// derivePinKey), re-wraps the SAME real master key (already in memory via
// VaultSessionContext, since the room is unlocked to even be here) under
// it, and overwrites the on-device lock. Never touches the server; the
// master key itself never changes.
//
// Guardians/check-in period: navigates into DMSSetupScreen's own
// "reconfigure" mode (see that file) rather than duplicating its form
// here.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ArrowLeftIcon } from '../../components/icons';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ThemedBackground } from '../../components/ThemedBackground';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { ROOM_THEMES } from '../../theme/roomThemes';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { FONT_SCALE_OPTIONS, useFontScale } from '../../theme/FontScaleContext';
import { loadRoomProfile, saveRoomProfile } from '../../services/localProfile';
import { getAccountStatus } from '../../services/backend';
import { derivePinKey, wrapVaultKey } from '../../services/vault';
import { saveDeviceLock } from '../../services/deviceLock';
import { useVaultSession } from './VaultSessionContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Settings'>;

const MIN_PIN_LENGTH = 4;

function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function SettingsScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const { themeId, accentColor, backgroundColor, setThemeId } = useRoomTheme();
  const { fontScaleId, setFontScaleId, scaled } = useFontScale();
  const { masterKeyHex } = useVaultSession();
  const [notifyDueAt, setNotifyDueAt] = useState<string | null>(null);
  const [loadingNotify, setLoadingNotify] = useState(true);

  const [nickname, setNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

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
    loadRoomProfile(accountId).then((profile) => {
      if (!cancelled && profile?.nickname) setNickname(profile.nickname);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const persist = async (patch: Partial<{ themeId: string; fontScaleId: string; nickname: string }>) => {
    const existing = await loadRoomProfile(accountId);
    await saveRoomProfile(accountId, {
      nickname: patch.nickname ?? existing?.nickname ?? '',
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

  const handleSaveNickname = async () => {
    setSavingNickname(true);
    try {
      await persist({ nickname: nickname.trim() });
      appAlert('บันทึกแล้ว', 'เปลี่ยนชื่อห้องแล้ว');
    } finally {
      setSavingNickname(false);
    }
  };

  const handleChangePin = async () => {
    if (!masterKeyHex) {
      appAlert('ผิดพลาด', 'ต้องปลดล็อกห้องด้วย PIN เดิมก่อน ถึงจะเปลี่ยน PIN ได้');
      return;
    }
    if (newPin.length < MIN_PIN_LENGTH) {
      appAlert('สั้นเกินไป', `PIN ต้องมีอย่างน้อย ${MIN_PIN_LENGTH} ตัวอักษร`);
      return;
    }
    if (newPin !== confirmPin) {
      appAlert('ไม่ตรงกัน', 'PIN ทั้งสองช่องต้องเหมือนกัน');
      return;
    }
    setSavingPin(true);
    try {
      const pinKey = await derivePinKey(newPin);
      const wrapped = await wrapVaultKey(masterKeyHex, pinKey.masterKeyHex);
      await saveDeviceLock({
        accountId,
        wrapped,
        saltHex: pinKey.saltHex,
        kdf: pinKey.kdf,
        iterations: pinKey.iterations,
      });
      setNewPin('');
      setConfirmPin('');
      appAlert('บันทึกแล้ว', 'เปลี่ยน PIN แล้ว — ใช้ PIN ใหม่ปลดล็อกครั้งถัดไป');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      appAlert('เปลี่ยน PIN ไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
    } finally {
      setSavingPin(false);
    }
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

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>ชื่อห้อง</Text>
            <View style={styles.rowInline}>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="เช่น ป้านิด"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.inputFlex]}
                maxLength={24}
              />
              <PrimaryButton
                variant="secondary"
                label={savingNickname ? '...' : 'บันทึก'}
                onPress={handleSaveNickname}
                disabled={savingNickname}
                style={styles.inlineButton}
              />
            </View>

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

            <Text style={styles.sectionLabel}>เปลี่ยน PIN ปลดล็อก</Text>
            <TextInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder={`PIN ใหม่ (อย่างน้อย ${MIN_PIN_LENGTH} ตัว)`}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              keyboardType="number-pad"
              style={[styles.input, styles.inputMarginBottom]}
            />
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="พิมพ์ PIN ใหม่อีกครั้ง"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              keyboardType="number-pad"
              style={[styles.input, styles.inputMarginBottom]}
            />
            <PrimaryButton
              variant="secondary"
              label={savingPin ? 'กำลังบันทึก…' : 'เปลี่ยน PIN'}
              onPress={handleChangePin}
              disabled={savingPin || newPin.length === 0}
              style={styles.saveButton}
            />

            <Text style={styles.sectionLabel}>ผู้ถือกุญแจสำรอง / กรอบเวลาเปิดสิทธิ์</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {loadingNotify
                  ? 'กำลังโหลด…'
                  : notifyDueAt
                    ? `วันที่รหัสกุญแจสำรองเริ่มใช้งานได้: ${formatThaiDate(notifyDueAt)} — ถ้าคุณไม่เข้าห้องนี้เลยก่อนวันนี้ (วันที่ระบบแจ้งเตือนอัตโนมัติแก่รายชื่อผู้ถือกุญแจสำรอง — ฟีเจอร์นี้ยังไม่เปิดใช้งาน)`
                    : 'ยังไม่ได้ตั้งค่ากุญแจไขความลับสำหรับทายาท'}
              </Text>
            </View>
            <PrimaryButton
              variant="secondary"
              label="แก้ไขผู้ถือกุญแจสำรอง / กรอบเวลา"
              onPress={() => navigation.navigate('DMSSetup', { accountId, mode: 'reconfigure' })}
              style={styles.saveButton}
            />
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
  rowInline: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  inlineButton: { paddingHorizontal: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  inputFlex: { flex: 1 },
  inputMarginBottom: { marginBottom: spacing.sm },
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
  saveButton: { marginTop: spacing.sm, marginBottom: spacing.lg },
  infoBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
  infoText: { ...typography.body, fontSize: 15, color: colors.textSecondary, lineHeight: 20 },
});
