/**
 * categories.ts — the 5 built-in safes shown on VaultHome, shared between
 * VaultHomeScreen (the grid) and CategoryDetailScreen (each safe's own
 * page). Moved out of VaultHomeScreen so both can import the same list
 * by stable `id` instead of by array position.
 *
 * Still mock content — see VaultHomeScreen.tsx's file header for what's
 * real vs. not (no per-category file storage or encryption key exists
 * yet; every safe is a UI grouping over the same single master key).
 */
import type { ComponentType } from 'react';
import { ImageStackIcon, DocumentIcon, HeartPulseIcon, FeatherIcon, LockIcon, type IconProps } from '../components/icons';

export interface CategoryRow {
  id: string;
  /** Thai name — primary label per feedback (Thai first, English keyword secondary). */
  nameTh: string;
  nameEn: string;
  /** What this safe is meant to hold — shown as a third line under the name. */
  description: string;
  caption: string;
  icon: ComponentType<IconProps>;
}

export const CATEGORIES: CategoryRow[] = [
  {
    id: 'memories',
    nameTh: 'ความทรงจำส่วนตัว',
    nameEn: 'Personal Memory Vault',
    description: 'รูปภาพ วิดีโอ ไดอารี่ หรือความทรงจำที่มีความหมายกับคุณ',
    caption: '18 ไฟล์ · 14.8 MB',
    icon: ImageStackIcon,
  },
  {
    id: 'documents',
    nameTh: 'เอกสารสำคัญ',
    nameEn: 'Critical Documents',
    description: 'พาสปอร์ต สัญญา โฉนดที่ดิน เอกสารราชการ',
    caption: '9 ไฟล์ · 11.2 MB',
    icon: DocumentIcon,
  },
  {
    id: 'health',
    nameTh: 'สุขภาพและเรื่องอ่อนไหว',
    nameEn: 'Health & Sensitive Personal',
    description: 'ผลตรวจสุขภาพ ประวัติการรักษา ข้อมูลส่วนตัวที่ละเอียดอ่อน',
    caption: '6 ไฟล์ · 4.1 MB',
    icon: HeartPulseIcon,
  },
  {
    id: 'legacy',
    nameTh: 'พินัยกรรม/มรดกข้อมูล',
    nameEn: 'Ethical Will / Legacy',
    description: 'สิ่งที่อยากส่งต่อให้คนที่รัก หลังจากคุณจากไป',
    caption: '3 ไฟล์ · 1.9 MB · ผูกกับ DMS',
    icon: FeatherIcon,
  },
  {
    id: 'sensitive',
    nameTh: 'เนื้อหาความอ่อนไหวสูง',
    nameEn: 'High-Sensitivity Content',
    description: 'ต้องใส่ PIN ซ้ำอีกชั้นก่อนเข้าดู',
    caption: 'ล็อกซ้อน · ต้องใส่ PIN อีกครั้ง',
    icon: LockIcon,
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
