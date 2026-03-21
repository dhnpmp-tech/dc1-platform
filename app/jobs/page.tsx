'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';

interface Job {
  id: number;
  job_id: string;
  job_type: string;
  status: string;
  renter_id: number;
  provider_id: number;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number;
  cost_halala: number;
  actual_cost_halala: number | null;
  error: string | null;
  progress_phase: string | null;
  provider_name?: string;
  renter_name?: string;
}

const statusColors: Record<string, string> = {
  running: 'bg-[#00c853]/10 text-[#00c853]',
  queued: 'bg-[#00d4ff]/10 text-[#00d4ff]',
  pending: 'bg-[#00d4ff]/10 text-[#00d4ff]',
  completed: 'bg-gray-500/10 text-gray-400',
  failed: 'bg-[#ff5252]/10 text-[#ff5252]',
  cancelled: 'bg-[#ffab00]/10 text-[#ffab00]',
};

function getAdminToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null;
}

function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return '/api/dc1';
  }
  return '/api/dc1';
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('fallback');

  const fetchJobs = useCallback(async () => {
    const API = getApiBase();
    try {
      // Fetch active jobs (public endpoint)
      const res = await fetch(`${API}/jobs/active`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();

      // Also fetch recent completed jobs from admin endpoint
      let allJobs = data.jobs || [];
      try {
        const token = getAdminToken();
        if (token) {
          const adminRes = await fetch(`${API}/admin/dashboard`, {
            headers: { 'x-admin-token': token },
          });
          if (adminRes.status === 401) { localStorage.removeItem('dc1_admin_token'); router.push('/login'); return; }
          if (adminRes.ok) {
            setDataSource('live');
          }
        }
      } catch {
        // admin API not available
      }

      // Sort by submitted_at desc
      allJobs.sort((a: Job, b: Job) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );

      setJobs(allJobs);
      setError(null);
      setDataSource('live');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      setDataSource('fallback');
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    const renterKey = typeof window !== 'undefined' ? sessionStorage.getItem('dc1_renter_key') : null;
    if (renterKey) {
      router.replace('/renter/jobs');
      return;
    }
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs, router]);

  useEffect(() => {
    if (jobs.length > 0 && !selectedId) {
      setSelectedId(jobs[0].id);
    }
  }, [jobs, selectedId]);

  const selectedJob = jobs.find((j) => j.id === selectedId);

  const runningCount = jobs.filter(j => j.status === 'running').length;
  const queuedCount = jobs.filter(j => j.status === 'queued' || j.status === 'pending').length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#00d4ff]">⚡ Job Execution Tracker</h1>
            <p className="text-xs text-gray-500 mt-1">
              {runningCount} running · {queuedCount} queued · {jobs.length} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dataSource === 'live' && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#00c853]/10 text-[#00c853]">LIVE</span>
            )}
            <Link
              href="/jobs/submit"
              className="px-4 py-1.5 rounded-lg bg-[#FFD700] text-[#1a1a1a] text-sm font-semibold hover:bg-[#FFD700]/90 transition"
            >
              + Submit Job
            </Link>
            <span className="text-xs text-gray-500">
              Auto-refresh 15s · Last: {lastRefresh.toLocaleTimeString()}
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

        <div className="flex gap-4 h-[calc(100vh-180px)]">
          {/* Job list sidebar */}
          <div className="w-72 bg-[#161b22] border border-[#30363d] rounded-lg p-3 space-y-2 overflow-auto shrink-0">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Active Jobs {!loading && `(${jobs.length})`}
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
                    <span className="text-sm font-medium truncate">
                      {j.job_type} #{j.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${statusColors[j.status] || 'bg-gray-500/10 text-gray-400'}`}>
                      {j.status}
                      {j.progress_phase && ` · ${j.progress_phase}`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Provider #{j.provider_id} · {timeAgo(j.submitted_at)}
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
                  <h2 className="font-semibold text-lg">
                    {selectedJob.job_type} — Job #{selectedJob.id}
                  </h2>
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[selectedJob.status] || 'bg-gray-500/10 text-gray-400'}`}>
                    {selectedJob.status}
                    {selectedJob.progress_phase && ` · ${selectedJob.progress_phase}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-[#0d1117] rounded-lg p-3">
                    <div className="text-xs text-gray-500">Job ID</div>
                    <div className="text-sm font-mono">{selectedJob.job_id || selectedJob.id}</div>
                  </div>
                  <div className="bg-[#0d1117] rounded-lg p-3">
                    <div className="text-xs text-gray-500">Provider</div>
                    <div className="text-sm">#{selectedJob.provider_id}</div>
                  </div>
                  <div className="bg-[#0d1117] rounded-lg p-3">
                    <div className="text-xs text-gray-500">Cost</div>
                    <div className="text-sm font-bold text-[#FFD700]">
                      {((selectedJob.actual_cost_halala || selectedJob.cost_halala) / 100).toFixed(2)} SAR
                    </div>
                  </div>
                  <div className="bg-[#0d1117] rounded-lg p-3">
                    <div className="text-xs text-gray-500">Duration</div>
                    <div className="text-sm">{selectedJob.duration_minutes} min</div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-[#0d1117] rounded-lg p-4 space-y-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Timeline</div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex gap-3">
                      <span className="text-gray-600 w-20">Submitted</span>
                      <span className="text-gray-300">{new Date(selectedJob.submitted_at).toLocaleString()}</span>
                    </div>
                    {selectedJob.started_at && (
                      <div className="flex gap-3">
                        <span className="text-gray-600 w-20">Started</span>
                        <span className="text-gray-300">{new Date(selectedJob.started_at).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedJob.completed_at && (
                      <div className="flex gap-3">
                        <span className="text-gray-600 w-20">Completed</span>
                        <span className="text-gray-300">{new Date(selectedJob.completed_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error display */}
                {selectedJob.error && (
                  <div className="bg-[#ff5252]/10 border border-[#ff5252]/30 rounded-lg p-3">
                    <div className="text-xs font-semibold text-[#ff5252] mb-1">Error</div>
                    <div className="text-sm text-gray-300 font-mono">{selectedJob.error}</div>
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
    </DashboardLayout>
  );
}
