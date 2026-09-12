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
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  check: { fontSize: 13, color: colors.accentText, fontWeight: '700' },
  label: { ...typography.body, color: colors.textSecondary, flex: 1 },
});
