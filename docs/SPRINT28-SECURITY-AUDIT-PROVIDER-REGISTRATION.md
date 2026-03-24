# Sprint 28 Security Audit — Provider Registration & API Key Scoping

**Issue:** DCP-896
**Branch:** security/dcp-896-provider-reg-audit
**Auditor:** Security Engineer (bbb8722a)
**Date:** 2026-03-24
**Files reviewed:** `backend/src/routes/providers.js`, `backend/src/routes/renters.js`, `backend/src/middleware/auth.js`, `backend/src/routes/admin.js`, `backend/src/db.js`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2 | ✅ Fixed in this PR |
| HIGH     | 2 | ⚠️ Documented — env/arch change needed |
| MEDIUM   | 3 | ℹ️ Accepted risk / follow-up ticket |
| LOW      | 1 | ℹ️ Accepted risk |

---

## Findings

### F-001 — CRITICAL: Unauthenticated API Key Retrieval via `/login-email`

| Field | Value |
|-------|-------|
| File | `backend/src/routes/providers.js` L435–461 |
| CVE class | CWE-287: Improper Authentication |
| Exploitability | Trivial — any attacker knowing a provider email |

**Description:**
`POST /api/providers/login-email` returned the full provider API key with only an email address as the credential. No password, OTP, or any challenge was required. An attacker who can enumerate or guess provider email addresses (e.g. from public registration forms, provider directory, or phishing) could retrieve valid API keys and impersonate providers.

```bash
# Before fix — attacker retrieves key with email only
curl -X POST https://api.dcp.sa/api/providers/login-email \
  -H "Content-Type: application/json" \
  -d '{"email": "victim@provider.com"}'
# Response: { "api_key": "dc1-provider-...", ... }
```

**Fix applied (this PR):**
Route now returns HTTP 410 Gone with instructions to use the OTP flow (`/send-otp` + `/verify-otp`). The OTP flow, implemented in a prior sprint, is the correct authentication mechanism and is unaffected.

---

### F-002 — CRITICAL: API Key Exposed in URL Path (`/status/:api_key`)

| Field | Value |
|-------|-------|
| File | `backend/src/routes/providers.js` L1252 (original) |
| CVE class | CWE-598: Information Exposure Through Query Strings in GET Request; CWE-312: Cleartext Storage |
| Exploitability | Passive — logs, browser history, Referer headers |

**Description:**
`GET /api/providers/status/:api_key` embedded the provider's API key directly in the URL path. This causes the key to appear in:
- nginx/Express access logs (e.g. `GET /api/providers/status/dc1-provider-abc123 200`)
- Browser address bar and history
- HTTP Referer headers sent to third-party resources
- Sentry/Datadog request traces

**Fix applied (this PR):**
Route signature changed to `GET /api/providers/status` with key read from `x-provider-key` header or `?key=` query param (consistent with all other provider endpoints). A `deleted_at IS NULL` guard was also added.

```bash
# After fix — key in header, not URL
curl https://api.dcp.sa/api/providers/status \
  -H "x-provider-key: dc1-provider-abc123"
```

**Migration note:** Any daemon or UI code calling `/status/:api_key` must update to the new form. The old path will return 404.

---

### F-003 — HIGH: API Keys Stored Plaintext in SQLite

| Field | Value |
|-------|-------|
| File | `backend/src/db.js` L44 (`api_key TEXT`) |
| CVE class | CWE-312: Cleartext Storage of Sensitive Information |
| Exploitability | Requires DB file access — high impact if achieved |

**Description:**
Provider and renter API keys are stored as plaintext strings in the SQLite database (`api_key` column in both `providers` and `renters` tables). If an attacker gains read access to the DB file (e.g. via a path traversal, misconfigured backup, or VPS compromise), all ~43 registered provider keys and all renter keys are immediately usable.

**No fix applied in this PR** — hashing keys requires a DB migration and daemon updates (daemons submit the raw key in heartbeat bodies; the backend would need to hash on receipt and compare). This is a Sprint 29 task.

