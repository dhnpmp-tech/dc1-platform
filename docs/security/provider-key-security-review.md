# Provider API Key Security Review

**Review Date:** 2026-03-24
**Reviewer:** Security Engineer
**Task:** DCP-795
**Scope:** Provider key issuance, storage, validation, and rotation across `backend/src/`
**Overall Rating:** 🟡 **MODERATE — 6.5 / 10** — New key system is solid; legacy key system has critical gaps

---

## Executive Summary

DCP has two parallel provider key systems in production:

1. **New system** (`provider_api_keys` table, introduced in DCP-760) — hashed storage, high entropy, timing-safe comparison. **Sound.**
2. **Legacy system** (`providers.api_key` column, still in active use) — plaintext storage, used in financial settlement, webhook HMAC, and verification routes. **Critical gap.**

The legacy keys remain the operative authentication surface for all financial and webhook flows. Until those consumers are migrated or deprecated, the new key system's security properties do not fully protect the platform.

---

## 1. New Key System (`provider_api_keys` table)

### 1.1 Key Generation

**Location:** `backend/src/services/apiKeyService.js`

- **Format:** `dcp_prov_<32 base62 characters>`
- **Entropy source:** `crypto.randomBytes(24)` encoded as base62 → 190+ bits of effective entropy
- **Assessment:** ✅ Exceeds the 32-byte (256-bit) theoretical minimum; 190 bits is well above brute-force feasibility at current compute
- **Prefix:** Fixed `dcp_prov_` facilitates service-layer filtering; unique enough to avoid false positives in secret scanning

### 1.2 Storage

| Field | Value | Security Assessment |
|---|---|---|
| `key_hash` | SHA-256 hex digest (128 chars) | ✅ Hash-only; raw key never persisted |
| `key_prefix` | First 8 chars of random portion, plaintext | ✅ Needed for indexed lookup; non-reversible |
| `revoked_at` | NULL while active | ✅ Revocation supported |
| `last_used_at` | Updated on each verification | ✅ Audit trail |

**Assessment:** ✅ Storage model is correct. Database compromise exposes only hashes, not raw keys.

### 1.3 Key Verification

**Function:** `verifyProviderKey(rawKey)` in `apiKeyService.js`

Flow:
1. Validate prefix matches `dcp_prov_` — rejects malformed keys early
2. Extract first 8 chars of random portion → indexed database lookup
3. SHA-256 hash candidate → compare all candidate hashes using `crypto.timingSafeEqual()`
4. On match: update `last_used_at`, return `provider_id`
5. On failure: return `null` (no information leakage)

**Assessment:** ✅ Timing-safe comparison prevents oracle attacks. Indexed prefix lookup prevents full-table scans. No information leaked on failure.

### 1.4 Key Rotation

- **Rotation:** Revoke old key (`revoked_at` set) + issue new key
- **Self-service:** No provider-facing rotation endpoint exists yet (noted in `pre-launch-security-audit.md` as SEC-M1)
- **Admin rotation:** Admin can rotate legacy keys via `PUT /api/admin/providers/:id/rotate-key`
- **Assessment:** ⚠️ Providers cannot self-service rotate compromised keys; requires admin intervention

### 1.5 Enumeration / Brute-Force Risk

- 190-bit entropy at 10¹² guesses/second = 10⁴⁸ years to exhaust — **no practical brute-force risk**
- Prefix lookup adds 2 DB columns but does not narrow search space (prefix is also random)
- Rate limit on heartbeat endpoint (60/min per key) limits online guessing via `/api/providers/heartbeat`
- **Assessment:** ✅ No enumeration or brute-force risk identified for the new key system

---

## 2. Legacy Key System (`providers.api_key` column) — CRITICAL GAPS

### 2.1 Key Generation (Legacy)

**Location:** `backend/src/routes/providers.js` line 328

```javascript
const api_key = 'dc1-provider-' + crypto.randomBytes(16).toString('hex');
```

- **Entropy:** 128 bits from `randomBytes(16)` — adequate (not ideal, but above minimum)
- **Admin reset format:** `dc1-provider-${crypto.randomUUID()}` (line 3288) — UUID v4 has 122 bits of entropy, slightly less

### 2.2 Storage — CRITICAL GAP

**Finding:** Legacy `providers.api_key` column stores keys **as plaintext**.

Verification in affected routes:

| File | Pattern | Risk |
|---|---|---|
| `routes/settlement.js:30` | `WHERE api_key = ? AND deleted_at IS NULL` | Direct DB equality — plaintext |
| `routes/payouts.js:53` | `WHERE api_key = ? AND deleted_at IS NULL` | Direct DB equality — plaintext |
| `routes/verification.js:274,391,415` | `WHERE api_key = ?` | Direct DB equality — plaintext |
| `middleware/webhookHmac.js:96` | `WHERE api_key = ?` | DB lookup + used as HMAC key |

**Impact of database compromise:** All active provider API keys exposed in plaintext. Attacker can authenticate as any provider, claim settlements, forge webhook signatures, and access financial data.

**Severity:** 🔴 HIGH

### 2.3 Webhook HMAC Key Derivation

**Location:** `middleware/webhookHmac.js`

