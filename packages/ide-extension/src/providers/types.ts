/**
 * Provider-related type definitions for Phase 2
 */

export interface ProviderStatus {
  id: string;
  name?: string;
  gpu_model: string;
  gpu_count: number;
  vram_mb: number;
  cost_per_hour_sar: number;
  jobs_completed: number;
  online: boolean;
  reputation_score?: number;
  reliability_score?: number;
  heartbeats_7d?: number;
  total_jobs?: number;
}

export interface ProviderMetrics {
  provider_id: string;
  reputation: number;
  uptime_percent: number;
  jobs_completed: number;
  jobs_failed: number;
  avg_completion_time_seconds: number;
  estimated_availability: string; // 'online', 'offline', 'paused'
}

export interface ProviderDetails extends ProviderStatus {
  metrics: ProviderMetrics;
  region?: string;
  owner?: string;
}
