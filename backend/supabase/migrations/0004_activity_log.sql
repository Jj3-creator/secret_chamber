-- Secret Chamber — activity log for the usage dashboard
-- =========================================================
-- Feature request: "มีหน้าสรุป dashboard การใช้งาน ... activity การเข้า
-- ใช้งาน". Each meaningful server-side event (a real upload request, a
-- real heartbeat check-in) writes one row here. Read-only for the client,
-- same RLS pattern as `accounts` — scoped by the x-account-id header,
-- defense-in-depth on top of the real gate (only service_role, via Edge
-- Functions, ever writes here).
--
-- No per-category storage breakdown yet: `blobs` has no category column
-- (uploads aren't tagged with a category — section 04's upload UI isn't
-- built), so a per-category dashboard would have to fake numbers. The
-- client's dashboard says so honestly instead.

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  account_id  text not null references public.accounts(account_id) on delete cascade,
  event_type  text not null check (event_type in ('upload', 'heartbeat', 'dms_setup')),
  detail      jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.activity_log is
  'One row per meaningful server-side event (upload, heartbeat check-in, '
  'DMS setup) — powers the usage/activity dashboard. Written only by '
  'Edge Functions running as service_role.';

create index if not exists idx_activity_log_account_id_created_at
  on public.activity_log (account_id, created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select_own on public.activity_log;
create policy activity_log_select_own
  on public.activity_log for select
  using (account_id = public.current_account_id());

-- No insert/update/delete policies for anon/authenticated — only
-- service_role (bypasses RLS) writes, from get-upload-url / dms-heartbeat /
-- dms-setup.
