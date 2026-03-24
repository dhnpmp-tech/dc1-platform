# DCP Pre-Launch Security Audit Report

**Audit Date:** 2026-03-24
**Auditor:** Security Engineer (DCP-724)
**Scope:** `backend/src/` — middleware, routes, services, db layer
**Method:** Code review + pattern analysis
**Overall Rating:** 🟢 **STRONG — 8.5 / 10**
**Verdict:** Platform is production-ready with two High-priority gaps to address before accepting public traffic.

---

## 1. Completed Hardening (What Has Been Fixed)

### DCP-712 — API Key Moved from URL Params to Auth Headers
- **Status:** ✅ DONE (merged, CR1 approved)
- **Change:** Renter cost dashboard and analytics endpoints migrated from `?key=` to `X-Renter-Key` header
- **Evidence:** `server.js` lines 144–185 actively detect and reject keys in query parameters on renter-facing endpoints (`/api/renters/me`, `/api/renters/analytics`, `/api/renters/export`)
- **Timing-safe comparison:** `crypto.timingSafeEqual()` used throughout `auth.js` — no timing oracle

### DCP-713 — Rate Limiting on All Public Endpoints
- **Status:** ✅ DONE (merged, CR2 approved)
- **Tiered limits in place:**

| Endpoint Class | Limit | Window |
|---|---|---|
| Registration | 5 requests | 10 min per IP |
| Login / Auth | 10 requests | 15 min per IP |
| Job Submission | 10 requests | 1 min per API key |
| Provider Heartbeat | 60 requests | 1 min per key |
| Marketplace / Catalog | 60 requests | 1 min per API key |
| Admin | 30 requests | 1 min per token |
| Financial (top-up, payment) | 10 requests | 1 min per IP |
| Webhook delivery | 100 requests | 1 min per IP |
| General API | 300 requests | 1 min per IP |

- **Implementation:** `express-rate-limit` with in-memory store; tiered rates apply dynamically

### DCP-699 / DCP-700 — Provider Activation Script Hardening
- **Status:** ✅ DONE (8 vulnerabilities fixed)
- Provider authentication uses database-scoped keys with `status = 'active'` checks on every request
- Provider routes protected by `requireProvider` middleware with parameterized SQL lookups

### DCP-708 — Template Container Sandboxing Spec
- **Status:** ✅ SPEC COMPLETE (`docs/security/template-sandboxing-review-sprint27.md`)
- Image whitelist endpoint implemented: `GET /api/templates/whitelist` returns approved image refs
- Per-template `approved_images` field validated at route level

### DCP-722 — Webhook HMAC-SHA256 Validation
- **Status:** ✅ DONE (merged, latest commit `576decc`)
- **Provider → Platform webhooks** (`/api/webhooks/*`):
  - Signature: `X-DCP-Signature: sha256=<hex>` (64 hex chars validated by regex)
  - Replay prevention: `X-DCP-Timestamp` header must be within ±300 seconds
  - HMAC key: provider's `api_key` from database (already scoped per provider)
  - Comparison: `crypto.timingSafeEqual()` — no timing oracle
- **Platform → Renter webhooks** (job completion callbacks):
  - Signature: HMAC-SHA256(payload_json, `DC1_HMAC_SECRET`)
  - Retry: exponential backoff (1 s, 2 s, 4 s)
- **Test coverage:** `webhook-hmac.test.js` covers valid, invalid, missing, replayed, and tampered payloads

---

## 2. Current Security Strengths

| Area | Finding |
|---|---|
| SQL Injection | All queries use parameterized `better-sqlite3` — no string concatenation |
| XSS | Input sanitization strips null bytes and HTML tags on all string fields |
| Security Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `HSTS`, `CSP: default-src 'none'` |
| Renter Isolation | All job queries explicitly filter `WHERE renter_id = ?` — no IDOR risks found |
| Admin Auth | `requireAdminAuth` with timing-safe token comparison; `DC1_ADMIN_TOKEN` startup guard rejects placeholder values |
| CORS | Origin whitelist (`dcp.sa`, `www.dcp.sa`, env-configured extras); no wildcards on credentialed routes; OpenAPI docs endpoint permits `*` (appropriate) |
| Secrets Management | No hardcoded secrets; required env vars (`DC1_ADMIN_TOKEN`, `DC1_HMAC_SECRET`) validated at startup — server exits if missing or placeholder |
| Financial Safety | Moyasar tokenized payments; no raw card data stored server-side |
| Key Format | Renter keys: `dc1-renter-` prefix + 128-bit random hex; provider keys scoped to database row |

