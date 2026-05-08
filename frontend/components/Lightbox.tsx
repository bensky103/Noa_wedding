'use client';

import { useEffect } from 'react';
import {
  downloadUrl,
  fullsizeUrl,
  videoStreamUrl,
  type Photo,
} from '@/lib/cloudinary';

type Props = {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  isAdmin: boolean;
  onDelete: (photo: Photo) => void;
};

export default function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
  isAdmin,
  onDelete,
}: Props) {
  const photo = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // RTL: in Hebrew reading order, "previous" is ArrowRight,
      // "next" is ArrowLeft. So navigate accordingly.
      if (e.key === 'ArrowRight') {
        if (index > 0) onNavigate(index - 1);
      } else if (e.key === 'ArrowLeft') {
        if (index < photos.length - 1) onNavigate(index + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onNavigate, onClose]);

  if (!photo) return null;

  const uploader = photo.context?.custom?.uploader;
  const caption = photo.context?.custom?.caption;
  const isVideo = photo.resource_type === 'video';
  const fullUrl = isVideo
    ? videoStreamUrl(photo.public_id)
    : fullsizeUrl(photo.public_id, photo.resource_type, photo.format);

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex justify-end p-3">
        <button
          type="button"
          aria-label="סגור"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-6 h-6"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-2 relative">
        {hasPrev && (
          <button
            type="button"
            aria-label="הקודם"
            onClick={() => onNavigate(index - 1)}
            className="absolute end-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            {/* RTL: previous = arrow pointing right */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-6 h-6"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {hasNext && (
          <button
            type="button"
            aria-label="הבא"
            onClick={() => onNavigate(index + 1)}
            className="absolute start-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            {/* RTL: next = arrow pointing left */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-6 h-6"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {isVideo ? (
          <video
            controls
            playsInline
            src={fullUrl}
            className="max-h-[80vh] max-w-full mx-auto"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fullUrl}
            alt={caption ?? uploader ?? ''}
            className="max-h-[80vh] max-w-full object-contain mx-auto"
          />
        )}
      </div>

      <div className="px-4 pb-4 pt-2 text-white">
        {caption && (
          <p className="text-base text-center mb-1">{caption}</p>
        )}
        {uploader && (
          <p className="text-sm text-white/70 text-center mb-3">
            {uploader}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <a
            href={downloadUrl(photo.public_id, photo.resource_type, photo.format)}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-white text-stone-900 font-medium px-5 py-2 hover:bg-stone-100"
          >
            הורד
          </a>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(photo)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-rose-600 text-white font-medium px-5 py-2 hover:bg-rose-700"
            >
              מחק
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
