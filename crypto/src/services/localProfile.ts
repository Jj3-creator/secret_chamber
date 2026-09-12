/**
 * localProfile.ts — nickname/avatar/theme, stored ON-DEVICE ONLY.
 *
 * Deliberately never sent to the server: this app's zero-knowledge design
 * collects no PII, and a nickname is exactly the kind of identifying
 * detail that has no business leaving the device. Keyed by account_id so
 * re-entering the same room later (once real login exists) restores it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RoomProfile {
  nickname: string;
  avatarId: string;
  themeId: string;
  /** Optional — added after themeId; older saved profiles simply won't have it. See FontScaleContext.tsx. */
  fontScaleId?: string;
}

const KEY_PREFIX = 'secret-chamber:profile:';

export async function saveRoomProfile(accountId: string, profile: RoomProfile): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + accountId, JSON.stringify(profile));
}

export async function loadRoomProfile(accountId: string): Promise<RoomProfile | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + accountId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomProfile;
  } catch {
    return null; // corrupted local value — treat as "no profile" rather than crash
  }
}
