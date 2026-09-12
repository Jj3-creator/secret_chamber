# Secret Chamber

Zero-knowledge encrypted chamber app. The server never sees a passphrase, a
master key, or plaintext — only a one-way `account_id` hash and opaque
ciphertext blobs.

Built in two completely independent parts (neither waits on the other):

- **[`crypto/`](crypto)** — Part 1: the on-device crypto core (Expo +
  TypeScript). Passphrase generation, key derivation (Argon2id / PBKDF2
  fallback), account ID derivation, AES-256-GCM encrypt/decrypt,
  best-effort memory wiping, Decoy PIN, and Dead Man's Switch (Shamir
  2-of-3) recovery. See [crypto/README.md](crypto/README.md).
- **[`backend/`](backend)** — Part 2: Supabase schema (`accounts` +
  `blobs`, RLS) and the `get-upload-url` Edge Function that presigns
  Cloudflare R2 upload URLs. See [backend/README.md](backend/README.md).

## Design

UI/UX flow lives in a separate Claude Design canvas ("Secret Chamber Flow",
16 screens, dark neutral, mobile) — not wired to this code yet. Onboarding
(passphrase generation + confirmation) already maps directly onto
`crypto.ts`. Decoy PIN and DMS 2-of-3 primitives now exist in `vault.ts` to
back the corresponding decision points in that design. Still open: wiring
actual React Native screens to these functions, High-Sensitivity
double-encryption vaults, and server-side heartbeat gating for DMS share
release.

## Status

- Part 1: implemented, typechecked, 36/36 tests passing (crypto + Shamir + Decoy PIN/DMS).
- Part 2: implemented AND deployed — schema pushed, secrets set, `get-upload-url`
  live on the SecretChamber Supabase project, smoke-tested end-to-end
  (presigned R2 URL issued, 100MB cap enforced, DB rows verified).
