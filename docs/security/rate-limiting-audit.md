# Rate Limiting Audit

**Audit Date:** 2026-03-24
**Auditor:** Security Engineer
**Task:** DCP-795
**Scope:** All Express rate limiters applied to `/api/vllm/complete`, `/api/jobs`, `/api/providers`, and adjacent endpoints
**Overall Rating:** 🟢 **STRONG — 8 / 10** — Comprehensive coverage with two gaps to address

---

## 1. Inventory of Existing Rate Limiters

Source: `backend/src/middleware/rateLimiter.js` and `backend/src/server.js`

### 1.1 Global Application Limiters (`server.js`)

| Endpoint Prefix | Limiter | Window | Max | Key | Status |
|---|---|---|---|---|---|
| `/api/providers/register` | `registerLimiter` | 10 min | 5 | IP | ✅ Applied |
| `/api/renters/register` | `registerLimiter` | 10 min | 5 | IP | ✅ Applied |
| `/api/auth` | `authLimiter` | 15 min | 10 | IP | ✅ Applied |

### 1.2 Per-Route Limiters (`rateLimiter.js`)

| Limiter | Window | Max Requests | Key Generator | Applied To |
|---|---|---|---|---|
| `registerLimiter` | 10 min | 5 | IP | Provider + renter registration |
| `heartbeatProviderLimiter` | 1 min | 60 | Provider key or IP | `POST /api/providers/heartbeat` |
| `jobSubmitLimiter` | 1 min | 30 | IP | `POST /api/jobs/submit` |
| `marketplaceLimiter` | 1 min | 60 | Renter/provider key or IP | Marketplace browse |
| `vllmCompleteLimiter` | 1 min | 10 | Renter key or IP | `POST /api/vllm/complete` |
| `vllmStreamLimiter` | 1 min | 5 | Renter key or IP | `POST /api/vllm/complete-stream` |
| `retryJobLimiter` | 1 min | 3 | Actor + job_id | `POST /api/jobs/:job_id/retry` |
| `renterAccountDeletionLimiter` | 24 hrs | 1 | Renter key or IP | Account deletion |
| `providerAccountDeletionLimiter` | 24 hrs | 1 | Provider key or IP | Provider deletion |
| `renterDataExportLimiter` | 24 hrs | 1 | Renter key or IP | Data export |
| `adminLimiter` | 1 min | 30 | Admin token or IP | All admin routes |
| `authLimiter` | 15 min | 10 | IP | Auth endpoints |
| `catalogLimiter` | 15 min | 200 | IP | Public catalog |
| `authenticatedEndpointLimiter` | 1 min | 1000 | API key or IP | General authenticated routes |

### 1.3 Local (Route-File) Limiters

| File | Limiter | Window | Max | Applied To |
|---|---|---|---|---|
| `routes/providers.js` | `loginEmailLimiter` | 15 min | 10 | `send-otp`, `verify-otp`, `login-email` |
| `routes/renters.js` | `loginEmailLimiter` | 15 min | 10 | `send-otp`, `verify-otp`, `login-email` |

---

## 2. Endpoint-by-Endpoint Assessment

### 2.1 `/api/vllm/complete` and `/api/vllm/complete-stream`

| Property | Value | Assessment |
|---|---|---|
| Limiter | `vllmCompleteLimiter` / `vllmStreamLimiter` | ✅ Applied |
| Window / Max | 1 min / 10 (sync), 1 min / 5 (stream) | ✅ Appropriate for inference workloads |
| Key | Renter key or IP | ✅ Per-customer isolation |
| Bypass risk | None identified | ✅ |
| Gap | No per-model limits | 🟡 LOW — a renter could exhaust all 10 tokens on large models |

**Recommendation:** Consider model-aware limits for H100/H200 class workloads (e.g., 2 concurrent streams on 70B+ models). Low priority for initial launch.

### 2.2 `/api/jobs`

