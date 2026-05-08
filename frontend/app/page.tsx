import {
  cloudinaryListUrl,
  cloudinaryListVideoUrl,
  type Photo,
} from '@/lib/cloudinary';
import { publicEnv } from '@/lib/env';
import Gallery from '@/components/Gallery';
import UploadFab from '@/components/UploadFab';
import UploadQueue from '@/components/UploadQueue';
import NameGateController from '@/components/NameGateController';
import AdminGate from '@/components/AdminGate';

export const revalidate = 30;

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

async function fetchList(
  url: string,
  resourceType: 'image' | 'video',
): Promise<Photo[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
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

async function fetchInitialPhotos(): Promise<Photo[]> {
  try {
    // publicEnv access throws if required vars are missing (e.g., in CI builds
    // before env is wired up). Treat that as "no photos yet" rather than a crash.
    const tag = publicEnv.WEDDING_TAG;
    const [imgs, vids] = await Promise.all([
      fetchList(cloudinaryListUrl(tag), 'image'),
      fetchList(cloudinaryListVideoUrl(tag), 'video'),
    ]);
    return [...imgs, ...vids].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  } catch {
    return [];
  }
}

export default async function Page() {
  const photos = await fetchInitialPhotos();
  return (
    <main className="min-h-screen pb-32">
      <div className="max-w-6xl mx-auto">
        <Gallery initialPhotos={photos} />
      </div>
      <AdminGate />
      <UploadFab />
      <UploadQueue />
      <NameGateController />
    </main>
  );
}
