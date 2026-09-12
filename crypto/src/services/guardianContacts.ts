/**
 * guardianContacts.ts — the room owner's own local record of who their
 * guardians (ผู้ถือกุญแจสำรอง) are.
 *
 * Feedback: the owner should NOT tell guardians the secret token in
 * advance ("ไม่ควรแจ้ง code ลับก่อนที่จะหายไป") — that part is unchanged
 * (DMSSetupScreen still just hands the owner a token per guardian to
 * pass along out-of-band, on their own, whenever they choose). What
 * IS new: a place to record each guardian's name + how to reach them
 * (phone/LINE), purely for the owner's own reference — e.g. to remember
 * who's who later, or to actually contact them when the owner decides
 * it's time. Also records the recovery threshold chosen at setup time
 * (how many guardians must agree), so other screens (e.g. picking which
 * guardians can access a given safe) know who exists without re-deriving
 * anything from the passphrase.
 *
 * Deliberately local-only, like localProfile.ts — emails/LINE IDs are
 * exactly the kind of PII this app's zero-knowledge design never sends
 * to the server. The dms-setup Edge Function never sees this data — it
 * only ever receives the wrapped share + token hash, unchanged.
 *
 * Feedback: phone numbers were dropped in favor of email/LINE — a real
 * phone-network connection (SMS/calls) usually costs money and needs a
 * paid provider, while email and LINE both have free-tier APIs, so
 * they're the more realistic path to an eventual real notify feature.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GuardianContact {
  name: string;
  email?: string;
  lineId?: string;
}

export interface GuardianSetupRecord {
  guardians: GuardianContact[];
  /** How many of `guardians.length` must agree to recover — chosen by the owner at setup time. */
  threshold: number;
}

const KEY_PREFIX = 'secret-chamber:guardians:';

export async function saveGuardianContacts(accountId: string, record: GuardianSetupRecord): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + accountId, JSON.stringify(record));
}

export async function loadGuardianContacts(accountId: string): Promise<GuardianSetupRecord | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + accountId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuardianSetupRecord;
  } catch {
    return null;
  }
}
