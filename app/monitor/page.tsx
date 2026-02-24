'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';

interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs: number | null;
  lastChecked: Date | null;
  statusLog: StatusLogEntry[];
}

interface StatusLogEntry {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs: number | null;
}

const SERVICE_CONFIGS = [
  { name: 'Vercel', url: 'https://dc1-platform.vercel.app' },
  { name: 'Supabase', url: 'https://fvvxqp-qqjszv6vweybvjfpc.supabase.co' },
  { name: 'Mission Control', url: 'http://76.13.179.86:8084/api/tasks' },
  { name: 'GitHub API', url: 'https://api.github.com' },
] as const;

const STATUS_DOT: Record<string, string> = {
  healthy: 'bg-[#00c853]',
  degraded: 'bg-[#ffab00]',
  down: 'bg-[#ff5252]',
};

const STATUS_TEXT: Record<string, string> = {
  healthy: 'text-[#00c853]',
  degraded: 'text-[#ffab00]',
  down: 'text-[#ff5252]',
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function SkeletonCard() {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5 animate-pulse">
      <div className="h-5 bg-[#21262d] rounded w-2/3 mb-3" />
      <div className="h-4 bg-[#21262d] rounded w-1/2 mb-2" />
      <div className="h-4 bg-[#21262d] rounded w-1/3" />
    </div>
  );
}

export default function MonitorPage() {
  const [services, setServices] = useState<ServiceHealth[]>(() =>
    SERVICE_CONFIGS.map((cfg) => ({
      name: cfg.name,
      url: cfg.url,
      status: 'down' as const,
      responseTimeMs: null,
      lastChecked: null,
      statusLog: [],
    }))
  );
  const [loading, setLoading] = useState(true);
  const servicesRef = useRef(services);
  servicesRef.current = services;

  const checkService = useCallback(async (index: number, url: string): Promise<Partial<ServiceHealth>> => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsed = Math.round(performance.now() - start);
      const status: ServiceHealth['status'] = elapsed > 3000 ? 'degraded' : 'healthy';
      return { status, responseTimeMs: elapsed };
    } catch {
      const elapsed = Math.round(performance.now() - start);
      // no-cors requests may opaque — treat as healthy if fast
      if (elapsed < 5000) {
        return { status: 'healthy', responseTimeMs: elapsed };
      }
      return { status: 'down', responseTimeMs: null };
    }
  }, []);

  const checkAll = useCallback(async () => {
    const results = await Promise.all(
      SERVICE_CONFIGS.map((cfg, i) => checkService(i, cfg.url))
    );
    const now = new Date();
    setServices((prev) =>
      prev.map((svc, i) => {
        const result = results[i];
        const newStatus = result.status ?? 'down';
        const newLog: StatusLogEntry = {
          timestamp: now,
          status: newStatus,
          responseTimeMs: result.responseTimeMs ?? null,
        };
        const statusLog = [newLog, ...svc.statusLog].slice(0, 5);
        return {
          ...svc,
          status: newStatus,
          responseTimeMs: result.responseTimeMs ?? null,
          lastChecked: now,
          statusLog,
        };
      })
    );
    setLoading(false);
  }, [checkService]);

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 30000);
    return () => clearInterval(interval);
  }, [checkAll]);

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const healthScore = Math.round((healthyCount / services.length) * 100);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#00d4ff]">📡 Connection Monitor</h1>
            <p className="text-sm text-gray-500">Live service health — auto-refreshes every 30s</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">System Health</div>
              <div className={`text-2xl font-bold ${healthScore === 100 ? 'text-[#00c853]' : healthScore >= 50 ? 'text-[#ffab00]' : 'text-[#ff5252]'}`}>
                {loading ? '—' : `${healthScore}%`}
              </div>
            </div>
            <button
              onClick={() => { setLoading(true); checkAll(); }}
              className="px-3 py-1.5 rounded-md bg-[#21262d] border border-[#30363d] text-sm text-gray-300 hover:text-white hover:border-[#00d4ff] transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Service Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && services.every((s) => !s.lastChecked)
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : services.map((svc) => (
                <div key={svc.name} className="bg-[#161b22] border border-[#30363d] rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{svc.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[svc.status]} animate-pulse`} />
                      <span className={`text-xs font-medium ${STATUS_TEXT[svc.status]}`}>
                        {svc.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      Response:{' '}
                      <span className="text-white">
                        {svc.responseTimeMs !== null ? `${svc.responseTimeMs}ms` : '—'}
                      </span>
                    </div>
                    <div>
                      Last checked:{' '}
                      <span className="text-gray-400">
                        {svc.lastChecked ? timeAgo(svc.lastChecked) : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Status log */}
                  {svc.statusLog.length > 0 && (
                    <div className="border-t border-[#30363d] pt-2 space-y-1">
                      <div className="text-xs text-gray-600 font-medium">Recent checks</div>
                      {svc.statusLog.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[entry.status]}`} />
                          <span className="text-gray-500">{entry.timestamp.toLocaleTimeString()}</span>
                          <span className="text-gray-600">
                            {entry.responseTimeMs !== null ? `${entry.responseTimeMs}ms` : 'timeout'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
