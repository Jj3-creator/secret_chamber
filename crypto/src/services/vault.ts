/**
 * vault.ts — Decoy PIN & Dead Man's Switch (DMS) recovery
 * =========================================================
 *
 * Builds two design-driven features on top of crypto.ts and shamir.ts:
 *
 * 1. Decoy PIN — a Real PIN and a Decoy PIN each unlock a different vault
 *    (a different AES-256 master key) from the *same* keypad, with no
 *    observable difference between "wrong PIN" and "right PIN, other
 *    vault" from the outside. Both wrapped vault-key blobs exist on disk
 *    unconditionally, so inspecting storage can't reveal which PIN is real.
 *
 * 2. Dead Man's Switch recovery — the real master key is split 2-of-3
 *    (Shamir) across trusted contacts ("guardians"). Any 2 of the 3 shares
 *    reconstruct the key; 1 alone reveals nothing.
 *
 * IMPORTANT SCOPE NOTE: this module provides the cryptographic primitives
 * only. It deliberately does NOT — and cannot — enforce *when* guardians
 * are allowed to combine their shares (the heartbeat/48h waiting window
 * from the design). A client holding 2 shares can always call
 * recoverMasterKeyFromShares() immediately; timing/gating has to be
 * enforced server-side (e.g. the backend only reveals a guardian's own
 * share via an API call after it verifies the heartbeat has actually
 * expired). That server-side piece is not built yet — see backend/README.md.
 */

import { bytesToHex } from '@noble/hashes/utils';
import * as ExpoCrypto from 'expo-crypto';
import {
  deriveMasterKey,
  encryptData,
  decryptData,
  __internal,
  type EncryptedPayload,
  type KdfAlgorithm,
} from './crypto';
import { splitSecret, combineShares, type ShamirShare } from './shamir';

const PIN_MIN_LENGTH = 4;

// ---------------------------------------------------------------------------
// Decoy PIN
// ---------------------------------------------------------------------------

export interface WrappedVaultKey {
  /** AES-256-GCM(vaultKeyHex) under a key derived from this vault's PIN. */
  wrapped: EncryptedPayload;
  /** PIN key-derivation salt. Not secret — needed to re-derive the same PIN key later. */
  saltHex: string;
  kdf: KdfAlgorithm;
  iterations?: number;
}

export interface DualPinSetup {
  real: WrappedVaultKey;
  decoy: WrappedVaultKey;
  /**
   * The decoy vault's own, independently-random master key. Treat it like
   * any other master key (e.g. to seed a harmless-looking decoy vault) —
   * just never store it next to the real one, or the two vaults become
   * distinguishable by association.
   */
  decoyMasterKeyHex: string;
}

export interface UnlockResult {
  vault: 'real' | 'decoy';
  masterKeyHex: string;
}

/** Derives a key from a PIN. Thin, semantically-named wrapper around deriveMasterKey — a PIN is just low-entropy input to the same KDF pipeline. */
export async function derivePinKey(pin: string, existingSaltHex?: string) {
  if (pin.length < PIN_MIN_LENGTH) {
    throw new Error(`vault: PIN must be at least ${PIN_MIN_LENGTH} characters/digits`);
  }
  return deriveMasterKey(pin, existingSaltHex);
}

export async function wrapVaultKey(vaultKeyHex: string, pinKeyHex: string): Promise<EncryptedPayload> {
  return encryptData(vaultKeyHex, pinKeyHex);
}

/** Returns null (never throws) if pinKeyHex is the wrong key for this blob — GCM auth tag didn't verify. */
export async function unwrapVaultKey(
  wrapped: EncryptedPayload,
  pinKeyHex: string
): Promise<string | null> {
  try {
    return await decryptData(wrapped.cipherText, wrapped.iv, pinKeyHex);
  } catch {
    return null;
  }
}

/**
 * Sets up a Real PIN and a Decoy PIN for an existing real master key
 * (from deriveMasterKey / your passphrase flow). Generates a fresh,
 * unrelated master key for the decoy vault.
 */
