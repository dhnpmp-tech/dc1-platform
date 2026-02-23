// DC1 Mission Control — Database (Supabase) Type Definitions
// One interface per table, snake_case matching PostgreSQL columns

// Re-use union types from api.ts for consistency
import type { AgentStatus, TaskStatus, TaskPriority, MilestoneStatus, Severity, ModelName } from './api';

export interface DbAgent {
  id: string;                       // uuid, PK
  name: string;                     // unique
  role: string;
  tech_stack: string | null;
  status: AgentStatus;
  current_task_id: string | null;   // FK → tasks.id
  next_task_id: string | null;      // FK → tasks.id
  blocker_description: string | null;
  last_checkin: string | null;      // timestamptz
  model_preference: string | null;
  daily_token_budget: number;
  tokens_used_today: number;
  total_learnings: number | null;
  total_ideas: number | null;
  quality_score: number;
  current_task: string | null;      // free-text override
  message: string | null;
  created_at: string;               // timestamptz
}

export interface DbTask {
  id: string;                       // uuid, PK
  title: string;
  description: string | null;
  assigned_to_agent_id: string | null; // FK → agents.id
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;          // timestamptz
  depends_on_task_id: string | null;// FK → tasks.id
  estimated_tokens: number | null;
  model_preference: string | null;
  progress_percent: number;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DbBlocker {
  id: string;
  task_id: string | null;          // FK → tasks.id
  agent_id: string | null;         // FK → agents.id
  description: string;
  severity: Severity;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface DbHeartbeat {
  id: string;
  agent_id: string;                // FK → agents.id
  status: AgentStatus;
  message: string | null;
  tokens_used: number | null;
  model_used: string | null;
  blockers: string | null;
  created_at: string;
}

export interface DbErrorLog {
  id: string;
  agent_id: string | null;
  task_id: string | null;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  severity: Severity;
  created_at: string;
}

export interface DbMilestone {
  id: string;
  name: string;
  description: string | null;
  target_date: string;
  status: MilestoneStatus;
  created_at: string;
}

export interface DbTokenUsage {
  id: string;
  agent_id: string;               // FK → agents.id
  task_id: string | null;         // FK → tasks.id
  model: ModelName;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
}

export interface DbAgentLearning {
  id: string;
  agent_id: string;
  learning: string;
  category: string | null;
  created_at: string;
}

export interface DbAgentIdea {
  id: string;
  agent_id: string;
  idea: string;
  status: 'pending' | 'accepted' | 'rejected' | 'implemented';
  created_at: string;
}

export interface DbFeedbackLog {
  id: string;
  agent_id: string;
  from_agent_id: string | null;
  feedback: string;
  rating: number | null;
  created_at: string;
}

export interface DbOperationsLog {
  id: string;
  agent_id: string | null;
  operation_type: string;
  resource: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface DbConnection {
  id: string;
  connection_name: string;
  connection_type: 'api' | 'database' | 'gpu' | 'service';
  status: 'online' | 'offline' | 'idle' | 'degraded' | 'error';
  last_check: string | null;
  latency_ms: number | null;
  error_message: string | null;
  uptime_percent: number;
  created_at: string;
}

export interface DbJobExecution {
  id: string;
  job_id: string | null;
  renter_id: string | null;
  provider_id: string | null;
  gpu_id: string | null;
  gpu_type: string | null;
  job_code_url: string | null;
  docker_image: string | null;
  entrypoint: string | null;
  status: 'pending' | 'matching' | 'matched' | 'executing' | 'checkpointing' | 'completed' | 'failed' | 'cancelled';
  estimated_hours: number | null;
  max_budget: number | null;
  cost_so_far: number | null;
  utilization: number | null;
  temperature: number | null;
  progress_percent: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DbStandup {
  id: string;
  agent_id: string;
  date: string;                    // date
  yesterday: string | null;
  today: string | null;
  blockers: string | null;
  created_at: string;
}
