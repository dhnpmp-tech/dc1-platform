import { HttpClient } from '../http';
import { Job, SubmitJobParams, WaitOptions, JobLog } from '../types';
import { JobTimeoutError } from '../errors';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

function parseJob(data: Record<string, unknown>): Job {
  const costHalala = (data.cost_halala as number) ?? 0;
  const rawResult = data.result as Record<string, unknown> | string | null;
  let result: Record<string, unknown> | null = null;
  if (rawResult && typeof rawResult === 'object') {
    result = rawResult;
  } else if (typeof rawResult === 'string') {
    result = { output: rawResult };
  }

  return {
    id: String(data.job_id ?? data.id ?? ''),
    status: (data.status as Job['status']) ?? 'unknown',
    jobType: (data.job_type as Job['jobType']) ?? '',
    providerId: (data.provider_id as number) ?? 0,
    durationMinutes: (data.duration_minutes as number) ?? 0,
    costHalala,
    costSar: costHalala / 100,
    submittedAt: (data.submitted_at as string) ?? '',
    startedAt: (data.started_at as string) ?? null,
    completedAt: (data.completed_at as string) ?? null,
    providerName: (data.provider_name as string) ?? null,
    isDone: TERMINAL.has((data.status as string) ?? ''),
    result,
    resultType: (data.result_type as Job['resultType']) ?? null,
    error: (data.error as string) ?? null,
    executionTimeSec: (data.execution_time_sec as number) ?? null,
  };
}

export class JobsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Submit a compute job.
   *
   * @param options - Job configuration
   * @returns Job with initial status
   */
  async submit(options: SubmitJobParams): Promise<Job> {
    const body = {
      provider_id: options.providerId,
      job_type: options.jobType,
      duration_minutes: options.durationMinutes,
      priority: options.priority ?? 2,
      params: options.params,
    };
    const data = await this.http.post<Record<string, unknown>>('/api/jobs/submit', body);
    const jobId = String(data.job_id ?? data.id ?? '');
    return this.get(jobId);
  }

  /**
   * Fetch current status and result of a job.
   */
  async get(jobId: string): Promise<Job> {
    const data = await this.http.get<Record<string, unknown>>(`/api/jobs/${jobId}/output`);
    return parseJob(data);
  }

  /**
   * Wait (async poll) until job reaches a terminal state.
   *
   * @throws {JobTimeoutError} when timeoutMs exceeded
   */
  async wait(jobId: string, options: WaitOptions = {}): Promise<Job> {
    const timeoutMs = options.timeoutMs ?? 300_000;
    const pollIntervalMs = options.pollIntervalMs ?? 5_000;
    const deadline = Date.now() + timeoutMs;

    while (true) {
      const job = await this.get(jobId);
      if (job.isDone) return job;

      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new JobTimeoutError(jobId, timeoutMs);

      await new Promise((r) => setTimeout(r, Math.min(pollIntervalMs, remaining)));
    }
  }

  /**
   * List recent jobs for the authenticated renter.
   * Uses GET /api/jobs/history which returns the renter's job history via x-renter-key header.
   */
  async list(limit = 20): Promise<Job[]> {
    const data = await this.http.get<Record<string, unknown>>('/api/jobs/history', {
      limit: String(limit),
    });
    const raw = (data.jobs as unknown[]) ?? [];
    return (raw as Record<string, unknown>[]).map(parseJob);
  }

  /**
   * Cancel a queued or running job. Refunds the estimated cost to the renter's balance.
   *
   * @param jobId - The job ID (e.g. `job-1234-abcdef`)
   */
  async cancel(jobId: string): Promise<{ success: boolean; jobId: string }> {
    const data = await this.http.post<Record<string, unknown>>(`/api/jobs/${jobId}/cancel`);
    return {
      success: (data.success as boolean) ?? false,
      jobId: String((data.job as Record<string, unknown>)?.job_id ?? jobId),
    };
  }

  /**
   * Fetch execution log lines for a job.
   *
   * @param jobId - The job ID
   * @param options.since - Only return lines after this line number (for incremental tailing)
   * @param options.limit - Max lines to return (default 200, max 1000)
   */
  async getLogs(jobId: string, options: { since?: number; limit?: number } = {}): Promise<JobLog[]> {
    const params: Record<string, string> = {};
    if (options.since != null) params.since = String(options.since);
    if (options.limit != null) params.limit = String(options.limit);

    const data = await this.http.get<Record<string, unknown>>(
      `/api/jobs/${jobId}/logs`,
      params,
    );
    const raw = (data.logs as Record<string, unknown>[]) ?? [];
    return raw.map((l) => ({
      lineNo: (l.line_no as number) ?? 0,
      level: (l.level as JobLog['level']) ?? 'info',
      message: (l.message as string) ?? '',
      loggedAt: (l.logged_at as string) ?? '',
    }));
  }
}
