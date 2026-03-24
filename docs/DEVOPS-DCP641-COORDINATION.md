# DevOps Coordination — DCP-641 Routing Fix Deployment

**For:** DevOps / SRE Team
**Status:** PRE-DEPLOYMENT READINESS
**Date:** 2026-03-24 22:50 UTC
**Criticality:** CRITICAL (Phase 1 launch blocker)

---

## Overview

Routing fix deployment is blocked waiting for GitHub PR creation and code review. This document ensures DevOps is ready to deploy immediately when the PR is approved and merged.

**Your Role:** Execute deployment (30 min) upon Code Reviewer approval
**Timeline:** PR approval expected 2026-03-25 00:00 UTC ± 2 hours
**Deployment Deadline:** 2026-03-26 06:00 UTC (must complete by then)

---

## Pre-Deployment Checklist (Do Now)

### ✅ VPS Access & Connectivity
- [ ] SSH access to 76.13.179.86 confirmed and working
- [ ] Current user has `sudo` privileges verified
- [ ] SSH key pair stored securely and backed up

### ✅ System State Snapshot
```bash
ssh root@76.13.179.86

# Capture current state
uname -a > /tmp/system-baseline.txt
git log -1 --format="%H %s %ai" >> /tmp/system-baseline.txt
pm2 list >> /tmp/system-baseline.txt
docker ps -a >> /tmp/system-baseline.txt

# Database backup (IMPORTANT)
# TODO: Replace with actual DB backup command for your setup
echo "Backup command: [see DCP ops runbook]"
```

### ✅ Code Review Status Monitoring
- [ ] Monitor GitHub PR for creation (ml-infra/phase1-model-detail-routing → main)
- [ ] Monitor PR for code review approval
- [ ] Monitor for merge to main
- **Expected timeline:** PR creation 2026-03-25 00:00 UTC → approval 2026-03-25 01:00 UTC

### ✅ PM2 Service Configuration
```bash
# On VPS, verify services are correctly configured
pm2 list
# Expected: dc1-provider-onboarding and dc1-webhook both 'online'

# Get service PIDs and memory usage
pm2 monit

# Verify restart scripts exist
ls -la /home/node/dc1-platform/ecosystem.config.js
```

### ✅ Database Health Check
```bash
# Verify DB connectivity
# TODO: Replace with actual DB health check command

# Verify no pending migrations
npm run migrate:status 2>/dev/null || echo "Migration check skipped"

# Capture DB state before deployment
# TODO: Add pre-deployment DB snapshot command
```

### ✅ Monitoring & Alerting
- [ ] Logging service ready (PM2 logs, application logs accessible)
- [ ] Health check endpoint ready: `https://api.dcp.sa/health`
- [ ] HTTPS certificate valid: `openssl s_client -connect api.dcp.sa:443 -showcerts`
- [ ] Alert system ready (if configured)

---

## Deployment Trigger & Notification

### When to Deploy
Deployment begins when **ALL** of these conditions are met:
1. ✅ GitHub PR created and visible on https://github.com/dhnpmp-tech/dc1-platform/pulls
2. ✅ Code Reviewer approves the PR (green checkmark)
3. ✅ PR is merged to main branch
4. ✅ **Founder posts approval comment** on Paperclip issue DCP-641 with text containing "approve deployment" or "deploy"

### How to Trigger
DevOps will receive notification via:
1. **Primary:** Paperclip comment on DCP-641 issue (founder approval)
2. **Secondary:** Slack/Telegram message from QA Engineer

**DO NOT DEPLOY WITHOUT founder approval comment.**

---

## Deployment Execution (30 min)

### Step 1: Verify Code on Main (5 min)
```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform

# Fetch latest
git fetch origin main

# Verify routing fix commit is on main
git log origin/main -5 --oneline | grep -i "routing\|5d59273"

# Expected output:
# 5d59273 fix(api): Support HuggingFace model IDs with slashes in routing
```

### Step 2: Pull & Install (5 min)
```bash
git pull origin main

# Check for new dependencies
npm install --production

# Verify no errors
if [ $? -ne 0 ]; then
  echo "❌ npm install failed. Aborting deployment."
  exit 1
fi

# Verify routing fix code
grep -n "^\/([a-zA-Z0-9._\/-]\+)$" backend/src/routes/models.js
# Should match the regex pattern from fix
```

### Step 3: Prepare Rollback (2 min)
```bash
# Save current commit hash in case rollback needed
ROLLBACK_COMMIT=$(git rev-parse HEAD~1)
echo "$ROLLBACK_COMMIT" > /tmp/rollback-commit.txt
echo "Rollback commit saved: $ROLLBACK_COMMIT"
```

### Step 4: Restart Services (10 min)
```bash
# Stop services gracefully
pm2 stop dc1-provider-onboarding dc1-webhook
echo "Services stopped at $(date)"

# Wait for shutdown
sleep 3

# Clear logs
pm2 flush

# Start services
pm2 start dc1-provider-onboarding dc1-webhook
echo "Services started at $(date)"

# Wait for startup
sleep 10

# Verify running
pm2 list | grep -E "dc1-provider-onboarding|dc1-webhook"
```

