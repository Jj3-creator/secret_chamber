// Recover — a REAL "กู้คืนด้วย 12 คำ" flow, reachable from WelcomeScreen's
// recover link and UnlockScreen's "ลืม PIN?" link. Both of those used to
// just show a "coming soon" placeholder — and worse, the only real path
// forward they offered ("start over from the first page") actually meant
// CREATE A NEW ROOM (a fresh 12-word passphrase), not recover the
// existing one. Feedback: "การกู้คืนต้องใช้รหัสกุญแจ 12 คำที่เจนให้ตอน
// แรกเข้า ... ให้เริ่มกู้คืนได้เลย ไม่ควรให้เริ่มใหม่ 12 คำ การเริ่มใหม่
// 12 คำ คือการสร้างห้องใหม่ ไม่ใช่กู้คืน".
//
// How it works: type the same 12 words back in, in order (autocomplete
// against the same wordlist used at creation, same UX as ConfirmScreen's
// 3-word check). Re-deriving the master key from the exact same phrase
// (crypto.ts's deriveMasterKey) recomputes the exact same accountId and
// unlocks the exact same room — this is the whole point of this app's
// design (see crypto.ts's file header). From here the flow re-joins
// normal onboarding at SetPin, so this device gets its own new PIN
// pointing at the recovered room, exactly like a first-time setup would.
//
// Honest limitation: there's no reliable server-side "does this room
// exist" check in this zero-knowledge design (see the note in the UI) —
// a wrong word just derives a different, unrelated (and likely empty)
// account, indistinguishable from "correct words, empty room" without
// looking at whether the safes/data show anything familiar.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { wordlists } from 'bip39';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { ArrowLeftIcon } from '../../components/icons';
import { PrimaryButton } from '../../components/PrimaryButton';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { deriveKeyDeterministic, deriveAccountId, type PassphraseLanguage } from '../../services/crypto';
import { THAI_WORDLIST } from '../../services/wordlists/thai';
import { useOnboarding } from './OnboardingContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Recover'>;

const WORD_COUNT = 12;
const MAX_SUGGESTIONS = 3;

const LANGUAGE_OPTIONS: { value: PassphraseLanguage; label: string }[] = [
  { value: 'th', label: 'ภาษาไทย' },
  { value: 'en', label: 'English' },
];

export function RecoverScreen({ navigation }: Props) {
  const { setMasterKeyHex, setIsRecovering } = useOnboarding();
  const [language, setLanguage] = useState<PassphraseLanguage>('th');
  const [words, setWords] = useState<string[]>(Array(WORD_COUNT).fill(''));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const wordlist = language === 'th' ? THAI_WORDLIST : wordlists.english;

  const suggestions = useMemo(() => {
    if (activeIndex === null) return [];
    const query = words[activeIndex].trim().toLowerCase();
    if (!query) return [];
    return wordlist.filter((w) => w.startsWith(query)).slice(0, MAX_SUGGESTIONS);
  }, [activeIndex, words, wordlist]);

  const setWord = (i: number, value: string) => setWords((prev) => prev.map((w, idx) => (idx === i ? value : w)));

  const allFilled = words.every((w) => w.trim().length > 0);

  const handleRecover = async () => {
    const phrase = words.map((w) => w.trim()).join(' ');
    setBusy(true);
    try {
      // Same deterministic derivation ConfirmScreen used at creation time
      // — must match exactly, or the "same words" would derive a
      // different key. See crypto.ts's DETERMINISTIC_SALT_HEX.
      const { masterKeyHex, kdf } = await deriveKeyDeterministic(phrase);
      const accountId = deriveAccountId(masterKeyHex);
      setMasterKeyHex(masterKeyHex);
      setIsRecovering(true);
      // Re-joins normal onboarding right where a fresh room would be at
      // this point — SetPin (a new PIN for THIS device), then
      // Personalize/DMSSetup are both skippable if this room already has
      // them configured server-side (skipping never overwrites anything).
      navigation.reset({ index: 0, routes: [{ name: 'SetPin', params: { accountId, kdf } }] });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      appAlert('กู้คืนไม่สำเร็จ', `ลองใหม่อีกครั้ง\n\n${reason}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={12}>
            <ArrowLeftIcon size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={{ width: 20 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>กู้คืนด้วยรหัสกุญแจ 12 คำ</Text>
          <Text style={styles.subtitle}>
            พิมพ์รหัสกุญแจ 12 คำที่ระบบสร้างให้ตอนสร้างห้องนี้ครั้งแรก ตามลำดับเดิมทุกคำ — ระบบจะคำนวณกุญแจและเปิดห้องเดิมของคุณ
          </Text>

          <View style={styles.languageRow}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setLanguage(opt.value)}
                  style={[styles.languageChip, active && styles.languageChipActive]}
                >
                  <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.languageHint}>เลือกภาษาที่ใช้ตอนสร้างห้องครั้งแรก</Text>

          <View style={styles.grid}>
            {words.map((word, i) => (
              <View key={i} style={styles.field}>
                <Text style={styles.fieldLabel}>คำที่ {String(i + 1).padStart(2, '0')}</Text>
                <TextInput
                  value={word}
                  onChangeText={(v) => setWord(i, v)}
                  onFocus={() => setActiveIndex(i)}
                  placeholder="…"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                {activeIndex === i && suggestions.length > 0 && (
                  <View style={styles.suggestionRow}>
                    {suggestions.map((s) => (
                      <Pressable key={s} accessibilityRole="button" style={styles.suggestionChip} onPress={() => setWord(i, s)}>
                        <Text style={styles.suggestionText}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>
            ถ้าเปิดห้องแล้วไม่เห็นตู้เซฟหรือข้อมูลที่คุณจำได้ แปลว่าพิมพ์คำหรือลำดับผิดไปจุดใดจุดหนึ่ง — ลองตรวจสอบแล้วพิมพ์ใหม่อีกครั้ง
          </Text>

          <PrimaryButton
            label={busy ? 'กำลังกู้คืน…' : 'กู้คืน'}
            onPress={handleRecover}
            disabled={!allFilled || busy}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.title, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, fontSize: 15, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.lg },
  languageRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  languageChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  languageChipActive: { borderColor: colors.accentTeal, backgroundColor: 'rgba(127,166,177,0.12)' },
  languageChipText: { ...typography.body, fontSize: 15, color: colors.textSecondary },
  languageChipTextActive: { color: colors.textPrimary, fontWeight: '600' },
  languageHint: { ...typography.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.md },
  field: { width: '48%', marginBottom: spacing.md },
  fieldLabel: { ...typography.label, fontSize: 14, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...typography.mono,
    fontSize: 15,
  },
  suggestionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  suggestionChip: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingVertical: 4, paddingHorizontal: spacing.sm },
  suggestionText: { ...typography.body, fontSize: 14, color: colors.textPrimary },
  footnote: { ...typography.body, fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.lg },
});
