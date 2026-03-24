# DCP API Token Security Audit — 2026-03-24

**Auditor:** Security Engineer (DCP-875)
**Scope:** All renter and provider authentication tokens in the DCP backend
**Status:** ✅ Pre-Phase 1 launch audit — findings documented with action items

---

## 1. Token Architecture Overview

DCP uses **opaque bearer tokens** (not JWTs) for renter and provider authentication. There are no JWTs in the renter-facing or provider-facing API. Internal Paperclip agent heartbeats use HMAC-signed JWTs, but these are not exposed externally.

### Token Types

| Token type | Format | Entropy | Who holds it |
|---|---|---|---|
| Renter master key | `dc1-renter-<32 hex>` | 128 bits | Renter (full access) |
| Renter sub-key (inference scope) | `dc1-sk-<40 hex>` | 160 bits | Renter (scoped) |
| Renter sub-key (DCP format) | `dcp_<uuid>` | ~122 bits (UUID v4) | Renter (scoped) |
| Provider key | `dc1-provider-<32 hex>` | 128 bits | Provider daemon |
| Admin token | `DC1_ADMIN_TOKEN` env var | Operator-defined | Admin only |
| HMAC signing secret | `DC1_HMAC_SECRET` env var | 256 bits (random) | Internal only |

### Generation Method (`backend/src/routes/renters.js`)

```js
// Master key
const api_key = 'dc1-renter-' + crypto.randomBytes(16).toString('hex');

// Sub-key
const key = `dc1-sk-${crypto.randomBytes(20).toString('hex')}`;
```

Uses Node.js `crypto.randomBytes` (CSPRNG). Entropy is sufficient: 128+ bits resists brute-force.

---

## 2. Findings

### PASS — Token Entropy

- Master keys: 128 bits of cryptographic randomness → **adequate**
- Sub-keys: 160 bits of cryptographic randomness → **adequate**
- Provider keys: 128 bits → **adequate**
- All keys use `crypto.randomBytes` (not `Math.random`)

### PASS — Token Transmission

- All external API traffic goes through `api.dcp.sa` (nginx → port 8083)
- TLS: Let's Encrypt certificate, valid through 2026-06-21
- nginx enforces HTTPS; no plain HTTP to the backend is exposed publicly
- Tokens sent in `x-renter-key` / `x-provider-key` / `Authorization: Bearer` headers (not URL params for sensitive paths)

**Note:** Some internal routes accept `?key=` query parameter. This is acceptable for provider daemon compatibility but means API keys may appear in server access logs. See Action Item A1.

### PASS — Scope Enforcement

Sub-keys have explicit scopes stored as JSON arrays in the DB:

```
Valid scopes: "inference", "billing", "admin"
```

Scope enforcement is applied in `backend/src/routes/vllm.js` — sub-keys with `inference` scope can submit vLLM jobs but not access billing. Master key has full access.

### PASS — Key Rotation

- `POST /api/renters/me/rotate-key` — atomically rotates master key, records rotation in `api_key_rotations` table
- Sub-keys can be revoked via `DELETE /api/renters/me/keys/:keyId`
- Rotation and revocation paths are present and tested

### PASS — Timing-Safe Comparison

Admin token comparison uses `crypto.timingSafeEqual` (in `backend/src/middleware/auth.js`):

```js
function secureTokenEqual(provided, expected) {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}
```

Renter/provider key lookups are done via SQLite `WHERE api_key = ?` — direct DB equality is not timing-vulnerable because the DB query itself is not constant-time, but the attack surface is negligible for opaque tokens of 128+ bits.

### PASS — No Token Leakage in Application Logs

Code review found no `console.log` statements printing raw API keys in route handlers. The structured logging in `server.js` logs `has_header=true/false` on auth failures — it does not log token values.

### ⚠️  FINDING A1 — API Keys in Server Access Logs (Low)

Some endpoints accept `?key=` query parameter (e.g. `GET /api/renters/me?key=dc1-renter-...`). These query params appear in nginx access logs in plaintext.

**Risk:** Log exfiltration → token exposure. Impact: medium. Likelihood: low (access logs require server access).

**Recommendation:** For new endpoints, prefer header-only auth (`x-renter-key`). Existing `?key=` support can remain for daemon backward compatibility but should be phased out for browser-facing flows.

### ⚠️  FINDING A2 — Plaintext Token Storage in SQLite (Low-Medium)

API keys are stored as plaintext strings in the SQLite `renters.api_key` and `renter_api_keys.key` columns. No hashing or encryption at rest.

**Risk:** DB file compromise (e.g. backup exfiltration, local access) exposes all active tokens.

