# Sprint 27 VPS Deployment Runbook

**Target host:** 76.13.179.86
**Working dir:** `/root/dc1-platform`
**Requires:** Founder (Peter / setup@oida.ae) written approval before execution
**Status:** READY TO EXECUTE — awaiting approval

---

## Pre-Deployment Checklist (do before SSH)

- [ ] Verify main branch is green: `git log --oneline -5` locally
- [ ] Confirm no in-progress jobs on VPS: `curl https://api.dcp.sa/api/jobs/queue/status`
- [ ] Confirm provider count: `curl https://api.dcp.sa/api/providers/marketplace | grep total`
- [ ] Schedule maintenance window (no active renters on platform yet — safe any time)
- [ ] Have rollback tag ready: note current VPS commit with `git rev-parse HEAD` on VPS

---

## Phase 1 — Pull New Code

```bash
# SSH to VPS
ssh root@76.13.179.86

# Navigate to repo
cd /root/dc1-platform

# Check current deployed commit (note for rollback)
git rev-parse HEAD
# Expected: some pre-Sprint-25 commit (e.g., before 4b394c0)

# Pull all Sprint 25 + 26 + 27 commits
git fetch origin
git pull origin main

# Verify new HEAD matches expected
git log --oneline -5
# Should show: 15cb277 feat(templates): Load docker-templates from API instead of hardcoded list
```

---

## Phase 2 — Install Dependencies (CRITICAL — prevents 502 errors)

**⚠️ MUST DO THIS STEP.** The VPS has `better-sqlite3` and `sharp` — both native modules that must be
rebuilt for the VPS node version. Skipping this caused 502 errors in previous deployments.

```bash
cd /root/dc1-platform/backend

# Full install (picks up any new packages + rebuilds native modules)
npm install

# Verify better-sqlite3 rebuilt successfully
node -e "require('better-sqlite3'); console.log('sqlite3 OK')"

# Verify sharp rebuilt
node -e "require('sharp'); console.log('sharp OK')"
```

Expected output: both print `OK`. If either fails with `ENOENT` or `invalid ELF`, run:
```bash
npm rebuild better-sqlite3
npm rebuild sharp
```

---

## Phase 3 — Run Database Migrations

The serve_sessions schema was updated in commit `e21d09a` (Sprint 26 metering fix):
- `provider_id` column made nullable (was NOT NULL)
- `port` column made nullable

The migration is automatic on server start (uses `PRAGMA table_info` to detect old schema).
No manual SQL needed. **Verify the migration ran** after restart (see Phase 5).

---

## Phase 4 — Verify / Update Environment Variables

```bash
# Check current env vars are set
pm2 show dc1-provider-onboarding | grep -E "DC1_ADMIN_TOKEN|DC1_HMAC_SECRET|BACKEND_URL"
```

**Required env vars (must be non-empty):**

| Variable | Purpose | How to generate |
|---|---|---|
| `DC1_ADMIN_TOKEN` | Admin API auth | `openssl rand -hex 32` |
| `DC1_HMAC_SECRET` | Job HMAC signing | `openssl rand -hex 32` |

**Verify these are set on VPS** — if empty, job signing breaks (providers won't accept tasks).

**New in Sprint 26 — check if set:**

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Should include `https://dcp.sa,https://www.dcp.sa` |
| `FRONTEND_URL` | Should be `https://dcp.sa` |
| `BACKEND_URL` | Should be `https://api.dcp.sa` |

To update an env var without full restart, edit `ecosystem.config.js` then do `pm2 reload`:
```bash
# Edit ecosystem.config.js env section
nano /root/dc1-platform/backend/ecosystem.config.js
# Set DC1_ADMIN_TOKEN, DC1_HMAC_SECRET etc.

# Save, then reload (zero-downtime)
pm2 reload ecosystem.config.js --only dc1-provider-onboarding
```

---

## Phase 5 — Restart PM2 Services

```bash
cd /root/dc1-platform/backend

# Reload with latest ecosystem.config.js (zero-downtime rolling restart)
pm2 reload ecosystem.config.js

# If reload fails or config changed structurally, use full restart:
pm2 restart ecosystem.config.js

# Verify all processes are online
pm2 list
```

Expected pm2 list output:
```
┌──────────────────────────────┬───────┬────────┬──────┐
│ name                         │ mode  │ status │ pid  │
├──────────────────────────────┼───────┼────────┼──────┤
│ dc1-provider-onboarding      │ fork  │ online │ XXXX │
│ dcp-vps-health-cron          │ fork  │ online │ XXXX │
│ dcp-job-volume-cleanup-cron  │ fork  │ online │ XXXX │
│ dcp-stale-provider-sweep-cron│ fork  │ online │ XXXX │
│ dcp-db-backup-cron           │ fork  │ online │ XXXX │
│ dcp-log-rotation-cron        │ fork  │ online │ XXXX │
└──────────────────────────────┴───────┴────────┴──────┘
```

---

## Phase 6 — Post-Deploy Verification

Run these checks from your local machine (external):

```bash
# 1. Health check
curl https://api.dcp.sa/api/health
# Expected: {"status":"ok"} or similar 200 response

# 2. Auth regression fix (Sprint 25 security) — should now require auth
curl https://api.dcp.sa/api/jobs/active
# Expected: 401 Unauthorized (NOT a 200 with data — that was the old bug)

# 3. New templates endpoint live
curl https://api.dcp.sa/api/templates
# Expected: {"templates":[...],"count":20} — 20 templates served

# 4. New models endpoint live
curl https://api.dcp.sa/api/models
# Expected: JSON with arabic model catalog

# 5. Provider count unchanged
curl https://api.dcp.sa/api/providers/marketplace
# Expected: 43+ providers registered (not fewer — a drop = migration issue)

# 6. Serve sessions schema fix (metering)
# SSH to VPS and run:
sqlite3 /root/dc1-platform/backend/data/providers.db \
  "PRAGMA table_info(serve_sessions);" | grep provider_id
# Expected: column exists, notnull=0 (nullable)
```

---

## Rollback Procedure

If any check fails after restart:

```bash
# On VPS — revert to previous commit
git log --oneline -10  # find the pre-sprint-25 commit hash
git checkout <old-commit-hash> -- backend/

# Reinstall deps for that version
cd backend && npm install

# Restart
pm2 restart dc1-provider-onboarding

# Verify
curl https://api.dcp.sa/api/health
```

If rollback is needed, **immediately post to DCP issue** with what failed and the rollback commit hash.

---

## What This Deploy Delivers

| Feature | Sprint | Commit Range |
|---|---|---|
| Auth fix: `/api/jobs/active` requires auth | S25 | `4b394c0` |
| Serve_sessions metering fix (nullable provider_id) | S26 | `e21d09a` |
| Template catalog API (`/api/templates`) | S27 | current |
| Model catalog API (`/api/models`) | S27 | current |
| Arabic portfolio config | S26 | `600e6d5` area |
| P2P network bootstrap | S26 | `DCP-612` commits |

**Total: ~91 commits** not yet live on VPS.

---

## Request Approval

To approve this runbook, the founder should post in [DCP-648](/DCP/issues/DCP-648):

> "Approved — proceed with sprint27-vps-runbook.md"

The Founding Engineer will execute immediately upon that confirmation.
