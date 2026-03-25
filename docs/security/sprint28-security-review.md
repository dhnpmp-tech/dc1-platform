# DCP Sprint 28 — API Security Review

**Reviewer:** Security Engineer
**Date:** 2026-03-25
**Scope:** All API endpoints ahead of Phase 1 launch (2026-03-26 08:00 UTC)
**Issue:** DCP-964
**Branch:** `security/dcp-sprint28-security-review`

---

## Executive Summary

The DCP backend API is in **good security posture** for Phase 1 launch. No CRITICAL findings were identified. Two MEDIUM findings and two LOW findings are documented below with recommended fixes. None of these block Phase 1 launch, but the MEDIUM findings should be addressed in Sprint 29.

The security foundation is strong:
- All sensitive endpoints require authentication (renter key, provider key, or admin token)
- Timing-safe comparisons used throughout
- HMAC-signed webhooks with replay protection
- SSRF prevention on webhook URL registration
- Global input sanitisation (null bytes, HTML tags stripped)
- Zod strict-mode validation on job submission
- Comprehensive security headers (HSTS, CSP, X-Frame-Options, CORP, COOP, COEP)
- No cross-contamination between renter and provider API keys confirmed

---

## Finding 1: Rate Limit Inconsistency on Job Submission Endpoints

- **Severity:** MEDIUM
- **Endpoint:** `POST /api/jobs/submit`
- **Issue:** The legacy `/api/jobs/submit` endpoint applies an IP-based rate limit of 30 req/min (`jobSubmitLimiter`). The newer `POST /api/jobs/` endpoint applies a renter-keyed limit of 10 req/min (DCP-956). A single renter can use the legacy endpoint to submit jobs at 3× the intended per-renter rate, bypassing the fairness control.
- **Code Location:** `backend/src/middleware/rateLimiter.js` (jobSubmitLimiter vs renter-keyed limits)
- **Recommendation:** Apply the renter-keyed limiter to `POST /api/jobs/submit` as well. Since `requireRenter` runs before the rate check, `req.renter.id` or the renter API key is available as the rate-limit key. Update `jobSubmitLimiter` to use `getRenterKey(req) || ipFallbackKey(req)` and reduce max to 10 req/min to match the new endpoint.
- **Status:** OPEN

---

## Finding 2: CORS Allows Null-Origin (No-Origin) Requests

- **Severity:** LOW
- **Endpoint:** All `/api/*` endpoints
- **Issue:** The CORS handler contains `if (!origin) return callback(null, true)` (`server.js` lines ~83-85). This means any request without an `Origin` header (server-side curl, daemon calls, or specially crafted browser requests with `null` origin in sandboxed iframes) bypasses the origin allowlist. In production, the impact is limited because the endpoints also require API key authentication, but the no-origin bypass could facilitate cross-site attacks if any endpoint is ever made public without authentication.
- **Code Location:** `backend/src/server.js` ~line 83
- **Recommendation:** This is a deliberate choice to support server-to-server calls (provider daemons, scripts). Accept as-is for Phase 1. For a future hardening pass, consider logging no-origin requests at INFO level and evaluating whether a server-only allow-list (by IP or API key type) could replace the blanket bypass.
- **Status:** CONFIRMED-SAFE for Phase 1 (documented for Sprint 29 review)

---

## Finding 3: Model ID Allows `..` Sequences in Zod Schema

- **Severity:** LOW
- **Endpoint:** `POST /api/jobs/submit` (field: `model`), `GET /api/models/:id`
- **Issue:** The Zod schema allows `model` values matching `/^[\w.\-/:@]+$/` — this permits two consecutive dots (`..`). The URL regex on the model detail route (`/^\/([a-zA-Z0-9._/-]+)$/`) also allows dots. At the API layer this is not exploitable because model lookups are performed against an in-memory catalog (no filesystem path construction). However, if a worker node later uses the model string directly in a filesystem path (e.g., to locate a cached model), `..` sequences could cause traversal.
- **Code Location:** `backend/src/schemas/jobs.schema.js` (model regex), `backend/src/routes/models.js` line 1018 (route regex)
- **Recommendation:** Add a pre-validation check to reject model IDs containing `..`: `z.string().refine(v => !v.includes('..'), 'model ID must not contain ..')`. Apply the same check in the models route handler. This is zero-impact on valid HuggingFace IDs (which never contain `..`).
- **Status:** OPEN (low priority, no current exploitation path at API layer)