**Recommended remediation:**
1. Hash stored keys: `api_key_hash = SHA-256(key)`, store hash; keep `api_key_prefix` (first 8 chars) for display.
2. On lookup: hash the submitted key and compare against `api_key_hash`.
3. Rotate all existing keys after migration.

**Tracking:** Create DCP ticket: "Hash provider/renter API keys at rest"

---

### F-004 — HIGH: Heartbeat HMAC Enforcement Disabled by Default

| Field | Value |
|-------|-------|
| File | `backend/src/routes/providers.js` L595–608 |
| CVE class | CWE-306: Missing Authentication for Critical Function |
| Exploitability | Any party with a valid (or guessed) provider API key |

**Description:**
The heartbeat endpoint validates an HMAC-SHA256 signature via the `X-DC1-Signature` header. However, enforcement is controlled by the `DC1_REQUIRE_HEARTBEAT_HMAC` env var which defaults to warn-only (not enforced). An attacker with a valid provider API key can submit arbitrary GPU telemetry, uptime metrics, and cached model lists without the correct HMAC. This allows:
- Spoofing GPU availability to attract renter jobs
- Inflating reputation scores
- Spoofing cached model state

```js
// providers.js L599-608: enforcement gated on env var
const requireHmac = process.env.DC1_REQUIRE_HEARTBEAT_HMAC === '1';
if (!hmacResult.valid) {
    if (requireHmac) { return res.status(401)... }
    // else: warn and allow through
}
```

**No code fix in this PR** — enabling enforcement requires `DC1_HMAC_SECRET` to be set on the VPS and daemon to be updated to sign requests. Changing this unilaterally would break all existing daemons.

**Recommended remediation:**
1. Set `DC1_HMAC_SECRET` on VPS (founder approval required per deployment policy).
2. Update daemon to sign heartbeat bodies.
3. Set `DC1_REQUIRE_HEARTBEAT_HMAC=1` after daemon rollout.

---

### F-005 — MEDIUM: Provider ID Uses `Math.random()` (Not Cryptographically Secure)

| Field | Value |
|-------|-------|
| File | `backend/src/routes/providers.js` L329 |
| CVE class | CWE-338: Use of Cryptographically Weak PRNG |
| Exploitability | Low — limited attack surface |

**Description:**
Provider IDs are generated as:
```js
'prov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
```
`Math.random()` is not cryptographically secure. An attacker who knows a provider's approximate registration timestamp could attempt to enumerate IDs. In practice, most authenticated endpoints use the API key (not provider ID) for lookup, limiting exposure.

**Recommendation:** Replace with `crypto.randomBytes(8).toString('hex')` for the random suffix.
**No fix in this PR** — low exploitability, non-critical, defer to Sprint 29.

---

### F-006 — MEDIUM: Provider API Keys Accepted on Renter-Scoped Endpoints

| Field | Value |
|-------|-------|
| File | `backend/src/routes/providers.js` L3440–3450 |
| CVE class | CWE-863: Incorrect Authorization |
| Exploitability | Low — provider can see renter-visible marketplace data |

**Description:**
`GET /api/providers/active` (the marketplace provider listing) accepts either a renter or provider API key as auth. This means provider tokens have read access to renter-facing endpoints. While the data returned (list of available providers) is not sensitive, cross-role token acceptance is an architectural smell that could expand in attack surface as more endpoints are added.

**Recommendation:** Introduce explicit role checking — renter-facing endpoints should only accept renter keys, and vice versa. Token prefix (`dc1-renter-` vs `dc1-provider-`) can be used for fast pre-check before DB lookup.
**No fix in this PR** — requires endpoint-by-endpoint audit; Sprint 29 scope.

---

### F-007 — MEDIUM: Account Deletion Accepts API Key in Query String

| Field | Value |
|-------|-------|
| File | `backend/src/routes/providers.js` L4209 |
| CVE class | CWE-598 (same as F-002) |
| Exploitability | Passive — logs only; requires attacker to already have the key |

**Description:**
`DELETE /api/providers/me` accepts the provider key via `req.query.key`. This means the API key appears in server access logs as part of the URL. However, since this is a DELETE request (not typically cached) and the attacker must already possess the key to exploit it, the practical impact is lower than F-002.

