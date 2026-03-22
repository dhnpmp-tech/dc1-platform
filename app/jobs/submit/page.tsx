'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SubmitJobRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const target = query ? `/renter/playground?${query}` : '/renter/playground';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm text-white/60">Redirecting to the renter playground...</p>
      </div>
    </div>
  );
}

export default function SubmitJobPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1a1a]" />}>
      <SubmitJobRedirect />
    </Suspense>
  );
}
