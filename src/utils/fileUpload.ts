import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db, storage, auth } from '../firebase/config';

const STORAGE_UNAVAILABLE_KEY = 'ckh_storage_unavailable_v1';
const DIRECT_DATA_URL_MAX_CHARS = 120_000; // Keep parent Firestore docs compact (<90KB inline)
const CHUNK_CHAR_SIZE = 450_000; // Safely within Firestore 1MB per-document limit

export const FILE_UPLOAD_CONFIG = {
  maxSizeBytes: 8 * 1024 * 1024, // 8MB configurable limit
  allowedExtensions: [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'csv',
    'jpg',
    'jpeg',
    'png',
    'webp',
  ] as const,
};

const ALLOWED_MIME_BY_EXT: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword', 'application/vnd.ms-word'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  xls: ['application/vnd.ms-excel', 'application/msexcel'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
  ],
  txt: ['text/plain'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
};

const BLOCKED_MIME_TYPES = new Set([
  'text/html',
  'application/javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/x-executable',
  'image/svg+xml',
]);

let storageUnavailableInSession =
  typeof window !== 'undefined' &&
  window.sessionStorage?.getItem(STORAGE_UNAVAILABLE_KEY) === '1';

function markStorageUnavailable() {
  storageUnavailableInSession = true;
  try {
    window.sessionStorage?.setItem(STORAGE_UNAVAILABLE_KEY, '1');
  } catch {
    // Ignore storage quota errors
  }
}

export interface FastUploadResult {
  url: string;
  storagePath?: string;
  extension: string;
  mimeType: string;
  size: number;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return (parts.pop() || '').trim().toLowerCase();
}

export function validateUploadFile(file: File): { valid: boolean; error?: string; extension: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.', extension: '' };
  }

  const ext = getFileExtension(file.name);
  if (!ext || !(FILE_UPLOAD_CONFIG.allowedExtensions as readonly string[]).includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format ".${ext || 'unknown'}". Allowed formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, JPG, JPEG, PNG, WEBP.`,
      extension: ext,
    };
  }

  const mime = (file.type || '').toLowerCase().trim();
  if (mime) {
    if (BLOCKED_MIME_TYPES.has(mime)) {
      return {
        valid: false,
        error: `Security policy blocked file MIME type "${mime}".`,
        extension: ext,
      };
    }
    const allowedMimes = ALLOWED_MIME_BY_EXT[ext] || [];
    if (mime !== 'application/octet-stream' && allowedMimes.length > 0 && !allowedMimes.includes(mime)) {
      return {
        valid: false,
        error: `File MIME type (${mime}) does not match extension ".${ext}". Please upload a valid ${ext.toUpperCase()} file.`,
        extension: ext,
      };
    }
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: `Selected file "${file.name}" is empty (0 bytes).`,
      extension: ext,
    };
  }

  if (file.size > FILE_UPLOAD_CONFIG.maxSizeBytes) {
    const maxMb = (FILE_UPLOAD_CONFIG.maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File "${file.name}" (${formatFileSize(file.size)}) exceeds the ${maxMb}MB upload limit.`,
      extension: ext,
    };
  }

  return { valid: true, extension: ext };
}

export function validateExternalUrl(rawUrl: string): { valid: boolean; error?: string; normalized?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please provide a valid URL.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'Only http:// and https:// URLs are allowed.' };
    }
    return { valid: true, normalized: parsed.toString() };
  } catch {
    return { valid: false, error: 'Please enter a valid URL starting with https:// or http://.' };
  }
}

