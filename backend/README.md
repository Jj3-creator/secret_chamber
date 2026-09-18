# Secret Chamber — Part 2: Supabase Schema + Edge Function

Zero-knowledge backend: Postgres never sees a passphrase, a master key, or
plaintext — only `account_id` (client-derived SHA-256 hash) and blob
*metadata* (size, timestamps). Ciphertext bytes live in Cloudflare R2, never
in Supabase.

Kept in its own folder, independent of [`crypto`](../crypto) (Part 1).

## Layout

```
backend/
└── supabase/
    ├── migrations/
    │   ├── 0001_init_schema.sql     # accounts + blobs tables, RLS policies
    │   ├── 0002_dms_heartbeat.sql   # Dead Man's Switch heartbeat + guardian shares
    │   └── 0006_dms_notify.sql      # guardian_email + notified_at, for the email reminder below
    └── functions/
        ├── _shared/
        │   └── http.ts              # CORS/json/sha256 helpers (used by the dms-* functions)
        ├── get-upload-url/
        │   ├── index.ts             # presigned R2 PUT URL, 100MB cap
        │   └── deno.json
        ├── dms-setup/
        │   ├── index.ts             # register threshold_hours + wrapped guardian shares
        │   └── deno.json
        ├── dms-heartbeat/
        │   ├── index.ts             # "I'm still here" check-in, pushes back the switch
        │   └── deno.json
        ├── dms-request-share/
        │   ├── index.ts             # a guardian retrieves their wrapped share, once eligible
        │   └── deno.json
        ├── cleanup-inactive-accounts/
        │   ├── index.ts             # deletes accounts (+ R2 blobs) inactive > 1 year
        │   └── deno.json
        └── dms-notify/
            ├── index.ts             # emails eligible guardians a one-time reminder they can now use their token
            └── deno.json
```

## Schema summary

- **`accounts`**: `account_id` (PK, hex SHA-256), `created_at`,
  `last_active_at`, `storage_used_bytes`, `dms_heartbeat_at`,
  `dms_threshold_hours` (the latter two `NULL` until DMS is set up).
- **`blobs`**: `blob_id` (PK, uuid), `account_id` (FK), `file_size_bytes`
  (checked `<= 100MB`), `created_at`.
- **`dms_guardians`**: one row per trusted contact holding one Shamir
  share — `account_id` (FK), `share_index` (1..255, matches
  `vault.ts`'s `ShamirShare.index`), `token_hash` (SHA-256 of a random
  recovery token given to that guardian out-of-band), `wrapped_cipher_text`
  + `wrapped_iv` (the share, AES-256-GCM-wrapped client-side under a key
  only that guardian can derive — the server never sees a usable share),
  `guardian_email` (optional, owner-supplied — the one deliberate PII
  exception, see 0006_dms_notify.sql) and `notified_at` (set once
  dms-notify has emailed this guardian for the current eligibility
  window).
- RLS is enabled on all three tables. See the comment blocks in
  [`0001_init_schema.sql`](supabase/migrations/0001_init_schema.sql) and
  [`0002_dms_heartbeat.sql`](supabase/migrations/0002_dms_heartbeat.sql) for
  the threat model: the primary access-control boundary is that all writes
  go through Edge Functions running as `service_role` (which bypasses RLS);
  `dms_guardians` has no anon/authenticated policies at all — it's reachable
  only via `dms-setup` / `dms-request-share`.

## Dead Man's Switch (DMS) — how the four functions fit together

```
Owner, periodically:        POST dms-heartbeat  { account_id }
                             → pushes dms_heartbeat_at to now()

Owner, once, at setup:      POST dms-setup      { account_id, threshold_hours,
                                                   guardians: [{ share_index, token_hash, wrapped, guardian_email }, ...] }
                             → stores the wrapped shares (+ optional email) + starts the clock

Scheduled, e.g. hourly:     POST dms-notify     { }
                             → for each account past its threshold, emails any
                               still-unnotified guardian who gave an email:
                               "you can use your recovery token now" — never
                               the token itself, which this table never has

Guardian, after silence:    POST dms-request-share { account_id, share_index, token }
                             → 403 not_yet_eligible  until  now() >= dms_heartbeat_at + dms_threshold_hours
                             → 200 { wrapped }        once eligible (still ciphertext!)
```

The client-side pieces (splitting the key, wrapping/unwrapping each share,
generating recovery tokens) are `vault.ts`'s `createRecoveryShares` /
`recoverMasterKeyFromShares` plus its `wrapVaultKey` / `unwrapVaultKey` —
reused as-is, since a Shamir share is just another hex string to wrap under
a key. A recovery token is any sufficiently random string the owner
generates and hands to that guardian out-of-band (print it, say it aloud —
never send it through this backend); the server only ever stores its hash.