---

## 3. Remaining Risks Before Launch

### 3a. Template Image Whitelist — Advisory Only (not enforced server-side)

- **Issue:** The `GET /api/templates/whitelist` endpoint returns approved images, but the **server does not reject job submissions with unapproved images**. Enforcement depends entirely on the provider daemon, which could be modified or bypassed by a malicious provider.
- **Attack vector:** Compromised or rogue provider runs arbitrary container images, exfiltrating renter data or attacking internal network.
- **Current mitigation:** Daemon enforces whitelist; providers are trusted parties under agreement.
- **Gap:** Server-level enforcement is missing.

### 3b. Webhook URL TOCTOU (Time-of-Check to Time-of-Use)

- **Issue:** Webhook URLs are validated as public IPs at registration time. If DNS resolves to a private IP only at delivery time (DNS rebinding), callbacks could reach internal services.
- **Attack vector:** Renter registers `webhook.attacker.com` pointing to a public IP, then updates DNS to `192.168.x.x` before job completes. Platform delivers callback to internal service.
- **Current mitigation:** Initial URL validation rejects private IP ranges.
- **Gap:** IP is not re-checked at delivery time.

### 3c. Provider Key Rotation — No User-Facing API

- **Issue:** Providers cannot rotate their own API keys. The `api_key_rotations` table and rotation logic exist in code (max 3 rotations per 24 hours), but no endpoint is exposed.
- **Risk:** Compromised provider key cannot be remediated without admin intervention. Delay during incident response.
- **Current mitigation:** Admin can rotate keys manually via `DC1_ADMIN_TOKEN`-gated endpoints.

### 3d. Admin Endpoints — No IP Restriction

- **Issue:** Admin routes are token-authenticated but accept requests from any IP. A leaked `DC1_ADMIN_TOKEN` gives full admin access from anywhere.
- **Current mitigation:** Token-based auth with timing-safe comparison; token must be present in env var at startup.
- **Gap:** No network-layer defense-in-depth (IP allowlist or VPN requirement).

### 3e. Heartbeat HMAC — Warn-Only Mode by Default

- **Issue:** `DC1_REQUIRE_HEARTBEAT_HMAC` defaults to warn-only. Providers can omit HMAC signatures on heartbeat payloads without being rejected.
- **Risk:** Heartbeat spoofing (fake provider status updates) until strictness is enabled.
- **Current mitigation:** Flag exists; can be enabled without code change.

### 3f. Docker Image Digest Pinning — Tags Allowed

- **Issue:** Template `approved_images` entries can use mutable tags (e.g., `pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime`). Tags can be redirected to different content.
- **Risk:** Supply chain attack if Docker Hub image is compromised and tag updated.
- **Current mitigation:** Whitelist prevents arbitrary images; only approved repos are listed.
- **Gap:** Digest pinning (`image@sha256:...`) is not enforced.

---

## 4. Recommendations by Risk Level

### Critical — Must Fix Before Accepting Public Traffic

None identified. Platform meets baseline security requirements for launch.

### High — Fix Within First 30 Days of Launch

| ID | Issue | Remediation | Effort |
|---|---|---|---|
| SEC-H1 | Template image whitelist not server-enforced | On `POST /api/jobs` and `/api/jobs/estimate`, validate submitted image ref against whitelist before persisting | 4 h |
| SEC-H2 | Webhook URL TOCTOU / DNS rebinding | Re-resolve webhook URL to IP at delivery time; reject if resolved IP falls in RFC 1918 / loopback ranges | 2 h |

