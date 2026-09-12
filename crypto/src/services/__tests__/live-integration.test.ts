/**
 * LIVE end-to-end integration check — opt-in, real network calls.
 * ==================================================================
 *
 * Exercises the WHOLE system against the real deployed SecretChamber
 * Supabase project and Cloudflare R2 bucket: passphrase -> master key ->
 * account_id -> encrypt -> real presigned R2 upload -> decrypt -> Dead
 * Man's Switch setup -> heartbeat -> gated request-share (denied, then
 * allowed) -> Shamir 2-of-3 reconstruction -> cleanup.
 *
 * SKIPPED BY DEFAULT. `npm test` never hits the network or needs secrets
 * unless RUN_LIVE_INTEGRATION=1 is set. To actually run it:
 *
 *   RUN_LIVE_INTEGRATION=1 \
 *   SUPABASE_URL=https://<project-ref>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon key> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key — only used by this test
 *     harness itself, to backdate the heartbeat instead of waiting 48 real
 *     hours, and to delete the test account afterwards> \
 *   npx jest src/services/__tests__/live-integration.test.ts
 *
 * Never commit real credentials anywhere in this repo — pass them as
 * environment variables on the command line only.
 */
import { createHash } from 'crypto';
import {
  generatePassphrase,
  deriveMasterKey,
  deriveAccountId,
  encryptData,
  decryptData,
} from '../crypto';
import { createRecoveryShares, recoverMasterKeyFromShares, wrapVaultKey, unwrapVaultKey } from '../vault';

const RUN_LIVE = process.env.RUN_LIVE_INTEGRATION === '1';
const describeLive = RUN_LIVE ? describe : describe.skip;

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function postJson(url: string, anonKey: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json as Record<string, any> };
}

describeLive("LIVE integration — real Supabase + R2 + Dead Man's Switch", () => {
  it(
    'full pipeline: passphrase -> encrypt -> real R2 upload -> decrypt -> DMS gated recovery',
    async () => {
      const SUPABASE_URL = process.env.SUPABASE_URL!;
      const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      expect(SUPABASE_URL && ANON_KEY && SERVICE_KEY).toBeTruthy();

      // --- 1. Crypto core -------------------------------------------------
      const passphrase = await generatePassphrase();
      expect(passphrase.trim().split(/\s+/)).toHaveLength(12);

      const { masterKeyHex } = await deriveMasterKey(passphrase);
      expect(masterKeyHex).toMatch(/^[0-9a-f]{64}$/);

      const accountId = deriveAccountId(masterKeyHex);
      expect(accountId).toMatch(/^[0-9a-f]{64}$/);

      // --- 2. Encrypt -> real presigned R2 upload -> decrypt -------------
      const plaintext = `Secret Chamber live integration check @ ${new Date().toISOString()}`;
      const { cipherText, iv } = await encryptData(plaintext, masterKeyHex);
      const cipherBytes = Buffer.from(cipherText, 'base64');

      const uploadUrlRes = await postJson(`${SUPABASE_URL}/functions/v1/get-upload-url`, ANON_KEY, {
        account_id: accountId,
        file_size_bytes: cipherBytes.length,
      });
      expect(uploadUrlRes.status).toBe(200);
      expect(typeof uploadUrlRes.body.upload_url).toBe('string');

      const putRes = await fetch(uploadUrlRes.body.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: cipherBytes,
      });
      expect(putRes.status).toBe(200); // real write to the Cloudflare R2 bucket

      const decrypted = await decryptData(cipherText, iv, masterKeyHex);
      expect(decrypted).toBe(plaintext);

      // --- 3. Dead Man's Switch: setup -> heartbeat -> gated recovery ----
      const { shares } = await createRecoveryShares(masterKeyHex, { guardians: 3, threshold: 2 });

      const guardianTokens = ['it-alice-token-aaaaaaaa', 'it-bob-token-bbbbbbbbbb', 'it-carol-token-cccccccc'];
      const guardianPassphrases = ['guardian alice passphrase', 'guardian bob passphrase', 'guardian carol passphrase'];
      const guardianKeys = await Promise.all(guardianPassphrases.map((p) => deriveMasterKey(p)));
      const wrappedShares = await Promise.all(
        shares.map((s, i) => wrapVaultKey(s.valueHex, guardianKeys[i].masterKeyHex))
      );

      const setupRes = await postJson(`${SUPABASE_URL}/functions/v1/dms-setup`, ANON_KEY, {
        account_id: accountId,
        threshold_hours: 48,
        guardians: shares.map((s, i) => ({
          share_index: s.index,
          token_hash: sha256Hex(guardianTokens[i]),
          wrapped: wrappedShares[i],
        })),
      });
      expect(setupRes.status).toBe(200);

      const tooSoon = await postJson(`${SUPABASE_URL}/functions/v1/dms-request-share`, ANON_KEY, {
        account_id: accountId,
        share_index: shares[0].index,
        token: guardianTokens[0],
      });
      expect(tooSoon.status).toBe(403);
      expect(tooSoon.body.error).toBe('not_yet_eligible');

      // Backdate the heartbeat via service_role instead of waiting 48 real
      // hours — this is a TEST HARNESS privilege, not something the app
      // or any guardian can do.
      const pastIso = new Date(Date.now() - 100 * 3600 * 1000).toISOString();
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/accounts?account_id=eq.${accountId}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ dms_heartbeat_at: pastIso }),
      });
      expect([200, 204]).toContain(patchRes.status);

      const [reqA, reqB] = await Promise.all(
        [0, 1].map((i) =>
          postJson(`${SUPABASE_URL}/functions/v1/dms-request-share`, ANON_KEY, {
            account_id: accountId,
            share_index: shares[i].index,
            token: guardianTokens[i],
          })
        )
      );
      expect(reqA.status).toBe(200);
      expect(reqB.status).toBe(200);

      const unwrappedA = await unwrapVaultKey(reqA.body.wrapped, guardianKeys[0].masterKeyHex);
      const unwrappedB = await unwrapVaultKey(reqB.body.wrapped, guardianKeys[1].masterKeyHex);
      expect(unwrappedA).not.toBeNull();
      expect(unwrappedB).not.toBeNull();

      const reconstructed = recoverMasterKeyFromShares([
        { index: shares[0].index, valueHex: unwrappedA! },
        { index: shares[1].index, valueHex: unwrappedB! },
      ]);
      expect(reconstructed).toBe(masterKeyHex);

      // --- 4. Cleanup ------------------------------------------------------
      const cleanupRes = await fetch(`${SUPABASE_URL}/rest/v1/accounts?account_id=eq.${accountId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      expect(cleanupRes.status).toBe(204); // cascades to blobs + dms_guardians
    },
    60_000
  );
});