---

## Finding 4: Admin Token Has No Rotation Mechanism

- **Severity:** LOW
- **Endpoint:** All `/api/admin/*` endpoints
- **Issue:** The `DC1_ADMIN_TOKEN` is a static secret stored as an environment variable with no expiry, no session invalidation, and no rotation workflow. If the token is leaked (e.g., via logs, PM2 env dump), it cannot be revoked without a server restart. The admin audit log captures all actions but cannot retroactively identify whether a leaked token was used.
- **Code Location:** `backend/src/middleware/auth.js` (requireAdminAuth), `backend/src/middleware/adminAuth.js` (requireAdminRbac)
- **Recommendation:** For Sprint 29, implement a token version field so the token can be rotated via env var update + PM2 reload without downtime. For Phase 1, ensure the token is not logged in PM2 output, nginx access logs, or error reporting. The existing timing-safe comparison prevents brute-force attacks.
- **Status:** OPEN (acceptable for Phase 1, hardening recommended pre-public launch)

---

## Audit of All Review Scope Items

### 1. Authentication Gaps

| Endpoint Pattern | Auth Required | Verified |
|---|---|---|
| `/api/renters/me/*` | Renter API key via `requireRenter` | ✅ CONFIRMED-SAFE |
| `/api/providers/me/*` | Provider API key via `apiKeyAuth` | ✅ CONFIRMED-SAFE |
| `/api/admin/*` | `DC1_ADMIN_TOKEN` via `requireAdminRbac` | ✅ CONFIRMED-SAFE |
| `/api/models/*` (GET) | None (public catalog) — intentional | ✅ CONFIRMED-SAFE |
| `/api/templates` (GET) | None (public catalog) — intentional | ✅ CONFIRMED-SAFE |
| `/api/templates/:id/deploy` (POST) | Renter key | ✅ CONFIRMED-SAFE |
| `/api/jobs/submit` | Renter key | ✅ CONFIRMED-SAFE |
| `/api/jobs/` (POST) | Renter key | ✅ CONFIRMED-SAFE |
| `/api/providers/heartbeat` | Provider key | ✅ CONFIRMED-SAFE |
| `/api/webhooks/provider/event` | Provider key + HMAC | ✅ CONFIRMED-SAFE |
| `/api/renters/register` | None (public registration) | ✅ CONFIRMED-SAFE |
| `/api/providers/register` | None (public registration) | ✅ CONFIRMED-SAFE |

No unauthenticated endpoint leaks sensitive renter or provider data. The public endpoints (`/api/models`, `/api/templates`, `/api/renters/register`) are intentionally open for marketplace browsing and onboarding.

### 2. Input Validation

- Global sanitisation strips null bytes and HTML tags from all request bodies and query params (`server.js` lines 168-184). ✅
- Zod strict-mode validation on `POST /api/jobs/submit` via `jobSubmitSchema` — unknown fields are rejected, model IDs are regex-constrained, durations are bounded. ✅
- `env_vars` field is `z.record(z.string(), z.string())` — prevents object injection attacks. ✅
- Job type is whitelisted in the handler (lines 1166-1168). ✅
- GPU type validated against allowed values before scheduler assignment. ✅
- **Finding 3** (model `..` sequences) documented above — LOW severity.

### 3. Rate Limiting Audit

| Endpoint | Limiter Type | Limit | DCP Issue |
|---|---|---|---|
| `POST /api/jobs/submit` | IP-based | 30/min | **Finding 1** — should be renter-keyed |
| `POST /api/jobs/` (create) | Renter-keyed | 10/min | DCP-956 ✅ |
| `POST /api/templates/:id/deploy` | Renter-keyed | 10/min | DCP-956 ✅ |
| `POST /api/providers/heartbeat` | Provider-keyed | 4/min | DCP-855 ✅ |
| `POST /api/providers/register` | IP-based | 5/hour | DCP-855 ✅ |
| `POST /api/renters/register` | IP-based | 5/hour | DCP-855 ✅ |
| `POST /api/admin/*` | Admin-token-keyed | 30/min | DCP-768 ✅ |
| `GET /api/models` | IP-based | 100/min | ✅ |

