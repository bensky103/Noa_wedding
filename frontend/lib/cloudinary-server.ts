// Server-only Cloudinary helpers. Never import from client/browser modules
// — this module statically imports `node:crypto`, which breaks webpack
// client builds even behind a `typeof window` guard.

import { createHash } from 'node:crypto';
import { publicEnv, serverEnv } from './env';

export async function destroyAsset(
  publicId: string,
  resourceType: 'image' | 'video',
): Promise<{ result: 'ok' | 'not found' }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    invalidate: 'true',
    public_id: publicId,
    timestamp,
  };
  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  const signature = createHash('sha1')
    .update(toSign + serverEnv.CLOUDINARY_API_SECRET)
    .digest('hex');

  const body = new URLSearchParams();
  for (const k of sortedKeys) body.append(k, String(params[k]));
  body.append('api_key', serverEnv.CLOUDINARY_API_KEY);
  body.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${publicEnv.CLOUD_NAME}/${resourceType}/destroy`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Cloudinary destroy failed: ${res.status}`);
  }

  const json = (await res.json()) as { result?: string };
  if (json.result === 'ok' || json.result === 'not found') {
    return { result: json.result };
  }
  throw new Error(`Cloudinary destroy returned unexpected result: ${json.result}`);
}
