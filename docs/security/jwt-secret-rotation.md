# JWT Secret Rotation Procedure

**Owner:** Security Engineer / DevOps
**Last updated:** 2026-03-24 (DCP-906)
**Applies to:** `JWT_SECRET` env var used by the Fastify server (`backend/src/server.ts`, port 3001)

> **Note:** For `DC1_ADMIN_TOKEN` and `DC1_HMAC_SECRET` rotation, see `docs/security/token-rotation.md`.

---

## 1. Overview

The Fastify server uses `JWT_SECRET` as the HMAC-HS256 signing key for all JWTs it issues. Rotating this secret **immediately invalidates all outstanding JWTs** — users will need to re-authenticate.

DCP currently issues JWTs only for internal audit/billing/job routes. There is no persistent user session store. Rotation is therefore low-impact: re-login is the recovery path.

---

## 2. When to Rotate

Rotate `JWT_SECRET` when:

- ✅ The secret may have been exposed (git commit, log file, Slack message, etc.)
- ✅ A VPS admin account is compromised or access is revoked
- ✅ Routine scheduled rotation (recommended: every 90 days)
- ✅ A service account with JWT access is deprovisioned
- ✅ Moving from test/staging to production for the first time

Do **not** rotate during active user sessions without a downtime window or a dual-secret transition (see Section 5).

---

## 3. Rotation Steps (Standard — with brief outage)

This procedure invalidates all active JWTs. Safe during off-peak hours or maintenance windows.

### Step 1: Generate a new secret

On a secure machine (not the VPS shell, avoid shell history logging):

```bash
# 256 bits of cryptographic randomness — do NOT use less than 32 bytes
openssl rand -base64 48
```

Copy the output. Store it in your password manager (1Password, Bitwarden, etc.) immediately.

### Step 2: Update the VPS environment

Per the mandatory deployment restriction (CLAUDE.md): **do not proceed without founder approval** if modifying production VPS state.

1. SSH to the VPS and update the PM2 ecosystem file or secure env store:
   ```bash
   # Edit /home/node/.env or the PM2 ecosystem config
   # Set JWT_SECRET=<new-value>
   ```

2. Reload the Fastify server process with the new env:
   ```bash
   pm2 reload dc1-fastify --update-env
   ```
   (or whichever PM2 process name runs `server.ts`)

### Step 3: Verify the new secret is active

```bash
# Health check — should return 200 OK
curl -s http://localhost:3001/health

# Attempt auth with an old JWT — should return 401
curl -s -H "Authorization: Bearer <old-token>" http://localhost:3001/api/v1/audit/logs
# Expected: {"statusCode":401,"error":"Unauthorized","message":"..."}
```

### Step 4: Update all downstream services

Any service that issues or validates JWTs must use the new secret:
- CI/CD pipelines that generate test JWTs
- Any admin scripts that sign requests to the Fastify server

### Step 5: Document the rotation

Create an issue comment on DCP-906 (or a dedicated rotation log issue) with:
- Date/time of rotation
- Who performed it
- Reason for rotation
- Next scheduled rotation date

---

## 4. How to Invalidate All Existing Sessions

`JWT_SECRET` rotation invalidates all JWTs signed with the old secret immediately upon reload. There is no token blocklist or session store — invalidation is implicit.

For the Fastify server:
- **Logout is automatic** after rotation — all outstanding Bearer tokens fail `jwt.verify()`
- **Users must re-authenticate** by calling the login endpoint to receive a new JWT
- **No database cleanup is needed** — JWTs are stateless

---

## 5. Zero-Downtime Rotation (Advanced)

Use this if active sessions cannot be disrupted (e.g., during a long-running job or live demo).

`@fastify/jwt` supports an array of secrets for verification:

```ts
// server.ts — temporary dual-secret configuration during rotation window
app.register(fastifyJwt, {
  secret: {
    private: newSecret,
    public: [newSecret, oldSecret], // verify with both, sign with new
  },
});
```

Steps:
1. Deploy with dual-secret config (new primary + old fallback)
2. All new JWTs are signed with `newSecret`
3. Old JWTs remain valid during the overlap window
4. After the old JWT TTL expires (e.g., 24 hours), remove `oldSecret` from the array
5. Deploy single-secret config

**Practical note:** Given current DCP JWT TTLs are unset (see jwt-hardening-findings.md Finding F2), this requires fixing F2 first to define a TTL before zero-downtime rotation is meaningful.

---

## 6. Recommended Rotation Frequency

| Scenario | Frequency |
|---|---|
| Default (no known incidents) | Every 90 days |
| After any suspected exposure | Immediately |
| After team member departure | Within 24 hours |
| Before public launch | Verify it is a strong secret (32+ bytes random) |

---

## 7. Required Environment Variable Procedure

### Variable name: `JWT_SECRET`

| Property | Requirement |
|---|---|
| Minimum entropy | 256 bits (32 bytes) — use `openssl rand -base64 48` for 48-byte output |
| Format | Any string — base64 or hex preferred |
| Storage | PM2 ecosystem env, OS-level env, or secret manager (never in source code) |
| Presence check | Server exits with fatal error if missing (`validateEnv()` in `server.ts`) |

### Environment files

The Fastify server reads `JWT_SECRET` from the process environment. It does not use `.env` files directly in production. Set it via:

```bash
# PM2 ecosystem.config.js
env: {
  JWT_SECRET: process.env.JWT_SECRET  // pull from OS env, never hardcode
}
```

Or export it before `pm2 start`:
```bash
export JWT_SECRET="$(cat /path/to/secret-file)"
pm2 start ecosystem.config.js --update-env
```

### Verification

After setting, confirm the secret is loaded without printing it:
```bash
# Should NOT print the secret — just check it is non-empty
pm2 env <process-id> | grep JWT_SECRET | wc -c
# Anything > 15 (len of "JWT_SECRET=\n") means it is set
```

---

## 8. Related Documents

- `docs/security/token-rotation.md` — DC1_ADMIN_TOKEN and DC1_HMAC_SECRET rotation
- `docs/security/jwt-hardening-findings.md` — JWT layer security audit (DCP-906)
- `docs/security/pre-launch-security-checklist.md` — overall pre-launch security gate
