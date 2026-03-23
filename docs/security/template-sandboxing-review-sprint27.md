# Sprint 27 Security Review: Template Sandboxing & API Key Scoping

**Reviewed by:** Security Engineer (bbb8722a-4bd1-4f82-a7f3-cbf3bf484cd7)
**Date:** 2026-03-23
**Scope:** DCP-651 — Template catalog & model API endpoints pre-production security review
**Status:** COMPLETE

---

## Executive Summary

The Sprint 27 template catalog and model API are **cleared for controlled production exposure** with two conditions:

1. **HIGH finding DCP-SEC-001** must be resolved before Jupyter template goes live (weak default Jupyter token).
2. **MEDIUM finding DCP-SEC-003** (image_override enforcement) must be verified at job submission layer before custom/fine-tuning templates go live.

All model catalog read endpoints (`/api/models`, `/api/models/catalog`, etc.) are safe to expose publicly. The `POST /api/models/:model_id/deploy` endpoint correctly requires renter authentication. No critical findings.

---

## Findings Summary

| ID | Severity | Area | Title | Status |
|----|----------|------|-------|--------|
| DCP-SEC-001 | HIGH | Template | Jupyter default token `dc1jupyter` is weak and predictable | Open — file separate issue |
| DCP-SEC-002 | MEDIUM | Template | Containers lack explicit non-root user directive | Open — Dockerfile audit needed |
| DCP-SEC-003 | MEDIUM | Template | `image_override` param not verifiably enforced at job submission | Open — backend validation needed |
| DCP-SEC-004 | MEDIUM | API | No granular API key scopes (renter read vs write vs admin) | Open — roadmap item |
| DCP-SEC-005 | LOW | API | `/api/templates/whitelist` publicly exposes approved image list | Accepted |
| DCP-SEC-006 | LOW | Template | arabic-rag-complete mounts model-cache RW across all containers | Accepted with note |
| DCP-SEC-007 | LOW | Backend | 50MB express body limit creates large-request DoS surface | Accepted |
| DCP-SEC-008 | INFO | API | `POST /api/models/:model_id/deploy` correctly requires renter auth | No action |
| DCP-SEC-009 | INFO | API | Admin token uses timing-safe comparison | No action |
| DCP-SEC-010 | INFO | Template | Approved image allowlist stripped from public API responses | No action |

---

## 1. Template Sandboxing Review

### 1.1 Privileged Mode & Capability Escalation

**All 20 templates reviewed. No `privileged: true` flag found in any template.**
No `cap_add` entries found. No `network_mode: host` entries found.

This is the correct posture. All containers run in the default Docker seccomp profile.

Templates reviewed:
- arabic-embeddings, arabic-reranker, arabic-rag-complete
- custom-container, jupyter-gpu
- llama3-8b, mistral-7b, nemotron-nano, nemotron-super, qwen25-7b
- lora-finetune, qlora-finetune
- ollama, vllm-serve
- pytorch-single-gpu, pytorch-multi-gpu, pytorch-training
- python-scientific-compute, sdxl, stable-diffusion

### 1.2 Volume Mounts — Host Path Exposure

**Only `arabic-rag-complete.json` specifies volume mounts:**

```json
"volumes": ["/opt/dcp/model-cache:/opt/dcp/model-cache"]
```

Applied to embeddings, reranker, and LLM containers (all read/write).

**Assessment:** Acceptable. `/opt/dcp/model-cache` is a controlled DCP directory for pre-fetched model weights, not an arbitrary host path. All three containers need read access to load cached models; only the LLM container needs write access (to save newly downloaded weights).

**Recommendation (LOW — DCP-SEC-006):** Embeddings and reranker containers should mount this volume read-only (`/opt/dcp/model-cache:/opt/dcp/model-cache:ro`) since they only read pre-cached models and never write. This limits blast radius if either container is compromised. The LLM container can retain read-write for weight caching.

All other templates use no volume mounts. Model caching is handled at the `model_cache` config level, which the DC1 daemon translates to controlled mounts at runtime.

