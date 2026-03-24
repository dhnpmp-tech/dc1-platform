# Pre-Launch Security Checklist

**Compiled:** 2026-03-24
**Author:** Security Engineer
**Task:** DCP-795
**Scope:** Consolidates DCP-786 (auth audit), DCP-777 (job dispatch security), DCP-781 (job submission validation), and all Sprint 27–28 security work
**Status Key:** ✅ DONE | ⚠️ TODO | 🔵 DEFERRED | ❌ CRITICAL BLOCKER

---

## How to Use This Checklist

This document is the single source of truth for DCP launch security readiness. Each item includes:
- Current status
- Evidence / location
- Owner for any remaining work
- Priority for items not yet done

Review before activating any real provider or accepting any real payment.

---

## Section 1: Authentication & Authorization

### 1.1 Provider Authentication

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 1.1.1 | Provider API key entropy ≥ 128 bits | ✅ DONE | `apiKeyService.js`: 190-bit base62 key | — |
| 1.1.2 | Provider keys hashed at rest (not plaintext) | ⚠️ PARTIAL | New `provider_api_keys` table: hashed ✅; legacy `providers.api_key` column: plaintext ❌ | Backend Architect |
| 1.1.3 | Timing-safe key comparison | ✅ DONE | `crypto.timingSafeEqual()` in `apiKeyService.js` and `auth.js` | — |
| 1.1.4 | Key revocation supported | ✅ DONE | `revoked_at` timestamp in `provider_api_keys` | — |
| 1.1.5 | Provider self-service key rotation | 🔵 DEFERRED | No endpoint yet; admin-only rotation available. Track: SEC-M1 | Backend Architect |
| 1.1.6 | Legacy key consumers migrated to new key system | ⚠️ TODO | `settlement.js`, `payouts.js`, `verification.js`, `webhookHmac.js` still use plaintext legacy key | Backend Architect |
| 1.1.7 | API key not transmitted in URL query params | ✅ DONE | `server.js` lines 144–185: actively detects and rejects keys in query params | — |
| 1.1.8 | API key transmitted in Authorization header (not body) | ⚠️ PARTIAL | Heartbeat sends key in request body; all other endpoints use headers | Backend Architect |

### 1.2 Renter Authentication

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 1.2.1 | Renter API key entropy adequate | ✅ DONE | `dc1-renter-` prefix + 128-bit hex | — |
| 1.2.2 | Scoped keys supported (inference / admin scopes) | ✅ DONE | `renter_api_keys` table with `scopes` JSON array | — |
| 1.2.3 | Scoped key expiration enforced | ✅ DONE | `expires_at` checked in `requireRenter()` middleware | — |
| 1.2.4 | Scope validation on inference endpoints | ✅ DONE | `vllm.js` `requireRenter()` checks for "inference" or "admin" scope | — |
| 1.2.5 | IDOR prevention on renter resources | ✅ DONE | All job queries: `WHERE renter_id = ?` with authenticated renter ID | — |

### 1.3 Admin Authentication

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 1.3.1 | Admin token validated at startup | ✅ DONE | `server.js` startup guard: exits if `DC1_ADMIN_TOKEN` missing or `CHANGE_ME_*` | — |
| 1.3.2 | Timing-safe admin token comparison | ✅ DONE | `secureTokenEqual()` in `auth.js` | — |
| 1.3.3 | Admin endpoints IP-restricted | 🔵 DEFERRED | No IP allowlist; token-only auth. Track: SEC-M2 | DevOps |
| 1.3.4 | Admin API key excluded from provider list responses | ✅ DONE | `admin.js` line 663: `api_key` intentionally excluded | — |

---

## Section 2: Input Validation & Injection Prevention

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 2.1 | SQL injection — parameterized queries throughout | ✅ DONE | `better-sqlite3` prepared statements; no string concatenation found | — |
| 2.2 | HTML/script injection stripped from all string inputs | ✅ DONE | `server.js` lines 128–144: strips `<tags>` and null bytes from all `req.body` and `req.query` | — |
| 2.3 | JSON depth limiting / large payload rejection | ✅ DONE | Express `json({ limit: '1mb' })` with type check | — |
| 2.4 | Model name validation before inference dispatch | ✅ DONE | DCP-781: model name allowlisted against catalog before dispatch | — |
| 2.5 | Job container spec validation | ✅ DONE | DCP-777: `container_spec` validated at submission time | — |
| 2.6 | Provider hostname / IP sanitized in heartbeat | ✅ DONE | Heartbeat handler normalizes and length-caps all string fields | — |
| 2.7 | Webhook URL validation (private IP range rejection) | ✅ DONE | RFC 1918/loopback ranges rejected at registration | — |
| 2.8 | Webhook URL re-validated at delivery (DNS rebinding) | 🔵 DEFERRED | IP not re-checked at delivery time. Track: SEC-H2 | Backend Architect |
| 2.9 | Template image whitelist enforced server-side | ⚠️ TODO | Whitelist endpoint exists but server does not reject unapproved images at job submission. Track: SEC-H1 | Backend Architect |

