# DCP-628: VPS Deployment Coordination & Smoke Tests

**Issue:** DCP-628 — S26: VPS health monitoring + deployment coordination
**Status:** Sprint 26 Infrastructure
**Owner:** DevOps Automator
**Coordinate with:** Founding Engineer (DCP-621)

---

## Overview

This document outlines the deployment coordination process for Phase 1 and ongoing VPS management. Split into two workstreams:

1. **Continuous Monitoring** — PM2 health checks every 5 minutes (automated)
2. **Deployment Coordination** — Manual post-deploy smoke tests and verification

---

## Part 1: Continuous Monitoring (Automated)

### PM2 Health Check Configuration

**File:** `backend/ecosystem.config.js`
**Service:** `dcp-vps-health-cron`
**Schedule:** Every 5 minutes (`*/5 * * * *`)
**Log:** `/root/dc1-platform/backend/logs/vps-health.log`

#### Monitored Metrics

- **Disk usage:** Alert if `> 80%`
- **Memory usage:** Alert if `> 90%`
- **CPU usage:** Alert if `> 85%`
- **PM2 process status:** Alert if any process not `ONLINE`
- **Port 8083:** Verify backend listening
- **SQLite DB size:** Warn if `> 500MB`
- **Backend error logs:** Report recent errors
- **Load average:** Baseline monitoring

#### Alert Mechanism

Alerts sent via Telegram to chat ID `7652446182` (DevOps channel).

**Enable Telegram alerts on VPS:**
```bash
export TELEGRAM_BOT_TOKEN=<your-token>
pm2 restart dcp-vps-health-cron
```

**Alert cooldown:** 30 minutes between repeated alerts (prevents spam)

#### Manual Health Check

Run immediately on VPS:
```bash
cd /root/dc1-platform
./scripts/vps-health.sh
```

Output example:
```
=== DCP VPS Health Check (2026-03-23T11:30:00Z) ===
[PASS] Disk: 45% used (180G/400G)
[PASS] Memory: 8G/16G used (50%)
[PASS] CPU usage: 22%
[PASS] Load avg: 0.5 0.3 0.2
[PASS] PM2: dc1-provider-onboarding ONLINE
[PASS] Port 8083: LISTENING
...
Summary: 8/8 checks passed, 0 warnings, 0 failures
```

---

## Part 2: Deployment Coordination (Manual)

### Pre-Deployment Checklist

**Before pulling Sprint 25 commits to VPS:**

- [ ] All commits merged to `main` branch
- [ ] CI/CD pipeline passed on `main`
- [ ] Database migration scripts reviewed (if any)
- [ ] Environment variables updated on VPS (if needed)
- [ ] Backup of current VPS state created
- [ ] Rollback procedure tested

### Deployment Steps (Founding Engineer — DCP-621)

1. **SSH into VPS**
   ```bash
   ssh root@76.13.179.86
   cd /root/dc1-platform
   ```

2. **Pull Sprint 25 commits**
   ```bash
   git fetch origin main
   git checkout main
   git pull origin main
   ```

3. **Install/update dependencies**
   ```bash
   npm ci  # or npm install if package-lock.json changed
   ```

4. **Run database migrations** (if any)
   ```bash
   node backend/src/scripts/migrate.js  # (if migration script exists)
   ```

5. **Restart PM2 services**
   ```bash
   pm2 restart ecosystem.config.js --env production
   pm2 save  # Save PM2 process list for auto-restart on reboot
   ```

6. **Verify PM2 status**
   ```bash
   pm2 status
   pm2 logs dc1-provider-onboarding  # Watch logs for errors
   ```

### Post-Deployment Smoke Tests

**Run immediately after deployment:**

```bash
cd /root/dc1-platform
./scripts/smoke-test.sh
```

