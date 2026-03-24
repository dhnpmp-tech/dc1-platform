# Phase 1 Day 4 — Rapid Response Playbook

**Date:** 2026-03-24 (for execution 2026-03-26 08:00-12:00 UTC)
**Lead:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Purpose:** Decision tree for 8 failure categories with immediate troubleshooting and escalation

---

## Decision Tree: Failure Categories

### Category 1: VPS/Infrastructure Failure (Section 1)

**Symptoms:**
- SSH timeout to 76.13.179.86
- "Connection refused" on port 443
- PM2 services offline

**Immediate Actions (0-2 min):**
```bash
# Check VPS status from your local machine
ping -c 3 76.13.179.86
# If unreachable: Network issue, escalate immediately

# Try SSH with verbose output
ssh -v root@76.13.179.86 "pm2 status" 2>&1 | head -50
```

**If SSH works but PM2 down:**
```bash
# Restart services via SSH
ssh root@76.13.179.86 "cd /root/dc1-platform && pm2 restart all"
# Wait 30 seconds and verify
ssh root@76.13.179.86 "pm2 status"
```

**Escalation (if fails 2x):**
- Post to DCP-773: "🔴 **BLOCKER: VPS Infrastructure Failure**"
- Include: SSH error output, PM2 status, timestamp
- Tag: @CEO
- Status: **NO-GO**
- Decision: Stop testing, investigate VPS access

---

### Category 2: Database Connection Failure (Section 2)

**Symptoms:**
- "Database locked" or "ECONNREFUSED"
- GPU pricing table empty
- Provider/renter tables missing

**Immediate Actions (0-3 min):**
```bash
# Check database file exists
ssh root@76.13.179.86 "ls -lh /root/dc1-platform/db/dc1.db"

# Check database integrity
ssh root@76.13.179.86 "sqlite3 /root/dc1-platform/db/dc1.db 'SELECT COUNT(*) FROM gpu_pricing;'"
# Expected output: Number >0

# If empty, check if schema exists
ssh root@76.13.179.86 "sqlite3 /root/dc1-platform/db/dc1.db '.schema' | grep gpu_pricing"
```

**If schema missing:**
```bash
# Restore from backup or reinitialize
ssh root@76.13.179.86 << 'EOF'
cd /root/dc1-platform
npm run db:migrate
npm run db:seed:gpu-pricing
EOF
```

**Escalation (if fails):**
- Post to DCP-773: "🔴 **BLOCKER: Database Schema/Data Missing**"
- Include: Database error, schema check output
- Tag: @CEO @Backend-Architect
- Status: **NO-GO**
- Decision: Cannot proceed without clean database

---

### Category 3: API Endpoint Failure (Section 3)

**Symptoms:**
- `GET /api/models` returns 404 or 500
- Health endpoint down
- API returns "Connection refused"

**Immediate Actions (0-2 min):**
```bash
# Test API directly
curl -s -I https://api.dcp.sa/api/health
curl -s -I https://api.dcp.sa/api/models | head -5

# Check backend logs for errors
ssh root@76.13.179.86 "tail -50 /root/dc1-platform/backend/logs/app.log | grep -i error"

# Test via VPS (rule out firewall)
ssh root@76.13.179.86 "curl -s http://localhost:8083/api/health"
```

**If localhost works but remote fails:**
- Firewall/nginx issue → restart nginx
```bash
ssh root@76.13.179.86 "systemctl restart nginx && sleep 5 && curl -s https://api.dcp.sa/api/health"
```

**If localhost fails:**
- Backend service crashed → restart via PM2
```bash
ssh root@76.13.179.86 "pm2 restart dc1-provider-onboarding && sleep 10 && curl -s http://localhost:8083/api/health"
```

**Escalation (if fails 2x):**
- Post to DCP-773: "🔴 **BLOCKER: API Endpoint Failure**"
- Include: curl error, backend logs, restart output
- Tag: @CEO @Backend-Architect
- Status: **NO-GO**

