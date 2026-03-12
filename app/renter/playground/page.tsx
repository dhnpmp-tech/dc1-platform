'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? '/api/dc1'
  : 'http://76.13.179.86:8083/api';

type JobType = 'llm_inference' | 'image_generation';

const LLM_MODELS = [
  { id: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', label: 'TinyLlama 1.1B Chat', vram: '~2 GB', speed: 'Fast' },
  { id: 'microsoft/phi-2', label: 'Microsoft Phi-2 (2.7B)', vram: '~5 GB', speed: 'Medium' },
] as const;

const SD_MODELS = [
  { id: 'CompVis/stable-diffusion-v1-4', label: 'Stable Diffusion v1.4', vram: '~3.5 GB', speed: 'Fast' },
  { id: 'stable-diffusion-v1-5/stable-diffusion-v1-5', label: 'Stable Diffusion v1.5', vram: '~4 GB', speed: 'Fast' },
  { id: 'stabilityai/stable-diffusion-2-1', label: 'Stable Diffusion v2.1', vram: '~5 GB', speed: 'Medium' },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base 1.0', vram: '~7 GB', speed: 'Slow' },
] as const;

const COST_RATES: Record<JobType, number> = {
  llm_inference: 15,
  image_generation: 20,
};

interface Provider {
  id: number;
  name: string;
  gpu_model: string;
  vram_gb: number;
  status: string;
  cached_models?: string[];
}

interface JobResult {
  type: string;
  prompt: string;
  response?: string;
  model: string;
  tokens_generated?: number;
  tokens_per_second?: number;
  gen_time_s: number;
  total_time_s: number;
  device: string;
  billing?: { actual_cost_halala: number; actual_cost_sar: string };
  // Image-specific fields
  image_base64?: string;
  format?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}

interface ProofData {
  job_id: string;
  provider_name: string;
  provider_gpu: string;
  provider_hostname: string;
  status: string;
  started_at: string;
  completed_at: string;
  actual_duration_minutes: number;
  cost_halala: number;
  provider_earned_halala: number;
  dc1_fee_halala: number;
  raw_log: string;
}

interface HistoryJob {
  id: number;
  job_id: string;
  job_type: string;
  status: string;
  submitted_at: string;
  completed_at: string | null;
  actual_cost_halala: number;
}

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';
type ViewMode = 'new' | 'history';

export default function GpuPlaygroundPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-[#FFD700] border-t-transparent rounded-full" /></div>}>
      <GpuPlayground />
    </Suspense>
  );
}

