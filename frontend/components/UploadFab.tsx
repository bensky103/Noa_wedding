'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getUploaderName,
  getUploadCount,
  MAX_UPLOADS,
} from '@/lib/identity';
import {
  addFiles,
  start as startQueue,
  subscribe,
  subscribeToUploads,
} from '@/lib/upload-queue';
import NameGate from './NameGate';

export default function UploadFab() {
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [showNameGate, setShowNameGate] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCount(getUploadCount());
    startQueue();
    const unsubState = subscribe(() => {
      // Counter updates via successful uploads, not queue state — but
      // re-read in case localStorage was modified by another tab.
      setCount(getUploadCount());
    });
    const unsubUploads = subscribeToUploads(() => {
      setCount(getUploadCount());
    });
    return () => {
      unsubState();
      unsubUploads();
    };
  }, []);

  // Collapse when tapping outside the FAB cluster.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (
        containerRef.current &&
        target &&
        !containerRef.current.contains(target)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [expanded]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const atCap = count >= MAX_UPLOADS;

  const handleFiles = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const arr = Array.from(filesList);
    const name = getUploaderName();
    if (!name) {
      setShowNameGate(true);
      // User will need to re-pick after entering their name. This is the
      // simplest path and the message below explains the next step.
      showToast('הזינו את שמכם ובחרו את הקבצים שוב');
      return;
    }
    const result = addFiles(arr, { uploader: name });
    if (result.rejected.length > 0) {
      const lines = result.rejected.map(
        (r) => `${r.file.name}: ${r.reason}`,
      );
      showToast(lines.join('\n'));
    }
  };

  const onPickCamera = () => {
    if (atCap) {
      showToast('הגעת למקסימום של 15 העלאות');
      return;
    }
    setExpanded(false);
    cameraRef.current?.click();
  };

  const onPickGallery = () => {
    if (atCap) {
      showToast('הגעת למקסימום של 15 העלאות');
      return;
    }
    setExpanded(false);
    pickerRef.current?.click();
  };

  const onFabClick = () => {
    if (atCap) {
      showToast('הגעת למקסימום של 15 העלאות');
      return;
    }
    setExpanded((v) => !v);
  };

  return (
    <>
      <NameGate
        open={showNameGate}
        onClose={() => setShowNameGate(false)}
        required
      />

      {toast && (
        <div className="fixed bottom-28 inset-x-4 z-40 mx-auto max-w-sm rounded-lg bg-stone-900/95 text-white text-sm px-4 py-3 shadow-lg whitespace-pre-line text-center">
          {toast}
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={pickerRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div
        ref={containerRef}
        className="fixed bottom-6 end-6 z-30 flex flex-col items-end gap-3"
      >
        {expanded && (
          <div className="flex flex-col gap-2 animate-in">
            <button
              type="button"
              onClick={onPickCamera}
              className="min-h-[44px] rounded-full bg-white shadow-lg px-5 py-3 text-stone-900 font-medium transition hover:bg-stone-100"
            >
              📷 צלם
            </button>
            <button
              type="button"
              onClick={onPickGallery}
              className="min-h-[44px] rounded-full bg-white shadow-lg px-5 py-3 text-stone-900 font-medium transition hover:bg-stone-100"
            >
              🖼️ בחר מהגלריה
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onFabClick}
          disabled={atCap}
          aria-label="העלאת תמונה"
          className="relative w-16 h-16 rounded-full bg-rose-600 text-white shadow-xl flex items-center justify-center transition hover:bg-rose-700 disabled:bg-stone-400 disabled:cursor-not-allowed active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-7 h-7 transition-transform ${expanded ? 'rotate-45' : ''}`}
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span
            dir="ltr"
            className="absolute -top-1 -start-1 bg-stone-900 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow"
          >
            {count} / {MAX_UPLOADS}
          </span>
        </button>
      </div>
    </>
  );
}
