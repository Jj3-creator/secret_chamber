/**
 * backend.ts — thin client for the deployed Secret Chamber Supabase backend
 * ============================================================================
 *
 * Plain `fetch` calls, not the `@supabase/supabase-js` SDK — keeps the app's
 * dependency footprint down, and this is all we need (a couple of REST
 * reads gated by RLS, plus the Edge Functions from Part 2).
 *
 * SUPABASE_ANON_KEY below is meant to be public and embedded in the client
 * bundle — that's how Supabase's anon key model works. It only grants what
 * the RLS policies in backend/supabase/migrations/*.sql allow (see
 * accounts_select_own etc.), scoped by the x-account-id header sent with
 * each request. It is NOT the service_role key, which must never appear
 * client-side.
 */

const SUPABASE_URL = 'https://lbybjlnrbjkbmcagyhtp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieWJqbG5yYmprYm1jYWd5aHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDAyNDYsImV4cCI6MjEwNDcxNjI0Nn0.K5xt-E5R8IaGfsrt329ZNG-YUxiDtkvfITiJ9At39Sw';

export interface AccountStatus {
  storageUsedBytes: number;
  dmsHeartbeatAt: string | null;
  dmsThresholdHours: number | null;
}

/**
 * Reads an account's own row directly via PostgREST, gated by the
 * accounts_select_own RLS policy (matches x-account-id against the row).
 * A brand-new account (never upserted by any Edge Function yet) simply
 * isn't in the table — that's a normal, valid state, not an error.
 */
export async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/accounts?account_id=eq.${accountId}&select=storage_used_bytes,dms_heartbeat_at,dms_threshold_hours`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-account-id': accountId,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`getAccountStatus: unexpected ${res.status}`);
  }
  const rows: Array<{
    storage_used_bytes: number;
    dms_heartbeat_at: string | null;
    dms_threshold_hours: number | null;
  }> = await res.json();

  const row = rows[0];
  return {
    storageUsedBytes: row?.storage_used_bytes ?? 0,
    dmsHeartbeatAt: row?.dms_heartbeat_at ?? null,
    dmsThresholdHours: row?.dms_threshold_hours ?? null,
  };
}

/** Result of a successful check-in. null means DMS isn't configured for this account. */
export interface HeartbeatResult {
  dmsHeartbeatAt: string;
  dmsThresholdHours: number;
}

export async function sendHeartbeat(accountId: string): Promise<HeartbeatResult | null> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dms-heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId }),
  });

  if (res.status === 400) return null; // dms_not_configured — a valid, expected state
  if (!res.ok) throw new Error(`sendHeartbeat: unexpected ${res.status}`);

  const body = await res.json();
  return { dmsHeartbeatAt: body.dms_heartbeat_at, dmsThresholdHours: body.dms_threshold_hours };
}
