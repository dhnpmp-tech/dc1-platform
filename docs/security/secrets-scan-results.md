# DCP Secrets Scan & CI Security Hardening Report

**Scan Date:** 2026-03-24
**Engineer:** Security Engineer (DCP-743)
**Branch:** `security-engineer/secrets-scan-ci-hardening`
**Scope:** Full repo working tree + git history

---

## 1. Secrets Scan Summary

### Method
Manual regex scanning + pattern matching across all `.js`, `.ts`, `.mjs`, `.json`, and `.env*` files. Git history reviewed using `git log -S` for high-entropy strings. Patterns checked:

- JWT tokens (`eyJ...`)
- API keys (`sk-`, `re_`, `ghp_`, `AKIA...`)
- Long base64 strings (≥40 chars)
- Supabase service role JWTs
- Telegram bot tokens
- Hardcoded password literals

### Findings

| Severity | File | Finding | Status |
|---|---|---|---|
| 🔴 **HIGH** | `backend/src/supabase.js` | Hardcoded Supabase service role JWT + project URL | **FIXED in this PR** |
| ✅ PASS | `backend/src/middleware/auth.js` | Admin token reads from `process.env.DC1_ADMIN_TOKEN` only | No action needed |
| ✅ PASS | `backend/src/services/email.js` | Resend API key reads from env; startup rejects placeholder | No action needed |
| ✅ PASS | `backend/src/services/notifications.js` | Telegram token loaded from DB config, never hardcoded | No action needed |
| ✅ PASS | `backend/.env` | Not tracked in git (confirmed via `git ls-files`) | No action needed |
| ✅ PASS | All test files | Use `test-admin-token` placeholder — never real credentials | No action needed |

---

## 2. Critical Finding: Hardcoded Supabase Service Key

**File:** `backend/src/supabase.js` (introduced commit `cb1f618`)

**Severity:** HIGH
**Impact:** The Supabase `service_role` JWT grants full database access bypassing Row Level Security. Anyone with repo read access (or git history access) could read/write all user data, provider keys, and wallet balances.

**Fix applied (this PR):**

```js
// Before — hardcoded credential committed to git
const SUPABASE_URL = 'https://rwxqcqgjszvbwcyjfpec.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// After — reads from environment variables with startup guard
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}
```

**Required action for founder / DevOps (URGENT — key is in git history):**

1. **Rotate the Supabase service key immediately** — the old key is in git history and must be considered compromised.
   - Supabase Dashboard → Project → Settings → API → Roll service role key
2. **Add to backend `.env`** on production VPS:
   ```
   SUPABASE_URL=https://rwxqcqgjszvbwcyjfpec.supabase.co
   SUPABASE_SERVICE_KEY=<new-rotated-service-role-key>
   ```
3. **Do NOT rewrite git history** — key rotation is the correct remediation; history rewriting causes more disruption than it prevents at this point.

---

## 3. Environment Variable Audit

### Variables required at runtime

| Variable | Used By | Validated at Startup | In `.env.example` |
|---|---|---|---|
| `DC1_ADMIN_TOKEN` | `middleware/auth.js` | ✅ Yes — rejects missing/placeholder | ✅ Root `.env.example` |
| `DC1_HMAC_SECRET` | `services/jobSweep.js` | ✅ Yes (HMAC signing) | ✅ Root `.env.example` |
| `SUPABASE_URL` | `backend/src/supabase.js` | ✅ **Now validated** (this PR) | ✅ `backend/.env.example` (new) |
| `SUPABASE_SERVICE_KEY` | `backend/src/supabase.js` | ✅ **Now validated** (this PR) | ✅ `backend/.env.example` (new) |
| `RESEND_API_KEY` | `services/email.js` | ✅ Yes — warns on `CHANGE_ME_` placeholder | ✅ `backend/.env.example` (new) |
| `DC1_DB_PATH` | `routes/admin.js`, `db.js` | Defaults to `./data/providers.db` (safe) | ✅ `backend/.env.example` (new) |

### Gap found: `backend/.env.example` missing

No template existed for backend env vars. **Created in this PR** at `backend/.env.example`.

### Hardcoded values scan: PASS (after fix)

All secret-class values in `backend/src/` now come from `process.env.*`. No string literals match secret patterns.

---

## 4. Admin Endpoint Protection Audit

### Protection mechanism

All `/api/admin/*` routes are protected via `router.use(requireAdminAuth)` applied at the top of `backend/src/routes/admin.js` — before any route handlers are registered.

`requireAdminAuth` in `backend/src/middleware/auth.js`:
- Reads `DC1_ADMIN_TOKEN` from env only (no hardcoded fallback)
- Returns `503` if env var is missing (fails closed)
- Returns `401` if token doesn't match
- Uses `crypto.timingSafeEqual()` — no timing oracle

### Bypass test: Renter JWT to `/api/admin/*`

A renter's `X-Renter-Key` header is not read by `getAdminTokenFromReq()`, which only reads `x-admin-token` or `Authorization: Bearer`. Even if a renter sends a Bearer token, `secureTokenEqual()` compares it against `DC1_ADMIN_TOKEN` — it would not match.

**Result: A normal renter JWT cannot access `/api/admin/*`. Returns `401`.**

### Verdict: PASS — admin routes properly isolated

No gaps found. No route in `admin.js` registers handlers before `router.use(requireAdminAuth)`.

---

## 5. Actions Required

| Priority | Action | Owner | Timing |
|---|---|---|---|
| 🔴 CRITICAL | Rotate Supabase service role key in Supabase dashboard | Founder / DevOps | Immediately on PR merge |
| 🔴 CRITICAL | Add `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` to backend `.env` on VPS | DevOps | Before next backend restart |
| ✅ Done | Remove hardcoded credentials from `supabase.js` | Security Engineer | This PR |
| ✅ Done | Create `backend/.env.example` | Security Engineer | This PR |

---

## 6. Files Changed in This PR

| File | Change |
|---|---|
| `backend/src/supabase.js` | Remove hardcoded credentials; read from `process.env` with startup guard |
| `backend/.env.example` | New file — template for all required backend env vars |
| `docs/security/secrets-scan-results.md` | This document |
