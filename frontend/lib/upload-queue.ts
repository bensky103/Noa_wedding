// Browser-only upload queue with localStorage persistence.
//
// Design notes:
//   - File blobs cannot live in localStorage. We keep an in-memory
//     Map<id, File>. On reload, any persisted item without a backing File
//     is marked 'failed' so the user can re-pick it.
//   - Storage key is versioned (v1) so we can bump the format later.

import {
  CloudinaryUploadError,
  uploadToCloudinary,
  type UploadResult,
} from './cloudinary';
import { getUploadCount, incrementUploadCount, MAX_UPLOADS } from './identity';

export type QueueItem = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'queued' | 'uploading' | 'retrying' | 'failed' | 'done';
  progress: number;
  attempts: number;
  uploader: string;
  caption: string;
  retryAt?: number;
  error?: string;
};

export const MAX_PARALLEL = 3;
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
export const MAX_FILE_SIZE_IMAGE = 10 * 1024 * 1024;
export const MAX_FILE_SIZE_VIDEO = 100 * 1024 * 1024;
export const ACCEPTED_TYPES = /^(image\/|video\/(mp4|quicktime))/;

const STORAGE_KEY = 'noa.uploadQueue.v1';
const LOST_FILE_ERROR = 'הקובץ אבד בעת רענון הדף';

// =====================================================================
// State
// =====================================================================

