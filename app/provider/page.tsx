'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function halalaToSAR(halala: number | undefined | null): string {
  return `﷼${((halala || 0) / 100).toFixed(2)}`;
}

interface ProviderData {
  name?: string;
  gpu_model?: string;
  status?: string;
  is_paused?: boolean;
  run_mode?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  gpu_temp?: number;
  gpu_usage?: number;
  vram_used?: number;
  vram_total?: number;
  uptime_percent?: number;
  last_heartbeat?: string;
  earnings_today?: number;
  earnings_week?: number;
  earnings_total?: number;
  jobs_done?: number;
  active_job?: {
    job_type?: string;
    started_at?: string;
  } | null;
  gpu_cap?: number;
  vram_reserve?: number;
  temp_limit?: number;
}

function ProviderDashboardInner() {
  const searchParams = useSearchParams();
  const keyParam = searchParams.get('key');
  const [key, setKey] = useState(keyParam || '');
  const [inputKey, setInputKey] = useState('');
  const [data, setData] = useState<ProviderData | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gpuCap, setGpuCap] = useState(80);
  const [vramReserve, setVramReserve] = useState(1);
  const [tempLimit, setTempLimit] = useState(85);
  const [schedStart, setSchedStart] = useState('23:00');
  const [schedEnd, setSchedEnd] = useState('07:00');

  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(`/api/providers/me?key=${key}`);
      if (res.status === 404) {
        setError('invalid-key');
        return;
      }
      if (!res.ok) {
        setError('server');
        return;
      }
      const d = await res.json();
      setData(d);
      setError(null);
      if (d.gpu_cap) setGpuCap(d.gpu_cap);
      if (d.vram_reserve !== undefined) setVramReserve(d.vram_reserve);
      if (d.temp_limit) setTempLimit(d.temp_limit);
      if (d.scheduled_start) setSchedStart(d.scheduled_start);
      if (d.scheduled_end) setSchedEnd(d.scheduled_end);
    } catch {
      setError('server');
    }
  }, [key]);

  useEffect(() => {
    fetchData();
    if (!key) return;
    const i = setInterval(fetchData, 30000);
    return () => clearInterval(i);
  }, [key, fetchData]);

  if (!key) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="max-w-sm w-full px-4">
          <h1 className="text-2xl font-bold mb-4">Provider Dashboard</h1>
          <p className="text-gray-400 mb-4">Enter your provider key:</p>
          <input value={inputKey} onChange={e => setInputKey(e.target.value)}
            className="w-full bg-[#252525] border border-gray-700 rounded-lg px-4 py-3 mb-3 focus:border-[#FFD700] focus:outline-none"
            placeholder="dc1-provider-..." />
          <button onClick={() => setKey(inputKey)}
            className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200]">Go</button>
        </div>
      </div>
    );
  }

  // Error state — invalid key or server error
  if (error === 'invalid-key') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="max-w-sm w-full px-4 text-center">
          <p className="text-5xl mb-4">🔑</p>
          <h1 className="text-2xl font-bold mb-3 text-red-400">Invalid Provider Key</h1>
          <p className="text-gray-400 mb-6">
            This key wasn&apos;t found. Check your onboarding email or contact{' '}
            <a href="mailto:support@dc1st.com" className="text-[#00A8E1] underline">support@dc1st.com</a>
          </p>
          <div className="space-y-3">
            <button
              onClick={() => { setKey(''); setError(null); }}
              className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition"
            >
              Try Another Key
            </button>
            <a
              href="/provider-onboarding"
              className="block w-full py-3 rounded-lg font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 transition text-center"
            >
              Register as Provider
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (error === 'server') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="max-w-sm w-full px-4 text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <h1 className="text-2xl font-bold mb-3 text-yellow-400">Connection Error</h1>
          <p className="text-gray-400 mb-6">Could not reach the server. Please try again.</p>
          <button
            onClick={() => { setError(null); fetchData(); }}
            className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusBadge = data?.is_paused
    ? { icon: '⏸', label: 'PAUSED', color: 'text-yellow-400' }
    : data?.status === 'online'
      ? { icon: '🟢', label: 'ONLINE', color: 'text-green-400' }
      : { icon: '🔴', label: 'OFFLINE', color: 'text-red-400' };

  const tempColor = (data?.gpu_temp || 0) < 70 ? 'text-green-400' : (data?.gpu_temp || 0) < 80 ? 'text-yellow-400' : 'text-red-400';
  const tempLabel = (data?.gpu_temp || 0) < 70 ? 'Safe' : (data?.gpu_temp || 0) < 80 ? 'Warm' : 'Hot';

  const changeMode = async (mode: string) => {
    setModeOpen(false);
    await fetch('/api/providers/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key, run_mode: mode,
        scheduled_start: mode === 'scheduled' ? schedStart : undefined,
        scheduled_end: mode === 'scheduled' ? schedEnd : undefined,
      }),
    });
    fetchData();
  };

  const togglePause = async () => {
    const endpoint = data?.is_paused ? '/api/providers/resume' : '/api/providers/pause';
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    fetchData();
  };

  const saveSettings = async () => {
    await fetch('/api/providers/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, gpu_cap: gpuCap, vram_reserve: vramReserve, temp_limit: tempLimit }),
    });
    fetchData();
  };

  const modeLabel = data?.run_mode === 'scheduled' ? 'Scheduled' : data?.run_mode === 'manual' ? 'Manual' : 'Always-on';

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${statusBadge.color}`}>{statusBadge.icon} {statusBadge.label}</span>
              <span className="text-xl font-bold">{data?.name || 'Loading...'}</span>
            </div>
            <p className="text-gray-400 text-sm">{data?.gpu_model || 'GPU'}</p>
          </div>
          <div className="relative">
            <button onClick={() => setModeOpen(!modeOpen)}
              className="bg-[#252525] border border-gray-700 rounded-lg px-4 py-2 text-sm hover:border-[#FFD700] transition">
              Mode: {modeLabel} <span className="ml-1">▾</span>
            </button>
            {modeOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#252525] border border-gray-700 rounded-lg overflow-hidden z-10 min-w-[200px]">
                {['always-on', 'manual', 'scheduled'].map(m => (
                  <button key={m} onClick={() => changeMode(m)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-[#333] ${data?.run_mode === m ? 'text-[#FFD700]' : ''}`}>
                    {m === 'always-on' ? 'Always-on' : m === 'manual' ? 'Manual' : 'Scheduled'}
                  </button>
                ))}
                {data?.run_mode === 'scheduled' && (
                  <div className="px-4 py-2 border-t border-gray-700 flex gap-2">
                    <input type="time" value={schedStart} onChange={e => setSchedStart(e.target.value)}
                      className="bg-[#333] border border-gray-600 rounded px-2 py-1 text-sm text-white w-24" />
                    <input type="time" value={schedEnd} onChange={e => setSchedEnd(e.target.value)}
                      className="bg-[#333] border border-gray-600 rounded px-2 py-1 text-sm text-white w-24" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* GPU Health */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#252525] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">Temperature</p>
            <p className={`text-2xl font-bold ${tempColor}`}>{data?.gpu_temp ?? '--'}°C</p>
            <p className={`text-sm ${tempColor}`}>{tempLabel}</p>
          </div>
          <div className="bg-[#252525] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">GPU Usage</p>
            <p className="text-2xl font-bold text-[#00A8E1]">{data?.gpu_usage ?? '--'}%</p>
            <p className="text-sm text-gray-400">{data?.active_job ? 'DC1 job' : 'Idle'}</p>
          </div>
          <div className="bg-[#252525] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">VRAM</p>
            <p className="text-2xl font-bold">{data?.vram_used ?? '--'} / {data?.vram_total ?? '--'} GB</p>
          </div>
        </div>

        {/* Connection */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#252525] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">Stability</p>
            <p className="text-xl font-bold">{data?.uptime_percent ?? '--'}%</p>
          </div>
          <div className="bg-[#252525] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">Last Heartbeat</p>
            <p className="text-xl font-bold">{timeAgo(data?.last_heartbeat)}</p>
          </div>
        </div>

        {/* Earnings */}
        <div className="bg-[#252525] rounded-lg p-4 border border-[#FFD700]/30 mb-6">
          <h3 className="text-[#FFD700] font-semibold mb-3">💰 Earnings</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><p className="text-gray-400 text-xs">Today</p><p className="text-lg font-bold text-[#FFD700]">{halalaToSAR(data?.earnings_today)}</p></div>
            <div><p className="text-gray-400 text-xs">This Week</p><p className="text-lg font-bold text-[#FFD700]">{halalaToSAR(data?.earnings_week)}</p></div>
            <div><p className="text-gray-400 text-xs">All Time</p><p className="text-lg font-bold text-[#FFD700]">{halalaToSAR(data?.earnings_total)}</p></div>
            <div><p className="text-gray-400 text-xs">Jobs Done</p><p className="text-lg font-bold">{data?.jobs_done ?? 0}</p></div>
          </div>
        </div>

        {/* Current Job */}
        {data?.active_job && (
          <div className="bg-[#252525] rounded-lg p-4 border border-[#00A8E1]/30 mb-6">
            <h3 className="text-[#00A8E1] font-semibold mb-2">🔄 Current Job</h3>
            <p className="text-sm"><span className="text-gray-400">Type:</span> {data.active_job.job_type}</p>
            <p className="text-sm"><span className="text-gray-400">Started:</span> {timeAgo(data.active_job.started_at)}</p>
            <p className="text-sm text-[#FFD700]">Earning ﷼0.10/min</p>
          </div>
        )}

        {/* Controls */}
        <button onClick={togglePause}
          className={`w-full py-4 rounded-lg font-bold text-lg mb-4 transition ${data?.is_paused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}>
          {data?.is_paused ? '▶ Resume — Start Earning' : '⏸ Pause — I need my GPU'}
        </button>

        {/* GPU Protection Settings */}
        <div className="bg-[#252525] rounded-lg border border-gray-800 mb-6">
          <button onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full px-4 py-3 text-left font-semibold flex justify-between items-center">
            ⚙ GPU Protection Settings <span>{settingsOpen ? '▴' : '▾'}</span>
          </button>
          {settingsOpen && (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="text-sm text-gray-400 flex justify-between"><span>GPU Usage Cap</span><span>{gpuCap}%</span></label>
                <input type="range" min={10} max={100} value={gpuCap} onChange={e => setGpuCap(+e.target.value)}
                  className="w-full accent-[#FFD700]" />
              </div>
              <div>
                <label className="text-sm text-gray-400 flex justify-between"><span>VRAM Reserve</span><span>{vramReserve} GB</span></label>
                <input type="range" min={0} max={8} value={vramReserve} onChange={e => setVramReserve(+e.target.value)}
                  className="w-full accent-[#FFD700]" />
              </div>
              <div>
                <label className="text-sm text-gray-400 flex justify-between"><span>Temperature Limit</span><span>{tempLimit}°C</span></label>
                <input type="range" min={60} max={100} value={tempLimit} onChange={e => setTempLimit(+e.target.value)}
                  className="w-full accent-[#FFD700]" />
              </div>
              <button onClick={saveSettings}
                className="w-full py-2 rounded-lg bg-[#FFD700] text-black font-semibold hover:bg-[#e6c200] transition">
                Save Settings
              </button>
            </div>
          )}
        </div>

        {/* Earnings History — inline */}
        <div className="bg-[#252525] rounded-lg border border-gray-800 p-4">
          <h3 className="text-[#00A8E1] font-semibold mb-3">📊 Earnings History</h3>
          <p className="text-gray-500 text-sm">Detailed earnings history coming soon. Your totals are shown above.</p>
          <p className="text-gray-600 text-xs mt-2">Payouts processed weekly to your registered account.</p>
        </div>
      </div>
    </div>
  );
}

export default function ProviderDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">Loading...</div>}>
      <ProviderDashboardInner />
    </Suspense>
  );
}
