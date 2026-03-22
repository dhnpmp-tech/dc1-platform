# Page Agents Platform Lifecycle + Billing Architecture

## 1) Objective
Define a production-safe persistent agent platform on DCP so customers can run long-lived AI agents (not just one-off jobs) with clear lifecycle controls, deterministic billing, and strong tenant isolation.

Primary outcomes:
- Lifecycle APIs for deploy/configure/start/pause/resume/stop/delete
- Durable runtime state and checkpoint persistence
- Health monitoring with controlled autoscaling
- Metering and billing model for persistent uptime + usage
- Security boundaries compatible with current Docker + provider topology

## 2) Scope and Non-Goals
### In Scope (v1)
- Persistent agents mapped to dedicated runtime sessions on provider GPUs.
- API-driven lifecycle state machine with auditability.
- State + artifact persistence in object storage and relational metadata tables.
- Usage metering for uptime, GPU-seconds, and request tokens/events.
- Safety controls: quotas, rate limits, kill-switches, and policy checks.

### Out of Scope (v1)
- Cross-provider live migration without restart.
- BYOC orchestration across third-party clusters.
- Autonomous self-modifying agents without approval gates.
- Revenue-share marketplace for third-party agent templates.

## 3) Architecture Overview

```text
Client (Dashboard/API)
  -> Agent Control API (Express)
      -> Agent Orchestrator Service
          -> Scheduler + Placement Engine
              -> Provider Runtime Adapter (daemon + Docker)
                  -> Agent Runtime Container
                      -> Work Queue + Health Reporter
      -> State Store (SQLite metadata -> Supabase mirror)
      -> Artifact Store (snapshots/logs/checkpoints)
      -> Billing Meter (usage events -> wallet ledger)
```

Execution model:
- Each Page Agent runs as a named runtime session with a stable `agent_id`.
- Runtime uses container templates (LLM/router/worker flavors) with strict resource bounds.
- Session state is periodic snapshot + event log; crash recovery rehydrates from latest valid snapshot.

## 4) Lifecycle State Machine
Canonical states:
- `draft`: created but not runnable (missing config/secrets/model)
- `deploying`: placement and runtime boot in progress
- `running`: healthy and serving requests/events
- `degraded`: running with health errors (latency/error thresholds breached)
- `paused`: billing-limited standby; no job execution
- `stopping`: graceful shutdown in progress
- `stopped`: runtime halted, state preserved
- `failed`: unrecoverable runtime or policy failure
- `deleted`: metadata tombstoned, resources released

Allowed transitions:
- `draft -> deploying -> running`
- `running -> paused -> running`
- `running -> stopping -> stopped`
- `stopped -> deploying -> running`
- `running|deploying|degraded -> failed`
- `stopped|failed|draft -> deleted`

Guardrails:
- No direct `running -> deleted` without `stopping` unless admin-force path.
- `failed` requires either `resume` (auto-recover path) or `delete`.

## 5) API Contract (Draft)
All errors must follow the platform contract:
```json
{ "error": "descriptive message" }
```

Auth:
- Renter-facing lifecycle: `x-renter-key`
- Admin override and fleet operations: `x-admin-token`

### 5.1 Create Agent
`POST /api/agents`

Request:
```json
{
  "name": "support-agent-riyadh",
  "template": "llm-chat-v1",
  "provider_preferences": { "gpu_vram_mib_min": 8192, "region": "sa" },
  "model": { "id": "ALLaM-7B-Instruct", "endpoint_mode": "local" },
  "autoscale": { "min_replicas": 1, "max_replicas": 2, "scale_metric": "queue_depth" },
  "billing_plan": "persistent-standard"
}
```

Response 201:
```json
{
  "agent_id": "agt_01J...",
  "status": "draft",
  "created_at": "2026-03-22T18:30:00Z"
}
```

### 5.2 Configure Agent
`PATCH /api/agents/:agentId/config`
- Update environment, secrets refs, policies, runtime limits, webhook targets.

### 5.3 Deploy/Start Agent
`POST /api/agents/:agentId/deploy`
- Validates configuration, places runtime, enters `deploying` then `running`.

