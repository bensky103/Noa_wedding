'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    const key = searchParams.get('key');
    if (key && key.length > 0) {
      try {
        window.sessionStorage.setItem('noa.adminKey', key);
        setValid(true);
        router.replace('/');
      } catch {
        setValid(false);
      }
    } else {
      setValid(false);
    }
  }, [router, searchParams]);

  if (valid === false) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-stone-700 text-base">מפתח גישה לא תקין</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p className="text-stone-500 text-sm">...</p>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6">
          <p className="text-stone-500 text-sm">...</p>
        </main>
      }
    >
      <AdminEntry />
    </Suspense>
  );
}
