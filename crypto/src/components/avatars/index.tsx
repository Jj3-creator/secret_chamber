/**
 * avatars/index.tsx — animal avatars for personalizing a room.
 *
 * Redesigned per design_handoff_secret_chamber/README.md §5.7/5.9: the
 * exact 6-animal set (dog/cat/rabbit/turtle/tiger/lion — replacing the
 * earlier cat/owl/rabbit/flower/turtle/fox set) and SVG paths, ported
 * from the handoff's own prototype source
 * (`Secret Chamber App.dc.html`'s `ANIMALS` map) rather than re-drawn
 * from scratch, so the shapes match the approved design exactly.
 *
 * Visual treatment also changed to match: a single-color line glyph on a
 * transparent background (no filled circle backdrop) — `color` picks
 * accent when selected, a muted gray when not (see AVATAR_SELECTED_COLOR/
 * AVATAR_UNSELECTED_COLOR below and the handoff's own selection-state
 * rule). The selection ring/border itself is drawn by whichever screen
 * renders the picker grid or the header badge, not baked in here, since
 * those two call sites want different ring treatments (header ring vs.
 * picker border) — this component only ever draws the animal shape.
 */
import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { colors } from '../../theme/tokens';

export interface AvatarIconProps {
  size?: number;
  /** Glyph color — defaults to the handoff's "selected" accent shade. Pass AVATAR_UNSELECTED_COLOR for an unselected picker option. */
  color?: string;
}

/** Dark facial-detail color (eyes/nose/mouth) — fixed regardless of selection state, per the handoff source. */
const DK = '#15130F';
export const AVATAR_SELECTED_COLOR = colors.accent;
export const AVATAR_UNSELECTED_COLOR = colors.textSecondary;

function base(props: AvatarIconProps) {
  return { size: props.size ?? 44, color: props.color ?? AVATAR_SELECTED_COLOR };
}

export function DogAvatar(props: AvatarIconProps) {
  const { size, color: c } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Ellipse cx={7.2} cy={17} rx={3.5} ry={6.8} fill={c} />
      <Ellipse cx={24.8} cy={17} rx={3.5} ry={6.8} fill={c} />
      <Ellipse cx={16} cy={18} rx={9} ry={8.3} fill={c} />
      <Circle cx={12.6} cy={16.4} r={1.5} fill={DK} />
      <Circle cx={19.4} cy={16.4} r={1.5} fill={DK} />
      <Ellipse cx={16} cy={20.6} rx={2.2} ry={1.7} fill={DK} />
      <Path d="M16 22.4v1.6" stroke={DK} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

export function CatAvatar(props: AvatarIconProps) {
  const { size, color: c } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path d="M8.6 12.8 7.2 4.6l7.3 4.4Z" fill={c} />
      <Path d="M23.4 12.8 24.8 4.6l-7.3 4.4Z" fill={c} />
      <Circle cx={16} cy={18} r={8.6} fill={c} />
      <Circle cx={12.7} cy={16.6} r={1.5} fill={DK} />
      <Circle cx={19.3} cy={16.6} r={1.5} fill={DK} />
      <Path d="M14.5 20h3L16 21.7Z" fill={DK} />
      <Path
        d="M6.2 18.4h3.1M6.6 21.3l3-.9M25.8 18.4h-3.1M25.4 21.3l-3-.9"
        stroke={DK}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  );
}

export function RabbitAvatar(props: AvatarIconProps) {
  const { size, color: c } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Ellipse cx={11.7} cy={9.2} rx={2.9} ry={7.6} fill={c} />
      <Ellipse cx={20.3} cy={9.2} rx={2.9} ry={7.6} fill={c} />
      <Ellipse cx={16} cy={20.6} rx={7.9} ry={7.3} fill={c} />
      <Circle cx={12.9} cy={19.4} r={1.45} fill={DK} />
      <Circle cx={19.1} cy={19.4} r={1.45} fill={DK} />
      <Path d="M14.7 22.2h2.6L16 23.8Z" fill={DK} />
    </Svg>
  );
}

