/**
 * icons/index.tsx — minimalist single-stroke line icons.
 *
 * Deliberately plain/utilitarian (not playful or colorful) — matches the
 * design's "should look like a boring file-storage app" camouflage intent.
 * The visual richness this file adds is depth (IconBadge's gradient glow),
 * not personality: no emoji, no filled illustrative icons.
 *
 * All icons: 24x24 viewBox, stroke-based, take `size` and `color` props.
 */
import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const DEFAULT_SIZE = 22;
const DEFAULT_STROKE = 1.6;

function base(props: IconProps) {
  return {
    size: props.size ?? DEFAULT_SIZE,
    color: props.color ?? '#F2F2F0',
    strokeWidth: props.strokeWidth ?? DEFAULT_STROKE,
  };
}

/** App mark for the Welcome screen — a simple vault/shield silhouette. */
export function VaultMarkIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5 4 5.5v5.2c0 5 3.4 8.6 8 10.3 4.6-1.7 8-5.3 8-10.3V5.5L12 2.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={11} r={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 13.4V16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Personal Memory Vault — photos/keepsakes. */
export function ImageStackIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={14} height={11} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={8.5} cy={9.2} r={1.3} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M5 15.5 9 11l3 3 2.5-2.5L17 15" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Critical Documents — a page with folded corner. */
export function DocumentIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M14 3.5V8h4" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Line x1={9} y1={12} x2={15} y2={12} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={9} y1={15.2} x2={15} y2={15.2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Health & Sensitive Personal — heartbeat. */
export function HeartPulseIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7.2-4.4-9.6-9.2C.9 7.4 2.6 4 6 4c2 0 3.4 1.1 4 2.4C10.6 5.1 12 4 14 4c3.4 0 5.1 3.4 3.6 6.8C15.2 15.6 12 20 12 20Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M6.5 12h2.2l1.3-2.4 1.6 4 1.2-2.6h3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Ethical Will / Legacy — a feather (writing a will/letter). */
export function FeatherIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 3c-6 .5-11 5.2-13 11l-1.5 4.5L9 17c5.8-2 10.5-7 11-13Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Line x1={16} y1={6} x2={7} y2={15} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** High-Sensitivity Content — padlock. */
export function LockIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={10.5} width={14} height={9.5} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={12} cy={15} r={1.4} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Decoy Chamber — stacked layers (a "staged duplicate" of the real thing). */
export function LayersIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 3 8l9 5 9-5-9-5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M3 13l9 5 9-5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Settings gear. */
export function GearIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3"
        stroke={color}
        strokeWidth={strokeWidth}
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

export function PlusIcon(props: IconProps) {
  const { size, color, strokeWidth } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
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