**Recommendation:** Accept key only via `x-provider-key` header.
**No fix in this PR** — breaking change for any client using `?key=`; low priority.

---

### F-008 — LOW: Installer Download Endpoint Does Not Validate API Key

| Field | Value |
|-------|-------|
| File | `backend/src/routes/providers.js` L466–504 |
| CVE class | CWE-306: Missing Authentication |
| Exploitability | Anyone can download the provider installer binary |

**Description:**
`GET /api/providers/installer?key=<any>&os=<OS>` accepts a `key` parameter but never validates it against the database. Any `key` value (including an invented string) causes the endpoint to serve the installer file if it exists on disk. The installer is not sensitive on its own (it's a public binary), but the endpoint misleads callers into thinking auth is required.

**Recommendation:** Either validate the key against the DB, or explicitly make the endpoint public and remove the `key` parameter to avoid confusion.
**No fix in this PR** — low security impact.

---

## Provider Registration Flow — Question-by-Question Assessment

### Can a provider register with a duplicate GPU ID (replay attack)?
The registration schema does not include a unique GPU hardware identifier. Registration is deduplicated by email (UNIQUE constraint). No GPU-level replay attack surface exists — this is a data quality gap, not a security vulnerability.

### Is the provider API key stored hashed or plaintext?
**Plaintext** — see F-003. Keys are stored as-is in `api_key TEXT` column.

### Can a provider spoof another provider by guessing IDs?
Not via ID alone — most authenticated endpoints require both `id` AND `api_key` to match (e.g. `WHERE id = ? AND api_key = ?`). Guessing an ID without the corresponding key returns 403/404. Provider IDs are also sequential integers, making enumeration trivial but not exploitable without the key.

### Does provider deactivation fully revoke all active tokens?
**Yes** — `DELETE /api/providers/me` replaces `api_key` with a UUID tombstone value (`deleted-provider-{id}-{uuid}`), which cannot be guessed and won't match any lookup. All `WHERE api_key = ?` queries return null immediately after deletion. Active jobs are cancelled. Serve sessions are deleted.

---

## API Key Scoping Assessment

### `dcp_` renter keys — minimum permission scope?
Renter scoped sub-keys (`dc1-sk-*`) have explicit scope grants (`inference`, `billing`, `admin`) enforced in `renter_api_keys` table. The master renter key (`dc1-renter-*`) has unrestricted access. Sub-keys correctly check scope before granting access. **Scoping is implemented and functioning.**

### Provider heartbeat tokens — non-heartbeat endpoint access?
Provider keys are accepted on some non-heartbeat endpoints (e.g. `/active`). See F-006. The heartbeat endpoint itself only accepts the provider key in the request body, not a separate JWT. No token segmentation between heartbeat and dashboard operations exists.

### Admin tokens — any admin endpoints missing validation?
`admin.js` applies `router.use(requireAdminRbac)` at the top of the file, meaning all routes in the admin router are covered by the middleware. No unauthenticated admin endpoints found. `requireAdminRbac` delegates to `requireAdminAuth` which uses `timingSafeEqual` for comparison. **Admin auth is correctly implemented.**

---

## Fixes Applied in This PR

| Finding | Fix |
|---------|-----|
| F-001 CRITICAL | `POST /login-email` now returns HTTP 410 Gone — disabled |
| F-002 CRITICAL | `GET /status/:api_key` → `GET /status` with header/query auth |

## Follow-up Tickets Required

| Priority | Title |
|----------|-------|
| HIGH | Hash provider/renter API keys at rest (Sprint 29) |
| HIGH | Enable `DC1_REQUIRE_HEARTBEAT_HMAC=1` after daemon signing rollout |
| MEDIUM | Replace `Math.random()` with `crypto.randomBytes` for provider ID generation |
| MEDIUM | Enforce role-based token acceptance (provider keys cannot auth renter endpoints) |
| LOW | Remove `?key=` from `DELETE /providers/me` and `GET /installer` |
