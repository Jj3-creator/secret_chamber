// Landing screen right after onboarding completes — reached after the
// optional SetPin and DMSSetup steps.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ThemedBackground } from '../../components/ThemedBackground';
import { colors, spacing, typography } from '../../theme/tokens';
import { useRoomTheme } from '../../theme/RoomThemeContext';
import { loadDeviceLock } from '../../services/deviceLock';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Done'>;

export function DoneScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  // Feedback: since the reassurance text now says "the system re-derives
  // 3 words as the key every time" it needs to also explain what the PIN
  // is for, right below it — but SetPinScreen has a skip option, so only
  // show the PIN line when a PIN was actually set for this room.
  const [hasPin, setHasPin] = useState(false);
  const { accentColor, backgroundColor } = useRoomTheme();

  useEffect(() => {
    let cancelled = false;
    loadDeviceLock().then((lock) => {
      if (!cancelled && lock && lock.accountId === accountId) setHasPin(true);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return (
    <ThemedBackground backgroundColor={backgroundColor} accentColor={accentColor}>
    {/* Padding lives on this inner View, not on SafeAreaView itself — on
        web, SafeAreaView applies its own safe-area padding-inline CSS
        that can win the cascade over horizontal padding set directly on
        the same element (observed: paddingHorizontal silently computed
        to 0 when set alongside justifyContent on the SafeAreaView here),
        leaving text flush against the screen edges. Every other screen in
        this flow puts padding + justifyContent on the SafeAreaView itself
        with no problem, so this split is a defensive fix scoped to this
        screen's exact combination rather than a change applied everywhere. */}
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.textBlock} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>สร้างห้องลับของคุณสำเร็จแล้ว</Text>
        <Text style={styles.reassurance}>
          เก็บรหัสกุญแจ 12 คำไว้ให้ดี ระบบจะสุ่ม 3 คำเป็นกุญแจในการเข้าห้องทุกครั้ง
          {hasPin && ' และจำ PIN เพื่อปลดล็อกในขณะที่เข้าๆ ออกๆ ห้องช่วงสั้นๆ'}
        </Text>
      </ScrollView>
      <PrimaryButton
        label="เข้าห้องลับของฉัน (My Secret Chamber)"
        onPress={() => navigation.navigate('VaultHome', { accountId })}
        style={styles.confirmButton}
      />
      </View>
    </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  scrollArea: { flex: 1 },
  textBlock: { flexGrow: 1, justifyContent: 'center' },
  confirmButton: { marginTop: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  reassurance: { ...typography.body, fontSize: 16, color: colors.textSecondary, lineHeight: 21, marginBottom: spacing.xl },
});
