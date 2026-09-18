/**
 * AppAlert — a real, on-screen alert/confirm dialog to replace React
 * Native's own Alert.alert().
 *
 * BUG FOUND: RN's Alert module has no working implementation on web in
 * this project's setup — Alert.alert(title, message) runs without
 * throwing, but renders literally nothing (verified: no dialog element
 * ever appears in the DOM after calling it). Every "this button doesn't
 * seem to do anything" report so far that turned out to be a validation
 * message, an error, a confirmation, or an intentional "not built yet"
 * placeholder was this bug — the onPress handler WAS running, its only
 * user-visible feedback was just silently swallowed on web.
 *
 * Usage is deliberately a near drop-in for Alert.alert: `appAlert(title,
 * message)` for a single-button dismiss, `appConfirm(title, message,
 * onConfirm)` for a two-button confirm/cancel. Mount <AppAlertHost />
 * exactly once, near the root (App.tsx) — it registers itself as the
 * thing every call talks to, the same way RN's real Alert.alert works
 * under the hood, so call sites don't need a hook or provider wiring at
 * every screen.
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'destructive' | 'cancel';
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let showFn: ((state: AlertState) => void) | null = null;

export function appAlert(title: string, message?: string): void {
  show({ title, message, buttons: [{ text: 'ตกลง' }] });
}

/** Two-button confirm — onConfirm runs only if the user picks the confirm button, never the cancel one. */
export function appConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
): void {
  show({
    title,
    message,
    buttons: [
      { text: options?.cancelText ?? 'ยกเลิก', style: 'cancel' },
      { text: options?.confirmText ?? 'ยืนยัน', onPress: onConfirm, style: options?.destructive ? 'destructive' : 'default' },
    ],
  });
}

/**
 * A generic multi-button action sheet — for choices beyond the built-in
 * alert (1 button) / confirm (2 buttons) shapes, e.g. "เปิด / บันทึก /
 * ทั้งสองอย่าง" when tapping a saved file (see categoryFiles.ts).
 */
export function appChoice(
  title: string,
  message: string,
  buttons: Array<{ text: string; onPress: () => void; style?: 'default' | 'destructive' | 'cancel' }>
): void {
  show({ title, message, buttons: [...buttons, { text: 'ยกเลิก', style: 'cancel', onPress: () => {} }] });
}

function show(state: AlertState) {
  if (showFn) {
    showFn(state);
  } else if (__DEV__) {
    // Host not mounted yet (shouldn't happen once App.tsx renders it) —
    // fail loudly in dev rather than silently, exactly the failure mode
    // this file exists to eliminate.
    console.warn('appAlert/appConfirm called before AppAlertHost mounted:', state.title, state.message);
  }
}

export function AppAlertHost() {
  const [state, setState] = useState<AlertState | null>(null);

  useEffect(() => {
    showFn = setState;
    return () => {
      showFn = null;
    };
  }, []);

  const close = () => setState(null);

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{state?.title}</Text>
          {!!state?.message && <Text style={styles.message}>{state.message}</Text>}
          <View style={styles.buttonRow}>
            {state?.buttons.map((btn, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  close();
                  btn.onPress?.();
                }}
                accessibilityRole="button"
                style={styles.button}
              >
                <Text
                  style={[
                    styles.buttonText,
                    btn.style === 'cancel' && styles.buttonTextCancel,
                    btn.style === 'destructive' && styles.buttonTextDestructive,
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
  },
  title: { ...typography.title, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm },
  message: { ...typography.body, fontSize: 15, color: colors.textSecondary, lineHeight: 21, marginBottom: spacing.lg },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  button: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  buttonText: { ...typography.label, color: colors.accentTeal, fontSize: 16 },
  buttonTextCancel: { color: colors.textMuted },
  buttonTextDestructive: { color: colors.dangerText },
});
