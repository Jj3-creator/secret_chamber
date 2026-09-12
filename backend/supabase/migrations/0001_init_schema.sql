-- Secret Chamber — Part 2: Zero-Knowledge schema
-- ================================================
-- No PII anywhere in this schema. `account_id` is a client-derived
-- SHA-256(master_key) hex string (see Part 1, deriveAccountId()) — the
-- server never sees a passphrase, a master key, or plaintext.

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  account_id          text primary key
                       check (account_id ~ '^[0-9a-f]{64}$'), -- sha256 hex digest
  created_at          timestamptz not null default now(),
  last_active_at      timestamptz not null default now(),
  storage_used_bytes  bigint not null default 0 check (storage_used_bytes >= 0)
);

comment on table public.accounts is
  'Pseudonymous account, keyed by a client-derived SHA-256(master_key) hash. No PII.';

-- ---------------------------------------------------------------------------
-- blobs
-- ---------------------------------------------------------------------------
create table if not exists public.blobs (
  blob_id          uuid primary key default gen_random_uuid(),
  account_id       text not null references public.accounts(account_id) on delete cascade,
  file_size_bytes  bigint not null
                   check (file_size_bytes > 0 and file_size_bytes <= 104857600), -- 100 MB cap
  created_at       timestamptz not null default now()
);

comment on table public.blobs is
  'Metadata for opaque encrypted blobs stored in Cloudflare R2. The actual '
  'ciphertext bytes never touch Postgres — only size/ownership bookkeeping.';

create index if not exists idx_blobs_account_id on public.blobs (account_id);
create index if not exists idx_blobs_created_at on public.blobs (created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Threat model note: this app has no Supabase Auth session and no
-- passwords — "knowing account_id" is, by construction, equivalent to
-- "knowing SHA-256(master_key)", a 256-bit value infeasible to guess. That
-- makes account_id usable as a capability token, similar in spirit to a
-- bearer credential, but a client-supplied request header is still
-- trivially spoofable by anyone who intercepts or is handed that header —
-- so treat the policies below as defense-in-depth, NOT the primary gate.
--
-- The primary gate is: privileged operations (issuing presigned upload
-- URLs, writing blob rows) go through the get-upload-url Edge Function,
-- which runs with the service_role key and therefore bypasses RLS
-- entirely. Direct table access via the anon/public API key is locked
-- down to "your own account_id, if you can prove you sent it" as a
-- secondary layer only.

alter table public.accounts enable row level security;
alter table public.blobs enable row level security;

-- Resolves the caller's claimed account_id from a custom request header.
-- Client calls (via supabase-js / PostgREST) must set:
--   headers: { 'x-account-id': '<64-char hex account_id>' }
create or replace function public.current_account_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json->>'x-account-id', '');
$$;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
  on public.accounts for select
  using (account_id = public.current_account_id());

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own
  on public.accounts for insert
  with check (account_id = public.current_account_id());

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own
  on public.accounts for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

-- No delete policy for accounts: account deletion is an operational task,
-- intentionally not exposed to the anon/public role.

drop policy if exists blobs_select_own on public.blobs;
create policy blobs_select_own
  on public.blobs for select
  using (account_id = public.current_account_id());

drop policy if exists blobs_insert_own on public.blobs;
create policy blobs_insert_own
  on public.blobs for insert
  with check (account_id = public.current_account_id());

drop policy if exists blobs_delete_own on public.blobs;
create policy blobs_delete_own
  on public.blobs for delete
  using (account_id = public.current_account_id());

-- service_role (used by Edge Functions) bypasses RLS by default in
-- Supabase — no explicit policy needed for the get-upload-url function.
