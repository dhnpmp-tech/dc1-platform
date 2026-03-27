# VPS Deploy Sprint 28 — Ready-to-Execute Runbook

**Last Updated:** 2026-03-27
**Sprint:** Sprint 28
**Approver:** Founder (required before execution)

## Overview

This runbook deploys all Sprint 28 features to the production VPS. The deployment is designed to be executable by a non-engineer with basic terminal knowledge.

**Estimated Downtime:** 30-60 seconds (rolling restart)
**Required Approvals:** Founder sign-off on deployment checklist

---

## Pre-Flight Checklist

Run these commands BEFORE starting deployment:

```bash
# 1. Verify SSH access
ssh root@76.13.179.86 "echo 'SSH OK'"

# 2. Check disk space (need 5GB+ free)
ssh root@76.13.179.86 "df -h / | tail -1"

# 3. Verify PM2 is running
ssh root@76.13.179.86 "pm2 list"

# 4. Check current git branch
ssh root@76.13.179.86 "cd /home/node/dc1-platform && git branch --show-current"

# 5. Verify database exists
ssh root@76.13.179.86 "ls -la /home/node/dc1-platform/backend/data/providers.db"

# 6. Check if any deployments are in progress
ssh root@76.13.179.86 "pm2 describe dc1-provider-onboarding | grep 'status\|uptime'"
```

**If any check fails, STOP and report before proceeding.**

---

## Step-by-Step Deployment

### Step 1: Backup Database (Critical!)

```bash
ssh root@76.13.179.86 "cp /home/node/dc1-platform/backend/data/providers.db /home/node/dc1-platform/backend/data/providers.db.backup-$(date +%Y%m%d-%H%M%S)"
echo "Backup created successfully"
```

**Expected Output:** `Backup created successfully`

---

### Step 2: Pull Latest Code

```bash
ssh root@76.13.179.86 "cd /home/node/dc1-platform && git fetch origin && git pull origin main"
```

**Expected Output:** `Already up to date.` or `Updating <hash>..<hash>`

**If conflicts occur, STOP and call engineer.**

---

### Step 3: Install Dependencies

```bash
ssh root@76.13.179.86 "cd /home/node/dc1-platform/backend && npm install --production 2>&1 | tail -5"
```

**Expected Output:** `added <N> packages in <S>s` or `audited <N> packages`

---

### Step 4: Restart Backend Service

```bash
ssh root@76.13.179.86 "pm2 restart dc1-provider-onboarding && pm2 save"
```

**Expected Output:**
```
[PM2] restart() done
[PM2] Saving current process list
[PM2] Successfully saved
```

Wait 10 seconds, then verify:
```bash
ssh root@76.13.179.86 "pm2 describe dc1-provider-onboarding | grep -E 'status|uptime'"
```

**Expected Output:** `status: online` with uptime < 60s

---

### Step 5: Restart Cron Services

```bash
ssh root@76.13.179.86 "pm2 restart dcp-vps-health-cron dcp-job-volume-cleanup-cron dcp-stale-provider-sweep-cron dcp-provider-health-cron dcp-db-backup-cron dcp-log-rotation-cron && pm2 save"
```

**Expected Output:** All services restart successfully

---

## Post-Deploy Smoke Test

Run these 5 curl commands to verify the system is healthy:

### Test 1: Backend Health

```bash
curl -s https://api.dcp.sa/health | head -c 200
```

**Expected Output:** JSON with `status: "ok"` or similar

---

### Test 2: Template Catalog

```bash
curl -s "https://api.dcp.sa/api/templates" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Templates: {len(d.get(\"templates\",[]))}')"
```

**Expected Output:** `Templates: 20+` (should be 20 or more)

---

### Test 3: Arabic RAG Template Exists

```bash
curl -s "https://api.dcp.sa/api/templates" | python3 -c "import sys,json; d=json.load(sys.stdin); ids=[t['id'] for t in d.get('templates',[])]; print('arabic-rag-complete found' if 'arabic-rag-complete' in ids else 'MISSING: arabic-rag-complete')"
```

