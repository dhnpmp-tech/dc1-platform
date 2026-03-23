# DCP Roadmap to Production
**Version:** 1.0
**Date:** 2026-03-23
**Author:** CEO Agent (DCP-589)
**Target:** Stable commercial service for 100 providers + 100 renters

---

## Executive Summary

DCP has shipped 577 of 580 planned issues. The core platform is functional: job lifecycle, escrow, marketplace, auth, rate limiting, and a 6-model template catalog are all live. The gap between current state and retail-ready is **narrow but real** — 5 engineering gaps plus one operator-owned HTTPS blocker stand between us and stable commercial service.

This document covers:
1. Technical gap analysis (current vs retail-ready)
2. Three-tier model download architecture
3. Launch template catalog with full specs
4. Phased roadmap to 100 providers + 100 renters
5. Active blockers and what each needs

---

## Part 1: Technical Gap Analysis — Current vs Retail-Ready

Audited against commit `6eee7a3` on `main`.

### Requirement Matrix

| # | Requirement | Status | File(s) | Notes |
|---|---|---|---|---|
| 1 | Models load in <30s for cached models | **PARTIAL** | `backend/docker/Dockerfile.llm-worker`, `backend/installers/dc1-daemon.py` | Instant-tier (Nemotron Nano, SDXL) pre-baked in Docker image for zero cold start. Cached-tier ~10s after first pull. No SLA monitoring yet. |
| 2 | Top models cached on provider SSD | **DONE** | `backend/src/routes/providers.js:548-679`, `docker-templates/*.json` | Provider heartbeat tracks `cached_models`, `model_cache_disk_mb`, `model_cache_disk_used_pct`. All templates specify `"mount_path": "/opt/dcp/model-cache"`. |
| 3 | Inference server: persistent vLLM/TGI containers, OpenAI-compatible API | **DONE** | `backend/src/routes/vllm.js`, `backend/src/db.js:128-151` | `serve_sessions` table tracks long-running containers. `buildOpenAiResponse()` returns OpenAI-compatible JSON. `/api/vllm/complete` and `/api/vllm/complete/stream` endpoints live. |
| 4 | Long-running containers billed by uptime, serving multiple requests | **PARTIAL** | `backend/src/routes/vllm.js:394-418`, `backend/src/db.js:128-151` | `serve_sessions` billing fields exist (`total_inferences`, `total_tokens`, `total_billed_halala`) but **never updated** after inference — stays at 0 forever. **Sprint 25 Gap 1.** |
| 5 | Browsable template catalog in the UI | **DONE** | `app/renter/templates/page.tsx`, `docker-templates/` (20 JSON files) | Full template catalog page with category filtering. 6 launch models + additional templates. |
| 6 | Provider-side model cache persists between jobs | **DONE** | `backend/docker/Dockerfile.llm-worker:23`, `backend/docker/Dockerfile.sd-worker:24`, `backend/installers/dc1-daemon.py` | `HF_HOME=/opt/dcp/model-cache/hf` set in all worker Dockerfiles. Daemon handles model pre-caching on startup. |
| 7 | Automatic provider matching: model, VRAM, latency | **PARTIAL** | `backend/src/routes/providers.js:1642-1713`, `backend/src/routes/jobs.js:57-62` | VRAM check exists (`vram_mb < jobRequirements.vram_required_mb → reject`). Pricing-class sort (PRICING_CLASS_SORT_SQL). **No latency ranking, no cached-model tier validation at routing time. Sprint 25 Gap 5.** |
| 8 | Rate limiting per API key | **DONE** | `backend/src/middleware/rateLimiter.js` | `vllmCompleteLimiter` (10 req/min), `vllmStreamLimiter` (5 req/min), `jobSubmitLimiter` (10/min), `marketplaceLimiter` (60/min). Per-key extraction for renters and providers. |
| 9 | Usage metering per endpoint | **PARTIAL** | `backend/src/routes/vllm.js:479-481` | Token counts computed (`approximateTokenCount()`) and returned in response, but **not persisted** to `serve_sessions`. Same root cause as Gap 1. |
| 10 | API key scoping per endpoint | **DONE** | `backend/src/db.js:957-971`, `backend/src/routes/vllm.js:49-95` | `renter_api_keys` table with `scopes JSON`. `requireRenter()` middleware validates scope (`inference` or `admin`) and expiry. Backward-compatible with legacy master key. |

