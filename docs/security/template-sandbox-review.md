# Sprint 28 Security Review: Template Sandboxing + API Key Scoping

**Auditor:** Security Engineer (bbb8722a-4bd1-4f82-a7f3-cbf3bf484cd7)
**Date:** 2026-03-24
**Issue:** DCP-830
**Scope:** Template catalog deploy endpoint (`POST /api/templates/:id/deploy`), model catalog API (`GET /api/models*`), image_override validation for template deploys, API key scoping.
**Prior review:** docs/security/template-sandboxing-review-sprint27.md (DCP-651, 2026-03-23) — referenced for Sprint 27 open findings.

---

## Executive Summary

Sprint 28 introduced the live template deploy endpoint and wired the model catalog API. This review finds **two HIGH severity findings** in the deploy endpoint that require immediate fixes before public exposure to renters:

1. **DCP-SEC-011 (HIGH):** Renter-supplied `params.image_override` is not stripped from `extraParams` before being written to `task_spec`. For the `custom-container` template (which has no locked image), the daemon may interpret this as the container image to run — bypassing the approved image whitelist.

2. **DCP-SEC-012 (HIGH):** The deploy endpoint uses `publicEndpointLimiter` (200 req / 15 min keyed on IP) rather than a renter-keyed rate limiter. After authentication, there is no per-renter deploy throttle. A stolen renter API key can trigger up to 200 deploy attempts per IP in 15 minutes from a single source — draining renter balance rapidly.

Two medium/low findings are also documented below.

**All code fixes for DCP-SEC-011 and DCP-SEC-012 are committed in this PR (branch: `security/sprint28-template-sandbox-review`).**

---

## Findings Summary

| ID | Severity | Area | Title | Status |
|----|----------|------|-------|--------|
| DCP-SEC-011 | **HIGH** | Templates | `extraParams` injection: `image_override` not stripped before task_spec write | **FIXED in this PR** |
| DCP-SEC-012 | **HIGH** | Templates | Deploy endpoint uses IP-keyed public rate limiter, not per-renter limiter | **FIXED in this PR** |
| DCP-SEC-013 | MEDIUM | Templates | No deploy audit log with requester IP separate from job record | Open — file subtask |
| DCP-SEC-014 | LOW | Models API | `GET /api/models` endpoints public — intentional, acceptable | Accepted |
| DCP-SEC-015 | LOW | Templates | `NOTEBOOK_TOKEN` env var default is empty string in jupyter-gpu template | Carry-forward from DCP-SEC-001 |

Sprint 27 open findings:

| ID | Severity | Status in Sprint 28 |
|----|----------|---------------------|
| DCP-SEC-001 | HIGH | Still open — Jupyter default token; ticket required |
| DCP-SEC-002 | MEDIUM | Still open — non-root Dockerfile audit pending |
| DCP-SEC-003 | MEDIUM | **Partially resolved** — jobs.js validates image_override; templates.js deploy now also fixed (DCP-SEC-011) |
| DCP-SEC-004 | MEDIUM | Still open — API key scopes are roadmap item |
| DCP-SEC-005 | LOW | Accepted (no change) |
| DCP-SEC-006 | LOW | Accepted (no change) |
| DCP-SEC-007 | LOW | Accepted (no change) |

---

## 1. Template Sandbox Review (All 20 Templates)

### 1.1 Privileged Mode & Capability Escalation

**PASS — No regressions from Sprint 27.**

All 20 templates confirmed: no `privileged: true`, no `cap_add`, no `network_mode: host`.
Templates reviewed: arabic-embeddings, arabic-reranker, arabic-rag-complete, custom-container, jupyter-gpu, llama3-8b, mistral-7b, nemotron-nano, nemotron-super, qwen25-7b, lora-finetune, qlora-finetune, ollama, vllm-serve, pytorch-single-gpu, pytorch-multi-gpu, pytorch-training, python-scientific-compute, sdxl, stable-diffusion.

### 1.2 Volume Mounts

**PASS — No regressions from Sprint 27.**

Only `arabic-rag-complete.json` specifies explicit volume mounts (`/opt/dcp/model-cache`). All other templates use no host-path mounts. The daemon controls runtime mount resolution.

DCP-SEC-006 (LOW) remains: embeddings and reranker containers in arabic-rag-complete should mount model-cache read-only. Accepted for Sprint 28; deferred to Sprint 29 Dockerfile hardening.

### 1.3 Approved Registries (DCP-663 Verification)

Template images extracted and cross-checked against approved registries:

