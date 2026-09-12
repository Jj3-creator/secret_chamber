import { deriveMasterKey } from '../crypto';
import {
  setupDualPin,
  unlockWithPin,
  derivePinKey,
  createRecoveryShares,
  recoverMasterKeyFromShares,
} from '../vault';

describe('Decoy PIN — setupDualPin / unlockWithPin', () => {
  it('the real PIN unlocks the real vault with the original master key', async () => {
    const { masterKeyHex: realMasterKeyHex } = await deriveMasterKey('correct horse battery staple');
    const setup = await setupDualPin(realMasterKeyHex, '135790', '246801');

    const result = await unlockWithPin('135790', setup);
    expect(result).not.toBeNull();
    expect(result!.vault).toBe('real');
    expect(result!.masterKeyHex).toBe(realMasterKeyHex);
  });

  it('the decoy PIN unlocks the decoy vault with a DIFFERENT master key', async () => {
    const { masterKeyHex: realMasterKeyHex } = await deriveMasterKey('another passphrase entirely');
    const setup = await setupDualPin(realMasterKeyHex, '111111', '999999');

    const result = await unlockWithPin('999999', setup);
    expect(result).not.toBeNull();
    expect(result!.vault).toBe('decoy');
    expect(result!.masterKeyHex).toBe(setup.decoyMasterKeyHex);
    expect(result!.masterKeyHex).not.toBe(realMasterKeyHex);
  });

  it('a PIN matching neither vault returns null', async () => {
    const { masterKeyHex: realMasterKeyHex } = await deriveMasterKey('yet another passphrase');
    const setup = await setupDualPin(realMasterKeyHex, '135790', '246801');

    expect(await unlockWithPin('000000', setup)).toBeNull();
  });

  it('rejects setting the same PIN for both real and decoy', async () => {
    const { masterKeyHex } = await deriveMasterKey('same pin rejection test');
    await expect(setupDualPin(masterKeyHex, '123456', '123456')).rejects.toThrow();
  });

  it('rejects PINs shorter than the minimum length', async () => {
    await expect(derivePinKey('12')).rejects.toThrow();
  });

  it('the two wrapped blobs are indistinguishable in size (no length side-channel)', async () => {
    const { masterKeyHex } = await deriveMasterKey('size comparison test passphrase');
    const setup = await setupDualPin(masterKeyHex, '135790', '246801');

    // Both master keys are the same fixed length (32 bytes -> 64 hex chars),
    // encrypted with AES-GCM (ciphertext length == plaintext length + fixed
    // 16-byte tag), so the wrapped blobs should be identical in size.
    expect(setup.real.wrapped.cipherText.length).toBe(setup.decoy.wrapped.cipherText.length);
  });
});

describe('Dead Man\'s Switch — createRecoveryShares / recoverMasterKeyFromShares', () => {
  it('any 2 of the 3 guardian shares reconstruct the original master key', async () => {
    const { masterKeyHex } = await deriveMasterKey('guardian recovery test passphrase');
    const { shares, threshold } = await createRecoveryShares(masterKeyHex);

    expect(shares).toHaveLength(3);
    expect(threshold).toBe(2);

    expect(recoverMasterKeyFromShares([shares[0], shares[1]])).toBe(masterKeyHex);
    expect(recoverMasterKeyFromShares([shares[0], shares[2]])).toBe(masterKeyHex);
    expect(recoverMasterKeyFromShares([shares[1], shares[2]])).toBe(masterKeyHex);
  });

  it('supports a custom guardian count / threshold', async () => {
    const { masterKeyHex } = await deriveMasterKey('custom threshold test passphrase');
    const { shares } = await createRecoveryShares(masterKeyHex, { guardians: 5, threshold: 3 });

    expect(shares).toHaveLength(5);
    expect(recoverMasterKeyFromShares([shares[0], shares[2], shares[4]])).toBe(masterKeyHex);
  });
});
