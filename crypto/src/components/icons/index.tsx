/**
 * icons/index.tsx — friendlier, filled/duotone-style icons.
 *
 * Feedback: "ปุ่มต่างๆ ควรใช้ icon ที่น่ารักน่าสนใจ สื่อความหมาย" (buttons
 * should use cuter, more interesting, meaningful icons) — the original
 * pass here was deliberately thin single-stroke line art to match a
 * "boring file-storage app" camouflage intent. That's been superseded by
 * several rounds of feedback since (richer background patterns, colored
 * Google-style avatars) all asking for more warmth, so these are
 * redrawn bolder and filled (a soft translucent fill behind a solid
 * outline/detail — "duotone" style) rather than flat stroke outlines.
 * Still monochrome (driven by the `color` prop, same as before) so they
 * still sit correctly inside IconBadge's tinted circles — the
 * personality comes from shape and fill, not added color.
 *
 * All icons: 24x24 viewBox, take `size` and `color` props.
 */
import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const DEFAULT_SIZE = 22;
const DEFAULT_STROKE = 1.8;

function base(props: IconProps) {
  return {
    size: props.size ?? DEFAULT_SIZE,
    color: props.color ?? '#F2F2F0',
    strokeWidth: props.strokeWidth ?? DEFAULT_STROKE,
  };
}

function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** App mark for the Welcome screen — a filled shield with a keyhole. */
export function VaultMarkIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5 4 5.5v5.2c0 5 3.4 8.6 8 10.3 4.6-1.7 8-5.3 8-10.3V5.5L12 2.5Z"
        fill={withAlpha(color, 0.18)}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10.6} r={2.2} fill={color} />
      <Path d="M12 12.8 12 16.2" stroke={color} strokeWidth={strokeWidth + 0.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Personal Memory Vault — a filled photo frame with a little sun + hills. */
export function ImageStackIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={14} height={11} rx={3} fill={withAlpha(color, 0.16)} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={8.6} cy={9.1} r={1.5} fill={color} />
      <Path d="M5 15.8 9.2 11l3 2.8 2.3-2.2L17 15.8Z" fill={color} />
    </Svg>
  );
}

/** Critical Documents — a filled page with a folded corner + a little seal. */
export function DocumentIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        fill={withAlpha(color, 0.16)}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M14 3.5V8h4" fill={withAlpha(color, 0.3)} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Line x1={9} y1={12.4} x2={15} y2={12.4} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={9} y1={15.6} x2={13} y2={15.6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Health & Sensitive Personal — a filled heart with a pulse line cut through it. */
export function HeartPulseIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7.2-4.4-9.6-9.2C.9 7.4 2.6 4 6 4c2 0 3.4 1.1 4 2.4C10.6 5.1 12 4 14 4c3.4 0 5.1 3.4 3.6 6.8C15.2 15.6 12 20 12 20Z"
        fill={withAlpha(color, 0.22)}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M6.5 12h2.2l1.3-2.4 1.6 4 1.2-2.6h3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Ethical Will / Legacy — a filled feather with a small ink drop. */
export function FeatherIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 3c-6 .5-11 5.2-13 11l-1.5 4.5L9 17c5.8-2 10.5-7 11-13Z"
        fill={withAlpha(color, 0.2)}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Line x1={16} y1={6} x2={7} y2={15} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={5.2} cy={18.6} r={1} fill={color} />
    </Svg>
  );
}

/** High-Sensitivity Content — a filled double-locked padlock. */
export function LockIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={10.5} width={14} height={9.5} rx={2.5} fill={withAlpha(color, 0.22)} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={12} cy={14.6} r={1.6} fill={color} />
      <Path d="M12 16.2v1.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Decoy Chamber — stacked layers (a "staged duplicate" of the real thing). */
export function LayersIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 3 8l9 5 9-5-9-5Z" fill={withAlpha(color, 0.22)} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M3 13l9 5 9-5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Settings gear — filled hub, bolder teeth. */
export function GearIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.4} fill={withAlpha(color, 0.3)} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3"
        stroke={color}
        strokeWidth={strokeWidth + 0.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Dashboard — filled bar chart with rounded tops. */
export function ChartIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20V4M4 20h16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={6.3} y={12} width={2.6} height={5} rx={1.2} fill={color} />
      <Rect x={10.7} y={8} width={2.6} height={9} rx={1.2} fill={color} />
      <Rect x={15.1} y={10.5} width={2.6} height={6.5} rx={1.2} fill={color} />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M11 6l-6 6 6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A physical key — filled bow, thin stroke shaft — decorative for the guardian/DMS setup screen. */
export function KeyIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={7} cy={7} r={3.5} fill={withAlpha(color, 0.28)} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M9.5 9.5 19 19M15.5 15.5l2-2M18 18l2-2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Filled check inside a circle — used for a check-in that just succeeded. */
export function CheckCircleIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={withAlpha(color, 0.2)} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M7.5 12.5 10.5 15.5 16.5 9" stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Closed padlock with a shackle — filled body — "lock this room" (exit) action. */
export function LockClosedIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={10.5} width={14} height={9.5} rx={2.5} fill={withAlpha(color, 0.22)} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 14.2v2.6" stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" />
    </Svg>
  );
}
