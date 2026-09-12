/**
 * Test-only stand-in for `expo-crypto`.
 *
 * expo-crypto's `getRandomBytesAsync` calls into a native module that only
 * exists inside an actual Expo/React Native runtime. Under plain Jest (Node)
 * there is no such runtime, so this mock swaps in Node's own CSPRNG
 * (`crypto.randomBytes`), which is drop-in equivalent for our purposes:
 * cryptographically-strong random bytes of a given length.
 *
 * Wired in via jest.config.js -> moduleNameMapper, so production code never
 * imports this file — only the test bundle does.
 */
import { randomBytes } from 'crypto';

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return new Uint8Array(randomBytes(byteCount));
}
