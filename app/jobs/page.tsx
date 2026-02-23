'use client';

import { useState, useEffect } from 'react';

// TODO: wire to GET /api/jobs/:id/status

// MOCKED DATA
interface Job {
  id: string;
  name: string;
  renter: string;
  gpu: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  elapsed: string;
  estimated: string;
  costSoFar: number;
  metrics: {
    gpuUtil: number;
    tempC: number;
    memUsedGB: number;
    memTotalGB: number;
    powerW: number;
    networkLatencyMs: number;
  };
  costBreakdown: {
    renterPaysHr: number;
    providerGetsHr: number;
    dc1KeepsHr: number;
  };
  securityChecks: { name: string; passed: boolean }[];
  log: { time: string; event: string }[];
}

const mockJob: Job = {
  id: 'job-rvin-001',
  name: 'RVIN Training — Stable Diffusion Fine-tune',
  renter: 'RVIN Labs',
  gpu: 'RTX 3090',
  status: 'running',
  progress: 34,
  elapsed: '1h 12m',
  estimated: '3h 30m',
  costSoFar: 2.16,
  metrics: { gpuUtil: 87, tempC: 72, memUsedGB: 18.4, memTotalGB: 24, powerW: 298, networkLatencyMs: 3 },
  costBreakdown: { renterPaysHr: 1.80, providerGetsHr: 1.44, dc1KeepsHr: 0.36 },
  securityChecks: [
    { name: 'Network isolation', passed: true },
    { name: 'Memory isolation', passed: true },
    { name: 'Filesystem isolation', passed: true },
    { name: 'GPU wipe (pre-job)', passed: true },
    { name: 'Audit log active', passed: true },
    { name: 'Encryption in transit', passed: true },
    { name: 'Billing proof', passed: true },
  ],
  log: [
    { time: '17:24:30', event: 'GPU metrics collected — util 87%, temp 72°C' },
    { time: '17:24:00', event: 'Checkpoint saved: epoch 12/35' },
    { time: '17:23:30', event: 'Training batch 1200/3500 completed' },
    { time: '17:23:00', event: 'Memory usage stable at 18.4/24 GB' },
    { time: '17:22:00', event: 'Security scan passed — no anomalies' },
    { time: '17:20:00', event: 'Billing proof generated for hour 1' },
    { time: '17:12:00', event: 'Training started — Stable Diffusion fine-tune' },
    { time: '17:11:45', event: 'Container launched on PC1 RTX 3090' },
    { time: '17:11:30', event: 'GPU memory wiped — clean state verified' },
    { time: '17:11:00', event: 'Job assigned to provider PC1' },
    { time: '17:10:30', event: 'Security checks passed (6/7)' },
    { time: '17:10:00', event: 'Job queued — RVIN Labs submission' },
  ],
};

const mockJobs: { id: string; name: string; renter: string; gpu: string; status: Job['status']; costSoFar: number }[] = [
  { id: 'job-rvin-001', name: 'RVIN Training — SD Fine-tune', renter: 'RVIN Labs', gpu: 'RTX 3090', status: 'running', costSoFar: 2.16 },
  { id: 'job-test-002', name: 'Gate 0 Benchmark Test', renter: 'DC1 Internal', gpu: 'RTX 3090', status: 'queued', costSoFar: 0 },
];

const statusColors: Record<string, string> = {
  running: 'bg-[#00c853]/10 text-[#00c853]',
  queued: 'bg-[#00d4ff]/10 text-[#00d4ff]',
  completed: 'bg-gray-500/10 text-gray-400',
  failed: 'bg-[#ff5252]/10 text-[#ff5252]',
};

export default function JobsPage() {
  const [selectedId, setSelectedId] = useState<string>('job-rvin-001');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const job = selectedId === mockJob.id ? mockJob : null;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#00d4ff]">⚡ Job Execution Tracker</h1>
        <span className="text-xs text-gray-500">Auto-refresh 30s · Last: {lastRefresh.toLocaleTimeString()}</span>
      </div>

      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {/* Job list sidebar */}
        <div className="w-72 bg-[#161b22] border border-[#30363d] rounded-lg p-3 space-y-2 overflow-auto shrink-0">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Jobs</h2>
          {mockJobs.map(j => (
            <button
              key={j.id}
              onClick={() => setSelectedId(j.id)}
              className={`w-full text-left p-3 rounded-md transition-colors ${selectedId === j.id ? 'bg-[#00d4ff]/10 border border-[#00d4ff]/30' : 'hover:bg-[#21262d] border border-transparent'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">{j.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`px-1.5 py-0.5 rounded ${statusColors[j.status]}`}>{j.status}</span>
                <span className="text-gray-500">{j.gpu}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{j.renter} · ﷼{j.costSoFar.toFixed(2)}</div>
            </button>
          ))}

          {mockJobs.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No active jobs — Gate 0 test job starts Mar 5
            </div>
          )}
        </div>

        {/* Job detail */}
        <div className="flex-1 overflow-auto space-y-4">
          {job ? (
            <>
              {/* Progress */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">{job.name}</h2>
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[job.status]}`}>{job.status}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#21262d] mb-2">
                  <div className="h-3 rounded-full bg-[#00d4ff] transition-all" style={{ width: `${job.progress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{job.progress}% complete</span>
                  <span>{job.elapsed} elapsed / ~{job.estimated} est.</span>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'GPU Util', value: `${job.metrics.gpuUtil}%` },
                  { label: 'Temp', value: `${job.metrics.tempC}°C` },
                  { label: 'Memory', value: `${job.metrics.memUsedGB}/${job.metrics.memTotalGB} GB` },
                  { label: 'Power', value: `${job.metrics.powerW}W` },
                  { label: 'Network', value: `${job.metrics.networkLatencyMs}ms` },
                  { label: 'Cost', value: `﷼${job.costSoFar.toFixed(2)}` },
                ].map(m => (
                  <div key={m.label} className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">{m.label}</div>
                    <div className="text-lg font-bold">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Cost breakdown + Security */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Cost Breakdown (per hour)</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Renter pays</span><span>﷼{job.costBreakdown.renterPaysHr}/hr</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Provider gets</span><span className="text-[#00c853]">﷼{job.costBreakdown.providerGetsHr}/hr</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">DC1 spread</span><span className="text-[#00d4ff]">﷼{job.costBreakdown.dc1KeepsHr}/hr</span></div>
                  </div>
                </div>

                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Security Checks</h3>
                  <div className="space-y-1.5">
                    {job.securityChecks.map(c => (
                      <div key={c.name} className="flex items-center gap-2 text-sm">
                        <span>{c.passed ? '✅' : '⚠️'}</span>
                        <span className={c.passed ? 'text-gray-300' : 'text-[#ffab00]'}>{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Execution log */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Execution Log</h3>
                <div className="space-y-1.5 max-h-64 overflow-auto">
                  {job.log.map((entry, i) => (
                    <div key={i} className="flex gap-3 text-xs">
                      <span className="text-gray-600 font-mono shrink-0">{entry.time}</span>
                      <span className="text-gray-300">{entry.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-3">⚡</div>
                <div>No active jobs — Gate 0 test job starts Mar 5</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