---

## Section 3: Rate Limiting & Abuse Prevention

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 3.1 | Provider registration rate-limited | ✅ DONE | `registerLimiter`: 5/10min per IP | — |
| 3.2 | Provider login / OTP rate-limited | ✅ DONE | `loginEmailLimiter`: 10/15min per IP | — |
| 3.3 | Provider heartbeat rate-limited | ✅ DONE | `heartbeatProviderLimiter`: 60/min per provider key | — |
| 3.4 | Inference (vLLM) rate-limited | ✅ DONE | 10/min sync, 5/min streaming, per renter key | — |
| 3.5 | Job submission rate-limited | ✅ DONE | `jobSubmitLimiter`: 30/min per IP | — |
| 3.6 | Job retry rate-limited | ✅ DONE | `retryJobLimiter`: 3/min per job | — |
| 3.7 | Admin API rate-limited | ✅ DONE | `adminLimiter`: 30/min | — |
| 3.8 | Benchmark submission rate-limited | ⚠️ TODO | No rate limiter on `POST /api/providers/benchmark-submit`. Track: RL-1 | Backend Architect |
| 3.9 | Public provider list rate-limited | ⚠️ TODO | No rate limiter on `GET /api/providers/available`. Track: RL-2 | Backend Architect |
| 3.10 | Rate limit headers returned (client backoff support) | ✅ DONE | `standardHeaders: true` on all limiters | — |

---

## Section 4: Transport & Network Security

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 4.1 | TLS / HTTPS on api.dcp.sa | ✅ DONE | Let's Encrypt cert valid through 2026-06-21; nginx → port 8083 | — |
| 4.2 | HSTS header set | ✅ DONE | `Strict-Transport-Security: max-age=63072000; includeSubDomains` | — |
| 4.3 | CORS origin allowlist (no wildcards on credentialed routes) | ✅ DONE | `dcp.sa`, `www.dcp.sa` only; no wildcard on auth routes | — |
| 4.4 | Security response headers set | ✅ DONE | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `CSP: default-src 'none'`, `Permissions-Policy` | — |
| 4.5 | Proxy trust configured (no IP spoofing via X-Forwarded-For) | ✅ DONE | `trust proxy` set to explicit hop count via `TRUST_PROXY_HOPS` env var | — |

---

## Section 5: Cryptographic Integrity

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 5.1 | Webhook HMAC-SHA256 signature validation | ✅ DONE | DCP-722: `X-DCP-Signature` header + replay window ±300s | — |
| 5.2 | Webhook replay prevention (timestamp check) | ✅ DONE | `X-DCP-Timestamp` validated within ±300s | — |
| 5.3 | HMAC secret validated at startup | ✅ DONE | `server.js` startup guard: exits if `DC1_HMAC_SECRET` missing or placeholder | — |
| 5.4 | Heartbeat HMAC validation enforced | ⚠️ TODO | `DC1_REQUIRE_HEARTBEAT_HMAC` defaults to warn-only. Enable before provider activation. Track: SEC-M3 | DevOps |
| 5.5 | Docker image digest pinning (supply chain) | 🔵 DEFERRED | Tags allowed in template whitelist; digest pinning not enforced. Track: SEC-L1 | ML Infra |

---

## Section 6: GPU Isolation & Container Security

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 6.1 | Template container image allowlist | ✅ DONE | DCP-708: `GET /api/templates/whitelist` returns approved image refs | — |
| 6.2 | Server-side enforcement of container image allowlist | ⚠️ TODO | See item 2.9 above — whitelist advisory-only. Track: SEC-H1 | Backend Architect |
| 6.3 | Template sandboxing spec documented | ✅ DONE | `docs/security/template-sandboxing-review-sprint27.md` | — |
| 6.4 | GPU resource limits per container | 🔵 DEFERRED | Spec written; enforcement depends on provider daemon version | ML Infra |
| 6.5 | Inter-container network isolation | 🔵 DEFERRED | Daemon-enforced; not server-validated | DevOps |

---

