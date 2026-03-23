# DCP Sprint 25 Security Audit Report

**Date:** 2026-03-23
**Auditor:** Security Engineer (DCP-603)
**Scope:** OWASP Top 10 scan, secrets inventory, HTTPS/TLS verification, CORS/CSP review
**Status:** FINDINGS REQUIRE ACTION BEFORE LAUNCH

---

## Executive Summary

The backend API, auth middleware, rate limiting, and CSP headers are in solid shape. The **P0 blocker is the absence of HTTPS/TLS on api.dcp.sa** — port 443 refuses connections. All API traffic (including API keys and payment data) travels over plaintext HTTP. Two additional medium-severity findings need resolution before retail launch.

---

## Findings

### CRITICAL — C1: No TLS on api.dcp.sa (OWASP A02: Cryptographic Failures)

**Status:** Open
**Risk:** Catastrophic — all API keys, job payloads, and financial data sent in cleartext

Port 443 on `76.13.179.86` returns `Connection refused`. The API is currently served on plain HTTP (port 8083 via nginx proxy on port 80). DNS for `api.dcp.sa` resolves correctly to the VPS but no TLS termination is configured.

**Evidence:**
```
curl -v https://api.dcp.sa
→ connect to 76.13.179.86 port 443 failed: Connection refused
```

**Fix Required:**
1. Install `certbot` and obtain Let's Encrypt cert for `api.dcp.sa`
2. Configure nginx TLS termination on port 443 → proxy to Express on port 8083
3. Add HTTP → HTTPS redirect (301) in nginx
4. Add `Strict-Transport-Security: max-age=63072000; includeSubDomains` to Express responses
5. Rotate all API keys and admin tokens after TLS is live (keys were transmitted in cleartext)

---

### HIGH — H1: Supabase Credentials Hardcoded in Source (OWASP A02)

