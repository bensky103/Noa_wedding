import { listResourcesByTag } from '@/lib/cloudinary-server';
import { publicEnv } from '@/lib/env';

export async function GET(): Promise<Response> {
  try {
    const tag = publicEnv.WEDDING_TAG;
    const [imgs, vids] = await Promise.all([
      listResourcesByTag(tag, 'image'),
      listResourcesByTag(tag, 'video'),
    ]);
    const photos = [...imgs, ...vids].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return Response.json({ photos });
  } catch {
    return Response.json({ photos: [] });
  }
}
