# DCP API Rate Limits Reference

**Maintained by:** Security Engineer
**Last updated:** 2026-03-24 (DCP-906)
**Source files:** `backend/src/middleware/rateLimiter.js`, `backend/src/server.js`

This is the authoritative reference for all API rate limits. All limiters use `express-rate-limit` with `standardHeaders: true` (RateLimit-* headers) and return HTTP 429 with body:
```json
{ "error": "Rate limit exceeded", "retryAfterSeconds": N, "retryAfterMs": N }
```

Rate limiting is **disabled** in test environments (`DISABLE_RATE_LIMIT=1` or `NODE_ENV=test`).

---

## Authentication Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `POST /api/auth/*` | `authLimiter` | 15 min | 5 | IP |
| `POST /api/renters/login` | `loginLimiter` | 15 min | 10 | IP |
| `POST /api/renters/login-email` | `loginLimiter` | 15 min | 10 | IP |
| `POST /api/providers/login` | `loginLimiter` | 15 min | 10 | IP |
| `POST /api/providers/login-email` | `loginLimiter` | 15 min | 10 | IP |
| `POST /api/admin/login` | `loginLimiter` | 15 min | 10 | IP |
| `POST /api/renters/send-otp` | `loginEmailLimiter` (in-route) | 15 min | 10 | IP |
| `POST /api/renters/verify-otp` | `loginEmailLimiter` (in-route) | 15 min | 10 | IP |

---

## Registration Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `POST /api/providers/register` | `registerLimiter` | 60 min | 5 | IP |
| `POST /api/renters/register` | `registerLimiter` | 60 min | 5 | IP |

---

## Inference / vLLM Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `POST /api/vllm/complete` | `vllmCompleteLimiter` | 1 min | 10 | Renter key or IP |
| `POST /api/vllm/complete/stream` | `vllmStreamLimiter` | 1 min | 5 | Renter key or IP |

---

## Provider Daemon Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `POST /api/providers/heartbeat` | `heartbeatProviderLimiter` | 1 min | 4 | Provider key or IP |
| `POST /api/providers/:id/activate` | `providerActivateLimiter` | 60 min | 3 | Provider key or IP |

The heartbeat ceiling of 4/min allows for 2 normal heartbeats/min plus 2 retry attempts.

---

## Job Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `POST /api/jobs/submit` (legacy) | `jobSubmitLimiter` | 1 min | 30 | IP |
| `POST /api/jobs` (create) | `jobCreateLimiter` | 1 min | 10 | Renter key or IP |
| `POST /api/jobs/:id/retry` | `retryJobLimiter` | 1 min | 3 | Actor+JobID composite |

---

## Marketplace / Browse Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `/api/renters`, `/api/jobs`, `/api/providers` (auth) | `tieredApiLimiter` | 1 min | 1000/key or 200/IP | API key or IP |
| `GET /api/providers` (public) | `publicProvidersLimiter` | 1 min | 60 | IP |
| `/api/models` | `modelCatalogLimiter` | 1 min | 100 | IP |
| `/api/templates`, `/api/containers` | `catalogLimiter` | 15 min | 200 | IP |
| `POST /api/templates/deploy` | `modelDeployLimiter` | 1 min | 20 | API key or IP |

---

## Financial Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `POST /api/renters/topup` | `topupLimiter` | 1 min | 10 | IP |
| `POST /api/payments/topup` | `paymentLimiter` | 1 min | 10 | IP |
| `POST /api/payments/webhook` | `paymentWebhookLimiter` | 1 min | 100 | IP |
| `DELETE /api/renters/me` | `renterAccountDeletionLimiter` | 24 hrs | 1 | Renter key or IP |
| `DELETE /api/providers/me` | `providerAccountDeletionLimiter` | 24 hrs | 1 | Provider key or IP |
| `GET /api/renters/me/export` | `renterDataExportLimiter` | 24 hrs | 1 | Renter key or IP |
| `GET /api/providers/me/export` | `providerDataExportLimiter` | 24 hrs | 1 | Provider key or IP |

---

## Webhook Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `POST /api/renters/:id/webhooks` | `webhookRegistrationLimiter` | 60 min | 10 | Renter key or IP |

---

## Admin Endpoints

| Endpoint | Limiter | Window | Max | Key |
|---|---|---|---|---|
| `GET|POST|PATCH /api/admin/*` | `adminLimiter` | 1 min | 30 | Admin token or IP |

---

## Global Fallback

A general catch-all limiter applies to all `/api/*` requests not matched by a specific limiter:

| Scope | Window | Max | Key |
|---|---|---|---|
| `generalLimiter` (all `/api/*`) | 1 min | 300 | IP |

---

## Key Generation Priority

Rate limiters use keys in this priority order:

1. **Renter API key** (`x-renter-key` header, or `Authorization: Bearer dcp_...`, or `?key=`)
2. **Provider API key** (`x-provider-key` header or `?provider_key=`)
3. **IP address** (fallback via `req.ip` using Express `trust proxy` setting)

For admin endpoints, the admin token hash is used as the key to prevent IP-based bypass by token-holders.

---

## Notes

- **Proxy trust:** `TRUST_PROXY_HOPS` env var (default `0`) controls Express `trust proxy`. Must be set correctly on VPS (nginx = 1 hop) to ensure `req.ip` resolves to the real client IP, not `127.0.0.1`.
- **ADMIN_IP_ALLOWLIST:** Optional env var (comma-separated IPs) for additional IP-level restriction on admin endpoints. When set, non-listed IPs receive 403 before any limiter applies.
- **DCP-855:** Original rate limiting implementation. All limiters above were audited and verified in DCP-875 and DCP-906.