### Medium — Fix Within Q2 2026

| ID | Issue | Remediation | Effort |
|---|---|---|---|
| SEC-M1 | No provider key rotation API | Expose `POST /api/providers/me/rotate-key` (rate-limited to 3/24h, already gated in code) | 3 h |
| SEC-M2 | Admin endpoints open to all IPs | Add `ADMIN_IPS` allowlist env var; reject non-matching IPs before token check | 1 h |
| SEC-M3 | CORS rejections not alerted | Aggregate `[cors] Blocked origin` log events; alert on > 10/min sustained | 2 h |

### Low — Q3 Backlog

| ID | Issue | Remediation | Effort |
|---|---|---|---|
| SEC-L1 | Heartbeat HMAC warn-only | Set `DC1_REQUIRE_HEARTBEAT_HMAC=1` in production env | 0 h (config only) |
| SEC-L2 | Docker image tags mutable | Require `@sha256:` digest in approved_images for Tier A production templates | 2 h |
| SEC-L3 | Rate limit alerting | Alert on sustained 429 storms (> 50 rejections/min) to detect credential stuffing | 2 h |

---

## 5. OWASP Top 10 Assessment

| Risk | Status | Notes |
|---|---|---|
| A01 Broken Access Control | ✅ Pass | Renter isolation enforced; admin routes gated; no IDOR found |
| A02 Cryptographic Failures | ✅ Pass | HMAC-SHA256, timing-safe comparison, HSTS, no plaintext secrets |
| A03 Injection | ✅ Pass | Parameterized queries only; input sanitization in place |
| A04 Insecure Design | ⚠️ Partial | Template enforcement relies on daemon (SEC-H1); webhook TOCTOU (SEC-H2) |
| A05 Security Misconfiguration | ⚠️ Partial | Heartbeat HMAC warn-only; admin IP restriction absent |
| A06 Vulnerable Components | ℹ️ Not assessed | Dependency audit (`npm audit`) not run as part of this review |
| A07 Auth Failures | ✅ Pass | Login rate-limited; key format validated; startup secrets guard |
| A08 Software Integrity Failures | ⚠️ Partial | Image digest pinning not enforced (SEC-L2) |
| A09 Logging Failures | ✅ Pass | Auth failures logged with IP/method/path |
| A10 SSRF | ⚠️ Partial | Webhook URL validated at registration; TOCTOU gap at delivery (SEC-H2) |

---

## 6. Compliance Notes

- **PDPL (Saudi Personal Data Protection Law):** No cross-renter data leakage paths identified; renter data scoped by authenticated `renter_id` on all queries. Compliant posture.
- **PCI DSS:** Moyasar integration uses tokenized payments. No card data stored server-side. No PCI scope on DCP backend.
- **SOC 2 Readiness:** Audit logging in place; admin auth strong. Missing: automated alerting for anomalous events (SEC-M3), formal secrets rotation process (SEC-M1).

---

## 7. Recommended Pre-Launch Checklist for Founder Sign-Off

- [x] API keys transmitted via headers, not URL params (DCP-712)
- [x] Rate limiting on all public endpoints (DCP-713)
- [x] Webhook payloads HMAC-signed with replay prevention (DCP-722)
- [x] Admin routes protected by timing-safe token comparison
- [x] Renter isolation enforced at SQL query level (no IDOR)
- [x] CORS whitelist configured for `dcp.sa` domains
- [x] Security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- [x] No hardcoded secrets; startup validation rejects placeholder values
- [x] Parameterized SQL queries throughout (no injection risk)
- [ ] Server-side template image whitelist enforcement (SEC-H1 — schedule within 30 days)
- [ ] Webhook delivery IP re-validation (SEC-H2 — schedule within 30 days)
- [ ] `DC1_REQUIRE_HEARTBEAT_HMAC=1` set in production env (SEC-L1 — config change, zero effort)

---

*This report was produced via code review of `backend/src/`. Runtime penetration testing and dependency vulnerability scanning (`npm audit`, Snyk) are recommended as a follow-up before reaching 100 active providers.*