export function isPreviewSupported(fileType?: string, fileName?: string, url?: string): boolean {
  const t = (fileType || '').toLowerCase();
  const n = (fileName || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (
    ['pdf', 'txt', 'csv', 'md', 'json', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(t) ||
    /\.(pdf|txt|csv|md|json|jpe?g|png|webp|gif)(\?|$)/i.test(n) ||
    u.startsWith('data:image/') ||
    u.startsWith('data:application/pdf') ||
    u.startsWith('data:text/')
  ) {
    return true;
  }

  return u.includes('docs.google.com') || u.includes('drive.google.com');
}

export function isChunkedFileUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('firestore-chunks://');
}

function parseChunkedUrl(url: string): { groupId: string; chunks: number; mime: string } | null {
  if (!isChunkedFileUrl(url)) return null;
  try {
    const withoutScheme = url.replace('firestore-chunks://', '');
    const [groupId, queryStr = ''] = withoutScheme.split('?');
    const params = new URLSearchParams(queryStr);
    const chunks = Number(params.get('chunks') || '0');
    const mime = params.get('mime') || 'application/octet-stream';
    if (!groupId || !chunks || Number.isNaN(chunks)) return null;
    return { groupId, chunks, mime };
  } catch {
    return null;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Unable to read selected file from disk.'));
    reader.readAsDataURL(file);
  });
}

async function storeFileViaFirestore(
  file: File,
  folder: string,
  extension: string,
  onProgress: (pct: number) => void
): Promise<FastUploadResult> {
  onProgress(25);
  const dataUrl = await readFileAsDataUrl(file);
  onProgress(55);

  const mime = file.type || ALLOWED_MIME_BY_EXT[extension]?.[0] || 'application/octet-stream';

  // For single document records that are very small (<90KB), store inline;
  // for knowledge attachments or larger files, always segment into file_chunks so parent doc stays lightweight
  if (folder !== 'knowledge_attachments' && dataUrl.length <= DIRECT_DATA_URL_MAX_CHARS) {
    onProgress(100);
    return {
      url: dataUrl,
      storagePath: undefined,
      extension,
      mimeType: mime,
      size: file.size,
    };
  }

  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required before uploading files.');
  }

  const groupId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const totalChunks = Math.ceil(dataUrl.length / CHUNK_CHAR_SIZE);
  const chunksCol = collection(db, 'file_chunks');
  const writtenChunkIds: string[] = [];

  try {
    const BATCH_SIZE = 4;
    for (let start = 0; start < totalChunks; start += BATCH_SIZE) {
      const batchPromises: Promise<void>[] = [];
      for (let i = start; i < Math.min(start + BATCH_SIZE, totalChunks); i++) {
        const slice = dataUrl.slice(i * CHUNK_CHAR_SIZE, (i + 1) * CHUNK_CHAR_SIZE);
        const chunkId = `fc_${groupId}_${i}`;
        batchPromises.push(
          setDoc(doc(chunksCol, chunkId), {
            id: chunkId,
            groupId,
            index: i,
            data: slice,
            createdBy: uid,
            createdAt: new Date().toISOString(),
          }).then(() => {
            writtenChunkIds.push(chunkId);
          })
        );
      }
      await Promise.all(batchPromises);
      const completedRatio = Math.min(totalChunks, start + BATCH_SIZE) / totalChunks;
      onProgress(Math.round(55 + completedRatio * 43));
    }

    onProgress(100);
    return {
      url: `firestore-chunks://${groupId}?chunks=${totalChunks}&mime=${encodeURIComponent(mime)}`,
      storagePath: `chunks:${groupId}:${totalChunks}`,
      extension,
      mimeType: mime,
      size: file.size,
    };
  } catch (err) {
    // Roll back partial chunks on failure so no orphaned data remains
    await Promise.all(
      writtenChunkIds.map((id) => deleteDoc(doc(chunksCol, id)).catch(() => {}))
    );
    throw new Error(
      err instanceof Error
        ? `Persistent file upload failed: ${err.message}`
        : 'Persistent file upload failed.'
    );
  }
}

