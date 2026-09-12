// Secret Chamber — cleanup-inactive-accounts Edge Function
// =============================================================
// Feature request: "ถ้าไม่มี entry เกิน 1 ปี ห้องแห่งความลับนี้จะถูกลบทิ้ง
// ตลอดกาล ใครก็กู้ไม่ได้" — permanently deletes accounts (and their R2
// blobs) that haven't been active in over a year.
//
// SECURITY: deployed WITHOUT --no-verify-jwt (see backend/README.md), so
// only a caller holding the service_role key can invoke this — unlike
// get-upload-url/dms-*, which the app itself calls with the anon key.
// This is a maintenance sweep meant to run on a schedule (Supabase
// Dashboard -> Cron Jobs), not something the client app ever calls.
//
// Order of operations per account: delete the R2 objects FIRST, then the
// DB row — if R2 cleanup fails for an account, its row is left alone
// (better an orphaned "should be deleted" row than orphaned ciphertext
// with no owning row to ever point at it again).
//
// Supports { "dry_run": true } to preview what WOULD be deleted (no
// writes at all) before ever running it for real — deliberately, since
// this is the one truly irreversible operation in this backend.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from 'npm:@aws-sdk/client-s3@3';
import { CORS_HEADERS, json } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_BUCKET = Deno.env.get('R2_BUCKET')!;

const INACTIVITY_LIMIT_DAYS = 365;

interface AccountResult {
  account_id: string;
  last_active_at: string;
  blobs_deleted: number;
  account_deleted: boolean;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
  } catch {
    // no/empty body is fine — dry_run just stays false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const cutoffIso = new Date(Date.now() - INACTIVITY_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleAccounts, error: selectError } = await supabase
    .from('accounts')
    .select('account_id, last_active_at')
    .lt('last_active_at', cutoffIso);

  if (selectError) {
    console.error('select stale accounts failed', selectError.message);
    return json({ error: 'internal_error' }, 500);
  }

  if (!staleAccounts || staleAccounts.length === 0) {
    return json({ dry_run: dryRun, cutoff: cutoffIso, candidates: 0, results: [] });
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const results: AccountResult[] = [];

  for (const acc of staleAccounts) {
    let blobsDeleted = 0;
    try {
      let continuationToken: string | undefined;
      do {
        const listRes = await s3.send(
          new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: `${acc.account_id}/`,
            ContinuationToken: continuationToken,
          })
        );
        const keys = (listRes.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (keys.length > 0 && !dryRun) {
          await s3.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: keys } }));
        }
        blobsDeleted += keys.length;
        continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (e) {
      console.error(`R2 cleanup failed for ${acc.account_id}`, e);
      results.push({
        account_id: acc.account_id,
        last_active_at: acc.last_active_at,
        blobs_deleted: blobsDeleted,
        account_deleted: false,
        error: 'r2_cleanup_failed',
      });
      continue; // don't delete the DB row unless storage cleanup is confirmed done
    }

    let accountDeleted = dryRun;
    if (!dryRun) {
      const { error: deleteError } = await supabase.from('accounts').delete().eq('account_id', acc.account_id);
      accountDeleted = !deleteError;
      if (deleteError) console.error(`account delete failed for ${acc.account_id}`, deleteError.message);
    }

    results.push({
      account_id: acc.account_id,
      last_active_at: acc.last_active_at,
      blobs_deleted: blobsDeleted,
      account_deleted: accountDeleted,
    });
  }

  return json({ dry_run: dryRun, cutoff: cutoffIso, candidates: staleAccounts.length, results });
});