export function TurtleAvatar(props: AvatarIconProps) {
  const { size, color: c } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Ellipse cx={16} cy={8.6} rx={3.8} ry={3.5} fill={c} />
      <Circle cx={14.5} cy={8.1} r={1} fill={DK} />
      <Circle cx={17.5} cy={8.1} r={1} fill={DK} />
      <Ellipse cx={7.4} cy={16.6} rx={2.8} ry={2.3} fill={c} />
      <Ellipse cx={24.6} cy={16.6} rx={2.8} ry={2.3} fill={c} />
      <Ellipse cx={10} cy={25.6} rx={2.5} ry={2.1} fill={c} />
      <Ellipse cx={22} cy={25.6} rx={2.5} ry={2.1} fill={c} />
      <Circle cx={16} cy={19} r={9} fill={c} />
      <Path
        d="M16 12.4 21 15.6v6L16 24.8l-5-3.2v-6Z"
        fill="none"
        stroke={DK}
        strokeWidth={1.4}
        opacity={0.55}
      />
    </Svg>
  );
}

export function TigerAvatar(props: AvatarIconProps) {
  const { size, color: c } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={8.6} cy={10.6} r={3.4} fill={c} />
      <Circle cx={23.4} cy={10.6} r={3.4} fill={c} />
      <Circle cx={16} cy={17.8} r={8.7} fill={c} />
      <Path
        d="M16 9.6v3.2M12.2 10.6l1.2 2.8M19.8 10.6l-1.2 2.8"
        stroke={DK}
        strokeWidth={1.7}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M8 16.6h2.3M8 19.8h2.3M24 16.6h-2.3M24 19.8h-2.3"
        stroke={DK}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.55}
      />
      <Circle cx={13} cy={17.2} r={1.5} fill={DK} />
      <Circle cx={19} cy={17.2} r={1.5} fill={DK} />
      <Path d="M14.4 20.2h3.2L16 22Z" fill={DK} />
    </Svg>
  );
}

export function LionAvatar(props: AvatarIconProps) {
  const { size, color: c } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16.0} cy={7.4} r={3.5} fill={c} />
      <Circle cx={21.2} cy={8.9} r={3.5} fill={c} />
      <Circle cx={24.7} cy={13.0} r={3.5} fill={c} />
      <Circle cx={25.5} cy={18.4} r={3.5} fill={c} />
      <Circle cx={23.3} cy={23.3} r={3.5} fill={c} />
      <Circle cx={18.7} cy={26.2} r={3.5} fill={c} />
      <Circle cx={13.3} cy={26.2} r={3.5} fill={c} />
      <Circle cx={8.7} cy={23.3} r={3.5} fill={c} />
      <Circle cx={6.5} cy={18.4} r={3.5} fill={c} />
      <Circle cx={7.3} cy={13.0} r={3.5} fill={c} />
      <Circle cx={10.8} cy={8.9} r={3.5} fill={c} />
      <Circle cx={16} cy={17} r={7.6} fill={c} />
      <Circle cx={16} cy={17} r={7.6} fill="none" stroke={DK} strokeWidth={1.1} opacity={0.35} />
      <Circle cx={13.1} cy={15.8} r={1.5} fill={DK} />
      <Circle cx={18.9} cy={15.8} r={1.5} fill={DK} />
      <Path d="M14.3 19h3.4L16 20.9Z" fill={DK} />
      <Path d="M16 20.9v1.4" stroke={DK} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

export interface AvatarOption {
  id: string;
  label: string;
  Component: React.ComponentType<AvatarIconProps>;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'dog', label: 'หมา', Component: DogAvatar },
  { id: 'cat', label: 'แมว', Component: CatAvatar },
  { id: 'rabbit', label: 'กระต่าย', Component: RabbitAvatar },
  { id: 'turtle', label: 'เต่า', Component: TurtleAvatar },
  { id: 'tiger', label: 'เสือ', Component: TigerAvatar },
  { id: 'lion', label: 'สิงโต', Component: LionAvatar },
];

export function getAvatarComponent(avatarId: string): React.ComponentType<AvatarIconProps> {
  return AVATAR_OPTIONS.find((a) => a.id === avatarId)?.Component ?? DogAvatar;
}