export async function uploadFileFast(
  file: File,
  folder: string,
  onProgress: (pct: number) => void
): Promise<FastUploadResult> {
  const validation = validateUploadFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file.');
  }

  onProgress(12);

  // If Storage already proved unavailable/stalled in this session, skip probe wait for fast save
  if (storageUnavailableInSession) {
    return storeFileViaFirestore(file, folder, validation.extension, onProgress);
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${Date.now()}_${cleanFileName}`;
  const storageRef = ref(storage, storagePath);

  const cloudResult = await new Promise<FastUploadResult | null>((resolve) => {
    let settled = false;
    let hasProgress = false;
    const uploadTask = uploadBytesResumable(storageRef, file);

    // If 0 bytes transferred within 1.5s, Storage bucket is unreachable/CORS-blocked — switch fast
    const stallTimer = setTimeout(() => {
      if (!settled && !hasProgress) {
        settled = true;
        markStorageUnavailable();
        try {
          uploadTask.cancel();
        } catch {
          // Ignore cancel error
        }
        resolve(null);
      }
    }, 1500);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.bytesTransferred > 0) {
          hasProgress = true;
          clearTimeout(stallTimer);
          const pct = Math.max(15, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          onProgress(pct);
        }
      },
      () => {
        clearTimeout(stallTimer);
        if (!settled) {
          settled = true;
          markStorageUnavailable();
          resolve(null);
        }
      },
      async () => {
        clearTimeout(stallTimer);
        if (settled) return;
        settled = true;
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onProgress(100);
          resolve({
            url,
            storagePath,
            extension: validation.extension,
            mimeType: file.type || ALLOWED_MIME_BY_EXT[validation.extension]?.[0] || 'application/octet-stream',
            size: file.size,
          });
        } catch {
          markStorageUnavailable();
          resolve(null);
        }
      }
    );
  });

  if (cloudResult) {
    return cloudResult;
  }

  return storeFileViaFirestore(file, folder, validation.extension, onProgress);
}

export async function resolveStoredFileUrl(fileUrl: string): Promise<string> {
  const parsed = parseChunkedUrl(fileUrl);
  if (!parsed) return fileUrl;

  const chunkDocs = await Promise.all(
    Array.from({ length: parsed.chunks }, (_, idx) =>
      getDoc(doc(db, 'file_chunks', `fc_${parsed.groupId}_${idx}`))
    )
  );

  const joined = chunkDocs.map((snap) => (snap.exists() ? (snap.data().data as string) : '')).join('');
  if (!joined) {
    throw new Error('Stored file chunks could not be retrieved.');
  }
  return joined;
}

export async function deleteChunkedFile(urlOrPath?: string): Promise<void> {
  if (!urlOrPath) return;

  let groupId = '';
  let total = 0;

  if (urlOrPath.startsWith('chunks:')) {
    const parts = urlOrPath.split(':');
    groupId = parts[1] || '';
    total = Number(parts[2] || '0');
  } else if (isChunkedFileUrl(urlOrPath)) {
    const parsed = parseChunkedUrl(urlOrPath);
    if (parsed) {
      groupId = parsed.groupId;
      total = parsed.chunks;
    }
  }

  if (!groupId || !total) return;

  await Promise.all(
    Array.from({ length: total }, (_, idx) =>
      deleteDoc(doc(db, 'file_chunks', `fc_${groupId}_${idx}`)).catch(() => {})
    )
  );
}

export async function cleanupStoredFile(fileUrl?: string, storagePath?: string): Promise<void> {
  if (storagePath?.startsWith('chunks:') || (fileUrl && isChunkedFileUrl(fileUrl))) {
    await deleteChunkedFile(storagePath || fileUrl);
    return;
  }
  const target =
    storagePath ||
    (fileUrl && (fileUrl.includes('firebasestorage.googleapis.com') || fileUrl.startsWith('gs://'))
      ? fileUrl
      : '');
  if (!target) return;
  try {
    await deleteObject(ref(storage, target));
  } catch (err) {
    console.warn('Storage file cleanup skipped or already deleted:', err);
  }
}
