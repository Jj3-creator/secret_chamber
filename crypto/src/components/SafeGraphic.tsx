/**
 * SafeGraphic — a line-art illustration of a safe/vault door with a
 * padlock hanging off it, used as the background artwork for each
 * VaultHome tile.
 *
 * Feedback: "เปลี่ยนรูปกล่องสี่เหลี่ยมธรรมดา ทั้ง 12 รูป เป็น graphic
 * ลายเส้นรูปตู้เซฟที่มีกุญแจคล้อง และมี icon และชื่อตู้" — replace the
 * plain bordered box with a proper safe-door drawing (door panel +
 * combination dial + a hanging padlock), with the category's own icon
 * and name layered on top of it (unchanged from before).
 *
 * Pure line art (stroke only, no fill) so it reads as background
 * texture rather than competing with the icon/name sitting on top of
 * it — tinted with the room's own accent color at low opacity, same as
 * every other themed decoration in the app.
 */
import React from 'react';
import Svg, { Rect, Circle, Path, Line } from 'react-native-svg';

interface Props {
  width: number;
  height: number;
  color: string;
  opacity?: number;
}

export function SafeGraphic({ width, height, color, opacity = 0.5 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 112" style={{ position: 'absolute' }}>
      {/* outer door frame */}
      <Rect x={6} y={14} width={88} height={92} rx={10} stroke={color} strokeWidth={2.2} opacity={opacity} />
      {/* inner door panel */}
      <Rect x={14} y={22} width={72} height={76} rx={7} stroke={color} strokeWidth={1.4} opacity={opacity * 0.7} />
      {/* combination dial */}
      <Circle cx={50} cy={52} r={13} stroke={color} strokeWidth={1.6} opacity={opacity} />
      <Circle cx={50} cy={52} r={2.4} stroke={color} strokeWidth={1.2} opacity={opacity} />
      <Line x1={50} y1={41} x2={50} y2={44.5} stroke={color} strokeWidth={1.4} opacity={opacity} />
      {/* hinges */}
      <Line x1={14} y1={34} x2={9} y2={34} stroke={color} strokeWidth={2} opacity={opacity} />
      <Line x1={14} y1={86} x2={9} y2={86} stroke={color} strokeWidth={2} opacity={opacity} />
      {/* padlock hanging off the top edge, on a small hasp */}
      <Path d="M62 14v-4a6 6 0 0 1 12 0v4" stroke={color} strokeWidth={2} opacity={opacity} fill="none" />
      <Rect x={58} y={13} width={20} height={15} rx={3} stroke={color} strokeWidth={2} opacity={opacity} fill="none" />
      <Circle cx={68} cy={20} r={1.6} fill={color} opacity={opacity} />
    </Svg>
  );
}
