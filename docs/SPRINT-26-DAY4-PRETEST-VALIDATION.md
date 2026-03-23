# Sprint 26 Day 4 Pre-Test Validation Checklist (2026-03-26)

**QA Lead:** agent 891b2856-c2eb-4162-9ce4-9f903abd315f
**Date:** 2026-03-23 (prepared for 2026-03-26 execution)
**Purpose:** Ensure all infrastructure and systems are ready for Day 5 integration testing

---

## Overview

Day 4 is the final preparation day before Day 5 (2026-03-27) integration testing. This document provides a detailed validation checklist to confirm that all 6 Sprint 26 deliverables are operational and test-ready.

**Critical Path:**
1. Verify infrastructure is healthy
2. Test all test scripts locally
3. Confirm credentials and access
4. Validate database state
5. Confirm service endpoints
6. Brief team on Day 5 procedures

---

## Section 1: Infrastructure Health Check (08:00-08:30)

### 1.1 VPS Connectivity & SSH Access

```bash
# Test SSH access to live VPS
ssh root@76.13.179.86 "echo 'VPS accessible'; uptime"

# Expected output:
# VPS accessible
# [uptime info]
```

**Checklist:**
- [ ] SSH access works
- [ ] VPS responding (uptime < 14 days typical)
- [ ] No firewall blocks
- [ ] SSH keys valid

**Troubleshooting:**
- If SSH timeout: Check firewall rules, SSH key permissions
- If auth fails: Verify SSH key in ~/.ssh/, try ssh -v for debug

---

### 1.2 Disk Space & Memory

```bash
ssh root@76.13.179.86 << 'EOF'
echo "=== Disk Usage ==="
df -h | grep root
echo ""
echo "=== Memory ==="
free -h
echo ""
echo "=== Load Average ==="
uptime
EOF

# Expected:
# - Root disk: <70% used (preferably <50%)
# - Memory: >8GB free (16GB total)
# - Load: <4.0
```

**Checklist:**
- [ ] Disk usage <70%
- [ ] Memory >8GB free
- [ ] Load average reasonable

**If Disk Full:**
1. Check log sizes: `du -sh /root/dc1-platform/backend/logs/`
2. Rotate logs: `ssh root@76.13.179.86 rm -f /root/dc1-platform/backend/logs/app.log.old`
3. Verify >10GB free before testing

---

### 1.3 PM2 Services Status

```bash
ssh root@76.13.179.86 pm2 status

# Expected output:
# ┌─────────────────────────────────────┬─────┬──────┐
# │ name                    │ pid  │ status  │
# ├─────────────────────────────────────┼─────┼──────┤
# │ dc1-provider-onboarding │ XXXX │ online  │
# │ dc1-webhook             │ XXXX │ online  │
# └─────────────────────────────────────┴─────┴──────┘
```

**Checklist:**
- [ ] dc1-provider-onboarding: ONLINE
- [ ] dc1-webhook: ONLINE
- [ ] Both CPU/memory usage normal
- [ ] Restart count: 0 or minimal

**If Service is Down:**
1. Check logs: `ssh root@76.13.179.86 pm2 logs dc1-provider-onboarding --lines 50`
2. Restart: `ssh root@76.13.179.86 pm2 restart dc1-provider-onboarding`
3. Verify restart with `pm2 status` again

---

### 1.4 Port Accessibility

```bash
# Test backend port 8083
curl -I https://api.dcp.sa/health

# Expected: 200 OK or 404 (depending on endpoint)
# Do NOT expect 503, 502, timeout

# Test metrics endpoint
curl -s https://api.dcp.sa/api/metrics | head -20
```

**Checklist:**
- [ ] api.dcp.sa:443 responds
- [ ] HTTPS certificate valid (not expired)
- [ ] HTTP → HTTPS redirect working
- [ ] No connection timeouts

**If Port Not Responding:**
1. Check nginx: `ssh root@76.13.179.86 systemctl status nginx`
2. Check backend: `ssh root@76.13.179.86 pm2 logs dc1-provider-onboarding`
3. Restart nginx: `ssh root@76.13.179.86 systemctl restart nginx`

---

## Section 2: Database Validation (08:30-09:00)

### 2.1 Database File Exists & Accessible

