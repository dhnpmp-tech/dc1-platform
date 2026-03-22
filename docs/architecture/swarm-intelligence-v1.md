# Swarm Intelligence v1 Architecture + Prediction APIs

## 1) Objective
Build a production-safe Swarm Intelligence layer that turns live marketplace telemetry into three API products:
- Demand + ETA predictions (`/api/swarm/predictions`)
- Provider reliability scoring (`/api/swarm/provider-score`)
- Pricing recommendations (`/api/swarm/pricing-suggestions`)

V1 is decision-support only (read-only recommendations), not autonomous scheduling.

## 2) Scope and Non-Goals
### In Scope (v1)
- Forecast short-horizon demand (15m/60m/6h) by job type and GPU class.
- Predict ETA bands for queued jobs.
- Compute provider reliability score using delivery quality + heartbeat behavior.
- Produce pricing recommendations in halala/min with guardrails.
- Expose all outputs via authenticated REST APIs.

### Out of Scope (v1)
- Fully automated dynamic pricing writes to billing tables.
- Replacing current scheduler or job router logic.
- Realtime streaming transport (WebSocket); v1 remains polling-based.

## 3) System Architecture

```text
Telemetry Sources
  - jobs table
  - providers table (heartbeat/GPU status)
  - recovery + timeout signals
        |
        v
[Swarm Feature Builder] (5 min cadence + on-demand backfill)
  - validates + normalizes telemetry
  - writes feature snapshots
        |
        +----> swarm_feature_snapshots
        +----> swarm_provider_reliability_daily
        +----> swarm_market_pressure_hourly
        |
        v
[Swarm Predictor]
  - demand forecaster
  - ETA estimator
  - pricing recommender
  - confidence scorer
        |
        +----> swarm_predictions_cache (TTL)
        |
        v
[Swarm API Router]
  - /predictions
  - /provider-score
  - /pricing-suggestions
```

## 4) Storage and Data Model (SQLite)
Additive tables only (no breaking schema changes):

```sql
CREATE TABLE IF NOT EXISTS swarm_feature_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at TEXT NOT NULL,
  window_minutes INTEGER NOT NULL,
  job_type TEXT NOT NULL,
  gpu_class TEXT NOT NULL,
  queued_jobs INTEGER NOT NULL,
  running_jobs INTEGER NOT NULL,
  completed_jobs INTEGER NOT NULL,
  failed_jobs INTEGER NOT NULL,
  timeout_jobs INTEGER NOT NULL,
  avg_start_delay_seconds REAL NOT NULL,
  avg_runtime_seconds REAL NOT NULL,
  online_provider_count INTEGER NOT NULL,
  heartbeat_staleness_ratio REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swarm_provider_reliability_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  day_utc TEXT NOT NULL,
  jobs_completed INTEGER NOT NULL,
  jobs_failed INTEGER NOT NULL,
  jobs_timeout INTEGER NOT NULL,
  heartbeat_missed INTEGER NOT NULL,
  median_start_delay_seconds REAL,
  reliability_score REAL NOT NULL,
  score_version TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, day_utc)
);

CREATE TABLE IF NOT EXISTS swarm_predictions_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prediction_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  horizon_minutes INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  confidence REAL NOT NULL,
  expires_at TEXT NOT NULL,
  model_version TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(prediction_type, entity_key, horizon_minutes)
);
```

Recommended indexes:
- `swarm_feature_snapshots(captured_at, job_type, gpu_class)`
- `swarm_provider_reliability_daily(provider_id, day_utc)`
- `swarm_predictions_cache(prediction_type, entity_key, horizon_minutes, expires_at)`

## 5) Telemetry Input Contract
All telemetry timestamps are UTC ISO-8601.

### 5.1 Jobs Telemetry
Source: `jobs` table + lifecycle endpoints.
Required fields:
- `job_id` (string)
- `provider_id` (number, nullable until assignment)
- `job_type` (`llm_inference | training | rendering | image_generation | default`)
- `status` (`pending | running | completed | failed | cancelled`)
- `submitted_at`, `started_at`, `completed_at` (ISO datetime, nullable by state)
- `actual_duration_minutes` (number, nullable until completion)
- `actual_cost_halala` (integer, nullable until completion)
- `max_duration_seconds` (integer)

Derived failure signals:
- `timeout_flag` when `status=failed` and timeout policy triggered
- `start_delay_seconds = started_at - submitted_at`

