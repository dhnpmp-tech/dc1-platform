'use client';

import { useState, useEffect, useRef, useCallback, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ErrorBoundary to capture the actual crash error
class PlaygroundErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('PlaygroundErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1117] text-white p-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Playground Render Error</h1>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="font-mono text-sm text-red-300">{this.state.error?.message}</p>
              <p className="font-mono text-xs text-red-300/60 mt-2">{this.state.error?.stack}</p>
            </div>
            {this.state.errorInfo && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-yellow-300 mb-2">Component Stack:</p>
                <pre className="font-mono text-xs text-yellow-300/60 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
              </div>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="px-4 py-2 rounded-lg bg-[#00D9FF] text-[#0d1117] font-semibold text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const API_BASE = '/api/dc1';

type JobType = 'llm_inference' | 'image_generation' | 'vllm_serve';

const LLM_MODELS = [
  { id: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', label: 'TinyLlama 1.1B Chat', vram: '~2 GB', speed: 'Fast' },
  { id: 'google/gemma-2b-it', label: 'Google Gemma 2B Instruct', vram: '~4 GB', speed: 'Fast' },
  { id: 'microsoft/Phi-3-mini-4k-instruct', label: 'Microsoft Phi-3 Mini (3.8B)', vram: '~4 GB', speed: 'Medium' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B Instruct v0.2', vram: '~14 GB', speed: 'Medium' },
  { id: 'meta-llama/Meta-Llama-3-8B-Instruct', label: 'Llama 3 8B Instruct', vram: '~16 GB', speed: 'Medium' },
  { id: 'Qwen/Qwen2-7B-Instruct', label: 'Qwen2 7B Instruct', vram: '~14 GB', speed: 'Medium' },
  { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', label: 'DeepSeek R1 7B', vram: '~16 GB', speed: 'Slow' },
  { id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B', label: 'DeepSeek R1 Distill 8B', vram: '~16 GB', speed: 'Slow' },
] as const;

const SD_MODELS = [
  { id: 'CompVis/stable-diffusion-v1-4', label: 'Stable Diffusion v1.4', vram: '~3.5 GB', speed: 'Fast' },
] as const;

const VLLM_MODELS = [
  { id: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', label: 'TinyLlama 1.1B Chat', vram: '~2 GB' },
  { id: 'google/gemma-2b-it', label: 'Google Gemma 2B Instruct', vram: '~4 GB' },
  { id: 'microsoft/Phi-3-mini-4k-instruct', label: 'Microsoft Phi-3 Mini (3.8B)', vram: '~4 GB' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B Instruct v0.2', vram: '~14 GB' },
  { id: 'meta-llama/Meta-Llama-3-8B-Instruct', label: 'Llama 3 8B Instruct', vram: '~16 GB' },
  { id: 'Qwen/Qwen2-7B-Instruct', label: 'Qwen2 7B Instruct', vram: '~14 GB' },
  { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', label: 'DeepSeek R1 7B', vram: '~16 GB' },
] as const;

const COST_RATES: Record<JobType, number> = {
  llm_inference: 15,
  image_generation: 20,
  vllm_serve: 20,
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

interface JobTemplate {
  id: number;
  name: string;
  job_type: string;
  model: string;
  system_prompt: string | null;
  max_tokens: number | null;
  resource_spec_json: string | null;
  created_at: string;
}

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';
type ViewMode = 'new' | 'history';
type ImageType = 'pytorch-cuda' | 'vllm-serve' | 'training' | 'rendering';

const IMAGE_TYPE_TO_COMPUTE: Record<ImageType, string> = {
  'pytorch-cuda': 'inference',
  'vllm-serve': 'inference',
  'training': 'training',
  'rendering': 'rendering',
};

const VRAM_OPTIONS = [
  { value: 4096, label: '4 GB' },
  { value: 8192, label: '8 GB' },
  { value: 16384, label: '16 GB' },
  { value: 24576, label: '24 GB' },
  { value: 40960, label: '40 GB' },
];

export default function GpuPlaygroundPage() {
  return (
    <PlaygroundErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-[#0d1117] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-[#FFD700] border-t-transparent rounded-full" /></div>}>
        <GpuPlayground />
      </Suspense>
    </PlaygroundErrorBoundary>
  );
}

function GpuPlayground() {
  const searchParams = useSearchParams();
  const preselectedProvider = searchParams.get('provider');
  const preselectedModel = searchParams.get('model');

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

  // vLLM Serve Form
  const [vllmModel, setVllmModel] = useState<string>(VLLM_MODELS[0].id);
  const [vllmDuration, setVllmDuration] = useState(30);
  const [vllmDtype, setVllmDtype] = useState<'float16' | 'bfloat16' | 'float32'>('float16');
  const [vllmMaxModelLen, setVllmMaxModelLen] = useState(4096);

  // Templates
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Container spec
  const [imageType, setImageType] = useState<ImageType>('pytorch-cuda');
  const [vramRequiredMb, setVramRequiredMb] = useState<number>(4096);
  const [gpuCount, setGpuCount] = useState<1 | 2 | 4>(1);
  const [containerImages, setContainerImages] = useState<string[]>([]);
  const [queueWait, setQueueWait] = useState<number | null>(null);

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
  const [endpointUrl, setEndpointUrl] = useState<string>('');
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!preselectedModel) return;
    const selectedModel = preselectedModel;
    const supported = LLM_MODELS.some(model => model.id === selectedModel);
    if (!supported) return;
    setJobType('llm_inference');
    setLlmModel(selectedModel);
    setVllmModel(selectedModel);
  }, [preselectedModel]);

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? (sessionStorage.getItem('dc1_renter_key') || localStorage.getItem('dc1_renter_key'))
      : null;
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
        // Load templates
        fetch(`${API_BASE}/renters/me/templates?key=${encodeURIComponent(key)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.templates) setTemplates(d.templates); })
          .catch(() => {});
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

  useEffect(() => {
    fetch(`${API_BASE}/containers/registry`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.images && Array.isArray(d.images)) {
          // API returns objects with {id, image_ref, image_type, ...} — extract valid image types
          const validTypes = new Set(['pytorch-cuda', 'vllm-serve', 'training', 'rendering']);
          const imageTypes: string[] = d.images
            .map((img: unknown) => typeof img === 'string' ? img : (img as Record<string, unknown>)?.image_type || '')
            .filter((v: string) => validTypes.has(v))
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
          // Only use API results if they contain valid image types; otherwise fallback to hardcoded list
          if (imageTypes.length > 0) setContainerImages(imageTypes);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!renterKey) {
      setQueueWait(null);
      return;
    }

    const computeType = IMAGE_TYPE_TO_COMPUTE[imageType];
    fetch(`${API_BASE}/jobs/queue/status`, {
      headers: { 'x-renter-key': renterKey },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const source = Array.isArray(d?.queue) ? d.queue : d?.buckets;
        if (!Array.isArray(source)) { setQueueWait(null); return; }
        const bucket = (source as Array<{ compute_type: string; vram_bucket?: string | number; vram_required_mb?: string | number; count?: number; depth?: number }>)
          .find((b) => b.compute_type === computeType
            && Number(b.vram_bucket ?? b.vram_required_mb ?? 0) <= vramRequiredMb);
        setQueueWait(bucket ? Number(bucket.count ?? bucket.depth ?? 0) : 0);
      })
      .catch(() => setQueueWait(null));
  }, [imageType, renterKey, vramRequiredMb]);

  // ── Submit job ───────────────────────────────────────────────────
  async function submitJob() {
    if (jobType !== 'vllm_serve' && !prompt.trim()) return;
    if (!providerId) return;
    setPhase('submitting');
    setResult(null);
    setProof(null);
    setErrorMsg('');
    setEndpointUrl('');
    setCopiedEndpoint(false);
    setPollCount(0);
    setProgressPhase('');
    setViewMode('new');

    let params: Record<string, unknown>;
    let durationMinutes: number;
    if (jobType === 'vllm_serve') {
      params = { model: vllmModel, max_model_len: vllmMaxModelLen, dtype: vllmDtype };
      durationMinutes = vllmDuration;
    } else if (jobType === 'llm_inference') {
      params = { model: llmModel, prompt: prompt.trim(), max_tokens: maxTokens, temperature };
      durationMinutes = 10;
    } else {
      params = {
        model: sdModel,
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
        steps,
        width: imgWidth,
        height: imgHeight,
        seed: seed >= 0 ? seed : undefined,
      };
      durationMinutes = 15;
    }

    try {
      const containerSpec = {
        image_type: imageType,
        vram_required_mb: vramRequiredMb,
        gpu_count: gpuCount,
        compute_type: IMAGE_TYPE_TO_COMPUTE[imageType],
      };

      const res = await fetch(`${API_BASE}/jobs/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': renterKey },
        body: JSON.stringify({
          provider_id: providerId,
          job_type: jobType,
          duration_minutes: durationMinutes,
          params,
          container_spec: containerSpec,
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
          // vLLM serve: detect when endpoint is ready
          if (jobType === 'vllm_serve' && job.endpoint_url && job.status === 'running') {
            setEndpointUrl(job.endpoint_url);
            fetchProof(jobId!);
            setPhase('done');
            refreshJobHistory();
            return;
          }
          // vLLM serve completed (duration expired)
          if (jobType === 'vllm_serve' && job.status === 'completed') {
            setPhase('done');
            refreshJobHistory();
            return;
          }
        }

        // For non-vLLM jobs, check output endpoint
        if (jobType !== 'vllm_serve') {
          const res = await fetch(`${API_BASE}/jobs/${jobId}/output`, {
            headers: { 'Accept': 'application/json' },
          });

          if (res.status === 202) return; // still running
          if (res.status === 204) return; // completed but no output yet

          if (res.ok) {
            const data = await res.json();
            if (data.type === 'text' && data.response) {
              setResult(data);
              if (jobId) fetchProof(jobId!);
              setPhase('done');
              refreshJobHistory();
            } else if (data.type === 'image' && data.image_base64) {
              setResult(data);
              if (jobId) fetchProof(jobId!);
              setPhase('done');
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

  async function fetchTemplates() {
    if (!renterKey) return;
    try {
      const res = await fetch(`${API_BASE}/renters/me/templates?key=${encodeURIComponent(renterKey)}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch { /* ignore */ }
  }

  async function saveTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      let model = jobType === 'llm_inference' ? llmModel : jobType === 'image_generation' ? sdModel : vllmModel;
      const res = await fetch(`${API_BASE}/renters/me/templates?key=${encodeURIComponent(renterKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          job_type: jobType,
          model,
          max_tokens: jobType === 'llm_inference' ? maxTokens : null,
          resource_spec_json: JSON.stringify(
            jobType === 'llm_inference'
              ? { prompt: prompt.trim(), temperature }
              : jobType === 'image_generation'
              ? { steps, width: imgWidth, height: imgHeight }
              : { max_model_len: vllmMaxModelLen, dtype: vllmDtype, duration_minutes: vllmDuration }
          ),
        }),
      });
      if (res.ok) {
        setSaveTemplateModal(false);
        setTemplateName('');
        setTemplateSaved(true);
        fetchTemplates();
        setTimeout(() => setTemplateSaved(false), 3000);
      }
    } catch { /* ignore */ }
    finally { setSavingTemplate(false); }
  }

  function loadTemplate(tpl: JobTemplate) {
    setShowTemplateDropdown(false);
    const spec = tpl.resource_spec_json ? (() => { try { return JSON.parse(tpl.resource_spec_json!); } catch { return {}; } })() : {};
    if (tpl.job_type === 'llm_inference') {
      setJobType('llm_inference');
      setLlmModel(tpl.model);
      if (tpl.max_tokens) setMaxTokens(tpl.max_tokens);
      if (spec.prompt) setPrompt(spec.prompt);
      if (spec.temperature != null) setTemperature(spec.temperature);
    } else if (tpl.job_type === 'image_generation') {
      setJobType('image_generation');
      setSdModel(tpl.model);
      if (spec.steps) setSteps(spec.steps);
      if (spec.width) setImgWidth(spec.width);
      if (spec.height) setImgHeight(spec.height);
    } else if (tpl.job_type === 'vllm_serve') {
      setJobType('vllm_serve');
      setVllmModel(tpl.model);
      if (spec.max_model_len) setVllmMaxModelLen(spec.max_model_len);
      if (spec.dtype) setVllmDtype(spec.dtype);
      if (spec.duration_minutes) setVllmDuration(spec.duration_minutes);
    }
    setViewMode('new');
  }

  async function deleteTemplate(id: number) {
    try {
      await fetch(`${API_BASE}/renters/me/templates/${id}?key=${encodeURIComponent(renterKey)}`, { method: 'DELETE' });
      fetchTemplates();
    } catch { /* ignore */ }
  }

  function resetForm() {
    setPhase('idle');
    setResult(null);
    setProof(null);
    setPrompt('');
    setNegativePrompt('');
    setProgressPhase('');
    setEndpointUrl('');
    setCopiedEndpoint(false);
  }

  function copyEndpoint() {
    navigator.clipboard.writeText(endpointUrl).then(() => {
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    });
  }

  // ── Styling ──────────────────────────────────────────────────────
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00D9FF]/60 transition';
  const rate = COST_RATES[jobType];
  const isRunning = phase === 'polling' || phase === 'submitting';
  const isSubmitDisabled = isRunning || !providerId || (jobType !== 'vllm_serve' && !prompt.trim());

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
        starting_server: 'Starting vLLM server...',
        server_ready: 'Server ready!',
      };
      return `${labels[progressPhase] || progressPhase} (${elapsed})`;
    }
    if (jobType === 'vllm_serve') return `Starting vLLM server on GPU... (${elapsed})`;
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
    <>
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
        <div className="flex gap-2 mb-6 flex-wrap">
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
          {/* Templates dropdown */}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowTemplateDropdown(v => !v)}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-white/5 text-white/50 border border-white/10 hover:border-[#FFD700]/40 hover:text-[#FFD700] transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h6" /></svg>
              Templates
              {templates.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">{templates.length}</span>
              )}
            </button>
            {showTemplateDropdown && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#1a1f2e] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Saved Templates</span>
                </div>
                {templates.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-white/30 text-center">No templates yet. Save a job config to reuse it.</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {templates.map(tpl => (
                      <div key={tpl.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0">
                        <button
                          onClick={() => loadTemplate(tpl)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm font-medium text-white/80">{tpl.name}</div>
                          <div className="text-xs text-white/30 mt-0.5">{tpl.job_type.replace(/_/g, ' ')} · {tpl.model.split('/').pop()}</div>
                        </button>
                        <button
                          onClick={() => deleteTemplate(tpl.id)}
                          className="ml-2 p-1 text-white/20 hover:text-red-400 transition shrink-0"
                          title="Delete template"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Close template dropdown on outside click */}
        {showTemplateDropdown && (
          <div className="fixed inset-0 z-20" onClick={() => setShowTemplateDropdown(false)} />
        )}

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
                            <ProofRow label="DCP Fee" value={`${viewingProof.dc1_fee_halala} halala (25%)`} />
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
                      const isVllm = job.job_type === 'vllm_serve';
                      const isCompleted = job.status === 'completed';
                      const isRunningJob = job.status === 'running';
                      const canView = isCompleted && !isVllm;
                      const duration = job.completed_at && job.submitted_at
                        ? Math.round((new Date(job.completed_at).getTime() - new Date(job.submitted_at).getTime()) / 1000)
                        : 0;
                      const jobIcon = isVllm ? '⚡' : isImage ? '🎨' : '💬';
                      const jobLabel = isVllm ? 'vLLM Serve' : isImage ? 'Image Generation' : 'LLM Inference';

                      return (
                        <button
                          key={job.id}
                          onClick={() => canView ? loadJobResult(job) : undefined}
                          disabled={!canView}
                          className={`w-full text-left px-5 py-4 rounded-xl border transition ${
                            canView
                              ? 'border-white/10 bg-white/5 hover:border-[#00D9FF]/40 hover:bg-white/[0.07] cursor-pointer'
                              : 'border-white/5 bg-white/[0.02] cursor-default opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{jobIcon}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white/80">
                                    {job.job_id || `#${job.id}`}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    isCompleted ? 'bg-green-500/20 text-green-400' :
                                    job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    isRunningJob ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-white/10 text-white/40'
                                  }`}>
                                    {isVllm && isRunningJob ? 'serving' : job.status}
                                  </span>
                                </div>
                                <div className="text-xs text-white/40 mt-0.5">
                                  {jobLabel}
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
                                <div className="text-xs text-white/30">{duration >= 60 ? `${Math.floor(duration/60)}m` : `${duration}s`}</div>
                              )}
                            </div>
                          </div>
                          {canView && (
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
                <span className="mr-2">🎨</span> Image Gen
              </button>
              <button
                onClick={() => { if (!isRunning) setJobType('vllm_serve'); }}
                disabled={isRunning}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                  jobType === 'vllm_serve'
                    ? 'bg-green-500 text-[#0d1117]'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
                } disabled:opacity-60`}
              >
                <span className="mr-2">⚡</span> vLLM Serve
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
                ) : jobType === 'image_generation' ? (
                  <select className={inputCls} value={sdModel} onChange={e => setSdModel(e.target.value)} disabled={isRunning}>
                    {SD_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label} — {m.vram} VRAM, {m.speed}</option>
                    ))}
                  </select>
                ) : (
                  <select className={inputCls} value={vllmModel} onChange={e => setVllmModel(e.target.value)} disabled={isRunning}>
                    {VLLM_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label} — {m.vram} VRAM</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Container Spec */}
              <div className="border border-white/10 rounded-xl p-4 space-y-4 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#F5A524]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-sm font-semibold text-white/80">Container</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Image Type */}
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Image Type</label>
                    <select
                      className={inputCls}
                      value={imageType}
                      onChange={e => setImageType(e.target.value as ImageType)}
                      disabled={isRunning}
                    >
                      {(containerImages.length > 0
                        ? containerImages
                        : ['pytorch-cuda', 'vllm-serve', 'training', 'rendering']
                      ).map(img => (
                        <option key={img} value={img}>{img}</option>
                      ))}
                    </select>
                    <p className="text-xs text-white/30 mt-1">
                      Compute type: <span className="text-[#F5A524]">{IMAGE_TYPE_TO_COMPUTE[imageType]}</span>
                    </p>
                  </div>

                  {/* GPU Count */}
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">GPU Count</label>
                    <div className="flex gap-2">
                      {([1, 2, 4] as const).map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setGpuCount(n)}
                          disabled={isRunning}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                            gpuCount === n
                              ? 'border-[#F5A524] bg-[#F5A524]/10 text-[#F5A524]'
                              : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                          } disabled:opacity-50`}
                        >
                          {n}×
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* VRAM Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs text-white/50">VRAM Required</label>
                    <span className="text-xs text-[#F5A524] font-semibold">
                      {VRAM_OPTIONS.find(o => o.value === vramRequiredMb)?.label ?? `${vramRequiredMb / 1024} GB`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={VRAM_OPTIONS.length - 1}
                    step={1}
                    className="w-full accent-[#F5A524]"
                    value={VRAM_OPTIONS.findIndex(o => o.value === vramRequiredMb)}
                    onChange={e => setVramRequiredMb(VRAM_OPTIONS[Number(e.target.value)].value)}
                    disabled={isRunning}
                  />
                  <div className="flex justify-between text-xs text-white/25 mt-1">
                    {VRAM_OPTIONS.map(o => <span key={o.value}>{o.label}</span>)}
                  </div>
                </div>

                {/* Queue wait estimate */}
                {queueWait !== null && queueWait > 0 && (
                  <div className="flex items-center gap-2 text-xs text-yellow-400/80 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {queueWait} job{queueWait !== 1 ? 's' : ''} ahead in queue for this configuration
                  </div>
                )}
                {queueWait === 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-400/80 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    No queue — this configuration should start immediately
                  </div>
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

              {/* Prompt — hidden for vllm_serve */}
              {jobType !== 'vllm_serve' && (
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
              )}

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

              {/* vLLM Serve-specific fields */}
              {jobType === 'vllm_serve' && (
                <>
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-300/80">
                    Starts an OpenAI-compatible vLLM server on the provider GPU. You'll receive an API endpoint URL when the server is ready.
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Duration</label>
                      <select className={inputCls} value={vllmDuration} onChange={e => setVllmDuration(Number(e.target.value))} disabled={isRunning}>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                        <option value={120}>120 minutes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Precision</label>
                      <select className={inputCls} value={vllmDtype} onChange={e => setVllmDtype(e.target.value as typeof vllmDtype)} disabled={isRunning}>
                        <option value="float16">float16 (recommended)</option>
                        <option value="bfloat16">bfloat16</option>
                        <option value="float32">float32 (slow)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Max Context Length: {vllmMaxModelLen.toLocaleString()} tokens</label>
                    <input type="range" min={512} max={8192} step={512} className="w-full accent-green-500 mt-1" value={vllmMaxModelLen} onChange={e => setVllmMaxModelLen(Number(e.target.value))} disabled={isRunning} />
                    <div className="flex justify-between text-xs text-white/30 mt-1">
                      <span>512</span><span>8192</span>
                    </div>
                  </div>
                </>
              )}

              {/* Cost estimate */}
              <div className="flex justify-between text-xs text-white/40 px-1">
                {jobType === 'vllm_serve'
                  ? <span>Est. cost: ~{rate * vllmDuration} halala ({(rate * vllmDuration / 100).toFixed(2)} SAR) for {vllmDuration} min</span>
                  : <span>Est. cost: ~{rate} halala ({(rate / 100).toFixed(2)} SAR) per minute</span>
                }
                <span>Rate: {rate} halala/min</span>
              </div>

              {/* Submit */}
              <button
                onClick={submitJob}
                disabled={isSubmitDisabled}
                className={`w-full py-3.5 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition text-lg ${
                  jobType === 'image_generation'
                    ? 'bg-[#A855F7] text-white hover:bg-[#A855F7]/90'
                    : jobType === 'vllm_serve'
                    ? 'bg-green-500 text-[#0d1117] hover:bg-green-500/90'
                    : 'bg-[#00D9FF] text-[#0d1117] hover:bg-[#00D9FF]/90'
                }`}
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    {getProgressLabel()}
                  </span>
                ) : jobType === 'image_generation' ? 'Generate Image' : jobType === 'vllm_serve' ? 'Start vLLM Server' : 'Run Inference'}
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

            {/* ── vLLM Endpoint Result ─────────────────────────────── */}
            {phase === 'done' && jobType === 'vllm_serve' && (
              <div className="space-y-4">
                {endpointUrl ? (
                  <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-400 font-semibold">vLLM Server Ready</span>
                    </div>
                    <p className="text-white/50 text-sm mb-3">Your OpenAI-compatible endpoint is live. Use this URL with any OpenAI SDK.</p>
                    <div className="flex items-center gap-2 bg-black/40 rounded-lg px-4 py-3 mb-4">
                      <code className="flex-1 text-green-300 font-mono text-sm break-all">{endpointUrl}</code>
                      <button
                        onClick={copyEndpoint}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 transition"
                      >
                        {copiedEndpoint ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-black/40 rounded-lg p-4">
                      <p className="text-white/40 text-xs mb-2 font-medium">Example usage (Python):</p>
                      <pre className="text-green-300/70 font-mono text-xs overflow-x-auto whitespace-pre">{`from openai import OpenAI
client = OpenAI(base_url="${endpointUrl}", api_key="dc1")
response = client.chat.completions.create(
    model="${vllmModel}",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`}</pre>
                    </div>
                    {proof && (
                      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-t border-white/10 pt-4">
                        <ProofRow label="Job ID" value={proof.job_id} />
                        <ProofRow label="Model" value={vllmModel.split('/').pop() || vllmModel} />
                        <ProofRow label="Cost" value={`${proof.cost_halala} halala (${(proof.cost_halala / 100).toFixed(2)} SAR)`} />
                        <ProofRow label="Duration" value={`${vllmDuration} min reserved`} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                    <p className="text-white/50">vLLM server session ended.</p>
                  </div>
                )}
                <button
                  onClick={resetForm}
                  className="w-full py-3 rounded-xl font-semibold border border-green-500/30 text-green-400 hover:bg-green-500/10 transition"
                >
                  Start Another Server
                </button>
              </div>
            )}

            {/* ── Result ──────────────────────────────────────────── */}
            {result && jobType !== 'vllm_serve' && (
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
                      <ProofRow label="DCP Fee" value={proof ? `${proof.dc1_fee_halala} halala (25%)` : '—'} />
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

                {/* Save as Template */}
                {templateSaved ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Template saved!
                  </div>
                ) : (
                  <button
                    onClick={() => { setTemplateName(''); setSaveTemplateModal(true); }}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    Save as Template
                  </button>
                )}

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

    {/* Save Template Modal */}
    {saveTemplateModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-labelledby="save-tpl-title">
        <div className="bg-[#1a1f2e] border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-4">
          <h2 id="save-tpl-title" className="text-base font-bold text-white">Save as Template</h2>
          <p className="text-white/40 text-sm">Name this configuration so you can load it later.</p>
          <input
            type="text"
            placeholder="e.g. Arabic Summariser"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/60 transition text-sm"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); }}
            autoFocus
            maxLength={120}
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setSaveTemplateModal(false)}
              disabled={savingTemplate}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/5 text-white/50 hover:bg-white/10 border border-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={saveTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#FFD700] text-[#0d1117] hover:bg-[#FFD700]/90 disabled:opacity-50 transition flex items-center gap-2"
            >
              {savingTemplate && <span className="animate-spin h-3.5 w-3.5 border-2 border-[#0d1117] border-t-transparent rounded-full" />}
              Save
            </button>
          </div>
        </div>
      </div>
    )}
    </>
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
