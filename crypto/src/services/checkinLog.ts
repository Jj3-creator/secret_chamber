/**
 * checkinLog.ts — a local, per-device check-in counter + last-checked-in
 * timestamp.
 *
 * Feedback: pressing "เช็คอิน" flashed briefly then the screen looked
 * exactly like before — because the countdown text resets to the SAME
 * starting value every time (e.g. "ครบกำหนดอีก 14 วัน" both before and
 * after a successful check-in at the 14-day period), so nothing visibly
 * changed and it was easy to think the button hadn't done anything. This
 * gives VaultHomeScreen something that visibly increments every time:
 * "เช็คอินครั้งที่ N" + the exact local timestamp of the last check-in.
 *
 * Deliberately local/on-device only, like localProfile.ts — the server
 * already has the real heartbeat timestamp it needs (dms_heartbeat_at);
 * this is purely a "so the human pressing the button can see it worked"
 * counter, not a source of truth for anything security-relevant.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CheckinLog {
  count: number;
  lastCheckinAt: string; // ISO timestamp
}

const KEY_PREFIX = 'secret-chamber:checkins:';

export async function recordCheckin(accountId: string): Promise<CheckinLog> {
  const prev = await loadCheckinLog(accountId);
  const next: CheckinLog = { count: (prev?.count ?? 0) + 1, lastCheckinAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEY_PREFIX + accountId, JSON.stringify(next));
  return next;
}

export async function loadCheckinLog(accountId: string): Promise<CheckinLog | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + accountId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckinLog;
  } catch {
    return null;
  }
}
