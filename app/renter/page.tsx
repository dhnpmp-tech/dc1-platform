'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? '/api/dc1'
  : 'http://76.13.179.86:8083/api';

// ── Interfaces ────────────────────────────────────────────────────
interface RenterInfo {
  id: number;
  name: string;
  email: string;
  organization: string;
  balance_halala: number;
  api_key: string;
}

interface Provider {
  id: number;
  name: string;
  gpu_model: string;
  vram_gb: number;
  vram_mib: number;
  status: string;
}

interface RenterJob {
  id: number;
  job_id: string;
  job_type: string;
  status: string;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  actual_cost_halala: number | null;
  cost_halala: number;
  actual_duration_minutes: number | null;
  duration_minutes: number;
  provider_id: number;
}

type Tab = 'overview' | 'jobs' | 'playground' | 'topup';

// ── Main Component with Suspense ──────────────────────────────────
export default function RenterDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#00D9FF] border-t-transparent rounded-full" />
      </div>
    }>
      <RenterDashboard />
    </Suspense>
  );
}

function RenterDashboard() {
  const searchParams = useSearchParams();
  const keyFromUrl = searchParams.get('key');

  // Auth
  const [renterKey, setRenterKey] = useState('');
  const [renter, setRenter] = useState<RenterInfo | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Navigation
  const [tab, setTab] = useState<Tab>('overview');

  // Data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [jobs, setJobs] = useState<RenterJob[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Top-up
  const [topupAmount, setTopupAmount] = useState(10);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg, setTopupMsg] = useState('');

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00D9FF]/60 transition';

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const saved = keyFromUrl || (typeof window !== 'undefined' ? sessionStorage.getItem('dc1_renter_key') : null);
    if (saved) {
      setRenterKey(saved);
      verifyKey(saved);
    } else {
      setAuthChecking(false);
    }
  }, []);

  async function verifyKey(key: string) {
    setAuthChecking(true);
    try {
      const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.renter) {
          setRenter(data.renter);
          setRenterKey(key);
          sessionStorage.setItem('dc1_renter_key', key);
        } else {
          setRenter(null);
          sessionStorage.removeItem('dc1_renter_key');
        }
      } else {
        setRenter(null);
        sessionStorage.removeItem('dc1_renter_key');
      }
    } catch { /* ignore */ }
    finally { setAuthChecking(false); }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (renterKey.trim()) verifyKey(renterKey.trim());
  }

  function logout() {
    sessionStorage.removeItem('dc1_renter_key');
    setRenter(null);
    setRenterKey('');
  }

  // ── Data Fetching ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!renter) return;
    setLoadingData(true);
    try {
      const [provRes, jobsRes] = await Promise.all([
        fetch(`${API_BASE}/renters/available-providers`),
        fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(renterKey)}`),
      ]);

      if (provRes.ok) {
        const provData = await provRes.json();
        setProviders(provData.providers || []);
      }

      if (jobsRes.ok) {
        const meData = await jobsRes.json();
        if (meData.renter) setRenter(meData.renter);
        if (meData.jobs) setJobs(meData.jobs);
      }
    } catch { /* ignore */ }
    finally { setLoadingData(false); }
  }, [renter, renterKey]);

  useEffect(() => {
    if (renter) fetchData();
  }, [renter]);

  // ── Top Up ───────────────────────────────────────────────────
  async function handleTopup() {
    setTopupLoading(true);
    setTopupMsg('');
    try {
      const res = await fetch(`${API_BASE}/renters/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': renterKey },
        body: JSON.stringify({ amount_halala: topupAmount * 100 }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopupMsg(`Added ${topupAmount} SAR. New balance: ${((data.new_balance || 0) / 100).toFixed(2)} SAR`);
        verifyKey(renterKey); // refresh balance
      } else {
        const err = await res.json().catch(() => ({}));
        setTopupMsg(`Error: ${err.error || 'Failed to top up'}`);
      }
    } catch {
      setTopupMsg('Network error');
    } finally { setTopupLoading(false); }
  }

  // ── Auth Gate ────────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#00D9FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!renter) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white">
        <div className="max-w-md mx-auto px-4 pt-20">
          <Link href="/" className="text-white/40 text-sm hover:text-[#00D9FF] transition mb-8 block">&larr; Home</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D9FF] to-[#0088CC] flex items-center justify-center text-lg font-bold text-[#0d1117]">D1</div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Renter Dashboard</h1>
            <p className="text-white/50 text-sm">Access your GPU compute dashboard. Enter your renter API key.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="dc1-renter-..."
              className={inputCls}
              value={renterKey}
              onChange={e => setRenterKey(e.target.value)}
            />
            <button
              type="submit"
              disabled={!renterKey.trim()}
              className="w-full py-3 rounded-lg font-semibold bg-[#00D9FF] text-[#0d1117] hover:bg-[#00D9FF]/90 disabled:opacity-40 transition"
            >
              Login
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-white/30 text-sm">Don&apos;t have an account?</p>
            <Link href="/renter/register" className="text-[#00D9FF] text-sm hover:underline">Register as a Renter</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Computed Values ──────────────────────────────────────────
  const balanceSar = (renter.balance_halala || 0) / 100;
  const onlineProviders = providers.filter(p => p.status === 'online');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed');
  const totalSpentHalala = completedJobs.reduce((sum, j) => sum + (j.actual_cost_halala || j.cost_halala || 0), 0);
  const totalSpentSar = totalSpentHalala / 100;

  // ── Dashboard ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Top Bar */}
      <div className="border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-[#00D9FF] transition">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D9FF] to-[#0088CC] flex items-center justify-center text-xs font-bold text-[#0d1117]">D1</div>
            </Link>
            <div className="w-px h-6 bg-white/10" />
            <span className="font-semibold text-sm">Renter Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-white/60">{renter.name}</span>
              </div>
              <span className="text-xs text-[#FFD700] font-medium">{balanceSar.toFixed(2)} SAR</span>
            </div>
            <button onClick={logout} className="text-xs text-white/30 hover:text-white/50 border border-white/10 rounded-lg px-3 py-1.5 transition">Logout</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {([
            { id: 'overview' as Tab, label: 'Overview', icon: '📊' },
            { id: 'jobs' as Tab, label: 'Job History', icon: '📋' },
            { id: 'playground' as Tab, label: 'Playground', icon: '🚀' },
            { id: 'topup' as Tab, label: 'Top Up', icon: '💳' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                tab === t.id
                  ? 'border-[#00D9FF] text-[#00D9FF]'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Balance" value={`${balanceSar.toFixed(2)} SAR`} sub={`${renter.balance_halala} halala`} color="cyan" />
              <KpiCard label="Total Spent" value={`${totalSpentSar.toFixed(2)} SAR`} sub={`${completedJobs.length} completed jobs`} color="gold" />
              <KpiCard label="Jobs Run" value={String(jobs.length)} sub={`${completedJobs.length} ✓  ${failedJobs.length} ✗`} color="white" />
              <KpiCard label="Online GPUs" value={String(onlineProviders.length)} sub={`${providers.length} total registered`} color="green" />
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Playground CTA */}
              <button
                onClick={() => setTab('playground')}
                className="text-left bg-gradient-to-br from-[#00D9FF]/10 via-[#00D9FF]/5 to-transparent border border-[#00D9FF]/30 rounded-xl p-6 hover:border-[#00D9FF]/60 transition group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00D9FF]/20 flex items-center justify-center text-lg">🚀</div>
                  <div>
                    <h3 className="font-bold text-[#00D9FF] group-hover:text-white transition">LLM Playground</h3>
                    <p className="text-white/40 text-xs">Run AI inference on real GPUs</p>
                  </div>
                </div>
                <p className="text-white/50 text-sm">Type a prompt, pick a GPU, get AI-generated responses with verifiable execution proof showing it ran on real hardware.</p>
              </button>

              {/* Image Gen CTA */}
              <button
                onClick={() => setTab('playground')}
                className="text-left bg-gradient-to-br from-[#A855F7]/10 via-[#A855F7]/5 to-transparent border border-[#A855F7]/30 rounded-xl p-6 hover:border-[#A855F7]/60 transition group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#A855F7]/20 flex items-center justify-center text-lg">🎨</div>
                  <div>
                    <h3 className="font-bold text-[#A855F7] group-hover:text-white transition">Image Generation</h3>
                    <p className="text-white/40 text-xs">Stable Diffusion on real GPUs</p>
                  </div>
                </div>
                <p className="text-white/50 text-sm">Generate images with Stable Diffusion models. Choose resolution, steps, and seed. Download high-quality PNG results.</p>
              </button>
            </div>

            {/* Available GPUs */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-semibold text-sm">Available GPU Providers</h2>
                <button onClick={fetchData} className="text-xs text-[#00D9FF] hover:underline">Refresh</button>
              </div>
              {providers.length === 0 ? (
                <div className="px-6 py-8 text-center text-white/30 text-sm">No providers registered yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {providers.map(p => (
                    <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${p.status === 'online' ? 'bg-green-400' : 'bg-white/20'}`} />
                        <div>
                          <span className="font-medium text-sm">{p.gpu_model}</span>
                          <span className="text-white/30 text-xs ml-2">{p.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-white/40">{p.vram_gb || Math.round((p.vram_mib || 0) / 1024)} GB VRAM</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'online' ? 'bg-green-400/10 text-green-400' : 'bg-white/5 text-white/30'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Jobs */}
            {jobs.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="font-semibold text-sm">Recent Jobs</h2>
                  <button onClick={() => setTab('jobs')} className="text-xs text-[#00D9FF] hover:underline">View All →</button>
                </div>
                <div className="divide-y divide-white/5">
                  {jobs.slice(0, 5).map(j => (
                    <JobRow key={j.id} job={j} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── JOBS TAB ──────────────────────────────────────────── */}
        {tab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Job History</h2>
              <span className="text-xs text-white/40">{jobs.length} total jobs</span>
            </div>

            {jobs.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-12 text-center">
                <p className="text-white/40 text-sm mb-4">No jobs submitted yet.</p>
                <button onClick={() => setTab('playground')} className="text-[#00D9FF] text-sm hover:underline">Go to Playground →</button>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-white/[0.02] text-xs text-white/40 font-medium border-b border-white/10">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-3">Submitted</div>
                  <div className="col-span-2">Duration</div>
                  <div className="col-span-2">Cost</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-white/5">
                  {jobs.map(j => (
                    <JobRow key={j.id} job={j} detailed />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PLAYGROUND TAB ────────────────────────────────────── */}
        {tab === 'playground' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">GPU Playground</h2>
                <p className="text-white/40 text-xs">Run LLM inference or generate images on real GPU hardware</p>
              </div>
              <Link
                href="/renter/playground"
                className="text-xs text-[#00D9FF] border border-[#00D9FF]/30 rounded-lg px-3 py-1.5 hover:bg-[#00D9FF]/10 transition"
              >
                Open Full Page ↗
              </Link>
            </div>
            {/* Embed the playground in an iframe */}
            <div className="rounded-xl border border-white/10 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
              <iframe
                src={`/renter/playground`}
                className="w-full h-full border-0"
                style={{ background: '#0d1117' }}
              />
            </div>
          </div>
        )}

        {/* ── TOP UP TAB ────────────────────────────────────────── */}
        {tab === 'topup' && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold mb-1">Top Up Balance</h2>
              <p className="text-white/40 text-sm">Add funds to your DC1 account (demo mode — no real payment)</p>
            </div>

            {/* Current Balance */}
            <div className="bg-gradient-to-br from-[#00D9FF]/10 to-transparent border border-[#00D9FF]/20 rounded-xl p-6 text-center">
              <p className="text-white/50 text-sm mb-1">Current Balance</p>
              <p className="text-3xl font-bold text-[#00D9FF]">{balanceSar.toFixed(2)} SAR</p>
              <p className="text-white/30 text-xs mt-1">{renter.balance_halala} halala</p>
            </div>

            {/* Amount Selection */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Select Amount (SAR)</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[5, 10, 25, 50].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`py-3 rounded-lg text-sm font-semibold transition ${
                      topupAmount === amt
                        ? 'bg-[#00D9FF] text-[#0d1117]'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
                    }`}
                  >
                    {amt} SAR
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={1000}
                value={topupAmount}
                onChange={e => setTopupAmount(Number(e.target.value))}
                className={inputCls}
                placeholder="Custom amount"
              />
            </div>

            {/* Cost Breakdown */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between text-white/50">
                <span>Amount</span>
                <span>{topupAmount} SAR</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Equivalent</span>
                <span>{topupAmount * 100} halala</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between font-medium">
                <span>New Balance</span>
                <span className="text-[#00D9FF]">{(balanceSar + topupAmount).toFixed(2)} SAR</span>
              </div>
            </div>

            {/* Estimated Usage */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm">
              <p className="text-white/50 mb-2">Estimated Usage</p>
              <div className="space-y-1 text-xs text-white/40">
                <div className="flex justify-between">
                  <span>LLM Inference (15 halala/min)</span>
                  <span>~{Math.floor((topupAmount * 100) / 15)} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Image Generation (20 halala/min)</span>
                  <span>~{Math.floor((topupAmount * 100) / 20)} minutes</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleTopup}
              disabled={topupLoading || topupAmount < 1}
              className="w-full py-3.5 rounded-xl font-semibold bg-[#00D9FF] text-[#0d1117] hover:bg-[#00D9FF]/90 disabled:opacity-40 transition text-lg"
            >
              {topupLoading ? 'Processing...' : `Add ${topupAmount} SAR`}
            </button>

            {topupMsg && (
              <div className={`text-sm text-center py-2 rounded-lg ${topupMsg.startsWith('Error') ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>
                {topupMsg}
              </div>
            )}

            <p className="text-white/20 text-xs text-center">Demo mode: funds are added instantly without real payment processing.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-Components ────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'cyan' | 'gold' | 'white' | 'green' }) {
  const colors = {
    cyan: 'from-[#00D9FF]/10 border-[#00D9FF]/20 text-[#00D9FF]',
    gold: 'from-[#FFD700]/10 border-[#FFD700]/20 text-[#FFD700]',
    white: 'from-white/5 border-white/10 text-white',
    green: 'from-green-400/10 border-green-400/20 text-green-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} to-transparent border rounded-xl p-5`}>
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[color].split(' ').pop()}`}>{value}</p>
      <p className="text-white/30 text-xs mt-1">{sub}</p>
    </div>
  );
}

function JobRow({ job, detailed }: { job: RenterJob; detailed?: boolean }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-400/10 text-green-400',
    failed: 'bg-red-400/10 text-red-400',
    running: 'bg-[#00D9FF]/10 text-[#00D9FF]',
    pending: 'bg-yellow-400/10 text-yellow-400',
    timeout: 'bg-orange-400/10 text-orange-400',
  };

  const jobTypeLabels: Record<string, { label: string; color: string }> = {
    llm_inference: { label: 'LLM', color: 'text-[#00D9FF]' },
    image_generation: { label: 'Image', color: 'text-[#A855F7]' },
    'llm-test': { label: 'Test', color: 'text-white/50' },
    diagnostic: { label: 'Diag', color: 'text-white/50' },
    benchmark: { label: 'Bench', color: 'text-white/50' },
  };

  const typeInfo = jobTypeLabels[job.job_type] || { label: job.job_type, color: 'text-white/50' };
  const cost = job.actual_cost_halala || job.cost_halala || 0;
  const costSar = (cost / 100).toFixed(2);
  const duration = job.actual_duration_minutes || job.duration_minutes || 0;

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (detailed) {
    return (
      <div className="grid grid-cols-12 gap-2 px-6 py-3 text-sm items-center hover:bg-white/[0.02] transition">
        <div className="col-span-1 text-white/30 text-xs">#{job.id}</div>
        <div className={`col-span-2 ${typeInfo.color} text-xs font-medium`}>{typeInfo.label}</div>
        <div className="col-span-3 text-white/50 text-xs">{fmtDate(job.submitted_at)}</div>
        <div className="col-span-2 text-white/50 text-xs">{duration > 0 ? `${duration} min` : '—'}</div>
        <div className="col-span-2 text-white/70 text-xs">{cost > 0 ? `${costSar} SAR` : '—'}</div>
        <div className="col-span-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[job.status] || 'bg-white/5 text-white/30'}`}>
            {job.status}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.02] transition">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
        <span className="text-white/30 text-xs">#{job.id}</span>
        <span className="text-white/50 text-xs">{fmtDate(job.submitted_at)}</span>
      </div>
      <div className="flex items-center gap-3">
        {cost > 0 && <span className="text-white/50 text-xs">{costSar} SAR</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[job.status] || 'bg-white/5 text-white/30'}`}>
          {job.status}
        </span>
      </div>
    </div>
  );
}
