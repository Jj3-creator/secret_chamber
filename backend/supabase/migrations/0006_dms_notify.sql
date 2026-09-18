-- Secret Chamber — Part 4: real auto-notify for eligible guardians
-- ======================================================================
-- Feedback: "อยากให้ APP แจ้งเตือน id line และ อีเมล์เลยได้ไม๊" /
-- "BETA ต้องการให้ feature ระบบแจ้งเตือนทำงานได้ทันที" — this migration
-- backs a real (email-only; see dms-notify/index.ts for why LINE isn't
-- included) automatic notification when an account becomes eligible for
-- guardian recovery, instead of only the manual copy/paste flow.
--
-- Deliberate, narrow trade-off against 0002_dms_heartbeat.sql's own "no
-- PII" comment: guardian_email is the ONE piece of guardian identity this
-- server now learns, and ONLY if the owner chose to type an email in for
-- that guardian (already an optional field client-side — see
-- DMSSetupScreen.tsx). It is used for exactly one purpose: telling that
-- address "you've been named a trusted contact and the account you're
-- tied to is now eligible for recovery — use the token you already have."
--
-- Critically, the RAW recovery token is still never sent here, still
-- never stored anywhere server-side (see dms-request-share/index.ts's own
-- comment) — only its SHA-256 hash, exactly as before. The email is a
-- reminder to use a token the guardian must already hold out-of-band; it
-- is not a delivery mechanism for the token itself. A full server
-- compromise still cannot recover anyone's vault on its own — it would
-- still need each guardian's own token, which this table still never has.

alter table public.dms_guardians
  add column if not exists guardian_email text,
  add column if not exists notified_at    timestamptz;

comment on column public.dms_guardians.guardian_email is
  'Optional, owner-supplied at setup time — used ONLY to send the one-time '
  '"you are now eligible to recover" reminder email via dms-notify. Never '
  'the raw recovery token itself, which is never stored server-side.';
comment on column public.dms_guardians.notified_at is
  'When dms-notify last sent the eligibility email to this guardian. NULL = not yet notified for the current eligibility window.';

-- Re-notifying every guardian on every cron tick once eligible would
-- otherwise mean identical emails piling up — dms-notify only emails rows
-- where this is still null, then stamps it. A fresh dms-setup call
-- replaces the whole guardian set (see dms-setup/index.ts's own
-- replace-all comment) so a reconfigured account's guardians naturally
-- start unnotified again.
create index if not exists idx_dms_guardians_notify
  on public.dms_guardians (account_id)
  where guardian_email is not null and notified_at is null;
