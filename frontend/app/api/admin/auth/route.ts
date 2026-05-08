import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

function isValidKey(key: string): boolean {
  const a = Buffer.from(key, 'utf8');
  const b = Buffer.from(serverEnv.ADMIN_KEY, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid request' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('key' in body) ||
    typeof (body as { key: unknown }).key !== 'string'
  ) {
    return Response.json({ error: 'invalid request' }, { status: 400 });
  }

  const { key } = body as { key: string };

  if (!isValidKey(key)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  return Response.json({ ok: true }, { status: 200 });
}

export async function GET(): Promise<Response> {
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

export async function PUT(): Promise<Response> {
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

export async function DELETE(): Promise<Response> {
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

export async function PATCH(): Promise<Response> {
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}
