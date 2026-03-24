# Sprint 28 VPS Deployment Manifest

**Status:** PRE-STAGED — DO NOT EXECUTE without founder approval in [DCP-684](/DCP/issues/DCP-684)
**Prepared by:** Backend Architect (DCP-850)
**Date:** 2026-03-24
**Target:** VPS 76.13.179.86 / api.dcp.sa
**Target commit:** `5933d2b` (main HEAD as of 2026-03-24 07:33 UTC)

---

## 0. Go/No-Go Checklist (DevOps: confirm before proceeding)

- [ ] Founder has posted written approval in DCP-684 comments
- [ ] No active job executions (check: `curl https://api.dcp.sa/api/admin/jobs?status=running` → expect 0)
- [ ] Backup confirmed complete (see Step 1)
- [ ] Current PM2 list is healthy (no crashed processes)
- [ ] You have SSH access to 76.13.179.86 as `root`
- [ ] Off-peak window: prefer 02:00–06:00 UTC (low renter activity)

---

## 1. Pre-Deployment Backup (run on VPS)

```bash
# SSH into VPS
ssh root@76.13.179.86

# Backup SQLite database
BACKUP_TS=$(date +%Y%m%d_%H%M%S)
cp /root/dc1-platform/backend/data/providers.db \
   /root/dc1-platform/backend/data/providers.db.backup_${BACKUP_TS}
echo "Backup created: providers.db.backup_${BACKUP_TS}"

# Verify backup is non-empty
ls -lh /root/dc1-platform/backend/data/providers.db.backup_${BACKUP_TS}
```

---

## 2. Pull Latest Code from main

```bash
cd /root/dc1-platform

# Verify current branch and clean state
git status
git branch

# If on main, pull
git pull origin main

# Verify target commit
git log --oneline -3
# Expected first line: 5933d2b chore(review): merge DCP-841 + DCP-842 ...
```

**Expected changes from pull (Sprint 25 → Sprint 28):**

| DCP | What was merged | Backend impact |
|-----|----------------|----------------|
| DCP-767 | Marketplace smoke test suite | `backend/src/routes/jobs.js` (db.transaction fix) |
| DCP-777 | Job dispatch security hardening | `duration_seconds` inflation patch |
| DCP-779 | Live job status feed + heartbeat liveness | New SSE endpoint `/api/jobs/:id/stream` |
| DCP-780 | Job invoice + settlement records | `invoices.js` route, `pdfkit` dep |
| DCP-781 | GPU model whitelist on job submit | `jobs.js` validation |
| DCP-783 | HTTP provider discovery fallback + security | `providers.js` IP hardening |
| DCP-785 | Template catalog speed filter | `templates.js` |
| DCP-786 | Sprint 28 security audit (5 endpoints) | Auth + input validation patches |
| DCP-789 | P2P provider heartbeat monitoring | `p2p.js` route |
| DCP-794 | Arabic RAG pipeline API | `routes/arabic-rag.js` new route |
| DCP-799 | Wallet top-up audit + withdrawal flow docs | `payments.js` |
| DCP-802 | Provider self-test + activation endpoints | `providers.js` |
| DCP-805 | API rate limiting (per-renter-key limits) | `middleware/rateLimiter.js` |
| DCP-811 | Halala accounting spec + fee reconciliation | `reconciliation.js` script |
| DCP-813 | Provider earnings dashboard | `providers.js` earnings endpoint |
| DCP-826 | P2P local test harness | `p2p/` dir (no backend impact) |
| DCP-834 | Arabic RAG-as-a-Service pipeline | `routes/arabic-rag.js` expanded |
| DCP-841 | Job queue + SSE e2e tests | `backend/tests/` (test only) |
| DCP-842 | Payment flow smoke test | `scripts/test-payment-flow.mjs` (test only) |
| DCP-846 | Renter balance topup + bank transfer | `payments.js` bank transfer endpoint |
| DCP-847 | Heartbeat rate limit + revoked provider check | `providers.js` security patch |
| SEC-011 | Block image_override injection | `templates.js` security fix |

---

## 3. Install Dependencies (if package.json changed)