### Security Status

| Endpoint | Prior Status | Current Status | Fix Commit |
|---|---|---|---|
| `GET /api/jobs/active` | ⚠️ Auth removed (P0) | ✅ Auth-gated, scoped per actor | `4b394c0` |
| `GET /api/jobs/queue/:provider_id` | ⚠️ Auth removed (P0) | ✅ Auth-gated + ownership check | `4b394c0` |

### Smart Contract Status

- **Escrow.sol** — EIP-712 compliant, deployed pattern ready for Base Sepolia
- Fee: 25% DC1 platform fee (`FEE_BPS = 2500`)
- Payment token: USDC (6 decimals)
- Flow: `depositAndLock → job runs → oracle signs completion → provider calls claimLock → 75%/25% split`
- Expiry: renter calls `cancelExpiredLock` for refund
- Launch checklist: `contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md`

### Infrastructure Status

| Component | Status |
|---|---|
| Authentication | ✅ Complete |
| Rate limiting | ✅ Complete |
| Job lifecycle (submit → run → complete → bill) | ✅ Complete |
| API key scoping (renter) | ✅ Complete |
| Template catalog (6 launch models) | ✅ Complete |
| Three-tier Docker architecture | ✅ Groundwork done |
| Provider VRAM matching | ✅ Partial |
| Per-token metering persistence | ❌ Gap 1 |
| Instant-tier CI/CD image pipeline | ❌ Gap 4 |
| Provider daemon tier validation | ❌ Gap 5 |
| HTTPS / TLS for api.dcp.sa:443 | ❌ Operator blocker |

---

## Part 2: Three-Tier Model Download Architecture

The model download latency problem is the #1 retail UX blocker. DCP uses a three-tier architecture to solve it.

### Tier 1 — INSTANT (Pre-Baked Docker Images)

Models ship pre-loaded inside Docker images. Provider pulls image once; subsequent job starts are instant.

**Target cold-start:** 0 seconds (model already in image layer)

**Launch models for Tier 1:**
- Nemotron Nano 4B (8 GB) — `dc1/llm-worker:latest`
- SDXL base + refiner (12 GB combined) — `dc1/sd-worker:latest`

**Implementation:**
```dockerfile
# backend/docker/Dockerfile.llm-worker
# Nemotron Nano pre-baked at build time
RUN python3 -c "from huggingface_hub import snapshot_download; snapshot_download('nvidia/Nemotron-Mini-4B-Instruct', cache_dir='/opt/dcp/model-cache/hf')"
```

**What's needed:** CI/CD pipeline to build and publish `dc1/llm-worker:latest` and `dc1/sd-worker:latest` to a container registry accessible to providers. (Sprint 25 Gap 4)

### Tier 2 — CACHED (Persistent HuggingFace Cache Volume)

Persistent volume mounted at `/opt/dcp/model-cache` on each provider. First run downloads from HuggingFace Hub (~2–15 min depending on model size). All subsequent runs load from disk in <30 seconds.

**Target cold-start:** <30s after first pull

**Launch models for Tier 2:**
- Llama 3 8B Instruct (15 GB) — `meta-llama/Meta-Llama-3-8B-Instruct`
- Qwen 2.5 7B Instruct (15 GB) — `Qwen/Qwen2.5-7B-Instruct`
- Mistral 7B Instruct (14 GB) — `mistralai/Mistral-7B-Instruct-v0.3`

**Implementation:**
```bash
# Docker run command for cached-tier jobs
docker run \
  -v /data/dcp-model-cache:/opt/dcp/model-cache \
  -e MODEL_ID=meta-llama/Meta-Llama-3-8B-Instruct \
  -e HF_HOME=/opt/dcp/model-cache/hf \
  dc1/llm-worker:latest
```

**Provider requirement:** Persistent `/data/dcp-model-cache` directory on provider host. The daemon is responsible for creating and maintaining this directory across job executions.

### Tier 3 — ON-DEMAND (Long-Tail Models)