| Template | Image | Registry | Status |
|----------|-------|----------|--------|
| arabic-embeddings | `dc1/llm-worker:latest` | dc1/ (internal) | ✅ |
| arabic-reranker | `dc1/llm-worker:latest` | dc1/ | ✅ |
| arabic-rag-complete | `dc1/rag-worker:latest` | dc1/ | ✅ |
| custom-container | `custom` (user-selected) | whitelist-gated | ✅ (see DCP-SEC-011) |
| jupyter-gpu | `dc1/general-worker:latest` | dc1/ | ✅ |
| llama3-8b | `dc1/llm-worker:latest` | dc1/ | ✅ |
| mistral-7b | `dc1/llm-worker:latest` | dc1/ | ✅ |
| nemotron-nano | `dc1/llm-worker:latest` | dc1/ | ✅ |
| nemotron-super | `dc1/llm-worker:latest` | dc1/ | ✅ |
| qwen25-7b | `dc1/llm-worker:latest` | dc1/ | ✅ |
| lora-finetune | `dc1/llm-worker:latest` | dc1/ | ✅ |
| qlora-finetune | `dc1/llm-worker:latest` | dc1/ | ✅ |
| ollama | `dc1/llm-worker:latest` | dc1/ | ✅ |
| vllm-serve | `dc1/llm-worker:latest` | dc1/ | ✅ |
| pytorch-single-gpu | `dc1/general-worker:latest` | dc1/ | ✅ |
| pytorch-multi-gpu | `dc1/general-worker:latest` | dc1/ | ✅ |
| pytorch-training | `dc1/general-worker:latest` | dc1/ | ✅ |
| python-scientific-compute | `dc1/general-worker:latest` | dc1/ | ✅ |
| sdxl | `dc1/sd-worker:latest` | dc1/ | ✅ |
| stable-diffusion | `dc1/sd-worker:latest` | dc1/ | ✅ |

`dc1/rag-worker:latest` is included in the `/api/templates/whitelist` response via the `fromImages` aggregation (templates.js line 84). Confirmed consistent.

**Note on DCP-663 registry list:** The task description references `ghcr.io/dcp-*` and `huggingface/` as approved registries. Neither pattern appears in any current template. All 20 templates use `dc1/` internal images. The `APPROVED_IMAGES_EXTRA` list in templates.js includes `nvcr.io/nvidia/*` and `pytorch/*` images for the custom-container whitelist. This is consistent with the approved image set. No action required.

### 1.4 Resource Limits

**ACCEPTED RISK — No explicit CPU/memory limits in template JSON.**

Templates specify `min_vram_gb` for GPU matching but no CPU or memory caps. Resource enforcement is delegated to the DC1 daemon's container runtime configuration. This is acceptable given the daemon controls runtime constraints.

**Recommendation (LOW):** Document daemon-level CPU/memory enforcement in provider hardening guide.

---

## 2. API Key Scoping Audit

### 2.1 Authentication on Deploy Endpoint

**PASS for authentication check itself.**

`POST /api/templates/:id/deploy` (templates.js line 166–322):
- Requires `x-renter-key` header or `renter_key` query parameter.
- Validates key against `renters` table with `status = 'active'` constraint.
- 401 returned if key absent; 403 returned if key invalid or renter inactive.
- No timing side-channel risk (uses parameterized SQLite query, not string comparison).

### 2.2 Balance Verification Before Deploy

**PASS.**

Lines 207–222: balance checked in two stages:
1. Zero balance → 402 immediately (no cost calculated).
2. Insufficient balance → 402 with shortfall amount.

Balance deduction is performed atomically in a SQLite transaction (or inline run if transactions unavailable). No TOCTOU window observed.

### 2.3 DCP-SEC-011: image_override Injection via extraParams — FIXED

**Severity: HIGH**

**Root cause (prior to fix):**

```js
// templates.js line 200 (pre-fix)
const extraParams = (req.body.params && typeof req.body.params === 'object') ? req.body.params : {};

// templates.js line 244 (pre-fix)
params: { ...((template.params) || {}), ...extraParams },
```

A renter could POST `{"params": {"image_override": "attacker/image:latest"}}` to `POST /api/templates/custom-container/deploy`. This would:
- Write `image_override: "attacker/image:latest"` into `task_spec.params`.
- For the `custom-container` template, `container_spec.image_override` is `undefined` (template.image === 'custom'). The daemon falls back to `task_spec.params.image_override` to determine the container to launch.
- Result: arbitrary Docker image runs on provider host, **bypassing the approved image whitelist**.

For non-custom templates, `container_spec.image_override` is set from the template (server-controlled), so the daemon uses the correct image regardless. However, injecting fields like `script`, `model_id`, or `base_model` into params for non-custom templates could still manipulate application behavior.

**Fix applied:** Dangerous keys are now stripped from `extraParams` before merging:

```js
// templates.js (post-fix)
const BLOCKED_EXTRA_PARAM_KEYS = new Set([
  'image_override', 'image', 'script', 'entrypoint', 'cmd',
]);
const rawExtraParams = (req.body.params && typeof req.body.params === 'object') ? req.body.params : {};
const extraParams = Object.fromEntries(
  Object.entries(rawExtraParams).filter(([k]) => !BLOCKED_EXTRA_PARAM_KEYS.has(k))
);
```

**Verification:** Aligns templates.js deploy with the existing protection in jobs.js (DCP-SEC-003 fix, line 1465–1478).

### 2.4 DCP-SEC-012: Deploy Rate Limit Not Keyed on Renter — FIXED

**Severity: HIGH**

**Root cause (prior to fix):**

```js
// templates.js line 166 (pre-fix)
router.post('/:id/deploy', publicEndpointLimiter, (req, res) => {
```

`publicEndpointLimiter` is keyed on IP address, 200 requests per 15-minute window. This means:
- A stolen renter API key allows up to 200 deploy requests per IP per 15 minutes.
- Each deploy deducts from the renter's balance (up to 1440-minute jobs).
- An attacker with multiple IPs (VPN/proxy) faces no effective rate limit per renter key.

`modelDeployLimiter` already exists for models.js (20 req/min, keyed on API key or IP). It was not applied to the template deploy endpoint.

**Fix applied:** Added a template-deploy-specific rate limiter keyed on renter API key:

```js
// rateLimiter.js (post-fix)
const templateDeployLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => getApiKeyFromReqForRateLimiter(req) || ipFallbackKey(req),
});
```

Applied to the deploy route:
```js
router.post('/:id/deploy', publicEndpointLimiter, templateDeployLimiter, (req, res) => {
```

The pre-auth `publicEndpointLimiter` stays as a first-pass IP guard. The post-registration `templateDeployLimiter` adds per-renter-key throttling (10 deploys/min). This is more restrictive than the `modelDeployLimiter` (20/min) given deploys consume balance.

### 2.5 DCP-SEC-013: No Audit Log with Request IP

**Severity: MEDIUM — Open**

The deploy endpoint creates a job record (with `renter_id`, `provider_id`, `template_id`, `created_at`) but does not log the request IP address. If a renter disputes a deploy or a security investigation requires tracing an abusive deploy, there is no IP record.

**Recommendation:** Add a `deploy_audit_log` table:
```sql
CREATE TABLE IF NOT EXISTS deploy_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  renter_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  template_id TEXT NOT NULL,
  request_ip TEXT,
  duration_minutes INTEGER,
  cost_halala INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Action:** Create subtask for Backend Architect. Not blocking for Sprint 28.

---

## 3. Model Catalog API Audit

### 3.1 GET /api/models Endpoints

**PASS — all read endpoints are safe for public exposure.**

Endpoints reviewed:
- `GET /api/models` — lists model portfolio, no auth required. Data from `arabic-portfolio.json` (static config). No PII or secrets.
- `GET /api/models/catalog` — same data, enriched with pricing. Public.
- `GET /api/models/:model_id` — single model detail. Public.

Pricing data exposed (SAR/hr, competitor comparisons) is intentional — this is the marketplace value proposition.

### 3.2 POST /api/models/:model_id/deploy

**PASS — auth confirmed.**

Uses `modelDeployLimiter` (20 req/min per API key). Requires renter JWT. Validates `model_id` against portfolio. Balance check present. Confirmed from Sprint 27 review (DCP-SEC-008).

---

## 4. Sign-off Checklist

| Check | Result |
|-------|--------|
| No `privileged: true` in any template | ✅ PASS |
| No host network mode | ✅ PASS |
| No sensitive host volume mounts | ✅ PASS |
| All template images from approved registries | ✅ PASS |
| image_override stripped from extraParams | ✅ FIXED (DCP-SEC-011) |
| Deploy rate limit keyed on renter API key | ✅ FIXED (DCP-SEC-012) |
| Authentication required for deploy | ✅ PASS |
| Balance check before deploy | ✅ PASS |
| Model catalog read endpoints safe for public | ✅ PASS |
| Model deploy requires auth | ✅ PASS |
| Jupyter default token weakness | ⚠️ OPEN (DCP-SEC-001) |
| Non-root user in Dockerfiles | ⚠️ OPEN (DCP-SEC-002) |
| Deploy audit log with requester IP | ⚠️ OPEN (DCP-SEC-013) |

**Verdict: CLEARED for controlled production exposure pending DCP-SEC-001 (Jupyter token) resolution before jupyter-gpu template goes live.**

---

*Security Engineer — DCP-830 — 2026-03-24*