All inference-path and wallet-affecting endpoints have rate limits. **Finding 1** is the only gap.

### 4. API Key Scoping

- Renter keys (`x-renter-key` header) are validated against the `renters` table with `status = 'active'` check. ✅
- Provider keys (`Authorization: Bearer dcp_prov_*`) are validated against hashed storage in `provider_api_keys` table. ✅
- No cross-access confirmed: renter middleware (`requireRenter`) sets `req.renter` from the renters table only; provider middleware (`apiKeyAuth`) sets `req.provider` from the providers table only. These middleware functions are route-level and cannot be mixed. ✅
- Query param API keys are rejected for all `/api/renters/me`, `/api/renters/analytics`, and `/api/renters/export` routes (DCP-712). ✅

### 5. CORS and Header Security

**CORS** (`server.js` lines 71-119):
- Production origins allowlist: `dcp.sa`, `www.dcp.sa`, `app.dcp.sa`, `api.dcp.sa`. ✅
- Development origins (`localhost:3000`, etc.) only enabled when `NODE_ENV !== 'production'`. ✅
- Additional origins via `CORS_ORIGINS` env var (controlled at deployment time). ✅
- `credentials: true` is set — acceptable since the origin allowlist is tight. ✅
- **Finding 2** (no-origin bypass) documented above — LOW severity, acceptable.

**Security Headers** (`server.js` lines 142-166) — all present and correct:

| Header | Value | Assessment |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `X-Frame-Options` | `DENY` | ✅ |
| `X-XSS-Protection` | `1; mode=block` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | camera, mic, geo, payment all denied | ✅ |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | ✅ |
| `Strict-Transport-Security` | 2-year max-age, includeSubDomains, preload | ✅ (TLS live on api.dcp.sa) |
| `Cross-Origin-Resource-Policy` | `same-origin` | ✅ |
| `Cross-Origin-Opener-Policy` | `same-origin` | ✅ |
| `Cross-Origin-Embedder-Policy` | `require-corp` | ✅ |

### 6. Additional Security Controls Verified

| Control | Status |
|---|---|
| Timing-safe comparison for admin token (crypto.timingSafeEqual) | ✅ |
| Timing-safe comparison for provider API key hash (crypto.timingSafeEqual) | ✅ |
| Provider webhook HMAC-SHA256 with timestamp replay protection (±300s) | ✅ |
| SSRF prevention on renter webhook URL registration (HTTPS-only, public IP DNS validation) | ✅ |
| Raw Python execution prevention on job submission | ✅ |
| Jupyter weak-token rejection (blocklist: `dc1jupyter`, `jupyter`, `password`, etc.) | ✅ |
| Startup process exit if DC1_ADMIN_TOKEN or DC1_HMAC_SECRET are missing/placeholder | ✅ |
| Trust-proxy hardened (explicit hop count, not `true`) | ✅ |
| Auth failure audit logging (all 401/403 logged with method, path, IP, header presence) | ✅ |
| Admin action audit log (fire-and-forget INSERT into admin_audit_log) | ✅ |
| Admin IP allowlist (optional, via ADMIN_IP_ALLOWLIST env var) | ✅ |

---

## Summary of Findings

| # | Title | Severity | Status | Blocks Phase 1? |
|---|---|---|---|---|
| 1 | `/api/jobs/submit` IP-based rate limit inconsistency | MEDIUM | OPEN | NO |
| 2 | CORS no-origin bypass | LOW | CONFIRMED-SAFE (documented) | NO |
| 3 | Model ID allows `..` sequences | LOW | OPEN | NO |
| 4 | Admin token has no rotation mechanism | LOW | OPEN | NO |

**Phase 1 GO decision: ✅ No CRITICAL or HIGH findings. Phase 1 launch is cleared from a security standpoint.**

Recommended Sprint 29 fixes (in priority order):
1. Apply renter-keyed rate limiting to `/api/jobs/submit` (Finding 1)
2. Add `..` rejection to model ID validation (Finding 3)
3. Document an admin token rotation runbook (Finding 4)

---

*Review completed: 2026-03-25 | Next review: Sprint 29 post-Phase 1 hardening*
