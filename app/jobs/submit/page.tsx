'use client';

import Link from 'next/link';
import JobSubmitForm from '@/components/jobs/JobSubmitForm';

export default function SubmitJobPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/jobs" className="hover:text-[#FFD700] transition">Jobs</Link>
          <span>/</span>
          <span className="text-white/60">Submit New Job</span>
        </div>

        <h1 className="text-2xl font-bold mb-1">Submit GPU Job</h1>
        <p className="text-white/40 mb-8">Configure and launch a compute job on the DC1 network.</p>

        <JobSubmitForm />
      </div>
    </div>
  );
}
