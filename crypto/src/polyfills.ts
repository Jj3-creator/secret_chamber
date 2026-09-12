/**
 * polyfills.ts — must be the FIRST import in App.tsx.
 *
 * `bip39` (a dependency of crypto.ts's generatePassphrase) uses Node's
 * global `Buffer` internally for its checksum/wordlist handling. Neither
 * React Native nor a browser defines `Buffer` globally by default — our
 * own code in crypto.ts always imports `{ Buffer } from 'buffer'`
 * explicitly rather than relying on a global, but bip39 itself does not,
 * so without this shim `generatePassphrase()` throws
 * "ReferenceError: Buffer is not defined" at runtime.
 *
 * Caught by running the actual Expo app (web preview) — the crypto.ts
 * Jest test suite never exercised this gap, because Node.js (Jest's test
 * environment) already has a real global Buffer, masking the issue.
 */
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
