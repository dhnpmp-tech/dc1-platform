# JWT Authentication Hardening Findings

**Auditor:** Security Engineer (DCP-906)
**Date:** 2026-03-24
**Branch:** security/dcp-906-jwt-hardening
**Scope:** `backend/src/middleware/auth.js`, `backend/src/middleware/adminAuth.js`, `backend/src/server.ts` (Fastify JWT)

---

## 1. Authentication Architecture Overview

DCP runs two backend servers with distinct auth mechanisms:

| Server | File | Port | Auth Model |
|---|---|---|---|
| Express (production) | `server.js` | 8083 | Opaque API keys — renter/provider/admin tokens |
| Fastify (audit/billing) | `server.ts` | 3001 | JWT Bearer — `@fastify/jwt` with `JWT_SECRET` |

The Express server handles all marketplace traffic. The Fastify server is a newer partial server covering audit logging, billing, and job routes.

---

## 2. Express Server Auth Layer (`auth.js` / `server.js`)

### 2.1 Bearer Prefix Handling — PASS ✅

`getBearerToken()` requires the `Authorization` header to match `/^Bearer\s+(.+)$/i`. Requests with a raw token and no `Bearer` prefix return `null` and are rejected with 401. No bypass possible.

```js
const match = authHeader.match(/^Bearer\s+(.+)$/i);
if (!match || !match[1]) return null;
```

### 2.2 Algorithm Pinning — N/A ✅

The Express server does **not** use JWTs. Authentication is via opaque tokens stored in SQLite. There is no JWT signing or verification in the Express path — no `alg: none` attack surface.

### 2.3 Token Expiry — N/A (by design)

Admin token (`DC1_ADMIN_TOKEN`) is a static environment secret with no expiry. Expiry is managed via rotation procedure (see `docs/security/jwt-secret-rotation.md` and `docs/security/token-rotation.md`). Renter/provider sub-keys support optional `expires_at` per-row.

### 2.4 Timing-Safe Comparison — PASS ✅

Admin token verification uses `crypto.timingSafeEqual`, preventing timing oracle attacks:

```js
function secureTokenEqual(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}
```

Note: The early-exit on mismatched lengths theoretically leaks length information, but this is standard practice and not exploitable for tokens of 32+ bytes.

### 2.5 Error Message Leakage — PASS ✅

Auth failures return generic responses:
- `401 { error: 'Admin access denied' }` — does not reveal expected token format or value
- `503 { error: 'Admin token not configured' }` — signals misconfiguration but not token value
- Renter routes return `403 { error: 'Invalid or inactive renter API key' }`

No raw token values or internal state are leaked in error responses.

### 2.6 Array Header Injection — PASS ✅

`normalizeHeaderToken()` returns `null` for array-valued headers, preventing HTTP header injection via duplicate `Authorization` headers:

```js
function normalizeHeaderToken(rawHeader) {
  if (Array.isArray(rawHeader)) return null;
  return normalizeCredential(rawHeader);
}
```

### 2.7 Header Length Cap — PASS ✅

`normalizeCredential()` enforces a 512-character maximum, preventing excessively long header attacks.

---

## 3. Fastify Server JWT Layer (`server.ts`)

The Fastify server registers `@fastify/jwt` to authenticate routes in `audit`, `billing`, and `job` modules.

### 3.1 Algorithm Pinning — FINDING F1 (Medium)

`@fastify/jwt` is registered without explicit algorithm restriction:

```ts
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
});
```

`@fastify/jwt` defaults to HS256 and rejects `alg: none` internally (since v7.x). However, no explicit `algorithms` allowlist is configured. If the library is downgraded or a future plugin version changes defaults, algorithm confusion attacks (`alg: RS256` with a public key passed as the HMAC secret, or `alg: none`) could become possible.

**Recommendation:** Pin the algorithm explicitly:
```ts
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  verify: { algorithms: ['HS256'] },
});
```

**Risk:** Low (library defaults are safe), but defense-in-depth is straightforward.

### 3.2 Token Expiry Enforcement — FINDING F2 (Medium)

No `expiresIn` is set at registration or in route-level `sign()` calls:

```ts
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  // No: sign: { expiresIn: '24h' }
});
```

Tokens signed without `expiresIn` never expire. If a JWT is issued and later the user should lose access (role change, account closure), there is no server-side session store to invalidate — only secret rotation can revoke all outstanding tokens.

**Recommendation:** Add a default sign configuration:
```ts
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  sign: { expiresIn: '24h' },
  verify: { algorithms: ['HS256'] },
});
```

**Risk:** Medium — indefinitely valid tokens are a risk if a token is compromised.

### 3.3 JWT_SECRET Presence Validation — PASS ✅

`validateEnv()` runs at startup and calls `process.exit(1)` if `JWT_SECRET` is absent:

```ts
const REQUIRED_ENV = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) { process.exit(1); }
}
```

The server cannot start without a secret configured.

### 3.4 Bearer Prefix Handling — PASS ✅

`@fastify/jwt` natively handles `Authorization: Bearer <token>` extraction. Requests without the Bearer scheme are rejected automatically.

### 3.5 Error Leakage — PASS ✅

`@fastify/jwt` returns a generic `401 Unauthorized` with `{"statusCode": 401, "error": "Unauthorized", "message": "No Authorization was found in request.headers"}`. The raw JWT parsing error is not exposed to the client in production (Fastify's `logger: true` logs it server-side only).

---

## 4. Admin Auth RBAC (`adminAuth.js`)

### 4.1 JWT Role Check (Future Path) — INFO

`requireAdminRbac()` includes a commented/stub path for JWT role validation:
```js
if (req.user && req.user.role) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin role required' });
  }
}
```

This path is only reached if a JWT middleware upstream has decoded `req.user`. Currently unused in production (Express server has no JWT middleware). When JWT is added to the Express layer, this guard will activate automatically — the logic is correct.

### 4.2 Audit Log Swallowing — INFO (Low)

Admin audit writes use `try/catch` that swallows errors to prevent DB failures from blocking legitimate admin requests. This is intentional but means audit gaps are silent. A future improvement would be to emit a warning metric when the audit write fails.

---

## 5. Summary of Findings

| ID | Severity | Location | Finding | Status |
|---|---|---|---|---|
| F1 | Medium | `server.ts` | No explicit algorithm allowlist for `@fastify/jwt` | Open — pre-launch fix recommended |
| F2 | Medium | `server.ts` | No `expiresIn` set — JWT tokens never expire | Open — fix before JWT routes go to production |
| F3 | Info | `adminAuth.js` | Audit write failures are silently swallowed | Acceptable — low impact |

No critical or high findings in the JWT/auth layer.

---

## 6. Action Items

| ID | Action | Priority | When |
|---|---|---|---|
| F1 | Add `verify: { algorithms: ['HS256'] }` to `fastifyJwt` registration | Medium | Before Fastify server routes serve external traffic |
| F2 | Add `sign: { expiresIn: '24h' }` to `fastifyJwt` registration | Medium | Before Fastify server routes serve external traffic |
| — | Review `JWT_SECRET` rotation plan before any external JWT issuance | High | See `docs/security/jwt-secret-rotation.md` |

---

## 7. Phase 1 Launch Verdict (Express Server)

**✅ CLEAR** — The production Express server (port 8083) does not use JWTs. Its opaque token auth is well-hardened (timing-safe, no leakage, rate limited). No blocking findings for Phase 1.

**⚠️ CONDITIONAL** — The Fastify server (port 3001) has two medium findings (F1, F2). These should be fixed before the Fastify routes are exposed to external traffic or used to issue user-facing JWTs.