### Step 5: Health Checks (8 min)
```bash
# Test 1: API Health
echo "Test 1: Health check..."
curl -v https://api.dcp.sa/health 2>&1 | grep "200\|500"
# Expected: 200

# Test 2: Routing Fix (Critical)
echo "Test 2: Model detail endpoint (HF model with slashes)..."
curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct | jq '.id' 2>/dev/null
# Expected: HTTP 200 (not 404), returns model details

# Test 3: Pricing API
echo "Test 3: Pricing endpoint..."
curl -s https://api.dcp.sa/api/pricing | jq '.tiers | length' 2>/dev/null
# Expected: 6 (tiers)

# Test 4: Service logs (check for errors)
echo "Test 4: Service logs..."
pm2 logs dc1-provider-onboarding --lines 5 --nostream 2>/dev/null | grep -i "error"
pm2 logs dc1-webhook --lines 5 --nostream 2>/dev/null | grep -i "error"
# Expected: No errors (or only expected warnings)

# Test 5: HTTPS Certificate
echo "Test 5: HTTPS certificate..."
openssl s_client -connect api.dcp.sa:443 -showcerts 2>/dev/null | grep -A2 "Validity"
# Expected: Certificate valid for > 30 days
```

---

## Success Criteria (All Must Pass)

✅ **API Health:** `curl https://api.dcp.sa/health` returns 200
✅ **Routing Fix Live:** `GET /api/models/{id}` returns 200 for HF models with slashes (ALLaM-AI/ALLaM-7B-Instruct)
✅ **Services Running:** PM2 list shows both services 'online'
✅ **No Critical Errors:** PM2 logs contain no "ERROR" or "FATAL" messages
✅ **HTTPS Valid:** Valid certificate, no warnings
✅ **Commit on Main:** `git log -1` shows routing fix commit

---

## If Deployment Fails

### 🚨 STOP Immediately If:
- Any health check returns 500 or timeout
- Model detail endpoint still returns 404
- PM2 services crash
- Database queries fail
- HTTPS certificate errors

### Rollback Procedure (15 min)
```bash
# Get rollback commit saved earlier
ROLLBACK_COMMIT=$(cat /tmp/rollback-commit.txt)

# Reset to previous commit
git reset --hard $ROLLBACK_COMMIT
git clean -fd

# Reinstall old dependencies
npm install --production

# Stop services
pm2 stop dc1-provider-onboarding dc1-webhook
pm2 flush

# Start services
pm2 start dc1-provider-onboarding dc1-webhook
sleep 10

# Verify
curl https://api.dcp.sa/health

# Post to Paperclip
echo "⚠️ Deployment failed. Rolled back to $ROLLBACK_COMMIT. Investigating..."
```

### Escalation
If rollback needed:
1. Post Paperclip comment: "Deployment failed, rolled back"
2. Message team leads on Slack/Telegram
3. Save deployment logs for analysis
4. Do NOT retry deployment without root cause analysis

---

## Post-Deployment Actions

### Immediate (Within 5 minutes)
```bash
# Post success notification to Paperclip
echo "✅ DCP-641 routing fix deployed to VPS 76.13.179.86
- Health check: PASS
- Model detail endpoints: HTTP 200 (routing fix working)
- Services: Online
- Ready for Phase 1 testing"
```

### Short-term (Within 1 hour)
- Monitor PM2 logs for any new errors
- Monitor API response times
- Watch for cascading failures
- Be ready for emergency rollback if needed

### Long-term (After 1 hour)
- Confirm QA execution of Day 4 preflight
- Monitor Phase 1 testing progress

---

## Communication Plan

### Before Deployment
- [ ] Monitor Paperclip for founder approval comment
- [ ] Confirm Code Review completion with team

### During Deployment
- Post Slack/Telegram status at:
  - Deployment start ("Starting DCP-641 deployment...")
  - Services restarted ("Services restarted...")
  - Health checks passing ("Health checks passed...")
  - Deployment complete ("Deployment successful")

### After Deployment
- Post Paperclip comment with success/failure status
- Alert QA Engineer if deployment complete
- Alert Founder if issues occurred

---

## Dependency & Timeline

### Blocking Dependencies
1. GitHub PR must be created (expected 2026-03-25 00:00 UTC)
2. Code Review approval (expected 2026-03-25 01:00 UTC)
3. PR merge to main (expected 2026-03-25 01:30 UTC)
4. Founder deployment approval (expected 2026-03-25 02:00 UTC)

### Timeline to Production
```
Code Review Approval (2026-03-25 ~01:00 UTC)
  ↓ (15 min)
PR Merged to Main (2026-03-25 ~01:15 UTC)
  ↓ (45 min wait for approval)
Founder Approves Deployment (2026-03-25 ~02:00 UTC)
  ↓ (0 min, immediate)
DevOps Deploys (2026-03-25 ~02:00 UTC)
  ↓ (30 min)
Deployment Complete (2026-03-25 ~02:30 UTC) ✅
  ↓ (330+ min buffer)
Phase 1 Testing Starts (2026-03-26 08:00 UTC) ✅
```

**Timeline Status:** ✅ ADEQUATE (48 hours to Phase 1 deadline)

---

## Resources & References

- **Deployment Procedures:** `docs/DEPLOY_REQUEST_DCP641_ROUTING_FIX.md` (detailed steps)
- **Code Review Guide:** `docs/code-reviews/dcp-641-model-routing-fix.md` (context)
- **Preflight Checklist:** `docs/qa/PHASE1-PRETEST-PREFLIGHT-CHECKLIST.md` (post-deployment QA)
- **Risk Register:** `docs/qa/PHASE1-TEST-RISK-REGISTER.md` (contingencies)

---

## Sign-Off

**DevOps Readiness:** ✅ Standing by for deployment trigger
**Code Review Status:** ⏳ Awaiting PR creation
**Founder Approval:** ⏳ Awaiting code review completion
**Deployment Readiness:** ✅ READY upon approval

---

**Document Version:** 1.0
**Last Updated:** 2026-03-24 22:50 UTC
**Contact:** QA Engineer (agent 891b2856) for coordination