### 1.3 Non-Root User Context

**Finding DCP-SEC-002 (MEDIUM):** No template JSON specifies a `user` directive. This means container user context is determined entirely by the Dockerfile `USER` instruction.

Verification required: the `dc1/llm-worker:latest`, `dc1/rag-worker:latest`, `dc1/sd-worker:latest`, `dc1/general-worker:latest`, and `dc1/base-worker:latest` Dockerfiles must set `USER nonroot` or equivalent non-root user. This cannot be confirmed from template JSON alone.

**Action required:** ML Infra / DevOps must confirm that all DC1 worker base images run as non-root. If any image runs as root (UID 0), a container escape vulnerability could give root on the provider host.

### 1.4 Env Var Injection Risk

Templates expose env vars that users can set. Review of all env_var keys:

| Template | Env Vars | Risk |
|----------|----------|------|
| jupyter-gpu | `NOTEBOOK_TOKEN`, `PORT` | **HIGH** — see DCP-SEC-001 |
| vllm-serve | `MODEL_ID`, `MAX_TOKENS`, `TEMPERATURE` | Low — string params, validated at runtime |
| lora-finetune | `BASE_MODEL`, `ADAPTER_RANK`, `MODEL_CACHE_DIR`, `CACHE_POLICY` | Low — path value `MODEL_CACHE_DIR` could be a concern if not sandboxed |
| custom-container | `DOCKER_IMAGE` | Medium — see DCP-SEC-003 |
| arabic-rag-complete | `EMBEDDING_MODEL`, `RERANKER_MODEL`, `LLM_MODEL`, etc. | Low — numeric and string params |

No env vars pass shell commands or raw user input into shell execution contexts in any template.

### 1.5 Finding DCP-SEC-001 (HIGH): Jupyter Weak Default Token

**File:** `docker-templates/jupyter-gpu.json`

```json
{ "key": "NOTEBOOK_TOKEN", "label": "Notebook Access Token", "default": "dc1jupyter", "required": false }
```

The default Jupyter token is `dc1jupyter` — a hardcoded, predictable string that is publicly visible in this repository and in any API response to `GET /api/templates/jupyter-gpu`.

**Risk:** Any provider who deploys a Jupyter notebook without changing the token exposes a full interactive Python environment (with GPU access, network access, and the model cache volume) to anyone who knows the default. An attacker could:
- Run arbitrary Python code on the provider's GPU
- Access cached model weights
- Exfiltrate data processed in prior sessions

**Recommendation:**
- The UI must not pre-fill this field or must warn users to use a strong, unique token.
- The backend job submission layer should reject Jupyter jobs where `NOTEBOOK_TOKEN` matches `dc1jupyter` or is empty.
- Ideally, generate a random UUID token server-side and return it to the renter rather than accepting user-supplied tokens.

**File separate issue for Backend + Frontend fix before Jupyter template goes live.**

### 1.6 Finding DCP-SEC-003 (MEDIUM): image_override Validation

**Affected templates:** `custom-container.json`, `lora-finetune.json`, `pytorch-multi-gpu.json`, `pytorch-single-gpu.json`, `pytorch-training.json`

These templates pass `image_override` as a job param. The template JSON documents an `approved_images` allowlist, and `templates.js` strips `approved_images` from public API responses (security-conscious). However:

**The enforcement question is:** does the job submission handler at `POST /api/jobs/submit` validate `image_override` against the `/api/templates/whitelist` before accepting a job?

If not, a renter could submit a job with `image_override: "attacker/malicious-image:latest"` and the provider would pull and run arbitrary Docker images.

**Action required:** Code Reviewer / Backend Architect must confirm that `backend/src/routes/jobs.js` validates `container_spec.image` or `params.image_override` against the approved whitelist before dispatching to providers. If this validation is absent, it is a critical gap.

---

## 2. Model API Endpoint Authorization Audit

### 2.1 Endpoint Auth Coverage

