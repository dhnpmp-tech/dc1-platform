'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface GpuMetrics {
  utilizationPercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  temperatureC: number;
}

interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'over-budget';
  progressPercent: number;
  gpuMetrics: GpuMetrics;
  costSoFarSar: number;
  elapsedMinutes: number;
  budgetRemainingSar: number;
}

interface CompletionResult {
  totalCostSar: number;
  totalMinutes: number;
  gpuWiped: boolean;
  payoutTriggered: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  running: 'bg-[#00A8E1]/20 text-[#00A8E1] border-[#00A8E1]/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  'over-budget': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

function formatElapsed(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

export default function JobMonitor({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [receipt, setReceipt] = useState<CompletionResult | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`);
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      if (data.success) {
        // Map API fields (Usd suffix) to SAR display
        const s = data.status;
        setStatus({
          ...s,
          costSoFarSar: s.costSoFarUsd ?? s.costSoFarSar ?? 0,
          budgetRemainingSar: s.budgetRemainingUsd ?? s.budgetRemainingSar ?? 0,
        });
      }
      setError(null);
    } catch {
      setError('Failed to load job status');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStatus]);

  // Stop polling on terminal states
  useEffect(() => {
    if (status && ['completed', 'failed', 'over-budget'].includes(status.status)) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
  }, [status]);

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/complete`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to complete job');
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        setReceipt({
          totalCostSar: r.totalCostUsd ?? r.totalCostSar ?? 0,
          totalMinutes: r.totalMinutes,
          gpuWiped: r.gpuWiped,
          payoutTriggered: r.payoutTriggered,
        });
        fetchStatus();
      }
    } catch {
      setError('Failed to complete job');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={fetchStatus} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition">
          Retry
        </button>
      </div>
    );
  }

  if (!status) return null;

  const gpu = status.gpuMetrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-sm font-mono">{status.jobId}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize border ${statusColors[status.status] || ''}`}>
          {status.status}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-white/60">Progress</span>
          <span className="text-[#FFD700] font-medium">{status.progressPercent}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00A8E1] to-[#FFD700] rounded-full transition-all duration-500"
            style={{ width: `${status.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="GPU Utilization" value={`${gpu?.utilizationPercent ?? 0}%`} color="text-[#00A8E1]" />
        <MetricCard label="GPU Memory" value={`${gpu?.memoryUsedGb ?? 0}/${gpu?.memoryTotalGb ?? 0} GB`} color="text-white" />
        <MetricCard label="Temperature" value={`${gpu?.temperatureC ?? 0}°C`} color={gpu?.temperatureC > 85 ? 'text-red-400' : 'text-green-400'} />
        <MetricCard label="Time Elapsed" value={formatElapsed(status.elapsedMinutes)} color="text-white" />
      </div>

      {/* Cost Tracker */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm text-white/40 mb-3">Cost Tracker</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-[#FFD700]">﷼{status.costSoFarSar.toFixed(2)}</p>
            <p className="text-white/40 text-sm">spent</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-medium text-white/80">﷼{status.budgetRemainingSar.toFixed(2)}</p>
            <p className="text-white/40 text-sm">remaining</p>
          </div>
        </div>
        <div className="mt-3 w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-[#FFD700] rounded-full transition-all"
            style={{ width: `${Math.min(100, (status.costSoFarSar / (status.costSoFarSar + status.budgetRemainingSar)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Complete Button */}
      {status.status === 'running' && !receipt && (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="w-full py-3 rounded-xl font-semibold text-[#1a1a1a] bg-[#FFD700] hover:bg-[#FFD700]/90 disabled:opacity-50 transition"
        >
          {completing ? 'Completing...' : 'Complete Job'}
        </button>
      )}

      {/* Receipt */}
      {receipt && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 space-y-3">
          <h3 className="text-green-400 font-semibold text-lg">✅ Job Complete</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40">Total Cost</p>
              <p className="text-[#FFD700] font-bold text-lg">﷼{receipt.totalCostSar.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/40">Total Time</p>
              <p className="text-white font-medium">{receipt.totalMinutes.toFixed(1)} min</p>
            </div>
            <div>
              <p className="text-white/40">GPU Wiped</p>
              <p className="text-white">{receipt.gpuWiped ? '✅ Yes' : '❌ No'}</p>
            </div>
            <div>
              <p className="text-white/40">Payout</p>
              <p className="text-white">{receipt.payoutTriggered ? '✅ Triggered' : '⏳ Pending'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