| Endpoint | Limiter | Window / Max | Key | Assessment |
|---|---|---|---|---|
| `POST /api/jobs/submit` | `jobSubmitLimiter` | 1 min / 30 | IP | ✅ Applied |
| `POST /api/jobs/:id/retry` | `retryJobLimiter` | 1 min / 3 per job | Actor + job_id | ✅ Scoped to individual job |
| `GET /api/jobs/:id/status` | `authenticatedEndpointLimiter` | 1 min / 1000 | API key | ✅ Applied (generous) |
| `GET /api/jobs/:id/logs` | `authenticatedEndpointLimiter` | 1 min / 1000 | API key | ✅ Applied |
| `GET /api/jobs/:id/cost` | `authenticatedEndpointLimiter` | 1 min / 1000 | API key | ✅ Applied |

**Note:** `jobSubmitLimiter` keys on IP, not renter API key. A shared IP (e.g., NAT) could hit the limit on behalf of multiple tenants. Consider adding renter-key keying as secondary limiter.

### 2.3 `/api/providers`

| Endpoint | Limiter | Window / Max | Key | Assessment |
|---|---|---|---|---|
| `POST /api/providers/register` | `registerLimiter` | 10 min / 5 | IP | ✅ Applied (server.js) |
| `POST /api/providers/send-otp` | `loginEmailLimiter` | 15 min / 10 | IP | ✅ Applied |
| `POST /api/providers/verify-otp` | `loginEmailLimiter` | 15 min / 10 | IP | ✅ Applied |
| `POST /api/providers/login-email` | `loginEmailLimiter` | 15 min / 10 | IP | ✅ Applied |
| `POST /api/providers/heartbeat` | `heartbeatProviderLimiter` | 1 min / 60 | Provider key or IP | ✅ Applied |
| `POST /api/providers/benchmark-submit` | **Not found** | — | — | 🔴 GAP |
| `GET /api/providers/available` | **Not found** | — | — | 🟡 GAP |
| `GET /api/providers/installer` | **Not found** | — | — | 🟡 GAP |
| Provider key list/revoke endpoints | **Not found** | — | — | 🟡 GAP (future, once exposed) |

---

## 3. Gaps Identified

### Gap 1 — `POST /api/providers/benchmark-submit` has no rate limit (HIGH)

**Finding:** The benchmark submission endpoint is unauthenticated or lightly authenticated and has no rate limiter applied.

**Risk:** An attacker who obtains a valid provider API key could:
- Flood benchmark submissions, consuming DB write capacity
- Submit fraudulent benchmark scores to inflate GPU tier ratings
- Cause DoS on the benchmark evaluation pipeline

**Recommended limit:** `benchmarkSubmitLimiter` — 3 requests per 10 minutes per provider key

```javascript
const benchmarkSubmitLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: req => {
    const key = req.body?.api_key || req.headers['x-provider-key'] || req.ip;
    return `benchmark:${key}`;
  },
  message: { error: 'Benchmark submission rate limit exceeded. Max 3 per 10 minutes.' }
});
```

**Effort:** 1 hour

### Gap 2 — `GET /api/providers/available` has no rate limit (MEDIUM)

**Finding:** The public endpoint listing available GPU providers has no rate limiter.

**Risk:**
- Competitor scraping of provider capacity and GPU availability at high frequency
- DDoS amplification: a large JSON response body repeated at rate could exhaust bandwidth
- Provider enumeration by automated scanners

**Recommended limit:** `catalogLimiter` is already defined (200 req / 15 min per IP) — apply it to this endpoint, consistent with model catalog.

**Effort:** 30 minutes (one middleware line)

### Gap 3 — `GET /api/providers/installer` has no rate limit (LOW)

**Finding:** The installer download endpoint has no rate limit, only a query-param key check.

**Risk:** Repeated downloads inflate bandwidth costs. Minimal security risk as this is a static file.

**Recommended limit:** Simple `catalogLimiter` or a dedicated download limiter (5 per hour per IP).

**Effort:** 30 minutes

---

## 4. Rate Limit Values Assessment

