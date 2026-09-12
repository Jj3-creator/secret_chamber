import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { ArrowLeftIcon } from './icons';

interface Props {
  step: number;
  totalSteps: number;
  onBack?: () => void;
}

export function ScreenHeader({ step, totalSteps, onBack }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        disabled={!onBack}
        style={[styles.backButton, !onBack && styles.hidden]}
        accessibilityRole="button"
        accessibilityLabel="ย้อนกลับ"
      >
        <ArrowLeftIcon size={20} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.progress}>
        {step} / {totalSteps}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  backButton: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  hidden: { opacity: 0 },
  progress: { ...typography.label, color: colors.textMuted },
});
