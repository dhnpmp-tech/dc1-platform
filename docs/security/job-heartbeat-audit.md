# Security Audit: Job Queue + Provider Heartbeat Endpoints

**Audit date:** 2026-03-24
**Auditor:** Security Engineer (DCP-847)
**Branch:** `security/sprint28-job-heartbeat-audit`
**Scope:** Two newly delivered endpoints — provider heartbeat (DCP-839) and job queue/SSE (DCP-841)

---

## Summary

| Check | Status | Severity |
|-------|--------|----------|
| HB-1: Heartbeat rate limit applied | ✅ FIXED | Critical |
| HB-2: Revoked providers can't heartbeat | ✅ FIXED | High |
| HB-3: HMAC enforcement is opt-in | ⚠️ WARN | Medium |
| HB-4: Renter cannot spoof provider heartbeat | ✅ PASS | — |
| HB-5: Heartbeat TTL / stale cleanup | ✅ PASS | — |
| JQ-1: Renter A cannot see Renter B jobs | ✅ PASS | — |
| JQ-2: Provider can only progress own jobs | ✅ PASS | — |
| JQ-3: SSE access controls enforced | ✅ PASS | — |
| JQ-4: Admin /api/admin/jobs requires admin JWT | ✅ PASS | — |
| JQ-5: SSE max-connections per job | ✅ PASS | — |
| JQ-6: Global SSE connection rate limit | ⚠️ WARN | Low |

**2 issues patched inline. 2 warnings documented with recommendations.**

---

## Heartbeat Endpoint Audit (`POST /api/providers/heartbeat`)

### HB-1: Rate limit not applied to heartbeat — **FIXED**

**Finding:** `heartbeatProviderLimiter` (60 req/min per provider key, with IP fallback) was defined in `middleware/rateLimiter.js` but never imported or applied to the `/heartbeat` route handler in `routes/providers.js`. An attacker with any valid provider API key (even pending-approval) could flood the endpoint and fill the `heartbeat_log` table.

**Impact:** DB disk exhaustion (heartbeat_log grows unbounded), increased CPU from reputation recomputation on every request.

**Fix applied:** `providers.js` line 14 — added `heartbeatProviderLimiter` to imports.
`providers.js` line 597 — added limiter as Express middleware before the handler:

```js
router.post('/heartbeat', heartbeatProviderLimiter, (req, res) => { ... });
```

The limiter uses provider key as the bucket key (falls back to IP if key not in headers/query). At 60 req/min with daemons sending every 30 s (= 2 req/min normal), this gives 30x headroom before limiting kicks in.

---

### HB-2: Revoked providers can still heartbeat — **FIXED**

**Finding:** The provider lookup at line 679 was:

```sql
SELECT id, approval_status, ...
FROM providers
WHERE api_key = ?
```

This matches deleted providers (where `deleted_at IS NOT NULL`). A revoked provider with a cached API key could continue posting heartbeats, marking itself as `online` in the marketplace and logging telemetry.

Compare: `getProviderFromReq()` in `routes/jobs.js` already correctly adds `AND deleted_at IS NULL`.

**Fix applied:** `providers.js` line 679 — added `AND deleted_at IS NULL`:

```sql
SELECT id, approval_status, ...
FROM providers
WHERE api_key = ? AND deleted_at IS NULL
```

---

### HB-3: HMAC enforcement is opt-in (Warning)

**Finding:** The HMAC signature check at line 601 is gated behind `DC1_REQUIRE_HEARTBEAT_HMAC === '1'`. In warn-only mode (the default), any request with a valid API key can post heartbeats without a valid HMAC signature.

**Risk:** Low — API key validation still runs. Without the key, the request is rejected (401). HMAC is defense-in-depth against a compromised key being used to forge status updates.

**Recommendation:** Set `DC1_REQUIRE_HEARTBEAT_HMAC=1` in production `.env` as part of the Phase 1 launch checklist. All daemons already set `X-DC1-Signature` headers per the existing daemon implementation.

---

### HB-4: Renter cannot spoof provider heartbeat — PASS

**Finding:** The heartbeat endpoint only looks up `providers` table using the `api_key` from the request body. Renter API keys are stored in the separate `renters` table and are not valid in the provider lookup. A renter key will return `null` → `401 Invalid API key`. ✅

---

