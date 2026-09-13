import {
  generatePassphrase,
  deriveMasterKey,
  deriveKeyDeterministic,
  deriveAccountId,
  encryptData,
  decryptData,
  encryptBytes,
  decryptBytes,
  __internal,
} from '../crypto';

describe('generatePassphrase', () => {
  it('returns a valid 12-word BIP-39 mnemonic', async () => {
    const phrase = await generatePassphrase();
    const words = phrase.trim().split(/\s+/);
    expect(words).toHaveLength(12);
  });

  it('is different every time it is called', async () => {
    const a = await generatePassphrase();
    const b = await generatePassphrase();
    expect(a).not.toEqual(b);
  });
});

describe('deriveMasterKey', () => {
  it('derives a 256-bit key (64 hex chars) with a random salt', async () => {
    const result = await deriveMasterKey('correct horse battery staple');
    expect(result.masterKeyHex).toHaveLength(__internal.KEY_BYTES * 2);
    expect(result.saltHex).toHaveLength(__internal.SALT_BYTES * 2);
    // No native Argon2id binding is present in this Node/Jest environment,
    // so the module must transparently fall back to PBKDF2.
    expect(result.kdf).toBe('pbkdf2-sha256');
    expect(result.iterations).toBeGreaterThanOrEqual(100_000);
  });

  it('is deterministic given the same passphrase and salt', async () => {
    const first = await deriveMasterKey('same passphrase every time');
    const second = await deriveMasterKey('same passphrase every time', first.saltHex);
    expect(second.masterKeyHex).toBe(first.masterKeyHex);
  });

  it('produces different keys for different passphrases', async () => {
    const a = await deriveMasterKey('passphrase one two three four five');
    const b = await deriveMasterKey('passphrase six seven eight nine ten', a.saltHex);
    expect(a.masterKeyHex).not.toBe(b.masterKeyHex);
  });

  it('generates a fresh random salt on each call when none is supplied', async () => {
    const a = await deriveMasterKey('same passphrase, no salt given');
    const b = await deriveMasterKey('same passphrase, no salt given');
    expect(a.saltHex).not.toBe(b.saltHex);
    // Different salt -> different key, even for an identical passphrase.
    expect(a.masterKeyHex).not.toBe(b.masterKeyHex);
  });
});

