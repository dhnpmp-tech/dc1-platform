import * as https from 'https';
import * as http from 'http';
import * as vscode from 'vscode';
import { IncomingMessage } from 'http';

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

export class DC1Client {
  private get apiBase(): string {
    return vscode.workspace.getConfiguration('dc1').get('apiBase', 'http://76.13.179.86:8083');
  }

  private request<T>(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: unknown
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
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(parsed.error || parsed.message || `HTTP ${res.statusCode}`));
            } else {
              resolve(parsed as T);
            }
          } catch {
            reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timed out after 15s'));
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
    return this.request('GET', `/api/providers/me?key=${encodeURIComponent(apiKey)}`);
  }

  /** GET /api/renters/me?key= */
  async getRenterInfo(apiKey: string): Promise<RenterInfo> {
    return this.request('GET', `/api/renters/me?key=${encodeURIComponent(apiKey)}`);
  }

  /** GET /api/renters/me?key= — returns jobs array too */
  async getMyJobs(apiKey: string): Promise<Job[]> {
    const data = await this.request<{ jobs: Job[] }>('GET', `/api/renters/me?key=${encodeURIComponent(apiKey)}`);
    return data.jobs || [];
  }

  /** POST /api/jobs/submit */
  async submitJob(apiKey: string, payload: SubmitJobRequest): Promise<{ job_id: string; status: string; cost_halala: number }> {
    return this.request('POST', '/api/jobs/submit', { 'x-renter-key': apiKey }, payload);
  }

  /** GET /api/jobs/:id/output */
  async getJobOutput(apiKey: string, jobId: string): Promise<JobOutput> {
    return this.request('GET', `/api/jobs/${jobId}/output`, { 'x-renter-key': apiKey });
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
    let aborted = false;

    const dispose = () => {
      aborted = true;
      req?.destroy();
    };

    try {
      req = lib.request(options, (res: IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 400) {
          onError(new Error(`SSE stream returned HTTP ${res.statusCode}`));
          return;
        }

        let buffer = '';
        res.setEncoding('utf8');

        res.on('data', (chunk: string) => {
          if (aborted) { return; }
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data && data !== '[DONE]') {
                onLine(data);
              }
            }
          }
        });

        res.on('end', () => {
          if (!aborted) { onEnd(); }
        });

        res.on('error', (err: Error) => {
          if (!aborted) { onError(err); }
        });
      });

      req.on('error', (err: Error) => {
        if (!aborted) { onError(err); }
      });

      req.setTimeout(300_000, () => {
        req?.destroy();
        if (!aborted) { onEnd(); }
      });

      req.end();
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
}

export const dc1 = new DC1Client();
