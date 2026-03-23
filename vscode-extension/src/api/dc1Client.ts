import * as https from 'https';
import * as http from 'http';
import * as vscode from 'vscode';
import { IncomingMessage } from 'http';

export class DC1ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'DC1ApiError';
  }
}

export function isAuthError(err: unknown): boolean {
  if (err instanceof DC1ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
    return true;
  }
  if (!(err instanceof Error)) {
    return false;
  }
  return /(?:^|\b)(401|403|unauthori[sz]ed|forbidden|invalid api key|api key is required|session expired)(?:\b|$)/i.test(err.message);
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof DC1ApiError) {
    return err.statusCode !== undefined && [408, 425, 429, 500, 502, 503, 504].includes(err.statusCode);
  }
  if (!(err instanceof Error)) {
    return false;
  }
  return /timed out|timeout|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(err.message);
}

export interface Provider {
  id: string;
  name: string;
  gpu_model: string;
  vram_gb: number | null;
  vram_mib: number | null;
  gpu_count: number;
  driver_version: string | null;
  compute_capability: string | null;
  cuda_version: string | null;
  status: string;
  is_live: boolean;
  location: string | null;
  reliability_score: number | null;
  cached_models: string[];
}

export interface Job {
  id: string;
  job_id: string;
  job_type: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  submitted_at: string;
  started_at?: string;
  completed_at?: string;
  actual_cost_halala?: number;
  cost_halala?: number;
  progress_phase?: string;
  provider_name?: string;
}

export interface RenterInfo {
  id: string;
  name: string;
  email: string;
  balance_halala: number;
  total_jobs: number;
  api_key: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  email: string;
  gpu_model: string;
  vram_gb: number | null;
  gpu_count: number;
  status: string;
  is_live: boolean;
  total_jobs: number;
  total_earnings_halala: number;
  today_earnings_halala: number;
  last_heartbeat: string | null;
  driver_version: string | null;
  cuda_version: string | null;
}

export interface JobOutput {
  status: string;
  result?: string;
  result_type?: string;
  message?: string;
  progress_phase?: string;
}

export interface ContainerSpec {
  image_type: string;
  vram_required_mb: number;
  gpu_count: 1 | 2 | 4;
  compute_type?: string;
}

export interface SubmitJobRequest {
  provider_id: string;
  job_type: string;
  duration_minutes: number;
  container_spec: ContainerSpec;
  gpu_requirements?: { min_vram_gb?: number };
  params?: Record<string, unknown>;
  priority?: 1 | 2 | 3;
}

export const JOB_TYPES = [
  { value: 'llm_inference', label: 'LLM Inference' },
  { value: 'image_generation', label: 'Image Generation' },
  { value: 'vllm_serve', label: 'vLLM Serve (endpoint)' },
  { value: 'training', label: 'Training' },
  { value: 'rendering', label: 'Rendering' },
  { value: 'benchmark', label: 'Benchmark' },
  { value: 'custom_container', label: 'Custom Container' },
];

export interface VllmModel {
  model_id: string;
  display_name: string;
  family: string | null;
  vram_gb: number;
  quantization: string | null;
  context_window: number;
  use_cases: string[];
  min_gpu_vram_gb: number;
  providers_online: number;
  avg_price_sar_per_min: number;
  status: 'available' | 'no_providers';
}

export interface VllmCompleteRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
}

export interface DockerTemplate {
  id: string;
  name: string;
  description: string;
  image: string;
  job_type: string;
  min_vram_gb: number;
  estimated_price_sar_per_hour: number;
  tags: string[];
  sort_order?: number;
  icon?: string;
  difficulty?: string;
  tier?: string;
  params?: Record<string, unknown>;
}

export interface Model {
  model_id: string;
  display_name: string;
  family: string | null;
  vram_gb: number;
  is_arabic: boolean;
  providers_online: number;
  avg_price_sar_per_min: number;
  status: 'available' | 'no_providers';
}

export interface VllmCompleteResponse {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  cost_halala: number;
}

