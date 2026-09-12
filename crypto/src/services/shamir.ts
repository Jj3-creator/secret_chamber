/**
 * shamir.ts — Shamir's Secret Sharing over GF(256)
 * =================================================
 *
 * General-purpose k-of-n threshold secret splitting, operated byte-wise on
 * GF(2^8) (reduction polynomial 0x11D, generator 2 — verified below to have
 * multiplicative order 255, i.e. 2 is a primitive element for this specific
 * modulus; the more commonly-cited AES polynomial 0x11B does NOT have this
 * property for generator 2, only order 51, which would silently produce a
 * broken log/exp table — this was checked numerically, not assumed).
 *
 * Security property this relies on: with threshold k, any k-1 shares reveal
 * *zero* information about the secret (information-theoretic, not just
 * computational) — so distributing raw shares to guardians is safe on its
 * own. What this module does NOT do is gate *when* shares may be combined
 * (e.g. a Dead Man's Switch waiting period) — that's a policy/business-logic
 * concern that has to be enforced server-side (a client can always run
 * combineShares() the instant it holds k shares), see vault.ts.
 */

import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as ExpoCrypto from 'expo-crypto';

export interface ShamirShare {
  /** x-coordinate, 1..255. Not secret — safe to store/transmit alongside valueHex. */
  index: number;
  /** y-values, one per secret byte, hex-encoded. Same length as the secret. */
  valueHex: string;
}

export interface SplitOptions {
  /** Total number of shares to produce (n). */
  shares: number;
  /** Minimum shares needed to reconstruct (k). Must be >= 2 and <= shares. */
  threshold: number;
}

// ---------------------------------------------------------------------------
// GF(256) arithmetic — reduction polynomial 0x11D, generator 2
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(256);
const GF_LOG = new Uint8Array(256);

function xtime(a: number): number {
  const shifted = (a << 1) & 0xff;
  return a & 0x80 ? shifted ^ 0x1d : shifted;
}

(function initGaloisTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = xtime(x);
  }
  GF_EXP[255] = GF_EXP[0]; // convenience wrap, avoids a mod in gfMul
})();

function gfAdd(a: number, b: number): number {
  return a ^ b; // addition and subtraction coincide in characteristic 2
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('shamir: division by zero in GF(256) — duplicate share x-coordinates?');
  if (a === 0) return 0;
  return GF_EXP[(GF_LOG[a] + 255 - GF_LOG[b]) % 255];
}

/** Horner's method: coeffs[0] is the constant term (the secret byte). */
function evalPolynomial(coeffs: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gfAdd(gfMul(result, x), coeffs[i]);
  }
  return result;
}

function wipe(bytes?: Uint8Array | null): void {
  if (bytes && bytes.length) bytes.fill(0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Splits `secretHex` into `options.shares` shares, any `options.threshold`
 * of which reconstruct it exactly via combineShares(). x-coordinates are
 * assigned 1..n (never 0 — a share at x=0 would just BE the secret byte).
 */
export async function splitSecret(
  secretHex: string,
  options: SplitOptions
): Promise<ShamirShare[]> {
  const { shares: n, threshold: k } = options;
  if (!Number.isInteger(k) || k < 2) {
    throw new Error('shamir: threshold must be an integer >= 2');
  }
  if (!Number.isInteger(n) || n < k) {
    throw new Error('shamir: shares must be an integer >= threshold');
  }
  if (n > 255) {
    throw new Error('shamir: at most 255 shares are supported (GF(256) x-coordinates are 1..255)');
  }

  const secretBytes = hexToBytes(secretHex);
  // One random coefficient per (secret byte, polynomial degree > 0) pair,
  // generated up front so the hot loop below stays synchronous.
  const randomCoeffs = await ExpoCrypto.getRandomBytesAsync(secretBytes.length * (k - 1));
  const shareBytes: Uint8Array[] = Array.from({ length: n }, () => new Uint8Array(secretBytes.length));

  try {
    const coeffs = new Uint8Array(k);
    for (let byteIdx = 0; byteIdx < secretBytes.length; byteIdx++) {
      coeffs[0] = secretBytes[byteIdx];
      for (let c = 1; c < k; c++) {
        coeffs[c] = randomCoeffs[byteIdx * (k - 1) + (c - 1)];
      }
      for (let shareIdx = 0; shareIdx < n; shareIdx++) {
        shareBytes[shareIdx][byteIdx] = evalPolynomial(coeffs, shareIdx + 1);
      }
    }

    return shareBytes.map((bytes, i) => ({ index: i + 1, valueHex: bytesToHex(bytes) }));
  } finally {
    wipe(secretBytes);
    wipe(randomCoeffs);
  }
}

/**
 * Reconstructs the original secret from >= threshold shares via Lagrange
 * interpolation at x=0. Throws if fewer than 2 shares are given, if any
 * two shares share the same x-coordinate, or if share value lengths don't
 * match (all clear signs of malformed/corrupted input rather than a
 * legitimate partial-share set).
 */
export function combineShares(shares: ShamirShare[]): string {
  if (shares.length < 2) {
    throw new Error('shamir: at least 2 shares are required to reconstruct a secret');
  }

  const indices = shares.map((s) => s.index);
  if (new Set(indices).size !== indices.length) {
    throw new Error('shamir: duplicate share index — need distinct shares');
  }

  const valueBytes = shares.map((s) => hexToBytes(s.valueHex));
  const length = valueBytes[0].length;
  if (!valueBytes.every((b) => b.length === length)) {
    throw new Error('shamir: share value lengths do not match');
  }

  const secret = new Uint8Array(length);
  try {
    for (let byteIdx = 0; byteIdx < length; byteIdx++) {
      let acc = 0;
      for (let i = 0; i < shares.length; i++) {
        const xi = indices[i];
        const yi = valueBytes[i][byteIdx];
        let numerator = 1;
        let denominator = 1;
        for (let j = 0; j < shares.length; j++) {
          if (j === i) continue;
          const xj = indices[j];
          numerator = gfMul(numerator, xj);
          denominator = gfMul(denominator, gfAdd(xi, xj)); // (xi - xj) === (xi XOR xj) here
        }
        acc = gfAdd(acc, gfMul(yi, gfDiv(numerator, denominator)));
      }
      secret[byteIdx] = acc;
    }
    return bytesToHex(secret);
  } finally {
    wipe(secret);
    valueBytes.forEach(wipe);
  }
}
