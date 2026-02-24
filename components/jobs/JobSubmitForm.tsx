'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface MatchingGpu {
  providerId: string;
  gpuModel: string;
  vramGb: number;
  ratePerHourSar: number;
  available: boolean;
}

interface FormData {
  dockerImage: string;
  jobCodePath: string;
  requiredVramGb: number;
  gpuCount: number;
  estimatedHours: number;
  maxBudgetSar: number;
}

interface FormErrors {
  dockerImage?: string;
  requiredVramGb?: string;
  maxBudgetSar?: string;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

export default function JobSubmitForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    dockerImage: '',
    jobCodePath: '',
    requiredVramGb: 24,
    gpuCount: 1,
    estimatedHours: 1,
    maxBudgetSar: 50,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [matchingGpus, setMatchingGpus] = useState<MatchingGpu[]>([]);
  const [loadingGpus, setLoadingGpus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchMatchingGpus = useCallback(async () => {
    if (form.requiredVramGb < 8) return;
    setLoadingGpus(true);
    try {
      const res = await fetch(`/api/providers?minVram=${form.requiredVramGb}&gpuCount=${form.gpuCount}`);
      if (!res.ok) throw new Error('Failed to fetch GPUs');
      const data = await res.json();
      setMatchingGpus(data.providers || []);
    } catch {
      setMatchingGpus([]);
    } finally {
      setLoadingGpus(false);
    }
  }, [form.requiredVramGb, form.gpuCount]);

  useEffect(() => {
    const t = setTimeout(fetchMatchingGpus, 400);
    return () => clearTimeout(t);
  }, [fetchMatchingGpus]);

  const lowestRate = matchingGpus.length > 0
    ? Math.min(...matchingGpus.map(g => g.ratePerHourSar))
    : null;

  const costEstimate = lowestRate !== null ? lowestRate * form.estimatedHours * form.gpuCount : null;

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.dockerImage.trim()) e.dockerImage = 'Docker image URL is required';
    if (form.requiredVramGb < 8) e.requiredVramGb = 'Minimum 8 GB VRAM required';
    if (form.maxBudgetSar <= 0) e.maxBudgetSar = 'Budget must be greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renterId: process.env.NEXT_PUBLIC_RENTER_ID || 'demo-renter-gate0', // TODO: Replace with auth context (useUser().id) post-Gate 0
          dockerImage: form.dockerImage,
          jobCodePath: form.jobCodePath,
          requiredVramGb: form.requiredVramGb,
          gpuCount: form.gpuCount,
          estimatedHours: form.estimatedHours,
          maxBudgetUsd: form.maxBudgetSar, // API field name; value is SAR
          metadata: {},
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Submission failed');
      }
      const data = await res.json();
      if (data.success && data.job?.id) {
        router.push(`/jobs/${data.job.id}/monitor`);
      } else {
        throw new Error('Unexpected response');
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/60 transition';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Docker Image */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Docker Image URL *</label>
        <input
          type="text"
          placeholder="nvidia/cuda:12.0-runtime"
          className={inputClass}
          value={form.dockerImage}
          onChange={e => setForm(f => ({ ...f, dockerImage: e.target.value }))}
        />
        {errors.dockerImage && <p className="text-red-400 text-xs mt-1">{errors.dockerImage}</p>}
      </div>

      {/* Job Code Path */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Job Code Path</label>
        <input
          type="text"
          placeholder="/workspace/train.py"
          className={inputClass}
          value={form.jobCodePath}
          onChange={e => setForm(f => ({ ...f, jobCodePath: e.target.value }))}
        />
      </div>

      {/* VRAM + GPU Count */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Required VRAM (GB) *</label>
          <input
            type="number"
            min={8}
            className={inputClass}
            value={form.requiredVramGb}
            onChange={e => setForm(f => ({ ...f, requiredVramGb: Number(e.target.value) }))}
          />
          {errors.requiredVramGb && <p className="text-red-400 text-xs mt-1">{errors.requiredVramGb}</p>}
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1.5">GPU Count</label>
          <input
            type="number"
            min={1}
            max={8}
            className={inputClass}
            value={form.gpuCount}
            onChange={e => setForm(f => ({ ...f, gpuCount: Number(e.target.value) }))}
          />
        </div>
      </div>

      {/* Estimated Hours + Budget */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Estimated Hours</label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className={inputClass}
            value={form.estimatedHours}
            onChange={e => setForm(f => ({ ...f, estimatedHours: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Max Budget (﷼ SAR) *</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.maxBudgetSar}
            onChange={e => setForm(f => ({ ...f, maxBudgetSar: Number(e.target.value) }))}
          />
          {errors.maxBudgetSar && <p className="text-red-400 text-xs mt-1">{errors.maxBudgetSar}</p>}
        </div>
      </div>

      {/* GPU Availability Preview */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#00A8E1] mb-3">GPU Availability</h3>
        {loadingGpus ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : matchingGpus.length > 0 ? (
          <div className="space-y-2">
            {matchingGpus.slice(0, 5).map((gpu, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white/80">{gpu.gpuModel} ({gpu.vramGb}GB)</span>
                <span className="text-[#FFD700]">﷼{gpu.ratePerHourSar.toFixed(2)}/hr</span>
              </div>
            ))}
            {matchingGpus.length > 5 && (
              <p className="text-white/40 text-xs">+{matchingGpus.length - 5} more available</p>
            )}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No matching GPUs found. Try adjusting VRAM requirements.</p>
        )}
      </div>

      {/* Cost Estimate */}
      {costEstimate !== null && (
        <div className="bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-xl p-4 flex justify-between items-center">
          <span className="text-white/60 text-sm">Estimated Cost</span>
          <span className="text-[#FFD700] text-xl font-bold">﷼{costEstimate.toFixed(2)}</span>
        </div>
      )}

      {/* Submit Error */}
      {submitError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between">
          <p className="text-red-400 text-sm">{submitError}</p>
          <button type="button" onClick={() => setSubmitError(null)} className="text-red-400 hover:text-red-300 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 rounded-xl font-semibold text-[#1a1a1a] bg-[#FFD700] hover:bg-[#FFD700]/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Submitting...
          </span>
        ) : 'Submit Job'}
      </button>
    </form>
  );
}