```bash
cd /root/dc1-platform/backend

# Check if package.json changed since last deploy
git diff HEAD@{1} HEAD -- package.json | grep "^[+-]" | grep -v "^---\|^+++"

# If any changes: reinstall
npm install --production

# Verify key deps present (better-sqlite3 requires native build)
node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')"
node -e "require('pdfkit'); console.log('pdfkit OK')"
node -e "require('express-rate-limit'); console.log('rate-limit OK')"
```

> **Warning:** `better-sqlite3` has a native addon. If `npm install` fails with a build error,
> run `npm rebuild better-sqlite3` first, then retry.

---

## 4. Environment Variable Updates

The following env vars were **added in Sprint 28** and are NOT yet in the VPS environment.
Set them before restart (or add to ecosystem.config.js):

### New Optional Env Vars (Sprint 25–28)

```bash
# Bank transfer details for renter top-up (DCP-846)
# Defaults are safe placeholders if not set — set for production payment flow
export DCP_BANK_IBAN="SA00000000000000000000000"   # Replace with real IBAN
export DCP_BANK_ACCOUNT_NAME="DC1 Compute Platform"  # Company account name
export DCP_BANK_NAME="Al Rajhi Bank"                 # Bank name

# Admin IP allowlist for /api/admin/* (DCP-805)
# Leave empty = admin open to all (protected by DC1_ADMIN_TOKEN only)
# Set to comma-separated CIDRs to restrict admin to specific IPs
export ADMIN_IP_ALLOWLIST=""   # e.g. "185.x.x.x,10.0.0.0/8"

# Trust proxy hops (if behind nginx, set to 1 to get real client IP)
export TRUST_PROXY_HOPS=1

# Daemon changelog message (shown in provider update prompts)
export DAEMON_CHANGELOG="Sprint 28: provider liveness monitoring, earnings dashboard, Arabic RAG."
```

### Existing Vars (already on VPS — verify non-empty)

```bash
echo "DC1_ADMIN_TOKEN: ${DC1_ADMIN_TOKEN:0:8}..."
echo "DC1_HMAC_SECRET: ${DC1_HMAC_SECRET:0:8}..."
echo "MOYASAR_SECRET_KEY: ${MOYASAR_SECRET_KEY:0:8}..."
echo "RESEND_API_KEY: ${RESEND_API_KEY:0:8}..."
echo "FRONTEND_URL: $FRONTEND_URL"
echo "BACKEND_URL: $BACKEND_URL"
echo "CORS_ORIGINS: $CORS_ORIGINS"
```

Expected values:
- `FRONTEND_URL=https://dcp.sa`
- `BACKEND_URL=https://api.dcp.sa`
- `CORS_ORIGINS=https://dcp.sa,https://www.dcp.sa`

---

## 5. Database Migrations

**No manual migrations required.**

The backend uses SQLite with `CREATE TABLE IF NOT EXISTS` for all tables. New tables added
in Sprint 25–28 are automatically created on first startup:

| Table | Added | Purpose |
|-------|-------|---------|
| `job_logs` | Sprint 27 | Line-by-line job stdout streaming |
| `payments` | Sprint 26 | Renter payment records (Moyasar) |
| `renter_credit_ledger` | Sprint 26 | Credit balance audit trail |
| `withdrawals` | Sprint 26 | Provider withdrawal requests |
| `payout_requests` | Sprint 27 | Provider payout queue |
| `provider_api_keys` | Sprint 27 | Per-provider API key issuance |
| `invoices` | Sprint 27 | PDF invoice records (DCP-780) |
| `verification_runs` | Sprint 28 | Provider self-test results (DCP-802) |

The startup sequence runs all `db.exec(CREATE TABLE IF NOT EXISTS ...)` before accepting requests.
A clean startup takes ~2–5 seconds.

---

## 6. PM2 Restart

```bash
cd /root/dc1-platform

# Reload ecosystem config and gracefully restart
pm2 reload ecosystem.config.js --update-env

# OR if reload fails, hard restart:
pm2 restart dc1-provider-onboarding

# Restart cron workers (they inherit new env on next cron trigger)
pm2 restart dcp-vps-health-cron || true
pm2 restart dcp-provider-health-cron || true
pm2 restart dcp-stale-provider-sweep-cron || true
```

