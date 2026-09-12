# Secret Chamber — Part 1: Crypto & Key Core

Zero-knowledge crypto module for the Secret Chamber Expo app. Everything
here runs on-device; the server never sees a passphrase, a master key, or
plaintext.

Kept in its own folder, independent of [`backend`](../backend) (Part 2).

## Files

- [`src/services/crypto.ts`](src/services/crypto.ts) — core spec: passphrase, key derivation, account ID, AES-256-GCM encrypt/decrypt.
- [`src/services/shamir.ts`](src/services/shamir.ts) — general-purpose k-of-n Shamir's Secret Sharing over GF(256).
- [`src/services/vault.ts`](src/services/vault.ts) — built on the two above: **Decoy PIN** (real/decoy vault unlock) and **Dead Man's Switch recovery** (2-of-3 guardian shares), matching the "Onboarding / Register" and decision-point notes in the design.
- [`src/screens/onboarding/`](src/screens/onboarding), [`src/navigation/`](src/navigation), [`src/components/`](src/components), [`src/theme/`](src/theme) — real, working Onboarding UI (see below).
- [`src/screens/vault/VaultHomeScreen.tsx`](src/screens/vault/VaultHomeScreen.tsx) — screen 3.1, Vault Dashboard home (see below).
- [`src/components/icons/`](src/components/icons), [`src/components/IconBadge.tsx`](src/components/IconBadge.tsx) — hand-drawn line icons (`react-native-svg`) in a soft gradient badge (`expo-linear-gradient`). Added after feedback that the empty bordered-square placeholders read as too stark/empty ("looks like a funeral") — real icons + a subtle glow give depth without breaking the design's deliberately plain, camouflaged tone.
- [`src/services/backend.ts`](src/services/backend.ts) — thin `fetch` client for the deployed backend (Part 2): reads an account's own row via PostgREST + RLS, and calls `dms-heartbeat`.
- [`src/services/wordlists/thai.ts`](src/services/wordlists/thai.ts) — a custom 2048-word Thai wordlist (BIP-39 has no official one) — see "Passphrase language" below.
- [`src/screens/onboarding/PersonalizeScreen.tsx`](src/screens/onboarding/PersonalizeScreen.tsx), [`src/services/localProfile.ts`](src/services/localProfile.ts), [`src/components/avatars/`](src/components/avatars) — nickname + avatar + room-color personalization, stored **on-device only** (`AsyncStorage`, keyed by account_id) — see "Personalization" below.
- [`src/polyfills.ts`](src/polyfills.ts) — must stay the first import in `App.tsx` (see "A real bug this caught" below).

Tests: [`crypto.test.ts`](src/services/__tests__/crypto.test.ts), [`shamir.test.ts`](src/services/__tests__/shamir.test.ts), [`vault.test.ts`](src/services/__tests__/vault.test.ts), [`thai-wordlist.test.ts`](src/services/__tests__/thai-wordlist.test.ts) — 45 tests total. Plus an opt-in [`live-integration.test.ts`](src/services/__tests__/live-integration.test.ts) against the real deployed backend (see its header comment).

## Passphrase language (Thai / English)

Feedback: some Thai users aren't comfortable reading English. BIP-39 has
no official Thai wordlist though (only English, Japanese, Korean,
Spanish, Chinese Simplified/Traditional, French, Italian, Czech,
Portuguese) — the algorithm only needs *some* array of exactly 2048
distinct strings, it doesn't care what they are, so
[`wordlists/thai.ts`](src/services/wordlists/thai.ts) builds one as the
cross-product of 64 common nouns × 32 common adjectives (e.g. "แมว" cat +
"แดง" red → "แมวแดง"). That makes it 96 words to review for quality/
duplicates instead of 2048, and duplicates in the final 2048 are
mathematically impossible as long as the two source lists are
duplicate-free (checked at import time and by the test suite). This list
has **not** had an independent native-speaker linguistic review — treat
it as a solid first pass, not a final audited wordlist.

`generatePassphrase(language: 'th' | 'en' = 'en')` in crypto.ts picks the
wordlist; a language toggle on the Welcome screen (chosen once, stored in
`OnboardingContext`) drives it, and Confirm's autocomplete switches
wordlists to match.

## Passphrase export policy (screenshot / copy / print)