**File:** `lib/supabase.ts:3-4`

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fvvxqp-qqjszv6vweybvjfpc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fQ3SU27BygDby6WzWkjRtA_lQ3C994x'
```

While Supabase anon keys are designed to be public, hardcoding them as fallbacks means:
- They cannot be rotated without a code deploy
- They are exposed in the git history permanently
- If the project is ever made public, these credentials are in the open

**Fix Required:**
- Remove hardcoded fallbacks; throw an error at startup if env vars are missing
- Rotate the Supabase anon key (in case it has been misused)

---

### MEDIUM — M1: ecosystem.config.js Contains Placeholder Secrets in Git (OWASP A07)

**File:** `backend/ecosystem.config.js:22,27,34,50,58,76`

All secret fields are set to `CHANGE_ME_*` placeholder strings. If a developer provisions the VPS using this file without substituting values, the application runs with predictable, publicly-known "secrets":

```javascript
DC1_ADMIN_TOKEN: 'CHANGE_ME_dc1_admin_token_hex_64',
DC1_HMAC_SECRET: 'CHANGE_ME_openssl_rand_hex_32',
ESCROW_ORACLE_PRIVATE_KEY: 'CHANGE_ME_0x_private_key_for_oracle_wallet',
RESEND_API_KEY: 'CHANGE_ME_resend_api_key',
TELEGRAM_BOT_TOKEN: 'CHANGE_ME_telegram_bot_token',
MOYASAR_WEBHOOK_SECRET: 'CHANGE_ME_moyasar_webhook_secret',
```

**Fix Required:**
- Replace placeholder values with a sentinel like `""` (empty string) that will cause startup failure
- Add a startup guard that checks required env vars and exits with a clear error if any are empty/placeholder
- Document secret generation in ops runbook (already partially done in comments)

---

### MEDIUM — M2: Silent Fake-Success on Provider Registration Failure (OWASP A05)

**File:** `app/api/providers/register/route.ts:27-29`

```typescript
// Mock fallback
return NextResponse.json({ api_key: 'dc1-provider-demo-' + Date.now(), provider_id: 999 });
```

When the backend is unreachable or returns an error, the UI silently receives a fabricated API key and `provider_id: 999`. This:
- Misleads providers into thinking registration succeeded
- The fake key will not authenticate against the real backend
- `provider_id: 999` could collide with a real provider

**Fix Required:**
- Remove the mock fallback entirely; return the backend error status to the client
- Confirm the same fallback exists in `app/api/renters/register/route.ts` and remove it too

---

## Confirmed Secure

| Area | Status | Notes |
|------|--------|-------|
| `/active` and `/queue/:provider_id` auth | ✅ Fixed | Uses `getAuthenticatedActor`, returns 401 if unauthenticated |
| Admin routes auth | ✅ Secure | `router.use(requireAdminAuth)` at top of admin.js |
| SQL injection | ✅ Mitigated | Parameterized queries throughout; dynamic WHERE uses bound params |
| XSS in docs renderer | ✅ Mitigated | `escapeHtml()` called before `dangerouslySetInnerHTML` |
| CORS lockdown | ✅ Secure | Allowlist-only: `dcp.sa`, `www.dcp.sa`, env-injected extras |
| CSP headers | ✅ Secure | `default-src 'none'; frame-ancestors 'none'` on all API responses |
| Rate limiting | ✅ Implemented | Heartbeat (4/min), login (10/15min), general (300/min) |
| Timing-safe token compare | ✅ Secure | `crypto.timingSafeEqual` used in `auth.js` |
| Path traversal in downloads | ✅ Mitigated | Installer file chosen from allowlist map, not from user input |
| Input sanitization | ✅ Implemented | HTML strip + null-byte removal on all string inputs |

---

## OWASP Top 10 Coverage

| # | Category | Status | Finding |
|---|----------|--------|---------|
| A01 | Broken Access Control | ✅ OK | Scoped auth on all routes; IDOR checked |
| A02 | Cryptographic Failures | 🔴 FAIL | C1: No TLS; H1: Hardcoded creds |
| A03 | Injection | ✅ OK | Parameterized SQL throughout |
| A04 | Insecure Design | ⚠️ WARN | M2: Fake registration response |
| A05 | Security Misconfiguration | ⚠️ WARN | M1: Placeholder secrets in config |
| A06 | Vulnerable Components | ℹ️ Not audited | Run `npm audit` — out of scope for this sprint |
| A07 | Auth & Session Failures | ✅ OK | Timing-safe compare; rate-limited logins |
| A08 | Software & Data Integrity | ✅ OK | HMAC job signing in place |
| A09 | Logging & Monitoring | ✅ OK | Audit log service sanitizes sensitive fields |
| A10 | SSRF | ✅ OK | Outbound requests to fixed endpoints only |

---

## Priority Fix Order

1. **C1 — TLS on api.dcp.sa** (launch blocker — do this first)
2. **M1 — Startup guard for placeholder secrets** (prevents operator error)
3. **H1 — Remove hardcoded Supabase fallback** (rotation + code fix)
4. **M2 — Remove fake registration fallback** (correctness + security)
5. **Post-launch** — Add `npm audit` to CI pipeline

---

## Secrets Rotation Checklist (after TLS is live)

- [ ] `DC1_ADMIN_TOKEN` — generate: `openssl rand -hex 32`
- [ ] `DC1_HMAC_SECRET` — generate: `openssl rand -hex 32`
- [ ] `MOYASAR_WEBHOOK_SECRET` — rotate in Moyasar dashboard
- [ ] `ESCROW_ORACLE_PRIVATE_KEY` — generate new wallet, transfer funds
- [ ] `RESEND_API_KEY` — rotate in Resend dashboard
- [ ] `TELEGRAM_BOT_TOKEN` — regenerate via BotFather
- [ ] Supabase anon key — rotate in Supabase dashboard, update Vercel env vars
- [ ] All provider `api_key` values — notify providers; mass-rotate via admin endpoint
