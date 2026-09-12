// Personalize — nickname, avatar, and room theme. Not part of the
// original 5-screen "Onboarding / Register" design section; added per
// feedback ("มี element ให้เลือกใส่รูป avatar ... และ theme ห้อง").
// Stored locally only (see localProfile.ts) — never sent to the server.
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { IconBadge } from '../../components/IconBadge';
import { AVATAR_OPTIONS } from '../../components/avatars';
import { ROOM_THEMES } from '../../theme/roomThemes';
import { colors, spacing, typography } from '../../theme/tokens';
import { saveRoomProfile } from '../../services/localProfile';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Personalize'>;

export function PersonalizeScreen({ navigation, route }: Props) {
  const { accountId, kdf } = route.params;
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(AVATAR_OPTIONS[0].id);
  const [themeId, setThemeId] = useState(ROOM_THEMES[0].id);
  const [saving, setSaving] = useState(false);

  const themeColor = ROOM_THEMES.find((t) => t.id === themeId)?.color ?? ROOM_THEMES[0].color;
  const displayName = nickname.trim() || 'คุณ';

  const handleContinue = async () => {
    setSaving(true);
    try {
      await saveRoomProfile(accountId, { nickname: nickname.trim(), avatarId, themeId });
      navigation.navigate('Done', { accountId, kdf });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>ตั้งชื่อและหน้าตาห้องของคุณ</Text>
        <Text style={styles.subtitle}>
          ใช้เพื่อให้จำห้องนี้ได้ง่ายขึ้น — เก็บไว้ในเครื่องคุณเท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์
        </Text>

        <View style={styles.previewCard}>
          <IconBadge size={56} tint={themeColor}>
            {(() => {
              const Avatar = AVATAR_OPTIONS.find((a) => a.id === avatarId)?.Component ?? AVATAR_OPTIONS[0].Component;
              return <Avatar size={28} color={colors.textPrimary} />;
            })()}
          </IconBadge>
          <Text style={styles.previewText}>ห้องลับของ{displayName}</Text>
        </View>

        <Text style={styles.fieldLabel}>ชื่อเล่นของคุณ (ไม่บังคับ)</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="เช่น ป้านิด"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={24}
        />

        <Text style={styles.fieldLabel}>เลือกไอคอนประจำตัว</Text>
        <View style={styles.grid}>
          {AVATAR_OPTIONS.map(({ id, label, Component }) => {
            const active = avatarId === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setAvatarId(id)}
                style={[styles.avatarCell, active && styles.avatarCellActive]}
              >
                <Component size={26} color={colors.textPrimary} />
                <Text style={styles.avatarLabel}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>เลือกโทนสีห้อง</Text>
        <View style={styles.themeRow}>
          {ROOM_THEMES.map((t) => {
            const active = themeId === t.id;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setThemeId(t.id)}
                style={styles.themeSwatchWrapper}
              >
                <View style={[styles.themeSwatch, { backgroundColor: t.color }, active && styles.themeSwatchActive]} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <PrimaryButton label={saving ? 'กำลังบันทึก…' : 'บันทึกและดำเนินต่อ'} onPress={handleContinue} disabled={saving} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...typography.title, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  previewText: { ...typography.body, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  fieldLabel: { ...typography.label, fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
    ...typography.body,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  avatarCell: {
    width: 84,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarCellActive: { borderColor: colors.accentTeal, backgroundColor: 'rgba(127,166,177,0.12)' },
  avatarLabel: { ...typography.body, fontSize: 11, color: colors.textSecondary },
  themeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  themeSwatchWrapper: { padding: 4 },
  themeSwatch: { width: 32, height: 32, borderRadius: 16 },
  themeSwatchActive: { borderWidth: 2, borderColor: colors.textPrimary },
});
