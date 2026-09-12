import { THAI_WORDLIST, __internal } from '../wordlists/thai';
import { generatePassphrase, deriveMasterKey } from '../crypto';

describe('THAI_WORDLIST', () => {
  it('has exactly 2048 entries', () => {
    expect(THAI_WORDLIST).toHaveLength(2048);
  });

  it('has no duplicate entries', () => {
    expect(new Set(THAI_WORDLIST).size).toBe(2048);
  });

  it('is built from 64 unique nouns and 32 unique adjectives', () => {
    expect(new Set(__internal.NOUNS).size).toBe(64);
    expect(new Set(__internal.ADJECTIVES).size).toBe(32);
  });

  it('has no word shared between the noun and adjective source lists', () => {
    const overlap = __internal.NOUNS.filter((n) => __internal.ADJECTIVES.includes(n));
    expect(overlap).toEqual([]);
  });

  it('every entry is a noun immediately followed by an adjective (no accidental cross-matches)', () => {
    const set = new Set(THAI_WORDLIST);
    for (const noun of __internal.NOUNS) {
      for (const adj of __internal.ADJECTIVES) {
        expect(set.has(noun + adj)).toBe(true);
      }
    }
  });
});

describe('generatePassphrase with language option', () => {
  it('defaults to English (unchanged behavior)', async () => {
    const phrase = await generatePassphrase();
    const words = phrase.trim().split(/\s+/);
    expect(words).toHaveLength(12);
    // English words are plain ASCII; Thai script uses non-ASCII code points.
    expect(phrase).toMatch(/^[a-z ]+$/);
  });

  it('generates a valid 12-word Thai passphrase when language is "th"', async () => {
    const phrase = await generatePassphrase('th');
    const words = phrase.trim().split(/\s+/);
    expect(words).toHaveLength(12);
    for (const w of words) {
      expect(THAI_WORDLIST).toContain(w);
    }
  });

  it('a Thai passphrase still works as KDF input (language is just words, not a different pipeline)', async () => {
    const phrase = await generatePassphrase('th');
    const { masterKeyHex } = await deriveMasterKey(phrase);
    expect(masterKeyHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different phrase on every call, in Thai mode too', async () => {
    const a = await generatePassphrase('th');
    const b = await generatePassphrase('th');
    expect(a).not.toEqual(b);
  });
});
