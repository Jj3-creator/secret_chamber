// Secret Chamber — dms-notify Edge Function
// =============================================
// Feedback: "อยากให้ APP แจ้งเตือน id line และ อีเมล์เลยได้ไม๊" / "BETA
// ต้องการให้ feature ระบบแจ้งเตือนทำงานได้ทันที" — sends a one-time email
// reminder to each guardian who (a) gave an email address at setup and
// (b) whose account has actually become eligible for recovery (checked
// against the server's own clock, the same computation dms-request-share
// itself uses — not anything a client asserts), via Resend's HTTP API.
//
// LINE is deliberately NOT included here: the only way LINE used to let
// an app push a message to an arbitrary person's LINE without them first
// adding a dedicated Official Account as a friend — "LINE Notify" — was
// shut down by LINE in March 2025. Real LINE delivery today needs a LINE
// Official Account + Messaging API channel + each guardian explicitly
// friending that OA first: a materially bigger integration than "type in
// a LINE ID", left for later.
//
// What this email is/isn't: a REMINDER to use a recovery token the
// guardian must already hold out-of-band (handed over by the account
// owner, exactly as before setup already worked) — never a way to
// deliver that token itself. The raw token is never stored server-side
// (only its SHA-256 hash, in dms_guardians.token_hash) and this function
// never sees or needs it — so a full server compromise still can't
// recover anyone's vault on its own from this table alone.
//
// SECURITY (same pattern as cleanup-inactive-accounts): deployed WITHOUT
// --no-verify-jwt, so only a service_role-authenticated caller (i.e. a
// scheduled Cron Job from the Supabase Dashboard, not the app itself) can
// invoke this — see backend/README.md's "Auto-delete after 1 year"
// section for the exact same reasoning, reused here.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS_HEADERS, json } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
// Resend's own shared sandbox sender — works immediately with just an API
// key, no domain verification needed. Swap for a verified custom address
// (e.g. "Secret Chamber <notify@yourdomain.com>") once one exists, via
// the DMS_NOTIFY_FROM secret — see Resend's own Domains tab to verify one.
const FROM_ADDRESS = Deno.env.get('DMS_NOTIFY_FROM') ?? 'Secret Chamber <onboarding@resend.dev>';

interface PendingGuardian {
  id: string;
  account_id: string;
  guardian_email: string;
}

// Same "is this really service_role" check as cleanup-inactive-accounts —
// see that function's own comment for why the platform's verify_jwt alone
// isn't sufficient (it accepts the anon key too, just with a different
// role claim).
function isServiceRoleJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

function emailHtml(): string {
  return `
    <p>สวัสดีครับ/ค่ะ</p>
    <p>คุณถูกระบุเป็น "บุคคลที่คุณเชื่อถือ" ในแอป <strong>ห้องแห่งความลับของฉัน (My Secret Chamber)</strong> ของใครบางคน</p>
    <p>บัญชีนั้นขาดการล็อกอินเกินระยะเวลาที่เจ้าของบัญชีกำหนดไว้ — ระบบจึงอนุญาตให้คุณใช้ "รหัสกุญแจสำรอง" ที่เจ้าของบัญชีเคยส่งให้คุณไว้แล้ว (นอกแอป) เพื่อช่วยกู้คืนบัญชีได้ตั้งแต่ตอนนี้</p>
    <p><strong>อีเมลนี้เป็นเพียงการแจ้งเตือนเท่านั้น</strong> — ไม่ได้แนบรหัสกุญแจสำรองมาด้วย ระบบไม่เคยเก็บรหัสนี้ไว้ที่เซิร์ฟเวอร์เลยเพื่อความปลอดภัยของเจ้าของบัญชี หากคุณยังไม่มีรหัสนี้ กรุณาติดต่อเจ้าของบัญชีโดยตรง</p>
    <p style="color:#888;font-size:13px">อีเมลนี้ส่งโดยอัตโนมัติจากแอป Secret Chamber — ไม่ใช่การขอข้อมูลส่วนตัว รหัสผ่าน หรือรหัสกุญแจใดๆ จากคุณ</p>
  `;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (bearerToken !== SUPABASE_SERVICE_ROLE_KEY && !isServiceRoleJwt(bearerToken)) {
    return json({ error: 'forbidden' }, 403);
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
  } catch {
    // no/empty body is fine — dry_run just stays false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Eligibility is computed here in JS (same as dms-request-share's own
  // check), not as a PostgREST filter — "heartbeat + threshold hours" is
  // a computed expression PostgREST's query params can't express directly,
  // and the accounts with DMS configured at all are a small subset of
  // total accounts, so fetching them and filtering in memory is cheap.
  const { data: dmsAccounts, error: acctError } = await supabase
    .from('accounts')
    .select('account_id, dms_heartbeat_at, dms_threshold_hours')
    .not('dms_heartbeat_at', 'is', null)
    .not('dms_threshold_hours', 'is', null);

  if (acctError) {
    console.error('select dms accounts failed', acctError.message);
    return json({ error: 'internal_error' }, 500);
  }

  const nowMs = Date.now();
  const eligibleAccountIds = (dmsAccounts ?? [])
    .filter(
      (a) =>
        nowMs >=
        new Date(a.dms_heartbeat_at as string).getTime() + (a.dms_threshold_hours as number) * 60 * 60 * 1000
    )
    .map((a) => a.account_id as string);

  if (eligibleAccountIds.length === 0) {
    return json({ dry_run: dryRun, eligible_accounts: 0, notified: 0, results: [] });
  }

  const { data: guardianRows, error: guardianError } = await supabase
    .from('dms_guardians')
    .select('id, account_id, guardian_email')
    .in('account_id', eligibleAccountIds)
    .not('guardian_email', 'is', null)
    .is('notified_at', null);

  if (guardianError) {
    console.error('select pending guardians failed', guardianError.message);
    return json({ error: 'internal_error' }, 500);
  }

  const pending = (guardianRows ?? []) as PendingGuardian[];
  const results: Array<{ id: string; account_id: string; sent: boolean; error?: string }> = [];

  for (const g of pending) {
    if (dryRun) {
      results.push({ id: g.id, account_id: g.account_id, sent: false });
      continue;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: g.guardian_email,
          subject: 'คุณสามารถใช้รหัสกุญแจสำรองได้แล้ว — Secret Chamber',
          html: emailHtml(),
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error(`resend send failed for guardian ${g.id}`, res.status, errBody);
        results.push({ id: g.id, account_id: g.account_id, sent: false, error: `resend_${res.status}` });
        continue;
      }
      // Stamped only after a confirmed 2xx from Resend — a failed send
      // leaves notified_at null so the next scheduled run retries it.
      const { error: updateError } = await supabase
        .from('dms_guardians')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', g.id);
      if (updateError) console.error(`notified_at update failed for guardian ${g.id}`, updateError.message);
      results.push({ id: g.id, account_id: g.account_id, sent: true });
    } catch (e) {
      console.error(`send failed for guardian ${g.id}`, e);
      results.push({ id: g.id, account_id: g.account_id, sent: false, error: 'send_exception' });
    }
  }

  return json({
    dry_run: dryRun,
    eligible_accounts: eligibleAccountIds.length,
    pending_guardians: pending.length,
    notified: results.filter((r) => r.sent).length,
    results,
  });
});
