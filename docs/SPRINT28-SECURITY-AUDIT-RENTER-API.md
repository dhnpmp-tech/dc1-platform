# DCP Sprint 28 — Renter API Security Audit

**Auditor:** Security Engineer (DCP-885)
**Date:** 2026-03-24
**Scope:** Renter API, admin endpoints, vLLM route, JWT/token issuance
**Files reviewed:**
- `backend/src/routes/renters.js`
- `backend/src/routes/admin.js`
- `backend/src/routes/vllm.js`
- `backend/src/middleware/auth.js`
- `backend/src/middleware/adminAuth.js`
- `backend/src/middleware/validateWebhookUrl.js`
- `backend/src/lib/webhook-security.js`

---

## Findings Summary

| ID  | Severity   | Title                                              | Status   |
|-----|------------|---------------------------------------------------|----------|
| B1  | CRITICAL   | DCP-863 SSRF fix is dead code — route ordering bypass | **FIXED** |
| B2  | HIGH       | `PATCH /api/renters/settings` allows `http://` webhook URLs | **FIXED** |
| B3  | HIGH       | `POST /api/renters/:id/topup` — unguarded balance injection | **FIXED** |
| B4  | MEDIUM     | `POST /api/renters/me/rotate-key` uses `crypto.randomUUID()` (entropy downgrade) | Open |
| B5  | MEDIUM     | Sub-keys without `expires_at` are permanent (existing A3) | Open |
| B6  | LOW        | Webhook `secret` stored in plaintext in `renter_webhooks` table | Open |
| B7  | INFO       | No JWT issuance in production Express backend — JWT expiry N/A | N/A |

---

## Findings Detail

### B1 — CRITICAL — DCP-863 SSRF Fix Is Dead Code (FIXED)

**File:** `backend/src/routes/renters.js`

**Root cause:** DCP-863 added a new `POST /:id/webhooks` route with `validateWebhookUrl` middleware at line ~1959. However, an older `POST /:id/webhooks` handler already existed at line 1737. Express uses the **first** registered handler for a given path — the new route was never reachable.

The old route validated HTTPS protocol but did NOT:
- Block RFC-1918 addresses (10.x, 192.168.x, 172.16–31.x)
- Block loopback addresses (127.x) or link-local (169.254.x)
- Perform async DNS resolution to verify the hostname resolves to a public IP

**Attack scenario:** A renter registers `https://192.168.1.254/steal-data` as a webhook. On job completion the DCP backend sends an HTTPS POST to that internal host, leaking job data and enabling SSRF into the internal network.

**Fix applied:** Added `validateWebhookUrl('url')` middleware directly to the existing route at line 1737. Removed the unreachable duplicate route. The route signature is now:
```js
router.post('/:id/webhooks', requireRenterOwner, validateWebhookUrl('url'), (req, res) => {
```

---

### B2 — HIGH — `PATCH /api/renters/settings` Allows `http://` Webhook URLs (FIXED)

**File:** `backend/src/routes/renters.js`, `normalizeWebhookUrl()` function

**Root cause:** `normalizeWebhookUrl()` accepted both `http:` and `https:` protocols. The `PATCH /api/renters/settings` endpoint uses this function for the `webhook_url` setting, allowing a renter to store an `http://` URL.

**Attack scenario:** A renter sets `webhook_url=http://169.254.169.254/latest/meta-data` (AWS instance metadata) or `http://10.0.0.1/admin`. On job events the backend issues a plaintext HTTP request to the internal target, potentially leaking cloud credentials or internal service data.

**Fix applied:** Narrowed `normalizeWebhookUrl()` to accept only `https:` protocol:
```js
if (parsed.protocol !== 'https:') return null;
```

**Note:** This function does not perform async DNS resolution — it only calls `isPublicWebhookUrl()` which is the synchronous hostname/IP check. For full parity with `validateWebhookUrl` middleware, the settings endpoint should eventually be migrated to use `validateWebhookUrlValue()` (async, DNS-checking). Tracked as post-Phase-1 improvement.

---

### B3 — HIGH — `POST /api/renters/:id/topup` Unguarded Balance Injection (FIXED)

**File:** `backend/src/routes/renters.js`, line ~1648

**Root cause:** `POST /api/renters/:id/topup` is behind `requireRenterOwner` (correct) but has **no payment gateway verification and no environment guard**. Any active renter can call this endpoint to add up to 10,000 SAR to their own balance per request, unlimited times.

Compare to the similar `POST /api/renters/topup` (legacy sandbox topup at line 703), which correctly gates itself:
```js
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SANDBOX_TOPUP !== 'true') {
  return res.status(403).json({ error: 'Direct top-up disabled in production. Use payment flow.' });
}
```

`POST /:id/topup` had no such guard, meaning in production a renter could freely inject credits.

**Fix applied:** Added the same `ALLOW_SANDBOX_TOPUP` guard:
```js
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SANDBOX_TOPUP !== 'true') {
  return res.status(403).json({ error: 'Direct top-up disabled in production. Use the payment flow.' });
}
```

---

### B4 — MEDIUM — `crypto.randomUUID()` in Key Rotation (Entropy Downgrade)

**File:** `backend/src/routes/renters.js`, `POST /api/renters/me/rotate-key` (line ~910)

**Observation:** The generated key is `dc1-renter-<UUID>` where UUID v4 has 122 bits of random entropy (6 bits are fixed version/variant). Registration uses `crypto.randomBytes(16).toString('hex')` which gives 128 full bits.

**Risk:** Not a practical attack risk at 122 bits. However, the UUID exposes its version (`4`) and variant bits, making the key structure slightly more predictable than pure hex.

**Recommendation:** Change to `'dc1-renter-' + crypto.randomBytes(16).toString('hex')` for consistency. Post-Phase-1.