| Endpoint | Method | Auth Required | Rate Limited | Assessment |
|----------|--------|---------------|--------------|------------|
| `/api/models` | GET | None | Yes (tiered) | OK — public catalog |
| `/api/models/benchmarks` | GET | None | Yes (tiered) | OK — public data |
| `/api/models/cards` | GET | None | Yes (tiered) | OK — public data |
| `/api/models/catalog` | GET | None | Yes (tiered) | OK — public data |
| `/api/models/portfolio-readiness` | GET | None | Yes (tiered) | OK — public data |
| `/api/models/compare` | GET | None | Yes (tiered) | OK — public data |
| `/api/models/:id/deploy/estimate` | GET | None | Yes (tiered) | OK — read-only estimate |
| `/api/models/:id/deploy` | POST | `requireRenter` | Yes (tiered) | OK — auth correct |
| `/api/models/:id` | GET | None | Yes (tiered) | OK — public catalog |
| `/api/templates` | GET | None | General only (300/min/IP) | OK — see note |
| `/api/templates/whitelist` | GET | None | General only (300/min/IP) | See DCP-SEC-005 |
| `/api/templates/:id` | GET | GET | General only (300/min/IP) | OK |

**All write operations requiring renter auth are correctly protected.** Public catalog read operations are correctly public — this is intentional per the marketplace design.

**Rate limiting note:** `/api/templates` uses the general limiter (300 req/min/IP) rather than the tiered limiter used by `/api/models` (100 req/min unauthenticated, 1000/min authenticated). This is acceptable but slightly inconsistent. Consider applying `tieredApiLimiter` to `/api/templates` for consistency.

### 2.2 IDOR Risk Assessment — GET /api/models/:model_id

**No IDOR risk.** The `model_id` parameter is a string slug (e.g., `mistralai/Mistral-7B-Instruct-v0.2`), not an integer database row ID. The lookup is done against a filtered catalog view (`WHERE is_active = 1`). There is no path to access inactive models or other renters' private data through this endpoint.

The `normalizeString(req.params.model_id, { maxLen: 200 })` call correctly truncates oversized inputs before the lookup.

### 2.3 Model Pricing Data — Read-Only Without Auth

Confirmed: all pricing fields (`default_halala_per_min`, `avg_sar_per_min`, etc.) are returned as read-only data. No endpoint allows modification of pricing without admin auth. Model pricing originates from the database (`model_registry.default_price_halala_per_min`) and is read-only from the models route.

### 2.4 requireRenter Implementation — Auth.js Audit

The `requireRenter` middleware in `models.js` is correctly implemented:

```javascript
function requireRenter(req, res, next) {
  const key = getRenterKey(req);
  if (!key) return res.status(401).json({ error: 'Renter API key required' });
  const renter = db.get('SELECT ... FROM renters WHERE api_key = ? AND status = ?', key, 'active');
  if (!renter) return res.status(403).json({ error: 'Invalid or inactive renter API key' });
  req.renter = renter;
  return next();
}
```

- Validates key presence before DB query — correct
- Filters on `status = 'active'` — correct (revoked renters cannot deploy)
- Uses parameterized query (`?`) — no SQL injection risk
- Attaches `req.renter` for downstream handlers — correct

The admin middleware in `auth.js` uses `crypto.timingSafeEqual` for token comparison — correct, no timing oracle risk.

---

## 3. Arabic RAG Template Security Review

### 3.1 Inter-Container Network Isolation

The `arabic-rag-complete.json` deployment uses Docker Compose with four services: `embeddings`, `reranker`, `llm`, `orchestrator`.

**Network isolation:** Docker Compose creates a default bridge network. Services communicate via DNS names (`http://embeddings:8001`, etc.). This traffic is isolated within the compose network — it does not traverse the public internet.

**No credentials between services:** The orchestrator config is:
```json
"EMBEDDINGS_URL": "http://embeddings:8001",
"RERANKER_URL": "http://reranker:8002",
"LLM_URL": "http://llm:8000"
```

