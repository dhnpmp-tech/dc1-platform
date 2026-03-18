/**
 * DC1 SDK type definitions.
 */

export type JobType =
  | 'llm_inference'
  | 'image_generation'
  | 'vllm_serve'
  | 'rendering'
  | 'training'
  | 'benchmark'
  | 'custom_container';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ProviderStatus = 'online' | 'offline' | 'paused';

/** Priority: 1=high, 2=normal, 3=low */
export type JobPriority = 1 | 2 | 3;

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  status: JobStatus;
  jobType: JobType;
  providerId: number;
  durationMinutes: number;
  /** Billed amount in halala (1 SAR = 100 halala) */
  costHalala: number;
  /** Billed amount in SAR */
  costSar: number;
  submittedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  providerName: string | null;
  /** `true` when status is completed, failed, or cancelled */
  isDone: boolean;
  /**
   * Parsed job output:
   * - text jobs: `{ output: string }`
   * - image jobs: `{ image_url: string }`
   * - vllm_serve jobs: `{ endpoint_url: string }`
   */
  result: Record<string, unknown> | null;
  resultType: 'text' | 'image' | 'endpoint' | null;
  /** Error message if status === 'failed' */
  error: string | null;
  executionTimeSec: number | null;
}

export interface SubmitJobParams {
  jobType: JobType;
  params: Record<string, unknown>;
  providerId: number;
  durationMinutes: number;
  priority?: JobPriority;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface Provider {
  id: number;
  name: string;
  gpuModel: string;
  vramMib: number;
  /** VRAM in GB (rounded to 1 decimal) */
  vramGb: number;
  status: ProviderStatus;
  reliabilityScore: number;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface Wallet {
  /** Balance in halala */
  balanceHalala: number;
  /** Balance in SAR */
  balanceSar: number;
  name: string;
  email: string;
  apiKey: string;
}

// ─── Client config ────────────────────────────────────────────────────────────

export interface DC1ClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** HTTP timeout in milliseconds (default 30000) */
  timeoutMs?: number;
}

export interface WaitOptions {
  /** Max wait in milliseconds (default 300000 = 5 min) */
  timeoutMs?: number;
  /** Poll interval in milliseconds (default 5000) */
  pollIntervalMs?: number;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export interface APIErrorResponse {
  error: string;
  [key: string]: unknown;
}