---

### B5 — MEDIUM — Sub-keys Without `expires_at` Are Permanent (Existing A3)

**File:** `backend/src/routes/renters.js`, `POST /api/renters/me/keys`

**Observation:** Sub-keys created without an `expires_at` parameter live indefinitely. No auto-expiry is applied. An attacker who obtains a sub-key (e.g., from logs or version control) retains access forever unless the renter manually revokes it.

**Recommendation:** Apply a default 90-day expiry to sub-keys created without an explicit `expires_at`. Post-Phase-1 (same as A3 from DCP-875 audit).

---

### B6 — LOW — Webhook `secret` Stored in Plaintext

**File:** `backend/src/routes/renters.js`, `POST /:id/webhooks`

**Observation:** The `secret` field for webhook HMAC signing is stored as plaintext in the `renter_webhooks.secret` column. If the SQLite DB file is compromised, all webhook secrets are exposed.

**Recommendation:** Hash webhook secrets at storage (e.g., SHA-256 with a prefix hint for display). Post-Phase-1. Lower priority than renter API key hashing (existing A2).

---

### B7 — INFO — JWT Expiry Audit: No JWTs Issued by Production Backend

**Files:** `backend/src/middleware/auth.js`, `backend/src/routes/providers.js`, `backend/src/server.js`

**Findings:**
- The production Express backend does NOT issue JWTs for renter or provider authentication
- Renter auth: opaque bearer tokens (`dc1-renter-<hex>`, `dc1-sk-<hex>`, `dcp_<hex>`)
- Provider auth: HMAC-SHA256 (`DC1_HMAC_SECRET`) signing of heartbeat request body — not JWT
- The `adminAuth.js` mentions JWT as a future auth layer (`req.user.role === 'admin'`), but no JWT middleware is registered in `server.js` — this code path is currently unreachable
- `backend/src/server.ts` is a Fastify prototype that uses `@fastify/jwt`, but it is NOT the production server (`server.js`)

**Conclusion:** No JWT expiry issues exist because JWTs are not in use in the production Express backend. When JWT admin auth is eventually implemented, the `exp` claim must be short-lived (≤ 1 hour) and validated via `crypto.timingSafeEqual` or a verified JWT library.

---

## Auth Bypass Assessment

| Vector | Protected? | Notes |
|--------|------------|-------|
| Renter calling admin endpoints | ✅ YES | `requireAdminRbac` on all `/api/admin/*` routes checks `DC1_ADMIN_TOKEN` (static, 256-bit) |
| Unauthenticated vLLM inference | ✅ YES | `requireRenter` middleware on all `/api/vllm/complete` routes |
| Renter cross-account access | ✅ YES | `requireRenterOwner` checks `api_key = ? AND id = ?` — renter cannot access another renter's data |
| Renter sub-key scope bypass | ✅ YES | `requireRenter` in vllm.js checks `scopes.includes('inference') OR scopes.includes('admin')` |
| Provider calling renter endpoints | ✅ YES | Provider keys have `x-provider-key` prefix; renter endpoints check `x-renter-key` from different table |

---

## Balance Manipulation Assessment

| Vector | Protected? | Notes |
|--------|------------|-------|
| `/api/renters/topup` (sandbox endpoint) | ✅ YES | Gated by `ALLOW_SANDBOX_TOPUP=true` + `NODE_ENV !== production` |
| `/api/renters/:id/topup` (new route) | ✅ FIXED | Now gated by same `ALLOW_SANDBOX_TOPUP` guard (B3 fix) |
| Balance deduction via vLLM | ✅ YES | Atomic DB transaction prevents TOCTOU race on balance |
| Negative cost injection | ✅ YES | `jobDispatchService.js` throws on `estimatedCostHalala < 0` |
| Admin manual topup | ✅ YES | Requires `DC1_ADMIN_TOKEN` |

---

## SSRF Assessment

| Vector | Protected? | Notes |
|--------|------------|-------|
| Webhook URL via `POST /:id/webhooks` | ✅ FIXED | Now runs `validateWebhookUrl` middleware (HTTPS, port 443, RFC-1918 block, DNS check) |
| Webhook URL via `PATCH /api/renters/settings` | ⚠️ PARTIAL | HTTPS-only enforced (B2 fix), synchronous IP block. Missing async DNS check. |
| Webhook URL via job queue callbacks | ✅ YES | `isPublicWebhookUrl()` called in `renterWebhookService.js` before delivery |
| IPv6 loopback (::1) | ✅ YES | `webhook-security.js` `isIpv6PrivateOrLocal()` covers `::1` and IPv4-mapped loopbacks |
| CGNAT (100.64.0.0/10) | ✅ YES | `webhook-security.js` covers this range |

---

## Fixes Committed

This audit committed the following code changes to `security/dcp-885-renter-api-audit`:

1. **B1 CRITICAL:** Added `validateWebhookUrl('url')` middleware to the existing `POST /:id/webhooks` route; removed unreachable duplicate route (DCP-863 dead code)
2. **B2 HIGH:** `normalizeWebhookUrl()` now rejects `http:` protocol
3. **B3 HIGH:** `POST /:id/topup` now gated by `ALLOW_SANDBOX_TOPUP=true` environment flag

---

## Phase 1 Launch Verdict

**⚠️ CONDITIONAL PASS** — three fixes applied in this PR. With these fixes merged:

- No auth bypass paths identified
- SSRF protection operational on all webhook registration routes
- Balance injection endpoints gated (prod/sandbox separation enforced)
- Remaining open items (B4, B5, B6) are low/medium, acceptable for Phase 1

**Ensure `ALLOW_SANDBOX_TOPUP` is NOT set to `true` on the production VPS.**
