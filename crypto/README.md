# Secret Chamber — Part 1: Crypto & Key Core

Zero-knowledge crypto module for the Secret Chamber Expo app. Everything
here runs on-device; the server never sees a passphrase, a master key, or
plaintext.

Kept in its own folder, independent of [`backend`](../backend) (Part 2).

## File

[`src/services/crypto.ts`](src/services/crypto.ts) — the whole module. Tests
in [`src/services/__tests__/crypto.test.ts`](src/services/__tests__/crypto.test.ts).

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

## Why these libraries

| Concern | Library | Why |
|---|---|---|
| CSPRNG | `expo-crypto` | Native secure RNG, works in managed Expo (`getRandomBytesAsync`). |
| BIP-39 mnemonic | `bip39` | Standard wordlist + checksum. We only call its pure `entropyToMnemonic`, feeding it entropy from expo-crypto — this avoids depending on bip39's own RNG path, so no `react-native-get-random-values` polyfill is needed. |
| SHA-256 / PBKDF2 | `@noble/hashes` | Pure JS, audited, zero native bindings — works in Expo Go, not just a custom dev client. |
| AES-256-GCM | `@noble/ciphers` | Same author/family as noble-hashes; pure JS AEAD, no native crypto module required. |
| Argon2id | `react-native-argon2` (optional) | Requires a native binding, so it only works in a custom dev client / bare workflow, not vanilla Expo Go. Loaded via a guarded `require()` — if it's missing or its native module isn't linked, `deriveMasterKey` transparently falls back to PBKDF2 and still meets the spec's >= 100,000-iteration floor. |

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
npm test          # jest — round-trip + IV-uniqueness + tamper-detection tests
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
