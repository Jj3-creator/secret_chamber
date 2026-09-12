/**
 * crypto.ts — Secret Chamber Zero-Knowledge Crypto Core
 * =====================================================
 *
 * Everything in this module runs on-device. The server NEVER sees the
 * passphrase, the master key, or plaintext — only `account_id` (a public,
 * one-way hash of the master key) and opaque ciphertext ever leave the device.
 *
 * Pipeline:
 *   passphrase (BIP-39, 12 words)
 *     -> deriveMasterKey()   [Argon2id, falls back to PBKDF2-HMAC-SHA256]
 *     -> deriveAccountId()   [SHA-256(masterKey), safe to send to server]
 *     -> encryptData() / decryptData()  [AES-256-GCM, fresh 96-bit IV each call]
 *
 * "Zero memory traces": JavaScript engines give us no hard guarantee that a
 * value is unrecoverable once dereferenced (strings are immutable and the GC
 * decides when/if backing memory is actually reclaimed or reused). What we
 * *can* do, and do here, is:
 *   - keep every secret in a mutable Uint8Array instead of a string wherever
 *     possible, so it can be overwritten in place,
 *   - zero-fill (`wipe`) every key/plaintext buffer in a `finally` block the
 *     instant we're done with it, even if an error was thrown,
 *   - never log, cache, or spread secret material into new copies.
 * This is best-effort defense-in-depth, not a cryptographic guarantee — note
 * it explicitly wherever this module is relied on for compliance claims.
 */

import * as ExpoCrypto from 'expo-crypto';
import { Buffer } from 'buffer';
import * as bip39 from 'bip39';
import { sha256 } from '@noble/hashes/sha256';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { gcm } from '@noble/ciphers/aes';
import { THAI_WORDLIST } from './wordlists/thai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 128-bit entropy -> 12-word BIP-39 mnemonic. */
const MNEMONIC_ENTROPY_BYTES = 16;
/** AES-256 key length. */
const KEY_BYTES = 32;
/** Salt for key derivation. */
const SALT_BYTES = 16;
/** AES-GCM nonce — spec requires a fresh random 96-bit IV every call. */
const IV_BYTES = 12;
/** Floor mandated by the spec when Argon2id isn't available. */
const PBKDF2_MIN_ITERATIONS = 100_000;
/** What we actually use (>= the floor above). */
const PBKDF2_ITERATIONS = 120_000;

const ARGON2ID_PARAMS = {
  iterations: 3,
  memory: 65536, // 64 MB, in KiB — OWASP-recommended floor for Argon2id
  parallelism: 1,
  hashLength: KEY_BYTES,
  mode: 'argon2id' as const,
};

export type KdfAlgorithm = 'argon2id' | 'pbkdf2-sha256';

/**
 * Master key handed back to callers. `keyHex` is what you pass into
 * deriveAccountId / encryptData / decryptData. `saltHex` is NOT secret —
 * persist it locally (e.g. SecureStore) so the same key can be re-derived
 * from the passphrase next time; it never needs to reach the server.
 */
export interface MasterKeyResult {
  masterKeyHex: string;
  saltHex: string;
  kdf: KdfAlgorithm;
  iterations?: number; // only set for pbkdf2-sha256
}

export interface EncryptedPayload {
  /** base64-encoded AES-256-GCM ciphertext (includes the 16-byte auth tag). */
  cipherText: string;
  /** base64-encoded 96-bit IV, unique per call. */
  iv: string;
}

// ---------------------------------------------------------------------------
// Zero-memory-trace helpers
// ---------------------------------------------------------------------------

