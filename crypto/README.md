# Secret Chamber — Part 1: Crypto & Key Core

Zero-knowledge crypto module for the Secret Chamber Expo app. Everything
here runs on-device; the server never sees a passphrase, a master key, or
plaintext.

Kept in its own folder, independent of [`backend`](../backend) (Part 2).

## Files

- [`src/services/crypto.ts`](src/services/crypto.ts) — core spec: passphrase, key derivation, account ID, AES-256-GCM encrypt/decrypt.
- [`src/services/shamir.ts`](src/services/shamir.ts) — general-purpose k-of-n Shamir's Secret Sharing over GF(256).
- [`src/services/vault.ts`](src/services/vault.ts) — built on the two above: **Decoy PIN** (real/decoy vault unlock) and **Dead Man's Switch recovery** (2-of-3 guardian shares), matching the "Onboarding / Register" and decision-point notes in the design.

Tests: [`crypto.test.ts`](src/services/__tests__/crypto.test.ts), [`shamir.test.ts`](src/services/__tests__/shamir.test.ts), [`vault.test.ts`](src/services/__tests__/vault.test.ts) — 36 tests total.

## API

```ts
generatePassphrase(): Promise<string>
// 12-word BIP-39 mnemonic (128 bits of entropy, from expo-crypto's CSPRNG).

deriveMasterKey(passphrase: string, existingSaltHex?: string): Promise<{
  masterKeyHex: string;
  saltHex: string;
  kdf: 'argon2id' | 'pbkdf2-sha256';
  iterations?: number; // only set for pbkdf2-sha256
}>
// Argon2id if a stable native binding is available, else PBKDF2-HMAC-SHA256
// (>= 100,000 iterations) with a random salt. Pass the salt back in on a
// later login to re-derive the identical key from the same passphrase.

deriveAccountId(masterKeyHex: string): string
// SHA-256(masterKey), hex. The ONLY identifier ever sent to the server.

encryptData(data: string, masterKeyHex: string): Promise<{ cipherText: string; iv: string }>
// AES-256-GCM, fresh random 96-bit IV every call. Both fields base64.

decryptData(cipherText: string, iv: string, masterKeyHex: string): Promise<string>
// Throws if the GCM auth tag doesn't verify (wrong key/IV or tampering).
```

## Decoy PIN & Dead Man's Switch (vault.ts)

```ts
// Decoy PIN: real PIN and decoy PIN each unlock a different vault from the
// same keypad. Both wrapped blobs exist on disk unconditionally.
setupDualPin(realMasterKeyHex: string, realPin: string, decoyPin: string): Promise<DualPinSetup>
unlockWithPin(pin: string, setup: DualPinSetup): Promise<{ vault: 'real' | 'decoy'; masterKeyHex: string } | null>

// Dead Man's Switch: split a master key 2-of-3 across trusted contacts.
createRecoveryShares(masterKeyHex: string, options?: { guardians: number; threshold: number }): Promise<RecoveryShareSet>
recoverMasterKeyFromShares(shares: ShamirShare[]): string
```

**Decoy PIN** — `setupDualPin` derives a PIN-keyed wrapping key for each PIN
(via the same Argon2id/PBKDF2 pipeline as `deriveMasterKey`, since a PIN is
just lower-entropy input to the same KDF) and uses it to AES-256-GCM-wrap
each vault's master key. `unlockWithPin` attempts **both** unwraps
unconditionally on every call — it never short-circuits after the first
match — so which vault matched isn't observable from *which check ran*,
only from the result. This is best-effort: JS gives no hard real-time
guarantee, and the underlying GCM tag-comparison timing is outside this
module's control.

**Dead Man's Switch** — `createRecoveryShares` splits the real master key
into `guardians` Shamir shares (default 3), any `threshold` of which
(default 2) reconstruct it via `recoverMasterKeyFromShares`. Shamir's
guarantee: a lone share reveals *zero* information about the key
(information-theoretic, not just "hard to brute-force") — so handing raw
shares to guardians is safe on its own.

