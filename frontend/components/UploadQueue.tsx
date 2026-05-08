'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getFileBlob,
  removeFromQueue,
  retry,
  setCaption,
  subscribe,
  type QueueItem,
} from '@/lib/upload-queue';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ item }: { item: QueueItem }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (item.status !== 'retrying') return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [item.status]);

  switch (item.status) {
    case 'queued':
      return (
        <span className="inline-block rounded-full bg-stone-200 text-stone-700 text-xs px-2 py-0.5">
          בתור
        </span>
      );
    case 'uploading':
      return (
        <span className="inline-block rounded-full bg-rose-100 text-rose-700 text-xs px-2 py-0.5">
          מעלה...
        </span>
      );
    case 'retrying': {
      const remaining = item.retryAt
        ? Math.max(0, Math.ceil((item.retryAt - now) / 1000))
        : 0;
      return (
        <span className="inline-block rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5">
          {`מנסה שוב בעוד ${remaining}ש'`}
        </span>
      );
    }
    case 'failed':
      return (
        <span className="inline-block rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5">
          נכשל{item.error ? `: ${item.error}` : ''}
        </span>
      );
    case 'done':
      return (
        <span className="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5">
          הועלה ✓
        </span>
      );
  }
}

function Thumb({ item }: { item: QueueItem }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const blob = getFileBlob(item.id);
    if (!blob) {
      setSrc(null);
      return;
    }
    if (!blob.type.startsWith('image/')) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [item.id]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="w-12 h-12 rounded object-cover bg-stone-200 shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded bg-stone-200 shrink-0 flex items-center justify-center text-stone-500 text-xs">
      {item.mimeType.startsWith('video/') ? '🎬' : '📄'}
    </div>
  );
}

export default function UploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    const unsub = subscribe((state) => setItems(state));
    return unsub;
  }, []);

  const visible = useMemo(
    () => items.filter((it) => it.status !== 'done'),
    [items],
  );

  if (visible.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-stone-200 shadow-2xl max-h-[50vh] overflow-y-auto transition-transform"
      role="region"
      aria-label="תור העלאות"
    >
      <ul className="divide-y divide-stone-100">
        {visible.map((item) => (
          <li key={item.id} className="p-3 flex gap-3 items-start">
            <Thumb item={item} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-stone-900 truncate max-w-[40vw]">
                  {item.fileName}
                </span>
                <span className="text-xs text-stone-500">
                  {formatSize(item.fileSize)}
                </span>
                <StatusBadge item={item} />
              </div>

              {item.status === 'uploading' && (
                <div className="h-1.5 w-full bg-stone-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-rose-600 transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {(item.status === 'queued' || item.status === 'retrying') && (
                <input
                  type="text"
                  defaultValue={item.caption}
                  placeholder="הוסף כיתוב (לא חובה)"
                  maxLength={140}
                  onChange={(e) => setCaption(item.id, e.target.value)}
                  className="w-full text-sm rounded border border-stone-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              )}

              {item.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => retry(item.id)}
                  className="text-xs font-medium text-rose-700 hover:text-rose-900 underline"
                >
                  נסה שוב
                </button>
              )}
            </div>

            <button
              type="button"
              aria-label="הסר מהתור"
              onClick={() => {
                if (item.status === 'uploading') {
                  if (!window.confirm('להפסיק את ההעלאה?')) return;
                }
                removeFromQueue(item.id);
              }}
              className="text-stone-400 hover:text-stone-700 p-1 shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
