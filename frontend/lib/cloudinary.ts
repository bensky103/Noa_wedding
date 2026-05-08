import { publicEnv } from './env';

// =====================================================================
// Browser-side types
// =====================================================================

export type UploadResult = {
  public_id: string;
  secure_url: string;
  resource_type: 'image' | 'video';
  format: string;
  width: number;
  height: number;
  created_at: string;
  context?: { custom?: Record<string, string> };
};

// Generic photo type used across the gallery UI. UploadResult is a superset of
// this and is structurally assignable to Photo.
export type Photo = {
  public_id: string;
  resource_type: 'image' | 'video';
  format: string;
  width: number;
  height: number;
  created_at: string;
  context?: { custom?: { uploader?: string; caption?: string } };
  bytes?: number;
};

export class CloudinaryUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly retriable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'CloudinaryUploadError';
  }
}

// =====================================================================
// Cloudinary context-string escaping
// =====================================================================
// Context fields are joined as `key=value|key=value`. Values that contain
// `=`, `|`, or backslash must be backslash-escaped per Cloudinary docs.
function escapeContextValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/=/g, '\\=');
}

function buildContext(uploader: string, caption?: string): string {
  const parts = [`uploader=${escapeContextValue(uploader)}`];
  if (caption && caption.length > 0) {
    parts.push(`caption=${escapeContextValue(caption)}`);
  }
  return parts.join('|');
}

// =====================================================================
// Browser upload — uses XHR for upload-progress reporting
// =====================================================================

function presetForFile(file: File): string {
  if (file.type.startsWith('video/') && publicEnv.UPLOAD_PRESET_VIDEO) {
    return publicEnv.UPLOAD_PRESET_VIDEO;
  }
  return publicEnv.UPLOAD_PRESET;
}

export function uploadToCloudinary(
  file: File,
  opts: {
    uploader: string;
    caption?: string;
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
  },
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${publicEnv.CLOUD_NAME}/auto/upload`;
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', presetForFile(file));
    form.append('tags', publicEnv.WEDDING_TAG);
    form.append('context', buildContext(opts.uploader, opts.caption));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (opts.onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && opts.onProgress) {
          opts.onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    if (opts.signal) {
      const onAbort = () => {
        xhr.abort();
      };
      if (opts.signal.aborted) {
        xhr.abort();
        reject(
          new CloudinaryUploadError(0, false, 'הבקשה בוטלה'),
        );
        return;
      }
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.onload = () => {
      const status = xhr.status;
      if (status >= 200 && status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadResult;
          resolve(data);
        } catch {
          reject(
            new CloudinaryUploadError(
              status,
              true,
              'תגובה לא תקינה מהשרת',
            ),
          );
        }
        return;
      }
      const retriable = status >= 500;
      let message = `Cloudinary error ${status}`;
      try {
        const body = JSON.parse(xhr.responseText) as {
          error?: { message?: string };
        };
        if (body?.error?.message) message = body.error.message;
      } catch {
        // ignore parse errors
      }
      reject(new CloudinaryUploadError(status, retriable, message));
    };

    xhr.onerror = () => {
      reject(new CloudinaryUploadError(0, true, 'שגיאת רשת'));
    };

    xhr.ontimeout = () => {
      reject(new CloudinaryUploadError(0, true, 'תם הזמן הקצוב'));
    };

    xhr.send(form);
  });
}

// =====================================================================
// Pure URL helpers (browser-safe)
// =====================================================================

function thumbnailUrlAt(
  publicId: string,
  resourceType: 'image' | 'video',
  format: string,
  width: number,
): string {
  const base = `https://res.cloudinary.com/${publicEnv.CLOUD_NAME}`;
  if (resourceType === 'video') {
    return `${base}/video/upload/w_${width},q_auto:good,so_0/${publicId}.jpg`;
  }
  return `${base}/image/upload/w_${width},q_auto:good,f_auto/${publicId}.${format}`;
}

export function thumbnailUrl(
  publicId: string,
  resourceType: 'image' | 'video',
  format: string,
): string {
  return thumbnailUrlAt(publicId, resourceType, format, 400);
}

export function thumbnailSrcSet(
  publicId: string,
  resourceType: 'image' | 'video',
  format: string,
): string {
  const x1 = thumbnailUrlAt(publicId, resourceType, format, 400);
  const x2 = thumbnailUrlAt(publicId, resourceType, format, 800);
  return `${x1} 1x, ${x2} 2x`;
}

export function fullsizeUrl(
  publicId: string,
  resourceType: 'image' | 'video',
  format: string,
): string {
  const base = `https://res.cloudinary.com/${publicEnv.CLOUD_NAME}`;
  if (resourceType === 'video') {
    return `${base}/video/upload/q_auto,f_auto/${publicId}.${format}`;
  }
  return `${base}/image/upload/q_auto:good,f_auto/${publicId}.${format}`;
}

export function videoStreamUrl(publicId: string): string {
  return `https://res.cloudinary.com/${publicEnv.CLOUD_NAME}/video/upload/q_auto,f_auto/${publicId}`;
}

export function downloadUrl(
  publicId: string,
  resourceType: 'image' | 'video',
  format: string,
): string {
  const base = `https://res.cloudinary.com/${publicEnv.CLOUD_NAME}`;
  if (resourceType === 'video') {
    return `${base}/video/upload/fl_attachment,q_auto,f_auto/${publicId}.${format}`;
  }
  return `${base}/image/upload/fl_attachment,q_auto:good,f_auto/${publicId}.${format}`;
}

// destroyAsset moved to ./cloudinary-server.ts
// (it imported `node:crypto`, which webpack must not see in client bundles).
