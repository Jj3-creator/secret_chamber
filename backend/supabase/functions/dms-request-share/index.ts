// Secret Chamber — dms-request-share Edge Function
// ====================================================
// A guardian calls this with their own recovery token to retrieve their
// (still-wrapped) Shamir share. Two independent gates, both server-side:
//   1. token must hash to a token_hash registered for that account+share_index
//   2. the account's heartbeat must have actually expired (server clock,
//      not anything the caller asserts)
// The response is still ciphertext — the guardian must unwrap it locally
// with their own passphrase/PIN-derived key (vault.ts's unwrapVaultKey)
// before it's usable, and combining still needs >= threshold guardians.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS_HEADERS, json, ACCOUNT_ID_RE, sha256Hex } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MIN_TOKEN_LENGTH = 16; // recovery tokens are generated with plenty of entropy; anything shorter is a mistake, not a real one

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { account_id?: unknown; share_index?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const accountId = body.account_id;
  const shareIndex = body.share_index;
  const token = body.token;

  if (typeof accountId !== 'string' || !ACCOUNT_ID_RE.test(accountId)) {
    return json({ error: 'invalid_account_id' }, 400);
  }
  if (typeof shareIndex !== 'number' || !Number.isInteger(shareIndex) || shareIndex < 1 || shareIndex > 255) {
    return json({ error: 'invalid_share_index' }, 400);
  }
  if (typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH) {
    return json({ error: 'invalid_token' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const tokenHash = await sha256Hex(token);

  const { data: guardian, error: guardianError } = await supabase
    .from('dms_guardians')
    .select('wrapped_cipher_text, wrapped_iv')
    .eq('account_id', accountId)
    .eq('share_index', shareIndex)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (guardianError) {
    console.error('guardian lookup failed', guardianError.message);
    return json({ error: 'internal_error' }, 500);
  }
  if (!guardian) {
    // Deliberately vague about which of account_id/share_index/token was
    // wrong — a lookup failure here should look identical either way.
    return json({ error: 'not_found' }, 404);
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('dms_heartbeat_at, dms_threshold_hours')
    .eq('account_id', accountId)
    .maybeSingle();

  if (accountError) {
    console.error('account lookup failed', accountError.message);
    return json({ error: 'internal_error' }, 500);
  }
  if (!account?.dms_heartbeat_at || !account?.dms_threshold_hours) {
    return json({ error: 'dms_not_configured' }, 400);
  }

  const heartbeatAtMs = new Date(account.dms_heartbeat_at).getTime();
  const eligibleAtMs = heartbeatAtMs + account.dms_threshold_hours * 60 * 60 * 1000;
  const nowMs = Date.now();

  if (nowMs < eligibleAtMs) {
    return json(
      {
        error: 'not_yet_eligible',
        eligible_at: new Date(eligibleAtMs).toISOString(),
        retry_after_seconds: Math.ceil((eligibleAtMs - nowMs) / 1000),
      },
      403
    );
  }

  return json({
    share_index: shareIndex,
    wrapped: { cipherText: guardian.wrapped_cipher_text, iv: guardian.wrapped_iv },
  });
});