const items: QueueItem[] = [];
const files = new Map<string, File>();
const stateListeners = new Set<(state: QueueItem[]) => void>();
const uploadListeners = new Set<(result: UploadResult) => void>();
let started = false;
let hydrated = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function uuid(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  // Fallback: not cryptographically strong, but only used as a queue id.
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function snapshot(): QueueItem[] {
  return items.map((it) => ({ ...it }));
}

function notifyState(): void {
  const snap = snapshot();
  for (const listener of stateListeners) {
    try {
      listener(snap);
    } catch {
      // listener errors must not break the queue
    }
  }
}

function notifyUpload(result: UploadResult): void {
  for (const listener of uploadListeners) {
    try {
      listener(result);
    } catch {
      // ignore
    }
  }
}

// =====================================================================
// Persistence
// =====================================================================

function persist(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function hydrate(): void {
  if (!isBrowser() || hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as QueueItem[];
    if (!Array.isArray(parsed)) return;
    for (const it of parsed) {
      // Files are not persisted; any item we restore is missing its blob.
      items.push({
        ...it,
        status: 'failed',
        error: LOST_FILE_ERROR,
        progress: 0,
        retryAt: undefined,
      });
    }
    persist();
  } catch {
    // corrupt state — drop it
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

// =====================================================================
// Public: pre-flight & add
// =====================================================================

export function preflight(
  file: File,
): { ok: true } | { ok: false; reason: string } {
  if (!ACCEPTED_TYPES.test(file.type)) {
    return { ok: false, reason: 'סוג הקובץ לא נתמך' };
  }
  const isVideo = file.type.startsWith('video/');
  const limit = isVideo ? MAX_FILE_SIZE_VIDEO : MAX_FILE_SIZE_IMAGE;
  if (file.size > limit) {
    return {
      ok: false,
      reason: 'הקובץ גדול מדי, מקסימום 10MB לתמונה / 100MB לסרטון',
    };
  }
  return { ok: true };
}

export type AddResult = {
  added: QueueItem[];
  rejected: { file: File; reason: string }[];
};

export function addFiles(
  filesIn: File[],
  opts: { uploader: string },
): AddResult {
  hydrate();
  const added: QueueItem[] = [];
  const rejected: { file: File; reason: string }[] = [];

  // Cap check: uploaded successes (counter) + queued/in-flight
  const inFlight = items.filter((it) =>
    it.status === 'queued' ||
    it.status === 'uploading' ||
    it.status === 'retrying',
  ).length;
  let remaining = Math.max(0, MAX_UPLOADS - getUploadCount() - inFlight);

  for (const file of filesIn) {
    if (remaining <= 0) {
      rejected.push({ file, reason: 'הגעת למגבלת ההעלאות' });
      continue;
    }
    const pre = preflight(file);
    if (!pre.ok) {
      rejected.push({ file, reason: pre.reason });
      continue;
    }
    const id = uuid();
    const item: QueueItem = {
      id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      status: 'queued',
      progress: 0,
      attempts: 0,
      uploader: opts.uploader,
      caption: '',
    };
    items.push(item);
    files.set(id, file);
    added.push({ ...item });
    remaining -= 1;
  }

  if (added.length > 0) {
    persist();
    notifyState();
    if (started) processQueue();
  }
  return { added, rejected };
}

export function setCaption(id: string, caption: string): void {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.caption = caption;
  persist();
  notifyState();
}

export function removeFromQueue(id: string): void {
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return;
  items.splice(idx, 1);
  files.delete(id);
  persist();
  notifyState();
}

// Surgical addition: expose the in-memory File so the queue UI can render
// a thumbnail via URL.createObjectURL. Returns null if the blob is no
// longer available (e.g., after a page reload — see hydrate()).
export function getFileBlob(id: string): File | null {
  return files.get(id) ?? null;
}

// Surgical addition: allow the UI to manually re-queue a 'failed' item.
// Resets attempt counter and error so the next run gets the full
// retry budget. No-op for items in any other state.
export function retry(id: string): void {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  if (it.status !== 'failed') return;
  if (!files.has(id)) {
    // Blob was lost (probably after reload). User must re-pick.
    return;
  }
  it.status = 'queued';
  it.attempts = 0;
  it.error = undefined;
  it.progress = 0;
  it.retryAt = undefined;
  persist();
  notifyState();
  if (started) processQueue();
}

// =====================================================================
// Public: subscriptions
// =====================================================================

export function subscribe(
  listener: (state: QueueItem[]) => void,
): () => void {
  hydrate();
  stateListeners.add(listener);
  // Fire immediately with current state for convenience.
  try {
    listener(snapshot());
  } catch {
    // ignore
  }
  return () => {
    stateListeners.delete(listener);
  };
}

export function getState(): QueueItem[] {
  hydrate();
  return snapshot();
}

export function subscribeToUploads(
  listener: (result: UploadResult) => void,
): () => void {
  uploadListeners.add(listener);
  return () => {
    uploadListeners.delete(listener);
  };
}

// =====================================================================
// Worker
// =====================================================================

export function start(): void {
  if (started) return;
  hydrate();
  started = true;
  processQueue();
}

function activeCount(): number {
  return items.filter(
    (it) => it.status === 'uploading' || it.status === 'retrying',
  ).length;
}

function processQueue(): void {
  if (!started) return;
  while (activeCount() < MAX_PARALLEL) {
    const next = items.find((it) => it.status === 'queued');
    if (!next) return;
    runItem(next);
  }
}

function runItem(item: QueueItem): void {
  const file = files.get(item.id);
  if (!file) {
    item.status = 'failed';
    item.error = LOST_FILE_ERROR;
    persist();
    notifyState();
    return;
  }
  item.status = 'uploading';
  item.progress = 0;
  item.retryAt = undefined;
  item.error = undefined;
  persist();
  notifyState();

  uploadToCloudinary(file, {
    uploader: item.uploader,
    caption: item.caption,
    onProgress: (pct) => {
      item.progress = pct;
      notifyState();
    },
  })
    .then((result) => {
      item.status = 'done';
      item.progress = 100;
      persist();
      notifyState();
      notifyUpload(result);
      try {
        incrementUploadCount();
      } catch {
        // ignore
      }
      // Clean up after a brief moment so UI can show the success state.
      setTimeout(() => {
        const idx = items.findIndex((x) => x.id === item.id);
        if (idx !== -1) {
          items.splice(idx, 1);
          files.delete(item.id);
          persist();
          notifyState();
        }
        processQueue();
      }, 1000);
    })
    .catch((err: unknown) => {
      const isRetriable =
        err instanceof CloudinaryUploadError ? err.retriable : true;
      const message =
        err instanceof Error ? err.message : 'שגיאה לא ידועה';
      item.attempts += 1;

      if (isRetriable && item.attempts <= BACKOFF_MS.length) {
        const delay = BACKOFF_MS[item.attempts - 1];
        item.status = 'retrying';
        item.retryAt = Date.now() + delay;
        item.error = message;
        persist();
        notifyState();
        setTimeout(() => {
          // Only flip back to queued if still retrying (not removed).
          const it = items.find((x) => x.id === item.id);
          if (it && it.status === 'retrying') {
            it.status = 'queued';
            it.retryAt = undefined;
            persist();
            notifyState();
            processQueue();
          }
        }, delay);
      } else {
        item.status = 'failed';
        item.error = message;
        item.retryAt = undefined;
        persist();
        notifyState();
        processQueue();
      }
    });
}
