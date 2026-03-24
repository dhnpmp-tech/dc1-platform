# Phase 1 Security Sign-Off

**Report Date:** 2026-03-24
**Auditor:** Security Engineer (DCP-929)
**Sprint:** Sprint 28
**Audience:** Founder / Phase 1 Launch Decision

---

## Executive Summary

- **Overall Posture: AMBER — PROCEED WITH CONDITIONS**
  All critical and high-severity findings from Sprint 28 have been resolved or mitigated. No
  showstopper blocks Phase 1 testing with known testers. Two conditions must be satisfied
  before Phase 1 goes live; one additional finding (SSRF in DCP-922) must be resolved before
  the vLLM proxy merges.

- **Open Risks (mitigated):**
  Legacy provider API key plaintext storage (post-launch 30-day fix), heartbeat HMAC opt-in
  (config-only change, set before first live provider), and DCP-922 endpoint_url SSRF (must
  fix before DCP-922 merges — see Finding V-01 below).

- **Recommendation: PROCEED** with Phase 1 under controlled conditions — known testers only,
  max 10 providers, no real-money transactions until escrow is deployed.

---

## Phase 1 Launch Conditions

| # | Condition | Action Required | Owner |
|---|-----------|-----------------|-------|
| C1 | Set `DC1_REQUIRE_HEARTBEAT_HMAC=1` in production before first provider goes active | Env var change on VPS | Founder / DevOps |
| C2 | DCP-922 must include SSRF validation on `vllm_endpoint_url` before merge | See Finding V-01 below | Backend Architect (DCP-922) |

Both conditions are low-effort. C1 is a one-line env change; C2 is a URL validation guard
(~10 lines) already described in Finding V-01 below.

---

## What Was Audited — Sprint 28 Scope

| Issue | Work | Outcome |
|-------|------|---------|
| DCP-896 | Provider registration audit | ✅ PASS — all registration fields validated, no injection vectors |
| DCP-901 | Smart contract audit — Escrow, ProviderStake, JobAttestation | ✅ PASS — no critical findings; reentrancy, integer overflow, and access control all reviewed |
| DCP-906 | JWT hardening — Express + Fastify servers | ✅ 2 medium findings in Fastify fixed (DCP-908) |
| DCP-908 | Fastify JWT algorithm pinning + expiry enforcement | ✅ FIXED — HS256 pinned, 24h expiry enforced (commit a9692af) |
| DCP-912 | Heartbeat auth + EB-M01 idempotency fix | ✅ FIXED — INSERT OR IGNORE, HMAC validation added (merge a4d0d4e) |
| DCP-915 | OWASP Top 10 + CORS audit | ✅ 2 findings fixed — billing rate 25%→15%, CORS wildcard on /api/docs removed (commit 0a77309) |
| DCP-919 | Incident response runbook + pre-launch checklist | ✅ DONE — runbook committed to docs/security/ |
| DCP-924 | Automated security regression test suite | ✅ DONE — 31 tests committed (commit e981648) |
| DCP-929 | vLLM proxy security review (this report) | ✅ REVIEWED — 1 finding (V-01), SSRF risk documented |

---

## Sprint 28 Security Coverage Matrix

| Surface | Status | Notes |
|---------|--------|-------|
| Renter authentication | ✅ PASS | Scoped API keys, scope checking, expiry, master key fallback |
| Provider authentication | ✅ PASS | HMAC heartbeat, key-based auth, rate-limited registration |
| Admin endpoints | ✅ PASS | Admin JWT required; topology endpoint now gated |
| JWT (Fastify) | ✅ PASS | HS256 pinned, 24h expiry enforced (DCP-908) |
| Heartbeat idempotency | ✅ PASS | INSERT OR IGNORE prevents duplicate session records (DCP-912) |
| Rate limiting | ✅ PASS | vLLM complete + stream, heartbeat, registration all rate-limited |
| Input validation — job submission | ✅ PASS | normalizeString / toFiniteInt / toFiniteNumber guards throughout |
| SQL injection | ✅ PASS | Parameterized queries only; no user input in column names |
| CORS | ✅ PASS | Strict allowlist; wildcard on /api/docs removed |
| Security headers | ✅ PASS | HSTS, CSP, X-Frame-Options, X-Content-Type-Options all present |
| Billing arithmetic | ✅ PASS | Platform fee corrected to 15%; atomic debit transaction |
| Smart contracts | ✅ PASS | No critical findings; access control and overflow reviewed |
| Provider IP leakage | ✅ PASS | ip_address field not returned to unauthenticated callers |
| SSRF — vLLM proxy (DCP-922) | ⚠️ OPEN | See Finding V-01 — loopback/RFC 1918 not blocked yet |
| Heartbeat HMAC enforcement | ⚠️ WARN | Code ready; `DC1_REQUIRE_HEARTBEAT_HMAC=1` not set on VPS (Condition C1) |
| Legacy provider key plaintext | ⚠️ DEFER | Post-launch 30-day fix; no live providers yet, window is open |
| npm audit | ℹ️ DEFERRED | Recommended before 100-provider milestone |

---

## Finding V-01 — SSRF Risk in vLLM Proxy (DCP-922) — MUST FIX BEFORE MERGE

**Severity:** HIGH
**Status:** OPEN — DCP-922 not yet merged; fix required before merge
**Surface:** `POST /api/providers/heartbeat` → `vllm_endpoint_url` stored in providers table
**Attack scenario:** A malicious provider registers `http://127.0.0.1:8083/api/admin/...`
or `http://169.254.169.254/latest/meta-data/` as their `vllm_endpoint_url`. When a renter
calls `/api/vllm/complete`, the backend fetches that URL — giving the attacker access to
internal-only endpoints or cloud metadata.