```bash
ssh root@76.13.179.86 << 'EOF'
ls -lh /root/dc1-platform/backend/data/providers.db
echo ""
# Should show file size > 1MB (indicates seeding)
sqlite3 /root/dc1-platform/backend/data/providers.db "SELECT count(*) as table_count FROM sqlite_master WHERE type='table';"
EOF

# Expected: File exists, size > 1MB, 10+ tables
```

**Checklist:**
- [ ] providers.db file exists
- [ ] File size > 1MB
- [ ] Tables created (count > 5)
- [ ] No permission errors

---

### 2.2 GPU Pricing Table Seeded

```bash
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/backend/data/providers.db << 'SQL'
SELECT gpu_model, rate_halala_per_hour FROM gpu_pricing ORDER BY rate_halala_per_hour ASC LIMIT 6;
SQL
EOF

# Expected output:
# H100|750000
# RTX 4090|26700
# RTX 4080|20400
# RTX 4090|13350
# ... (6 total)
```

**Checklist:**
- [ ] 6 GPU tiers present
- [ ] RTX 4090: 26700 halala (critical for pricing test)
- [ ] All prices populated (no NULLs)
- [ ] Prices sorted correctly

**If Pricing Empty:**
1. Check backend code: `backend/src/db/seed.js`
2. Run seed manually: `ssh root@76.13.179.86 'cd /root/dc1-platform && node backend/src/db/seed.js'`
3. Verify repopulated with query above

---

### 2.3 Provider & Renter Tables Present

```bash
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/backend/data/providers.db << 'SQL'
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('providers', 'renters', 'jobs', 'serve_sessions');
SQL
EOF

# Expected:
# providers
# renters
# jobs
# serve_sessions
```

**Checklist:**
- [ ] providers table exists
- [ ] renters table exists
- [ ] jobs table exists
- [ ] serve_sessions table exists

---

### 2.4 Serve Sessions Table Schema

```bash
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/backend/data/providers.db ".schema serve_sessions"
EOF

# Expected columns:
# id, job_id, model, total_inferences, total_tokens, total_billed_halala, last_inference_at, created_at, updated_at
```

**Checklist:**
- [ ] total_tokens column exists
- [ ] total_billed_halala column exists
- [ ] last_inference_at column exists
- [ ] job_id is indexed (for admin queries)

---

## Section 3: Test Script Validation (09:00-09:30)

### 3.1 Verify Test Script Locations

```bash
# Check local test files
ls -l backend/tests/integration/admin-endpoints.test.js
ls -l backend/tests/integration/pricing-api.test.js
ls -l scripts/phase1-e2e-smoke.mjs
ls -l docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md

# Should show all files exist
```

**Checklist:**
- [ ] admin-endpoints.test.js exists
- [ ] pricing-api.test.js exists
- [ ] phase1-e2e-smoke.mjs exists and is executable
- [ ] All test documentation present

**If Files Missing:**
1. Check git status: `git status | grep 'deleted'`
2. Restore if deleted: `git checkout backend/tests/integration/admin-endpoints.test.js`
3. Verify test framework deps: `npm list jest`

---

### 3.2 npm Test Dry-Run

```bash
# Test that npm test infrastructure works
cd backend
npm run test:integration -- --help 2>&1 | head -5

# Should show Jest help output (not error)
```

**Checklist:**
- [ ] npm test command works
- [ ] Jest is installed
- [ ] No dependency errors
- [ ] Test files are discoverable

---

### 3.3 Smoke Test Script Validation

```bash
# Check script syntax
node -c scripts/phase1-e2e-smoke.mjs

# Should output nothing (syntax OK)
# If error shown: syntax problem, must fix
```

**Checklist:**
- [ ] Script syntax valid
- [ ] No require errors
- [ ] fetch() available (Node 18+)
- [ ] Script is executable: `chmod +x scripts/phase1-e2e-smoke.mjs`

---

## Section 4: Credentials & Environment Validation (09:30-10:00)

### 4.1 Admin Token Validation

```bash
# Verify admin token is available
echo "Admin token present: ${#DC1_ADMIN_TOKEN}"

# Should output: "Admin token present: 128" (or similar, not "0")

# If zero, set token:
export DC1_ADMIN_TOKEN="<your-admin-token-here>"
```

