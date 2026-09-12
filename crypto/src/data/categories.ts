/**
 * categories.ts — the built-in safes shown on VaultHome, shared between
 * VaultHomeScreen (the grid) and CategoryDetailScreen (each safe's own
 * page). Keyed by a stable `id` so both screens reference the same safe
 * without relying on array position.
 *
 * Feedback: replaced the original 5 categories with 6 life-planning
 * topics (financial status, assets, future goals, precious memories,
 * will/inheritance, end-of-life wishes) — 6 fixed + 6 blank
 * user-defined slots keeps the total at 12 ("ครบโหล").
 *
 * Still mock content — see VaultHomeScreen.tsx's file header for what's
 * real vs. not (no per-category file storage or encryption key exists
 * yet; every safe is a UI grouping over the same single master key).
 */
import type { ComponentType } from 'react';
import { MoneyIcon, AssetIcon, TargetIcon, ImageStackIcon, FeatherIcon, CandleIcon, type IconProps } from '../components/icons';

export interface CategoryRow {
  id: string;
  /** Thai name — primary label per feedback (Thai first, English keyword secondary). */
  nameTh: string;
  nameEn: string;
  /** What this safe is meant to hold — shown as a third line under the name. */
  description: string;
  icon: ComponentType<IconProps>;
}

export const CATEGORIES: CategoryRow[] = [
  {
    id: 'financial',
    nameTh: 'สถานะการเงิน',
    nameEn: 'Financial Status',
    description: 'รายได้ เงินในธนาคาร ลูกหนี้',
    icon: MoneyIcon,
  },
  {
    id: 'assets',
    nameTh: 'สินทรัพย์',
    nameEn: 'Assets',
    description: 'ที่ดิน บ้าน รถ ของมีค่า และทรัพย์สินอื่นๆ',
    icon: AssetIcon,
  },
  {
    id: 'goals',
    nameTh: 'เป้าหมาย',
    nameEn: 'Future Plans',
    description: 'เป้าหมายและแผนในอนาคตของคุณ',
    icon: TargetIcon,
  },
  {
    id: 'memories',
    nameTh: 'ความทรงจำล้ำค่า',
    nameEn: 'Precious Memories',
    description: 'รูปภาพ วิดีโอ ไดอารี่ หรือความทรงจำที่มีความหมายกับคุณ',
    icon: ImageStackIcon,
  },
  {
    id: 'legacy',
    nameTh: 'พินัยกรรม/มรดก',
    nameEn: 'Will / Legacy',
    description: 'สิ่งที่อยากส่งต่อให้คนที่รัก หลังจากคุณจากไป',
    icon: FeatherIcon,
  },
  {
    id: 'livingwill',
    // A space here (Thai has no spaces between words by default) gives
    // the tile grid a guaranteed line-wrap point — without it, some
    // mobile browsers rendered this whole compound word on one line and
    // truncated it ("ตู้ที่ 6 ตัวหนังสืออ่านได้ไม่ครบ เห็นแค่
    // 'ความต้องการ'") instead of wrapping to a second line.
    nameTh: 'ความต้องการ ก่อนตาย',
    nameEn: 'Living Will',
    description: 'ความต้องการของคุณ หากวันหนึ่งคุณตัดสินใจเองไม่ได้',
    icon: CandleIcon,
  },
  // NO "Decoy Chamber" entry here — on purpose. VaultHome is what the
  // REAL PIN unlocks. If the decoy vault showed up as just another row in
  // this list, anyone who coerces the owner into unlocking the real vault
  // would immediately see "there's a decoy" and know to demand the other
  // PIN too — defeating the entire point of having one. The decoy vault
  // is its own completely separate screen, reachable ONLY by entering the
  // Decoy PIN at unlock (not built yet) — never listed inside this one.
];

export function getCategory(id: string): CategoryRow | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
