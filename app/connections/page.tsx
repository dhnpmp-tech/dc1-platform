'use client';

import { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';

// TODO: wire to GET /api/connections

// MOCKED DATA
interface ServiceStatus {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  uptime: number;
  latencyMs: number;
  lastError: string | null;
}

interface HardwareStatus {
  name: string;
  status: 'online' | 'offline';
  gpuUtil?: number;
  tempC?: number;
  powerW?: number;
  state?: string;
}

interface AgentHeartbeat {
  name: string;
  role: string;
  status: 'online' | 'degraded' | 'offline';
  lastCheckin: string;
  latencyMs: number;
}

const mockServices: ServiceStatus[] = [
  { name: 'dc1st.com API', status: 'online', uptime: 99.94, latencyMs: 42, lastError: null },
  { name: 'Supabase DB', status: 'online', uptime: 99.99, latencyMs: 18, lastError: null },
  { name: 'GitHub', status: 'online', uptime: 99.97, latencyMs: 65, lastError: null },
  { name: 'AWS S3', status: 'online', uptime: 99.99, latencyMs: 31, lastError: null },
  { name: 'Mission Control', status: 'online', uptime: 99.80, latencyMs: 12, lastError: null },
];

const mockHardware: HardwareStatus[] = [
  { name: 'PC1 RTX 3090', status: 'online', gpuUtil: 23, tempC: 54, powerW: 145 },
  { name: 'PC1 RTX 3060', status: 'offline', state: 'Offline since Feb 22' },
  { name: 'Test Provider', status: 'offline', state: 'Not connected' },
];

const mockAgents: AgentHeartbeat[] = [
  { name: 'ATLAS', role: 'DevOps', status: 'online', lastCheckin: '2026-02-23T17:24:00Z', latencyMs: 120 },
  { name: 'GUARDIAN', role: 'Security', status: 'online', lastCheckin: '2026-02-23T17:23:30Z', latencyMs: 95 },
  { name: 'NEXUS', role: 'PM', status: 'online', lastCheckin: '2026-02-23T17:24:10Z', latencyMs: 88 },
  { name: 'SPARK', role: 'Frontend', status: 'online', lastCheckin: '2026-02-23T17:24:45Z', latencyMs: 45 },
  { name: 'SYNC', role: 'QA', status: 'degraded', lastCheckin: '2026-02-23T17:20:00Z', latencyMs: 340 },
  { name: 'VOLT', role: 'Backend', status: 'online', lastCheckin: '2026-02-23T17:24:30Z', latencyMs: 67 },
];

export default function ConnectionsPage() {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const hasDegraded = mockServices.some(s => s.status !== 'online') ||
    mockHardware.some(h => h.status === 'offline') ||
    mockAgents.some(a => a.status !== 'online');

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
      // TODO: fetch fresh data from API
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#00d4ff]">🔗 Connection Monitor</h1>
        <span className="text-xs text-gray-500">Auto-refresh 30s · Last: {lastRefresh.toLocaleTimeString()}</span>
      </div>

      {/* Alert banner */}
      {hasDegraded && (
        <div className="bg-[#ffab00]/10 border border-[#ffab00]/30 rounded-lg px-4 py-3 text-[#ffab00] text-sm">
          ⚠️ Some services are degraded or offline. Check Hardware and Agents sections below.
        </div>
      )}

      {/* Platform Services */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {mockServices.map(s => (
            <div key={s.name} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.name}</span>
                <StatusBadge status={s.status} />
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Uptime: <span className="text-white">{s.uptime}%</span></div>
                <div>Latency: <span className="text-white">{s.latencyMs}ms</span></div>
                <div>Last error: <span className="text-gray-400">{s.lastError || 'None'}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hardware */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Hardware</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {mockHardware.map(h => (
            <div key={h.name} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{h.name}</span>
                <StatusBadge status={h.status} />
              </div>
              {h.status === 'online' ? (
                <div className="text-xs text-gray-500 space-y-1">
                  <div>GPU Util: <span className="text-white">{h.gpuUtil}%</span></div>
                  <div>Temp: <span className="text-white">{h.tempC}°C</span></div>
                  <div>Power: <span className="text-white">{h.powerW}W</span></div>
                </div>
              ) : (
                <div className="text-xs text-gray-500">{h.state}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Agents Heartbeat */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Agent Heartbeats</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {mockAgents.map(a => (
            <div key={a.name} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#00d4ff]">{a.name}</span>
                <StatusBadge status={a.status} />
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>{a.role}</div>
                <div>Latency: <span className="text-white">{a.latencyMs}ms</span></div>
                <div>Last: <span className="text-gray-400">{new Date(a.lastCheckin).toLocaleTimeString()}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
