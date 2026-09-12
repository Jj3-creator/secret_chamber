// Secret Chamber — Part 2: get-upload-url Edge Function
// =======================================================
// Deno runtime (Supabase Edge Functions). Takes { account_id, file_size_bytes },
// rejects anything over 100MB, and returns a short-lived presigned PUT URL
// for Cloudflare R2 (S3-compatible) so the client can upload ciphertext
// directly — the encrypted bytes never pass through this function or
// through Postgres. No PII is read, stored, or logged here.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';

const MAX_FILE_SIZE_BYTES = 104_857_600; // 100 MB, per spec
const UPLOAD_URL_TTL_SECONDS = 900; // 15 minutes
const ACCOUNT_ID_RE = /^[0-9a-f]{64}$/; // hex SHA-256 digest

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_BUCKET = Deno.env.get('R2_BUCKET')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

interface RequestBody {
  account_id?: unknown;
  file_size_bytes?: unknown;
  category_id?: unknown;
  file_name?: unknown;
  mime_type?: unknown;
}

const MAX_FILE_NAME_LENGTH = 255;
const MAX_MIME_TYPE_LENGTH = 127;
const MAX_CATEGORY_ID_LENGTH = 64;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { account_id, file_size_bytes, category_id, file_name, mime_type } = body;

  if (typeof account_id !== 'string' || !ACCOUNT_ID_RE.test(account_id)) {
    return json({ error: 'invalid_account_id', detail: 'expected a 64-char hex SHA-256 digest' }, 400);
  }
  if (
    typeof file_size_bytes !== 'number' ||
    !Number.isInteger(file_size_bytes) ||
    file_size_bytes <= 0
  ) {
    return json({ error: 'invalid_file_size_bytes' }, 400);
  }
  if (file_size_bytes > MAX_FILE_SIZE_BYTES) {
    return json(
      { error: 'file_too_large', max_bytes: MAX_FILE_SIZE_BYTES, given_bytes: file_size_bytes },
      413
    );
  }
  // All three optional — display-only metadata, never trusted as real
  // content-type/size (see the migration's comment on these columns).
  if (category_id !== undefined && category_id !== null) {
    if (typeof category_id !== 'string' || category_id.length > MAX_CATEGORY_ID_LENGTH) {
      return json({ error: 'invalid_category_id' }, 400);
    }
  }
  if (file_name !== undefined && (typeof file_name !== 'string' || file_name.length > MAX_FILE_NAME_LENGTH)) {
    return json({ error: 'invalid_file_name' }, 400);
  }
  if (mime_type !== undefined && (typeof mime_type !== 'string' || mime_type.length > MAX_MIME_TYPE_LENGTH)) {
    return json({ error: 'invalid_mime_type' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Upsert the account (first upload for a brand-new account_id creates the
  // row) and bump last_active_at / storage_used_bytes. Runs as service_role,
  // so it bypasses the RLS policies defined in 0001_init_schema.sql.
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('storage_used_bytes')
    .eq('account_id', account_id)
    .maybeSingle();

  if (accountError) {
    console.error('account lookup failed', accountError.message);
    return json({ error: 'internal_error' }, 500);
  }

  const newStorageUsed = (account?.storage_used_bytes ?? 0) + file_size_bytes;

  const { error: upsertError } = await supabase.from('accounts').upsert(
    {
      account_id,
      last_active_at: new Date().toISOString(),
      storage_used_bytes: newStorageUsed,
    },
    { onConflict: 'account_id' }
  );

  if (upsertError) {
    console.error('account upsert failed', upsertError.message);
    return json({ error: 'internal_error' }, 500);
  }

  const blobId = crypto.randomUUID();
  const objectKey = `${account_id}/${blobId}`;

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const putCommand = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    ContentLength: file_size_bytes,
    ContentType: 'application/octet-stream', // opaque ciphertext, never inspected
  });

  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  } catch (e) {
    console.error('presign failed', e);
    return json({ error: 'internal_error' }, 500);
  }

  const { error: blobInsertError } = await supabase.from('blobs').insert({
    blob_id: blobId,
    account_id,
    file_size_bytes,
    category_id: category_id ?? null,
    file_name: file_name ?? '',
    mime_type: mime_type ?? 'application/octet-stream',
  });

  if (blobInsertError) {
    console.error('blob insert failed', blobInsertError.message);
    return json({ error: 'internal_error' }, 500);
  }

  // Best-effort: powers the usage/activity dashboard. Never fail the
  // actual upload flow over a logging hiccup.
  const { error: logError } = await supabase
    .from('activity_log')
    .insert({ account_id, event_type: 'upload', detail: { blob_id: blobId, file_size_bytes } });
  if (logError) console.error('activity log insert failed', logError.message);

  return json({
    blob_id: blobId,
    upload_url: uploadUrl,
    object_key: objectKey,
    expires_in: UPLOAD_URL_TTL_SECONDS,
  });
});
