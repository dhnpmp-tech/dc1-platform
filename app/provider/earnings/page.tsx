'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

const API_PREFIX = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? '/api/dc1'
  : 'http://76.13.179.86:8083/api';

interface EarningsData {
  total_earned_sar: number;
  pending_withdrawal_sar: number;
  withdrawn_sar: number;
  available_sar: number;
  total_jobs: number;
}

interface DailyEarning {
  day: string;
  jobs: number;
  completed: number;
  failed: number;
  earned_halala: number;
  earned_sar: string;
  total_minutes: number;
}

interface HistoryJob {
  id: number;
  job_id: string;
  job_type: string;
  status: string;
  submitted_at: string;
  started_at: string;
  completed_at: string;
  error: string | null;
  provider_earned_halala: number;
  dc1_fee_halala: number;
  actual_cost_halala: number;
  actual_duration_minutes: number;
  earned_sar: string;
  cost_sar: string;
  renter_name: string;
}

interface JobStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  total_earned_sar: string;
  success_rate: number;
}

interface Withdrawal {
  withdrawal_id: string;
  amount_sar: number;
  payout_method: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
}

interface DaemonInfo {
  version: string;
  hostname: string;
  os: string;
  python: string;
  last_seen: string;
}

interface DaemonEvent {
  id: number;
  event_type: string;
  severity: string;
  daemon_version: string;
  job_id: string | null;
  hostname: string;
  details: string;
  event_timestamp: string;
}