export class DC1Client {
  private get apiBase(): string {
    return vscode.workspace.getConfiguration('dc1').get('apiBase', 'https://api.dcp.sa');
  }

  private request<T>(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: unknown,
    timeoutMs = 15_000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.apiBase + path);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DCP-VSCode-Extension/0.4.0',
          ...headers,
        },
        // Allow self-signed certs on the dev VPS
        ...(isHttps ? { rejectUnauthorized: false } : {}),
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const body = data.trim();
          const statusCode = res.statusCode ?? 0;

          if (!body) {
            if (statusCode >= 400) {
              reject(new Error(`HTTP ${statusCode}`));
              return;
            }
            resolve({} as T);
            return;
          }

          try {
            const parsed = JSON.parse(body);
            if (statusCode >= 400) {
              reject(new DC1ApiError(parsed.error || parsed.message || `HTTP ${statusCode}`, statusCode, body));
              return;
            }
            resolve(parsed as T);
          } catch {
            if (statusCode >= 400) {
              reject(new DC1ApiError(`HTTP ${statusCode}: ${body.slice(0, 200)}`, statusCode, body));
              return;
            }
            reject(new Error(`Failed to parse response: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err: NodeJS.ErrnoException) => {
        const code = err.code ? `${err.code}: ` : '';
        reject(new Error(`${code}${err.message}`));
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Request timed out after ${timeoutMs / 1000}s`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /** GET /api/renters/available-providers — no auth required */
  async getAvailableProviders(): Promise<{ providers: Provider[]; total: number }> {
    return this.request('GET', '/api/renters/available-providers');
  }

  /** GET /api/providers/me?key= */
  async getProviderInfo(apiKey: string): Promise<ProviderInfo> {
    const data = await this.request<any>('GET', `/api/providers/me?key=${encodeURIComponent(apiKey)}`);
    const provider = (data && typeof data === 'object' && data.provider && typeof data.provider === 'object')
      ? data.provider
      : data;

    const vramGbFromMib = typeof provider?.gpu_vram_mib === 'number' && provider.gpu_vram_mib > 0
      ? Math.round(provider.gpu_vram_mib / 1024)
      : null;
    const vramGbFromMb = typeof provider?.vram_mb === 'number' && provider.vram_mb > 0
      ? Math.round(provider.vram_mb / 1024)
      : null;

    return {
      id: String(provider?.id ?? ''),
      name: String(provider?.name ?? 'Provider'),
      email: String(provider?.email ?? ''),
      gpu_model: String(provider?.gpu_model ?? 'Unknown GPU'),
      vram_gb: vramGbFromMib ?? vramGbFromMb,
      gpu_count: Number(provider?.gpu_count_reported ?? provider?.gpu_count ?? 1),
      status: String(provider?.status ?? 'offline'),
      is_live: Boolean(provider?.is_live ?? String(provider?.status ?? '').toLowerCase() === 'online'),
      total_jobs: Number(provider?.total_jobs ?? 0),
      total_earnings_halala: Number(provider?.total_earnings_halala ?? 0),
      today_earnings_halala: Number(provider?.today_earnings_halala ?? 0),
      last_heartbeat: provider?.last_heartbeat ? String(provider.last_heartbeat) : null,
      driver_version: provider?.gpu_driver ?? provider?.driver_version ?? null,
      cuda_version: provider?.gpu_cuda_version ?? provider?.cuda_version ?? null,
    };
  }

  /** GET /api/renters/me?key= */
  async getRenterInfo(apiKey: string): Promise<RenterInfo> {
    const data = await this.request<any>('GET', `/api/renters/me?key=${encodeURIComponent(apiKey)}`);
    const renter = (data && typeof data === 'object' && data.renter && typeof data.renter === 'object')
      ? data.renter
      : data;

    return {
      id: String(renter?.id ?? ''),
      name: String(renter?.name ?? 'Renter'),
      email: String(renter?.email ?? ''),
      balance_halala: Number(renter?.balance_halala ?? 0),
      total_jobs: Number(renter?.total_jobs ?? 0),
      api_key: String(renter?.api_key ?? apiKey),
    };
  }

  /** GET /api/renters/me?key= — returns jobs array too */
  async getMyJobs(apiKey: string): Promise<Job[]> {
    const data = await this.request<any>('GET', `/api/renters/me?key=${encodeURIComponent(apiKey)}`);
    const jobs = Array.isArray(data?.jobs)
      ? data.jobs
      : (Array.isArray(data?.recent_jobs) ? data.recent_jobs : []);
    return jobs as Job[];
  }

  /** POST /api/jobs/submit */
  async submitJob(apiKey: string, payload: SubmitJobRequest): Promise<{ job_id: string; status: string; cost_halala: number }> {
    return this.request('POST', '/api/jobs/submit', { 'x-renter-key': apiKey }, payload);
  }

  /** GET /api/jobs/:id/output */
  async getJobOutput(apiKey: string, jobId: string): Promise<JobOutput> {
    try {
      return await this.request('GET', `/api/jobs/${jobId}/output`, { 'x-renter-key': apiKey });
    } catch (err) {
      // Backend reports failed/cancelled jobs as HTTP 410 with structured JSON.
      if (err instanceof DC1ApiError && err.statusCode === 410 && err.responseBody) {
        try {
          const parsed = JSON.parse(err.responseBody) as { status?: string; error?: string; progress_phase?: string };
          return {
            status: parsed.status || 'failed',
            message: parsed.error || 'Job is no longer available',
            progress_phase: parsed.progress_phase,
          };
        } catch {
          return {
            status: 'failed',
            message: err.message,
          };
        }
      }
      throw err;
    }
  }

  /** GET /api/jobs/:id/logs */
  async getJobLogs(apiKey: string, jobId: string): Promise<{ logs: string[] }> {
    return this.request('GET', `/api/jobs/${jobId}/logs`, { 'x-renter-key': apiKey });
  }

  /** POST /api/jobs/:id/cancel */
  async cancelJob(apiKey: string, jobId: string): Promise<{ success: boolean }> {
    return this.request('POST', `/api/jobs/${jobId}/cancel`, { 'x-renter-key': apiKey });
  }

  /**
   * Stream job logs via SSE (GET /api/jobs/:id/logs/stream).
   * Returns a dispose() function to abort the stream.
   * Calls onLine for each SSE data line, onEnd when stream closes, onError on failure.
   */
  streamJobLogs(
    apiKey: string,
    jobId: string,
    onLine: (line: string) => void,
    onEnd: () => void,
    onError: (err: Error) => void
  ): () => void {
    const url = new URL(this.apiBase + `/api/jobs/${jobId}/logs/stream`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'x-renter-key': apiKey,
        'User-Agent': 'DCP-VSCode-Extension/0.4.0',
      },
      ...(isHttps ? { rejectUnauthorized: false } : {}),
    };

    let req: http.ClientRequest | null = null;
    let ws: any | null = null;
    let aborted = false;
    let hasReceivedAnyData = false;
    let activeMode: 'idle' | 'sse' | 'ws' = 'idle';
    let connectAttempt = 0;
    const maxConnectAttempts = 3;
    let fallbackTried = false;

    const dispose = () => {
      aborted = true;
      ws?.close(1000, 'closed by client');
      req?.destroy();
    };

    const maybeRetryOrFail = (err: Error, hasDataForThisAttempt: boolean) => {
      if (aborted) {
        return;
      }

      if (!hasDataForThisAttempt && connectAttempt < maxConnectAttempts && isRetryableError(err)) {
        const backoffMs = connectAttempt * 1000;
        setTimeout(() => startSseStream(), backoffMs);
        return;
      }

      onError(err);
    };

    const parseSseChunk = (chunk: string) => {
      let buffer = '';
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') {
            continue;
          }
          try {
            const payload = JSON.parse(data) as { type?: string; line?: string };
            if (payload.type === 'end') {
              onEnd();
              continue;
            }
            if (payload.type === 'log' && typeof payload.line === 'string') {
              onLine(payload.line);
            }
          } catch {
            onLine(data);
          }
        }
      }

      return buffer;
    };

    const startSseStream = () => {
      activeMode = 'sse';
      if (aborted) {
        return;
      }

      connectAttempt += 1;

      let hasDataForThisAttempt = false;
      let buffer = '';

      try {
        req = lib.request(options, (res: IncomingMessage) => {
          if (res.statusCode && res.statusCode >= 400) {
            let errorBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => (errorBody += chunk));
            res.on('end', () => {
              let message = `SSE stream returned HTTP ${res.statusCode}`;
              const trimmed = errorBody.trim();
              if (trimmed) {
                try {
                  const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
                  message = parsed.error || parsed.message || message;
                } catch {
                  message = `${message}: ${trimmed.slice(0, 200)}`;
                }
              }
              maybeRetryOrFail(new DC1ApiError(message, res.statusCode, trimmed), false);
            });
            return;
          }

          connectAttempt = maxConnectAttempts;
          res.setEncoding('utf8');

          res.on('data', (chunk: string) => {
            if (aborted) { return; }
            const before = buffer;
            buffer = `${before}${chunk}`;
            const newBuffer = parseSseChunk(buffer);
            if (newBuffer !== buffer) {
              hasDataForThisAttempt = true;
              hasReceivedAnyData = true;
              buffer = newBuffer;
            }
          });

          res.on('end', () => {
            if (!aborted) {
              onEnd();
            }
          });

          res.on('error', (err: Error) => {
            maybeRetryOrFail(err, hasDataForThisAttempt);
          });
        });

        req.on('error', (err: NodeJS.ErrnoException) => {
          const code = err.code ? `${err.code}: ` : '';
          maybeRetryOrFail(new Error(`${code}${err.message}`), hasDataForThisAttempt);
        });

        req.setTimeout(300_000, () => {
          req?.destroy();
          if (!hasReceivedAnyData) {
            maybeRetryOrFail(new Error('SSE connection timed out before receiving log data'), hasDataForThisAttempt);
            return;
          }
          if (!aborted) { onEnd(); }
        });

        req.end();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        maybeRetryOrFail(error, hasDataForThisAttempt);
      }
    };

    const startWebSocketStream = () => {
      const wsConstructor: any = (globalThis as unknown as { WebSocket?: new (url: string, protocols?: string | string[]) => any }).WebSocket;
      if (typeof wsConstructor !== 'function') {
        startSseStream();
        return;
      }

      const wsUrl = new URL(url.toString());
      wsUrl.protocol = isHttps ? 'wss:' : 'ws:';
      wsUrl.searchParams.set('key', apiKey);

      const wsConnectTimeoutMs = 1200;
      let wsOpened = false;
      let wsBuffer = '';
      let wsConnectTimeout: NodeJS.Timeout | null = null;

      try {
        ws = new wsConstructor(wsUrl.toString());
      } catch (err) {
        if (!aborted) {
          startSseStream();
        }
        return;
      }

      wsConnectTimeout = setTimeout(() => {
        if (!wsOpened && !aborted) {
          ws?.close(4000, 'websocket connect timeout');
          if (!fallbackTried) {
            fallbackTried = true;
            startSseStream();
          }
        }
      }, wsConnectTimeoutMs);

      ws.onopen = () => {
        wsOpened = true;
        activeMode = 'ws';
        if (wsConnectTimeout) {
          clearTimeout(wsConnectTimeout);
          wsConnectTimeout = null;
        }
      };

      ws.onmessage = (event: any) => {
        if (aborted || !event) {
          return;
        }

        const payload = typeof event.data === 'string' ? event.data : String(event.data || '');
        wsBuffer += payload;

        if (!wsBuffer.includes('\n')) {
          return;
        }

        const lines = wsBuffer.split('\n');
        wsBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data) as { type?: string; line?: string };
              if (parsed.type === 'log' && typeof parsed.line === 'string') {
                hasReceivedAnyData = true;
                onLine(parsed.line);
              }
              if (parsed.type === 'end') {
                onEnd();
              }
            } catch {
              onLine(data);
            }
            continue;
          }

          if (trimmed === '[DONE]') {
            onEnd();
            continue;
          }

          hasReceivedAnyData = true;
          onLine(trimmed);
        }
      };

      ws.onerror = () => {
        if (aborted) {
          return;
        }

        if (!wsOpened && !fallbackTried) {
          fallbackTried = true;
          startSseStream();
          return;
        }

        onError(new Error('WebSocket log stream error'));
      };

      ws.onclose = () => {
        if (wsConnectTimeout) {
          clearTimeout(wsConnectTimeout);
        }
        if (aborted) {
          return;
        }

        if (!wsOpened && !fallbackTried) {
          fallbackTried = true;
          startSseStream();
          return;
        }

        if (hasReceivedAnyData || !fallbackTried) {
          onEnd();
        }
      };
    };

    try {
      startWebSocketStream();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }

    return dispose;
  }

  /** POST /api/renters/topup */
  async topUp(apiKey: string, amountSar: number): Promise<{ success: boolean; new_balance_halala: number }> {
    return this.request('POST', '/api/renters/topup', { 'x-renter-key': apiKey }, { amount_sar: amountSar });
  }

  /** GET /api/jobs/:id — single job status */
  async getJob(apiKey: string, jobId: string): Promise<Job> {
    return this.request('GET', `/api/jobs/${jobId}`, { 'x-renter-key': apiKey });
  }

  /** GET /api/containers/registry — public, no auth required */
  async getContainerRegistry(): Promise<{ images: string[]; total: number }> {
    return this.request('GET', '/api/containers/registry');
  }

  /** GET /api/vllm/models — list available vLLM models from model registry */
  async getVllmModels(): Promise<{ object: string; data: VllmModel[] }> {
    return this.request('GET', '/api/vllm/models');
  }

  /**
   * POST /api/vllm/complete — synchronous LLM inference.
   * Long-running (waits for job completion on server, up to 300s).
   * Uses 120s client-side timeout.
   */
  async vllmComplete(apiKey: string, payload: VllmCompleteRequest): Promise<VllmCompleteResponse> {
    return this.request(
      'POST',
      `/api/vllm/complete?key=${encodeURIComponent(apiKey)}`,
      {},
      payload,
      120_000
    );
  }

  /** GET /api/templates — list all docker templates */
  async getDockerTemplates(tag?: string): Promise<{ templates: DockerTemplate[]; count: number }> {
    const url = tag
      ? `/api/templates?tag=${encodeURIComponent(tag)}`
      : '/api/templates';
    return this.request('GET', url);
  }

  /** GET /api/models — list all available models */
  async getModels(): Promise<{ models: Model[]; count: number }> {
    const data = await this.request<any>('GET', '/api/models');
    const models = Array.isArray(data) ? data : (data.models || []);

    // Compute is_arabic flag for each model
    return {
      models: models.map((m: any) => ({
        model_id: m.model_id,
        display_name: m.display_name,
        family: m.family || null,
        vram_gb: m.vram_gb || m.min_gpu_vram_gb || 0,
        is_arabic: this.isArabicModel(m.model_id, m.family),
        providers_online: m.providers_online || 0,
        avg_price_sar_per_min: m.avg_price_sar_per_min || 0,
        status: m.status || 'no_providers',
      })),
      count: models.length,
    };
  }

  private isArabicModel(modelId: string, family?: string | null): boolean {
    const arabicPatterns = [
      'allam', 'jais', 'falcon-h1', 'falcon_h1', 'arabic',
      'bge-m3', 'bge_m3', 'reranker-v2-m3', 'reranker_v2_m3',
    ];
    const haystack = `${modelId || ''} ${family || ''}`.toLowerCase();
    return arabicPatterns.some(pattern => haystack.includes(pattern));
  }
}

export const dc1 = new DC1Client();