**What this does NOT do**: enforce *when* guardians are allowed to combine
their shares (the design's heartbeat/48h waiting window). A client holding
2 shares can call `recoverMasterKeyFromShares` the instant it has them —
gating that on an actual elapsed heartbeat has to happen server-side (e.g.
the backend only hands a guardian their share via an API call after it
verifies the account's heartbeat has expired). That backend piece isn't
built yet.

**Not yet implemented** (seen in the design but out of scope for this pass):
High-Sensitivity double-encryption vaults with thumbnail-level locking.

## Why these libraries

| Concern | Library | Why |
|---|---|---|
| CSPRNG | `expo-crypto` | Native secure RNG, works in managed Expo (`getRandomBytesAsync`). |
| BIP-39 mnemonic | `bip39` | Standard wordlist + checksum. We only call its pure `entropyToMnemonic`, feeding it entropy from expo-crypto — this avoids depending on bip39's own RNG path, so no `react-native-get-random-values` polyfill is needed. |
| SHA-256 / PBKDF2 | `@noble/hashes` | Pure JS, audited, zero native bindings — works in Expo Go, not just a custom dev client. |
| AES-256-GCM | `@noble/ciphers` | Same author/family as noble-hashes; pure JS AEAD, no native crypto module required. |
| Argon2id | `react-native-argon2` (optional) | Requires a native binding, so it only works in a custom dev client / bare workflow, not vanilla Expo Go. Loaded via a guarded `require()` — if it's missing or its native module isn't linked, `deriveMasterKey` transparently falls back to PBKDF2 and still meets the spec's >= 100,000-iteration floor. |
| Shamir's Secret Sharing | hand-rolled in `shamir.ts` | GF(256) arithmetic + Lagrange interpolation, no external dependency. The field parameters (reduction polynomial 0x11D, generator 2) were verified numerically to have full multiplicative order 255 before writing the TS — see the comment at the top of the file. |

## Zero memory traces — what this actually guarantees

JavaScript gives no hard guarantee that a dereferenced value is
unrecoverable (strings are immutable; the GC decides if/when backing memory
is reclaimed or reused). This module does the best available mitigation:

- Secret material is kept in mutable `Uint8Array`s, not strings, wherever
  the underlying library allows it, so it can be overwritten in place.
- Every key/plaintext/IV buffer is zero-filled (`.fill(0)`) in a `finally`
  block immediately after use, even if the surrounding call throws.
- Nothing secret is logged, cached, or copied further than necessary.

`masterKeyHex` is still a JS string at the API boundary (per the function
signatures in the spec) and strings can't be zeroed in place — treat it as
short-lived: derive it, use it immediately, and let the reference go out of
scope. Don't persist `masterKeyHex` itself; if you need to keep the key
around between app launches, re-derive it from the passphrase (via
`deriveMasterKey(passphrase, savedSaltHex)`) rather than storing the key.

## Install & test

```bash
npm install
npm test          # jest — round-trip + IV-uniqueness + tamper-detection + Shamir + Decoy PIN/DMS tests
npm run typecheck  # tsc --noEmit
```

`expo-crypto`'s native module doesn't exist under plain Jest/Node, so
`jest.config.js` maps it to a Node-`crypto`-backed mock
(`src/services/__mocks__/expo-crypto.ts`) that's equivalent for test
purposes — cryptographically strong random bytes of a given length. The
mock is wired in for tests only; app code always uses the real
`expo-crypto`.

## Using Argon2id instead of the PBKDF2 fallback

```bash
npx expo install react-native-argon2
npx expo prebuild   # Argon2id needs a native binding — Expo Go can't load it
```

With that installed and prebuilt, `deriveMasterKey` picks it up
automatically (no code change) and `kdf` comes back as `'argon2id'`.
