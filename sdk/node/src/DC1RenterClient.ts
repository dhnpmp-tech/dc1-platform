import { HttpClient } from './http';
import { JobsResource } from './resources/jobs';
import { ProvidersResource } from './resources/providers';
import { WalletResource } from './resources/wallet';
import {
  DC1ClientConfig,
  Job,
  JobLog,
  JobType,
  JobPriority,
  Provider,
  Wallet,
  Balance,
  RegisterResult,
  PaymentHistory,
  PaymentHistoryItem,
  WaitOptions,
} from './types';
import { JobTimeoutError } from './errors';

export const DEFAULT_BASE_URL = 'https://api.dcp.sa';

export interface SubmitJobOptions {
  /** Provider to run the job on — get ID from listProviders() */
  providerId: number;
  jobType: JobType;
  /** Job-type-specific parameters (prompt, model, etc.) */
  params: Record<string, unknown>;
  /**
   * Estimated max duration in minutes.
   * Billing: llm_inference=15 h/min, image_generation=20 h/min, vllm_serve=20 h/min
   */
  durationMinutes: number;
  /** 1=high, 2=normal (default), 3=low */
  priority?: JobPriority;
}

export interface ListProvidersFilters {
  /** Minimum VRAM in GB */
  minVramGb?: number;
  /** GPU model substring filter (case-insensitive) */
  gpuModel?: string;
}

/**
 * DC1 Renter SDK — flat API for GPU compute jobs.
 *
 * @example
 * ```typescript
 * import { DC1RenterClient } from 'dc1-renter-sdk';
 *
 * const client = new DC1RenterClient({ apiKey: 'dc1-renter-abc123' });
 *
 * const providers = await client.listProviders();
 * const job = await client.submitJob({
 *   providerId: providers[0].id,
 *   jobType: 'llm_inference',
 *   params: { prompt: 'Explain transformers in one paragraph.' },
 *   durationMinutes: 2,
 * });
 * const result = await client.waitForJob(job.id);
 * console.log(result.result?.output);
 * ```
 */
export class DC1RenterClient {
  private readonly http: HttpClient;
  private readonly _jobs: JobsResource;
  private readonly _providers: ProvidersResource;
  private readonly _wallet: WalletResource;

  constructor(config: DC1ClientConfig) {
    if (!config.apiKey) throw new Error('apiKey is required');
    this.http = new HttpClient(
      config.apiKey,
      config.baseUrl ?? DEFAULT_BASE_URL,
      config.timeoutMs ?? 30_000,
    );
    this._jobs = new JobsResource(this.http);
    this._providers = new ProvidersResource(this.http);
    this._wallet = new WalletResource(this.http);
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  /**
   * Fetch the authenticated renter's profile and current balance.
   * GET /api/renters/me
   */
  async me(): Promise<Wallet> {
    return this._wallet.me();
  }

  /**
   * Register a new renter account. Returns the API key — save it, it won't be shown again.
   * POST /api/renters/register
   *
   * @example
   * ```typescript
   * // Note: registration does not require an existing API key
   * const client = new DC1RenterClient({ apiKey: '' });
   * const { apiKey } = await client.register('Ahmed Al-Rashid', 'ahmed@example.com');
   * ```
   */
  async register(name: string, email: string, organization?: string): Promise<RegisterResult> {
    const data = await this.http.post<Record<string, unknown>>('/api/renters/register', {
      name,
      email,
      organization,
    });
    return {
      renterId: (data.renter_id as number) ?? 0,
      apiKey: (data.api_key as string) ?? '',
      message: (data.message as string) ?? '',
    };
  }

  // ─── Providers ───────────────────────────────────────────────────────────────

  /**
   * List all online GPU providers available for job submission.
   * GET /api/renters/available-providers
   */
  async listProviders(filters?: ListProvidersFilters): Promise<Provider[]> {
    const providers = await this._providers.list();
    if (!filters) return providers;

    return providers.filter((p) => {
      if (filters.minVramGb != null && p.vramGb < filters.minVramGb) return false;
      if (filters.gpuModel && !p.gpuModel.toLowerCase().includes(filters.gpuModel.toLowerCase())) return false;
      return true;
    });
  }

  // ─── Jobs ────────────────────────────────────────────────────────────────────

  /**
   * Submit a compute job to a provider.
   * POST /api/jobs/submit (requires renter API key)
   *
   * @throws {APIError} 402 when balance is insufficient — call topUp() first
   */
  async submitJob(options: SubmitJobOptions): Promise<Job> {
    return this._jobs.submit({
      jobType: options.jobType,
      params: options.params,
      providerId: options.providerId,
      durationMinutes: options.durationMinutes,
      priority: options.priority,
    });
  }

  /**
   * Fetch the current status and result of a job.
   * GET /api/jobs/:id/output
   */
  async getJob(jobId: string): Promise<Job> {
    return this._jobs.get(jobId);
  }

  /**
   * Poll until the job reaches a terminal state (completed, failed, or cancelled).
   *
   * @throws {JobTimeoutError} when timeoutMs exceeded
   *
   * @example
   * ```typescript
   * const result = await client.waitForJob(job.id, {
   *   pollInterval: 3000,   // check every 3 seconds
   *   timeout: 300000,      // give up after 5 minutes
   *   onProgress: (status) => console.log('Status:', status),
   * });
   * ```
   */
  async waitForJob(
    jobId: string,
    opts: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (status: string) => void;
    } & WaitOptions = {},
  ): Promise<Job> {
    const timeoutMs = opts.timeout ?? opts.timeoutMs ?? 300_000;
    const pollIntervalMs = opts.pollInterval ?? opts.pollIntervalMs ?? 3_000;
    const deadline = Date.now() + timeoutMs;

    while (true) {
      const job = await this.getJob(jobId);
      if (opts.onProgress) opts.onProgress(job.status);
      if (job.isDone) return job;

      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new JobTimeoutError(jobId, timeoutMs);

      await new Promise((r) => setTimeout(r, Math.min(pollIntervalMs, remaining)));
    }
  }

