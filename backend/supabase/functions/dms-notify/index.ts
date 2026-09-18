// Secret Chamber — dms-notify Edge Function
// =============================================
// Feedback: "อยากให้ APP แจ้งเตือน id line และ อีเมล์เลยได้ไม๊" / "BETA
// ต้องการให้ feature ระบบแจ้งเตือนทำงานได้ทันที" / "ต้องการให้ notify line
// id, และ sms ได้" — sends a one-time reminder to each guardian whose
// account has actually become eligible for recovery (checked against the
// server's own clock, the same computation dms-request-share itself
// uses — not anything a client asserts), across up to three channels:
//   - Email, via Resend's HTTP API (RESEND_API_KEY) — see 0006_dms_notify.sql
//   - SMS, via Twilio's HTTP API (TWILIO_*) — see 0007_line_sms_notify.sql
//   - LINE, via the Messaging API's push endpoint (LINE_CHANNEL_ACCESS_TOKEN),
//     but ONLY to a guardian_line_user_id already learned by
//     line-webhook.ts — never to a still-pending link code. See
//     0007_line_sms_notify.sql's own comment for why LINE needs that
//     separate linking step at all (an OA can't message an arbitrary
//     person the way an email/SMS can reach an arbitrary address/number).
//
// ⚠️ SMS and LINE sending here are prepared but NOT yet smoke-tested
// against real Twilio/LINE credentials (written overnight — see git log).
// Email is real and confirmed working end-to-end. Before relying on
// SMS/LINE: set the relevant secrets, deploy, and dry-run against a real
// guardian row with that channel filled in.
//
// What each channel's message is/isn't: a REMINDER to use a recovery
// token the guardian must already hold out-of-band (handed over by the
// account owner, exactly as before setup already worked) — never a way
// to deliver that token itself. The raw token is never stored
// server-side (only its SHA-256 hash, in dms_guardians.token_hash) and
// this function never sees or needs it — so a full server compromise
// still can't recover anyone's vault on its own from this table alone.
//
// A guardian may have any combination of the three channels on file;
// this attempts all that are present and stamps notified_at once at
// least one succeeds (a channel that fails is simply skipped for that
// guardian this run — dms_guardians keeps just one notified_at, not one
// per channel, so "notified" here means "made contact via at least one
// working channel", not "every channel succeeded").
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

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// Resend's own shared sandbox sender — works immediately with just an API
// key, no domain verification needed, but (Resend's own restriction) can
// only deliver to the email address that owns the API key until a real
// domain is verified. Swap for a verified custom address once one exists.
const FROM_ADDRESS = Deno.env.get('DMS_NOTIFY_FROM') ?? 'Secret Chamber <onboarding@resend.dev>';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER');

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');

interface PendingGuardian {
  id: string;
  account_id: string;
  guardian_email: string | null;
  guardian_phone: string | null;
  guardian_line_user_id: string | null;
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

const REMINDER_TEXT =
  'คุณถูกระบุเป็น "บุคคลที่คุณเชื่อถือ" ในแอป Secret Chamber ของใครบางคน บัญชีนั้นขาดการล็อกอินเกินระยะเวลาที่เจ้าของบัญชีกำหนดไว้ ' +
  'คุณสามารถใช้ "รหัสกุญแจสำรอง" ที่เจ้าของบัญชีเคยส่งให้คุณไว้แล้ว (นอกแอป) เพื่อช่วยกู้คืนบัญชีได้ตั้งแต่ตอนนี้ ' +
  'ข้อความนี้เป็นเพียงการแจ้งเตือนเท่านั้น ไม่ได้แนบรหัสกุญแจสำรองมาด้วย ระบบไม่เคยเก็บรหัสนี้ไว้ที่เซิร์ฟเวอร์เลย';

function emailHtml(): string {
  return `
    <p>สวัสดีครับ/ค่ะ</p>
    <p>คุณถูกระบุเป็น "บุคคลที่คุณเชื่อถือ" ในแอป <strong>ห้องแห่งความลับของฉัน (My Secret Chamber)</strong> ของใครบางคน</p>
    <p>บัญชีนั้นขาดการล็อกอินเกินระยะเวลาที่เจ้าของบัญชีกำหนดไว้ — ระบบจึงอนุญาตให้คุณใช้ "รหัสกุญแจสำรอง" ที่เจ้าของบัญชีเคยส่งให้คุณไว้แล้ว (นอกแอป) เพื่อช่วยกู้คืนบัญชีได้ตั้งแต่ตอนนี้</p>
    <p><strong>อีเมลนี้เป็นเพียงการแจ้งเตือนเท่านั้น</strong> — ไม่ได้แนบรหัสกุญแจสำรองมาด้วย ระบบไม่เคยเก็บรหัสนี้ไว้ที่เซิร์ฟเวอร์เลยเพื่อความปลอดภัยของเจ้าของบัญชี หากคุณยังไม่มีรหัสนี้ กรุณาติดต่อเจ้าของบัญชีโดยตรง</p>
    <p style="color:#888;font-size:13px">อีเมลนี้ส่งโดยอัตโนมัติจากแอป Secret Chamber — ไม่ใช่การขอข้อมูลส่วนตัว รหัสผ่าน หรือรหัสกุญแจใดๆ จากคุณ</p>
  `;
}

async function sendEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'email_not_configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: 'คุณสามารถใช้รหัสกุญแจสำรองได้แล้ว — Secret Chamber',
      html: emailHtml(),
    }),
  });
  if (!res.ok) return { ok: false, error: `resend_${res.status}` };
  return { ok: true };
}