### Are existing limits appropriate?

| Limiter | Current Limit | Assessment | Recommendation |
|---|---|---|---|
| `vllmCompleteLimiter` | 10/min per renter | ✅ Appropriate — prevents runaway inference spend | No change |
| `vllmStreamLimiter` | 5/min per renter | ✅ Conservative — good for launch | No change |
| `heartbeatProviderLimiter` | 60/min per provider | ✅ Allows 1 heartbeat/second — more than enough | No change |
| `jobSubmitLimiter` | 30/min per IP | ⚠️ Slightly high for launch — consider 10/min with renter-key keying | Reduce to 10/min at launch; increase post-load testing |
| `registerLimiter` | 5/10min per IP | ✅ Tight enough to block mass registration abuse | No change |
| `loginEmailLimiter` | 10/15min per IP | ✅ Standard brute-force protection | No change |
| `adminLimiter` | 30/min per admin token | ✅ Sufficient for ops use | No change |
| `authenticatedEndpointLimiter` | 1000/min per API key | ⚠️ Very permissive — set to match real expected traffic | Reduce to 300/min at launch |

### Provider key keying on heartbeat

The `heartbeatProviderLimiter` keys on the provider's API key when present, falling back to IP. This is correct:
- Prevents a single compromised key from flooding heartbeats
- IP fallback catches unauthenticated/pre-auth probes

---

## 5. Implementation Quality

### Rate Limit Response Headers

All limiters use `standardHeaders: true` with:
- `RateLimit-Limit` — max allowed in window
- `RateLimit-Remaining` — remaining requests
- `RateLimit-Reset` — epoch time when window resets
- `Retry-After` — seconds until retry allowed

**Assessment:** ✅ Clients can implement proper backoff without guessing.

### Store Configuration

Current implementation uses the **in-memory store** (default for `express-rate-limit`).

**Implication:** Rate limit counters are per-process and per-node. If the backend runs as multiple PM2 workers or scales horizontally, each worker maintains its own counter — limits are multiplied by worker count.

**Current deployment:** Single-process PM2 on VPS — in-memory is acceptable for now.

**Recommendation for scale:** When traffic justifies horizontal scaling, switch to `rate-limit-redis` store. No code change required beyond store initialization.

### Key Generator Quality

Most limiters use a consistent pattern:
```javascript
keyGenerator: req => {
  const key = extractProviderKey(req) || req.headers['x-renter-key'] || req.ip;
  return `limiter-name:${key}`;
}
```

Namespaced keys prevent counter collisions across different limiters. ✅

---

## 6. Recommendations Summary

| ID | Finding | Severity | Effort | Owner |
|---|---|---|---|---|
| RL-1 | `benchmark-submit` has no rate limit | 🔴 HIGH | 1 h | Backend Architect |
| RL-2 | `providers/available` has no rate limit | 🟡 MED | 30 min | Backend Architect |
| RL-3 | `providers/installer` has no rate limit | 🟢 LOW | 30 min | Backend Architect |
| RL-4 | `jobSubmitLimiter` keys on IP only (not renter key) | 🟢 LOW | 1 h | Backend Architect |
| RL-5 | `authenticatedEndpointLimiter` at 1000/min is very permissive | 🟢 LOW | 15 min | Backend Architect |
| RL-6 | In-memory store for multi-process deployments | 🟢 LOW (future) | 4 h when scaling | DevOps |

---

## 7. What Is Already Strong

- ✅ 14 distinct rate limiters covering all sensitive endpoint categories
- ✅ Auth endpoints (OTP, login) at 10/15min — blocks credential stuffing
- ✅ Provider heartbeat keyed to provider API key — per-provider isolation
- ✅ Inference endpoints (vLLM) tightly limited — protects provider capacity and renter billing
- ✅ Account deletion and data export limited to 1/day — prevents abuse
- ✅ Standard response headers enable proper client backoff
- ✅ Namespaced key generators prevent cross-limiter counter collisions
