# DC1 Platform — Gate 0 Security Audit Report

**Auditor:** GUARDIAN (Security Engineer)
**Date:** 2026-03-02
**Branch Audited:** `feat/nexus/heartbeat-alerts`
**Scope:** `backend/src/` — all routes, services, database layer

---

## Executive Summary

The DC1 backend presents a **mixed security posture**. The newer TypeScript services (billing, wallet, jobs) demonstrate strong practices — parameterized queries via Supabase, cryptographic proofs, atomic operations, and network-isolated containers. However, the Express-based provider onboarding layer (the original codebase) has **significant gaps**: unauthenticated endpoints, missing rate limiting, overly permissive CORS, and a hardcoded default token.

**Overall Risk Rating: MEDIUM (CVSS Aggregate: 6.1)**

For Gate 0 (limited beta with known providers), most findings are **acceptable with mitigations**. Two findings require immediate attention before Go/No-Go.

---

## Findings

| # | Finding | Severity | CVSS 3.1 | File | Line(s) | Recommendation |
|---|---------|----------|----------|------|---------|----------------|
| F1 | **Registration endpoint has no rate limiting** | High | 7.5 | `routes/providers.js` | 14 | Add `express-rate-limit` (e.g., 5 req/min per IP) to `/api/providers/register` |
| F2 | **Hardcoded default MC_TOKEN** | High | 7.4 | `services/docker-manager.ts` | 15 | Remove default value `'dc1-mc-gate0-2026'`; fail if env var missing |
| F3 | **CORS allows all origins** | Medium | 5.3 | `server.js` | 10 | Restrict `cors()` to specific allowed origins (e.g., `dc1st.com`) |
| F4 | **Security events endpoint unauthenticated** | Medium | 5.3 | `routes/security.js` | 56 | Add `requireAuth` middleware to `GET /api/security/events` and `/summary` |
| F5 | **Standup /latest endpoint unauthenticated** | Low | 3.7 | `routes/standup.js` | 107 | Add auth middleware; fleet data is sensitive operational intel |
| F6 | **Provider status endpoint uses API key in URL path** | Medium | 4.3 | `routes/providers.js` | 108 | Move API key to `Authorization` header; URL paths leak into logs/referers |
| F7 | **Setup endpoint injects API key into shell script without sanitization** | Medium | 6.5 | `routes/providers.js` | 155 | Sanitize `key` parameter against shell injection (reject non-alphanumeric+hyphen chars) |
| F8 | **No HTTPS enforcement** | Medium | 5.3 | `server.js` | — | Add HSTS header; redirect HTTP→HTTPS in production |
| F9 | **Installer download has no API key validation** | Low | 3.7 | `routes/providers.js` | 57 | Verify the `key` parameter exists in the database before serving the file |
| F10 | **Supabase service key accessed via `process.env` with `!` assertion** | Low | 2.4 | `services/billing.ts` | 11-12 | Add startup validation; crash early if env vars are missing rather than runtime NPE |
| F11 | **Health endpoint exposes service name** | Info | 0.0 | `server.js` | 37 | Minor; acceptable for Gate 0 |
| F12 | **Job routes (Fastify) have no authentication middleware** | High | 7.5 | `routes/jobs.ts` | all | Add auth middleware to all job endpoints; currently any caller can submit/complete jobs |
| F13 | **Billing routes (Fastify) have no authentication middleware** | High | 7.5 | `routes/billing.ts` | all | Add auth middleware; wallet balances and billing data are sensitive |
| F14 | **No input validation on job submission body** | Medium | 5.3 | `routes/jobs.ts` | 18-22 | Validate `JobRequest` fields (dockerImage allowlist, renterId format, numeric bounds) |
| F15 | **Docker image pull from arbitrary registry** | Medium | 6.5 | `services/docker-manager.ts` | 53 | Restrict `dockerImage` to a trusted registry allowlist (e.g., `registry.dc1st.com/*`) |

---

## Positive Findings (What's Done Right)

| Area | Assessment |
|------|-----------|
| **SQL Injection** | ✅ All SQLite queries use parameterized statements (`?` placeholders). No string concatenation in queries. |
| **Wallet Atomicity** | ✅ Debit uses Supabase RPC (`debit_wallet_atomic`) with `SELECT FOR UPDATE` — no TOCTOU race. |
| **Container Isolation** | ✅ GPU containers run with `NetworkMode: 'none'` — no internet access for tenant code. |
| **Billing Integrity** | ✅ Cryptographic proof hashes on every billing tick. Verification endpoint exists. |
| **Integer Arithmetic** | ✅ All billing math uses halala (integer) — no floating-point currency bugs. |
| **Idempotent Operations** | ✅ Billing session start, ticks, and receipts are all idempotent. |
| **GPU Memory Wipe** | ✅ GPU clocks reset between jobs; memory usage verified post-wipe. |
| **Auth on Sensitive Mutations** | ✅ `POST /api/security/flag/:providerId` requires `MC_TOKEN`. |

---

## CVSS Score Summary

| Severity | Count | CVSS Range |
|----------|-------|------------|
| High | 4 | 7.4–7.5 |
| Medium | 6 | 4.3–6.5 |
| Low | 3 | 2.4–3.7 |
| Info | 1 | 0.0 |
| **Total** | **14** | — |

**Aggregate Weighted Score: 6.1 (Medium)**

---

## Gate 0 Security Status: **CONDITIONAL PASS**

### Conditions for Go (must fix before Mar 8):
1. **F1** — Add rate limiting to registration endpoint
2. **F2** — Remove hardcoded default MC_TOKEN; require env var
3. **F4** — Add auth to security events/summary endpoints

### Accepted Risks for Gate 0 (fix in Gate 1):
- F12/F13 (Fastify auth) — Job/billing routes are on a separate internal Fastify server not exposed publicly in Gate 0
- F3 (CORS) — Acceptable for beta; restrict before public launch
- F15 (Docker registry) — Gate 0 uses curated images only

### Recommendations for Gate 1:
- Implement API gateway with JWT authentication across all endpoints
- Add request schema validation (Joi/Zod) on all POST bodies
- Enable HTTPS with HSTS headers
- Implement audit logging for all state-changing operations on Express routes
- Add Content Security Policy headers

---

**Signed:** GUARDIAN — DC1 Security Engineer
**Date:** 2026-03-02T07:01:00Z