Long-tail models that exceed provider cache capacity. UI shows estimated download time upfront. Provider earns idle rate (`idle_rate_halala_per_min`) during download phase, then full rate once serving.

**Target cold-start:** Displayed in UI as estimate; provider compensated

**Examples:** Nemotron Super 70B (140 GB), custom fine-tunes, research models

**Implementation:**
1. Job submission: client selects on-demand model, sees estimated download time
2. Daemon: enters `downloading` state, earns idle rate, emits download progress events
3. Once model loaded: transitions to `serving` state, earns full compute rate
4. UI: live download progress bar for renter

---

## Part 3: Launch Template Catalog

Six models ready for commercial launch. All serve OpenAI-compatible API via vLLM or diffusers pipeline.

### Template Specifications

| Model | VRAM | Docker Image | Ports | Health Endpoint | Est. Load Time | Tier | SAR/hr |
|---|---|---|---|---|---|---|---|
| Nemotron Nano 4B | 8 GB | `dc1/llm-worker:latest` | 8000 | `GET /health` | ~5s (instant) | Instant | 5.00 |
| Llama 3 8B Instruct | 16 GB | `dc1/llm-worker:latest` | 8000 | `GET /health` | ~10s cached / ~2min first | Cached | 9.00 |
| Qwen 2.5 7B Instruct | 16 GB | `dc1/llm-worker:latest` | 8000 | `GET /health` | ~10s cached / ~2min first | Cached | 9.00 |
| Mistral 7B Instruct | 16 GB | `dc1/llm-worker:latest` | 8000 | `GET /health` | ~10s cached / ~2min first | Cached | 8.00 |
| Nemotron Super 70B | 80 GB+ | `dc1/llm-worker:latest` | 8000 | `GET /health` | ~30s cached / ~15min first | On-demand | 45.00 |
| SDXL 1.0 | 8 GB | `dc1/sd-worker:latest` | 8080 | `GET /health` | ~10s cached / ~3min first | Cached | 12.00 |

### Template Detail — Nemotron Nano 4B (Instant Tier)
- **HuggingFace ID:** `nvidia/Nemotron-Mini-4B-Instruct`
- **Docker image:** `dc1/llm-worker:latest` (pre-baked)
- **Min VRAM:** 8 GB
- **Context length:** 4096 tokens
- **Ports:** 8000 (vLLM OpenAI-compatible API)
- **Health check:** `GET http://localhost:8000/health` → `{"status":"ok"}`
- **Est. load time:** ~5s (pre-baked in image)

### Template Detail — Llama 3 8B Instruct (Cached Tier)
- **HuggingFace ID:** `meta-llama/Meta-Llama-3-8B-Instruct`
- **Docker image:** `dc1/llm-worker:latest`
- **Min VRAM:** 16 GB
- **Context length:** 8192 tokens
- **Ports:** 8000
- **Health check:** `GET http://localhost:8000/health`
- **Est. load time:** ~10s (cached) / ~2 min (first pull, ~15 GB)

### Template Detail — Qwen 2.5 7B Instruct (Cached Tier, Arabic)
- **HuggingFace ID:** `Qwen/Qwen2.5-7B-Instruct`
- **Docker image:** `dc1/llm-worker:latest`
- **Min VRAM:** 16 GB
- **Context length:** 32,768 tokens
- **Ports:** 8000
- **Health check:** `GET http://localhost:8000/health`
- **Est. load time:** ~10s (cached) / ~2 min first pull (~15 GB)
- **Special:** Best Arabic language performance in 7B class

### Template Detail — Mistral 7B Instruct (Cached Tier)
- **HuggingFace ID:** `mistralai/Mistral-7B-Instruct-v0.3`
- **Docker image:** `dc1/llm-worker:latest`
- **Min VRAM:** 16 GB
- **Context length:** 8192 tokens (32k with sliding window)
- **Ports:** 8000
- **Health check:** `GET http://localhost:8000/health`
- **Est. load time:** ~10s (cached) / ~2 min first pull (~14 GB)

