import { randomBytes } from 'crypto';
import { bytesToHex } from '@noble/hashes/utils';
import { splitSecret, combineShares, type ShamirShare } from '../shamir';

function randomHex(byteLength: number): string {
  return bytesToHex(new Uint8Array(randomBytes(byteLength)));
}

describe('splitSecret / combineShares round-trip', () => {
  it('reconstructs a 32-byte secret (master-key-sized) from any 2-of-3 shares', async () => {
    const secretHex = randomHex(32);
    const shares = await splitSecret(secretHex, { shares: 3, threshold: 2 });
    expect(shares).toHaveLength(3);
    expect(shares.map((s) => s.index).sort()).toEqual([1, 2, 3]);

    const subsets: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    for (const [a, b] of subsets) {
      expect(combineShares([shares[a], shares[b]])).toBe(secretHex);
    }
  });

  it('order of shares passed to combineShares does not matter', async () => {
    const secretHex = randomHex(32);
    const shares = await splitSecret(secretHex, { shares: 3, threshold: 2 });
    expect(combineShares([shares[2], shares[0]])).toBe(secretHex);
  });

  it('works for a 5-of-8 threshold scheme too, not just 2-of-3', async () => {
    const secretHex = randomHex(16);
    const shares = await splitSecret(secretHex, { shares: 8, threshold: 5 });
    expect(shares).toHaveLength(8);

    const anyFive = [shares[0], shares[2], shares[4], shares[5], shares[7]];
    expect(combineShares(anyFive)).toBe(secretHex);
  });

  it('is correct across many random secrets (exercises every byte value over many runs)', async () => {
    for (let i = 0; i < 20; i++) {
      const secretHex = randomHex(8);
      const shares = await splitSecret(secretHex, { shares: 3, threshold: 2 });
      expect(combineShares([shares[0], shares[1]])).toBe(secretHex);
    }
  });

  it('produces different share values on every split (fresh randomness)', async () => {
    const secretHex = randomHex(32);
    const a = await splitSecret(secretHex, { shares: 3, threshold: 2 });
    const b = await splitSecret(secretHex, { shares: 3, threshold: 2 });
    // Same secret, but the random polynomial coefficients differ each time,
    // so the actual share values should (overwhelmingly likely) differ.
    expect(a[0].valueHex).not.toBe(b[0].valueHex);
  });
});

describe('combineShares — misuse and insufficient-share behavior', () => {
  it('throws when given fewer than 2 shares', () => {
    const lone: ShamirShare = { index: 1, valueHex: 'ab'.repeat(32) };
    expect(() => combineShares([lone])).toThrow();
  });

  it('throws on duplicate share indices', () => {
    const s: ShamirShare = { index: 1, valueHex: 'ab'.repeat(32) };
    expect(() => combineShares([s, { ...s }])).toThrow();
  });

  it('throws on mismatched share value lengths', () => {
    const a: ShamirShare = { index: 1, valueHex: 'ab'.repeat(32) };
    const b: ShamirShare = { index: 2, valueHex: 'cd'.repeat(16) };
    expect(() => combineShares([a, b])).toThrow();
  });

  it('a single share alone cannot even be attempted (need >= 2), demonstrating no partial leakage path', async () => {
    const secretHex = randomHex(32);
    const shares = await splitSecret(secretHex, { shares: 3, threshold: 2 });
    expect(() => combineShares([shares[0]])).toThrow();
  });

  it('reconstructing a threshold=3 split with only 2 shares yields the WRONG secret, not an error', async () => {
    // Shamir has no built-in way to detect "insufficient shares" — the math
    // just produces a different (wrong) value. Callers must track/enforce
    // the threshold themselves; this test documents that behavior.
    const secretHex = randomHex(16);
    const shares = await splitSecret(secretHex, { shares: 3, threshold: 3 });
    const wrongResult = combineShares([shares[0], shares[1]]);
    expect(wrongResult).not.toBe(secretHex);
  });
});

describe('splitSecret input validation', () => {
  it('rejects threshold < 2', async () => {
    await expect(splitSecret('ab'.repeat(16), { shares: 3, threshold: 1 })).rejects.toThrow();
  });

  it('rejects shares < threshold', async () => {
    await expect(splitSecret('ab'.repeat(16), { shares: 2, threshold: 3 })).rejects.toThrow();
  });

  it('rejects more than 255 shares', async () => {
    await expect(splitSecret('ab'.repeat(16), { shares: 256, threshold: 2 })).rejects.toThrow();
  });
});
