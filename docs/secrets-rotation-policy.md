# DCP Secrets Rotation Policy

**Owner:** Security Engineer
**Created:** 2026-03-24 (DCP-879)
**Review cycle:** Quarterly

---

## 1. Secrets Inventory

All secrets required by the DCP backend, sourced from codebase scan:

| Secret | Env var | Used by | Storage |
|---|---|---|---|
| Admin token | `DC1_ADMIN_TOKEN` | Admin API auth (`/api/admin/*`) | VPS `.env` |
| HMAC signing secret | `DC1_HMAC_SECRET` | Provider heartbeat signature, job task_spec integrity | VPS `.env` |
| Moyasar API key | `MOYASAR_SECRET_KEY` | SAR payment gateway | VPS `.env` |
| Moyasar webhook secret | `MOYASAR_WEBHOOK_SECRET` | Payment webhook HMAC verification | VPS `.env` |
| DCP webhook secret | `DCP_WEBHOOK_SECRET` | Renter job webhook signatures (fallback to renter api_key) | VPS `.env` |
| Supabase JWT | `SUPABASE_JWT_SECRET` | Renter Supabase auth token validation | VPS `.env` |
| Supabase service key | `SUPABASE_SERVICE_KEY` | Renter identity reconciliation | VPS `.env` |
| Bank IBAN | `DCP_BANK_IBAN` | Bank transfer top-up instructions | VPS `.env` |
| Renter API keys | `renters.api_key` in DB | Per-renter auth (`x-renter-key`) | SQLite (plaintext) |
| Provider API keys | `providers.api_key` in DB | Per-provider auth (`x-provider-key`) | SQLite (plaintext) |

---

## 2. Rotation Schedule

### 2a. DC1_ADMIN_TOKEN — Rotate Every 90 Days

**Risk:** Full admin access to all provider/renter data, manual top-ups, job management.

**Rotation procedure:**
1. Generate a new token: `openssl rand -hex 32`
2. Update VPS `.env`: `DC1_ADMIN_TOKEN=<new_token>`
3. Restart the backend: `pm2 restart dc1-provider-onboarding` *(requires founder approval per deployment policy)*
4. Verify: `curl -H "X-Admin-Token: <new_token>" https://api.dcp.sa/api/admin/health`
5. Revoke old token by removing it from `.env` (no DB entry to clean up)

**Trigger rotation immediately if:**
- Personnel with admin access leaves the team
- Token appears in logs, commits, or Slack messages
- Suspected unauthorized access

---

### 2b. DC1_HMAC_SECRET — Rotate on Compromise or Quarterly

**Risk:** Controls provider heartbeat authentication and job task_spec integrity. If leaked, attackers can forge heartbeats or job signatures.

**Important:** Rotating this secret invalidates all in-flight job signatures. Schedule during low-traffic window.

**Rotation procedure:**
1. Generate: `openssl rand -hex 32`
2. Update VPS `.env`: `DC1_HMAC_SECRET=<new_secret>`
3. Notify active provider daemons (they will auto-reconnect on next heartbeat)
4. Restart backend *(founder approval required)*
5. Monitor heartbeat logs for 5 minutes to confirm daemons re-authenticate

**Trigger rotation immediately if:**
- Secret appears in logs or git history
- Unusual heartbeat activity suggesting forged requests

---

### 2c. MOYASAR_SECRET_KEY — Rotate via Moyasar Dashboard

**Risk:** Can initiate payments on behalf of DCP, access transaction history.

**Rotation procedure:**
1. Log into [Moyasar Dashboard](https://dashboard.moyasar.com)
2. Generate new API key under Settings → API Keys
3. Update VPS `.env`: `MOYASAR_SECRET_KEY=<new_key>`
4. Update `MOYASAR_WEBHOOK_SECRET` if Moyasar rotates it simultaneously
5. Restart backend *(founder approval required)*
6. Run a sandbox payment test to confirm

**Trigger rotation:** Quarterly, or immediately on suspected compromise.

---

### 2d. Renter API Keys — Rotate on User Request

**Risk:** Per-renter access to job submission, billing, model inference.

**Rotation procedure (self-service):**
```
POST /api/renters/me/rotate-key
Headers: X-Renter-Key: <current_key>
```
The old key is immediately invalidated and a new `dc1-renter-<32hex>` key is returned.

**Admin-initiated rotation:**
```
PATCH /api/admin/renters/:id  { "rotate_key": true }
```

**Trigger rotation:**
- Renter requests it
- Key appears in a public repository or support ticket
- Quarterly reminder email to active renters (recommended post-Phase 1)

---

### 2e. Provider API Keys — Rotate via Provider Dashboard or Admin

**Risk:** Per-provider access to heartbeat, job acceptance, earnings reporting.

**Rotation procedure:**
- Provider self-service: `POST /api/providers/:id/rotate-key` with current key
- Admin-initiated: `PATCH /api/admin/providers/:id { "rotate_key": true }`

**Trigger rotation:**
- Provider daemon compromised or machine re-imaged
- Key appears in provider logs sent to support
- Quarterly for providers inactive > 30 days

---

### 2f. Supabase Service Key — Rotate via Supabase Dashboard

**Risk:** Service-level access to Supabase DB (renter identity reconciliation).

**Rotation procedure:**
1. Supabase Dashboard → Settings → API → Regenerate service_role key
2. Update VPS `.env`: `SUPABASE_SERVICE_KEY=<new_key>`
3. Restart backend *(founder approval required)*

**Trigger rotation:** On personnel change with Supabase access, or quarterly.

---

## 3. Emergency Rotation Checklist

Use this if a secret is confirmed or suspected compromised:

- [ ] Identify which secret is affected and its blast radius
- [ ] Generate replacement secret immediately
- [ ] Create `DEPLOY REQUEST` issue per deployment policy (no VPS changes without founder approval)
- [ ] After founder approval: update `.env` on VPS, restart affected services
- [ ] Audit access logs for the compromised secret's usage window
- [ ] Rotate any downstream secrets that may have been exposed in the same incident
- [ ] Document the incident: timeline, root cause, response actions
- [ ] Notify affected renters/providers if their keys were exposed

---

## 4. Secret Hygiene Rules

1. **No secrets in git** — all secrets via env vars. Use `.env.example` with placeholder values.
2. **No secrets in logs** — never `console.log` an API key, token, or secret. Log `has_key=true` instead.
3. **No secrets in URLs** — prefer `Authorization` / `X-*-Key` headers over `?key=` query params.
4. **No secrets in Slack/email** — use 1Password or direct VPS access for secret sharing.
5. **Minimum length** — all new secrets must be ≥ 32 bytes (256 bits) of CSPRNG output.
6. **Secrets scan** — run `git grep -i "dc1-renter-\|dc1-sk-\|sk_live\|CHANGE_ME"` before any PR merge.

---

## 5. Rotation Log

| Date | Secret | Reason | Rotated by |
|---|---|---|---|
| 2026-03-24 | *(initial policy — no rotations yet)* | Policy creation | Security Engineer |

*Add a row each time a secret is rotated. Keep this table current.*
