// Secret Chamber — dms-heartbeat Edge Function
// ===============================================
// The owner's app calls this periodically ("I'm still here") to push back
// the Dead Man's Switch. Guardians become eligible to request their share
// only once dms_heartbeat_at + dms_threshold_hours has elapsed — enforced
// against the SERVER's clock in dms-request-share, not the caller's claim.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS_HEADERS, json, ACCOUNT_ID_RE } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { account_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const accountId = body.account_id;
  if (typeof accountId !== 'string' || !ACCOUNT_ID_RE.test(accountId)) {
    return json({ error: 'invalid_account_id' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('accounts')
    .update({ dms_heartbeat_at: nowIso, last_active_at: nowIso })
    .eq('account_id', accountId)
    .not('dms_threshold_hours', 'is', null)
    .select('dms_heartbeat_at, dms_threshold_hours')
    .maybeSingle();

  if (error) {
    console.error('heartbeat update failed', error.message);
    return json({ error: 'internal_error' }, 500);
  }
  if (!data) {
    // Either the account doesn't exist, or it exists but never ran
    // dms-setup (dms_threshold_hours is null) — nothing to heartbeat.
    return json({ error: 'dms_not_configured' }, 400);
  }

  const { error: logError } = await supabase.from('activity_log').insert({ account_id: accountId, event_type: 'heartbeat' });
  if (logError) console.error('activity log insert failed', logError.message);

  return json({
    account_id: accountId,
    dms_heartbeat_at: data.dms_heartbeat_at,
    dms_threshold_hours: data.dms_threshold_hours,
  });
});