**Expected downtime:** < 30 seconds (PM2 graceful reload keeps old process alive until new one is ready)

---

## 7. Health Check Sequence

Run these after PM2 reports `online`. Wait 10 seconds for the server to fully initialize.

```bash
sleep 10

# 1. Basic API health
curl -s https://api.dcp.sa/api/health | jq .
# Expected: {"status":"ok","version":"...","db":"ok"}

# 2. Provider marketplace (used by renters)
curl -s https://api.dcp.sa/api/providers/marketplace | jq '.total // .count'
# Expected: number (>= 0)

# 3. Model catalog (DCP-641 deployment dependency)
curl -s https://api.dcp.sa/api/models | jq 'length'
# Expected: 11 (the arabic model portfolio)

# 4. Templates endpoint
curl -s https://api.dcp.sa/api/templates | jq 'length'
# Expected: number > 0

# 5. Rate limiter active (should return 200, not crash)
curl -s -o /dev/null -w "%{http_code}" https://api.dcp.sa/api/providers/marketplace
# Expected: 200

# 6. Admin endpoint protected (without token should return 401/403)
curl -s -o /dev/null -w "%{http_code}" https://api.dcp.sa/api/admin/providers
# Expected: 401

# 7. PM2 process status
pm2 status
# Expected: dc1-provider-onboarding → online, uptime < 5m
```

---

## 8. Post-Deploy Verification (Phase 1 Readiness)

```bash
# Verify SSE endpoint exists (DCP-779 — live job status feed)
curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Renter-Key: test" \
  https://api.dcp.sa/api/jobs/nonexistent/stream
# Expected: 401 or 404 (not 500)

# Verify Arabic RAG route present (DCP-834)
curl -s -o /dev/null -w "%{http_code}" \
  https://api.dcp.sa/api/templates/arabic-rag/health
# Expected: 200 or 404 (not 500)

# Check backend logs for errors
pm2 logs dc1-provider-onboarding --lines 50 --nostream | grep -i "error\|crash\|FATAL"
# Expected: no FATAL errors, minor warnings OK
```

---

## 9. Rollback Procedure

If the deploy fails (process crashes, 5xx rate spikes, DB errors):

```bash
# Step 1: Roll back to previous commit
cd /root/dc1-platform
git log --oneline -5   # Find previous good commit hash
git checkout <previous-commit-hash>

# Step 2: Restart PM2
pm2 restart dc1-provider-onboarding

# Step 3: Restore DB backup if corrupted
# (SQLite is crash-safe with WAL mode; corruption is unlikely but possible)
pm2 stop dc1-provider-onboarding
cp /root/dc1-platform/backend/data/providers.db.backup_${BACKUP_TS} \
   /root/dc1-platform/backend/data/providers.db
pm2 start dc1-provider-onboarding

# Step 4: Verify health (repeat Step 7 checks)
```

**Rollback target:** The last known-good deployed commit. Check `git log` on VPS before pulling
to record it: `git rev-parse HEAD`.

---

## 10. Estimated Timeline

| Step | Duration |
|------|----------|
| SSH + backup | ~2 min |
| git pull | ~1 min |
| npm install (if needed) | ~3–5 min |
| PM2 reload | <30 sec |
| Health checks | ~2 min |
| **Total (clean path)** | **~8 min** |

---

## 11. Known Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `better-sqlite3` native rebuild needed | Low | Run `npm rebuild better-sqlite3` |
| PM2 fails to gracefully reload | Low | Use `pm2 restart` instead |
| New env vars missing on VPS | Medium | Check Step 4 before restart |
| SQLite WAL file locked during restart | Very Low | WAL mode handles this automatically |
| CORS regression if CORS_ORIGINS unset | Low | Verify env var before restart |

---

## 12. Post-Deploy Notification

Once all health checks pass, post to DCP-684:

```
✅ Sprint 28 deployment complete.
- Commit: <git rev-parse HEAD>
- PM2 status: dc1-provider-onboarding online
- Health: api.dcp.sa/api/health → 200 OK
- Models: 11/11 responding
- Downtime: <30s
```

---

*This manifest is pre-staged per DCP-850. No deployment has occurred.*
*Actual deployment requires explicit written approval in [DCP-684](/DCP/issues/DCP-684).*