### Template Detail — Nemotron Super 70B (On-Demand Tier)
- **HuggingFace ID:** `nvidia/Llama-3.1-Nemotron-70B-Instruct-HF`
- **Docker image:** `dc1/llm-worker:latest`
- **Min VRAM:** 80 GB (2× A100 80GB or equivalent)
- **Context length:** 8192 tokens
- **Ports:** 8000
- **Health check:** `GET http://localhost:8000/health`
- **Est. load time:** ~30s (if cached) / ~15 min first pull (~140 GB)
- **Tensor parallel:** `TENSOR_PARALLEL_SIZE=2`

### Template Detail — SDXL 1.0 (Cached Tier)
- **HuggingFace ID:** `stabilityai/stable-diffusion-xl-base-1.0`
- **Docker image:** `dc1/sd-worker:latest`
- **Min VRAM:** 8 GB
- **Output:** 1024×1024 PNG
- **Ports:** 8080
- **Health check:** `GET http://localhost:8080/health`
- **Est. load time:** ~10s (cached) / ~3 min first pull (~12 GB with refiner)

---

## Part 4: Roadmap to 100 Providers + 100 Renters

### Phase 1 — Stable Service (Week 1–2)

**Goal:** Platform is stable, secure, and billable. Launch gates cleared.

**Issues to create:**

| Issue | Title | Priority | Effort | Dependency |
|---|---|---|---|---|
| SP25-001 | Fix per-token metering: wire serve_sessions update after each inference | Critical | 1 day | None |
| SP25-002 | Deploy EIP-712 escrow to Base Sepolia testnet | Critical | 2 days | Operator: wallet + USDC |
| SP25-003 | Run certbot for api.dcp.sa — HTTPS/TLS on port 443 | Critical | 0.5 days | Operator: DNS + server access |
| SP25-004 | Add billing dashboard to renter UI: total spend, per-session breakdown | High | 2 days | SP25-001 |
| SP25-005 | Add earnings dashboard to provider UI: total earned, per-job history | High | 2 days | None |
| SP25-006 | End-to-end smoke test: submit job → inference → billing → payout | High | 1 day | SP25-001, SP25-002 |

**Launch gate criteria:**
- [ ] HTTPS live on `api.dcp.sa:443`
- [ ] Escrow deployed and tested on Base Sepolia
- [ ] Per-token metering persisted and accurate
- [ ] At least 1 successful end-to-end job with real billing

### Phase 2 — Provider Onboarding (Week 2–3)

**Goal:** 10+ providers can self-onboard, install daemon, and start earning.

**Issues to create:**

| Issue | Title | Priority | Effort | Dependency |
|---|---|---|---|---|
| SP25-007 | Build + publish `dc1/llm-worker:latest` via GitHub Actions CI | High | 2 days | None |
| SP25-008 | Build + publish `dc1/sd-worker:latest` via GitHub Actions CI | High | 1 day | SP25-007 (shared base) |
| SP25-009 | Provider daemon: validate cached model tier before accepting job | Medium | 1 day | None |
| SP25-010 | Provider daemon: emit download progress events (on-demand tier) | Medium | 2 days | None |
| SP25-011 | Provider onboarding wizard: step-by-step UI for daemon install | High | 3 days | SP25-007 |
| SP25-012 | Provider earnings dashboard: real-time SAR earnings, job history | High | 2 days | Phase 1 complete |
| SP25-013 | Daemon auto-update: poll for new daemon version, self-update | Medium | 2 days | None |

### Phase 3 — Renter Onboarding (Week 3–4)

**Goal:** 10+ renters can self-register, get API keys, run jobs, and pay.

**Issues to create:**

| Issue | Title | Priority | Effort | Dependency |
|---|---|---|---|---|
| SP25-014 | Renter API key management UI: create, label, revoke sub-keys | High | 2 days | None |
| SP25-015 | Usage metering dashboard: tokens, requests, cost per key | High | 2 days | SP25-001 |
| SP25-016 | OpenAI-compatible endpoint documentation + playground | High | 2 days | None |
| SP25-017 | Sub-minute billing: switch to per-second granularity | Medium | 1 day | None |
| SP25-018 | Renter rate limit UI: show remaining quota, reset time | Low | 1 day | None |
| SP25-019 | Automated renter onboarding email with API key + quickstart | Medium | 1 day | None |

### Phase 4 — Scale (Week 4+)

**Goal:** Platform handles 100 concurrent providers, 100 renters, SLA guarantees.

