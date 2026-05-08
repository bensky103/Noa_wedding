// Browser-only utility module. SSR-safe: every public function checks
// `typeof window === 'undefined'` and returns sensible defaults if so.
//
// Storage keys:
//   - noa.uploaderName : string (trimmed, max 30 chars)
//   - noa.uploadCount  : integer count of successful uploads on this device

import { publicEnv } from './env';

const NAME_KEY = 'noa.uploaderName';
const COUNT_KEY = 'noa.uploadCount';
const NAME_MAX_LENGTH = 30;

export const MAX_UPLOADS = publicEnv.MAX_UPLOADS_PER_USER;

export function getUploaderName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function setUploaderName(name: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = name.trim().slice(0, NAME_MAX_LENGTH);
  try {
    window.localStorage.setItem(NAME_KEY, cleaned);
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function clearUploaderName(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(NAME_KEY);
  } catch {
    // ignore
  }
}

export function getUploadCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(COUNT_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementUploadCount(): number {
  if (typeof window === 'undefined') return 0;
  const next = getUploadCount() + 1;
  try {
    window.localStorage.setItem(COUNT_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function canUploadMore(): boolean {
  if (typeof window === 'undefined') return false;
  return getUploadCount() < MAX_UPLOADS;
}