async function sendSms(to: string): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return { ok: false, error: 'sms_not_configured' };
  const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: REMINDER_TEXT }),
  });
  if (!res.ok) return { ok: false, error: `twilio_${res.status}` };
  return { ok: true };
}

async function sendLine(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return { ok: false, error: 'line_not_configured' };
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: REMINDER_TEXT }] }),
  });
  if (!res.ok) return { ok: false, error: `line_${res.status}` };
  return { ok: true };
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

  // "has at least one channel on file" — a guardian with only a name (no
  // email/phone/linked LINE) simply can't be auto-notified at all, and
  // never shows up here; the owner still handed them the code manually.
  const { data: guardianRows, error: guardianError } = await supabase
    .from('dms_guardians')
    .select('id, account_id, guardian_email, guardian_phone, guardian_line_user_id')
    .in('account_id', eligibleAccountIds)
    .is('notified_at', null)
    .or('guardian_email.not.is.null,guardian_phone.not.is.null,guardian_line_user_id.not.is.null');

  if (guardianError) {
    console.error('select pending guardians failed', guardianError.message);
    return json({ error: 'internal_error' }, 500);
  }

  const pending = (guardianRows ?? []) as PendingGuardian[];
  const results: Array<{ id: string; account_id: string; sent: boolean; channels: Record<string, string> }> = [];

  for (const g of pending) {
    if (dryRun) {
      results.push({ id: g.id, account_id: g.account_id, sent: false, channels: {} });
      continue;
    }

    const channels: Record<string, string> = {};
    let anySent = false;

    try {
      if (g.guardian_email) {
        const r = await sendEmail(g.guardian_email);
        channels.email = r.ok ? 'sent' : (r.error ?? 'failed');
        if (r.ok) anySent = true;
      }
      if (g.guardian_phone) {
        const r = await sendSms(g.guardian_phone);
        channels.sms = r.ok ? 'sent' : (r.error ?? 'failed');
        if (r.ok) anySent = true;
      }
      if (g.guardian_line_user_id) {
        const r = await sendLine(g.guardian_line_user_id);
        channels.line = r.ok ? 'sent' : (r.error ?? 'failed');
        if (r.ok) anySent = true;
      }
    } catch (e) {
      console.error(`send failed for guardian ${g.id}`, e);
      channels.exception = String(e);
    }

    if (anySent) {
      // Stamped only after at least one channel confirmed success — a
      // guardian whose only channel failed leaves notified_at null so the
      // next scheduled run retries them.
      const { error: updateError } = await supabase
        .from('dms_guardians')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', g.id);
      if (updateError) console.error(`notified_at update failed for guardian ${g.id}`, updateError.message);
    }

    results.push({ id: g.id, account_id: g.account_id, sent: anySent, channels });
  }

  return json({
    dry_run: dryRun,
    eligible_accounts: eligibleAccountIds.length,
    pending_guardians: pending.length,
    notified: results.filter((r) => r.sent).length,
    results,
  });
});
