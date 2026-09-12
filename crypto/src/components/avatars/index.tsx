/**
 * avatars/index.tsx — a small set of animal/flower avatars for
 * personalizing a room (feedback: let the user pick an icon + nickname
 * rather than every room looking identical).
 *
 * Redesigned per feedback to look like a Google-account-style avatar:
 * a solid colored circle with a simple flat white glyph on top — NOT
 * copied from Google's actual artwork, just the same "colored circle +
 * simple mark" idea, drawn from scratch as flat filled shapes (not the
 * stroke line-art used in components/icons). Each avatar is now fully
 * self-contained (own circular background baked in), so it no longer
 * needs the external IconBadge gradient wrapper.
 *
 * Deliberately friendlier than components/icons (which stays plain on
 * purpose, to keep the app's "boring file manager" camouflage) — an
 * avatar is the one place personality is welcome, since it's chosen and
 * seen only after the owner has already unlocked their own real vault.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface AvatarIconProps {
  size?: number;
}

interface GlyphProps {
  size: number;
  bg: string;
  glyph: string;
  children: React.ReactNode;
}

function AvatarBadge({ size, bg, children }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={20} fill={bg} />
      {children}
    </Svg>
  );
}

function base(props: AvatarIconProps) {
  return { size: props.size ?? 44 };
}

export function CatAvatar(props: AvatarIconProps) {
  const { size } = base(props);
  return (
    <AvatarBadge size={size} bg="#E08A5B" glyph="cat">
      <Path d="M13 14 10 8l5.5 3.2M27 14l3-6-5.5 3.2" fill="#fff" />
      <Circle cx={20} cy={22} r={9.5} fill="#fff" />
      <Circle cx={16.6} cy={21} r={1.4} fill="#E08A5B" />
      <Circle cx={23.4} cy={21} r={1.4} fill="#E08A5B" />
      <Path d="M17 25.5c1.6 1.3 4.4 1.3 6 0" stroke="#E08A5B" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </AvatarBadge>
  );
}

export function OwlAvatar(props: AvatarIconProps) {
  const { size } = base(props);
  return (
    <AvatarBadge size={size} bg="#6E7FB3" glyph="owl">
      <Path d="M20 9c-6.5 0-10 4.6-10 11s3.2 11 10 11 10-4.6 10-11-3.5-11-10-11Z" fill="#fff" />
      <Circle cx={16} cy={20} r={3.3} fill="#6E7FB3" />
      <Circle cx={24} cy={20} r={3.3} fill="#6E7FB3" />
      <Circle cx={16} cy={20} r={1.1} fill="#fff" />
      <Circle cx={24} cy={20} r={1.1} fill="#fff" />
      <Path d="M18.6 25.5 20 27.3l1.4-1.8Z" fill="#6E7FB3" />
    </AvatarBadge>
  );
}

export function RabbitAvatar(props: AvatarIconProps) {
  const { size } = base(props);
  return (
    <AvatarBadge size={size} bg="#C77DA0" glyph="rabbit">
      <Path d="M15 15c-1.6-4.6-.7-9 1.3-9s2.3 4.6 1.3 9M25 15c1.6-4.6.7-9-1.3-9s-2.3 4.6-1.3 9" fill="#fff" />
      <Circle cx={20} cy={23} r={9.5} fill="#fff" />
      <Circle cx={16.8} cy={22} r={1.3} fill="#C77DA0" />
      <Circle cx={23.2} cy={22} r={1.3} fill="#C77DA0" />
      <Path d="M18 26c1.2.9 2.8.9 4 0" stroke="#C77DA0" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </AvatarBadge>
  );
}

export function FlowerAvatar(props: AvatarIconProps) {
  const { size } = base(props);
  return (
    <AvatarBadge size={size} bg="#5FA8A0" glyph="flower">
      <Circle cx={20} cy={13} r={4.4} fill="#fff" />
      <Circle cx={27} cy={20} r={4.4} fill="#fff" />
      <Circle cx={20} cy={27} r={4.4} fill="#fff" />
      <Circle cx={13} cy={20} r={4.4} fill="#fff" />
      <Circle cx={20} cy={20} r={4} fill="#F4D35E" />
    </AvatarBadge>
  );
}

export function TurtleAvatar(props: AvatarIconProps) {
  const { size } = base(props);
  return (
    <AvatarBadge size={size} bg="#6FA05A" glyph="turtle">
      <Path d="M9 19a11 8.5 0 0 1 22 0v3a11 6 0 0 1-22 0v-3Z" fill="#fff" />
      <Circle cx={20} cy={19.5} r={4.6} fill="#6FA05A" />
      <Path d="M6 19l3 1.3M34 19l-3 1.3M12 27l-2 2.6M28 27l2 2.6" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
    </AvatarBadge>
  );
}

export function FoxAvatar(props: AvatarIconProps) {
  const { size } = base(props);
  return (
    <AvatarBadge size={size} bg="#C6672F" glyph="fox">
      <Path d="M11 11l5 6M29 11l-5 6" fill="#fff" />
      <Path
        d="M16 17c-4 1.6-5.6 5.4-4 9.4C13.6 30.2 17 32 20 32s6.4-1.8 8-5.6c1.6-4 0-7.8-4-9.4-1.6-.6-4.7-.6-4.7-.6s-1.7 0-3.3.6Z"
        fill="#fff"
      />
      <Circle cx={17.2} cy={23} r={1.3} fill="#C6672F" />
      <Circle cx={22.8} cy={23} r={1.3} fill="#C6672F" />
      <Path d="M18.6 26.4h2.8l-1.4 1.8Z" fill="#C6672F" />
    </AvatarBadge>
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
