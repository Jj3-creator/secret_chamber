/**
 * customCategories.ts — user-given names for the 6 blank "แตะเพื่อตั้งชื่อ"
 * slots (safes 7-12). Feedback: "ตู้ที่ 7-12 ยังไม่เปิดให้ใส่ชื่อและ
 * ข้อความ" — these used to just show a placeholder alert; this service
 * is what makes them real, nameable safes like the other 6.
 *
 * Local-only (AsyncStorage), keyed by accountId + slotId — matches every
 * other per-account/per-category local service in this app (categoryAccess.ts,
 * categoryNotes.ts). Slot ids are 'custom-1'..'custom-6', matching the 6
 * blank grid slots after the real categories in VaultHomeScreen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'secret-chamber:custom-category:';

function key(accountId: string, slotId: string): string {
  return `${KEY_PREFIX}${accountId}:${slotId}`;
}

export async function saveCustomCategoryName(accountId: string, slotId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(key(accountId, slotId));
    return;
  }
  await AsyncStorage.setItem(key(accountId, slotId), trimmed);
}

export async function loadCustomCategoryName(accountId: string, slotId: string): Promise<string | null> {
  return AsyncStorage.getItem(key(accountId, slotId));
}

/** Loads all 6 custom slot names at once — used by VaultHomeScreen's grid. */
export async function loadAllCustomCategoryNames(
  accountId: string,
  slotIds: string[]
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    slotIds.map(async (id) => [id, await loadCustomCategoryName(accountId, id)] as const)
  );
  return Object.fromEntries(entries);
}
