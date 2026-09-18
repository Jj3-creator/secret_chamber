// Secret Chamber — line-webhook Edge Function
// ================================================
// ⚠️ Written without a real LINE Official Account / Channel to test
// against (prepared overnight while the account owner was asleep — see
// git log). The HMAC signature verification and webhook event shapes
// below are implemented per LINE's own published Messaging API docs
// (https://developers.line.biz/en/reference/messaging-api/#signature-validation,
// #webhook-event-objects), but this has NOT been smoke-tested against a
// live channel yet. Before relying on it: create the LINE Official
// Account + Messaging API channel, set LINE_CHANNEL_SECRET and
// LINE_CHANNEL_ACCESS_TOKEN as secrets, deploy this function, set its URL
// as the channel's webhook URL in the LINE Developers Console, then
// message the OA with a real guardian's link code and confirm
// guardian_line_user_id gets set (see the SQL check in this file's own
// deploy notes / backend/README.md).
//
// Why LINE needs a webhook at all (unlike email/SMS, which just need an
// address/number): a LINE Official Account can only message someone who
// has (a) added it as a friend and (b) whose internal `userId` the OA has
// learned — never just a human-chosen LINE ID/handle. This function is
// how that userId gets learned and tied to a specific dms_guardians row:
//   1. DMSSetupScreen.tsx shows the owner a 6-digit guardian_line_link_code
//      per guardian who opted into LINE (generated server-side by
//      dms-setup, see that function's own comment), to pass along with
//      the recovery code, out-of-band, exactly like the token itself.
//   2. The guardian adds the OA as a friend and sends that code as a
//      plain text message.
//   3. THIS function receives that message via LINE's webhook, matches
//      the code to an unlinked dms_guardians row, and stores the
//      sender's real userId in guardian_line_user_id — the code is
//      single-use, cleared once matched.
//   4. dms-notify only ever sends to guardian_line_user_id, never to a
//      link code — so a stale/guessed code can't be used to redirect
//      notifications to the wrong LINE account once it's been consumed.
//
// SECURITY: LINE calls this URL directly (no Supabase Authorization
// header at all — it doesn't know about Supabase), so this is deployed
// WITH --no-verify-jwt like the other client/webhook-facing functions.
// The real authenticity check is LINE's own HMAC-SHA256 signature in the
// x-line-signature header, verified against LINE_CHANNEL_SECRET below —
// a request without a valid signature is rejected before touching the
// database at all.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS_HEADERS, json } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!;
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!;

const LINK_CODE_RE = /^\d{6}$/;

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(LINE_CHANNEL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  return computed === signatureHeader;
}

async function replyText(replyToken: string, text: string): Promise<void> {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch (e) {
    // A failed reply shouldn't fail the whole webhook — LINE only cares
    // that we 200'd within its timeout; the actual linking already
    // happened (or didn't) before this is called.
    console.error('line reply failed', e);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature');
  if (!(await verifySignature(rawBody, signature))) {
    return json({ error: 'invalid_signature' }, 403);
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  for (const event of body.events ?? []) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const userId = event.source?.userId;
    const text = event.message.text?.trim() ?? '';
    if (!userId || !LINK_CODE_RE.test(text)) continue;

    const { data: guardian, error: selectError } = await supabase
      .from('dms_guardians')
      .select('id')
      .eq('guardian_line_link_code', text)
      .is('guardian_line_user_id', null)
      .maybeSingle();

    if (selectError) {
      console.error('link code lookup failed', selectError.message);
      continue;
    }

    if (!guardian) {
      if (event.replyToken) {
        await replyText(event.replyToken, 'ไม่พบรหัสนี้ หรือเชื่อมบัญชีไปแล้ว — ลองตรวจสอบรหัสอีกครั้ง');
      }
      continue;
    }

    const { error: updateError } = await supabase
      .from('dms_guardians')
      .update({ guardian_line_user_id: userId, guardian_line_link_code: null })
      .eq('id', guardian.id);

    if (updateError) {
      console.error('link code consume failed', updateError.message);
      continue;
    }

    if (event.replyToken) {
      await replyText(
        event.replyToken,
        'เชื่อมบัญชี LINE เรียบร้อยแล้ว — Secret Chamber จะแจ้งเตือนคุณที่นี่เมื่อถึงเวลาที่ต้องใช้รหัสกุญแจสำรอง'
      );
    }
  }

  // LINE only cares about a fast 200 — every event above is processed
  // best-effort; a per-event failure is logged, not surfaced here.
  return json({ ok: true });
});
