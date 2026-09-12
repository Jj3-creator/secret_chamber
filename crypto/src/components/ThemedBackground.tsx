/**
 * ThemedBackground — the room's tinted background + a faint repeating dot
 * pattern in the accent color, similar in spirit to LINE's chat wallpaper
 * themes (a single tinted color family with a subtle repeating texture,
 * not a flat, characterless fill). Wrap a screen's content in this
 * instead of setting backgroundColor directly on the container.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  backgroundColor: string;
  accentColor: string;
  children: ReactNode;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ThemedBackground({ backgroundColor, accentColor, children }: Props) {
  const { width, height } = useWindowDimensions();
  const patternId = 'room-bg-pattern';

  return (
    <View style={[styles.fill, { backgroundColor }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id={patternId} patternUnits="userSpaceOnUse" width={64} height={64}>
            <Circle cx={10} cy={12} r={1.4} fill={accentColor} opacity={0.3} />
            <Circle cx={42} cy={38} r={1} fill={accentColor} opacity={0.2} />
            <Circle cx={26} cy={52} r={1.2} fill={accentColor} opacity={0.25} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${patternId})`} />
      </Svg>
      <LinearGradient
        colors={[withAlpha(accentColor, 0.08), 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1 },
});
