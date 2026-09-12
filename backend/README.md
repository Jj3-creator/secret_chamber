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
    │   └── 0001_init_schema.sql   # accounts + blobs tables, RLS policies
    └── functions/
        └── get-upload-url/
            ├── index.ts           # presigned R2 PUT URL, 100MB cap
            └── deno.json
```

## Schema summary

- **`accounts`**: `account_id` (PK, hex SHA-256), `created_at`,
  `last_active_at`, `storage_used_bytes`.
- **`blobs`**: `blob_id` (PK, uuid), `account_id` (FK), `file_size_bytes`
  (checked `<= 100MB`), `created_at`.
- RLS is enabled on both tables. See the comment block in
  [`0001_init_schema.sql`](supabase/migrations/0001_init_schema.sql) for the
  threat model: the primary access-control boundary is that all writes go
  through the `get-upload-url` function running as `service_role` (which
  bypasses RLS); the `x-account-id`-header policies are a secondary,
  defense-in-depth layer for any direct table reads.

## Prerequisites

```bash
npm install -g supabase
supabase login
```

You'll also need a Cloudflare R2 bucket and an R2 API token (Account Home →
R2 → Manage API Tokens) with Object Read & Write permissions on that bucket.

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
   ```

4. **Deploy the function.** Because this app has no Supabase Auth session
   (zero-knowledge, no login), pass `--no-verify-jwt` so calls authenticated
   only by the anon API key are accepted:

   ```bash
   supabase functions deploy get-upload-url --no-verify-jwt
   ```

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

## Local development

```bash
supabase start                # local Postgres + Studio
supabase functions serve get-upload-url --env-file .env --no-verify-jwt
```

## Notes / things to revisit before production

- **R2 CORS**: configure the bucket's CORS policy to allow `PUT` from your
  app's origin(s) so the client can actually use the presigned URL.
- **Per-account quota**: `storage_used_bytes` is tracked but not currently
  enforced as a hard cap — add a check against a quota constant in
  `index.ts` if you want to reject uploads once an account exceeds it.
- **Rate limiting**: the function has no rate limiting of its own; put it
  behind Supabase's platform-level rate limits or a WAF rule if abuse
  becomes a concern.
