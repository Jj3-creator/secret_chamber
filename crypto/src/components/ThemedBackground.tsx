/**
 * ThemedBackground — the room's tinted background + a repeating pattern
 * in the accent color, similar in spirit to LINE's chat wallpaper themes
 * (a single tinted color family with a decorative repeating texture, not
 * a flat, characterless fill). Wrap a screen's content in this instead of
 * setting backgroundColor directly on the container.
 *
 * Feedback asked for more visible color/pattern than the first pass (a
 * single faint dot grid) — this now layers three things: a two-shape dot
 * + ring pattern (more visual variety than dots alone), a soft top-down
 * gradient wash, and a large soft corner glow — all still low-opacity and
 * derived from the room's own accent color, so it stays "this room's
 * color" rather than introducing a new, unrelated palette.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect, RadialGradient, Stop } from 'react-native-svg';
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
  const glowId = 'room-bg-glow';

  return (
    <View style={[styles.fill, { backgroundColor }]}>
      <Svg width={width} height={height} style={[StyleSheet.absoluteFillObject, styles.noTouch]}>
        <Defs>
          <Pattern id={patternId} patternUnits="userSpaceOnUse" width={72} height={72}>
            {/* dots */}
            <Circle cx={10} cy={12} r={1.4} fill={accentColor} opacity={0.32} />
            <Circle cx={46} cy={40} r={1} fill={accentColor} opacity={0.22} />
            <Circle cx={28} cy={58} r={1.2} fill={accentColor} opacity={0.28} />
            {/* small open rings, offset from the dots, for a bit more variety than dots alone */}
            <Circle cx={58} cy={14} r={3} fill="none" stroke={accentColor} strokeWidth={1} opacity={0.18} />
            <Circle cx={16} cy={44} r={2.2} fill="none" stroke={accentColor} strokeWidth={1} opacity={0.16} />
          </Pattern>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${patternId})`} />
        {/* soft glow anchored past the top-right corner, larger than the
            viewport so only its fading edge shows — a bit of depth
            without reading as a spotlight. */}
        <Rect
          x={width * 0.25}
          y={-height * 0.35}
          width={width * 1.3}
          height={height * 1.3}
          fill={`url(#${glowId})`}
        />
      </Svg>
      <LinearGradient
        colors={[withAlpha(accentColor, 0.1), 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={[StyleSheet.absoluteFillObject, styles.noTouch]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1 },
  // style.pointerEvents (not the pointerEvents prop, which RN-web warns is
  // deprecated) so these purely-decorative layers never intercept taps
  // meant for the real content rendered after them.
  noTouch: { pointerEvents: 'none' },
});
