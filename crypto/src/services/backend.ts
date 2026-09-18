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
  /** Used to compute the 1-year auto-delete date (Dashboard's "memory status" cards). */
  lastActiveAt: string | null;
}

/**
 * Reads an account's own row directly via PostgREST, gated by the
 * accounts_select_own RLS policy (matches x-account-id against the row).
 * A brand-new account (never upserted by any Edge Function yet) simply
 * isn't in the table — that's a normal, valid state, not an error.
 */
export async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/accounts?account_id=eq.${accountId}&select=storage_used_bytes,dms_heartbeat_at,dms_threshold_hours,last_active_at`,
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
    last_active_at: string | null;
  }> = await res.json();

  const row = rows[0];
  return {
    storageUsedBytes: row?.storage_used_bytes ?? 0,
    dmsHeartbeatAt: row?.dms_heartbeat_at ?? null,
    dmsThresholdHours: row?.dms_threshold_hours ?? null,
    lastActiveAt: row?.last_active_at ?? null,
  };
}

/**
 * Result of a successful check-in — always succeeds now (see
 * dms-heartbeat/index.ts's own comment on why): it always bumps
 * last_active_at (the 1-year auto-delete clock) even when DMS/guardians
 * were never configured. dmsThresholdHours is null in exactly that case.
 */
export interface HeartbeatResult {
  dmsHeartbeatAt: string;
  dmsThresholdHours: number | null;
}

export async function sendHeartbeat(accountId: string): Promise<HeartbeatResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dms-heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId }),
  });

  if (!res.ok) throw new Error(`sendHeartbeat: unexpected ${res.status}`);

  const body = await res.json();
  return { dmsHeartbeatAt: body.dms_heartbeat_at, dmsThresholdHours: body.dms_threshold_hours };
}

export interface DmsGuardianInput {
  shareIndex: number;
  tokenHash: string;
  wrapped: { cipherText: string; iv: string };
  // Optional — see backend/supabase/migrations/0006_dms_notify.sql for
  // why this is the one piece of guardian identity the server now learns
  // (only if the owner chose to type it in), and why it's still never the
  // raw recovery token itself.
  guardianEmail?: string | null;
}

/** Registers (or replaces) an account's Dead Man's Switch guardians + threshold. See dms-setup/index.ts. */
export async function setupDms(
  accountId: string,
  thresholdHours: number,
  guardians: DmsGuardianInput[]
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dms-setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: accountId,
      threshold_hours: thresholdHours,
      guardians: guardians.map((g) => ({
        share_index: g.shareIndex,
        token_hash: g.tokenHash,
        wrapped: g.wrapped,
        guardian_email: g.guardianEmail ?? null,
      })),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`setupDms: ${res.status} ${body?.error ?? ''}`);
  }
}

export type ActivityEventType = 'upload' | 'heartbeat' | 'dms_setup';

export interface ActivityLogEntry {
  eventType: ActivityEventType;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/** Reads recent activity for the usage dashboard — same RLS pattern as getAccountStatus. */
export async function getActivityLog(accountId: string, limit = 20): Promise<ActivityLogEntry[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/activity_log?account_id=eq.${accountId}&select=event_type,detail,created_at&order=created_at.desc&limit=${limit}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-account-id': accountId,
      },
    }
  );
  if (!res.ok) throw new Error(`getActivityLog: unexpected ${res.status}`);

  const rows: Array<{ event_type: ActivityEventType; detail: Record<string, unknown> | null; created_at: string }> =
    await res.json();
  return rows.map((r) => ({ eventType: r.event_type, detail: r.detail, createdAt: r.created_at }));
}

// ---------------------------------------------------------------------------
// Part 3 — per-safe file attachments (items 12/13's "whiteboard", file half)
// ---------------------------------------------------------------------------
// Real ciphertext goes straight to Cloudflare R2 via presigned URLs — never
// through this backend's own request/response bodies. What DOES pass
// through here: opaque encrypted bytes (PUT/GET) and metadata rows that are
// display-only from the server's point of view (file_name/mime_type are
// never used to interpret the ciphertext). See categoryFiles.ts for the
// client-side encrypt-before-upload / decrypt-after-download half.

export interface UploadUrlResult {
  blobId: string;
  uploadUrl: string;
  expiresIn: number;
}

export async function getUploadUrl(
  accountId: string,
  fileSizeBytes: number,
  categoryId: string,
  fileName: string,
  mimeType: string
): Promise<UploadUrlResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-upload-url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: accountId,
      file_size_bytes: fileSizeBytes,
      category_id: categoryId,
      file_name: fileName,
      mime_type: mimeType,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`getUploadUrl: ${res.status} ${body?.error ?? ''}`);
  }
  const body = await res.json();
  return { blobId: body.blob_id, uploadUrl: body.upload_url, expiresIn: body.expires_in };
}

/** PUTs already-encrypted bytes straight to R2 via the presigned URL from getUploadUrl(). */
export async function uploadEncryptedBytes(uploadUrl: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`uploadEncryptedBytes: unexpected ${res.status}`);
}

export interface DownloadUrlResult {
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

export async function getDownloadUrl(accountId: string, blobId: string): Promise<DownloadUrlResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-download-url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId, blob_id: blobId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`getDownloadUrl: ${res.status} ${body?.error ?? ''}`);
  }
  const body = await res.json();
  return {
    downloadUrl: body.download_url,
    fileName: body.file_name,
    mimeType: body.mime_type,
    fileSizeBytes: body.file_size_bytes,
  };
}

/** GETs the still-encrypted bytes from R2 via the presigned URL from getDownloadUrl(). */
export async function downloadEncryptedBytes(downloadUrl: string): Promise<Uint8Array> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`downloadEncryptedBytes: unexpected ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export interface BlobMeta {
  blobId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

/** Lists this account's file rows for one safe — direct PostgREST read, same RLS pattern as getActivityLog. */
export async function listCategoryBlobs(accountId: string, categoryId: string): Promise<BlobMeta[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blobs?account_id=eq.${accountId}&category_id=eq.${categoryId}&select=blob_id,file_name,mime_type,file_size_bytes,created_at&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-account-id': accountId,
      },
    }
  );
  if (!res.ok) throw new Error(`listCategoryBlobs: unexpected ${res.status}`);
  const rows: Array<{
    blob_id: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
    created_at: string;
  }> = await res.json();
  return rows.map((r) => ({
    blobId: r.blob_id,
    fileName: r.file_name,
    mimeType: r.mime_type,
    fileSizeBytes: r.file_size_bytes,
    createdAt: r.created_at,
  }));
}

