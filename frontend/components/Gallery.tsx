'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cloudinaryListUrl,
  cloudinaryListVideoUrl,
  type Photo,
} from '@/lib/cloudinary';
import { publicEnv } from '@/lib/env';
import { subscribeToUploads } from '@/lib/upload-queue';
import PhotoCard from './PhotoCard';
import Lightbox from './Lightbox';

const POLL_INTERVAL_MS = 30_000;
const NEW_BADGE_MS = 5_000;
const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

type ListResponseItem = {
  public_id: string;
  format?: string;
  width?: number;
  height?: number;
  created_at?: string;
  resource_type?: 'image' | 'video';
  context?: { custom?: { uploader?: string; caption?: string } };
  bytes?: number;
};

function dedupe(photos: Photo[]): Photo[] {
  const seen = new Set<string>();
  const out: Photo[] = [];
  for (const p of photos) {
    if (seen.has(p.public_id)) continue;
    seen.add(p.public_id);
    out.push(p);
  }
  return out;
}

function sortByCreated(photos: Photo[]): Photo[] {
  return [...photos].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

async function fetchClientList(
  url: string,
  resourceType: 'image' | 'video',
): Promise<Photo[]> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) return [];
    if (!res.ok) return [];
    const data = (await res.json()) as { resources?: ListResponseItem[] };
    if (!data.resources) return [];
    return data.resources.map((r) => ({
      public_id: r.public_id,
      resource_type: r.resource_type ?? resourceType,
      format: r.format ?? '',
      width: r.width ?? 0,
      height: r.height ?? 0,
      created_at: r.created_at ?? new Date().toISOString(),
      context: r.context,
      bytes: r.bytes,
    }));
  } catch {
    return [];
  }
}

function dayKey(iso: string): string {
  // Use the local-day part of the ISO timestamp.
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

type Props = {
  initialPhotos: Photo[];
};

export default function Gallery({ initialPhotos }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(() =>
    sortByCreated(dedupe(initialPhotos)),
  );
  const [lightboxPublicId, setLightboxPublicId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newPhotoIds, setNewPhotoIds] = useState<Set<string>>(new Set());
  const adminKeyRef = useRef<string | null>(null);

  // Detect admin once on mount.
  useEffect(() => {
    try {
      const key = window.sessionStorage.getItem('noa.adminKey');
      if (key) {
        adminKeyRef.current = key;
        setIsAdmin(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Mark IDs as "new" and clear after NEW_BADGE_MS.
  const markNew = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setNewPhotoIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setNewPhotoIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }, NEW_BADGE_MS);
  }, []);

  // Polling.
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tag = publicEnv.WEDDING_TAG;

    const poll = async () => {
      if (document.hidden) return;
      const [imgs, vids] = await Promise.all([
        fetchClientList(cloudinaryListUrl(tag), 'image'),
        fetchClientList(cloudinaryListVideoUrl(tag), 'video'),
      ]);
      if (cancelled) return;
      setPhotos((current) => {
        const known = new Set(current.map((p) => p.public_id));
        const merged = sortByCreated(dedupe([...current, ...imgs, ...vids]));
        const newIds = merged
          .filter((p) => !known.has(p.public_id))
          .map((p) => p.public_id);
        if (newIds.length > 0) {
          // Defer setState to avoid setState-in-render warnings.
          window.setTimeout(() => markNew(newIds), 0);
        }
        return merged;
      });
    };

    // Initial fetch on mount (gives fresher than ISR shell).
    void poll();
    intervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);

    const onVis = () => {
      if (document.hidden) {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        void poll();
        if (intervalRef.current === null) {
          intervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [markNew]);

  // Optimistic prepend on successful upload.
  useEffect(() => {
    const unsub = subscribeToUploads((result) => {
      const photo: Photo = {
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
        created_at: result.created_at,
        context: result.context as Photo['context'],
      };
      setPhotos((current) => sortByCreated(dedupe([photo, ...current])));
      markNew([result.public_id]);
    });
    return unsub;
  }, [markNew]);

  const handleDelete = useCallback(
    async (photo: Photo) => {
      if (!isAdmin) return;
      if (!window.confirm('למחוק את התמונה הזו?')) return;
      const key = adminKeyRef.current;
      if (!key) return;
      try {
        const url = `/api/photos/${encodeURIComponent(photo.public_id)}?resource_type=${photo.resource_type}`;
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${key}` },
        });
        if (res.ok || res.status === 404) {
          setPhotos((current) =>
            current.filter((p) => p.public_id !== photo.public_id),
          );
          setLightboxPublicId(null);
        } else {
          window.alert('המחיקה נכשלה');
        }
      } catch {
        window.alert('המחיקה נכשלה');
      }
    },
    [isAdmin],
  );

  // Group by day.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; sample: string; items: Photo[] }>();
    for (const p of photos) {
      const k = dayKey(p.created_at);
      const existing = map.get(k);
      if (existing) {
        existing.items.push(p);
      } else {
        map.set(k, { label: dayLabel(p.created_at), sample: p.created_at, items: [p] });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.sample).getTime() - new Date(a.sample).getTime(),
    );
  }, [photos]);

  const openLightbox = (publicId: string) => {
    setLightboxPublicId(publicId);
  };

  const lightboxIndex =
    lightboxPublicId === null
      ? -1
      : photos.findIndex((p) => p.public_id === lightboxPublicId);

  // If the photo no longer exists (e.g., admin deleted it from another tab),
  // close the lightbox.
  useEffect(() => {
    if (lightboxPublicId !== null && lightboxIndex < 0) {
      setLightboxPublicId(null);
    }
  }, [lightboxPublicId, lightboxIndex]);

  return (
    <div className="px-3 sm:px-6">
      <header className="text-center pt-8 pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-stone-900">
          האלבום של נועה ❤️
        </h1>
        <p className="text-sm sm:text-base text-stone-500 mt-2">
          כל התמונות שהאורחים שלנו צילמו
        </p>
      </header>

      {photos.length === 0 ? (
        <div className="py-24 text-center text-stone-500 text-base">
          עוד אין תמונות. תהיו הראשונים להעלות!
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur-sm py-2 text-sm font-bold text-stone-700">
                {group.label}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 sm:gap-2">
                {group.items.map((photo) => (
                  <PhotoCard
                    key={photo.public_id}
                    photo={photo}
                    isNew={newPhotoIds.has(photo.public_id)}
                    isAdmin={isAdmin}
                    onClick={() => openLightbox(photo.public_id)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {lightboxIndex >= 0 && photos[lightboxIndex] && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxPublicId(null)}
          onNavigate={(i) => {
            const next = photos[i];
            if (next) setLightboxPublicId(next.public_id);
          }}
          isAdmin={isAdmin}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