  /**
   * Fetch execution log lines for a job (written by the daemon during execution).
   * GET /api/jobs/:id/logs
   *
   * @param since - Only return lines after this line number (for incremental tailing)
   */
  async getJobLogs(jobId: string, since?: number): Promise<JobLog[]> {
    return this._jobs.getLogs(jobId, { since });
  }

  /**
   * Cancel a queued or running job. The estimated cost is refunded to your balance.
   * POST /api/jobs/:id/cancel
   */
  async cancelJob(jobId: string): Promise<{ success: boolean; jobId: string }> {
    return this._jobs.cancel(jobId);
  }

  // ─── Billing ─────────────────────────────────────────────────────────────────

  /**
   * Fetch current wallet balance.
   * Returns balance in both halala (1 SAR = 100 halala) and SAR.
   * GET /api/renters/balance
   */
  async getBalance(): Promise<Balance> {
    return this._wallet.balance();
  }

  /**
   * Fetch job history with per-job billing details.
   * Maps to GET /api/jobs/history (renter's job ledger).
   */
  async getPaymentHistory(limit = 20): Promise<PaymentHistory> {
    const data = await this.http.get<Record<string, unknown>>('/api/jobs/history', {
      limit: String(limit),
    });
    const rawJobs = (data.jobs as Record<string, unknown>[]) ?? [];
    const items: PaymentHistoryItem[] = rawJobs.map((j) => ({
      jobId: (j.job_id as string) ?? '',
      jobType: (j.job_type as string) ?? '',
      status: (j.status as string) ?? '',
      submittedAt: (j.submitted_at as string) ?? '',
      completedAt: (j.completed_at as string) ?? null,
      costHalala: (j.actual_cost_halala as number) ?? (j.cost_halala as number) ?? 0,
      costSar: (j.cost_sar as string) ?? '0.00',
      providerName: (j.provider_name as string) ?? null,
      providerGpu: (j.provider_gpu as string) ?? null,
      refunded: (j.refunded as boolean) ?? false,
    }));

    return {
      balanceHalala: (data.balance_halala as number) ?? 0,
      balanceSar: (data.balance_sar as string) ?? '0.00',
      totalJobs: (data.total_jobs as number) ?? items.length,
      jobs: items,
    };
  }
}
