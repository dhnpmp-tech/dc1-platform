'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import JobMonitor from '../../../../components/jobs/JobMonitor';

export default function MonitorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    const renterKey = typeof window !== 'undefined' ? sessionStorage.getItem('dc1_renter_key') : null;
    if (renterKey) {
      router.replace(`/renter/jobs/${params.id}`);
      return;
    }
    setCheckedAuth(true);
  }, [params.id, router]);

  if (!checkedAuth) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <p className="text-white/60 text-sm">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/jobs" className="hover:text-[#FFD700] transition">Jobs</Link>
          <span>/</span>
          <span className="text-white/60">Monitor</span>
        </div>

        <h1 className="text-2xl font-bold mb-6">Job Monitor</h1>

        <JobMonitor jobId={params.id} />
      </div>
    </div>
  );
}
