// DC1 Mission Control API — TypeScript Type Definitions
// Auto-generated from OpenAPI spec. Do not edit manually.

// ── Enums ──

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'offline' | 'error';
export type TaskStatus = 'backlog' | 'in-progress' | 'code-review' | 'blocked' | 'done';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type ConnectionType = 'api' | 'database' | 'gpu' | 'service';
export type ConnectionStatus = 'online' | 'offline' | 'idle' | 'degraded' | 'error';
export type JobStatus = 'pending' | 'matching' | 'matched' | 'executing' | 'checkpointing' | 'completed' | 'failed' | 'cancelled';
export type GpuHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline' | 'unknown';
export type MilestoneStatus = 'pending' | 'in-progress' | 'completed' | 'missed';
export type SecurityEventType = 'login' | 'access_denied' | 'rate_limit' | 'isolation_breach' | 'audit' | 'config_change';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ModelName = 'claude-haiku' | 'claude-sonnet' | 'claude-opus' | 'minimax-m2.5' | 'gpt-4o';
export type ProviderStatus = 'active' | 'inactive' | 'suspended';
export type GpuStatus = 'available' | 'in-use' | 'maintenance' | 'offline';
export type RecoveryStrategy = 'retry' | 'failover' | 'abort';

// ── Core Resources ──

export interface Agent {
  id: string;
  name: string;
  role: string;
  tech_stack: string;
  status: AgentStatus;
  current_task_id: string | null;
  next_task_id: string | null;
  blocker_description: string | null;
  last_checkin: string | null;
  model_preference: ModelName;
  daily_token_budget: number;
  tokens_used_today: number;
  total_learnings: number | null;
  total_ideas: number | null;
  quality_score: number;
  created_at: string;
  current_task: string | null;
  message: string | null;
  current_task_title: string | null;
  active_tasks: string;
  last_heartbeat: string | null;
}