function EarningsInner() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';

  const [tab, setTab] = useState<'overview' | 'jobs' | 'daemon' | 'withdrawals'>('overview');
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [daily, setDaily] = useState<DailyEarning[]>([]);
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [daemonInfo, setDaemonInfo] = useState<DaemonInfo | null>(null);
  const [daemonEvents, setDaemonEvents] = useState<DaemonEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = { 'x-provider-key': key };

  const fetchAll = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    try {
      const [eRes, dRes, jRes, wRes, logRes] = await Promise.all([
        fetch(`${API_PREFIX}/providers/earnings?key=${encodeURIComponent(key)}`),
        fetch(`${API_PREFIX}/providers/earnings-daily?key=${encodeURIComponent(key)}&days=30`),
        fetch(`${API_PREFIX}/providers/job-history?key=${encodeURIComponent(key)}&limit=50`),
        fetch(`${API_PREFIX}/providers/withdrawal-history?key=${encodeURIComponent(key)}`),
        fetch(`${API_PREFIX}/providers/daemon-logs?key=${encodeURIComponent(key)}&limit=30`),
      ]);
      if (eRes.ok) setEarnings(await eRes.json());
      if (dRes.ok) { const d = await dRes.json(); setDaily(d.daily || []); }
      if (jRes.ok) {
        const j = await jRes.json();
        setJobs(j.jobs || []);
        setJobStats({ total_jobs: j.total_jobs, completed_jobs: j.completed_jobs, failed_jobs: j.failed_jobs, total_earned_sar: j.total_earned_sar, success_rate: j.success_rate });
      }
      if (wRes.ok) { const w = await wRes.json(); setWithdrawals(w.withdrawals || []); }
      if (logRes.ok) {
        const l = await logRes.json();
        setDaemonInfo(l.daemon_info || null);
        setDaemonEvents(l.events || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setLoading(false);
  }, [key]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!key) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center">
        <p className="text-white/40">No provider key. Go back to your dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#FFD700] border-t-transparent rounded-full" />
      </div>
    );
  }

  const maxDailyEarning = Math.max(...daily.map(d => d.earned_halala), 1);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href={`/provider?key=${key}`} className="text-white/40 text-sm hover:text-[#FFD700] transition">&larr; Dashboard</Link>
            <h1 className="text-2xl font-bold mt-1">Provider Earnings & History</h1>
          </div>
          <button onClick={fetchAll} className="text-xs text-white/30 hover:text-[#FFD700] transition px-3 py-1 border border-white/10 rounded-lg">Refresh</button>
        </div>

        {/* Summary Cards */}
        {earnings && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="Available" value={`${earnings.available_sar.toFixed(2)} SAR`} color="text-[#FFD700]" />
            <SummaryCard label="Total Earned" value={`${earnings.total_earned_sar.toFixed(2)} SAR`} color="text-green-400" />
            <SummaryCard label="Withdrawn" value={`${earnings.withdrawn_sar.toFixed(2)} SAR`} color="text-white/60" />
            <SummaryCard label="Jobs Done" value={String(earnings.total_jobs)} color="text-[#00D9FF]" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1">
          {(['overview', 'jobs', 'daemon', 'withdrawals'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t === 'overview' ? 'Earnings' : t === 'jobs' ? 'Job History' : t === 'daemon' ? 'Daemon' : 'Withdrawals'}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ───────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Daily chart */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm text-white/60 mb-4">Daily Earnings (Last 30 Days)</h3>
              {daily.length === 0 ? (
                <p className="text-white/30 text-sm">No earnings data yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {daily.slice(0, 14).map(d => (
                    <div key={d.day} className="flex items-center gap-3 text-xs">
                      <span className="text-white/40 w-20 shrink-0">{new Date(d.day + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-[#FFD700]/80 to-[#FFD700] rounded"
                          style={{ width: `${Math.max(2, (d.earned_halala / maxDailyEarning) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[#FFD700] w-16 text-right">{d.earned_sar} SAR</span>
                      <span className="text-white/30 w-12 text-right">{d.completed}j</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            {jobStats && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{jobStats.success_rate}%</div>
                  <div className="text-xs text-white/40 mt-1">Success Rate</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#00D9FF]">{jobStats.completed_jobs}</div>
                  <div className="text-xs text-white/40 mt-1">Completed</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{jobStats.failed_jobs}</div>
                  <div className="text-xs text-white/40 mt-1">Failed</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Job History ────────────────────────────────────── */}
        {tab === 'jobs' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-white/30">No jobs yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 border-b border-white/5">
                      <th className="px-4 py-3 text-left font-medium">Time</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Renter</th>
                      <th className="px-4 py-3 text-left font-medium">Duration</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">You Earned</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(j => (
                      <tr key={j.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-2.5 text-white/50">
                          {j.completed_at ? new Date(j.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[#00D9FF]">{(j.job_type || '').replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-4 py-2.5 text-white/50">{j.renter_name || '—'}</td>
                        <td className="px-4 py-2.5 text-white/50">{j.actual_duration_minutes ? `${j.actual_duration_minutes} min` : '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            j.status === 'completed' ? 'bg-green-400/10 text-green-400' :
                            j.status === 'failed' ? 'bg-red-400/10 text-red-400' :
                            'bg-yellow-400/10 text-yellow-400'
                          }`}>
                            {j.status}
                          </span>
                          {j.error && <div className="text-red-400/60 text-[10px] mt-0.5 truncate max-w-[150px]">{j.error}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-[#FFD700]">
                          {j.status === 'completed' ? `${j.earned_sar} SAR` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-white/40">{j.cost_sar} SAR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Daemon ─────────────────────────────────────────── */}
        {tab === 'daemon' && (
          <div className="space-y-4">
            {/* Daemon Info Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm text-white/60 mb-3">Daemon Information</h3>
              {daemonInfo ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Version" value={daemonInfo.version || '—'} />
                  <InfoRow label="Hostname" value={daemonInfo.hostname || '—'} />
                  <InfoRow label="OS" value={daemonInfo.os || '—'} />
                  <InfoRow label="Python" value={daemonInfo.python || '—'} />
                  <InfoRow label="Last Report" value={daemonInfo.last_seen ? new Date(daemonInfo.last_seen).toLocaleString() : '—'} />
                </div>
              ) : (
                <p className="text-white/30 text-sm">No daemon events recorded yet. Start the daemon to see info here.</p>
              )}
            </div>

            {/* Event Log */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-sm text-white/60">Recent Daemon Events</h3>
              </div>
              {daemonEvents.length === 0 ? (
                <div className="p-6 text-center text-white/30 text-sm">No events logged yet.</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {daemonEvents.map(ev => (
                    <div key={ev.id} className="px-6 py-3 border-b border-white/5 hover:bg-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          ev.severity === 'error' || ev.severity === 'critical' ? 'bg-red-400' :
                          ev.severity === 'warning' ? 'bg-yellow-400' : 'bg-green-400'
                        }`} />
                        <span className="text-xs font-medium text-white/80">{ev.event_type}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          ev.severity === 'error' || ev.severity === 'critical' ? 'bg-red-400/10 text-red-400' :
                          ev.severity === 'warning' ? 'bg-yellow-400/10 text-yellow-400' :
                          'bg-green-400/10 text-green-400/80'
                        }`}>{ev.severity}</span>
                        {ev.daemon_version && <span className="text-[10px] text-white/30">v{ev.daemon_version}</span>}
                        <span className="text-[10px] text-white/20 ml-auto">{ev.event_timestamp ? new Date(ev.event_timestamp).toLocaleString() : ''}</span>
                      </div>
                      {ev.details && (
                        <pre className="text-[11px] text-white/40 mt-1 whitespace-pre-wrap break-words max-h-16 overflow-hidden">{ev.details.substring(0, 300)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Withdrawals ────────────────────────────────────── */}
        {tab === 'withdrawals' && (
          <div className="space-y-4">
            {/* Balance card */}
            {earnings && (
              <div className="bg-gradient-to-r from-[#FFD700]/10 to-transparent border border-[#FFD700]/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white/50 text-sm">Available for Withdrawal</div>
                    <div className="text-3xl font-bold text-[#FFD700] mt-1">{earnings.available_sar.toFixed(2)} SAR</div>
                    <div className="text-xs text-white/30 mt-1">Min withdrawal: 10 SAR</div>
                  </div>
                  {earnings.pending_withdrawal_sar > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-yellow-400">Pending</div>
                      <div className="text-lg text-yellow-400">{earnings.pending_withdrawal_sar.toFixed(2)} SAR</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Withdrawal History */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-sm text-white/60">Withdrawal History</h3>
              </div>
              {withdrawals.length === 0 ? (
                <div className="p-6 text-center text-white/30 text-sm">No withdrawals yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/40 border-b border-white/5">
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Amount</th>
                        <th className="px-4 py-3 text-left font-medium">Method</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map(w => (
                        <tr key={w.withdrawal_id} className="border-b border-white/5">
                          <td className="px-4 py-2.5 text-white/50">{new Date(w.requested_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2.5 text-[#FFD700] font-medium">{w.amount_sar.toFixed(2)} SAR</td>
                          <td className="px-4 py-2.5 text-white/50">{(w.payout_method || '').replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              w.status === 'completed' ? 'bg-green-400/10 text-green-400' :
                              w.status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' :
                              'bg-red-400/10 text-red-400'
                            }`}>{w.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 font-mono text-xs">{value}</span>
    </div>
  );
}

export default function EarningsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-[#FFD700] border-t-transparent rounded-full" /></div>}>
      <EarningsInner />
    </Suspense>
  );
}
