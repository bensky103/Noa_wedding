import { type Photo } from '@/lib/cloudinary';
import { listResourcesByTag } from '@/lib/cloudinary-server';
import { publicEnv } from '@/lib/env';
import Gallery from '@/components/Gallery';
import UploadFab from '@/components/UploadFab';
import UploadQueue from '@/components/UploadQueue';
import NameGateController from '@/components/NameGateController';
import AdminGate from '@/components/AdminGate';

export const revalidate = 30;

async function fetchInitialPhotos(): Promise<Photo[]> {
  try {
    // publicEnv access throws if required vars are missing (e.g., in CI builds
    // before env is wired up). Treat that as "no photos yet" rather than a crash.
    const tag = publicEnv.WEDDING_TAG;
    const [imgs, vids] = await Promise.all([
      listResourcesByTag(tag, 'image'),
      listResourcesByTag(tag, 'video'),
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