The provider's **plaintext** `api_key` is used as the HMAC key for webhook signature verification:

```javascript
providerKey: provider.api_key  // line 107
```

This creates a secondary risk: even if the provider's own key is never sent in a webhook, it is loaded from the DB on every webhook verification and used in HMAC computation. A timing side-channel on HMAC operations could theoretically leak information about key length/entropy.

**Severity:** 🟡 MEDIUM (secondary concern to plaintext storage)

### 2.4 Heartbeat API Key in Request Body

**Location:** `routes/providers.js`, heartbeat endpoint

Provider API key is submitted in the JSON request body (not as an Authorization header):

```json
POST /api/providers/heartbeat
{ "api_key": "dc1-provider-..." }
```

**Risks:**
- Keys appear in application logs if request body logging is enabled (check `auditService.ts`)
- Keys visible in nginx access logs if request body logging is configured
- No mitigation if TLS termination proxy logs cleartext bodies

**Assessment:** ⚠️ Accepted risk per current design, but body-based key submission should be migrated to Authorization header for consistency with other endpoints

### 2.5 Login Endpoints Return Plaintext Key

**Affected routes:**
- `POST /api/providers/login-email` (line 437) — returns `api_key` from providers row
- `POST /api/providers/verify-otp` (line 401) — returns `api_key` from providers row

Since the legacy key is stored in plaintext, these endpoints can always retrieve and return the original key. The new system (correctly) shows the raw key only once at issuance.

---

## 3. Findings Summary

| ID | Finding | Severity | System | Effort |
|---|---|---|---|---|
| PKS-1 | Legacy `api_key` stored plaintext in `providers` table | 🔴 HIGH | Legacy | 8 h |
| PKS-2 | Settlement/payouts/verification/webhookHmac use legacy key | 🔴 HIGH | Legacy | 6 h |
| PKS-3 | No provider self-service key rotation endpoint | 🟡 MED | New | 3 h |
| PKS-4 | Heartbeat sends key in request body (not Authorization header) | 🟡 MED | Legacy | 4 h |
| PKS-5 | Admin key reset uses UUID v4 (122-bit entropy vs 128-bit) | 🟢 LOW | Legacy | 1 h |
| PKS-6 | Key used as HMAC key in webhookHmac.js — no KDF applied | 🟢 LOW | Legacy | 2 h |

---

## 4. Recommendations

### PKS-1 + PKS-2: Migrate Legacy Key Consumers (HIGH — Before Provider Activation)

With 43 providers about to activate, this is the most critical gap. The new `provider_api_keys` service already exists and is tested. Migration path:

1. Add a migration step: for each existing provider with a legacy `api_key`, insert a corresponding row in `provider_api_keys` (hash the existing key, or force re-registration)
2. Update `settlement.js`, `payouts.js`, `verification.js`, and `webhookHmac.js` to call `verifyProviderKey()` from `apiKeyService.js` instead of direct DB lookups
3. Deprecate `providers.api_key` column — remove from SELECT results, eventually drop column

**Owner:** Backend Architect / Security Engineer
**Estimated effort:** 10–14 hours total (migration + consumers)
**Blocker:** Must be done before real providers handle real jobs

### PKS-3: Provider Self-Service Key Rotation

Expose the existing rotation logic as an authenticated endpoint:
- `POST /api/providers/me/rotate-key` — rate-limited to 3 rotations per 24 hours
- Returns new key once; invalidates all previous keys for that provider
- Already tracked as SEC-M1 in `pre-launch-security-audit.md`

**Owner:** Backend Architect
**Estimated effort:** 3 hours

### PKS-4: Migrate Heartbeat to Authorization Header

Move API key from request body to `Authorization: Bearer <key>` header:
- Consistent with all other authenticated endpoints
- Eliminates body-logging risk
- Requires daemon update (coordinated release)

**Owner:** Backend Architect + DevOps
**Estimated effort:** 4 hours (backend) + daemon release coordination

---

## 5. What Is Already Secure

The following provider key security properties are confirmed sound:

- ✅ New key entropy (190+ bits) — exceeds all practical requirements
- ✅ New key hashed at rest — database dump does not expose raw keys
- ✅ Timing-safe comparison in `apiKeyService.js` and `apiKeyAuth.js`
- ✅ Revocation via `revoked_at` timestamp — no key reactivation possible
- ✅ `deleted_at` check on provider row prevents revived-account attacks
- ✅ Rate limiting on registration (5/10min) and heartbeat (60/min) prevents online attacks
- ✅ No key enumeration risk — 190-bit entropy is computationally infeasible to brute-force
- ✅ Admin key exposure prevented: `GET /api/admin/providers` explicitly excludes `api_key` field (line 663)
- ✅ Startup guard rejects placeholder secrets — prevents accidental deployment with weak config

---

## 6. Test Coverage

| Test File | Coverage |
|---|---|
| `backend/src/__tests__/apiKeyService.test.js` | New key: generation, verification, revocation, listing |
| `backend/src/__tests__/auth-hardening.test.js` | Middleware: 401 on missing/invalid/revoked keys |

**Gap:** No tests cover legacy key consumers (settlement, payouts, verification). These should be added as part of the migration effort.