### 5.2 Heartbeat Telemetry
Source: `/api/providers/heartbeat` and `providers` table.
Required fields:
- `provider_id` (number)
- `status` (`online | offline | disconnected | paused`)
- `last_heartbeat` (ISO datetime)
- `gpu_model` / `gpu_name_detected` (string)
- `gpu_vram_mib` (integer)
- `gpu_status` JSON blob (utilization/memory/temp when available)

Derived heartbeat features:
- `heartbeat_age_seconds`
- `stale_heartbeat_flag` (threshold default: >90s)
- `utilization_pct` parsed defensively from known keys

### 5.3 Queue Pressure Telemetry
Derived every 5 minutes:
- `queued_jobs`
- `runnable_jobs` (queued and resource-fit)
- `online_provider_count`
- `eligible_provider_count` per GPU class
- `queue_pressure_ratio = queued_jobs / max(eligible_provider_count, 1)`

### 5.4 Reliability Inputs
Per provider/day:
- Completion ratio
- Timeout ratio
- Heartbeat miss ratio
- Median queue-to-start delay
- Consecutive incident count (optional, v1.1)

## 6) Prediction and Scoring Methods (v1)
Use deterministic heuristics and rolling-window statistics first; ML model upgrade can be introduced in v1.1.

### 6.1 Demand Forecast
- Windows: 60m short-term, 24h baseline.
- Forecast formula:
  - `predicted_jobs = weighted_moving_average(recent_windows)`
  - weights: `0.55 (last hour) + 0.30 (previous hour) + 0.15 (same hour previous day)`
- Output with confidence based on sample size + variance.

### 6.2 ETA Prediction
- `eta_seconds = avg_start_delay_seconds + expected_runtime_seconds`
- Return percentile bands (P50/P75/P90) from recent completed jobs in same `(job_type, gpu_class)` bucket.

### 6.3 Provider Reliability Score
0-100 score:
- 45% successful completion ratio
- 25% heartbeat freshness consistency
- 20% timeout/failure penalties
- 10% queue-to-start latency quality

Score bands:
- `90-100` excellent
- `75-89` good
- `60-74` watch
- `<60` high risk

### 6.4 Pricing Suggestion
For each `(job_type, gpu_class)`:
- Start from configured base rate (halala/min)
- Apply bounded multipliers:
  - Demand pressure: `+0%..+20%`
  - Capacity slack: `-0%..-15%`
  - Reliability adjustment: `-0%..-10%` for low-score pools
- Hard cap for v1: final suggested rate in `base * [0.85, 1.20]`

## 7) API Contract Drafts
All errors return:
```json
{ "error": "descriptive message" }
```

### 7.1 `GET /api/swarm/predictions`
Purpose: demand + ETA snapshots by market segment.

Auth:
- Admin token required for global view (`x-admin-token`)
- Optional scoped view for renters with `x-renter-key`

Query params:
- `job_type` optional
- `gpu_class` optional (e.g., `consumer_8_16gb`, `datacenter_40gb_plus`)
- `horizon_minutes` optional, enum: `15|60|360` (default `60`)

Response (200):
```json
{
  "generated_at": "2026-03-22T17:00:00Z",
  "horizon_minutes": 60,
  "segments": [
    {
      "job_type": "llm_inference",
      "gpu_class": "consumer_8_16gb",
      "predicted_demand_jobs": 42,
      "queue_pressure_ratio": 1.6,
      "eta_seconds_p50": 95,
      "eta_seconds_p75": 140,
      "eta_seconds_p90": 220,
      "confidence": 0.81,
      "model_version": "swarm-v1.0"
    }
  ]
}
```

### 7.2 `GET /api/swarm/provider-score`
Purpose: explainable provider reliability score.

Auth:
- Admin token for any provider
- Provider key may request own score only

Query params:
- `provider_id` required for admin
- `days` optional lookback (`7|14|30`, default `14`)

Response (200):
```json
{
  "provider_id": 187,
  "lookback_days": 14,
  "score": 88.4,
  "band": "good",
  "components": {
    "completion_ratio": 0.96,
    "heartbeat_freshness": 0.91,
    "timeout_penalty": 0.04,
    "start_delay_quality": 0.79
  },
  "explanations": [
    "High completion consistency over last 14 days",
    "Minor heartbeat staleness observed during peak windows"
  ],
  "generated_at": "2026-03-22T17:00:00Z",
  "score_version": "swarm-reliability-v1"
}
```

