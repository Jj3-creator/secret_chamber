/**
 * categoryAccess.ts — which guardians (by index into
 * guardianContacts.ts's list) are authorized to receive THIS specific
 * safe's contents, per safe.
 *
 * Feedback: "ตู้เซฟแต่ละตู้ควรจะมี authorize ในการเข้าไม๊ ว่าทายาทลำดับใด
 * เข้าถึงได้บ้าง". Deliberately local-only and, honestly, not enforced by
 * anything real yet — there is no per-category encryption key (every
 * safe is still just a UI grouping over the same single master key; see
 * VaultHomeScreen.tsx's file header for what's real vs. mock there), so
 * this records the OWNER's intent for which guardians should eventually
 * receive which safe, ready for whenever real per-category keys and a
 * guardian-facing recovery flow exist to actually enforce it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'secret-chamber:category-access:';

function key(accountId: string, categoryId: string): string {
  return `${KEY_PREFIX}${accountId}:${categoryId}`;
}

/** Guardian indices (0-based, into guardianContacts.ts's list) authorized for this category. */
export async function saveCategoryAccess(accountId: string, categoryId: string, guardianIndices: number[]): Promise<void> {
  await AsyncStorage.setItem(key(accountId, categoryId), JSON.stringify(guardianIndices));
}

export async function loadCategoryAccess(accountId: string, categoryId: string): Promise<number[]> {
  const raw = await AsyncStorage.getItem(key(accountId, categoryId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
