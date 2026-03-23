# Sprint 25 Engineering Gap Analysis
**Author:** Founding Engineer  
**Date:** 2026-03-23  
**For:** CEO (DCP-589 roadmap input)

---

## What Is Shipped and Working

| Area | Status | Evidence |
|---|---|---|
| Provider/renter auth | ✅ Complete | All routes auth-gated; P0 fixes in `4b394c0` |
| Job lifecycle (submit → run → complete → bill) | ✅ Complete | Per-minute halala billing, escrow, webhooks |
| Marketplace / provider listing | ✅ Complete | SQL ambiguity fixed in `cf0faf3` |
| Rate limiting | ✅ Complete | Per-route limiters in `server.js` |
| Template catalog (6 models) | ✅ Complete | `docker-templates/` — `a88f699` |
| Three-tier Docker architecture | ✅ Groundwork | Dockerfiles upgraded in `94888b7` |
| Model portfolio (hot/warm/cold) | ✅ Complete | `arabic-portfolio.json` updated in `f8e057b` |
| P2P discovery | ✅ Complete | Optional package detection in `56e18f2` |
| HTTPS / TLS | ⛔ Operator | Certbot not run; port 443 refused |

---

## Gap 1: Per-Token Metering Not Wired (serve_sessions)

**Severity:** High — affects production billing accuracy for LLM serving workloads

**What exists:**
- `serve_sessions` table has `total_inferences`, `total_tokens`, `total_billed_halala`
- `model_registry` has `default_price_halala_per_min` per model
- `buildOpenAiResponse()` in `vllm.js` returns `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`

**What's missing:**
- The `POST /api/vllm/complete` and `/complete/stream` routes never write back to `serve_sessions`
- Each inference `total_tokens` is computed and returned to the caller but not persisted
- `total_billed_halala` stays 0 forever for all serve sessions

**Sprint 25 fix:** After each successful inference in `vllm.js`, `UPDATE serve_sessions SET total_inferences = total_inferences + 1, total_tokens = total_tokens + ?, total_billed_halala = total_billed_halala + ?, last_inference_at = ? WHERE job_id = ?`

---

## Gap 2: API Key Scoping Not Implemented

**Severity:** Medium — needed before multi-team / enterprise use

**What exists:**
- Single flat API key per renter (`renters.api_key`)
- Single flat API key per provider (`providers.api_key`)
- `api_key_rotations` table tracks key rotation history only

**What's missing:**
- No `api_key_scopes` table (read-only vs submit vs admin)
- No per-key rate limits or resource budgets
- No team/sub-account concept (one key per renter account only)

**Sprint 25 fix:** New table `renter_api_keys(id, renter_id, key, scopes JSON, label, expires_at, revoked_at)`. Routes check scope claims from the key record, not just key existence.

---

## Gap 3: Billing Granularity — Per-Minute Only

**Severity:** Low-medium — competitive disadvantage vs RunPod/Vast (per-second billing)

**What exists:** `duration_minutes INTEGER` on jobs table; cost = `duration_minutes * rate_halala_per_min`

**What's missing:** Sub-minute jobs (< 60 s) round up to 1 minute; providers lose ~50% revenue on fast workloads

**Sprint 25 fix:** Add `duration_seconds INTEGER` column (migration needed). Compute `cost = ceil(duration_seconds / 60.0) * rate_halala_per_min` or switch to per-second rate with `rate_halala_per_sec`.

---

## Gap 4: Instant-Tier Image Build Pipeline

**Severity:** Medium — Dockerfiles updated but no CI/CD to publish `dc1/llm-worker:latest`

**What exists:** `Dockerfile.llm-worker` (v2, vLLM + Nemotron Nano pre-bake) and `Dockerfile.sd-worker` (v2, SDXL)

**What's missing:**
- No CI workflow to build and push `dc1/llm-worker:latest`, `dc1/sd-worker:latest` to a registry
- Providers cannot pull `dc1/llm-worker:latest` if it's not published
- No registry URL documented for providers

**Sprint 25 fix:** GitHub Actions workflow: on push to `main`, build workers with `SKIP_MODEL_PREBAKE=1` (fast CI image) and push to registry. Separate nightly/on-demand build with full pre-bake.

---

## Gap 5: Provider Daemon Does Not Validate Template Tier

**Severity:** Low — providers may accept jobs for models they don't have cached

**What exists:** Daemon polls `/api/providers/jobs/next` and accepts any pending job

**What's missing:** No check that the requested model's tier matches what's cached locally before accepting

**Sprint 25 fix:** Job submit flow checks `prewarm_class` vs provider's `cached_models` field before routing. If tier=hot and model not in `cached_models`, route to a different provider or queue.

---

## Already Resolved This Cycle

- Auth P0: `/active` and `/queue/:id` now require auth (`4b394c0`)
- SQL: ambiguous `total_jobs` in `/available` and `/marketplace` (`cf0faf3`)
- Templates: Llama 3 8B, Qwen 2.5 7B, Nemotron Nano, Nemotron Super, SDXL (`a88f699`)
- Portfolio: Qwen2.5 upgrade, Mistral, Nemotron Nano/Super added (`f8e057b`)
- Dockerfiles: vLLM engine, Nemotron Nano + SDXL instant-tier pre-bake (`94888b7`)
