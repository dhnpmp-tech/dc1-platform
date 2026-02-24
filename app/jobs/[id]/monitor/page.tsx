'use client';

import Link from 'next/link';
import JobMonitor from '@/components/jobs/JobMonitor';

export default function MonitorPage({ params }: { params: { id: string } }) {
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