function GpuPlayground() {
  const searchParams = useSearchParams();
  const preselectedProvider = searchParams.get('provider');

  // Auth
  const [renterKey, setRenterKey] = useState('');
  const [renterName, setRenterName] = useState<string | null>(null);
  const [renterBalance, setRenterBalance] = useState<number | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('new');

  // Job history
  const [jobHistory, setJobHistory] = useState<HistoryJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingJobId, setViewingJobId] = useState<number | null>(null);
  const [viewingResult, setViewingResult] = useState<JobResult | null>(null);
  const [viewingProof, setViewingProof] = useState<ProofData | null>(null);
  const [loadingJobResult, setLoadingJobResult] = useState(false);

  // Job type
  const [jobType, setJobType] = useState<JobType>('llm_inference');

  // LLM Form
  const [llmModel, setLlmModel] = useState<string>(LLM_MODELS[0].id);
  const [prompt, setPrompt] = useState('');
  const [maxTokens, setMaxTokens] = useState(256);
  const [temperature, setTemperature] = useState(0.7);

  // Image Gen Form
  const [sdModel, setSdModel] = useState<string>(SD_MODELS[0].id);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [steps, setSteps] = useState(30);
  const [imgWidth, setImgWidth] = useState(512);
  const [imgHeight, setImgHeight] = useState(512);
  const [seed, setSeed] = useState(-1);

  // Provider
  const [providerId, setProviderId] = useState<number | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Job execution
  const [phase, setPhase] = useState<Phase>('idle');
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStringId, setJobStringId] = useState<string>('');
  const [pollCount, setPollCount] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRawLog, setShowRawLog] = useState(false);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('dc1_renter_key') : null;
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
        setRenterName(data.renter?.name || 'Renter');
        setRenterBalance(data.renter?.balance_halala != null ? data.renter.balance_halala / 100 : null);
        setRenterKey(key);
        sessionStorage.setItem('dc1_renter_key', key);
        // Load job history
        if (data.recent_jobs) {
          setJobHistory(data.recent_jobs);
        }
      } else {
        setRenterName(null);
        sessionStorage.removeItem('dc1_renter_key');
      }
    } catch { /* keep key */ }
    finally { setAuthChecking(false); }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (renterKey.trim()) verifyKey(renterKey.trim());
  }

  function logout() {
    sessionStorage.removeItem('dc1_renter_key');
    setRenterName(null);
    setRenterKey('');
    setJobHistory([]);
  }

  // ── Load full job result (for history view) ──────────────────────
  async function loadJobResult(job: HistoryJob) {
    setViewingJobId(job.id);
    setLoadingJobResult(true);
    setViewingResult(null);
    setViewingProof(null);

    try {
      // Fetch output
      const outRes = await fetch(`${API_BASE}/jobs/${job.id}/output`, {
        headers: { 'Accept': 'application/json' },
      });

      if (outRes.ok) {
        const data = await outRes.json();
        setViewingResult(data);
      }

      // Fetch proof
      const proofRes = await fetch(`${API_BASE}/jobs/${job.id}`, {
        headers: { 'x-renter-key': renterKey },
      });

      if (proofRes.ok) {
        const data = await proofRes.json();
        const j = data.job || {};
        setViewingProof({
          job_id: j.job_id || `#${j.id}`,
          provider_name: 'Restricted',
          provider_gpu: 'Restricted',
          provider_hostname: '',
          status: j.status,
          started_at: j.started_at || '',
          completed_at: j.completed_at || '',
          actual_duration_minutes: j.actual_duration_minutes || 0,
          cost_halala: j.actual_cost_halala || 0,
          provider_earned_halala: j.provider_earned_halala || 0,
          dc1_fee_halala: j.dc1_fee_halala || 0,
          raw_log: j.result || '',
        });
      }
    } catch (err) {
      console.error('Failed to load job result:', err);
    } finally {
      setLoadingJobResult(false);
    }
  }

  // ── Image download helper ─────────────────────────────────────────
  function downloadImage(base64: string, format: 'png' | 'jpeg' | 'webp', jobLabel: string) {
    if (format === 'png') {
      // Direct base64 download
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${base64}`;
      link.download = `dc1-${jobLabel}.png`;
      link.click();
      return;
    }

    // Convert using canvas for JPEG/WebP
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // White background for JPEG (no alpha)
      if (format === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
      const dataUrl = canvas.toDataURL(mimeType, 0.92);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `dc1-${jobLabel}.${format === 'jpeg' ? 'jpg' : format}`;
      link.click();
    };
    img.src = `data:image/png;base64,${base64}`;
  }

  // Backend download (persistent, works even if base64 not in memory)
  function downloadFromBackend(jobIdNum: number, format: string, jobLabel: string) {
    const link = document.createElement('a');
    link.href = `${API_BASE}/jobs/${jobIdNum}/output/${format}`;
    link.download = `dc1-${jobLabel}.${format === 'jpeg' ? 'jpg' : format}`;
    link.target = '_blank';
    link.click();
  }

  // ── Fetch providers ──────────────────────────────────────────────
  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const res = await fetch(`${API_BASE}/renters/available-providers`);
      if (res.ok) {
        const data = await res.json();
        const online = (data.providers || []).filter((p: Provider) => p.status === 'online');
        setProviders(online);
        if (online.length > 0 && !providerId) {
          // If provider was passed via URL query param (from marketplace), pre-select it
          const preId = preselectedProvider ? Number(preselectedProvider) : null;
          if (preId && online.some((p: Provider) => p.id === preId)) {
            setProviderId(preId);
          } else {
            setProviderId(online[0].id);
          }
        }
      }
    } catch { /* ignore */ }
    finally { setLoadingProviders(false); }
  }, [providerId]);

  useEffect(() => {
    if (renterName) fetchProviders();
  }, [renterName, fetchProviders]);

  // ── Submit job ───────────────────────────────────────────────────
  async function submitJob() {
    if (!prompt.trim() || !providerId) return;
    setPhase('submitting');
    setResult(null);
    setProof(null);
    setErrorMsg('');
    setPollCount(0);
    setProgressPhase('');
    setViewMode('new');

    const params = jobType === 'llm_inference'
      ? { model: llmModel, prompt: prompt.trim(), max_tokens: maxTokens, temperature }
      : {
          model: sdModel,
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          steps,
          width: imgWidth,
          height: imgHeight,
          seed: seed >= 0 ? seed : undefined,
        };

    try {
      const res = await fetch(`${API_BASE}/jobs/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': renterKey },
        body: JSON.stringify({
          provider_id: providerId,
          job_type: jobType,
          duration_minutes: jobType === 'image_generation' ? 15 : 10,
          params,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Submission failed');

      setJobId(data.job.id);
      setJobStringId(data.job.job_id || '');
      setPhase('polling');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit');
      setPhase('error');
    }
  }

  // ── Poll for result ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'polling' || !jobId) return;

    async function poll() {
      setPollCount(c => c + 1);
      try {
        // Check current job state using renter credentials
        const jobCheck = await fetch(`${API_BASE}/jobs/${jobId}`, {
          headers: { 'x-renter-key': renterKey },
        });
        if (jobCheck.ok) {
          const jobData = await jobCheck.json();
          const job = jobData.job || {};
          if (job.progress_phase) setProgressPhase(job.progress_phase);
          if (job.status === 'failed') {
            setErrorMsg(job.error || 'Job failed on provider');
            setPhase('error');
            return;
          }
        }

        // Check output
        const res = await fetch(`${API_BASE}/jobs/${jobId}/output`, {
          headers: { 'Accept': 'application/json' },
        });

        if (res.status === 202) return; // still running
        if (res.status === 204) return; // completed but no output yet

        if (res.ok) {
          const data = await res.json();
          if (data.type === 'text' && data.response) {
            setResult(data);
            if (jobId) fetchProof(jobId);
            setPhase('done');
            // Refresh job history
            refreshJobHistory();
          } else if (data.type === 'image' && data.image_base64) {
            setResult(data);
            if (jobId) fetchProof(jobId);
            setPhase('done');
            // Refresh job history
            refreshJobHistory();
          }
        } else if (res.status === 404) {
          const jobRes = await fetch(`${API_BASE}/jobs/${jobId}`, {
            headers: { 'x-renter-key': renterKey },
          });
          if (jobRes.ok) {
            const data = await jobRes.json();
            const job = data.job || {};
            if (job.status === 'failed') {
              setErrorMsg(job.error || 'Job failed on provider');
              setPhase('error');
            }
          }
        }
      } catch { /* retry next interval */ }
    }

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, jobId, jobType]);

  // Stop polling after 15 minutes (image gen can take longer)
  useEffect(() => {
    if (phase === 'polling' && pollCount > 300) {
      setErrorMsg('Job timed out — the provider may be busy or the model is still downloading.');
      setPhase('error');
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [phase, pollCount]);

  async function fetchProof(id: number) {
    try {
      const res = await fetch(`${API_BASE}/jobs/${id}`, {
        headers: { 'x-renter-key': renterKey },
      });
      if (!res.ok) return;
      const data = await res.json();
      const job = data.job || {};

      setProof({
        job_id: job.job_id || `#${job.id}`,
        provider_name: 'Restricted',
        provider_gpu: 'Restricted',
        provider_hostname: '',
        status: job.status,
        started_at: job.started_at || '',
        completed_at: job.completed_at || '',
        actual_duration_minutes: job.actual_duration_minutes || 0,
        cost_halala: job.actual_cost_halala || 0,
        provider_earned_halala: job.provider_earned_halala || 0,
        dc1_fee_halala: job.dc1_fee_halala || 0,
        raw_log: job.result || '',
      });

      // Refresh balance
      verifyKey(renterKey);
    } catch { /* ignore */ }
  }

  // Refresh job history from API
  async function refreshJobHistory() {
    try {
      const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(renterKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.recent_jobs) setJobHistory(data.recent_jobs);
        if (data.renter?.balance_halala != null) setRenterBalance(data.renter.balance_halala / 100);
      }
    } catch { /* ignore */ }
  }

  function resetForm() {
    setPhase('idle');
    setResult(null);
    setProof(null);
    setPrompt('');
    setNegativePrompt('');
    setProgressPhase('');
  }

  // ── Styling ──────────────────────────────────────────────────────
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00D9FF]/60 transition';
  const rate = COST_RATES[jobType];
  const isRunning = phase === 'polling' || phase === 'submitting';

  // ── Progress label ────────────────────────────────────────────────
  function getProgressLabel(): string {
    if (phase === 'submitting') return 'Submitting...';
    if (phase !== 'polling') return '';
    const elapsed = `${pollCount * 3}s`;
    if (progressPhase) {
      const labels: Record<string, string> = {
        downloading_model: 'Downloading model...',
        loading_model: 'Loading model to GPU...',
        generating: jobType === 'image_generation' ? 'Generating image...' : 'Running inference...',
        formatting: 'Formatting output...',
      };
      return `${labels[progressPhase] || progressPhase} (${elapsed})`;
    }
    return jobType === 'image_generation'
      ? `Generating on GPU... (${elapsed})`
      : `Running on GPU... (${elapsed})`;
  }

  // ── Render download buttons ─────────────────────────────────────
  function ImageDownloadButtons({ imageBase64, jobIdNum, jobLabel }: { imageBase64?: string; jobIdNum: number; jobLabel: string }) {
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {imageBase64 ? (
          <>
            <button onClick={() => downloadImage(imageBase64, 'png', jobLabel)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#A855F7]/20 text-[#A855F7] hover:bg-[#A855F7]/30 transition border border-[#A855F7]/30">
              Download PNG
            </button>
            <button onClick={() => downloadImage(imageBase64, 'jpeg', jobLabel)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00D9FF]/20 text-[#00D9FF] hover:bg-[#00D9FF]/30 transition border border-[#00D9FF]/30">
              Download JPG
            </button>
            <button onClick={() => downloadImage(imageBase64, 'webp', jobLabel)} className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition border border-green-500/30">
              Download WebP
            </button>
          </>
        ) : (
          <>
            <button onClick={() => downloadFromBackend(jobIdNum, 'png', jobLabel)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#A855F7]/20 text-[#A855F7] hover:bg-[#A855F7]/30 transition border border-[#A855F7]/30">
              Download PNG
            </button>
            <button onClick={() => downloadFromBackend(jobIdNum, 'jpeg', jobLabel)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00D9FF]/20 text-[#00D9FF] hover:bg-[#00D9FF]/30 transition border border-[#00D9FF]/30">
              Download JPG
            </button>
            <button onClick={() => downloadFromBackend(jobIdNum, 'webp', jobLabel)} className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition border border-green-500/30">
              Download WebP
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Auth Gate ────────────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#00D9FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!renterName) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white">
        <div className="max-w-md mx-auto px-4 pt-24">
          <Link href="/renter" className="text-white/40 text-sm hover:text-[#00D9FF] transition mb-8 block">&larr; Back to Renter Dashboard</Link>
          <h1 className="text-2xl font-bold mb-2">GPU Playground</h1>
          <p className="text-white/50 text-sm mb-8">Run AI models on real GPU hardware. Enter your renter API key to start.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="dc1-renter-..." className={inputCls} value={renterKey} onChange={e => setRenterKey(e.target.value)} />
            <button type="submit" disabled={!renterKey.trim()} className="w-full py-3 rounded-lg font-semibold bg-[#00D9FF] text-[#0d1117] hover:bg-[#00D9FF]/90 disabled:opacity-40 transition">Login</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/renter" className="text-white/40 text-sm hover:text-[#00D9FF] transition">&larr; Renter Dashboard</Link>
            <h1 className="text-2xl font-bold mt-1">GPU Playground</h1>
            <p className="text-white/40 text-sm">Run LLM inference or generate images on real GPU hardware.</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm text-white/60">{renterName}</span>
            </div>
            {renterBalance != null && (
              <span className="text-xs text-[#FFD700] font-medium">{renterBalance.toFixed(2)} SAR</span>
            )}
            <br />
            <button onClick={logout} className="text-xs text-white/30 hover:text-white/50 transition">Logout</button>
          </div>
        </div>

        {/* ── View Mode Toggle ──────────────────────────────────── */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('new')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
              viewMode === 'new'
                ? 'bg-[#00D9FF] text-[#0d1117]'
                : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
            }`}
          >
            New Job
          </button>
          <button
            onClick={() => { setViewMode('history'); setViewingJobId(null); setViewingResult(null); }}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${
              viewMode === 'history'
                ? 'bg-[#FFD700] text-[#0d1117]'
                : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
            }`}
          >
            Job History
            {jobHistory.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${viewMode === 'history' ? 'bg-[#0d1117]/20' : 'bg-white/10'}`}>
                {jobHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* ── JOB HISTORY VIEW ─────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════ */}
        {viewMode === 'history' && (
          <div className="space-y-4">

            {/* Viewing a specific job result */}
            {viewingJobId && (
              <div className="space-y-4">
                <button
                  onClick={() => { setViewingJobId(null); setViewingResult(null); setViewingProof(null); }}
                  className="text-sm text-white/40 hover:text-[#00D9FF] transition"
                >
                  &larr; Back to Job History
                </button>

                {loadingJobResult && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin h-8 w-8 border-2 border-[#00D9FF] border-t-transparent rounded-full" />
                    <span className="ml-3 text-white/50">Loading job result...</span>
                  </div>
                )}

                {!loadingJobResult && viewingResult && (
                  <>
                    {/* IMAGE Result */}
                    {viewingResult.type === 'image' && viewingResult.image_base64 && (
                      <div className="bg-[#A855F7]/5 border border-[#A855F7]/20 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 rounded-full bg-[#A855F7]" />
                          <span className="text-[#A855F7] font-semibold text-sm">Generated Image</span>
                          <span className="text-white/30 text-xs ml-auto">{viewingResult.model?.split('/').pop()} &bull; {viewingResult.width}x{viewingResult.height} &bull; {viewingResult.steps} steps</span>
                        </div>
                        <div className="flex justify-center">
                          <img
                            src={`data:image/png;base64,${viewingResult.image_base64}`}
                            alt={viewingResult.prompt}
                            className="rounded-lg max-w-full border border-white/10"
                            style={{ maxHeight: '512px' }}
                          />
                        </div>
                        <p className="text-white/50 text-xs mt-3 text-center italic">&ldquo;{viewingResult.prompt}&rdquo;</p>
                        {viewingResult.seed != null && viewingResult.seed >= 0 && (
                          <p className="text-white/30 text-xs text-center mt-1">Seed: {viewingResult.seed}</p>
                        )}
                        <ImageDownloadButtons imageBase64={viewingResult.image_base64} jobIdNum={viewingJobId} jobLabel={viewingProof?.job_id || String(viewingJobId)} />
                      </div>
                    )}

                    {/* TEXT Result */}
                    {viewingResult.type === 'text' && viewingResult.response && (
                      <div className="bg-[#00D9FF]/5 border border-[#00D9FF]/20 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-[#00D9FF]" />
                          <span className="text-[#00D9FF] font-semibold text-sm">AI Response</span>
                          <span className="text-white/30 text-xs ml-auto">{viewingResult.model?.split('/').pop()}</span>
                        </div>
                        <p className="text-white/90 leading-relaxed text-lg">{viewingResult.response}</p>
                      </div>
                    )}

                    {/* Execution Proof */}
                    {viewingProof && (
                      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="font-semibold text-sm">Execution Proof — Verified GPU Compute</span>
                        </div>
                        <div className="p-6">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <ProofRow label="Job ID" value={viewingProof.job_id} />
                            <ProofRow label="Status" value={viewingProof.status} highlight />
                            <ProofRow label="Device" value={viewingResult.device?.toUpperCase() || '—'} highlight={viewingResult.device === 'cuda'} />
                            <ProofRow label="Model" value={viewingResult.model || '—'} />
                            {viewingResult.type === 'text' && (
                              <>
                                <ProofRow label="Tokens Generated" value={String(viewingResult.tokens_generated || 0)} />
                                <ProofRow label="Speed" value={`${viewingResult.tokens_per_second || 0} tok/s`} highlight />
                              </>
                            )}
                            {viewingResult.type === 'image' && (
                              <>
                                <ProofRow label="Dimensions" value={`${viewingResult.width}x${viewingResult.height}`} />
                                <ProofRow label="Steps" value={String(viewingResult.steps || 0)} />
                              </>
                            )}
                            <ProofRow label="Generation Time" value={`${viewingResult.gen_time_s || 0}s`} />
                            <ProofRow label="Total Execution" value={`${viewingResult.total_time_s || 0}s`} />
                            <ProofRow label="Cost" value={`${viewingProof.cost_halala} halala (${(viewingProof.cost_halala / 100).toFixed(2)} SAR)`} />
                            <ProofRow label="Provider Earned" value={`${viewingProof.provider_earned_halala} halala (75%)`} />
                            <ProofRow label="DC1 Fee" value={`${viewingProof.dc1_fee_halala} halala (25%)`} />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!loadingJobResult && !viewingResult && (
                  <div className="text-center py-12 text-white/40">
                    <p>No output available for this job.</p>
                    <p className="text-xs mt-1">The job may have failed or not produced any output.</p>
                  </div>
                )}
              </div>
            )}

            {/* Job list */}
            {!viewingJobId && (
              <>
                {jobHistory.length === 0 ? (
                  <div className="text-center py-16 text-white/40">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="font-medium">No jobs yet</p>
                    <p className="text-sm mt-1">Submit your first job to see it here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobHistory.map(job => {
                      const isImage = job.job_type === 'image_generation';
                      const isCompleted = job.status === 'completed';
                      const duration = job.completed_at && job.submitted_at
                        ? Math.round((new Date(job.completed_at).getTime() - new Date(job.submitted_at).getTime()) / 1000)
                        : 0;

                      return (
                        <button
                          key={job.id}
                          onClick={() => isCompleted ? loadJobResult(job) : undefined}
                          disabled={!isCompleted}
                          className={`w-full text-left px-5 py-4 rounded-xl border transition ${
                            isCompleted
                              ? 'border-white/10 bg-white/5 hover:border-[#00D9FF]/40 hover:bg-white/[0.07] cursor-pointer'
                              : 'border-white/5 bg-white/[0.02] cursor-default opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{isImage ? '🎨' : '💬'}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white/80">
                                    {job.job_id || `#${job.id}`}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    isCompleted ? 'bg-green-500/20 text-green-400' :
                                    job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    job.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-white/10 text-white/40'
                                  }`}>
                                    {job.status}
                                  </span>
                                </div>
                                <div className="text-xs text-white/40 mt-0.5">
                                  {isImage ? 'Image Generation' : 'LLM Inference'}
                                  {' — '}
                                  {new Date(job.submitted_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-[#FFD700]">
                                {job.actual_cost_halala > 0 ? `${(job.actual_cost_halala / 100).toFixed(2)} SAR` : '—'}
                              </div>
                              {duration > 0 && (
                                <div className="text-xs text-white/30">{duration}s</div>
                              )}
                            </div>
                          </div>
                          {isCompleted && (
                            <div className="text-xs text-[#00D9FF]/60 mt-2">Click to view result{isImage ? ' and download image' : ''}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* ── NEW JOB VIEW ─────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════ */}
        {viewMode === 'new' && (
          <>
            {/* ── Job Type Toggle ─────────────────────────────────── */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => { if (!isRunning) setJobType('llm_inference'); }}
                disabled={isRunning}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                  jobType === 'llm_inference'
                    ? 'bg-[#00D9FF] text-[#0d1117]'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
                } disabled:opacity-60`}
              >
                <span className="mr-2">💬</span> LLM Inference
              </button>
              <button
                onClick={() => { if (!isRunning) setJobType('image_generation'); }}
                disabled={isRunning}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                  jobType === 'image_generation'
                    ? 'bg-[#A855F7] text-white'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
                } disabled:opacity-60`}
              >
                <span className="mr-2">🎨</span> Image Generation
              </button>
            </div>

            {/* ── Form ──────────────────────────────────────────── */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 space-y-5">

              {/* Model */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Model</label>
                {jobType === 'llm_inference' ? (
                  <select className={inputCls} value={llmModel} onChange={e => setLlmModel(e.target.value)} disabled={isRunning}>
                    {LLM_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label} — {m.vram} VRAM, {m.speed}</option>
                    ))}
                  </select>
                ) : (
                  <select className={inputCls} value={sdModel} onChange={e => setSdModel(e.target.value)} disabled={isRunning}>
                    {SD_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label} — {m.vram} VRAM, {m.speed}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">GPU Provider</label>
                {loadingProviders ? (
                  <div className="animate-pulse bg-white/10 rounded-lg h-12" />
                ) : providers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {providers.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProviderId(p.id)}
                        disabled={isRunning}
                        className={`text-left px-4 py-3 rounded-lg border transition ${
                          providerId === p.id
                            ? 'border-[#00D9FF] bg-[#00D9FF]/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="font-medium text-sm">{p.gpu_model}</div>
                        <div className="text-white/40 text-xs">{p.name} &bull; {p.vram_gb || '?'}GB VRAM</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-white/40 text-sm py-3 px-4 bg-white/5 rounded-lg border border-white/10">
                    No online providers. Ask a provider to start their daemon.
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm text-white/60">Prompt</label>
                  <span className="text-xs text-white/30">{prompt.length} / 10,000</span>
                </div>
                <textarea
                  rows={jobType === 'image_generation' ? 2 : 3}
                  placeholder={jobType === 'image_generation'
                    ? 'A futuristic city in Saudi Arabia at sunset, cyberpunk style, detailed, 4k'
                    : 'What is the capital of Saudi Arabia? Give a brief answer.'}
                  className={`${inputCls} resize-y`}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  disabled={isRunning}
                />
              </div>

              {/* Image Gen specific fields */}
              {jobType === 'image_generation' && (
                <>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Negative Prompt <span className="text-white/30">(optional)</span></label>
                    <input type="text" placeholder="blurry, low quality, distorted, watermark" className={inputCls} value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} disabled={isRunning} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Steps: {steps}</label>
                      <input type="range" min={5} max={50} step={5} className="w-full accent-[#A855F7] mt-2" value={steps} onChange={e => setSteps(Number(e.target.value))} disabled={isRunning} />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Seed <span className="text-white/30">(-1 = random)</span></label>
                      <input type="number" min={-1} max={2147483647} className={inputCls} value={seed} onChange={e => setSeed(Number(e.target.value))} disabled={isRunning} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Width</label>
                      <select className={inputCls} value={imgWidth} onChange={e => setImgWidth(Number(e.target.value))} disabled={isRunning}>
                        {[256, 384, 512, 640, 768, 1024].map(v => (
                          <option key={v} value={v}>{v}px</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Height</label>
                      <select className={inputCls} value={imgHeight} onChange={e => setImgHeight(Number(e.target.value))} disabled={isRunning}>
                        {[256, 384, 512, 640, 768, 1024].map(v => (
                          <option key={v} value={v}>{v}px</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* LLM-specific fields */}
              {jobType === 'llm_inference' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Max Tokens</label>
                    <input type="number" min={32} max={4096} className={inputCls} value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} disabled={isRunning} />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Temperature: {temperature.toFixed(1)}</label>
                    <input type="range" min={0.1} max={2.0} step={0.1} className="w-full accent-[#00D9FF] mt-2" value={temperature} onChange={e => setTemperature(Number(e.target.value))} disabled={isRunning} />
                  </div>
                </div>
              )}

              {/* Cost estimate */}
              <div className="flex justify-between text-xs text-white/40 px-1">
                <span>Est. cost: ~{rate} halala ({(rate / 100).toFixed(2)} SAR) per minute</span>
                <span>Rate: {rate} halala/min</span>
              </div>

              {/* Submit */}
              <button
                onClick={submitJob}
                disabled={isRunning || !prompt.trim() || !providerId}
                className={`w-full py-3.5 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition text-lg ${
                  jobType === 'image_generation'
                    ? 'bg-[#A855F7] text-white hover:bg-[#A855F7]/90'
                    : 'bg-[#00D9FF] text-[#0d1117] hover:bg-[#00D9FF]/90'
                }`}
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    {getProgressLabel()}
                  </span>
                ) : jobType === 'image_generation' ? 'Generate Image' : 'Run Inference'}
              </button>
            </div>

            {/* ── Error ─────────────────────────────────────────── */}
            {phase === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6">
                <h3 className="text-red-400 font-semibold mb-1">Job Failed</h3>
                <p className="text-red-300/80 text-sm">{errorMsg}</p>
                <button onClick={() => setPhase('idle')} className="mt-3 text-sm text-red-400 hover:text-red-300 underline">Try Again</button>
              </div>
            )}

            {/* ── Result ──────────────────────────────────────────── */}
            {result && (
              <div className="space-y-4">

                {/* IMAGE Result */}
                {result.type === 'image' && result.image_base64 && (
                  <div className="bg-[#A855F7]/5 border border-[#A855F7]/20 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-[#A855F7]" />
                      <span className="text-[#A855F7] font-semibold text-sm">Generated Image</span>
                      <span className="text-white/30 text-xs ml-auto">{result.model?.split('/').pop()} &bull; {result.width}x{result.height} &bull; {result.steps} steps</span>
                    </div>
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${result.image_base64}`}
                        alt={result.prompt}
                        className="rounded-lg max-w-full border border-white/10"
                        style={{ maxHeight: '512px' }}
                      />
                    </div>
                    <p className="text-white/50 text-xs mt-3 text-center italic">&ldquo;{result.prompt}&rdquo;</p>
                    {result.seed != null && result.seed >= 0 && (
                      <p className="text-white/30 text-xs text-center mt-1">Seed: {result.seed}</p>
                    )}
                    <ImageDownloadButtons imageBase64={result.image_base64} jobIdNum={jobId!} jobLabel={jobStringId || String(jobId)} />
                  </div>
                )}

                {/* TEXT Result */}
                {result.type === 'text' && result.response && (
                  <div className="bg-[#00D9FF]/5 border border-[#00D9FF]/20 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-[#00D9FF]" />
                      <span className="text-[#00D9FF] font-semibold text-sm">AI Response</span>
                      <span className="text-white/30 text-xs ml-auto">{result.model?.split('/').pop()}</span>
                    </div>
                    <p className="text-white/90 leading-relaxed text-lg">{result.response}</p>
                  </div>
                )}

                {/* Execution Proof */}
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="font-semibold text-sm">Execution Proof — Verified GPU Compute</span>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      <ProofRow label="Job ID" value={proof?.job_id || `#${jobId}`} />
                      <ProofRow label="Status" value={proof?.status || 'completed'} highlight />
                      <ProofRow label="Provider" value={proof?.provider_name || '—'} />
                      <ProofRow label="GPU" value={proof?.provider_gpu || '—'} />
                      <ProofRow label="Hostname" value={proof?.provider_hostname || '—'} />
                      <ProofRow label="Device" value={result.device?.toUpperCase() || '—'} highlight={result.device === 'cuda'} />
                      <ProofRow label="Model" value={result.model || '—'} />
                      {result.type === 'text' && (
                        <>
                          <ProofRow label="Tokens Generated" value={String(result.tokens_generated || 0)} />
                          <ProofRow label="Speed" value={`${result.tokens_per_second || 0} tok/s`} highlight />
                        </>
                      )}
                      {result.type === 'image' && (
                        <>
                          <ProofRow label="Dimensions" value={`${result.width}x${result.height}`} />
                          <ProofRow label="Steps" value={String(result.steps || 0)} />
                          {result.seed != null && <ProofRow label="Seed" value={String(result.seed)} />}
                        </>
                      )}
                      <ProofRow label="Generation Time" value={`${result.gen_time_s || 0}s`} />
                      <ProofRow label="Total Execution" value={`${result.total_time_s || 0}s`} />
                      <ProofRow label="Cost" value={proof ? `${proof.cost_halala} halala (${(proof.cost_halala / 100).toFixed(2)} SAR)` : '—'} />
                      <ProofRow label="Provider Earned" value={proof ? `${proof.provider_earned_halala} halala (75%)` : '—'} />
                      <ProofRow label="DC1 Fee" value={proof ? `${proof.dc1_fee_halala} halala (25%)` : '—'} />
                    </div>
                  </div>
                </div>

                {/* Raw Log */}
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowRawLog(!showRawLog)}
                    className="w-full px-6 py-3 flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showRawLog ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Raw Daemon Log
                  </button>
                  {showRawLog && (
                    <div className="px-6 pb-4">
                      <pre className="bg-black/40 rounded-lg p-4 text-xs text-green-400/80 font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {proof?.raw_log || result?.response || 'No raw log available'}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Run Another */}
                <button
                  onClick={resetForm}
                  className={`w-full py-3 rounded-xl font-semibold border transition ${
                    jobType === 'image_generation'
                      ? 'border-[#A855F7]/30 text-[#A855F7] hover:bg-[#A855F7]/10'
                      : 'border-[#00D9FF]/30 text-[#00D9FF] hover:bg-[#00D9FF]/10'
                  }`}
                >
                  {jobType === 'image_generation' ? 'Generate Another Image' : 'Run Another Prompt'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProofRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/40">{label}</span>
      <span className={highlight ? 'text-[#00D9FF] font-medium' : 'text-white/80'}>{value}</span>
    </div>
  );
}
