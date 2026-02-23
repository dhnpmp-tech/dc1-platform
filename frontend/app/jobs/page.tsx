'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import JobCard from '@/components/jobs/JobCard';

type StatusFilter = 'all' | 'running' | 'completed' | 'failed';

interface Job {
  id: string;
  dockerImage: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'over-budget';
  costSoFarSar: number;
  elapsedMinutes: number;
  requiredVramGb: number;
  gpuCount: number;
  createdAt: string;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  async function fetchJobs() {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      // Map API fields to SAR
      setJobs((data.jobs || []).map((j: Record<string, unknown>) => ({
        ...j,
        costSoFarSar: (j.costSoFarUsd as number) ?? (j.costSoFarSar as number) ?? 0,
      })));
      setError(null);
    } catch {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchJobs(); }, []);

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  const filters: StatusFilter[] = ['all', 'running', 'completed', 'failed'];

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Jobs</h1>
          <Link
            href="/jobs/submit"
            className="px-5 py-2.5 rounded-xl font-semibold text-[#1a1a1a] bg-[#FFD700] hover:bg-[#FFD700]/90 transition"
          >
            + Submit New Job
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-sm capitalize transition ${
                filter === f
                  ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-3">{error}</p>
            <button onClick={fetchJobs} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition">
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/40 mb-4">No jobs found</p>
            <Link href="/jobs/submit" className="text-[#FFD700] hover:underline">Submit your first job →</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </div>
  );
}
