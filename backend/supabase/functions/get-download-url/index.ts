// Secret Chamber — Part 3: get-download-url Edge Function
// ============================================================
// Mirror of get-upload-url, but for reading a blob back: takes
// { account_id, blob_id }, checks the blob row belongs to that account
// (service_role bypasses RLS, so this check is done explicitly here —
// same reasoning as get-upload-url's own account upsert), and returns a
// short-lived presigned GET URL for Cloudflare R2. The bytes returned are
// still opaque ciphertext — this function never decrypts anything; only
// the client, holding the real master key, can do that (see
// crypto.ts's decryptData / categoryFiles.ts on the client).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';
import { CORS_HEADERS, json, ACCOUNT_ID_RE } from '../_shared/http.ts';

const DOWNLOAD_URL_TTL_SECONDS = 900; // 15 minutes, matches get-upload-url's TTL

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_BUCKET = Deno.env.get('R2_BUCKET')!;

const BLOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // uuid

interface RequestBody {
  account_id?: unknown;
  blob_id?: unknown;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { account_id, blob_id } = body;

  if (typeof account_id !== 'string' || !ACCOUNT_ID_RE.test(account_id)) {
    return json({ error: 'invalid_account_id' }, 400);
  }
  if (typeof blob_id !== 'string' || !BLOB_ID_RE.test(blob_id)) {
    return json({ error: 'invalid_blob_id' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: blob, error: blobError } = await supabase
    .from('blobs')
    .select('account_id, file_name, mime_type, file_size_bytes')
    .eq('blob_id', blob_id)
    .maybeSingle();

  if (blobError) {
    console.error('blob lookup failed', blobError.message);
    return json({ error: 'internal_error' }, 500);
  }
  if (!blob || blob.account_id !== account_id) {
    // Deliberately the same response for "doesn't exist" and "belongs to
    // someone else" — don't leak which one it is.
    return json({ error: 'not_found' }, 404);
  }

  const objectKey = `${account_id}/${blob_id}`;

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const getCommand = new GetObjectCommand({ Bucket: R2_BUCKET, Key: objectKey });

  let downloadUrl: string;
  try {
    downloadUrl = await getSignedUrl(s3, getCommand, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  } catch (e) {
    console.error('presign failed', e);
    return json({ error: 'internal_error' }, 500);
  }

  return json({
    download_url: downloadUrl,
    file_name: blob.file_name,
    mime_type: blob.mime_type,
    file_size_bytes: blob.file_size_bytes,
    expires_in: DOWNLOAD_URL_TTL_SECONDS,
  });
});