/**
 * Total attached-file count across ALL of this account's safes — used by
 * Dashboard's "สถานะความทรงจำ" card (feedback: "(ยังไม่นับไฟล์แนบ)" should
 * say how many there actually are, not just disclaim that it isn't
 * counting). A HEAD request with Prefer: count=exact asks PostgREST for
 * just the row count via the Content-Range response header — no need to
 * download every blob row (name/size/etc.) just to count them.
 */
export async function getAccountFileCount(accountId: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blobs?account_id=eq.${accountId}&select=blob_id`, {
    method: 'HEAD',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-account-id': accountId,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) throw new Error(`getAccountFileCount: unexpected ${res.status}`);
  // Content-Range looks like "0-24/117" (or "*/0" for an empty result).
  const range = res.headers.get('content-range');
  const total = range?.split('/')[1];
  return total && total !== '*' ? parseInt(total, 10) || 0 : 0;
}

/**
 * Removes a file's metadata row (direct PostgREST delete, gated by the
 * blobs_delete_own RLS policy). Note: this does NOT delete the underlying
 * R2 object — cleaning up the orphaned ciphertext is an operational task,
 * not exposed to the client, same as account deletion (see
 * 0001_init_schema.sql's own comment on that).
 */
export async function deleteBlobRecord(accountId: string, blobId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blobs?blob_id=eq.${blobId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-account-id': accountId,
    },
  });
  if (!res.ok) throw new Error(`deleteBlobRecord: unexpected ${res.status}`);
}