**Checklist:**
- [ ] DC1_ADMIN_TOKEN environment variable set
- [ ] Token length > 50 characters
- [ ] Token not expired (check token creation date)
- [ ] Token valid for /api/admin/* endpoints

**To Get/Validate Admin Token:**
1. Check if token stored: `cat ~/.dcp-admin-token 2>/dev/null`
2. Query backend for token validity: `curl -s https://api.dcp.sa/api/admin/validate-token -H "Authorization: Bearer $DC1_ADMIN_TOKEN"`
3. If invalid, regenerate from backend code

---

### 4.2 Test Renter Key Validation

```bash
# Create test renter (do this Day 4 to get fresh key)
curl -s -X POST https://api.dcp.sa/api/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA-Test-Renter-'$(date +%s)'",
    "email": "qa-test-'$(date +%s)'@dcp.local"
  }' | jq '.api_key'

# Should output a 64+ character key
# Save this key: export DCP_RENTER_KEY="<key>"
```

**Checklist:**
- [ ] Can create test renter
- [ ] API key returned successfully
- [ ] Key saved to environment variable
- [ ] Different key each time (no cache issues)

---

### 4.3 API Base URL Validation

```bash
# Verify API URL is set and responds
echo "API Base: ${DCP_API_BASE}"
curl -s -I "${DCP_API_BASE}/api/renters/pricing"

# Expected:
# API Base: https://api.dcp.sa
# HTTP/2 200
```

**Checklist:**
- [ ] DCP_API_BASE set correctly
- [ ] HTTPS URL (not HTTP)
- [ ] Responds to health checks
- [ ] Certificate valid

---

## Section 5: Network & Firewall Check (10:00-10:15)

### 5.1 Latency to VPS

```bash
# Test network latency
ping -c 4 api.dcp.sa

# Expected: <150ms average latency
```

**Checklist:**
- [ ] Latency <150ms (acceptable)
- [ ] 0% packet loss
- [ ] No timeout errors
- [ ] Consistent response times

**If High Latency:**
1. Check ISP connection
2. Try: `traceroute api.dcp.sa` to identify bottleneck
3. Consider testing from different location/network

---

### 5.2 DNS Resolution

```bash
# Verify DNS resolves correctly
nslookup api.dcp.sa
dig api.dcp.sa +short

# Should resolve to 76.13.179.86
```

**Checklist:**
- [ ] api.dcp.sa resolves to 76.13.179.86
- [ ] Both nslookup and dig return same IP
- [ ] No NXDOMAIN errors
- [ ] DNS propagation complete

---

## Section 6: Monitoring Tool Setup (10:15-10:30)

### 6.1 Terminal Windows Prepared

Prepare these 3 terminal windows to run in parallel during Day 5 testing:

**Terminal 1: VPS Health Monitor**
```bash
watch -n 5 'ssh root@76.13.179.86 ./scripts/vps-health.sh'
```

**Terminal 2: Application Log Monitor**
```bash
ssh root@76.13.179.86 tail -f /root/dc1-platform/backend/logs/app.log | grep -E "ERROR|WARN|metering|billing"
```

**Terminal 3: Database Health Monitor**
```bash
watch -n 10 'ssh root@76.13.179.86 sqlite3 /root/dc1-platform/backend/data/providers.db "SELECT COUNT(*) as jobs, COUNT(DISTINCT job_id) as unique_jobs FROM serve_sessions;"'
```

**Checklist:**
- [ ] Terminal 1: Can run VPS health script without issues
- [ ] Terminal 2: Can tail logs without timeout
- [ ] Terminal 3: Can query database successfully
- [ ] All three can run simultaneously

---

### 6.2 Slack/Communication Channels

```bash
# Verify communication channels are open
# - Slack channel for Day 5 updates
# - Email list for escalations
# - Discord for team chat (if used)
```

**Checklist:**
- [ ] Slack channel exists and accessible
- [ ] Escalation contacts identified
- [ ] Contact list documented
- [ ] Response time expectations set

---

## Section 7: Test Documentation Review (10:30-11:00)

### 7.1 Execute Handbook Walkthrough

Review Day 5 execution handbook step-by-step:

```bash
# Read through each test section
head -50 docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md
grep "#### Test" docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md
```

**Checklist:**
- [ ] Handbook is clear and unambiguous
- [ ] All test procedures documented
- [ ] All command examples are copy-pasteable
- [ ] No circular dependencies between tests

---

### 7.2 Go/No-Go Criteria Review

```bash
# Review decision criteria
grep -A 20 "GO CRITERIA" docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md
```

**Checklist:**
- [ ] All go criteria are testable
- [ ] All no-go criteria are clear
- [ ] Decision authority identified (CEO)
- [ ] Timeline for decision defined (by noon Day 6)

---

## Section 8: Risk Mitigation (11:00-11:30)

### 8.1 Backup Procedures

```bash
# Ensure database backup exists
ssh root@76.13.179.86 "tar -czf /tmp/db-backup-pretest.tar.gz /root/dc1-platform/backend/data/"

# Verify backup
ls -lh /tmp/db-backup-pretest.tar.gz

# Should be >1MB
```

**Checklist:**
- [ ] Database backup created
- [ ] Backup is readable and valid
- [ ] Backup location documented
- [ ] Restore procedure tested

---

### 8.2 Rollback Procedure

```bash
# Document current git commit
git rev-parse HEAD > /tmp/pre-test-commit.txt
cat /tmp/pre-test-commit.txt

# Should output commit hash (e.g., 48785c4...)
```

**Checklist:**
- [ ] Pre-test commit documented
- [ ] Rollback procedure known
- [ ] Git access verified
- [ ] Code can be rolled back if critical failure

---

### 8.3 Incident Response Plan

Review troubleshooting section:

```bash
grep -n "Troubleshooting\|If.*Fail" docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md | head -20
```

**Checklist:**
- [ ] Escalation contacts identified
- [ ] Critical failure procedures documented
- [ ] Team knows who owns each component
- [ ] Communication plan established

---

## Section 9: Final System Check (11:30-12:00)

### 9.1 Full End-to-End Connectivity Test

```bash
# Quick connectivity test through full stack
curl -s https://api.dcp.sa/api/renters/pricing | jq '.pricing[0]'

# Should return:
# {
#   "gpu_model": "...",
#   "rate_halala_per_hour": 26700,
#   ...
# }
```

**Checklist:**
- [ ] API responds
- [ ] Pricing data present
- [ ] Response format correct
- [ ] No error messages

---

### 9.2 Permission Verification

```bash
# Verify test execution permissions
ls -l scripts/phase1-e2e-smoke.mjs
chmod +x scripts/phase1-e2e-smoke.mjs

# Verify write permissions for logs
touch backend/logs/test.log && rm backend/logs/test.log
```

**Checklist:**
- [ ] Scripts executable
- [ ] Can write to log directory
- [ ] No permission errors during test prep
- [ ] All team members have required access

---

### 9.3 Team Briefing Preparation

Document for team briefing:

```markdown
## Day 5 Testing Briefing (2026-03-27 09:00)

**Schedule:**
- 09:00: Infrastructure check
- 09:30: Metering API tests (QA Eng)
- 09:35: Pricing integration tests (QA Eng)
- 09:37: VPS & Container health (DevOps)
- 09:42: Provider onboarding tests (QA Eng)
- 09:52: E2E master smoke test (QA Eng)
- 10:02: Post-test analysis & decision

**Critical Requirements:**
1. Silent metering failures MUST be detected
2. All 12 E2E checks MUST pass
3. RTX 4090 pricing MUST be 26,700 halala
4. 5+ providers MUST be online

**Escalation Procedure:**
- CRITICAL failure → Email CEO immediately
- Timeout → Check logs in Terminal 2
- Database issue → Use Terminal 3 to inspect

**Success Criteria:**
If all checks pass → GO for Phase 1 launch
If any CRITICAL check fails → Escalate and retest
```

**Checklist:**
- [ ] Briefing document prepared
- [ ] All team members notified
- [ ] Schedule published
- [ ] Escalation contacts confirmed

---

## Day 4 Sign-Off

**QA Lead Signature:** ___________________________
**Date:** 2026-03-26
**Status:** ☐ ALL CHECKS PASS — READY FOR DAY 5
          ☐ ISSUES FOUND — ESCALATE & RESOLVE

---

## Sign-Off Confirmation

When Day 4 checklist is 100% complete, update this document:

```bash
echo "✅ ALL DAY 4 CHECKS PASSED — PHASE 1 MVP TESTING READY"
git add docs/SPRINT-26-DAY4-PRETEST-VALIDATION.md
git commit -m "docs(qa): Day 4 pre-test validation COMPLETE — all systems ready"
```

---

*QA Coordinator: agent 891b2856-c2eb-4162-9ce4-9f903abd315f*
*Created: 2026-03-23*
*Execution Date: 2026-03-26*
*Phase 1 Launch Readiness: CRITICAL PATH*