---

### Category 4: Test Script Execution Failure

**Symptoms:**
- npm test returns errors
- Jest suite hangs (>5 min per test)
- Smoke test scripts fail immediately

**Immediate Actions (0-3 min):**
```bash
# Try running one test in isolation
npm run test:e2e 2>&1 | head -100
# Look for: "Cannot find module", "ECONNREFUSED", "timeout"

# If "Cannot find module": reinstall dependencies
npm ci --force 2>&1 | tail -20

# If ECONNREFUSED: backend not accessible from test environment
curl -s http://localhost:8083/api/health
```

**If node_modules issue:**
```bash
rm -rf node_modules package-lock.json
npm ci
npm run test:e2e
```

**Escalation (if fails):**
- Post to DCP-773: "🔴 **BLOCKER: Test Script Failure**"
- Include: exact error, npm version, backend health status
- Tag: @CEO @Backend-Architect
- Status: **NO-GO** (cannot validate without passing tests)

---

### Category 5: Authentication/Token Failure (Section 4)

**Symptoms:**
- Tests return 401 Unauthorized
- Admin token invalid
- Renter key not accepted

**Immediate Actions (0-2 min):**
```bash
# Verify token format
echo $DC1_ADMIN_TOKEN | head -c 50
echo $DCP_RENTER_KEY | head -c 50

# Test token validity
curl -s -H "Authorization: Bearer $DC1_ADMIN_TOKEN" \
  https://api.dcp.sa/api/admin/providers | head -5

# If 401: token expired or malformed
echo "Admin token status:"
curl -s -X POST https://api.dcp.sa/api/auth/verify \
  -H "Authorization: Bearer $DC1_ADMIN_TOKEN"
```

**If token expired:**
- Regenerate from backend database
```bash
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/db/dc1.db \
  "SELECT admin_token FROM system_config LIMIT 1;"
# Use output as new DC1_ADMIN_TOKEN
EOF
```

**Escalation (if fails):**
- Post to DCP-773: "🔴 **BLOCKER: Authentication Failure**"
- Include: token error response, expiry status
- Tag: @CEO @Backend-Architect
- Status: **NO-GO**

---

### Category 6: Pricing/Metering Calculation Failure (Section 8)

**Symptoms:**
- Cost calculations off by >1%
- SAR conversion inaccurate
- GPU pricing table has no values

**Immediate Actions (0-3 min):**
```bash
# Check GPU pricing seeding
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/db/dc1.db \
  "SELECT model_id, price_sar_per_hour FROM gpu_pricing LIMIT 3;"
EOF

# Expected: 3+ rows with price_sar_per_hour > 0

# Check metering calculation accuracy
npm run test:metering 2>&1 | grep -i "accuracy\|pass"
```

**If pricing table empty:**
```bash
ssh root@76.13.179.86 << 'EOF'
cd /root/dc1-platform
npm run db:seed:gpu-pricing
EOF
```

**Escalation (if fails):**
- Post to DCP-773: "🔴 **BLOCKER: Pricing/Metering Calculation Failure**"
- Include: pricing table status, metering test output
- Tag: @CEO @ML-Infra-Engineer
- Status: **NO-GO** (cannot charge customers without accurate metering)

---

### Category 7: Job Lifecycle Failure (Section 6)

**Symptoms:**
- Job stuck in "submitted" state
- Provider fails to claim job
- Job execution never completes

**Immediate Actions (0-3 min):**
```bash
# Check job status in database
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/db/dc1.db \
  "SELECT id, status, created_at FROM serve_sessions ORDER BY created_at DESC LIMIT 5;"
EOF

# Check provider heartbeat/connectivity
curl -s https://api.dcp.sa/api/providers/list | grep -i "online\|status"

# Check backend logs for job processing errors
ssh root@76.13.179.86 "tail -100 /root/dc1-platform/backend/logs/app.log | grep -i 'job\|queue'"
```

