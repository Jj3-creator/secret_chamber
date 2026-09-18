/**
 * categoryFiles.ts — the "file" half of item 13's "white board" request
 * ("ใส่ได้ทั้ง text และ file word,pdf,png,jpeg,html,…."). The text half
 * lives in categoryNotes.ts; this module is the real file-attachment
 * pipeline: pick -> encrypt on-device -> upload ciphertext -> (later)
 * download ciphertext -> decrypt on-device -> save/open.
 *
 * Zero-knowledge: the file is encrypted with the room's own master key
 * (crypto.ts's encryptBytes/decryptBytes, same AES-256-GCM as everything
 * else) BEFORE it ever leaves the device. The server only ever sees
 * opaque ciphertext bytes plus display-only metadata (file name, MIME
 * type, size) — see get-upload-url / get-download-url's own comments.
 *
 * Any file type is accepted (Word/PDF/PNG/JPEG/HTML/...) since the server
 * never interprets the bytes either way — it's all just ciphertext to it.
 * A generous but real cap (25 MB per file) is enforced client-side so a
 * huge file doesn't hang the browser tab holding it all in memory at
 * once; the backend's own 100 MB-per-blob / 100 MB-per-account caps are
 * the authoritative limits.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Buffer } from 'buffer';
import { encryptBytes, decryptBytes } from './crypto';
import {
  getUploadUrl,
  uploadEncryptedBytes,
  getDownloadUrl,
  downloadEncryptedBytes,
  listCategoryBlobs,
  deleteBlobRecord,
  type BlobMeta,
} from './backend';

export type { BlobMeta };

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — see file header for why this isn't the server's own cap

export class FileTooLargeError extends Error {
  constructor(public sizeBytes: number) {
    super(`File is ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB — the limit per file is 25 MB`);
  }
}

/** User canceled the file picker — not an error, just nothing to do. */
export class PickCanceledError extends Error {
  constructor() {
    super('cancelled');
  }
}

/**
 * Opens the OS file picker, reads the chosen file's bytes, encrypts them
 * with masterKeyHex, and uploads the ciphertext for this safe. Returns the
 * new file's metadata once the whole round-trip succeeds.
 */
export async function pickAndUploadFile(
  accountId: string,
  categoryId: string,
  masterKeyHex: string
): Promise<BlobMeta> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets || picked.assets.length === 0) {
    throw new PickCanceledError();
  }
  const asset = picked.assets[0];

  // fetch() reads both blob: URIs (web) and file:// URIs (native) — no
  // extra platform branching needed just to get the raw bytes.
  const res = await fetch(asset.uri);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);

  if (bytes.length > MAX_FILE_BYTES) {
    throw new FileTooLargeError(bytes.length);
  }

  const encrypted = await encryptBytes(bytes, masterKeyHex);
  const fileName = asset.name || 'untitled';
  const mimeType = asset.mimeType || 'application/octet-stream';

  const { blobId, uploadUrl } = await getUploadUrl(accountId, encrypted.length, categoryId, fileName, mimeType);
  try {
    await uploadEncryptedBytes(uploadUrl, encrypted);
  } catch (err) {
    // getUploadUrl already created the metadata row (it needs to, to
    // track storage usage up front) — if the actual R2 PUT then fails
    // (network hiccup, expired URL, ...), clean that row back up rather
    // than leaving a phantom file entry that points at nothing.
    await deleteBlobRecord(accountId, blobId).catch(() => {});
    throw err;
  }

  return {
    blobId,
    fileName,
    mimeType,
    fileSizeBytes: encrypted.length,
    createdAt: new Date().toISOString(),
  };
}

export async function listFilesForCategory(accountId: string, categoryId: string): Promise<BlobMeta[]> {
  return listCategoryBlobs(accountId, categoryId);
}

export async function deleteFile(accountId: string, blobId: string): Promise<void> {
  await deleteBlobRecord(accountId, blobId);
}

/** Web-only choice for what happens to a file once it's decrypted — see downloadAndOpenFile. */
export type FileOpenChoice = 'open' | 'save' | 'both';

/**
 * Downloads + decrypts one file, then hands it to the OS to open/save:
 * on native, writes it to the cache dir and opens the share sheet
 * (expo-sharing), which itself already presents an open/save/share choice
 * via the OS. On web there's no equivalent OS-level chooser — a plain
 * `<a download>` click always force-saves with no way to just view the
 * file — so `choice` picks what actually happens (default 'save', to
 * match the old always-download behavior for any caller that doesn't ask
 * first). Either way, the decrypted bytes only ever exist transiently in
 * memory / the app's own cache — never uploaded anywhere.
 */
export async function downloadAndOpenFile(
  accountId: string,
  blob: Pick<BlobMeta, 'blobId' | 'fileName' | 'mimeType'>,
  masterKeyHex: string,
  choice: FileOpenChoice = 'save'
): Promise<void> {
  const { downloadUrl } = await getDownloadUrl(accountId, blob.blobId);
  const encrypted = await downloadEncryptedBytes(downloadUrl);
  const plainBytes = await decryptBytes(encrypted, masterKeyHex);

  if (Platform.OS === 'web') {
    // Routed through `any`: this project's tsconfig has no "dom" lib (it's
    // a React Native app), so the browser globals used here (Blob/URL/
    // document/window) exist at runtime on web but aren't in scope for the
    // type checker — this whole branch only ever runs when Platform.OS==='web'.
    const g = globalThis as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const blobObject = new g.Blob([plainBytes], { type: blob.mimeType });
    const objectUrl = g.URL.createObjectURL(blobObject);

    if (choice === 'open' || choice === 'both') {
      // Opens in a new tab — the browser renders it inline when it can
      // (PDF/image/text/...), otherwise falls back to its own download
      // prompt for types it can't display.
      g.window.open(objectUrl, '_blank');
    }
    if (choice === 'save' || choice === 'both') {
      const link = g.document.createElement('a');
      link.href = objectUrl;
      link.download = blob.fileName;
      g.document.body.appendChild(link);
      link.click();
      g.document.body.removeChild(link);
    }
    // Give the opened tab / triggered download time to actually read the
    // blob before its URL is revoked.
    setTimeout(() => g.URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const cacheDir = FileSystem.cacheDirectory ?? '';
  const targetUri = `${cacheDir}${blob.fileName}`;
  const base64 = Buffer.from(plainBytes).toString('base64');
  await FileSystem.writeAsStringAsync(targetUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(targetUri, { mimeType: blob.mimeType, dialogTitle: blob.fileName });
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