**What's server-enforced vs. not:** the *timing* gate (`not_yet_eligible`
until the heartbeat has actually expired, checked against the server's own
clock) is real and can't be bypassed by a lying client. What's **not**
server-enforced — by design, to keep the zero-knowledge property — is
reconstruction itself: once 2 guardians have both received their wrapped
shares and each has unwrapped theirs locally, nothing stops them combining
right there on a guardian's device. The server never sees the plaintext
shares or the reconstructed key at any point.

## Auto-delete after 1 year of inactivity

Feature request: "ถ้าไม่มี entry เกิน 1 ปี ห้องแห่งความลับนี้จะถูกลบทิ้ง
ตลอดกาล ใครก็กู้ไม่ได้". [`cleanup-inactive-accounts`](supabase/functions/cleanup-inactive-accounts/index.ts)
finds every `accounts` row with `last_active_at` older than 365 days,
deletes that account's R2 objects first (`ListObjectsV2` + `DeleteObjects`
under the `<account_id>/` prefix), then the DB row (cascades to `blobs` and
`dms_guardians`) — in that order, so a failed R2 cleanup never leaves an
orphaned, un-owned ciphertext blob with no row pointing at it.

**This is the one genuinely irreversible operation in this backend** —
call it with `{"dry_run": true}` first and read the `results` array before
ever running it for real.

Deploy it **without** `--no-verify-jwt` (unlike every other function
here) — that makes Supabase reject any caller who isn't holding the
`service_role` key, which is exactly who should be allowed to run a mass
account-deletion sweep:

```bash
supabase functions deploy cleanup-inactive-accounts
```

Then schedule it from the Supabase Dashboard: **Database → Cron Jobs →
New Cron Job**, type "Edge Function", target `cleanup-inactive-accounts`,
schedule e.g. `0 3 * * *` (daily at 03:00 UTC). Doing it this way (rather
than a SQL migration wiring up `pg_cron` + `pg_net` by hand) avoids ever
needing to embed the service_role key in a version-controlled file — the
Dashboard's Cron Jobs feature already knows how to invoke your project's
own Edge Functions with the right credentials internally.

Smoke test before scheduling anything:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/cleanup-inactive-accounts" \
  -H "Authorization: Bearer <service_role-key>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

## Auto-notify eligible guardians by email

Feedback: "อยากให้ APP แจ้งเตือน id line และ อีเมล์เลยได้ไม๊" — real,
scheduled email via [Resend](https://resend.com) (free tier: 100
emails/day, no domain verification needed to start — Resend's own shared
`onboarding@resend.dev` sender works immediately). See
[`dms-notify`](supabase/functions/dms-notify/index.ts)'s own header
comment for the full reasoning, especially why **LINE isn't included**
(LINE Notify — the only way to message an arbitrary LINE user without
them first friending a dedicated Official Account — was shut down by
LINE in March 2025; real LINE delivery now needs a full Official Account
+ Messaging API integration, left for later) and why this is safe even
though it's a new exception to "no PII server-side": the email is a
*reminder* to use a token the guardian must already hold out-of-band —
the raw token is never stored here, so a server compromise still can't
recover anyone's vault from this table alone.

Deploy it the same way as `cleanup-inactive-accounts` — **without**
`--no-verify-jwt`, so only a `service_role`-authenticated caller can
invoke it:

```bash
supabase functions deploy dms-notify
```

Set the Resend API key as a secret first (never committed, never sent to
the client — the app itself never calls this function):

```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
```

Then schedule it the same way: **Database → Cron Jobs → New Cron Job**,
type "Edge Function", target `dms-notify`, schedule e.g. `0 * * * *`
(hourly — more frequent than `cleanup-inactive-accounts` makes sense here
since eligibility windows can be as short as a day).

Smoke test before scheduling:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/dms-notify" \
  -H "Authorization: Bearer <service_role-key>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

Expect `{ dry_run: true, eligible_accounts, pending_guardians, notified: 0, results: [...] }` —
read `pending_guardians`/`results` before ever running it for real (i.e.
without `dry_run`), same caution as `cleanup-inactive-accounts`.

## Prerequisites

```bash
npm install -g supabase
supabase login
```