describe('deriveAccountId', () => {
  it('is a 64-char hex SHA-256 digest of the master key', async () => {
    const { masterKeyHex } = await deriveMasterKey('id derivation test phrase');
    const accountId = deriveAccountId(masterKeyHex);
    expect(accountId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same master key', async () => {
    const { masterKeyHex } = await deriveMasterKey('deterministic id test');
    expect(deriveAccountId(masterKeyHex)).toBe(deriveAccountId(masterKeyHex));
  });

  it('never equals the master key itself (one-way, not passed through)', async () => {
    const { masterKeyHex } = await deriveMasterKey('one way hash test phrase');
    expect(deriveAccountId(masterKeyHex)).not.toBe(masterKeyHex);
  });
});

describe('deriveKeyDeterministic', () => {
  // This is the whole point of "recover your room with your 12 words" —
  // caught a real bug via live testing where deriveMasterKey's own
  // default random salt (correct for PIN derivation, wrong here) made
  // the exact same passphrase derive a DIFFERENT key every time, with no
  // salt ever persisted to reproduce it. See crypto.ts's
  // DETERMINISTIC_SALT_HEX for the full reasoning.
  it('derives the exact same key from the exact same input, every time', async () => {
    const a = await deriveKeyDeterministic('same twelve word phrase repeated for this test only');
    const b = await deriveKeyDeterministic('same twelve word phrase repeated for this test only');
    expect(a.masterKeyHex).toBe(b.masterKeyHex);
    expect(deriveAccountId(a.masterKeyHex)).toBe(deriveAccountId(b.masterKeyHex));
  });

  it('derives different keys for different input', async () => {
    const a = await deriveKeyDeterministic('phrase one for deterministic test');
    const b = await deriveKeyDeterministic('phrase two for deterministic test');
    expect(a.masterKeyHex).not.toBe(b.masterKeyHex);
  });

  it('differs from a random-salt deriveMasterKey call on the same input (proves it is not just reusing the random path)', async () => {
    const deterministic = await deriveKeyDeterministic('random vs deterministic comparison phrase');
    const random = await deriveMasterKey('random vs deterministic comparison phrase');
    expect(deterministic.masterKeyHex).not.toBe(random.masterKeyHex);
  });
});

describe('encryptData / decryptData round-trip', () => {
  it('decrypts back to the original plaintext', async () => {
    const { masterKeyHex } = await deriveMasterKey('round trip test passphrase');
    const plaintext = 'สวัสดี Secret Chamber 🔐 — the quick brown fox jumps over the lazy dog';

    const { cipherText, iv } = await encryptData(plaintext, masterKeyHex);
    const decrypted = await decryptData(cipherText, iv, masterKeyHex);

    expect(decrypted).toBe(plaintext);
  });

  it('round-trips empty strings', async () => {
    const { masterKeyHex } = await deriveMasterKey('empty string edge case');
    const { cipherText, iv } = await encryptData('', masterKeyHex);
    expect(await decryptData(cipherText, iv, masterKeyHex)).toBe('');
  });

  it('produces a different IV on every single call', async () => {
    const { masterKeyHex } = await deriveMasterKey('iv uniqueness test');
    const ivs = new Set<string>();
    const rounds = 50;

    for (let i = 0; i < rounds; i++) {
      const { iv } = await encryptData(`message #${i}`, masterKeyHex);
      ivs.add(iv);
    }

    expect(ivs.size).toBe(rounds);
  });

  it('produces different ciphertext for the same plaintext each call (nondeterministic IV)', async () => {
    const { masterKeyHex } = await deriveMasterKey('ciphertext nondeterminism test');
    const a = await encryptData('identical message', masterKeyHex);
    const b = await encryptData('identical message', masterKeyHex);

    expect(a.iv).not.toBe(b.iv);
    expect(a.cipherText).not.toBe(b.cipherText);
  });

  it('fails to decrypt with the wrong key', async () => {
    const keyA = (await deriveMasterKey('key A passphrase')).masterKeyHex;
    const keyB = (await deriveMasterKey('key B passphrase')).masterKeyHex;

    const { cipherText, iv } = await encryptData('top secret', keyA);
    await expect(decryptData(cipherText, iv, keyB)).rejects.toThrow();
  });
});

describe('encryptBytes / decryptBytes round-trip (file attachments)', () => {
  it('decrypts back to the original bytes', async () => {
    const { masterKeyHex } = await deriveMasterKey('file attachment round trip test');
    const original = new Uint8Array([0, 1, 2, 255, 254, 128, 64, 32, 16, 8, 4, 2, 1, 0]);

    const combined = await encryptBytes(original, masterKeyHex);
    const decrypted = await decryptBytes(combined, masterKeyHex);

    expect(Array.from(decrypted)).toEqual(Array.from(original));
  });

  it('round-trips an empty byte array', async () => {
    const { masterKeyHex } = await deriveMasterKey('empty bytes edge case');
    const combined = await encryptBytes(new Uint8Array(0), masterKeyHex);
    const decrypted = await decryptBytes(combined, masterKeyHex);
    expect(decrypted.length).toBe(0);
  });

  it('prepends a unique IV each call, so identical bytes never produce identical output', async () => {
    const { masterKeyHex } = await deriveMasterKey('file iv uniqueness test');
    const data = new Uint8Array([9, 9, 9]);
    const a = await encryptBytes(data, masterKeyHex);
    const b = await encryptBytes(data, masterKeyHex);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('fails to decrypt with the wrong key', async () => {
    const keyA = (await deriveMasterKey('file key A')).masterKeyHex;
    const keyB = (await deriveMasterKey('file key B')).masterKeyHex;
    const combined = await encryptBytes(new Uint8Array([1, 2, 3]), keyA);
    await expect(decryptBytes(combined, keyB)).rejects.toThrow();
  });

  it('rejects a buffer too short to contain an IV', async () => {
    const { masterKeyHex } = await deriveMasterKey('short buffer test');
    await expect(decryptBytes(new Uint8Array([1, 2, 3]), masterKeyHex)).rejects.toThrow();
  });

  it('fails to decrypt if the ciphertext was tampered with', async () => {
    const { masterKeyHex } = await deriveMasterKey('tamper detection test');
    const { cipherText, iv } = await encryptData('do not modify me', masterKeyHex);

    const bytes = Buffer.from(cipherText, 'base64');
    bytes[0] ^= 0xff; // flip a bit
    const tampered = bytes.toString('base64');

    await expect(decryptData(tampered, iv, masterKeyHex)).rejects.toThrow();
  });
});