export async function setupDualPin(
  realMasterKeyHex: string,
  realPin: string,
  decoyPin: string
): Promise<DualPinSetup> {
  if (realPin === decoyPin) {
    throw new Error('vault: real and decoy PINs must be different');
  }

  const [realPinKey, decoyPinKey] = await Promise.all([derivePinKey(realPin), derivePinKey(decoyPin)]);

  // Already full-entropy random, so — unlike a human-chosen PIN/passphrase —
  // this does NOT need PBKDF2/Argon2id stretching.
  const decoyKeyBytes = await ExpoCrypto.getRandomBytesAsync(__internal.KEY_BYTES);
  const decoyMasterKeyHex = bytesToHex(decoyKeyBytes);

  try {
    const [realWrapped, decoyWrapped] = await Promise.all([
      wrapVaultKey(realMasterKeyHex, realPinKey.masterKeyHex),
      wrapVaultKey(decoyMasterKeyHex, decoyPinKey.masterKeyHex),
    ]);

    return {
      real: {
        wrapped: realWrapped,
        saltHex: realPinKey.saltHex,
        kdf: realPinKey.kdf,
        iterations: realPinKey.iterations,
      },
      decoy: {
        wrapped: decoyWrapped,
        saltHex: decoyPinKey.saltHex,
        kdf: decoyPinKey.kdf,
        iterations: decoyPinKey.iterations,
      },
      decoyMasterKeyHex,
    };
  } finally {
    __internal.wipe(decoyKeyBytes);
  }
}

/**
 * Tries a single entered PIN against both the real and decoy vaults. Both
 * unwrap attempts always run (never short-circuited) so which one
 * succeeded can't be inferred from which one ran — only from the result.
 * Returns null if the PIN matches neither vault.
 */
export async function unlockWithPin(pin: string, setup: DualPinSetup): Promise<UnlockResult | null> {
  const [realPinKey, decoyPinKey] = await Promise.all([
    derivePinKey(pin, setup.real.saltHex),
    derivePinKey(pin, setup.decoy.saltHex),
  ]);

  const [realMasterKeyHex, decoyMasterKeyHex] = await Promise.all([
    unwrapVaultKey(setup.real.wrapped, realPinKey.masterKeyHex),
    unwrapVaultKey(setup.decoy.wrapped, decoyPinKey.masterKeyHex),
  ]);

  if (realMasterKeyHex) return { vault: 'real', masterKeyHex: realMasterKeyHex };
  if (decoyMasterKeyHex) return { vault: 'decoy', masterKeyHex: decoyMasterKeyHex };
  return null;
}

// ---------------------------------------------------------------------------
// Dead Man's Switch (DMS) recovery — Shamir 2-of-3 across guardians
// ---------------------------------------------------------------------------

export interface RecoveryShareSet {
  /** One share per guardian — hand each ShamirShare to a different trusted contact. */
  shares: ShamirShare[];
  threshold: number;
}

/**
 * Splits a master key into `guardians` shares, any `threshold` of which
 * reconstruct it. Defaults to the design's 2-of-3. A lone guardian's
 * share reveals nothing about the key (information-theoretic guarantee of
 * Shamir's Secret Sharing) — see the scope note at the top of this file
 * for what this function does NOT do (enforce the heartbeat waiting period).
 */
export async function createRecoveryShares(
  masterKeyHex: string,
  options: { guardians: number; threshold: number } = { guardians: 3, threshold: 2 }
): Promise<RecoveryShareSet> {
  const shares = await splitSecret(masterKeyHex, {
    shares: options.guardians,
    threshold: options.threshold,
  });
  return { shares, threshold: options.threshold };
}

/** Reconstructs the master key once >= threshold guardians' shares are collected. */
export function recoverMasterKeyFromShares(shares: ShamirShare[]): string {
  return combineShares(shares);
}