Internal service-to-service calls carry no auth tokens. This is acceptable for within-compose communication on a trusted bridge network, provided the bridge network is not exposed. The `depends_on` structure ensures correct startup order.

### 3.2 Embedding Vector Exfiltration

The embeddings service (port 8001) and reranker service (port 8002) are listed in the `ports` mapping but these are container-to-host port bindings. The orchestrator is the user-facing entry point (port 9000).

**Risk:** If ports 8001 and 8002 are bound to `0.0.0.0` (all interfaces) rather than `127.0.0.1`, embedding vectors are directly accessible on the host network — bypassing the orchestrator's access controls and potentially exposing document vectors.

**Recommendation:** Binding should be `127.0.0.1:8001:8001` to limit exposure to localhost. The provider daemon should ensure service ports are not exposed externally. This is an operational control, not a template-level control, so it must be documented in provider deployment guides.

### 3.3 PDPL Data Residency

The template correctly notes in `compliance_and_security`:
- All processing occurs on Saudi infrastructure
- Data retained only during session
- No logs or model fine-tuning on customer data

**However:** these are policy statements, not technical enforcement in the template JSON. The actual PDPL compliance depends on:
1. Provider being physically in Saudi Arabia (verified at provider registration)
2. No data leaving the container except through the DCP API response

There is no outbound network filtering in the template. A compromised model or malicious provider could exfiltrate data. This is inherent to the GPU marketplace model and should be disclosed to enterprise customers.

---

## 4. API Key Scoping Recommendations

### 4.1 Current State

The API uses two key types:
- **Renter API key** (`x-renter-key` header or `?key=` query param): grants all renter operations (job submit, account management, data export, deploy)
- **Provider API key** (`x-provider-key`): grants provider operations
- **Admin token** (`DC1_ADMIN_TOKEN` env var): grants full admin access

There are no sub-scopes within a key type. A compromised renter key allows full renter-level access.

### 4.2 Recommended Scope Model

For the new model/template endpoints, propose the following scopes for a future API key v2:

| Scope | Allows | New Endpoints |
|-------|--------|---------------|
| `catalog:read` | Browse models, templates, pricing | `GET /api/models/*`, `GET /api/templates/*` |
| `jobs:submit` | Submit and manage compute jobs | `POST /api/models/:id/deploy`, `POST /api/jobs/submit` |
| `jobs:read` | View own job status and logs | `GET /api/jobs/:id`, `GET /api/jobs/:id/logs` |
| `account:manage` | Edit account, topup balance | `/api/renters/topup`, account endpoints |
| `data:export` | Export account data (PDPL right) | Rate-limited export endpoints |

**For Sprint 27:** No breaking change needed. Document the scope model in API docs so it can be implemented in a future sprint before enterprise onboarding. File DCP-SEC-004 as a roadmap item.

### 4.3 New Endpoint Scoping (Sprint 27 additions)

For the model catalog and deploy endpoints:
- `GET /api/models/*` — public, no API key required (intentional catalog exposure)
- `GET /api/models/:id/deploy/estimate` — public (pricing info only)
- `POST /api/models/:id/deploy` — requires renter key (existing `requireRenter` middleware, correct)
- `GET /api/templates/*` — public (catalog browsing, consistent with models)
- `GET /api/templates/whitelist` — currently public (see DCP-SEC-005)

### 4.4 Finding DCP-SEC-005 (LOW): Whitelist Endpoint is Public

`GET /api/templates/whitelist` returns the full list of approved Docker images with no authentication. This is currently 9 approved image references.

**Risk:** Low. This information aids an attacker in understanding which images are trusted, but does not directly enable an attack. The approved list includes only public official images (`pytorch/pytorch`, `nvcr.io/nvidia/*`, `tensorflow/tensorflow`) and DC1's own images.

**Recommendation:** Add `requireAdminAuth` or at minimum document that this endpoint is intentionally public. Consider moving whitelist validation to an internal service-to-service call rather than a public HTTP endpoint.

