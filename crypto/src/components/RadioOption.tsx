import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface Props {
  selected: boolean;
  onSelect: () => void;
  label: string;
}

/** A single circular radio button — for a group of mutually-exclusive choices (unlike Checkbox, which is independent per-item). */
export function RadioOption({ selected, onSelect, label }: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={onSelect}
      hitSlop={8}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.circle, selected && styles.circleSelected]}>{selected && <View style={styles.dot} />}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: { borderColor: colors.accent },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  label: { ...typography.body, color: colors.textSecondary, flex: 1 },
});
