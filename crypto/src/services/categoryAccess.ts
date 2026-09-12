/**
 * categoryAccess.ts — who is authorized to eventually receive THIS
 * specific safe's contents, per safe.
 *
 * Feedback: expanded from a plain "check any number of guardians" list
 * to 5 mutually-exclusive choices per safe:
 * - 'unspecified' — no one particular guardian singled out; if/when
 *   recovery ever happens, whoever combines a valid share can see it.
 * - a specific guardian index (0-based, into guardianContacts.ts's
 *   list) — only that one heir is meant to receive this safe.
 * - 'secret' — the owner deliberately doesn't want to say, even to
 *   themselves in writing (kept as a private note more than a real
 *   access control).
 *
 * Deliberately local-only, and honestly not enforced by anything real
 * yet — there is no per-category encryption key (every safe is still a
 * UI grouping over the same single master key; see VaultHomeScreen.tsx's
 * file header for what's real vs. mock there), so this records the
 * owner's intent for later, ready for whenever real per-category keys
 * and a guardian-facing recovery flow exist to actually enforce it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CategoryAccess = { type: 'unspecified' } | { type: 'guardian'; index: number } | { type: 'secret' };

const KEY_PREFIX = 'secret-chamber:category-access:';

function key(accountId: string, categoryId: string): string {
  return `${KEY_PREFIX}${accountId}:${categoryId}`;
}

export async function saveCategoryAccess(accountId: string, categoryId: string, access: CategoryAccess): Promise<void> {
  await AsyncStorage.setItem(key(accountId, categoryId), JSON.stringify(access));
}

export async function loadCategoryAccess(accountId: string, categoryId: string): Promise<CategoryAccess> {
  const raw = await AsyncStorage.getItem(key(accountId, categoryId));
  if (!raw) return { type: 'unspecified' };
  try {
    return JSON.parse(raw) as CategoryAccess;
  } catch {
    return { type: 'unspecified' };
  }
}