**Impact:** High if DB file is leaked. Likelihood: low (VPS access required).

**Trade-off:** Hashing tokens would break fast single-query auth lookups. Standard practice for opaque tokens varies — many platforms store them plaintext (Stripe, GitHub classic tokens) while others hash them (GitHub fine-grained PATs).

**Recommendation (Post-Phase 1):** Consider SHA-256 hashing of tokens at rest with a prefix-lookup strategy. Not blocking for Phase 1 launch.

### ⚠️  FINDING A3 — Sub-key Max Count (Low)

Max 10 active sub-keys per renter (`renter_api_keys`). This limit is enforced in the API but applies per renter, not globally. A single renter cannot exhaust system resources, but there is no hard expiry on sub-keys that have no `expires_at` set.

**Recommendation:** Sub-keys created without `expires_at` should auto-expire after a configurable period (e.g. 90 days). Currently they live indefinitely until manually revoked.

### ✅  FINDING A4 (Fixed) — providerActivateLimiter Not Imported (High — Bug)

`server.js` referenced `providerActivateLimiter` on line 217 but the symbol was never imported from `rateLimiter.js`. This caused a silent ReferenceError that would crash the Express request handler for any `POST /api/providers/:id/activate` request.

**Fix applied in this PR:**
- Added `providerActivateLimiter` to `rateLimiter.js` (3 req/hr per provider key)
- Added import in `server.js`
- Added `webhookRegistrationLimiter` (10 req/hr per renter key) for the new `/api/renters/:id/webhooks` endpoint from DCP-863

---

## 3. Rate Limiting Coverage Map

| Endpoint group | Limiter | Window | Max |
|---|---|---|---|
| `/api/auth/*` | `authLimiter` | 15 min | 5/IP |
| `/api/renters/login*` | `loginLimiter` | 15 min | 10/IP |
| `/api/providers/login*` | `loginLimiter` | 15 min | 10/IP |
| `/api/renters/register` | `registerLimiter` | 60 min | 5/IP |
| `/api/providers/register` | `registerLimiter` | 60 min | 5/IP |
| `/api/providers/:id/activate` | `providerActivateLimiter` | 60 min | 3/key |
| `/api/providers/heartbeat` | `heartbeatProviderLimiter` | 1 min | 4/key |
| `/api/jobs/submit` | `jobSubmitLimiter` | 1 min | 30/IP |
| `/api/vllm/complete` | `vllmCompleteLimiter` | 1 min | 10/key |
| `/api/vllm/complete/stream` | `vllmStreamLimiter` | 1 min | 5/key |
| `/api/models` | `tieredApiLimiter` | 1 min | 1000/key or 200/IP |
| `/api/providers` | `tieredApiLimiter` | 1 min | 1000/key or 200/IP |
| `/api/jobs` | `tieredApiLimiter` | 1 min | 1000/key or 200/IP |
| `/api/renters/topup` | `topupLimiter` | 1 min | 10/IP |
| `/api/payments/topup` | `paymentLimiter` | 1 min | 10/IP |
| `/api/payments/webhook` | `paymentWebhookLimiter` | 1 min | 100/IP |
| `/api/renters/:id/webhooks` | `webhookRegistrationLimiter` | 60 min | 10/key |
| `/api/admin` | `adminLimiter` | 1 min | 30/token |
| `/api/*` (catch-all) | `generalLimiter` | 1 min | 300/IP |

All limiters return HTTP 429 with `Retry-After` header and JSON body `{ error, retryAfterSeconds, retryAfterMs }`.

---

## 4. Action Items

| ID | Finding | Priority | Owner | Timeline |
|---|---|---|---|---|
| A1 | Phase out `?key=` query param in browser-facing flows | Low | Backend | Post-Phase 1 |
| A2 | Evaluate token hashing at rest (prefix lookup) | Low-Medium | Backend | Q2 2026 |
| A3 | Default `expires_at` for sub-keys (90-day rolling) | Low | Backend | Post-Phase 1 |
| **A4** | **providerActivateLimiter import fix** | **High** | **Done ✅** | **DCP-875** |

---

## 5. Phase 1 Launch Verdict

**✅ CLEAR TO LAUNCH** with respect to token security.

- Token entropy is sufficient (128–160 bits CSPRNG)
- HTTPS enforced at the ingress layer
- Timing-safe admin comparison implemented
- Key rotation and sub-key revocation available
- Rate limiting covers all sensitive endpoints
- Critical bug (providerActivateLimiter) fixed in this PR
- Low-severity findings (A1–A3) are acceptable for Phase 1 and documented for follow-up