#### Test Coverage

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| Frontend health | `https://dcp.sa` | HTTP 200 |
| Frontend brand | Check DCP logo in HTML | Found |
| Terms page | `https://dcp.sa/terms` | HTTP 200 |
| Privacy page | `https://dcp.sa/privacy` | HTTP 200 |
| Renter marketplace | `https://dcp.sa/renter/marketplace` | HTTP 200 |
| API health | `api.dcp.sa/api/health` | JSON with status=ok |
| Provider availability | `api.dcp.sa/api/providers/available` | HTTP 200 + provider list |
| Provider registration validation | POST bad data | HTTP 400/422 |
| Renter auth check | No token | HTTP 401 |
| Admin auth check | No x-admin-token | HTTP 401 |
| Security: top-up unsigned | Invalid request | HTTP 400/401/403/422 |
| Security: admin dashboard | No token | HTTP 401 |

#### Smoke Test Output Example

```
[INFO] Running DCP smoke tests against https://dcp.sa and http://76.13.179.86:8083/api
[PASS] Frontend: dcp.sa returns 200
[PASS] Frontend: DCP brand found in HTML
[PASS] Frontend: /terms returns 200
[PASS] Frontend: /privacy returns 200
[PASS] Frontend: /renter/marketplace returns 200
[PASS] API Health: status ok with db/providers/jobs fields
[PASS] API: /providers/available returns 200
[PASS] API: /providers/register invalid payload rejected
[PASS] API: /renters/me without key is unauthorized
[PASS] Admin: /admin/providers without auth is unauthorized
[PASS] Security: free top-up endpoint rejects unsigned request
[PASS] Security: admin dashboard without x-admin-token is unauthorized

Summary: 12/12 passed, 0 failed
```

### Webhook Verification

**Verify webhook is live and receiving events:**

```bash
# Check webhook logs on VPS
tail -f /root/dc1-platform/backend/logs/webhook.log

# Manually trigger a test webhook
curl -X POST https://api.dcp.sa/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"event": "provider.registered", "providerId": "test-123"}'

# Expected: webhook handler processes event without error
```

### Performance Baseline

After successful smoke tests, record baseline metrics:

```bash
# Record current metrics for comparison
echo "Deployment: $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> /root/dc1-platform/backend/logs/deployment-baseline.log
./scripts/vps-health.sh >> /root/dc1-platform/backend/logs/deployment-baseline.log
pm2 status >> /root/dc1-platform/backend/logs/deployment-baseline.log
```

---

## Part 3: Rollback Procedure

If smoke tests **fail**, rollback immediately:

```bash
cd /root/dc1-platform

# Option A: Revert to previous commit
git reset --hard HEAD~1
npm ci

# Option B: Restore from backup (if available)
# cp -r /backup/dc1-platform-before-sprint25/* .

# Restart services
pm2 restart ecosystem.config.js --env production
pm2 save

# Re-run smoke tests
./scripts/smoke-test.sh
```

### Rollback Triggers

Automatic rollback triggered if:
- API health check fails (returns non-200)
- More than 2 core services offline
- Database connection fails
- Critical endpoints (provider registration, renter auth) fail

---

## Continuous Monitoring Dashboard

**Health check history location:**
`/root/dc1-platform/backend/logs/vps-health.log`

**View recent checks:**
```bash
tail -50 /root/dc1-platform/backend/logs/vps-health.log
```

**Analyze trends:**
```bash
grep "PASS\|WARN\|FAIL" /root/dc1-platform/backend/logs/vps-health.log | tail -20
```

---

## Escalation Contacts

- **DevOps issues:** @DevOps Automator
- **Deployment issues:** @Founding Engineer (DCP-621)
- **Alert handling:** On-call via Telegram (chat ID 7652446182)
- **Critical incidents:** @CEO

---

## Related Issues

- **DCP-621:** Provider activation & VPS deployment (Founding Engineer)
- **DCP-523:** Governance gate (Board decision)
- **SP25-004:** Renter billing dashboard
- **SP25-005:** Provider earnings dashboard

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-03-23 | Initial deployment coordination guide | DevOps Automator |
| | PM2 health check: 5-min interval | |
| | Smoke test automation checklist | |
| | Rollback procedure | |
