import { HttpClient } from '../http';
import { Job, SubmitJobParams, WaitOptions } from '../types';
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
   */
  async list(limit = 20): Promise<Job[]> {
    const data = await this.http.get<Record<string, unknown> | unknown[]>('/api/jobs', {
      limit: String(limit),
    });
    const raw = Array.isArray(data) ? data : ((data as Record<string, unknown>).jobs as unknown[]) ?? [];
    return (raw as Record<string, unknown>[]).map(parseJob);
  }
}
