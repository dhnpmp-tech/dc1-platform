'use client';

import { useEffect, useState, useCallback } from 'react';

interface SecurityEvent {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  provider_id: number;
  provider_name: string;
  description: string;
  timestamp: string;
}

interface SecuritySummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

const severityColors: Record<string, string> = {
  info: 'bg-[#00c853]/10 text-[#00c853]',
  warning: 'bg-[#ffab00]/10 text-[#ffab00]',
  critical: 'bg-[#ff5252]/10 text-[#ff5252]',
};

const typeLabels: Record<string, string> = {
  failed_heartbeat: '💀 Failed Heartbeat',
  new_registration: '🆕 New Registration',
  suspicious_toggle: '⚠️ Suspicious Toggle',
  active_threat: '🚨 Active Threat',
};

export default function SecurityPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [summary, setSummary] = useState<SecuritySummary>({ total: 0, critical: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, summaryRes] = await Promise.all([
        fetch('/api/security?endpoint=events'),
        fetch('/api/security?endpoint=summary'),
      ]);
      const eventsData = await eventsRes.json();
      const summaryData = await summaryRes.json();
      setEvents(eventsData.events || []);
      setSummary(summaryData);
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

  const handleFlag = async (providerId: number) => {
    setFlagging(providerId);
    try {
      await fetch(`/api/security?providerId=${providerId}`, { method: 'POST' });
      await fetchData();
    } catch {
      // ignore
    } finally {
      setFlagging(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#00d4ff]">🛡️ Security Guards View</h1>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: summary.total, color: 'text-white' },
          { label: 'Critical', value: summary.critical, color: 'text-[#ff5252]' },
          { label: 'Warnings', value: summary.warning, color: 'text-[#ffab00]' },
          { label: 'Info', value: summary.info, color: 'text-[#00c853]' },
        ].map((card) => (
          <div key={card.label} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</div>
            <div className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Live Event Feed */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Live Event Feed</h2>
          <span className="text-xs text-gray-600">{events.length} events</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading security events...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            ✅ No security events — all clear
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-[#30363d]">
                <th className="text-left px-4 py-2">Timestamp</th>
                <th className="text-left px-4 py-2">Provider</th>
                <th className="text-left px-4 py-2">Event</th>
                <th className="text-left px-4 py-2">Severity</th>
                <th className="text-left px-4 py-2">Description</th>
                <th className="text-left px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <tr key={`${event.provider_id}-${event.type}-${i}`} className="border-b border-[#30363d]/50 hover:bg-[#21262d]">
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[#00d4ff] text-xs">
                    #{event.provider_id} {event.provider_name}
                  </td>
                  <td className="px-4 py-3 text-xs">{typeLabels[event.type] || event.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[event.severity]}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{event.description}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleFlag(event.provider_id)}
                      disabled={flagging === event.provider_id}
                      className="px-2 py-1 rounded text-xs bg-[#ff5252]/10 text-[#ff5252] hover:bg-[#ff5252]/20 transition-colors disabled:opacity-50"
                    >
                      {flagging === event.provider_id ? '...' : '🚩 Flag'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