You'll also need a Cloudflare R2 bucket and an R2 API token (Account Home →
R2 → Manage API Tokens) with Object Read & Write permissions on that bucket,
and (only if deploying `dms-notify`) a free [Resend](https://resend.com)
account + API key (Dashboard → API Keys → Create API Key).

## Deploy

1. **Link the project** (run once, from `backend/`):

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

2. **Apply the schema migration:**

   ```bash
   supabase db push
   ```

   (Or `supabase migration up` if you're managing migrations locally against
   `supabase start` first.)

3. **Set the Edge Function secrets** (R2 credentials — `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are injected automatically, don't set those):

   ```bash
   cp .env.example .env
   # fill in R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
   supabase secrets set --env-file .env
   # only if deploying dms-notify:
   supabase secrets set RESEND_API_KEY=re_your_key_here
   ```

4. **Deploy the functions.** Because this app has no Supabase Auth session
   (zero-knowledge, no login), pass `--no-verify-jwt` so calls authenticated
   only by the anon API key are accepted:

   ```bash
   supabase functions deploy get-upload-url --no-verify-jwt
   supabase functions deploy dms-setup --no-verify-jwt
   supabase functions deploy dms-heartbeat --no-verify-jwt
   supabase functions deploy dms-request-share --no-verify-jwt
   supabase functions deploy cleanup-inactive-accounts
   supabase functions deploy dms-notify
   ```

   (Note: `cleanup-inactive-accounts` and `dms-notify` are deployed
   *without* `--no-verify-jwt` — see their own sections below for why,
   and for the one-time Dashboard step to actually schedule each.)

5. **Smoke test:**

   ```bash
   curl -X POST \
     "https://<project-ref>.supabase.co/functions/v1/get-upload-url" \
     -H "Authorization: Bearer <anon-key>" \
     -H "Content-Type: application/json" \
     -d '{"account_id":"'"$(printf 'a%.0s' {1..64})"'","file_size_bytes":1048576}'
   ```

   Expect a `200` with `{ blob_id, upload_url, object_key, expires_in }`.
   A `file_size_bytes` over `104857600` should come back `413 file_too_large`.

   For the DMS functions, `dms-request-share` should come back
   `403 not_yet_eligible` immediately after `dms-setup`/`dms-heartbeat`
   (the whole point), and only return the wrapped share once
   `threshold_hours` has actually elapsed.

## Local development

```bash
supabase start                # local Postgres + Studio
supabase functions serve get-upload-url --env-file .env --no-verify-jwt
supabase functions serve dms-setup --env-file .env --no-verify-jwt
supabase functions serve dms-heartbeat --env-file .env --no-verify-jwt
supabase functions serve dms-request-share --env-file .env --no-verify-jwt
```

## Notes / things to revisit before production

- **R2 CORS**: configure the bucket's CORS policy to allow `PUT` from your
  app's origin(s) so the client can actually use the presigned URL.
- **Per-account quota**: `storage_used_bytes` is tracked but not currently
  enforced as a hard cap — add a check against a quota constant in
  `index.ts` if you want to reject uploads once an account exceeds it.
- **Rate limiting**: none of the functions rate-limit themselves; put them
  behind Supabase's platform-level rate limits or a WAF rule if abuse
  becomes a concern — `dms-request-share` in particular is a token-guessing
  target and would benefit from one.
- **`dms-setup` replace-all semantics**: re-running it for an account wipes
  and replaces that account's entire guardian set (see the comment in
  `dms-setup/index.ts`). Fine for "redo my DMS setup"; not something to call
  incidentally.
- **Guardian redemption screen** (`crypto/src/screens/onboarding/RedeemScreen.tsx`,
  reachable from Welcome): a guardian pastes in the combined recovery code
  DMSSetupScreen's reveal screen now generates (`account_id:share_index:
  threshold:token`, one string instead of three separate pieces to
  communicate) and this calls `dms-request-share` for them. Threshold 1 —
  solo guardian, or "any one of N" — unwraps straight to the master key
  and re-joins onboarding at SetPin, same as 12-word recovery. Threshold
  >= 2 ("all must agree") only ever unwraps to ONE Shamir share per code;
  the screen accumulates shares in memory across multiple pasted codes in
  the same session until there are enough to combine — real coordination
  between separate guardians on separate devices still has to happen
  out-of-band, same as the codes themselves.
- **No LINE notification**: see `dms-notify/index.ts`'s own header comment
  — LINE Notify (the only way to do this without a full Official Account +
  Messaging API integration) was shut down by LINE in March 2025.
- **PDPA consent / liability-waiver copy is NOT legal advice**: the
  Warning screen's acknowledgment checkboxes (in `crypto/`) include draft
  wording about the 1-year auto-delete and data-handling consent. That
  text was written by an AI assistant, not reviewed by a lawyer — have
  one review it (Thailand's PDPA specifically) before relying on it in
  production. A checkbox cannot waive liability the law doesn't allow a
  business to waive, regardless of what it says.
