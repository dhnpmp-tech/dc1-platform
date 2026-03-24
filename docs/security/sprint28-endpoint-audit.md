# Sprint 28 Endpoint Security Audit

**Auditor:** Security Engineer (DCP-786)
**Date:** 2026-03-24
**Branches reviewed:**
- `backend-architect/dcp782-heartbeat-liveness-job-history` (DCP-782)
- `p2p-network-engineer/http-provider-discovery-fallback` (DCP-783)

**Summary:** 3 of 5 endpoints PASS. 2 endpoints FAIL with 2 HIGH findings requiring fixes before merge.

---

## DCP-782 Endpoints

### 1. `POST /api/providers/:id/heartbeat`

**Verdict: PASS**

**Auth:** Provider key validated in a single query: `WHERE id = ? AND api_key = ?`. The provider ID in the URL is bound to the API key — a provider cannot supply a different provider's ID to spoof heartbeats. The query returns `null` if the pairing doesn't match, rejecting with 401.

**Input validation:**
| Field | Bound | Result |
|---|---|---|
| `gpu_utilization` | 0–100 | ✅ |
| `vram_used_mb` / `vram_used` | 0–1,048,576 | ✅ |
| `jobs_active` / `jobs_running` | 0–10,000 | ✅ |
| `uptime_seconds` | min 0, no max | ⚠️ minor |
| provider `:id` | normalizeString maxLen 128 | ✅ |

**Minor (low):** `uptime_seconds` has no upper bound. It is echoed in the response but not persisted to the database, so the risk is negligible. Recommend adding `max: 2147483647` for defensive hygiene.

---

### 2. `GET /api/providers/:id/liveness`

**Verdict: PASS**

**Auth:** Intentionally public — appropriate for a read-only status check used by renters and monitoring tools.

**Data exposure:** Response contains only `provider_id`, `liveness_status` (online/stale/offline), `last_heartbeat` (ISO timestamp), and `heartbeat_age_seconds`. No IP addresses, API keys, GPU specs, or PII.

**Input validation:** Provider ID validated via `normalizeString(req.params.id, { maxLen: 128 })`. Handles non-existent IDs with 404.

**No findings.**

---

### 3. `GET /api/jobs` — Renter job history

**Verdict: PASS**

**Auth:** `requireRenter` middleware enforces authentication via `x-renter-key` header. Validates the key against the `renters` table, requires `status = 'active'`.

**Tenant isolation:** The SQL `WHERE j.renter_id = ?` is bound to `req.renter.id` (set by the auth middleware), **not** to any user-supplied query parameter. A renter has no way to request another renter's jobs.

**Pagination safety:**
- `limit` is capped at `Math.min(..., 200)` — large dump attacks are blocked.
- `offset` validated as non-negative integer via `toFiniteInt`.

**Minor (low):** No per-endpoint rate limiter. A renter with a valid key could poll heavily. Consider adding a `lookupLimiter` consistent with other read endpoints.

---

## DCP-783 Endpoints

### 4. `GET /api/network/providers?available=true`

**Verdict: FAIL**

#### Finding 1 — HIGH: IP address leakage with no authentication

The response map at `backend/src/routes/network.js` includes:
```js
ip_address: row.ip_address,
provider_ip: row.provider_ip,
```

Both fields are returned to **any unauthenticated caller**. This is a public endpoint with no auth middleware.

**Impact:**
- Any internet user can enumerate every registered provider's IP address.
- Providers are vulnerable to targeted DDoS, port scanning, or exploitation of exposed services.
- Competitors can monitor the full provider network.
- The P2P design intentionally uses peer IDs to avoid exposing IPs; this endpoint undermines that.

**Fix:** Remove `ip_address` and `provider_ip` from the response map. These fields serve no renter-facing purpose — renters need GPU specs and availability, not provider IPs.

```js
// Remove these two lines from the providers map:
// ip_address: row.ip_address,
// provider_ip: row.provider_ip,
```

Also remove `ip_address, provider_ip` from the SELECT columns.

#### Finding 2 — LOW: NaN limit not validated

```js
const limit = Math.min(
  req.query.limit ? parseInt(req.query.limit, 10) : 100,
  500
);
```

`parseInt('abc', 10)` returns `NaN`. `Math.min(NaN, 500)` returns `NaN`. Passing `NaN` to SQLite `LIMIT ?` via better-sqlite3 will throw a `TypeError`, causing a 500 response. The error is caught, but it produces a misleading server error for what is actually a bad request.

**Fix:**
```js
const rawLimit = parseInt(req.query.limit, 10);
const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100, 500);
```

---

### 5. `GET /api/network/topology`

**Verdict: FAIL**

#### Finding 1 — MEDIUM: No authentication on admin-only endpoint

The file comment states: _"Network topology health endpoint for admin dashboard."_ However, no auth middleware is applied. Any unauthenticated caller can retrieve:

- `total_registered` — total provider count
- `total_online`, `total_degraded`, `total_offline` — real-time network capacity
- `avg_gpu_utilization` — live compute load
- `avg_reliability_score` — network quality signal
- `recent_heartbeat_count` — provider activity level
- `provider_status_breakdown` — full status distribution

**Impact:** Competitors can monitor DCP network capacity in real-time with a simple polling loop. This is competitively sensitive information that belongs behind the admin token.

**Fix:** Add `requireAdminAuth` middleware:

```js
const { requireAdminAuth } = require('../middleware/auth');

// Change:
router.get('/topology', (req, res) => {
// To:
router.get('/topology', requireAdminAuth, (req, res) => {
```

#### Finding 2 — LOW: SUBSTR on float column may return incorrect averages

```sql
AVG(CAST(SUBSTR(gpu_util_pct, 1, 3) AS FLOAT))
```

`gpu_util_pct` is a float column. For values like `99.5`, `SUBSTR(..., 1, 3)` returns `"99."`, which casts to `99.0` — dropping the decimal. For values `> 99.x`, it works correctly. This is a data accuracy bug; the correct query is:

```sql
AVG(CAST(gpu_util_pct AS FLOAT))
```

Not a security issue, but should be corrected.

---

## Summary Table

| Endpoint | Branch | Verdict | Findings |
|---|---|---|---|
| `POST /api/providers/:id/heartbeat` | DCP-782 | ✅ PASS | minor: uptime_seconds no max |
| `GET /api/providers/:id/liveness` | DCP-782 | ✅ PASS | — |
| `GET /api/jobs` | DCP-782 | ✅ PASS | minor: no rate limit |
| `GET /api/network/providers` | DCP-783 | ❌ FAIL | **HIGH: IP leakage**; LOW: NaN limit |
| `GET /api/network/topology` | DCP-783 | ❌ FAIL | **MEDIUM: no admin auth**; LOW: SUBSTR bug |

## Required fixes before merge (DCP-783)

1. **Remove `ip_address` and `provider_ip` from `GET /api/network/providers` response** — HIGH
2. **Add `requireAdminAuth` to `GET /api/network/topology`** — MEDIUM
3. **Fix NaN limit handling in `GET /api/network/providers`** — LOW (but easy)
4. **Fix SUBSTR averaging in topology query** — LOW
