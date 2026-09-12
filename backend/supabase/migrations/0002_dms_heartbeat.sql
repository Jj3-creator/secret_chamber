-- Secret Chamber — Dead Man's Switch (DMS) heartbeat + guardian shares
-- =======================================================================
-- Backs the crypto/src/services/vault.ts Shamir 2-of-3 primitives with
-- server-enforced *timing*: a guardian can only retrieve their share once
-- the account's heartbeat has actually expired, verified against the
-- server's own clock — a client can't just claim "48 hours have passed".
--
-- Zero-knowledge property preserved: the server never holds enough to
-- reconstruct the master key on its own.
--   - Each guardian's share is wrapped (AES-256-GCM) client-side under a
--     key derived from THAT GUARDIAN'S OWN passphrase/PIN (via
--     crypto.ts's deriveMasterKey + vault.ts's wrapVaultKey) before ever
--     reaching the server — the server only ever sees ciphertext.
--   - Even if the server released all 3 wrapped shares to itself, it
--     would still need 2 guardians' passphrases to unwrap them before it
--     could even attempt Shamir reconstruction.
--   - A guardian authenticates to fetch their own share with a random
--     recovery token (given to them out-of-band by the account owner,
--     e.g. a printed card) — the server stores only SHA-256(token), the
--     same "capability token" pattern as account_id in 0001_init_schema.sql.

alter table public.accounts
  add column if not exists dms_heartbeat_at timestamptz,
  add column if not exists dms_threshold_hours integer
    check (dms_threshold_hours is null or dms_threshold_hours >= 1);

comment on column public.accounts.dms_heartbeat_at is
  'Last "I''m still here" check-in. NULL = Dead Man''s Switch not configured for this account.';
comment on column public.accounts.dms_threshold_hours is
  'Hours of silence after dms_heartbeat_at before guardians may request their share. NULL = DMS not configured.';

create table if not exists public.dms_guardians (
  id                uuid primary key default gen_random_uuid(),
  account_id        text not null references public.accounts(account_id) on delete cascade,
  -- Matches the Shamir ShareIndex (x-coordinate) from vault.ts's
  -- createRecoveryShares() — 1..255, unique per account.
  share_index       smallint not null check (share_index between 1 and 255),
  -- SHA-256 hex of a random recovery token the owner hands this guardian
  -- out-of-band. Never the guardian's real identity — no PII.
  token_hash        text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  -- AES-256-GCM(shareValueHex) under a key only this guardian can derive
  -- (their own passphrase/PIN) — opaque to the server.
  wrapped_cipher_text text not null,
  wrapped_iv          text not null,
  created_at        timestamptz not null default now(),

  unique (account_id, share_index),
  unique (token_hash)
);

comment on table public.dms_guardians is
  'One row per trusted contact holding one Shamir share of an account''s '
  'master key. The share value itself is always AES-GCM-wrapped by that '
  'guardian''s own key before it reaches this table — this server never '
  'sees a usable share.';

create index if not exists idx_dms_guardians_account_id on public.dms_guardians (account_id);

alter table public.dms_guardians enable row level security;

-- No anon/authenticated policies, by design: all access to this table
-- goes through the dms-setup / dms-request-share Edge Functions running
-- as service_role (which bypasses RLS). See backend/README.md.
