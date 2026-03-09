'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// On HTTPS (Vercel), use Next.js rewrite proxy to avoid mixed-content browser blocks.
// On HTTP (local dev), hit the VPS directly.
const API_PREFIX = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? '/api/dc1'
  : 'http://76.13.179.86:8083/api';
const ADMIN_TOKEN = '9ca7c4f924374229b9c9f584758f055373878dfce3fea309ff192d638756342b';

const MODELS = [
  { id: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', label: 'TinyLlama 1.1B Chat', vram: '~2 GB', speed: 'Fast', rate: 15 },
  { id: 'microsoft/phi-2', label: 'Microsoft Phi-2 (2.7B)', vram: '~5 GB', speed: 'Medium', rate: 15 },
  { id: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B Instruct', vram: '~14 GB', speed: 'Slow', rate: 15 },
] as const;

const MAX_PROMPT_CHARS = 10000;

interface Provider {
  id: number;
  name: string;
  gpu_model: string;
  vram_gb: number;
  status: string;
}

interface JobResult {
  type: string;
  prompt: string;
  response: string;
  model: string;
  tokens_generated: number;
  tokens_per_second: number;
  gen_time_s: number;
  total_time_s: number;
  device: string;
  billing?: { actual_cost_halala: number; actual_cost_sar: string };
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
  started_at: string;
  completed_at: string;
  progress_phase: string | null;
  error: string | null;
  actual_cost_halala: number;
  cost_halala: number;
  cost_sar: string;
  provider_name: string;
  provider_gpu: string;
  refunded: boolean;
}

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';
type ProgressPhase = 'downloading_model' | 'installing_deps' | 'loading_model' | 'generating' | 'formatting' | null;

export default function LlmPlayground() {
  // Auth
  const [renterKey, setRenterKey] = useState('');
  const [renterName, setRenterName] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Form
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [prompt, setPrompt] = useState('');
  const [maxTokens, setMaxTokens] = useState(256);
  const [temperature, setTemperature] = useState(0.7);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Job execution
  const [phase, setPhase] = useState<Phase>('idle');
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStringId, setJobStringId] = useState<string>('');
  const [result, setResult] = useState<JobResult | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRawLog, setShowRawLog] = useState(false);
  const [progressPhase, setProgressPhase] = useState<ProgressPhase>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Real elapsed time tracking
  const [jobStartedAt, setJobStartedAt] = useState<Date | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  // Job history
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [balanceSar, setBalanceSar] = useState<string | null>(null);

  // ── Elapsed time ticker ─────────────────────────────────────────
  useEffect(() => {
    if (phase === 'polling') {
      elapsedRef.current = setInterval(() => {
        if (jobStartedAt) {
          setElapsedSec(Math.floor((Date.now() - jobStartedAt.getTime()) / 1000));
        } else {
          setElapsedSec(prev => prev + 1);
        }
      }, 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [phase, jobStartedAt]);

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
      if (key === ADMIN_TOKEN) {
        setRenterName('DC1 Admin');
        setRenterKey(key);
        sessionStorage.setItem('dc1_renter_key', key);
        setAuthChecking(false);
        return;
      }
      const res = await fetch(`${API_PREFIX}/renters/me?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        setRenterName(data.renter?.name || 'Renter');
        setRenterKey(key);
        sessionStorage.setItem('dc1_renter_key', key);
      } else {
        setRenterName(null);
        sessionStorage.removeItem('dc1_renter_key');
      }
    } catch {
      if (key.startsWith('dc1-renter-')) {
        setRenterName('Renter (offline)');
        setRenterKey(key);
        sessionStorage.setItem('dc1_renter_key', key);
      }
    }
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
  }

  // ── Fetch providers ──────────────────────────────────────────────
  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const res = await fetch(`${API_PREFIX}/renters/available-providers`);
      if (res.ok) {
        const data = await res.json();
        const online = (data.providers || []).filter((p: Provider) => p.status === 'online');
        setProviders(online);
        if (online.length > 0 && !providerId) setProviderId(online[0].id);
      }
    } catch { /* ignore */ }
    finally { setLoadingProviders(false); }
  }, [providerId]);

  useEffect(() => {
    if (renterName) fetchProviders();
  }, [renterName, fetchProviders]);

  // ── Fetch job history ──────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const headerKey = renterKey === ADMIN_TOKEN
        ? 'dc1-renter-d1f00fc37ee3a0898b2dc88f33bf54b3'
        : renterKey;
      const res = await fetch(`${API_PREFIX}/jobs/history?limit=20`, {
        headers: { 'x-renter-key': headerKey }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.jobs || []);
        setBalanceSar(data.balance_sar || null);
      }
    } catch { /* ignore */ }
  }, [renterKey]);

  useEffect(() => {
    if (renterName) fetchHistory();
  }, [renterName, fetchHistory]);

  // ── Submit job ───────────────────────────────────────────────────
  async function submitJob() {
    if (!prompt.trim() || !providerId) return;
    if (prompt.length > MAX_PROMPT_CHARS) {
      setErrorMsg(`Prompt too long (${prompt.length} chars). Maximum is ${MAX_PROMPT_CHARS}.`);
      setPhase('error');
      return;
    }
    setPhase('submitting');
    setResult(null);
    setProof(null);
    setErrorMsg('');
    setElapsedSec(0);
    setJobStartedAt(null);
    setProgressPhase(null);

    try {
      const res = await fetch(`${API_PREFIX}/jobs/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(renterKey === ADMIN_TOKEN
            ? { 'x-admin-token': ADMIN_TOKEN, 'x-renter-key': 'dc1-renter-d1f00fc37ee3a0898b2dc88f33bf54b3' }
            : { 'x-renter-key': renterKey }),
        },
        body: JSON.stringify({
          provider_id: providerId,
          job_type: 'llm_inference',
          duration_minutes: 10,
          params: { model, prompt: prompt.trim(), max_tokens: maxTokens, temperature },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) {
          throw new Error(`Insufficient balance. Need ${err.shortfall_halala || '?'} more halala. Top up your account.`);
        }
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Submission failed');

      setJobId(data.job.id);
      setJobStringId(data.job.job_id || '');
      setJobStartedAt(new Date()); // Start counting from submission
      setPhase('polling');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit');
      setPhase('error');
    }
  }

  // ── Poll for result ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'polling' || !jobId) return;
    let pollCount = 0;

    async function poll() {
      pollCount++;
      // Adaptive polling: fast at start, slow after 30s
      const interval = pollCount < 10 ? 2000 : pollCount < 30 ? 3000 : 5000;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s request timeout

        const res = await fetch(`${API_PREFIX}/jobs/${jobId}/output`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.status === 202) {
          try {
            const statusData = await res.json();
            if (statusData.progress_phase) {
              setProgressPhase(statusData.progress_phase as ProgressPhase);
            }
            // Update started_at from server for accurate timing
            if (statusData.started_at && !jobStartedAt) {
              setJobStartedAt(new Date(statusData.started_at));
            }
          } catch { /* ignore parse errors */ }
          // Schedule next poll with adaptive interval
          pollRef.current = setTimeout(poll, interval);
          return;
        }
        if (res.status === 204) {
          pollRef.current = setTimeout(poll, interval);
          return;
        }

        // 410 Gone = failed/cancelled with details
        if (res.status === 410) {
          const data = await res.json();
          const refundNote = data.refunded ? ' (balance refunded)' : '';
          setErrorMsg((data.error || 'Job failed on provider') + refundNote);
          setPhase('error');
          fetchHistory(); // Refresh balance
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data.type === 'text' && data.response) {
            setResult(data);
            if (jobId) fetchProof(jobId);
            setPhase('done');
            fetchHistory(); // Refresh history + balance
          } else {
            // Got 200 but unexpected format — keep polling briefly
            pollRef.current = setTimeout(poll, interval);
          }
        } else if (res.status === 404) {
          // Job not found — might have been cleaned up
          setErrorMsg('Job not found. It may have expired or been cancelled.');
          setPhase('error');
        } else {
          // Other error — keep trying
          pollRef.current = setTimeout(poll, interval);
        }
      } catch (err) {
        // Network error / timeout — retry
        if (pollCount < 200) {
          pollRef.current = setTimeout(poll, 5000); // Back off on errors
        } else {
          setErrorMsg('Connection lost — could not reach the server after multiple attempts.');
          setPhase('error');
        }
      }
    }

    poll(); // immediate first check
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [phase, jobId]);

  // Stop polling after 10 minutes
  useEffect(() => {
    if (phase === 'polling' && elapsedSec > 600) {
      setErrorMsg('Job timed out after 10 minutes. The provider may be busy, offline, or the model may be too large for the GPU.');
      setPhase('error');
      if (pollRef.current) clearTimeout(pollRef.current);
      fetchHistory();
    }
  }, [phase, elapsedSec]);

  async function fetchProof(id: number) {
    try {
      const res = await fetch(`${API_PREFIX}/admin/jobs/${id}`, {
        headers: { 'x-admin-token': ADMIN_TOKEN },
      });
      if (!res.ok) return;
      const data = await res.json();
      const job = data.job;
      const prov = data.provider || {};
      const billing = data.billing || {};

      setProof({
        job_id: job.job_id || `#${job.id}`,
        provider_name: prov.name || 'Unknown',
        provider_gpu: prov.gpu_name_detected || prov.gpu_model || 'Unknown',
        provider_hostname: prov.provider_hostname || '',
        status: job.status,
        started_at: job.started_at || '',
        completed_at: job.completed_at || '',
        actual_duration_minutes: job.actual_duration_minutes || 0,
        cost_halala: billing.cost_halala || job.actual_cost_halala || 0,
        provider_earned_halala: billing.provider_cut_halala || job.provider_earned_halala || 0,
        dc1_fee_halala: billing.dc1_cut_halala || job.dc1_fee_halala || 0,
        raw_log: job.result || '',
      });
    } catch { /* ignore */ }
  }

  // Retry last job
  function retryJob() {
    setPhase('idle');
    setResult(null);
    setProof(null);
    setErrorMsg('');
    setProgressPhase(null);
    // Keep prompt and settings — just go back to idle so they can re-submit
  }

  // Format elapsed time
  function fmtElapsed(sec: number): string {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }

  // Cost estimate
  const selectedModel = MODELS.find(m => m.id === model) || MODELS[0];
  const estimatedCostHalala = selectedModel.rate * 1; // 1 minute minimum
  const estimatedCostSar = (estimatedCostHalala / 100).toFixed(2);

  // ── Styling ──────────────────────────────────────────────────────
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00D9FF]/60 transition';

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
          <h1 className="text-2xl font-bold mb-2">LLM Playground</h1>
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/renter" className="text-white/40 text-sm hover:text-[#00D9FF] transition">&larr; Renter Dashboard</Link>
            <h1 className="text-2xl font-bold mt-1">LLM Playground</h1>
            <p className="text-white/40 text-sm">Run AI inference on real GPU hardware — see the result and execution proof.</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm text-white/60">{renterName}</span>
            </div>
            {balanceSar && <div className="text-xs text-[#FFD700]">{balanceSar} SAR</div>}
            <button onClick={logout} className="text-xs text-white/30 hover:text-white/50 transition">Logout</button>
          </div>
        </div>

        {/* ── Form ──────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 space-y-5">

          {/* Model */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Model</label>
            <select className={inputCls} value={model} onChange={e => setModel(e.target.value)} disabled={phase === 'polling'}>
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label} — {m.vram} VRAM, {m.speed}</option>
              ))}
            </select>
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
                    disabled={phase === 'polling'}
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
                <button onClick={fetchProviders} className="ml-2 text-[#00D9FF] hover:underline">Refresh</button>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-white/60">Prompt</label>
              <span className={`text-xs ${prompt.length > MAX_PROMPT_CHARS ? 'text-red-400' : 'text-white/30'}`}>
                {prompt.length.toLocaleString()} / {MAX_PROMPT_CHARS.toLocaleString()}
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="What is the capital of Saudi Arabia? Give a brief answer."
              className={`${inputCls} resize-y ${prompt.length > MAX_PROMPT_CHARS ? 'border-red-500/50' : ''}`}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={phase === 'polling'}
            />
          </div>

          {/* Max tokens + Temperature */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Max Tokens</label>
              <input type="number" min={32} max={4096} className={inputCls} value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} disabled={phase === 'polling'} />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Temperature: {temperature.toFixed(1)}</label>
              <input type="range" min={0.1} max={2.0} step={0.1} className="w-full accent-[#00D9FF] mt-2" value={temperature} onChange={e => setTemperature(Number(e.target.value))} disabled={phase === 'polling'} />
            </div>
          </div>

          {/* Cost estimate */}
          <div className="flex items-center justify-between text-xs text-white/40 px-1">
            <span>Est. cost: ~{estimatedCostHalala} halala ({estimatedCostSar} SAR) per minute</span>
            <span>Rate: {selectedModel.rate} halala/min</span>
          </div>

          {/* Submit */}
          <button
            onClick={submitJob}
            disabled={phase === 'polling' || phase === 'submitting' || !prompt.trim() || !providerId || prompt.length > MAX_PROMPT_CHARS}
            className="w-full py-3.5 rounded-xl font-semibold bg-[#00D9FF] text-[#0d1117] hover:bg-[#00D9FF]/90 disabled:opacity-40 disabled:cursor-not-allowed transition text-lg"
          >
            {phase === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Submitting...
              </span>
            ) : phase === 'polling' ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                {progressPhase === 'downloading_model' ? `Downloading model... (${fmtElapsed(elapsedSec)})` :
                 progressPhase === 'installing_deps' ? `Installing dependencies... (${fmtElapsed(elapsedSec)})` :
                 progressPhase === 'loading_model' ? `Loading model onto GPU... (${fmtElapsed(elapsedSec)})` :
                 progressPhase === 'generating' ? `Generating response... (${fmtElapsed(elapsedSec)})` :
                 progressPhase === 'formatting' ? `Formatting output... (${fmtElapsed(elapsedSec)})` :
                 `Running on GPU... (${fmtElapsed(elapsedSec)})`}
              </span>
            ) : 'Run Inference'}
          </button>

          {/* Progress Steps */}
          {phase === 'polling' && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 text-sm">
                {(['installing_deps', 'downloading_model', 'loading_model', 'generating', 'formatting'] as const).map((step, i) => {
                  const labels: Record<string, string> = {
                    installing_deps: 'Deps',
                    downloading_model: 'Download',
                    loading_model: 'Load GPU',
                    generating: 'Generate',
                    formatting: 'Format',
                  };
                  const stepOrder = ['installing_deps', 'downloading_model', 'loading_model', 'generating', 'formatting'];
                  const currentIdx = progressPhase ? stepOrder.indexOf(progressPhase) : -1;
                  const isActive = step === progressPhase;
                  const isDone = currentIdx > i;
                  return (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-[#00D9FF] animate-pulse' : isDone ? 'bg-green-400' : 'bg-white/20'}`} />
                      <span className={isActive ? 'text-[#00D9FF] font-medium' : isDone ? 'text-green-400/80' : 'text-white/30'}>{labels[step]}</span>
                      {i < 4 && <span className="text-white/10 mx-1">&rarr;</span>}
                    </div>
                  );
                })}
              </div>
              {/* Cancel button */}
              <div className="mt-3 text-center">
                <button
                  onClick={() => { setPhase('idle'); setProgressPhase(null); if (pollRef.current) clearTimeout(pollRef.current); }}
                  className="text-xs text-white/30 hover:text-red-400 transition"
                >
                  Cancel polling
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-red-400 text-xl mt-0.5">&#x26A0;</div>
              <div className="flex-1">
                <h3 className="text-red-400 font-semibold mb-1">Job Failed</h3>
                <p className="text-red-300/80 text-sm mb-3">{errorMsg}</p>
                {elapsedSec > 0 && <p className="text-red-300/50 text-xs mb-2">Elapsed: {fmtElapsed(elapsedSec)} &bull; Job: {jobStringId || `#${jobId}`}</p>}
                <div className="flex gap-3">
                  <button onClick={retryJob} className="text-sm px-4 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition">
                    Retry with same prompt
                  </button>
                  <button onClick={() => { setPhase('idle'); setPrompt(''); setErrorMsg(''); }} className="text-sm text-white/40 hover:text-white/60 transition">
                    Start fresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Result ────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-4">
            {/* AI Response */}
            <div className="bg-[#00D9FF]/5 border border-[#00D9FF]/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[#00D9FF]" />
                <span className="text-[#00D9FF] font-semibold text-sm">AI Response</span>
                <span className="text-white/30 text-xs ml-auto">{result.model.split('/').pop()} &bull; {fmtElapsed(elapsedSec)}</span>
              </div>
              <p className="text-white/90 leading-relaxed text-lg whitespace-pre-wrap">{result.response}</p>
            </div>

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
                  <ProofRow label="Device" value={result.device.toUpperCase()} highlight={result.device === 'cuda'} />
                  <ProofRow label="Model" value={result.model} />
                  <ProofRow label="Tokens Generated" value={String(result.tokens_generated)} />
                  <ProofRow label="Speed" value={`${result.tokens_per_second} tok/s`} highlight />
                  <ProofRow label="Generation Time" value={`${result.gen_time_s}s`} />
                  <ProofRow label="Total Execution" value={`${result.total_time_s}s`} />
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
              onClick={() => { setPhase('idle'); setResult(null); setProof(null); setPrompt(''); setProgressPhase(null); setElapsedSec(0); }}
              className="w-full py-3 rounded-xl font-semibold border border-[#00D9FF]/30 text-[#00D9FF] hover:bg-[#00D9FF]/10 transition"
            >
              Run Another Prompt
            </button>
          </div>
        )}

        {/* ── Job History ───────────────────────────────────────── */}
        {history.length > 0 && phase !== 'polling' && (
          <div className="mt-8 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full px-6 py-4 flex items-center justify-between text-sm text-white/60 hover:text-white/80 transition"
            >
              <div className="flex items-center gap-2">
                <svg className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Job History</span>
                <span className="text-white/30">({history.length} jobs)</span>
              </div>
              {balanceSar && <span className="text-[#FFD700] text-xs">Balance: {balanceSar} SAR</span>}
            </button>
            {showHistory && (
              <div className="border-t border-white/10">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/40 border-b border-white/5">
                        <th className="px-4 py-2 text-left font-medium">Time</th>
                        <th className="px-4 py-2 text-left font-medium">Provider</th>
                        <th className="px-4 py-2 text-left font-medium">GPU</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                        <th className="px-4 py-2 text-right font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(j => (
                        <tr key={j.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2 text-white/50">
                            {j.submitted_at ? new Date(j.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-2 text-white/60">{j.provider_name || '—'}</td>
                          <td className="px-4 py-2 text-white/50">{j.provider_gpu || '—'}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              j.status === 'completed' ? 'bg-green-400/10 text-green-400' :
                              j.status === 'failed' ? 'bg-red-400/10 text-red-400' :
                              j.status === 'running' ? 'bg-blue-400/10 text-blue-400' :
                              j.status === 'cancelled' ? 'bg-yellow-400/10 text-yellow-400' :
                              'bg-white/10 text-white/50'
                            }`}>
                              {j.status}{j.refunded ? ' ↺' : ''}
                            </span>
                            {j.error && <div className="text-red-400/60 text-[10px] mt-0.5 truncate max-w-[200px]">{j.error}</div>}
                          </td>
                          <td className="px-4 py-2 text-right text-white/60">
                            {j.cost_sar} SAR
                            {j.refunded && <span className="text-green-400 text-[10px] ml-1">(refunded)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
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
