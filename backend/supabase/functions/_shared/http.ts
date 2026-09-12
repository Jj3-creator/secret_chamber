// Shared helpers for the DMS (Dead Man's Switch) Edge Functions.
// Not a deployable function itself — imported by sibling functions via
// relative path. (get-upload-url predates this file and keeps its own
// inline copies rather than being refactored, to avoid touching an
// already-deployed, already-tested function.)

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** hex(SHA-256(input)) via the Web Crypto API available in the Deno runtime. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** account_id is always a hex SHA-256 digest (see crypto.ts's deriveAccountId). */
export const ACCOUNT_ID_RE = /^[0-9a-f]{64}$/;

/** Same shape as ACCOUNT_ID_RE — used for guardian token_hash. Named separately for readability at call sites. */
export const HEX64_RE = /^[0-9a-f]{64}$/;
