// Unlock — shown instead of Welcome when this device already has a room
// set up (see deviceLock.ts + App.tsx's initial-route check). Lets the
// PIN from SetPinScreen open the same room without re-typing the 12
// words. This is the other half of "จำ password แค่ตัวเดียวได้ไม๊" —
// SetPinScreen creates the lock, this screen consumes it.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ThemedBackground } from '../../components/ThemedBackground';
import { appAlert } from '../../components/AppAlert';
import { colors, spacing, typography } from '../../theme/tokens';
import { derivePinKey, unwrapVaultKey } from '../../services/vault';
import { loadDeviceLock, type DeviceLock } from '../../services/deviceLock';
import { loadRoomProfile } from '../../services/localProfile';
import { getAvatarComponent } from '../../components/avatars';
import { useRoomTheme } from '../../theme/RoomThemeContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Unlock'>;

export function UnlockScreen({ navigation }: Props) {
  const [lock, setLock] = useState<DeviceLock | null | undefined>(undefined); // undefined = still loading
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string>('cat');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { accentColor, backgroundColor, setThemeId } = useRoomTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await loadDeviceLock();
      if (cancelled) return;
      setLock(found);
      if (!found) {
        // Shouldn't normally happen — App.tsx only routes here when a lock
        // exists — but if it's ever missing (cleared elsewhere, corrupted),
        // there's nothing to unlock. Fall back to the real start screen.
        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        return;
      }
      const profile = await loadRoomProfile(found.accountId);
      if (cancelled) return;
      if (profile) {
        setNickname(profile.nickname || null);
        setAvatarId(profile.avatarId);
        setThemeId(profile.themeId);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlock = async () => {
    if (!lock) return;
    setError(null);
    setChecking(true);
    try {
      const pinKey = await derivePinKey(pin, lock.saltHex);
      const masterKeyHex = await unwrapVaultKey(lock.wrapped, pinKey.masterKeyHex);
      if (!masterKeyHex) {
        setError('PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง');
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: 'VaultHome', params: { accountId: lock.accountId } }] });
    } catch {
      setError('PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง');
    } finally {
      setChecking(false);
    }
  };

  const handleForgotPin = () => {
    appAlert(
      'ลืม PIN?',
      'การกู้คืนด้วย 12 คำจากเครื่องนี้จะพร้อมใช้งานเร็วๆ นี้ — ระหว่างนี้ต้องใช้ 12 คำเริ่มต้นใหม่จากหน้าแรกของแอป'
    );
  };

  if (lock === undefined) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <ActivityIndicator color={colors.textSecondary} />
      </SafeAreaView>
    );
  }

  const Avatar = getAvatarComponent(avatarId);
  const roomTitle = nickname ? `ห้องลับของ${nickname}` : 'ห้องลับของคุณ';

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.spacerTop} />
          <View style={styles.header}>
            <Avatar size={64} />
            <Text style={styles.title}>{roomTitle}</Text>
            <Text style={styles.subtitle}>ใส่ PIN เพื่อปลดล็อก</Text>
          </View>

          <TextInput
            value={pin}
            onChangeText={(v) => {
              setPin(v);
              setError(null);
            }}
            placeholder="PIN"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton
            label={checking ? 'กำลังตรวจสอบ…' : 'ปลดล็อก'}
            onPress={handleUnlock}
            disabled={checking || pin.length === 0}
          />

          <Pressable onPress={handleForgotPin} accessibilityRole="button" style={styles.forgotLink}>
            <Text style={styles.forgotLinkText}>ลืม PIN?</Text>
          </Pressable>

          <View style={styles.spacerBottom} />
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  loadingSafeArea: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  spacerTop: { flex: 1, minHeight: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  title: { ...typography.title, fontSize: 20, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
  subtitle: { ...typography.body, fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: 4,
    ...typography.mono,
    fontSize: 20,
  },
  error: { ...typography.body, fontSize: 16, color: colors.dangerText, marginBottom: spacing.md, textAlign: 'center' },
  forgotLink: { alignItems: 'center', paddingVertical: spacing.md },
  forgotLinkText: { ...typography.body, fontSize: 15, color: colors.textMuted },
  spacerBottom: { flex: 2, minHeight: spacing.lg },
});
