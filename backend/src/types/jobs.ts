/**
 * DC1 Gate 0 — Job Execution Type Definitions
 * VOLT-DOCKER Sub-agent
 */

// ── Docker Container Manager Types ──

export interface JobContainerConfig {
  jobId: string;
  renterId: string;
  dockerImage: string;
  /** Path on host to job code directory */
  jobCodePath: string;
  /** GPU device IDs to assign (e.g. ["0","1"]) */
  gpuDeviceIds: string[];
  /** Max hours before auto-kill */
  maxHours: number;
  /** Memory limit in bytes (default 20GB) */
  memoryLimit: number;
  /** CPU core limit (default 8) */
  cpuLimit: number;
  /** Extra environment variables */
  envVars: Record<string, string>;
}

export interface ContainerResult {
  containerId: string;
  jobId: string;
  startTime: string;
  dockerImage: string;
  gpuDeviceIds: string[];
  status: 'running' | 'failed';
}

export interface ContainerMetrics {
  containerId: string;
  timestamp: string;
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  gpuMetrics: GpuMetric[];
  status: 'running' | 'exited' | 'unknown';
}

export interface GpuMetric {
  gpuId: string;
  utilizationPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  temperatureCelsius: number;
}

// ── Job Submission Pipeline Types ──

export interface JobRequest {
  renterId: string;
  dockerImage: string;
  jobCodePath: string;
  requiredVramGb: number;
  estimatedHours: number;
  maxBudgetUsd: number;
  gpuCount: number;
  metadata: Record<string, string>;
}

export interface ProviderGpu {
  id: string;
  providerId: string;
  gpuModel: string;
  vramGb: number;
  ratePerHour: number;
  reliability: number;
  status: 'available' | 'in-use' | 'maintenance';
}

export interface Job {
  id: string;
  renterId: string;
  containerId: string;
  matchedGpu: ProviderGpu;
  dockerImage: string;
  estimatedCostUsd: number;
  maxBudgetUsd: number;
  ratePerHour: number;
  startTime: string;
  status: JobStatusEnum;
}

export type JobStatusEnum =
  | 'pending'
  | 'matching'
  | 'launching'
  | 'running'
  | 'completed'
  | 'failed'
  | 'over-budget'
  | 'cancelled';

export interface JobStatus {
  jobId: string;
  status: JobStatusEnum;
  progressPercent: number;
  gpuMetrics: ContainerMetrics | null;
  costSoFarUsd: number;
  elapsedMinutes: number;
  budgetRemainingUsd: number;
}

export interface JobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'over-budget';
  totalCostUsd: number;
  totalMinutes: number;
  finalMetrics: ContainerMetrics | null;
  gpuWiped: boolean;
  payoutTriggered: boolean;
}

export interface RenterBalance {
  renterId: string;
  balanceUsd: number;
}

// ── Audit log payload ──

export interface AuditPayload {
  agent: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  timestamp: string;
}