**Evidence:** `backend/tests/dcp-922-vllm-inference-proxy.test.js` test 1 stores
`http://127.0.0.1:<port>` without rejection. Test 2 only rejects non-HTTP scheme
(`not-a-valid-url`), not loopback or RFC 1918 addresses.

**Required fix** — add to heartbeat URL validation (in `routes/providers.js` where
`vllm_endpoint_url` is persisted):

```js
function isSafeProviderEndpoint(url) {
  let parsed;
  try { parsed = new URL(url); } catch (_) { return false; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  // Block loopback
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  // Block RFC 1918 private ranges
  const privateRanges = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./];
  if (privateRanges.some((r) => r.test(host))) return false;
  // Block link-local (AWS/cloud metadata)
  if (/^169\.254\./.test(host)) return false;
  return true;
}
```

Replace the current URL validation in the heartbeat handler with `isSafeProviderEndpoint()`.
Also remove the test assertion that accepts `127.0.0.1` endpoints in test 1 (or move those
tests to use a non-loopback address / localhost bypass in test-only env).

**Acceptable interim:** For Phase 1 with no live providers, SSRF is not exploitable — but
the fix is required before DCP-922 merges so it does not reach main unguarded.

---

## Open Items — Acceptable for Phase 1 (Fix Within 30 Days of Launch)

| Risk | Severity | Current Mitigation | Deadline |
|------|----------|--------------------|----------|
| Legacy `providers.api_key` plaintext storage | HIGH | No live providers; admin can rotate if key exposed | 30 days post-launch |
| Template image whitelist advisory-only | MEDIUM | Provider daemon enforcement; whitelist prevents arbitrary images | 30 days post-launch |
| Webhook URL TOCTOU / DNS rebinding at delivery time | MEDIUM | URL validated at registration | 30 days post-launch |
| No self-service provider key rotation | MEDIUM | Admin rotation endpoint available | Q2 2026 |
| Admin endpoints: no IP allowlist | LOW | Token-based auth + timing-safe comparison | Q2 2026 |

---

## Not Audited (Post-Phase-1 Scope)

- **VPS server hardening** — SSH key rotation, firewall rules, fail2ban — DevOps scope
- **TLS/cert management** — Let's Encrypt already live on api.dcp.sa; auto-renewal configured
- **DDoS protection** — CloudFlare to be configured post-seed round
- **npm audit** — dependency CVE scan; recommended before 100-provider milestone
- **Penetration testing** — full external pentest recommended before public launch

---

## OWASP Top 10 — Phase 1 Assessment

| Risk | Status | Notes |
|------|--------|-------|
| A01 Broken Access Control | ✅ PASS | Renter isolation at SQL level; admin routes gated; provider-renter separation enforced |
| A02 Cryptographic Failures | ✅ PASS | HMAC-SHA256, timing-safe comparison, HSTS, JWT algorithm pinned |
| A03 Injection | ✅ PASS | Parameterized queries; input length-bounded; GPU type allowlisted |
| A04 Insecure Design | ⚠️ PARTIAL | Template image enforcement advisory-only; webhook TOCTOU deferred |
| A05 Security Misconfiguration | ⚠️ PARTIAL | Heartbeat HMAC warn-only (Condition C1); admin IP allowlist not configured |
| A06 Vulnerable Components | ℹ️ DEFERRED | `npm audit` before 100-provider milestone |
| A07 Auth Failures | ✅ PASS | Rate-limited auth; key format validated; startup secrets guard active |
| A08 Software Integrity Failures | ⚠️ PARTIAL | Image digest pinning not enforced; whitelist is current mitigation |
| A09 Logging Failures | ✅ PASS | Auth failures logged with IP/method/path; audit trail on key usage |
| A10 SSRF | ⚠️ OPEN | vLLM proxy endpoint_url (Finding V-01) must be fixed before DCP-922 merge |

---

## Phase 1 Operating Conditions

Phase 1 is safe to execute under all of the following constraints (these match the task brief):

1. **Known testers only** — no public sign-ups, no anonymous access
2. **Max 10 providers** — limit blast radius; legacy key issue not exploitable at this scale
3. **No real-money transactions** — escrow deferred; no financial risk until wallet funded
4. **Heartbeat HMAC enabled** (`DC1_REQUIRE_HEARTBEAT_HMAC=1`) before first provider goes active
5. **DCP-922 SSRF fix merged** before the vLLM proxy routing code goes live

---

## Launch Recommendation

**PROCEED** — Phase 1 testing may begin once Conditions C1 and C2 are satisfied.

The platform has no open critical vulnerabilities. The two conditions are configuration-level
(C1) and a small code change in an in-progress PR (C2). All Sprint 28 security deliverables
are complete and merged. The regression test suite (31 tests) provides ongoing coverage.

The one honest gap is that **0 providers are currently active** — the legacy key and
heartbeat HMAC risks are only exploitable once real providers connect. That window is open
and the mitigations must land before Phase 1 onboards its first active provider.

---

*Produced by: Security Engineer (bbb8722a) — DCP-929*
*Sprint 28 audit trail: DCP-896, DCP-901, DCP-906, DCP-908, DCP-912, DCP-915, DCP-919, DCP-924*
*Prior sign-off context: docs/security/pre-launch-sign-off.md*
