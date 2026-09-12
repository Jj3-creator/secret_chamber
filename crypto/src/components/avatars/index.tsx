/**
 * avatars/index.tsx — a small set of animal/flower avatars for
 * personalizing a room (feedback: let the user pick an icon + nickname
 * rather than every room looking identical).
 *
 * Deliberately friendlier than components/icons (which stays plain on
 * purpose, to keep the app's "boring file manager" camouflage) — an
 * avatar is the one place personality is welcome, since it's chosen and
 * seen only after the owner has already unlocked their own real vault.
 */
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export interface AvatarIconProps {
  size?: number;
  color?: string;
}

function base(props: AvatarIconProps) {
  return { size: props.size ?? 28, color: props.color ?? '#F2F2F0' };
}

export function CatAvatar(props: AvatarIconProps) {
  const { size, color } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 9 3 4l4 2.2M19 9l2-5-4 2.2" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={7} stroke={color} strokeWidth={1.6} />
      <Circle cx={9.3} cy={12} r={0.9} fill={color} />
      <Circle cx={14.7} cy={12} r={0.9} fill={color} />
      <Path d="M10.5 15.5c.5.5 2.5.5 3 0" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function OwlAvatar(props: AvatarIconProps) {
  const { size, color } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3c-4.5 0-7 3.3-7 8s2 8.5 7 8.5 7-3.8 7-8.5-2.5-8-7-8Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx={9} cy={11} r={2.2} stroke={color} strokeWidth={1.4} />
      <Circle cx={15} cy={11} r={2.2} stroke={color} strokeWidth={1.4} />
      <Circle cx={9} cy={11} r={0.6} fill={color} />
      <Circle cx={15} cy={11} r={0.6} fill={color} />
      <Path d="M11 14.5l1 1.3 1-1.3" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RabbitAvatar(props: AvatarIconProps) {
  const { size, color } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 8c-1-3-.5-6 1-6s1.6 3.3.9 6M15 8c1-3 .5-6-1-6s-1.6 3.3-.9 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={12} cy={14} r={6.5} stroke={color} strokeWidth={1.6} />
      <Circle cx={9.5} cy={13} r={0.8} fill={color} />
      <Circle cx={14.5} cy={13} r={0.8} fill={color} />
      <Path d="M11 16c.5.4 1.5.4 2 0" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function FlowerAvatar(props: AvatarIconProps) {
  const { size, color } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={7} r={2.6} stroke={color} strokeWidth={1.5} />
      <Circle cx={17} cy={12} r={2.6} stroke={color} strokeWidth={1.5} />
      <Circle cx={12} cy={17} r={2.6} stroke={color} strokeWidth={1.5} />
      <Circle cx={7} cy={12} r={2.6} stroke={color} strokeWidth={1.5} />
      <Circle cx={12} cy={12} r={2.4} fill={color} />
    </Svg>
  );
}

export function TurtleAvatar(props: AvatarIconProps) {
  const { size, color } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 11a6 6 0 0 1 12 0v3a6 3.2 0 0 1-12 0v-3Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M4 12l2 .8M20 12l-2 .8M8 17l-1.5 2M16 17l1.5 2M11 8l1-2 1 2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function FoxAvatar(props: AvatarIconProps) {
  const { size, color } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6 9 10M18 6l-3 4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path
        d="M9 10c-2.5 1-3.5 3.4-2.5 6 1 2.4 3.4 3.5 5.5 3.5s4.5-1.1 5.5-3.5c1-2.6 0-5-2.5-6-1-.4-3-.4-3-.4s-1.9 0-3 .4Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx={10} cy={14} r={0.8} fill={color} />
      <Circle cx={14} cy={14} r={0.8} fill={color} />
      <Path d="M11.3 16.2h1.4l-.7 1Z" fill={color} />
    </Svg>
  );
}

export interface AvatarOption {
  id: string;
  label: string;
  Component: React.ComponentType<AvatarIconProps>;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'cat', label: 'แมว', Component: CatAvatar },
  { id: 'owl', label: 'นกฮูก', Component: OwlAvatar },
  { id: 'rabbit', label: 'กระต่าย', Component: RabbitAvatar },
  { id: 'flower', label: 'ดอกไม้', Component: FlowerAvatar },
  { id: 'turtle', label: 'เต่า', Component: TurtleAvatar },
  { id: 'fox', label: 'จิ้งจอก', Component: FoxAvatar },
];

export function getAvatarComponent(avatarId: string): React.ComponentType<AvatarIconProps> {
  return AVATAR_OPTIONS.find((a) => a.id === avatarId)?.Component ?? CatAvatar;
}
