'use client';

// TODO: wire to GET /api/security/violations

// MOCKED DATA
interface GuardRule {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  lastTriggered: string | null;
  actionTaken: string;
}

interface Violation {
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  agent: string;
  description: string;
  actionTaken: string;
}

interface ChecklistItem {
  label: string;
  status: '✅' | '⚠️' | '❌';
  note?: string;
}

const mockRules: GuardRule[] = [
  { name: 'api_ratelimit', description: '100 req/min per agent', status: 'active', lastTriggered: '2026-02-23T16:45:00Z', actionTaken: 'Request throttled, 429 returned' },
  { name: 'token_budget', description: 'Daily limits enforced per agent', status: 'active', lastTriggered: '2026-02-23T14:20:00Z', actionTaken: 'NEXUS budget warning at 90%' },
  { name: 'container_no_internet', description: 'Docker egress blocked', status: 'active', lastTriggered: null, actionTaken: 'N/A — no violations' },
  { name: 'gpu_memory_wipe', description: 'Verified between jobs', status: 'active', lastTriggered: '2026-02-23T17:11:30Z', actionTaken: 'GPU memory cleared, verified clean' },
  { name: 'audit_logging', description: 'All actions immutable log', status: 'active', lastTriggered: '2026-02-23T17:24:45Z', actionTaken: 'Continuous — 1,247 events today' },
];

const mockViolations: Violation[] = [
  { timestamp: '2026-02-23T16:45:12Z', severity: 'low', agent: 'VOLT', description: 'Rate limit exceeded — 112 req/min', actionTaken: 'Throttled for 60s' },
  { timestamp: '2026-02-23T14:20:00Z', severity: 'medium', agent: 'NEXUS', description: 'Token budget at 96% — approaching limit', actionTaken: 'Warning sent, budget cap enforced' },
  { timestamp: '2026-02-22T22:15:00Z', severity: 'low', agent: 'SPARK', description: 'Attempted unauthorized endpoint access', actionTaken: '403 returned, logged' },
];

const checklist: ChecklistItem[] = [
  { label: 'Network isolation', status: '✅', note: 'Jobs can\'t reach internet' },
  { label: 'Data isolation', status: '✅', note: 'Jobs can\'t see other job data' },
  { label: 'Memory wipe', status: '✅', note: 'GPU cleared between jobs' },
  { label: 'Billing verification', status: '✅', note: 'Cryptographic proof' },
  { label: 'Audit trail', status: '✅', note: 'Immutable log' },
  { label: 'Firecracker isolation', status: '⚠️', note: 'TODO: Phase 2' },
  { label: 'Zero-trust API calls', status: '⚠️', note: 'TODO: Phase 2' },
];

const severityColors: Record<string, string> = {
  low: 'bg-[#00d4ff]/10 text-[#00d4ff]',
  medium: 'bg-[#ffab00]/10 text-[#ffab00]',
  high: 'bg-[#ff5252]/10 text-[#ff5252]',
  critical: 'bg-[#ff5252]/20 text-[#ff5252]',
};

export default function SecurityPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#00d4ff]">🛡️ Security Guards</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">CVSS Score</span>
          <span className="px-3 py-1 rounded-full bg-[#00c853]/10 text-[#00c853] text-sm font-bold">1.2/10 — Excellent</span>
        </div>
      </div>

      {/* Guard Rules */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d]">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Guard Rules</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-[#30363d]">
              <th className="text-left px-4 py-2">Rule</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Last Triggered</th>
              <th className="text-left px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {mockRules.map(r => (
              <tr key={r.name} className="border-b border-[#30363d]/50 hover:bg-[#21262d]">
                <td className="px-4 py-3 font-mono text-[#00d4ff] text-xs">{r.name}</td>
                <td className="px-4 py-3 text-gray-300">{r.description}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'active' ? 'bg-[#00c853]/10 text-[#00c853]' : 'bg-gray-500/10 text-gray-400'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.lastTriggered ? new Date(r.lastTriggered).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.actionTaken}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Violations log */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Violations</h2>
          <div className="space-y-3">
            {mockViolations.map((v, i) => (
              <div key={i} className="border-l-2 border-[#30363d] pl-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${severityColors[v.severity]}`}>{v.severity}</span>
                  <span className="text-xs text-gray-500">{new Date(v.timestamp).toLocaleString()}</span>
                  <span className="text-xs text-[#00d4ff]">{v.agent}</span>
                </div>
                <div className="text-sm text-gray-300">{v.description}</div>
                <div className="text-xs text-gray-500">Action: {v.actionTaken}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Security checklist */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Gate 0 Security Checklist</h2>
          <div className="space-y-2.5">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg">{item.status}</span>
                <div>
                  <div className="text-sm">{item.label}</div>
                  {item.note && <div className="text-xs text-gray-500">{item.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