**If provider count is 0:**
- No active providers → job cannot be assigned
- Escalate: cannot test provider-job workflow

**If provider online but job stuck:**
```bash
# Check job assignment logic
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/db/dc1.db \
  "SELECT COUNT(*) as stuck_jobs FROM serve_sessions WHERE status='submitted' AND created_at < datetime('now', '-5 minutes');"
EOF
# If >0: job assignment logic broken
```

**Escalation (if fails):**
- Post to DCP-773: "🔴 **BLOCKER: Job Lifecycle Failure**"
- Include: job status, provider list, backend logs
- Tag: @CEO @Backend-Architect
- Status: **NO-GO** (core marketplace function broken)

---

### Category 8: Data Integrity/Corruption Failure (Section 12)

**Symptoms:**
- Orphaned records (job with missing provider)
- Balance corruption (negative balance, mismatched totals)
- Audit trail gaps

**Immediate Actions (0-3 min):**
```bash
# Check for orphaned serve_sessions
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/db/dc1.db \
  "SELECT COUNT(*) FROM serve_sessions WHERE provider_id NOT IN (SELECT id FROM providers);"
EOF
# Expected: 0

# Check for negative balances
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/db/dc1.db \
  "SELECT COUNT(*) FROM accounts WHERE balance < 0;"
EOF
# Expected: 0

# Check audit trail continuity
ssh root@76.13.179.86 << 'EOF'
sqlite3 /root/dc1-platform/db/dc1.db \
  "SELECT COUNT(*) FROM audit_logs WHERE timestamp IS NULL;"
EOF
# Expected: 0
```

**If corruption found:**
- Database integrity broken → data recovery needed
- Stop testing immediately

**Escalation (if any corruption):**
- Post to DCP-773: "🔴 **BLOCKER: Data Integrity Corruption Detected**"
- Include: corruption details, query results
- Tag: @CEO @Backend-Architect @DevOps
- Status: **NO-GO** (cannot launch with data corruption)

---

## Escalation Template

**When posting blocker to DCP-773:**

```markdown
## 🔴 Day 4 BLOCKER — [Category Name]

**Time:** [HH:MM UTC]
**Section:** [1-12]
**Failure Category:** [One of 8 categories]

### Error Details
- Exact error message: [copy-paste]
- Command that failed: [bash command]
- Output: [last 50 lines of relevant output]

### Attempted Remediation
- [Action 1] → Result: [success/failed]
- [Action 2] → Result: [success/failed]

### Impact
- Cannot proceed to next section
- Day 4 testing: HALTED
- Day 5/6: BLOCKED pending this fix

### Escalation
- Assigned to: @CEO
- Tags: @Backend-Architect @DevOps (as needed by category)
- Decision needed: Investigate, fix, or defer Phase 1 launch

### Recommendation
[What should happen next: 1-hour fix attempt, rollback to previous version, defer to emergency session, etc.]

---

**Posted by QA Engineer at [HH:MM UTC]**
```

---

## Recovery Procedures (Post-Fix)

**After any category is fixed:**

1. Re-run the failed section validation
2. If all checks now PASS: continue to next section
3. If still failing: escalate again with updated output
4. Document fix details for post-mortem

**Timeline for recovery:**
- Immediate: 0-5 min (try quick fixes)
- Investigation: 5-15 min (root cause analysis)
- At 15 min with no progress: **Escalate to CEO**
- At 30 min with no resolution: **Call executive emergency session**

---

## No-Go Decision Trigger

**If ANY blocker cannot be resolved by 11:50 UTC:**

1. Post final blocker summary to DCP-773
2. Update status to: 🔴 **DAY 4 NO-GO**
3. List all unresolved blockers
4. Escalate to CEO for decision
5. Wait for direction before proceeding

---

**Last Updated:** 2026-03-24
**Status:** Ready for execution
