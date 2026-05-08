'use client';

import { thumbnailUrl, thumbnailSrcSet, type Photo } from '@/lib/cloudinary';

type Props = {
  photo: Photo;
  isNew: boolean;
  isAdmin: boolean;
  onClick: () => void;
  onDelete: (photo: Photo) => void;
};

export default function PhotoCard({
  photo,
  isNew,
  isAdmin,
  onClick,
  onDelete,
}: Props) {
  const uploader = photo.context?.custom?.uploader;
  const caption = photo.context?.custom?.caption;
  const isVideo = photo.resource_type === 'video';
  const src = thumbnailUrl(photo.public_id, photo.resource_type, photo.format);
  const srcSet = thumbnailSrcSet(photo.public_id, photo.resource_type, photo.format);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-200 shadow-sm ring-1 ring-stone-200 group transition hover:shadow-md hover:ring-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
      aria-label={caption || uploader || 'תמונה'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        alt={caption ?? uploader ?? ''}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />

      {isVideo && (
        <span
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <span className="w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          </span>
        </span>
      )}

      {(uploader || caption) && (
        <div className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-xs p-1.5 text-start">
          {caption && (
            <div className="truncate font-medium">{caption}</div>
          )}
          {uploader && (
            <div className="truncate text-white/80">{uploader}</div>
          )}
        </div>
      )}

      {isNew && (
        <span className="absolute top-1.5 end-1.5 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow animate-pulse">
          ✨ חדש
        </span>
      )}

      {isAdmin && (
        <span
          role="button"
          aria-label="מחק תמונה"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(photo);
          }}
          className="absolute top-1.5 start-1.5 bg-rose-600 text-white p-1.5 rounded-full shadow cursor-pointer hover:bg-rose-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-4 h-4"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </span>
      )}
    </button>
  );
}