Originally the design explicitly disabled screenshots and offered no
copy button ("จดลงกระดาษ ไม่ถ่ายภาพ") — enforced only as a text claim,
never actually implemented (there's no `expo-screen-capture` call in this
codebase, so screenshots were never really blocked, especially not on
web, where a page can't block the OS screenshot tool regardless).

Per feedback, this is now reversed deliberately: a **คัดลอก** (copy, via
`expo-clipboard`) button and a working **พิมพ์แผ่นสำรอง** (print backup
sheet, via `expo-print`'s native print dialog) button on the Passphrase
screen, plus a prominent disclaimer (styled like the warning box) stating
the app stores nothing and isn't responsible for leaks from the user
copying/printing/screenshotting the passphrase elsewhere — printed onto
the backup sheet itself too. The Warning screen's middle checkbox was
reworded to match (own-risk acknowledgment instead of a photo/cloud ban).

## Personalization (nickname, avatar, room theme)

Not part of the original design — added per feedback: "มี element ให้เลือก
ใส่รูป avatar ... และ theme ห้อง". A new screen between Confirm and Done
lets the owner pick a nickname, one of 6 line-art animal/flower avatars
([`components/avatars/`](src/components/avatars)), and one of 5 accent
colors ([`theme/roomThemes.ts`](src/theme/roomThemes.ts)). Saved via
[`localProfile.ts`](src/services/localProfile.ts) — `AsyncStorage`,
keyed by `account_id`, **never sent to the server** (a nickname is
exactly the kind of identifying detail the zero-knowledge, no-PII design
has no business collecting). VaultHome then shows "ห้องลับของ{nickname}"
with the chosen avatar + accent color instead of the generic "ห้องของฉัน".

**Not done as part of this pass** (flagged, not started — see the four
open feature areas noted in git history/PR discussion around this
commit): SMS/LINE emergency-contact notifications (needs a third-party
provider + API keys from the project owner), 1-year auto-delete +
PDPA-consent text (auto-delete is buildable; the legal wording needs a
lawyer's review before relying on it), and a usage/activity dashboard
(needs new per-category + access-log backend schema).

## Onboarding screens (screens 1.1–1.4 of the design)

Real, working React Native screens wired to the actual crypto functions above — not a mockup:

```
Welcome → Warning (3 acknowledgement checkboxes gate the button) →
Passphrase (real generatePassphrase(), hide/reveal, 3 random confirm
positions picked) → Confirm (3 word inputs w/ BIP-39 autocomplete,
validates against the real passphrase, then calls deriveMasterKey +
deriveAccountId and drops the passphrase from memory) → Done (shows the
real derived account_id, then a temporary shortcut button straight into
VaultHome — screens 1.5 and section 02 Login/Unlock aren't built yet)
```

The in-progress passphrase lives only in [`OnboardingContext`](src/screens/onboarding/OnboardingContext.tsx) (React state), never in a navigation route param — route params can end up in devtools/persisted nav state, which the "zero memory traces" design explicitly wants to avoid. `clear()` drops it the moment Confirm succeeds.

**Verified by actually running it**, not just `tsc`: `npx expo start --web` via this repo's `.claude/launch.json`, driven through the whole flow in a real browser (Welcome → Warning → Passphrase → Confirm → Done), checking the rendered account_id was a real, correctly-formatted 64-hex-char SHA-256 digest.

### A real bug this caught

Running the actual app surfaced something `npm test` couldn't: `bip39` uses Node's **global** `Buffer` internally, which neither a browser nor React Native provides by default. `generatePassphrase()` threw `ReferenceError: Buffer is not defined` the first time it ran for real — the Jest suite never caught this because Node (Jest's test environment) already has a real global `Buffer`, masking the gap. Fixed by [`src/polyfills.ts`](src/polyfills.ts), imported first in `App.tsx`. If you ever restructure the entry point, keep that import first.

## DMS Setup (feature B — real crypto + real backend, no real SMS/LINE)

Feature request: notify a phone/LINE contact after too much inactivity.
[`DMSSetupScreen.tsx`](src/screens/onboarding/DMSSetupScreen.tsx) is an
optional step (Personalize → DMS Setup → Done) covering the check-in
period + 2-3 guardians from design screens 1.5/5.1/5.2, combined into one
screen since those aren't separately built.

**Real**: `vault.ts`'s `createRecoveryShares` splits the master key,
`wrapVaultKey` wraps each share, `backend.ts`'s `setupDms` calls the
actual deployed `dms-setup` function — the same one tested in Part 2.
Guardian key design: rather than requiring each guardian to have their
own pre-existing app account/PIN, a random recovery token generated here
**is** the guardian's credential — it both authenticates their
`dms-request-share` call and (via `deriveMasterKey`) derives the key that
unwraps their share. The owner hands this token over out-of-band (print
it, say it) — the token is shown once, on a reveal screen styled like the
passphrase reveal, with the same "own risk if you screenshot/copy it"
framing.

**Not real**: actually sending that token by SMS or LINE. That needs a
third-party provider (Twilio, LINE Messaging API) and API keys this
session doesn't have — the screen says so explicitly rather than
pretending to send anything.

Verified live against the real backend: submitted 2 guardians + a 30-day
period, got back two distinct 64-hex-char tokens, confirmed VaultHome
then showed "ครบกำหนดอีก 30 วัน" and an enabled check-in button (both were
showing the "not configured" state before this ran) — then deleted the
test account.

## The full design (all 16 screens)

The Claude Design canvas ("Secret Chamber Flow") turned out to have a
compiled `Secret Chamber Flow.html` export covering everything — not just
the Onboarding section screenshotted earlier. Full breakdown, section by
section:

1. **Onboarding / Register** (5 screens, not 4) — 1.1 Welcome, 1.2 Warning,
   1.3 12-word passphrase, 1.4 Confirm, **1.5 Set Real + Decoy PIN** (not
   built yet — maps directly to `vault.ts`'s `setupDualPin`).
2. **Login / Unlock** (3 screens) — 2.1 PIN keypad, 2.2 Passphrase-based
   recovery unlock, 2.3 Decoy Chamber result screen. Not built yet.
3. **Vault Dashboard** (2 screens) — 3.1 Home (**built**, see below), 3.2
   second-layer PIN lock for the High-Sensitivity category. Not built yet.
4. **Upload / View item** (3 screens) — category file list, upload sheet,
   temporary-decrypt file viewer. Not built yet.
5. **Settings** (3 screens) — all settings, DMS recipients & conditions
   (confirms the design wants exactly the 2-of-3 Shamir threshold and a
   staged D-3/D-1/D-0 warning schedule before releasing shares — matches
   what `backend/`'s DMS Edge Functions already implement), change-PIN.
   Not built yet.

## Vault Home (screen 3.1)

[`VaultHomeScreen.tsx`](src/screens/vault/VaultHomeScreen.tsx) — reachable
from the Done screen's temporary shortcut button. Split of real vs. mock:

- **Real**: storage used/remaining (via `backend.ts`'s `getAccountStatus`,
  a direct PostgREST read gated by the `accounts_select_own` RLS policy —
  verified with curl that a mismatched `x-account-id` header is blocked
  before wiring the UI to it) and the Dead Man's Switch check-in card
  (`sendHeartbeat`, hits the real deployed `dms-heartbeat` function —
  verified server-side that the timestamp actually advances after tapping
  the button).
- **Mock**: the 6 category rows (Personal Memory Vault, Critical
  Documents, Health & Sensitive Personal, Ethical Will/Legacy,
  High-Sensitivity Content, Decoy Chamber) — the backend has no
  per-category schema yet (`blobs` isn't grouped), so these mirror the
  design's example file counts/sizes verbatim. Tapping one shows a
  placeholder alert.

Verified end-to-end against the live backend: ran onboarding twice to get
two real `account_id`s, confirmed a fresh account shows 0/100MB and "DMS
not configured", then called `dms-setup` directly for one account and
confirmed VaultHome rendered the correct day count (336h → "14 วัน") and
that tapping "เช็คอิน" genuinely advanced `dms_heartbeat_at` server-side
(checked via a direct table read, not just the UI). Both test accounts
were deleted afterward.

### Try it yourself

```bash
npx expo start --web
```

(Needs `@expo/metro-runtime`, `react-native-web`, `react-dom` — already in `package.json`. If `expo start --web` hangs on "Fetching bundled native modules from the server" in a network-restricted environment, run with `EXPO_OFFLINE=1`.)

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