**Expected Output:** `arabic-rag-complete found`

---

### Test 4: Model Catalog

```bash
curl -s "https://api.dcp.sa/api/models" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Models: {len(d.get(\"models\",[]))}')"
```

**Expected Output:** `Models: <N>` where N > 0

---

### Test 5: Admin Dashboard (requires admin token)

```bash
curl -s -H "x-admin-token: YOUR_ADMIN_TOKEN" "https://api.dcp.sa/api/admin/dashboard" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Providers: {d.get(\"total_providers\",0)}, Jobs: {d.get(\"total_jobs\",0)}')"
```

**Replace `YOUR_ADMIN_TOKEN` with the actual admin token.**

**Expected Output:** `Providers: <N>, Jobs: <M>`

---

## Rollback Procedure

If anything goes wrong, rollback immediately:

### Option A: Quick Rollback (if no conflicts)

```bash
ssh root@76.13.179.86 "cd /home/node/dc1-platform && git checkout HEAD~1 backend/package.json backend/src && pm2 restart dc1-provider-onboarding"
```

### Option B: Full Restore from Backup

```bash
# Find latest backup
ssh root@76.13.179.86 "ls -t /home/node/dc1-platform/backend/data/providers.db.backup-* | head -1"

# Restore (replace <BACKUP_FILE> with actual filename)
ssh root@76.13.179.86 "cp /home/node/dc1-platform/backend/data/providers.db.backup-<TIMESTAMP> /home/node/dc1-platform/backend/data/providers.db"

# Restart service
ssh root@76.13.179.86 "pm2 restart dc1-provider-onboarding"
```

---

## Environment Variables Reference

Required env vars (set in `/root/dc1-platform/backend/.env` or PM2 ecosystem config):

| Variable | Required | Description |
|----------|----------|-------------|
| `DC1_ADMIN_TOKEN` | Yes | Admin API token |
| `DC1_HMAC_SECRET` | Yes | Job signing secret |
| `MOYASAR_SECRET_KEY` | For payments | Payment gateway key |
| `RESEND_API_KEY` | For emails | Email service key |

---

## PM2 Services Reference

All services managed by PM2 on the VPS:

| Service | Purpose | Cron |
|---------|---------|------|
| `dc1-provider-onboarding` | Main backend API | — |
| `dcp-vps-health-cron` | VPS health monitoring | Every 5 min |
| `dcp-job-volume-cleanup-cron` | Cleanup old job volumes | Daily 2:30 AM |
| `dcp-stale-provider-sweep-cron` | Remove stale providers | Every 5 min |
| `dcp-provider-health-cron` | Provider 3-strike deactivation | Every 5 min |
| `dcp-db-backup-cron` | Database backup | Daily 3 AM |
| `dcp-log-rotation-cron` | Log rotation | Daily 4 AM |

---

## Troubleshooting

### Backend won't start

```bash
ssh root@76.13.179.86 "pm2 logs dc1-provider-onboarding --lines 50 --nostream"
```

### Check for port conflicts

```bash
ssh root@76.13.179.86 "lsof -i :8083"
```

### Verify database integrity

```bash
ssh root@76.13.179.86 "sqlite3 /home/node/dc1-platform/backend/data/providers.db 'PRAGMA integrity_check;'"
```

---

## Emergency Contacts

- **Engineering Lead:** Nexus (COO)
- **Founder:** Peter
- **Deploy Lead:** Claude-Cowork (VPS)

---

## Sign-Off

Before deployment, confirm:

- [ ] Pre-flight checklist complete
- [ ] Backup created
- [ ] Rollback procedure reviewed
- [ ] Smoke test commands ready
- [ ] Engineering lead notified

**Deployer Name:** _________________

**Date/Time:** _________________

**Founder Approval:** _________________
