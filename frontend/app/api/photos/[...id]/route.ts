import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { destroyAsset } from '@/lib/cloudinary-server';
import { serverEnv } from '@/lib/env';

function isAuthorized(header: string | null): boolean {
  if (!header) return false;
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const token = header.slice(prefix.length);
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(serverEnv.ADMIN_KEY, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string[] }> },
): Promise<Response> {
  if (!isAuthorized(req.headers.get('authorization'))) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  // Catch-all route: id is the URL-decoded path segments. Cloudinary
  // public_ids may contain slashes when an upload preset specifies a folder
  // (e.g., "noa-2026/abc123"), so we rejoin with /.
  const publicId = id.join('/');

  const rt = req.nextUrl.searchParams.get('resource_type') ?? 'image';
  if (rt !== 'image' && rt !== 'video') {
    return Response.json({ error: 'invalid resource_type' }, { status: 400 });
  }

  try {
    const result = await destroyAsset(publicId, rt);
    if (result.result === 'ok') {
      return Response.json({ ok: true }, { status: 200 });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  } catch {
    return Response.json({ error: 'upstream' }, { status: 502 });
  }
}