### 7.3 `GET /api/swarm/pricing-suggestions`
Purpose: operator-facing recommendation only.

Auth:
- Admin token only in v1

Query params:
- `job_type` optional
- `gpu_class` optional
- `horizon_minutes` optional (`60|360`, default `60`)

Response (200):
```json
{
  "generated_at": "2026-03-22T17:00:00Z",
  "horizon_minutes": 60,
  "recommendations": [
    {
      "job_type": "training",
      "gpu_class": "datacenter_40gb_plus",
      "base_rate_halala_per_min": 25,
      "suggested_rate_halala_per_min": 29,
      "adjustment_pct": 16,
      "drivers": {
        "demand_pressure": 0.18,
        "capacity_slack": 0.02,
        "reliability_modifier": 0.00
      },
      "confidence": 0.76,
      "expires_at": "2026-03-22T18:00:00Z"
    }
  ]
}
```

## 8) Security and Risk Controls
- Keep endpoints read-only in v1; no automated price writes.
- Enforce admin/provider/renter auth boundaries per endpoint.
- Rate-limit swarm endpoints under `/api/swarm/*` using existing limiter patterns.
- Reject malformed query params with 400 JSON errors.
- Cache outputs with TTL to prevent expensive recalculation under burst traffic.
- Add kill switch: `SWARM_ENABLED=false` disables routes cleanly.
- Include model/version in every response for auditability.
- Log feature freshness and prediction lag; fail closed when stale beyond threshold.

## 9) Rollout Plan (2w / 4w / 8w)

### Phase A (0-2 weeks): Foundations
Deliverables:
- Add swarm tables + indexes and migration hook in `backend/src/db.js`.
- Implement feature builder service (`backend/src/services/swarm-feature-builder.js`).
- Add internal validator for telemetry contract.
- Expose stubbed API routes with schema-valid static payloads.

Exit criteria:
- Freshness pipeline running every 5m in staging.
- API responses return deterministic payload shape with auth + rate limits.

Risks + controls:
- Risk: high DB scan cost on jobs table. Control: rolling-window indexes + bounded lookback.
- Risk: inconsistent heartbeat JSON. Control: tolerant parsing + defaults.

### Phase B (2-4 weeks): Live Heuristics
Deliverables:
- Implement demand/ETA/reliability/pricing heuristic engines.
- Persist scored outputs to `swarm_predictions_cache`.
- Add admin observability endpoint (`/api/swarm/health`) with freshness and error counters.

Exit criteria:
- P95 swarm API latency < 150ms from cache.
- Prediction freshness < 10 minutes.
- Explainability payloads validated by ops/admin.

Risks + controls:
- Risk: unstable recommendations in low-volume segments. Control: confidence floor + fallback to base rates.
- Risk: stale cache under service faults. Control: explicit `expires_at` and stale-data rejection.

### Phase C (4-8 weeks): Hardening + Controlled Adoption
Deliverables:
- Shadow-mode comparison against actual outcomes (ETA error, demand error).
- Add calibration job + weekly drift report.
- Integrate optional advisory widgets in admin dashboard (read-only).

Exit criteria:
- ETA P75 error <= 25% on high-volume segments.
- Reliability score correlation with real incidents is statistically positive.
- Operator signoff for wider usage.

Risks + controls:
- Risk: operator over-trust in predictions. Control: confidence/band labeling + explicit advisory wording.
- Risk: model drift. Control: weekly recalibration and versioned score formulas.

## 10) Appendix: API Schema Summary

### Common response fields
- `generated_at` (ISO datetime)
- `confidence` (`0..1`, optional per item)
- `model_version` / `score_version` (string)

### Standard errors
- `400` invalid query parameters
- `401` missing/invalid auth
- `403` auth valid but insufficient scope
- `429` rate-limit exceeded
- `500` internal failure

### Validation constraints
- `horizon_minutes` enum-validated.
- `job_type` normalized to internal canonical enum.
- `gpu_class` canonicalized through mapper (no freeform classes in stored records).

## 11) Implementation Notes for DCP-553
Target files for follow-up implementation issues:
- `backend/src/routes/swarm.js` (new)
- `backend/src/services/swarm-feature-builder.js` (new)
- `backend/src/services/swarm-predictor.js` (new)
- `backend/src/db.js` (schema + indexes)
- `backend/src/server.js` (route mount + limiter)
- `backend/src/__tests__/swarm.test.js` (new)

This document defines the v1 contract and rollout gate criteria before code implementation.