/** Best-effort in-place zeroing of a byte buffer. Safe to call on undefined. */
function wipe(bytes?: Uint8Array | null): void {
  if (bytes && bytes.length) bytes.fill(0);
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------------------
// 1. generatePassphrase — 12-word BIP-39 mnemonic
// ---------------------------------------------------------------------------

export type PassphraseLanguage = 'en' | 'th';

/**
 * A random hex token — used e.g. as a DMS guardian's recovery credential
 * (see vault.ts / dms-setup): both what authenticates their
 * dms-request-share call (server stores only its SHA-256) and, derived
 * through deriveMasterKey, the key that unwraps their Shamir share.
 * Default 32 bytes (256 bits) — far more entropy than needed, cheap to afford.
 */
export async function generateRandomToken(byteLength = 32): Promise<string> {
  const bytes = await ExpoCrypto.getRandomBytesAsync(byteLength);
  try {
    return bytesToHex(bytes);
  } finally {
    wipe(bytes);
  }
}

/**
 * Generates a random 12-word BIP-39-style mnemonic passphrase (128 bits of
 * entropy). Entropy is sourced from expo-crypto's CSPRNG, not from bip39's
 * own RNG, so no `react-native-get-random-values` polyfill is required.
 *
 * `language: 'th'` uses a custom 2048-word Thai wordlist (see
 * wordlists/thai.ts) — BIP-39 has no official Thai list, so this one is
 * app-internal only; the algorithm itself doesn't care what the words are,
 * only that there are exactly 2048 distinct ones.
 */
export async function generatePassphrase(language: PassphraseLanguage = 'en'): Promise<string> {
  const entropy = await ExpoCrypto.getRandomBytesAsync(MNEMONIC_ENTROPY_BYTES);
  try {
    const wordlist = language === 'th' ? THAI_WORDLIST : undefined; // undefined -> bip39's default (English)
    return bip39.entropyToMnemonic(bytesToHex(entropy), wordlist);
  } finally {
    wipe(entropy);
  }
}

// ---------------------------------------------------------------------------
// 2. deriveMasterKey — Argon2id, falling back to PBKDF2-HMAC-SHA256
// ---------------------------------------------------------------------------

/**
 * Tries native Argon2id via `react-native-argon2`. Returns null (never
 * throws) if the package isn't installed or its native binding isn't
 * available on the current runtime (e.g. Expo Go without a dev client) —
 * the caller falls back to PBKDF2 in that case.
 */
async function tryArgon2id(
  passphrase: string,
  salt: Uint8Array
): Promise<Uint8Array | null> {
  try {
    // Dynamic require: keeps this an optional dependency so the module
    // still works (via the PBKDF2 fallback) when it isn't installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-argon2');
    const argon2: (
      password: string,
      salt: string,
      options: Record<string, unknown>
    ) => Promise<{ rawHash?: string; hash?: string }> = mod.default ?? mod;

    const result = await argon2(passphrase, bytesToHex(salt), ARGON2ID_PARAMS);
    const hex = result.rawHash ?? result.hash;
    if (!hex) return null;
    return hexToBytes(hex);
  } catch {
    return null;
  }
}

/**
 * Derives a 256-bit master key from a passphrase.
 *
 * Prefers Argon2id (memory-hard, resists ASIC/GPU brute force). If no
 * stable native Argon2id binding is available on the device, falls back to
 * PBKDF2-HMAC-SHA256 with >= 100,000 iterations, per spec.
 *
 * Pass `existingSaltHex` to re-derive the *same* key on a later login
 * (e.g. after loading the persisted, non-secret salt from SecureStore).
 * Omit it to generate a fresh random salt for first-time key creation.
 */
export async function deriveMasterKey(
  passphrase: string,
  existingSaltHex?: string
): Promise<MasterKeyResult> {
  const salt = existingSaltHex
    ? hexToBytes(existingSaltHex)
    : await ExpoCrypto.getRandomBytesAsync(SALT_BYTES);

  const passphraseBytes = utf8ToBytes(passphrase.normalize('NFKD'));
  let masterKey: Uint8Array | null = null;

  try {
    const argonKey = await tryArgon2id(passphrase, salt);
    if (argonKey) {
      masterKey = argonKey;
      return { masterKeyHex: bytesToHex(masterKey), saltHex: bytesToHex(salt), kdf: 'argon2id' };
    }

    masterKey = pbkdf2(sha256, passphraseBytes, salt, {
      c: Math.max(PBKDF2_ITERATIONS, PBKDF2_MIN_ITERATIONS),
      dkLen: KEY_BYTES,
    });
    return {
      masterKeyHex: bytesToHex(masterKey),
      saltHex: bytesToHex(salt),
      kdf: 'pbkdf2-sha256',
      iterations: Math.max(PBKDF2_ITERATIONS, PBKDF2_MIN_ITERATIONS),
    };
  } finally {
    wipe(passphraseBytes);
    wipe(masterKey);
    if (!existingSaltHex) wipe(salt); // salt itself isn't secret, but tidy up either way
  }
}

// ---------------------------------------------------------------------------
// 3. deriveAccountId — SHA-256(masterKey), safe to send to the server
// ---------------------------------------------------------------------------

/**
 * Derives the public `account_id` from the master key: SHA-256(masterKey),
 * hex-encoded. This is the ONLY identifier that may ever leave the device —
 * never send masterKeyHex or the passphrase to the server.
 */
/** hex(SHA-256(utf8(input))) — used for e.g. DMS guardian recovery tokens (see vault.ts). */
export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

export function deriveAccountId(masterKeyHex: string): string {
  const keyBytes = hexToBytes(masterKeyHex);
  try {
    const hash = sha256(keyBytes);
    const id = bytesToHex(hash);
    wipe(hash);
    return id;
  } finally {
    wipe(keyBytes);
  }
}

// ---------------------------------------------------------------------------
// 4/5. encryptData / decryptData — AES-256-GCM, fresh 96-bit IV per call
// ---------------------------------------------------------------------------

/**
 * Encrypts `data` with AES-256-GCM under `masterKeyHex`. A new random
 * 96-bit IV is generated for every call — never reuse an IV with the same
 * key. Returns base64 ciphertext (GCM auth tag included) and base64 IV.
 */
export async function encryptData(
  data: string,
  masterKeyHex: string
): Promise<EncryptedPayload> {
  const key = hexToBytes(masterKeyHex);
  const iv = await ExpoCrypto.getRandomBytesAsync(IV_BYTES);
  const plaintext = utf8ToBytes(data);
  let ciphertext: Uint8Array | null = null;

  try {
    ciphertext = gcm(key, iv).encrypt(plaintext);
    return { cipherText: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
  } finally {
    wipe(key);
    wipe(iv);
    wipe(plaintext);
    wipe(ciphertext);
  }
}

/**
 * Decrypts a payload produced by encryptData(). Throws if the auth tag
 * doesn't verify (wrong key, wrong IV, or tampered ciphertext).
 */
export async function decryptData(
  cipherText: string,
  iv: string,
  masterKeyHex: string
): Promise<string> {
  const key = hexToBytes(masterKeyHex);
  const ivBytes = base64ToBytes(iv);
  const ciphertextBytes = base64ToBytes(cipherText);
  let plaintext: Uint8Array | null = null;

  try {
    plaintext = gcm(key, ivBytes).decrypt(ciphertextBytes);
    return Buffer.from(plaintext).toString('utf8');
  } finally {
    wipe(key);
    wipe(ivBytes);
    wipe(ciphertextBytes);
    wipe(plaintext);
  }
}

/**
 * Binary counterpart to encryptData() — for file attachments (item 13's
 * "whiteboard" — file half) rather than short text notes. Returns a single
 * buffer with the 12-byte IV prepended to the ciphertext (IV || ciphertext),
 * so there's no separate metadata field to keep track of — the whole
 * returned buffer is exactly what gets uploaded as the object body, and
 * exactly what decryptBytes() expects back.
 */
export async function encryptBytes(data: Uint8Array, masterKeyHex: string): Promise<Uint8Array> {
  const key = hexToBytes(masterKeyHex);
  const iv = await ExpoCrypto.getRandomBytesAsync(IV_BYTES);
  let ciphertext: Uint8Array | null = null;
  try {
    ciphertext = gcm(key, iv).encrypt(data);
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);
    return combined;
  } finally {
    wipe(key);
    wipe(iv);
    wipe(ciphertext);
  }
}

/** Decrypts a buffer produced by encryptBytes(). Throws if the auth tag doesn't verify. */
export async function decryptBytes(combined: Uint8Array, masterKeyHex: string): Promise<Uint8Array> {
  if (combined.length < IV_BYTES) throw new Error('decryptBytes: buffer too short to contain an IV');
  const key = hexToBytes(masterKeyHex);
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  try {
    return gcm(key, iv).decrypt(ciphertext);
  } finally {
    wipe(key);
    wipe(iv);
  }
}

// ---------------------------------------------------------------------------
// 6. Zero memory traces — explicit wipe for callers holding key material
// ---------------------------------------------------------------------------

/**
 * Call this as soon as a caller is done holding a MasterKeyResult, on top
 * of the automatic wiping this module already does internally. Since
 * masterKeyHex is a JS string (immutable — it cannot be zeroed in place),
 * this only clears mutable buffers; treat hex-string exposure as
 * short-lived by design (derive, use immediately, drop the reference).
 */
export function wipeMasterKey(result: Partial<MasterKeyResult>): void {
  // Strings can't be mutated/zeroed in JS; dropping the reference (caller
  // setting result = undefined / letting it go out of scope) is the best
  // available mitigation. This helper exists mainly as a documented,
  // explicit "I'm done with this" call site for auditability.
  void result;
}

export const __internal = {
  wipe,
  MNEMONIC_ENTROPY_BYTES,
  KEY_BYTES,
  SALT_BYTES,
  IV_BYTES,
  PBKDF2_ITERATIONS,
};
