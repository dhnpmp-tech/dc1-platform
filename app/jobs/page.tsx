'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Job {
  id: string;
  name: string;
  renter: string;
  gpu: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  costSoFar: number;
  submittedAt?: string;
  startedAt?: string;
  completedAt?: string;
  providerId?: number;
  durationMinutes?: number;
}

const statusColors: Record<string, string> = {
  running: 'bg-[#00c853]/10 text-[#00c853]',
  queued: 'bg-[#00d4ff]/10 text-[#00d4ff]',
  completed: 'bg-gray-500/10 text-gray-400',
  failed: 'bg-[#ff5252]/10 text-[#ff5252]',
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    if (jobs.length > 0 && !selectedId) {
      setSelectedId(jobs[0].id);
    }
  }, [jobs, selectedId]);

  const selectedJob = jobs.find((j) => j.id === selectedId);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#00d4ff]">⚡ Job Execution Tracker</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/jobs/submit"
            className="px-4 py-1.5 rounded-lg bg-[#FFD700] text-[#1a1a1a] text-sm font-semibold hover:bg-[#FFD700]/90 transition"
          >
            + Submit Job
          </Link>
          <span className="text-xs text-gray-500">
            Auto-refresh 30s · Last: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-[#ff5252]/10 border border-[#ff5252]/30 rounded-lg p-3 text-[#ff5252] text-sm">
          {error}
          <button onClick={fetchJobs} className="ml-3 underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {/* Job list sidebar */}
        <div className="w-72 bg-[#161b22] border border-[#30363d] rounded-lg p-3 space-y-2 overflow-auto shrink-0">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Jobs {!loading && `(${jobs.length})`}
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-white/5 rounded-md p-3 h-20" />
              ))}
            </div>
          ) : jobs.length > 0 ? (
            jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedId(j.id)}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  selectedId === j.id
                    ? 'bg-[#00d4ff]/10 border border-[#00d4ff]/30'
                    : 'hover:bg-[#21262d] border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{j.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${statusColors[j.status]}`}>
                    {j.status}
                  </span>
                  <span className="text-gray-500">{j.gpu}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {j.renter} · ﷼{j.costSoFar.toFixed(2)}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center text-gray-500 text-sm py-8">
              No active jobs.{' '}
              <Link href="/jobs/submit" className="text-[#00d4ff] underline">
                Submit one
              </Link>
            </div>
          )}
        </div>

        {/* Job detail */}
        <div className="flex-1 overflow-auto space-y-4">
          {selectedJob ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">{selectedJob.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs ${statusColors[selectedJob.status]}`}>
                  {selectedJob.status}
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#0d1117] rounded-lg p-3">
                  <div className="text-xs text-gray-500">Job ID</div>
                  <div className="text-sm font-mono">{selectedJob.id}</div>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3">
                  <div className="text-xs text-gray-500">Provider</div>
                  <div className="text-sm">{selectedJob.providerId || 'N/A'}</div>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3">
                  <div className="text-xs text-gray-500">Cost</div>
                  <div className="text-sm font-bold">﷼{selectedJob.costSoFar.toFixed(2)}</div>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3">
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="text-sm">
                    {selectedJob.durationMinutes ? `${selectedJob.durationMinutes} min` : 'N/A'}
                  </div>
                </div>
              </div>

              {selectedJob.submittedAt && (
                <div className="text-xs text-gray-500">
                  Submitted: {new Date(selectedJob.submittedAt).toLocaleString()}
                  {selectedJob.startedAt &&
                    ` · Started: ${new Date(selectedJob.startedAt).toLocaleString()}`}
                  {selectedJob.completedAt &&
                    ` · Completed: ${new Date(selectedJob.completedAt).toLocaleString()}`}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-3">⚡</div>
                <div>
                  {jobs.length === 0
                    ? 'No active jobs'
                    : 'Select a job to view details'}
                </div>
                <Link
                  href="/jobs/submit"
                  className="mt-3 inline-block px-4 py-2 rounded-lg bg-[#FFD700] text-[#1a1a1a] text-sm font-semibold hover:bg-[#FFD700]/90 transition"
                >
                  Submit a Job
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