export interface AgentDetail extends Agent {
  task_history: Task[];
  token_usage: TokenUsage[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to_agent_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  depends_on_task_id: string | null;
  estimated_tokens: number | null;
  model_preference: string | null;
  progress_percent: number;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  assigned_to_name: string | null;
  depends_on_title: string | null;
}

export interface Heartbeat {
  id: string;
  agent_id: string;
  status: AgentStatus;
  message: string | null;
  tokens_used: number | null;
  model_used: string | null;
  blockers: string | null;
  created_at: string;
}

export interface TokenUsage {
  id: string;
  agent_id: string;
  task_id: string | null;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
}

export interface AgentLearning {
  id: string;
  agent_id: string;
  learning: string;
  category: string | null;
  created_at: string;
}

export interface AgentIdea {
  id: string;
  agent_id: string;
  idea: string;
  status: string;
  created_at: string;
}

export interface FeedbackEntry {
  id: string;
  agent_id: string;
  from_agent_id: string | null;
  feedback: string;
  rating: number | null;
  created_at: string;
}

export interface PerformanceMetrics {
  tasks_completed: number;
  average_quality: number;
  total_tokens_used: number;
  uptime_percent: number;
}

export interface AgentIntelligence {
  agent: Agent;
  current_task: Task | null;
  task_history: Task[];
  learnings: AgentLearning[];
  ideas: AgentIdea[];
  feedback: FeedbackEntry[];
  performance_metrics: PerformanceMetrics;
}

export interface Job {
  id: string;
  renter_id: string;
  gpu_type: string;
  job_code_url: string;
  estimated_hours: number;
  max_budget: number;
  status: JobStatus;
  provider_id: string | null;
  gpu_id: string | null;
  docker_image: string | null;
  entrypoint: string | null;
  utilization: number | null;
  temperature: number | null;
  cost_so_far: number | null;
  progress_percent: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface GpuHealth {
  id: string;
  gpu_id: string;
  status: GpuHealthStatus;
  temperature: number | null;
  utilization: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
  power_watts: number | null;
  checked_at: string;
}

export interface ConnectionHistoryEntry {
  id: string;
  connection_id: string;
  status: ConnectionStatus;
  latency_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

export interface Connection {
  id: string;
  connection_name: string;
  connection_type: ConnectionType;
  status: ConnectionStatus;
  last_check: string | null;
  latency_ms: number | null;
  error_message: string | null;
  uptime_percent: string;
}

export interface SecurityAudit {
  id: string;
  event_type: SecurityEventType;
  agent_id: string | null;
  resource: string;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  severity: Severity;
  created_at: string;
}

export interface SecurityViolation {
  id: string;
  violation_type: string;
  job_id: string | null;
  gpu_id: string | null;
  description: string;
  severity: Severity;
  resolved: boolean;
  created_at: string;
}

export interface IsolationResult {
  job_id: string;
  checks: IsolationCheck[];
  overall_pass: boolean;
  checked_at: string;
}

export interface IsolationCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface Provider {
  id: string;
  name: string;
  location: string | null;
  status: ProviderStatus;
  total_gpus: number;
  available_gpus: number;
  rating: number | null;
  created_at: string;
}

export interface Gpu {
  id: string;
  provider_id: string;
  model: string;
  vram_gb: number;
  status: GpuStatus;
  hourly_rate: number;
  reliability_score: number | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  name: string;
  description: string | null;
  target_date: string;
  status: MilestoneStatus;
  created_at: string;
}

export interface TaskCounts {
  backlog: number;
  'in-progress': number;
  'code-review': number;
  blocked: number;
  done: number;
  total: number;
}

export interface DashboardAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  last_checkin: string | null;
  tokens_used_today: number;
  daily_token_budget: number;
}

export interface DashboardStats {
  agents: DashboardAgent[];
  tasks: TaskCounts;
  active_blockers: number;
  recent_errors: number;
  milestones: Milestone[];
  connections: Connection[];
  timestamp: string;
}

export interface TaskHistoryEntry {
  id: string;
  task_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface FailoverTestResult {
  success: boolean;
  failover_time_ms: number;
  backup_gpu_id: string;
  message: string;
}

export interface InterruptRecoveryResult {
  success: boolean;
  recovered_job_id: string;
  new_gpu_id: string | null;
  message: string;
}

export interface ConnectionTestResult {
  connection_id: string;
  status: ConnectionStatus;
  latency_ms: number;
  tested_at: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ── Request Bodies ──

export interface CreateAgentRequest {
  name: string;
  role: string;
  tech_stack?: string;
  model_preference?: ModelName;
  daily_token_budget?: number;
}

export interface UpdateAgentRequest {
  status?: AgentStatus;
  current_task?: string;
  message?: string;
  current_task_id?: string;
}

export interface UpdateAgentStatusRequest {
  status: AgentStatus;
}

export interface CreateHeartbeatRequest {
  agent_id: string;
  status: AgentStatus;
  message?: string;
  tokens_used?: number;
  model_used?: string;
  blockers?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  assigned_to_agent_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string;
  depends_on_task_id?: string;
  estimated_tokens?: number;
  model_preference?: string;
}

export interface UpdateTaskRequest {
  status?: TaskStatus;
  progress_percent?: number;
  notes?: string;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigned_to_agent_id?: string;
}

export interface CompleteTaskRequest {
  notes?: string;
  actual_tokens_used?: number;
  time_spent_hours?: number;
}

export interface LogTokenUsageRequest {
  task_id?: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd?: number;
}

export interface SubmitJobRequest {
  renter_id: string;
  gpu_type: string;
  job_code_url: string;
  estimated_hours?: number;
  max_budget?: number;
}

export interface MatchJobRequest {
  provider_id: string;
  gpu_id: string;
}

export interface ExecuteJobRequest {
  provider_id: string;
  gpu_id: string;
  docker_image: string;
  entrypoint: string;
}

export interface GpuHealthCheckRequest {
  status?: GpuHealthStatus;
  temperature?: number;
  utilization?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  power_watts?: number;
}

export interface FailoverTestRequest {
  backup_gpu_id?: string;
}

export interface InterruptRecoveryRequest {
  job_id?: string;
  checkpoint_id?: string;
  recovery_strategy?: RecoveryStrategy;
}

export interface CreateSecurityAuditRequest {
  event_type: SecurityEventType;
  agent_id?: string;
  resource: string;
  action: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  severity?: Severity;
}

export interface VerifyIsolationRequest {
  job_id: string;
}
