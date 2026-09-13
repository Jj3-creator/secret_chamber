// Secret Chamber — dms-heartbeat Edge Function
// ===============================================
// The owner's app calls this periodically ("I'm still here") to push back
// the Dead Man's Switch. Guardians become eligible to request their share
// only once dms_heartbeat_at + dms_threshold_hours has elapsed — enforced
// against the SERVER's clock in dms-request-share, not the caller's claim.
//
// Feedback: "การเช็คอิน ... ต้องทำและ activate ปุ่มทุกครั้งทุกคน ไม่ว่า
// จะ set ผู้รับกุญแจสำรองหรือไม่ เพราะมีผลต่อ non-entry 365 วันแล้วห้อง
// จะต้องลบตัวเองไป" — check-in must always bump last_active_at (the
// field the 1-year auto-delete cleanup job actually checks — see
// cleanup-inactive-accounts), REGARDLESS of whether DMS/guardians were
// ever configured. Previously this only ran a conditional UPDATE that
// matched zero rows (and touched nothing) whenever dms_threshold_hours
// was null OR the account row didn't exist yet — meaning a room that
// never set up guardians could check in forever and still silently
// accumulate towards deletion. Now an unconditional UPSERT, so a brand
// new/no-DMS room's very first check-in still creates/refreshes the row.

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

  // Upsert (not a conditional UPDATE) so this always bumps last_active_at
  // — including a brand-new account's very first check-in, and one that
  // never configured DMS at all. dms_heartbeat_at is written unconditionally
  // too; it's simply unused by dms-request-share until dms_threshold_hours
  // is also set (by dms-setup), so writing it early is harmless.
  const { data, error } = await supabase
    .from('accounts')
    .upsert({ account_id: accountId, last_active_at: nowIso, dms_heartbeat_at: nowIso }, { onConflict: 'account_id' })
    .select('dms_heartbeat_at, dms_threshold_hours')
    .maybeSingle();

  if (error) {
    console.error('heartbeat upsert failed', error.message);
    return json({ error: 'internal_error' }, 500);
  }

  const { error: logError } = await supabase.from('activity_log').insert({ account_id: accountId, event_type: 'heartbeat' });
  if (logError) console.error('activity log insert failed', logError.message);

  return json({
    account_id: accountId,
    dms_heartbeat_at: data?.dms_heartbeat_at ?? nowIso,
    dms_threshold_hours: data?.dms_threshold_hours ?? null,
  });
});