**Issues to create:**

| Issue | Title | Priority | Effort | Dependency |
|---|---|---|---|---|
| SP25-020 | Provider matching v2: latency-based ranking + cached-model affinity | High | 3 days | Phase 2 |
| SP25-021 | Load balancer: distribute requests across multiple providers for same model | High | 4 days | SP25-020 |
| SP25-022 | SLA monitoring: p50/p95/p99 latency per model, alerts on degradation | High | 3 days | Phase 3 |
| SP25-023 | Escrow deploy to Base mainnet + USDC integration | Critical | 2 days | Phase 1 validated |
| SP25-024 | Support escalation queue: renter/provider dispute resolution | Medium | 3 days | None |
| SP25-025 | Multi-region provider support: routing by geography | Medium | 5 days | SP25-021 |

---

## Part 5: Active Blockers

### DCP-308 — Launch Gate Checklist (in_progress → BLOCKED on operator)

**What it needs:**
1. **HTTPS/TLS proof** — run `certbot --nginx -d api.dcp.sa` on VPS 76.13.179.86. Evidence: `curl -I https://api.dcp.sa` returning 200 with valid TLS cert.
2. **Step 2 evidence bundle** — PM2 env export, certbot certificate files, nginx config snapshot. Post as artifacts to DCP-308.
3. **Step 3 deployment artifacts** — ordered deployment command outputs: `pm2 start`, `pm2 status`, health check responses.
4. **Step 4 post-deploy verification** — full API smoke test output: auth, job submit, provider list, marketplace.

**Unblock owner:** Board/operator. SSH to `76.13.179.86`, run certbot, post evidence.

### DCP-523 — Sprint Governance (blocked, waiting on DCP-308)

**What it needs:** DCP-308 to reach `done` with all four evidence bundles attached. Once DCP-308 is done, DCP-523 can issue the GO decision and trigger Sprint 25 issue creation.

**Unblock owner:** Flows from DCP-308 resolution. No additional action needed from engineering.

### DCP-524 — Launch-Gate Engineering (in_progress)

**What it needs:**
1. HTTPS evidence from operator (same as DCP-308 Step 2)
2. Confirmation that `mission-control-api` (8081) and `dc1-provider-onboarding` (8083) are responding on the VPS
3. End-to-end job submission test from external network to confirm no firewall blocks on 8081/8083

**Unblock owner:** Operator for HTTPS; engineering agent (CTO/SRE) for service health confirmation.

---

## Sprint 25 Issue Creation Checklist

The following Sprint 25 issues should be created immediately from Part 4:

**Phase 1 (create now — week 1):**
- SP25-001: Per-token metering fix
- SP25-002: Escrow Base Sepolia deploy
- SP25-003: Certbot HTTPS (operator task)
- SP25-004: Renter billing dashboard
- SP25-005: Provider earnings dashboard
- SP25-006: E2E smoke test

**Phase 2 (create now, start week 2):**
- SP25-007: CI for `dc1/llm-worker:latest`
- SP25-008: CI for `dc1/sd-worker:latest`
- SP25-009: Daemon tier validation
- SP25-010: Download progress events
- SP25-011: Provider onboarding wizard
- SP25-012: Provider real-time earnings dashboard
- SP25-013: Daemon auto-update

**Phase 3 (create week 3):**
- SP25-014 through SP25-019

**Phase 4 (create week 4):**
- SP25-020 through SP25-025

---

## Summary: Critical Path to Launch

```
TODAY
  └── Operator: run certbot on 76.13.179.86 → DCP-308 Step 2 evidence
       └── DCP-524 unblocked → engineering confirms service health
            └── DCP-308 reaches DONE → DCP-523 issues GO
                 └── Sprint 25 Phase 1 starts
                      ├── SP25-001: Fix per-token metering (1 day)
                      ├── SP25-002: Deploy escrow to Base Sepolia (2 days)
                      └── SP25-006: E2E smoke test → LAUNCH READY
```

**Estimated time to launch-ready state: 3–5 business days** (blocked only on operator running certbot and deploying escrow).

---

*Document produced by CEO Agent — DCP-589. For Sprint 25 issue creation, see Part 4.*
