/**
 * deviceLock.ts — the on-device PIN unlock record.
 *
 * Feedback: typing the 12-word passphrase every single time you open the
 * app is a lot to ask for daily use. The 12 words stay the one true root
 * key (needed once, at room creation, and again only for account
 * recovery on a new device) — but this file lets a short PIN unlock the
 * SAME room on THIS device day-to-day, without ever re-deriving the key
 * from the passphrase again.
 *
 * How: at SetPin time, the real master key (already derived from the 12
 * words) gets wrapped (AES-256-GCM) under a key derived from the PIN
 * (vault.ts's derivePinKey/wrapVaultKey — the same primitives built for
 * the Decoy PIN feature, just used here for a single real PIN). Only the
 * WRAPPED blob + the PIN's KDF salt are stored here, on-device
 * (AsyncStorage) — never the PIN itself, never the plaintext master key.
 * UnlockScreen re-derives the PIN key from whatever the user types next
 * time and tries to unwrap; wrong PIN just fails to unwrap (never throws
 * in a way that reveals "close" vs "wrong").
 *
 * Single-room-per-device: this stores at most ONE lock record. This app
 * doesn't yet support multiple rooms on one device/browser profile, so
 * setting a new PIN for a new room replaces any previous device lock.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EncryptedPayload, KdfAlgorithm } from './crypto';

export interface DeviceLock {
  accountId: string;
  wrapped: EncryptedPayload;
  /** The PIN's own KDF salt — not secret, needed to re-derive the same PIN key next time. */
  saltHex: string;
  kdf: KdfAlgorithm;
  iterations?: number;
}

const KEY = 'secret-chamber:device-lock';

export async function saveDeviceLock(lock: DeviceLock): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(lock));
}

export async function loadDeviceLock(): Promise<DeviceLock | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceLock;
  } catch {
    return null; // corrupted local value — treat as "no lock" rather than crash
  }
}

export async function clearDeviceLock(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
