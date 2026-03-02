'use client';

import { useEffect, useState, useCallback } from 'react';

interface FleetData {
  total_providers: number;
  online_providers: number;
  total_gpus: number;
  total_vram_gib: number;
  gpu_distribution: GpuBucket[];
  avg_utilization_pct: number;
  peak_gpu: string | null;
  total_compute_tflops: number | null;
}

interface GpuBucket {
  model: string;
  count: number;
  total_vram_gib: number;
  avg_util_pct: number;
}

interface ProviderInfo {
  id: number;
  name: string;
  status: string;
  gpu_model: string;
  gpu_count: number;
  vram_gib: number;
  utilization_pct: number;
  driver: string | null;
  compute_cap: string | null;
  last_heartbeat: string | null;
  uptime_pct: number;
}

interface UtilBucket {
  hour: string;
  avg_util: number;
  online_count: number;
}

const statusColors: Record<string, string> = {
  online: 'text-[#00c853]',
  offline: 'text-gray-500',
  pending: 'text-[#ffab00]',
  registered: 'text-[#ffab00]',
  flagged: 'text-[#ff5252]',
  suspended: 'text-[#ff5252]',
};

export default function IntelligencePage() {
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [utilization, setUtilization] = useState<UtilBucket[]>([]);
  const [utilSource, setUtilSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const [fleetRes, provRes, utilRes] = await Promise.all([
        fetch('/api/intelligence?endpoint=fleet'),
        fetch('/api/intelligence?endpoint=providers'),
        fetch('/api/intelligence?endpoint=utilization'),
      ]);
      const fleetData = await fleetRes.json();
      const provData = await provRes.json();
      const utilData = await utilRes.json();

      setFleet(fleetData);
      setProviders(Array.isArray(provData) ? provData : []);
      setUtilization(utilData.trend || []);
      setUtilSource(utilData.source || '');
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      // backend offline — keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const maxUtil = Math.max(...utilization.map(u => u.avg_util), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#00d4ff]">🧠 Agent Intelligence View</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Auto-refresh 30s</span>
          {lastRefresh && <span className="text-xs text-gray-600">Last: {lastRefresh}</span>}
          <button
            onClick={fetchData}
            className="px-3 py-1 rounded bg-[#21262d] text-gray-300 text-xs hover:bg-[#30363d] transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading fleet intelligence...</div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total GPUs', value: fleet?.total_gpus ?? 0, color: 'text-[#00d4ff]' },
              { label: 'Total VRAM', value: `${fleet?.total_vram_gib ?? 0} GiB`, color: 'text-[#00c853]' },
              { label: 'Avg Utilization', value: `${fleet?.avg_utilization_pct ?? 0}%`, color: 'text-[#ffab00]' },
            ].map((card) => (
              <div key={card.label} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</div>
                <div className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* GPU Distribution Table */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">GPU Distribution</h2>
              {fleet?.peak_gpu && (
                <span className="text-xs text-[#00d4ff]">Peak: {fleet.peak_gpu}</span>
              )}
            </div>
            {fleet?.gpu_distribution && fleet.gpu_distribution.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-[#30363d]">
                    <th className="text-left px-4 py-2">Model</th>
                    <th className="text-left px-4 py-2">Count</th>
                    <th className="text-left px-4 py-2">Total VRAM</th>
                    <th className="text-left px-4 py-2">Avg Util</th>
                    <th className="text-left px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.gpu_distribution.map((g) => (
                    <tr key={g.model} className="border-b border-[#30363d]/50 hover:bg-[#21262d]">
                      <td className="px-4 py-3 text-[#00d4ff] font-medium">{g.model}</td>
                      <td className="px-4 py-3 text-gray-300">{g.count}</td>
                      <td className="px-4 py-3 text-gray-300">{g.total_vram_gib} GiB</td>
                      <td className="px-4 py-3">
                        <span className={g.avg_util_pct > 70 ? 'text-[#ff5252]' : g.avg_util_pct > 40 ? 'text-[#ffab00]' : 'text-[#00c853]'}>
                          {g.avg_util_pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24 h-2 bg-[#30363d] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${g.avg_util_pct > 70 ? 'bg-[#ff5252]' : g.avg_util_pct > 40 ? 'bg-[#ffab00]' : 'bg-[#00c853]'}`}
                            style={{ width: `${Math.min(g.avg_util_pct, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">No GPU data available</div>
            )}
          </div>

          {/* Provider Cards */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Providers ({providers.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((p) => (
                <div key={p.id} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[#00d4ff] font-medium text-sm">{p.name}</span>
                    <span className={`text-xs font-medium ${statusColors[p.status] || 'text-gray-500'}`}>
                      ● {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>GPU</span>
                      <span className="text-gray-300">{p.gpu_model} × {p.gpu_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VRAM</span>
                      <span className="text-gray-300">{p.vram_gib} GiB</span>
                    </div>
                    {p.driver && (
                      <div className="flex justify-between">
                        <span>Driver</span>
                        <span className="text-gray-300 font-mono text-[11px]">{p.driver}</span>
                      </div>
                    )}
                    {p.compute_cap && (
                      <div className="flex justify-between">
                        <span>Compute</span>
                        <span className="text-gray-300">{p.compute_cap}</span>
                      </div>
                    )}
                  </div>
                  {/* Utilization bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Utilization</span>
                      <span className={p.utilization_pct > 70 ? 'text-[#ff5252]' : p.utilization_pct > 40 ? 'text-[#ffab00]' : 'text-[#00c853]'}>
                        {p.utilization_pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#30363d] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${p.utilization_pct > 70 ? 'bg-[#ff5252]' : p.utilization_pct > 40 ? 'bg-[#ffab00]' : 'bg-[#00c853]'}`}
                        style={{ width: `${Math.min(p.utilization_pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-600 flex justify-between">
                    <span>Uptime: {p.uptime_pct}%</span>
                    <span>{p.last_heartbeat ? new Date(p.last_heartbeat).toLocaleString() : 'No heartbeat'}</span>
                  </div>
                </div>
              ))}
              {providers.length === 0 && (
                <div className="col-span-full p-8 text-center text-gray-500 bg-[#161b22] border border-[#30363d] rounded-lg">
                  No providers registered yet
                </div>
              )}
            </div>
          </div>

          {/* Utilization Trend Chart */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Utilization Trend (24h)</h2>
              {utilSource === 'mock' && (
                <span className="text-[10px] text-gray-600 bg-[#21262d] px-2 py-0.5 rounded">Sample data</span>
              )}
            </div>
            <div className="p-4">
              {utilization.length > 0 ? (
                <div className="flex items-end gap-1 h-32">
                  {utilization.map((u, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${u.avg_util > 70 ? 'bg-[#ff5252]' : u.avg_util > 40 ? 'bg-[#ffab00]' : 'bg-[#00c853]'}`}
                        style={{ height: `${Math.max((u.avg_util / maxUtil) * 100, 2)}%` }}
                        title={`${u.hour}: ${u.avg_util}% util, ${u.online_count} online`}
                      />
                      {i % 4 === 0 && (
                        <span className="text-[9px] text-gray-600 -rotate-45">{u.hour}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
                  No utilization data available
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