---

## 5. Rate Limiting Review

### 5.1 Current Rate Limits for New Endpoints

| Endpoint Pattern | Limiter | Limit |
|-----------------|---------|-------|
| `/api/models/*` | `tieredApiLimiter` | 100/min unauthenticated (IP), 1000/min authenticated (key) |
| `/api/templates/*` | `generalLimiter` | 300/min per IP (all requests) |

**Finding:** `/api/templates` does not have tiered rate limiting based on API key authentication. Authenticated users get the same 300/min IP-based limit as unauthenticated users.

**Recommendation:** Apply `tieredApiLimiter` to `/api/templates` for consistency with `/api/models`. This would give authenticated renters 1000 req/min and unauthenticated users 100 req/min — preventing catalog scraping while allowing legitimate high-frequency access for authenticated applications.

This is a low-priority operational improvement, not a security blocker.

### 5.2 Catalog Scraping Protection

With `generalLimiter` at 300 req/min per IP and 20 templates in the catalog, a scraper would need ~1 request per template page load. The current limit is sufficient to prevent automated scraping at scale from a single IP, but does not prevent distributed scraping from multiple IPs.

For a GPU marketplace where pricing is the competitive differentiator, this is an acceptable trade-off — the catalog must be browsable to drive conversions. Dedicated anti-scraping measures (Cloudflare bot detection, etc.) would be a separate initiative.

---

## 6. Findings Requiring Separate Issues

The following should be filed as separate Paperclip issues:

### DCP-SEC-001 → New Issue (HIGH)
**Title:** "Security: Enforce strong Jupyter notebook token — reject default dc1jupyter"
**Assignees:** Backend Engineer + Frontend Developer
**Description:** Jupyter template `docker-templates/jupyter-gpu.json` has hardcoded default token `dc1jupyter`. Backend must reject job submissions with this default. Frontend must warn users to change it.

### DCP-SEC-003 → New Issue (MEDIUM)
**Title:** "Security: Verify image_override validation in job submission against approved whitelist"
**Assignees:** Backend Engineer / Code Reviewer
**Description:** `custom-container`, `lora-finetune`, and `pytorch-*` templates pass `image_override` param. Confirm the jobs route validates this against `/api/templates/whitelist` before provider dispatch.

### DCP-SEC-004 → Roadmap Issue (MEDIUM)
**Title:** "Roadmap: Implement API key scopes (catalog:read, jobs:submit, account:manage)"
**Assignees:** Backend Architect
**Description:** Current API uses monolithic renter/provider keys. Propose and implement granular scopes before enterprise onboarding.

---

## 7. Accepted Risks (No Further Action)

| Finding | Rationale |
|---------|-----------|
| DCP-SEC-005: Whitelist endpoint public | Approved images are all public official images; low risk |
| DCP-SEC-006: RAG model-cache RW mount | Scoped to `/opt/dcp/model-cache`, not arbitrary host paths |
| DCP-SEC-007: 50MB body limit | Necessary for base64 image results; existing infra |
| Public model catalog read endpoints | Intentional — catalog must be browsable for marketplace UX |

---

## 8. Cleared Items (No Issues)

- ✅ No `privileged: true` in any template
- ✅ No `network_mode: host` in any template
- ✅ No `cap_add` in any template
- ✅ Admin token uses `crypto.timingSafeEqual` — no timing oracle
- ✅ `requireRenter` uses parameterized SQL — no injection
- ✅ `requireRenter` checks `status = 'active'` — revoked keys blocked
- ✅ `approved_images` stripped from template API responses
- ✅ Model ID IDOR risk assessed: no integer IDs exposed, string slugs only
- ✅ Audit logger sanitizes sensitive fields before logging
- ✅ `normalizeCredential` truncates oversized inputs to 512 chars max
- ✅ No shell execution from env var values in template definitions

---

*Review complete. DCP-651 deliverable.*
