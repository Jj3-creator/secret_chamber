-- Secret Chamber — Part 3: per-safe file attachments
-- ======================================================
-- Adds just enough metadata to blobs for the client to list "what files
-- are in safe X" and show a real file name — still zero-knowledge:
-- file_name/mime_type are set by the client and are NOT validated or
-- trusted as authoritative content-type by the server (ContentLength is
-- checked; the bytes themselves are still opaque ciphertext to R2 and to
-- Postgres). A determined owner could lie about their own file's name to
-- their own account; there's nothing sensitive at stake in that.
--
-- category_id is nullable — existing rows (from before this migration,
-- if any) and any blob not yet associated with a specific safe stay valid.

alter table public.blobs
  add column if not exists category_id text,
  add column if not exists file_name   text not null default '',
  add column if not exists mime_type   text not null default 'application/octet-stream';

comment on column public.blobs.category_id is
  'Which safe (categories.ts id, e.g. financial/assets/...) this file belongs to. Null = not associated with a specific safe.';
comment on column public.blobs.file_name is
  'Client-supplied original file name, for display only — never trusted for content-type sniffing.';
comment on column public.blobs.mime_type is
  'Client-supplied original MIME type, for display only.';

create index if not exists idx_blobs_account_category on public.blobs (account_id, category_id);
