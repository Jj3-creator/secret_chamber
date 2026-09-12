# Secret Chamber

Zero-knowledge encrypted chamber app. The server never sees a passphrase, a
master key, or plaintext — only a one-way `account_id` hash and opaque
ciphertext blobs.

Built in two completely independent parts (neither waits on the other):

- **[`crypto/`](crypto)** — Part 1: the on-device crypto core (Expo +
  TypeScript). Passphrase generation, key derivation (Argon2id / PBKDF2
  fallback), account ID derivation, AES-256-GCM encrypt/decrypt, and
  best-effort memory wiping. See [crypto/README.md](crypto/README.md).
- **[`backend/`](backend)** — Part 2: Supabase schema (`accounts` +
  `blobs`, RLS) and the `get-upload-url` Edge Function that presigns
  Cloudflare R2 upload URLs. See [backend/README.md](backend/README.md).

## Status

- Part 1: implemented, typechecked, 15/15 tests passing.
- Part 2: implemented; not yet deployed to a live Supabase project (needs
  your Supabase + Cloudflare R2 credentials — see backend/README.md).
