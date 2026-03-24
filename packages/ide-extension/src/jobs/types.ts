/**
 * Job-related type definitions for Phase 2
 */

export interface JobSubmission {
  provider_id: string;
  model_id: string;
  script_content: string;
  parameters?: Record<string, any>;
}

export interface JobResult {
  job_id: string;
  status: JobStatus;
  estimated_cost_sar: number;
  created_at: string;
  eta_seconds?: number;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percent: number;
  cost_incurred_sar: number;
  eta_seconds?: number;
  error_message?: string;
}

export interface JobHistory {
  job_id: string;
  model: string;
  provider: string;
  cost_sar: number;
  status: 'completed' | 'failed' | 'cancelled';
  created_at: string;
  completed_at: string;
  duration_seconds: number;
}

export interface CostEstimate {
  model_cost_sar: number;
  provider_cost_sar: number;
  total_estimated_sar: number;
  estimated_duration_seconds: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  model_id: string;
  icon?: string;
  vram_required_mb: number;
  cost_per_hour_sar: number;
  tags: string[]; // ['arabic', 'embedding', 'fast', etc.]
}
