import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

export function Checkbox({ checked, onToggle, label }: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>{checked && <Text style={styles.check}>✓</Text>}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  box: {
    // Feedback: the tick box's border was so thin/low-contrast it was
    // hard to even see there was a box to tap. Bigger, thicker, brighter.
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  check: { fontSize: 17, color: colors.accentText, fontWeight: '700' },
  label: { ...typography.body, color: colors.textSecondary, flex: 1 },
});
