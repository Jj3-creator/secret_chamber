/**
 * categoryNotes.ts — the "text" half of item 13's "white board" request
 * ("พื้นที่ตู้เซฟทุกใบ ควรเป็นเหมือน white board ใส่ได้ทั้ง text และ file").
 *
 * Each safe can hold one free-text note, REAL AES-256-GCM encrypted with
 * the room's actual master key (crypto.ts's encryptData/decryptData) —
 * not a placeholder. The plaintext master key only ever exists in memory
 * via VaultSessionContext (set at PIN-unlock time); this module never
 * sees or stores it beyond the single call it's passed for.
 *
 * File attachments (Word/PDF/PNG/JPEG/HTML/...) are NOT implemented
 * here — that needs a file-picker dependency (e.g. expo-document-picker)
 * this project doesn't have yet, plus wiring to the get-upload-url
 * backend, both larger follow-ups. See CategoryDetailScreen.tsx's file
 * header for the full picture of what's real vs. not yet.
 *
 * Stored locally only (AsyncStorage), keyed by accountId + categoryId —
 * matches every other per-safe/local-only service in this app
 * (categoryAccess.ts, checkinLog.ts, guardianContacts.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptData, decryptData } from './crypto';

interface StoredNote {
  cipherText: string;
  iv: string;
}

const KEY_PREFIX = 'secret-chamber:category-note:';

function key(accountId: string, categoryId: string): string {
  return `${KEY_PREFIX}${accountId}:${categoryId}`;
}

export async function saveCategoryNote(
  accountId: string,
  categoryId: string,
  text: string,
  masterKeyHex: string
): Promise<void> {
  if (!text.trim()) {
    await AsyncStorage.removeItem(key(accountId, categoryId));
    return;
  }
  const payload = await encryptData(text, masterKeyHex);
  const stored: StoredNote = { cipherText: payload.cipherText, iv: payload.iv };
  await AsyncStorage.setItem(key(accountId, categoryId), JSON.stringify(stored));
}

/**
 * Cheap existence check — doesn't need the master key, doesn't decrypt
 * anything. Used by DashboardScreen's "memory status" card to count how
 * many safes have a note saved, without doing 12 real decrypts just to
 * show a count.
 */
export async function hasCategoryNote(accountId: string, categoryId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(key(accountId, categoryId));
  return raw != null;
}

export async function loadCategoryNote(
  accountId: string,
  categoryId: string,
  masterKeyHex: string
): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key(accountId, categoryId));
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredNote;
    return await decryptData(stored.cipherText, stored.iv, masterKeyHex);
  } catch {
    // Wrong/missing key, or corrupted record — treat as no note rather
    // than crash the screen.
    return null;
  }
}
