-- Secret Chamber — Part 5: LINE + SMS auto-notify
-- ======================================================
-- Extends 0006_dms_notify.sql's email-only reminder to also cover LINE
-- and SMS. Same "reminder, never the token" design as email (see that
-- migration's own comment) — none of these three channels ever carries
-- the raw recovery token, only a nudge to use one the guardian already
-- has out-of-band.
--
-- guardian_phone: optional, owner-supplied at setup (same trust model as
-- guardian_email) — used by dms-notify to send an SMS via Twilio.
--
-- LINE is a two-step process, unlike email/SMS, because a LINE Official
-- Account cannot message an arbitrary person — only someone who has
-- already added it as a friend AND whose internal userId the OA has
-- learned (via a 'follow' or 'message' webhook event; a human-chosen
-- LINE ID/handle is NOT sufficient to message someone, unlike an email
-- address or phone number). So:
--   1. At setup, the owner gets a short guardian_line_link_code to pass
--      to the guardian (see DMSSetupScreen.tsx) alongside the recovery
--      code, with instructions to add the OA as a friend and send that
--      code as a message.
--   2. line-webhook/index.ts's message handler matches the code sent to
--      an unlinked dms_guardians row and stores the sender's real userId
--      in guardian_line_user_id — permanently swapping the code out for
--      the actual send target. dms-notify only ever sends to
--      guardian_line_user_id, never to a link code.
alter table public.dms_guardians
  add column if not exists guardian_phone text,
  add column if not exists guardian_line_link_code text,
  add column if not exists guardian_line_user_id text;

comment on column public.dms_guardians.guardian_phone is
  'Optional, owner-supplied at setup time — used ONLY to send the one-time "you are now eligible to recover" reminder SMS via Twilio. Never the raw recovery token.';
comment on column public.dms_guardians.guardian_line_link_code is
  'Short code the guardian sends as a LINE message to the app''s Official Account to link their LINE userId to this row. Cleared once linked (see guardian_line_user_id).';
comment on column public.dms_guardians.guardian_line_user_id is
  'LINE''s own internal user id for this guardian, learned via line-webhook once they message the OA with their link code — NOT the human-chosen LINE ID/handle, which LINE''s Messaging API cannot target directly. Null until linked.';

-- Fast lookup for line-webhook matching an incoming message's text against
-- a pending link code.
create unique index if not exists idx_dms_guardians_line_link_code
  on public.dms_guardians (guardian_line_link_code)
  where guardian_line_link_code is not null;