## Section 7: Billing Integrity

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 7.1 | Per-token metering verified end-to-end | ✅ DONE | DCP-757: 26/26 verification checks pass (schema, vLLM route, token tracking, billing, balance deduction) | — |
| 7.2 | Job settlement records created for all completed jobs | ✅ DONE | DCP-780: `job_settlements` table with gross/fee/payout split | — |
| 7.3 | Platform fee calculation correct (15% blended) | ✅ DONE | `settlement.js`: `platform_fee = floor(gross * 0.15)` | — |
| 7.4 | Renter balance deducted before job dispatch | ✅ DONE | Balance check + deduction in pre-dispatch validation | — |
| 7.5 | Settlement locked to specific job/provider/renter triple | ✅ DONE | `job_settlements` has UNIQUE constraint on `job_id` | — |
| 7.6 | Audit log for all financial operations | ✅ DONE | `auditService.ts` with sanitized logging | — |
| 7.7 | Moyasar raw card data never stored | ✅ DONE | Tokenized payment only; no PAN on server | — |
| 7.8 | Financial endpoints use new hashed key system | ⚠️ TODO | `settlement.js` and `payouts.js` use legacy plaintext `api_key`. See PKS-2 | Backend Architect |

---

## Section 8: Secrets & Configuration

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 8.1 | No hardcoded secrets in codebase | ✅ DONE | `docs/security/secrets-scan-results.md` confirms clean scan | — |
| 8.2 | Required secrets validated at startup | ✅ DONE | `server.js`: exits on missing or `CHANGE_ME_*` values | — |
| 8.3 | Environment variables documented | ✅ DONE | `backend/src/config.js` and `ecosystem.config.js` with documented env vars | — |
| 8.4 | `.env` files excluded from git | ✅ DONE | `.gitignore` includes `.env*` | — |

---

## Section 9: Logging & Monitoring

| # | Item | Status | Evidence | Owner |
|---|---|---|---|---|
| 9.1 | Audit log for admin actions | ✅ DONE | `admin_audit_log` table via migration 003 | — |
| 9.2 | Sensitive fields redacted from audit logs | ✅ DONE | `auditService.ts` sanitizes `api_key`, `password`, `token` fields | — |
| 9.3 | Provider heartbeat audit trail | ✅ DONE | `heartbeat_log` table records every heartbeat with GPU telemetry | — |
| 9.4 | Failed authentication attempts logged | ✅ DONE | Auth middleware returns 401 with structured error; captured by Express logger | — |
| 9.5 | Rate limit breaches logged | ✅ DONE | `express-rate-limit` logs via standard Express error handler | — |
| 9.6 | Security alerting on anomalous access patterns | 🔵 DEFERRED | No automated alerting; manual log review only | DevOps |

---

## Summary: Launch Readiness by Section

| Section | Status | Blockers |
|---|---|---|
| 1. Auth & Authorization | 🟡 PARTIAL | PKS-1/PKS-2: legacy plaintext keys in financial flows |
| 2. Input Validation | 🟡 PARTIAL | SEC-H1: image whitelist not server-enforced |
| 3. Rate Limiting | 🟡 PARTIAL | RL-1: benchmark-submit unprotected; RL-2: provider list unprotected |
| 4. Transport & Network | ✅ READY | None |
| 5. Cryptographic Integrity | 🟡 PARTIAL | Heartbeat HMAC in warn-only mode |
| 6. GPU Isolation | 🟡 PARTIAL | Server-side image enforcement missing |
| 7. Billing Integrity | 🟡 PARTIAL | Financial routes use legacy plaintext keys |
| 8. Secrets & Config | ✅ READY | None |
| 9. Logging & Monitoring | ✅ READY | No automated alerting (deferred) |

---

## Critical Path Before Provider Activation

These items **must** be resolved before the first real provider processes a real job:

1. **PKS-1 + PKS-2** — Migrate legacy plaintext `api_key` consumers to new hashed key system
   - Owner: Backend Architect
   - Effort: 10–14 hours
   - Blocks: provider settlement, payouts, webhook verification

2. **SEC-H1** — Enforce container image whitelist on job submission server-side
   - Owner: Backend Architect
   - Effort: 4 hours
   - Blocks: prevents rogue provider running arbitrary images

3. **RL-1** — Add rate limit to benchmark-submit endpoint
   - Owner: Backend Architect
   - Effort: 1 hour
   - Blocks: benchmark score integrity

4. **SEC-M3 (Heartbeat HMAC)** — Enable strict HMAC enforcement (`DC1_REQUIRE_HEARTBEAT_HMAC=true`)
   - Owner: DevOps
   - Effort: 30 minutes (config change + daemon release)
   - Blocks: heartbeat spoofing protection

**Total remaining effort for critical path: ~20 hours**

---

## Deferred Items (Post-Launch Roadmap)

| ID | Item | Target | Priority |
|---|---|---|---|
| SEC-M1 | Provider self-service key rotation endpoint | Sprint 29 | Medium |
| SEC-M2 | Admin endpoint IP restriction | Sprint 29 | Medium |
| SEC-H2 | Webhook DNS rebinding re-check at delivery | Sprint 29 | High |
| SEC-L1 | Docker image digest pinning | Q2 2026 | Low |
| SEC-L2 | Redis-backed rate limit store for horizontal scale | Q3 2026 | Low |
| SEC-L3 | Automated security alerting | Q2 2026 | Low |
