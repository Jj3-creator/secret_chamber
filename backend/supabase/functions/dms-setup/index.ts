// Secret Chamber — dms-setup Edge Function
// ===========================================
// Registers (or replaces) an account's Dead Man's Switch: the threshold
// hours of silence before guardians become eligible, plus each guardian's
// AES-256-GCM-wrapped Shamir share. The server only ever stores ciphertext
// — each share is wrapped client-side under a key derived from that
// specific guardian's own passphrase/PIN before this function ever sees it.
// See supabase/migrations/0002_dms_heartbeat.sql for the full threat model.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS_HEADERS, json, ACCOUNT_ID_RE, HEX64_RE } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MIN_GUARDIANS = 2;
const MAX_GUARDIANS = 255;
const MIN_THRESHOLD_HOURS = 1;
const MAX_THRESHOLD_HOURS = 24 * 365; // 1 year sanity cap

interface GuardianInput {
  share_index: number;
  token_hash: string;
  wrapped: { cipherText: string; iv: string };
}

function parseGuardian(raw: unknown): GuardianInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const g = raw as Record<string, unknown>;
  const shareIndex = g.share_index;
  const tokenHash = g.token_hash;
  const wrapped = g.wrapped as Record<string, unknown> | null | undefined;

  if (typeof shareIndex !== 'number' || !Number.isInteger(shareIndex) || shareIndex < 1 || shareIndex > 255) {
    return null;
  }
  if (typeof tokenHash !== 'string' || !HEX64_RE.test(tokenHash)) return null;
  if (
    typeof wrapped !== 'object' ||
    wrapped === null ||
    typeof wrapped.cipherText !== 'string' ||
    typeof wrapped.iv !== 'string' ||
    !wrapped.cipherText ||
    !wrapped.iv
  ) {
    return null;
  }

  return {
    share_index: shareIndex,
    token_hash: tokenHash,
    wrapped: { cipherText: wrapped.cipherText, iv: wrapped.iv },
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const accountId = body.account_id;
  const thresholdHours = body.threshold_hours;
  const guardiansRaw = body.guardians;

  if (typeof accountId !== 'string' || !ACCOUNT_ID_RE.test(accountId)) {
    return json({ error: 'invalid_account_id' }, 400);
  }
  if (
    typeof thresholdHours !== 'number' ||
    !Number.isInteger(thresholdHours) ||
    thresholdHours < MIN_THRESHOLD_HOURS ||
    thresholdHours > MAX_THRESHOLD_HOURS
  ) {
    return json({ error: 'invalid_threshold_hours', min: MIN_THRESHOLD_HOURS, max: MAX_THRESHOLD_HOURS }, 400);
  }
  if (!Array.isArray(guardiansRaw) || guardiansRaw.length < MIN_GUARDIANS || guardiansRaw.length > MAX_GUARDIANS) {
    return json({ error: 'invalid_guardians', min: MIN_GUARDIANS, max: MAX_GUARDIANS }, 400);
  }

  const guardians: GuardianInput[] = [];
  for (const raw of guardiansRaw) {
    const parsed = parseGuardian(raw);
    if (!parsed) return json({ error: 'invalid_guardian_entry' }, 400);
    guardians.push(parsed);
  }

  if (new Set(guardians.map((g) => g.share_index)).size !== guardians.length) {
    return json({ error: 'duplicate_share_index' }, 400);
  }
  if (new Set(guardians.map((g) => g.token_hash)).size !== guardians.length) {
    return json({ error: 'duplicate_token_hash' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();

  const { error: accountError } = await supabase.from('accounts').upsert(
    {
      account_id: accountId,
      last_active_at: nowIso,
      dms_heartbeat_at: nowIso,
      dms_threshold_hours: thresholdHours,
    },
    { onConflict: 'account_id' }
  );

  if (accountError) {
    console.error('account upsert failed', accountError.message);
    return json({ error: 'internal_error' }, 500);
  }

  // Replace-all semantics: clear any previous guardian set, then insert the
  // new one. Two statements, not one transaction — if the process died in
  // between, the account would just have zero guardians, meaning DMS setup
  // needs to be redone. It can never leave an insecure or inconsistent state.
  const { error: deleteError } = await supabase.from('dms_guardians').delete().eq('account_id', accountId);
  if (deleteError) {
    console.error('guardian delete failed', deleteError.message);
    return json({ error: 'internal_error' }, 500);
  }

  const { error: insertError } = await supabase.from('dms_guardians').insert(
    guardians.map((g) => ({
      account_id: accountId,
      share_index: g.share_index,
      token_hash: g.token_hash,
      wrapped_cipher_text: g.wrapped.cipherText,
      wrapped_iv: g.wrapped.iv,
    }))
  );

  if (insertError) {
    console.error('guardian insert failed', insertError.message);
    return json({ error: 'internal_error' }, 500);
  }

  const { error: logError } = await supabase
    .from('activity_log')
    .insert({ account_id: accountId, event_type: 'dms_setup', detail: { threshold_hours: thresholdHours, guardian_count: guardians.length } });
  if (logError) console.error('activity log insert failed', logError.message);

  return json({
    account_id: accountId,
    threshold_hours: thresholdHours,
    guardian_count: guardians.length,
    dms_heartbeat_at: nowIso,
  });
});
