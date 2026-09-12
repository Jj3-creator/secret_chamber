import React, { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/tokens';

interface Props {
  size?: number;
  tint?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A soft gradient-tinted container for an icon — gives icons some depth
 * (a subtle glow, not a flat placeholder square) without introducing any
 * bright/playful color. Defaults to the design's muted teal accent.
 */
export function IconBadge({ size = 40, tint = colors.accentTeal, style, children }: Props) {
  return (
    <LinearGradient
      colors={[withAlpha(tint, 0.24), withAlpha(tint, 0.05)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, { width: size, height: size, borderRadius: size * 0.28 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
});
