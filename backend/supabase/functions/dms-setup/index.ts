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

// Client now allows 1-3 guardians (feedback: a forced minimum of 2 felt
// arbitrary) — 1 guardian means a plain direct handoff with no Shamir
// splitting (see DMSSetupScreen.tsx's thresholdFor()), which is still a
// single guardian row here, so the server-side floor just needs to allow
// that, not enforce any particular threshold scheme itself.
const MIN_GUARDIANS = 1;
const MAX_GUARDIANS = 255;
const MIN_THRESHOLD_HOURS = 1;
const MAX_THRESHOLD_HOURS = 24 * 365; // 1 year sanity cap

interface GuardianInput {
  share_index: number;
  token_hash: string;
  wrapped: { cipherText: string; iv: string };
  // Optional — see 0006_dms_notify.sql's own comment for the narrow
  // "email only, never the token itself" trade-off this represents.
  guardian_email: string | null;
  // Same trade-off, for SMS. See 0007_line_sms_notify.sql.
  guardian_phone: string | null;
  // Whether this guardian wants a LINE link code generated (see below) —
  // not itself a value to store, just a request flag; the actual code is
  // server-generated, never client-supplied (so it can't collide/be
  // guessed by the client).
  want_line: boolean;
}

// Loose but real validation — this only ever gates which address/number
// gets a reminder, never anything security-sensitive, so it doesn't need
// to be a strict RFC 5322/E.164 parser.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9()\-\s]{6,20}$/;

function parseGuardian(raw: unknown): GuardianInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const g = raw as Record<string, unknown>;
  const shareIndex = g.share_index;
  const tokenHash = g.token_hash;
  const wrapped = g.wrapped as Record<string, unknown> | null | undefined;
  const emailRaw = g.guardian_email;
  const phoneRaw = g.guardian_phone;

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
  if (emailRaw != null && (typeof emailRaw !== 'string' || !EMAIL_RE.test(emailRaw))) return null;
  if (phoneRaw != null && (typeof phoneRaw !== 'string' || !PHONE_RE.test(phoneRaw))) return null;

  return {
    share_index: shareIndex,
    token_hash: tokenHash,
    wrapped: { cipherText: wrapped.cipherText, iv: wrapped.iv },
    guardian_email: (emailRaw as string | null) ?? null,
    guardian_phone: (phoneRaw as string | null) ?? null,
    want_line: g.want_line === true,
  };
}

/** 6-digit numeric code a guardian types as a LINE message to link their account — see 0007_line_sms_notify.sql. */
function generateLinkCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = new DataView(bytes.buffer).getUint32(0) % 1_000_000;
  return n.toString().padStart(6, '0');
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

  // guardian_line_link_code has a unique partial index (0007's own
  // comment) — vanishingly unlikely to collide at 1-in-a-million odds per
  // pair, but retried a few times rather than trusting that.
  let lineLinkCodes: (string | null)[] = guardians.map((g) => (g.want_line ? generateLinkCode() : null));
  let insertError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from('dms_guardians').insert(
      guardians.map((g, i) => ({
        account_id: accountId,
        share_index: g.share_index,
        token_hash: g.token_hash,
        wrapped_cipher_text: g.wrapped.cipherText,
        wrapped_iv: g.wrapped.iv,
        guardian_email: g.guardian_email,
        guardian_phone: g.guardian_phone,
        guardian_line_link_code: lineLinkCodes[i],
      }))
    );
    insertError = error;
    // Postgres unique_violation — regenerate just the link codes (the
    // share_index/token_hash uniqueness was already checked above) and
    // retry the whole batch insert.
    if (error && error.code === '23505') {
      lineLinkCodes = guardians.map((g) => (g.want_line ? generateLinkCode() : null));
      continue;
    }
    break;
  }

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
    // Keyed by share_index so the client can match each code back to the
    // right guardian card on its reveal screen — null for any guardian
    // who didn't request LINE linking.
    line_link_codes: guardians.map((g, i) => ({ share_index: g.share_index, line_link_code: lineLinkCodes[i] })),
  });
});
