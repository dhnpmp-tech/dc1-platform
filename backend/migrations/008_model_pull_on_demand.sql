-- 008_model_pull_on_demand.sql
-- Migration: cold model pull infrastructure.
--
-- When a renter requests a model no provider has cached, the backend writes
-- a pull task and the next provider heartbeat receives it. The provider's
-- agent (dcp-agent / Hermes on the box) executes the pull locally and
-- reports cached_models back via subsequent heartbeats.
--
-- Per pricing-redesign Phase 1: Ollama-only pull. vLLM serving prep in
-- a later migration (Phase 2).
--
-- Idempotent: every statement guarded.

PRAGMA foreign_keys = OFF;

-- model_registry: where to pull this model from on a provider machine.
-- Ollama supports `hf.co/<user>/<repo>:<tag>` URIs natively since v0.4,
-- which lets us serve community-quantized Arabic models (ALLaM Q4 GGUF,
-- JAIS, Falcon H1) without leaving the Ollama path.
ALTER TABLE model_registry ADD COLUMN ollama_pull_uri TEXT;

-- vllm_model_uri reserved for Phase 2 when vLLM-serving providers come online.
-- Stored as HF model id (e.g. "humain-ai/ALLaM-7B-Instruct-preview").
ALTER TABLE model_registry ADD COLUMN vllm_model_uri TEXT;

-- preferred_engine: 'ollama' (default) | 'vllm'. Renter doesn't pick — the
-- agent picks based on what's installed on the box.
ALTER TABLE model_registry ADD COLUMN preferred_engine TEXT DEFAULT 'ollama';

-- Approximate size in bytes — used by the agent to refuse pulls when
-- free disk is < size * 1.5 (room for unpack + working memory).
ALTER TABLE model_registry ADD COLUMN download_size_bytes INTEGER;

-- pending_provider_tasks: command queue from backend to a specific
-- provider's agent. Picked up on the agent's next heartbeat.
CREATE TABLE IF NOT EXISTS pending_provider_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('pull_model', 'unload_model', 'noop')),
  params_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'timeout')),
  progress_pct INTEGER DEFAULT 0,
  progress_message TEXT,
  result_json TEXT,
  error_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  picked_up_at TEXT,
  last_progress_at TEXT,
  completed_at TEXT,
  -- Job that triggered the task (so we can refresh that job once the
  -- pull finishes). NULL for tasks triggered by admin / pre-warming.
  source_job_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_tasks_provider
  ON pending_provider_tasks (provider_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_pending_tasks_job
  ON pending_provider_tasks (source_job_id)
  WHERE source_job_id IS NOT NULL;

-- jobs: add warming_provider state and link to the task that's warming it.
-- Existing job statuses include 'pending', 'queued', 'running', 'completed',
-- 'failed', 'cancelled'. Add 'warming_provider' between 'pending' and 'queued'.
ALTER TABLE jobs ADD COLUMN warming_task_id INTEGER;

PRAGMA foreign_keys = ON;