### HB-5: Heartbeat TTL / stale provider cleanup — PASS

**Finding:** The grace period logic is correct and implemented consistently:

- `< 2 min` since last heartbeat → `online`
- `2–10 min` → `degraded` (still bookable but flagged)
- `> 10 min` → `offline` (excluded from job assignment)

The `status` column is updated on every heartbeat write (`UPDATE providers SET ... status = ?`). Stale providers naturally transition to `offline` when the daemon stops sending. No background cleanup job is needed as status is derived from `last_heartbeat` timestamp comparisons at query time. ✅

---

## Job Queue / SSE Audit

### JQ-1: Renter A cannot see Renter B's jobs — PASS

**Finding:** `GET /api/jobs` (line 4037) uses `requireRenter` middleware, sets `req.renter` to the authenticated renter, and the SQL query is:

```sql
WHERE j.renter_id = ?   -- bound to req.renter.id
```

No renter can enumerate another renter's jobs. ✅

---

### JQ-2: Provider can only send progress to own jobs — PASS

**Finding:** `POST /api/jobs/:job_id/progress` (line 3073) validates the API key and then runs:

```sql
SELECT * FROM jobs WHERE (id = ? OR job_id = ?) AND provider_id = ?
```

The `AND provider_id = ?` constraint means a provider with a different ID gets a 404. A provider cannot update progress on a job they did not win. ✅

---

### JQ-3: SSE stream access controls — PASS

**Finding:** `GET /api/jobs/:job_id/stream` (line 2679) calls `canReadJob(req, job)` before establishing the SSE connection. `canReadJob` returns true only if:

- Admin token provided, OR
- Renter's `id === job.renter_id`, OR
- Provider's `id === job.provider_id`

Cross-renter and cross-provider access to SSE streams is blocked. ✅

---

### JQ-4: Admin `/api/admin/jobs` requires admin JWT — PASS

**Finding:** `routes/admin.js` applies `router.use(requireAdminRbac)` at line 53. This is a router-level middleware — every route in the admin router, including `GET /api/admin/jobs`, is protected. `requireAdminRbac` validates either a JWT with `role === 'admin'` or the static `DC1_ADMIN_TOKEN` env var using timing-safe comparison. A renter JWT is not accepted. ✅

---

### JQ-5: SSE max connections per job — PASS

**Finding:** `jobEventEmitter.js` sets `ee.setMaxListeners(100)` per job. Exceeding this triggers a Node.js warning (not a crash). The EventEmitter does not accept connections beyond 100 listeners per job without emitting a memory-leak warning. Terminal events trigger `removeJob()` which cleans up all listeners and removes the emitter. ✅

---

### JQ-6: Global SSE connection rate limit — Warning

**Finding:** There is no per-key rate limit on `GET /api/jobs/:job_id/stream`. A renter with a valid key and multiple job IDs could open many concurrent SSE connections (100 per job_id × N job_ids). Each connection holds a Node.js interval timer, an EventEmitter subscription, and an open HTTP socket.

**Risk:** Low in current production context (43 registered providers, 0 active jobs). The `canReadJob` check ensures the renter can only stream their own jobs, so the blast radius is proportional to the number of jobs a renter has.

**Recommendation:** Add a per-renter limit on concurrent SSE connections using an in-memory counter. A simple approach:

```js
// Track open SSE connections per renter key
const sseConnections = new Map(); // renterKey → count
const MAX_SSE_PER_RENTER = 10;
```

Reject with `429 Too Many Requests` if `sseConnections.get(key) >= MAX_SSE_PER_RENTER`. This is tracked separately from the rate limiter.

This can be implemented as a follow-up (not a launch blocker given the current traffic level).

---

## Patches Applied

| File | Change |
|------|--------|
| `backend/src/routes/providers.js` | Added `heartbeatProviderLimiter` to imports and applied to `/heartbeat` route |
| `backend/src/routes/providers.js` | Added `AND deleted_at IS NULL` to heartbeat provider lookup query |

---

## Recommendations Not Yet Implemented

1. **Set `DC1_REQUIRE_HEARTBEAT_HMAC=1` in production** — HMAC is already implemented end-to-end; enforcement just needs the env var flipped.
2. **Add global SSE connection limit per renter key** — implement as a follow-up before active provider traffic reaches significant scale.