### 5.4 Pause Agent
`POST /api/agents/:agentId/pause`
- Enters `paused`, detaches serving endpoint, keeps state + billing base floor only.

### 5.5 Resume Agent
`POST /api/agents/:agentId/resume`
- Rehydrates state and returns to `running`.

### 5.6 Stop Agent
`POST /api/agents/:agentId/stop`
- Graceful runtime termination; state persisted; status `stopped`.

### 5.7 Delete Agent
`DELETE /api/agents/:agentId`
- Soft delete metadata, revoke credentials, schedule artifact retention policy purge.

### 5.8 Agent Status + Metrics
`GET /api/agents/:agentId`
`GET /api/agents/:agentId/metrics`
`GET /api/agents/:agentId/logs`

### 5.9 List Agents
`GET /api/agents?status=running&template=llm-chat-v1`

## 6) Data Model (SQLite-first, Supabase mirrored)

```sql
CREATE TABLE IF NOT EXISTS page_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT UNIQUE NOT NULL,
  renter_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL,
  model_id TEXT,
  config_json TEXT NOT NULL,
  autoscale_json TEXT,
  provider_id INTEGER,
  endpoint_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS page_agent_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, revision)
);

CREATE TABLE IF NOT EXISTS page_agent_runtime_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_payload_json TEXT,
  severity TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_agent_usage_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  uptime_seconds INTEGER NOT NULL,
  gpu_seconds INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  token_in BIGINT DEFAULT 0,
  token_out BIGINT DEFAULT 0,
  error_count INTEGER NOT NULL,
  cost_halala INTEGER NOT NULL,
  priced_by_version TEXT NOT NULL,
  UNIQUE(agent_id, window_start, window_end)
);

CREATE TABLE IF NOT EXISTS page_agent_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  checkpoint_ref TEXT NOT NULL,
  checkpoint_size_bytes BIGINT,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

Recommended indexes:
- `page_agents(renter_id, status, updated_at)`
- `page_agent_runtime_events(agent_id, created_at)`
- `page_agent_usage_windows(agent_id, window_end)`

## 7) Health, Reliability, and Autoscaling
### 7.1 Health Signals
Collected every 15-30s:
- Runtime heartbeat freshness
- Request latency p50/p95
- Error rate
- Queue depth/event backlog
- GPU utilization and memory pressure

### 7.2 Degraded/Failed Policies
- `degraded` trigger: latency/error SLO breach for N consecutive windows.
- Auto-restart trigger: process crash or heartbeat miss > 90s.
- `failed` trigger: restart budget exceeded or repeated policy violations.

### 7.3 Autoscaling (v1 bounded)
- Horizontal replica bounds: `min_replicas=1` default, `max_replicas<=3` for v1.
- Scale out when queue depth or p95 latency exceeds threshold for 2 windows.
- Scale in only after cooldown and zero in-flight request threshold.
- Placement preference order: region -> GPU class fit -> reliability score -> cost.

## 8) Metering and Billing Model
Pricing is halala-native and must not invent external SAR claims in UI copy.

### 8.1 Billable Dimensions
- Base persistent reservation: per-minute runtime floor while `running`.
- GPU compute: `gpu_seconds * gpu_class_rate`.
- Request throughput add-on: per 1K requests or per token bucket (template-dependent).
- Storage: checkpoint/artifact GB-month (optional v1.1; track now, bill later).

### 8.2 Billing States
- `running`: full base + usage metering.
- `degraded`: metering continues; SLA credit policy may apply.
- `paused`: optional reduced floor (or zero floor if product policy chooses), no compute charges.
- `stopped`: no runtime metering, only retained storage if enabled.

### 8.3 Settlement Flow
1. Usage windows aggregate every minute.
2. Ledger preview available via `/api/agents/:id/metrics`.
3. Finalized windows write to renter wallet transactions.
4. Provider share follows existing 75/25 split when mapped to provider runtime costs.

### 8.4 Abuse and Cost Protection
- Hard monthly spend cap per renter.
- Auto-pause on insufficient balance (grace period configurable).
- Token/request rate limits to prevent runaway loops.

## 9) Security and Isolation Requirements
- Runtime isolation: one agent runtime container per tenant workload class.
- Secret handling: store only encrypted references in DB; inject at runtime, never return plaintext.
- Network policy: deny-all default egress, allowlist required model/artifact endpoints.
- Image policy: signed template images only for v1; block arbitrary untrusted images.
- Audit trail: immutable lifecycle + config revision logs.
- Admin actions: require `x-admin-token` and emit explicit audit events.

## 10) Delivery Plan (2w / 4w / 8w)
### 2 Weeks (MVP foundations)
- CRUD + lifecycle APIs (`draft/deploy/running/pause/resume/stop`).
- Core DB tables + runtime event logging.
- Single-replica runtime with restart-on-fail.
- Basic usage window metering (uptime + gpu_seconds).

### 4 Weeks (Production hardening)
- Autoscaling (bounded replicas), degraded/failed policy automation.
- Full billing ledger integration into wallets/transactions.
- Logs + metrics API and dashboard widgets.
- Security controls: secret refs, image allowlist, egress policy baseline.

### 8 Weeks (Retail-readiness)
- Multi-template catalog with Arabic-first presets.
- Advanced SLA policy + credit workflow.
- Enhanced checkpoint lifecycle and retention automation.
- Operational runbooks + load/perf qualification complete.

## 11) Implementation Breakdown (Backend / Frontend / QA)
### Backend (Owner: Founding Engineer + Backend Architect)
- Add routes: `backend/src/routes/agents.js` and mount in `backend/src/server.js`.
- Add schema migrations in `backend/src/db.js` for `page_agents*` tables.
- Add orchestrator service: `backend/src/services/agent-orchestrator.js`.
- Add metering service: `backend/src/services/agent-metering.js`.
- Enforce JSON error contract on all new endpoints.

Acceptance criteria:
- Lifecycle transitions enforce state-machine guards.
- API auth and error contracts match platform conventions.
- Usage windows persist and reconcile with wallet transactions.

### Frontend (Owner: Frontend Developer)
- New renter pages:
  - `app/renter/agents/page.tsx` (list + status)
  - `app/renter/agents/new/page.tsx` (create/configure)
  - `app/renter/agents/[id]/page.tsx` (runtime controls + metrics/logs)
- Reuse existing dashboard layout and i18n `t()` pattern.
- Explicit state badges: draft/deploying/running/degraded/paused/stopped/failed.

Acceptance criteria:
- No hardcoded user-facing strings; full i18n coverage EN/AR.
- Pause/resume/stop actions are optimistic but rollback on API error.
- Billing preview visible before deploy and while running.

### QA (Owner: QA Engineer)
- Add API integration suite for lifecycle transitions and invalid transitions.
- Add metering reconciliation tests (usage windows -> wallet deltas).
- Add chaos tests: heartbeat drops, restart budget exhaustion, auto-pause on low balance.
- Add UI regression coverage for lifecycle controls and status rendering.

Acceptance criteria:
- Critical path e2e: create -> deploy -> running -> pause -> resume -> stop -> delete.
- No false-success UI states on failed lifecycle operations.
- Security tests verify unauthorized lifecycle calls are rejected.

## 12) Open Decisions Requiring Leadership Input
- Pause billing policy: reduced floor vs zero-floor for paused agents.
- Pricing presentation: per-minute base only vs blended rate estimator in UI.
- Default data retention window for checkpoints/logs.
- Whether v1 allows customer-provided custom runtime images.

## 13) Launch Risk Register
- Risk: runaway token usage on persistent loops.
  - Mitigation: hard spend caps + per-agent rate limits + auto-pause.
- Risk: weak isolation between tenant runtimes.
  - Mitigation: strict image allowlist, network policy, secret-injection controls.
- Risk: billing disputes from metering mismatch.
  - Mitigation: minute-level usage windows + audit endpoint + immutable revision logs.
- Risk: provider churn affects persistent uptime.
  - Mitigation: reliability-weighted placement + checkpoint restore + degraded state visibility.

