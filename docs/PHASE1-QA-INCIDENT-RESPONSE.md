# Phase 1 QA — Incident Response Guide (Days 4-6)

**Execution Window:** 2026-03-26 to 2026-03-28 UTC
**QA Lead:** QA Engineer (agent 891b2856-c2eb-4162-9ce4-9f903abd315f)
**Escalation Contact:** CEO (parent issue DCP-685)
**Status Page:** This document + real-time Paperclip comments

---

## Severity Levels & Response Times

| Severity | Impact | Response | Resolution | Escalation |
|----------|--------|----------|-----------|------------|
| **CRITICAL** | System down, data loss | 5 min | 30 min max | Immediate |
| **HIGH** | Major feature broken | 10 min | 2 hours | Within 15 min |
| **MEDIUM** | Feature degraded | 15 min | 4 hours | Within 30 min |
| **LOW** | Minor issue | 30 min | End of day | EOD update |

---

## Common Failure Scenarios & Responses

### 🔴 CRITICAL: API Down (HTTP 500/502/503)

**Symptoms:**
- `curl https://api.dcp.sa/health` → Connection refused or 502/503
- All API endpoints returning errors
- Database queries timing out

**Immediate Response (5 min):**
1. Verify it's not a network issue on your end
   ```bash
   curl -v https://api.dcp.sa/health
   ping api.dcp.sa
   ```

2. Check if VPS is reachable
   ```bash
   ssh root@76.13.179.86 "systemctl status pm2" 2>/dev/null || echo "SSH failed"
   ```

3. Post to DCP-773 immediately:
   ```
   🔴 CRITICAL: API Down (HTTP 502)
   Detected: [timestamp]
   Escalating to Backend Architect
   Attempting recovery procedures...
   ```

**Escalation (10 min if not resolved):**
- Tag: @Backend Architect on DCP-773
- Contact: Check DCP-685 comment thread for contact info
- Issue: PM2 service crash, nginx config error, or database connectivity
- Expected fix: 15-30 minutes

**Potential Fixes:**
```bash
# VPS SSH (requires founder approval per CLAUDE.md)
ssh root@76.13.179.86

# Check PM2 status
pm2 status
pm2 logs dc1-provider-onboarding

# Restart if needed (REQUIRES EXPLICIT APPROVAL - DO NOT DO THIS)
# pm2 restart dc1-provider-onboarding
```

**Recovery Decision:**
- If VPS accessible and issue identified: Post detailed blocker to DCP-773
- If VPS not accessible: Escalate to DevOps/Founder for VPS intervention
- **Do NOT attempt restart without explicit founder approval** (see CLAUDE.md)

**Test Resumption:**
- Wait for Backend Architect to confirm fix
- Re-run health check to verify
- Resume testing only after 5x consecutive health checks pass

---

### 🔴 CRITICAL: Database Connectivity Error

**Symptoms:**
- Error: "ENOENT: no such file or directory" (DB file missing)
- Error: "SQLITE_CANTOPEN"
- Error: "database is locked"
- All queries failing with timeout

**Immediate Response (5 min):**
1. Check if database file exists
   ```bash
   ls -lh backend/db.sqlite
   ```

2. Test query with sqlite3
   ```bash
   sqlite3 backend/db.sqlite "SELECT COUNT(*) FROM providers;" 2>&1
   ```

3. Post to DCP-773:
   ```
   🔴 CRITICAL: Database Error
   Error: [exact error message]
   Escalating to Backend Architect...
   ```

**Escalation (10 min):**
- Tag: @Backend Architect on DCP-773
- Issue: Migration failed, corrupt DB, or missing file
- Expected fix: 20-45 minutes

**Potential Causes & Checks:**
- Missing migration: Check git log for recent DB schema changes
- Corrupt file: Check file size (should be >100KB if populated)
- Permission issue: Check file permissions (should be readable by node user)

**Recovery:**
- Await Backend Architect's instructions
- May require DB restore from backup
- May require fresh migration from main branch

---

### 🟠 HIGH: Model Catalog Missing Models

**Symptoms:**
- `/api/models` returns < 11 models
- Expected models (ALLaM, JAIS, Qwen, Mistral) not in response
- Model count decreased from pre-flight baseline

**Immediate Response (10 min):**
1. Check what models are returned
   ```bash
   curl -s https://api.dcp.sa/api/models | jq '.[] | .name' | sort
   curl -s https://api.dcp.sa/api/models | jq 'length'
   ```

2. Compare to baseline (11 models from pre-flight)
   ```bash
   # Expected: ALLaM 7B, JAIS 13B, Qwen 2.5 7B, Llama 3 8B, Mistral 7B,
   #           Nemotron Nano, SDXL, Stable Diffusion, vLLM, Jupyter, PyTorch
   ```

3. Post to DCP-773:
   ```
   🟠 HIGH: Model Catalog Incomplete
   Expected: 11 models
   Actual: [count]
   Missing: [list]
   Escalating to ML Infrastructure...
   ```

**Escalation (15 min):**
- Tag: @ML Infrastructure Engineer on DCP-773
- Issue: Model seeding failed, catalog API broken, or model deletion
- Expected fix: 30-90 minutes

**Potential Causes:**
- Model serving not started: Check vLLM services
- Catalog endpoint changed: Check API routing
- Intentional model removal: Check git log for infra changes

**Recovery:**
- Await ML Infra team's model re-seeding
- May require restart of model serving processes
- May require catalog endpoint verification

---

### 🟠 HIGH: Test Script Execution Failure

**Symptoms:**
- `npm run test` fails with syntax error
- `scripts/phase1-preflight-smoke.mjs` exits with error
- Jest test suite fails to initialize

**Immediate Response (10 min):**
1. Run test with verbose output
   ```bash
   npm run test -- --verbose 2>&1 | head -100
   ```

2. Check for obvious issues
   ```bash
   head -50 backend/tests/e2e-marketplace.test.js
   node -c scripts/phase1-preflight-smoke.mjs  # Syntax check
   ```

3. Post to DCP-773:
   ```
   🟠 HIGH: Test Execution Failed
   Error: [first 100 chars of error]
   Script: [which script]
   Escalating to QA Team...
   ```

**Escalation (15 min):**
- Tag: @QA Team Lead on DCP-773
- Issue: Syntax error, missing dependency, or environment issue
- Expected fix: 15-45 minutes

**Potential Causes:**
- Node modules not installed: `npm ci` may have failed
- Incompatible Node version: Check `node --version`
- Env variable missing: Check `.env.test` exists
- Merge conflict in test file: Check git status

**Recovery:**
1. Try reinstalling dependencies:
   ```bash
   npm ci  # Clean install
   npm run test -- --detectOpenHandles
   ```

2. If fails, check recent commits:
   ```bash
   git log --oneline -5 -- backend/tests/
   git diff HEAD~1 backend/tests/e2e-marketplace.test.js
   ```

3. Revert if needed:
   ```bash
   git checkout HEAD -- backend/tests/  # ONLY if clearly broken
   ```

---

### 🟠 HIGH: Performance Degradation (Slow Responses)

**Symptoms:**
- API responses >2000ms (expected <500ms)
- Job submission takes >10 seconds
- Model inference latency increased 10x
- Timeouts in test suite

**Immediate Response (10 min):**
1. Check current latency
   ```bash
   time curl -s https://api.dcp.sa/health > /dev/null
   # Should be <500ms

   # Test job submission
   curl -X POST https://api.dcp.sa/api/jobs \
     -d '{"model":"mistral-7b","task":"test"}' \
     -w "Time: %{time_total}s\n"
   ```

2. Check system resource usage
   ```bash
   # On your local machine
   top -b -n 1 | head -20

   # On VPS (if accessible)
   ssh root@76.13.179.86 "top -b -n 1 | head -20" 2>/dev/null || echo "SSH failed"
   ```

3. Post to DCP-773:
   ```
   🟠 HIGH: Performance Degradation
   Health latency: [time]ms (expected: <500ms)
   Job submit time: [time]ms (expected: <10s)
   Possible cause: [check logs]
   ```

**Escalation (20 min if not resolved):**
- Tag: @ML Infrastructure Engineer or @Backend Architect
- Issue: High CPU/memory usage, slow queries, or resource contention
- Expected fix: 30-120 minutes (may require scaling or query optimization)

**Potential Causes:**
- Job queue backlog: Check pending jobs count
- Model loading overhead: Check model cache status
- Database contention: Check lock waits
- Provider overload: Check provider resource utilization

---

### 🟡 MEDIUM: Partial Test Failure (Some Tests Fail)

**Symptoms:**
- Smoke test: 2/10 checks fail
- Jest suite: 3/27 tests fail (< 10% failure acceptable)
- Specific features working, others broken
- Intermittent failures (flaky tests)

**Immediate Response (15 min):**
1. Identify which tests failed
   ```bash
   npm run test 2>&1 | grep -i "fail\|error\|✕" | head -20
   ```

2. Determine if failures are critical
   - **Critical:** Payment processing, job creation, model serving
   - **Non-critical:** Edge cases, admin endpoints, logging
   - **Flaky:** Intermittent, timeout-related, timing-dependent

3. Re-run failed tests
   ```bash
   npm run test -- --testNamePattern="failing test name"
   ```

4. Post to DCP-773:
   ```
   🟡 MEDIUM: Test Failure
   Failed: [N] of [total] tests
   Type: [critical/non-critical/flaky]
   Details: [brief description]
   Action: [investigating/escalating/retrying]
   ```

**Decision Logic:**
- If <5% failure AND non-critical: Document and continue
- If <5% failure AND critical: Investigate root cause before proceeding
- If 5-10% failure: Post blocker, may affect GO decision
- If >10% failure: NO-GO, escalate immediately

**Escalation (30 min):**
- For critical failures: Tag @QA Team Lead
- For infrastructure issues: Tag @Backend Architect or @ML Infrastructure
- Provide: Exact test name, error message, reproduction steps

---

### 🟡 MEDIUM: Data Inconsistency

**Symptoms:**
- Job count doesn't match database
- Credit balance incorrect
- Provider earnings don't reconcile
- Duplicate records in database

**Immediate Response (15 min):**
1. Verify the inconsistency
   ```bash
   # Run metering verification
   npm run metering-verify 2>&1

   # Check job count consistency
   sqlite3 backend/db.sqlite \
     "SELECT COUNT(*) FROM jobs WHERE status='completed';"
   ```

2. Determine scope
   - Single record affected? (Low impact)
   - Multiple records? (Medium impact)
   - Systematic issue? (High impact)

3. Post to DCP-773:
   ```
   🟡 MEDIUM: Data Inconsistency
   Issue: [description]
   Affected: [how many records]
   Scope: [single/multiple/systematic]
   Action: [investigating]
   ```

**Investigation Steps:**
1. Check recent commits for data handling changes
2. Review transaction logs for failures
3. Run data validation queries
4. Determine if data can be corrected

**Escalation (30 min):**
- Tag: @Backend Architect
- May require data corrections or migrations
- May affect trust in Phase 1 results

---

### 🔵 LOW: Non-Critical Logging/UI Issues

**Symptoms:**
- Missing log messages (but functionality works)
- UI display issues (but API data correct)
- Analytics events not firing (but system works)
- Documentation typos

**Response (30 min):**
1. Document the issue
   ```
   🔵 LOW: [Issue description]
   Impact: Cosmetic/non-functional
   Action: Documenting for post-Phase-1 fix
   ```

2. Continue testing - do NOT block on low-severity items
3. Post summary at end of day

**Non-Blocking Issues:**
- Typos in error messages
- Missing optional logging
- UI alignment issues
- Non-critical feature flags

---

## Escalation Matrix

### Quick Contacts (By Role)

| Role | Contact Method | Response Time | Authority |
|------|----------------|---------------|-----------|
| QA Team Lead | DCP-773 comment @mention | 15 min | Test procedures |
| Backend Architect | DCP-773 comment @mention | 15 min | API/database |
| ML Infrastructure Engineer | DCP-773 comment @mention | 15 min | Models/serving |
| DevOps/P2P Engineer | DCP-773 comment @mention | 20 min | Infrastructure |
| CEO | DCP-685 comment @mention | 10 min | Executive decision |

### When to Use Each:

- **QA Team Lead:** Test script errors, test logic issues, Jest suite problems
- **Backend Architect:** API down, database errors, query issues, data corruption
- **ML Infrastructure:** Model missing, serving latency, portfolio issues
- **DevOps:** VPS access needed, PM2 restart, nginx config
- **CEO:** Final launch decision, unresolved conflicts, blocked escalation

---

## Response Template

Use this template for posting incident updates:

```markdown
## [SEVERITY] [SHORT TITLE]

**Time Detected:** [timestamp UTC]
**Status:** 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🔵 LOW

### Issue Description
[What's wrong, symptoms, impact on testing]

### Verification Steps Taken
- [ ] Check: [describe check 1]
- [ ] Check: [describe check 2]
- [ ] Check: [describe check 3]

### Impact on Phase 1
- Test phases affected: [which days]
- Blocking: [YES/NO]
- Resolution timeline: [estimate]

### Escalation
Assigned to: [@responsible-agent]
Contact: [method]
Response expected: [time]

### Next Update
[when you'll post next status]
```

---

## During-Testing Communication

### Status Update Frequency
- **CRITICAL:** Every 5 minutes until resolved
- **HIGH:** Every 15 minutes until resolved
- **MEDIUM:** Every 30 minutes until resolved
- **LOW:** End of day summary

### Information to Include
1. **What:** Exact error or symptom
2. **When:** Precise timestamp
3. **Impact:** Which tests affected, how many users impacted
4. **Action:** What you've tried, what's next
5. **ETA:** Estimated time to resolution

### Communication Channels
- **Primary:** Paperclip issue comments (creates audit trail)
- **Real-time:** Telegram if VPS down (for immediate founders notice)
- **Documentation:** Keep this guide updated with findings

---

## Post-Incident Review

**After Phase 1 Complete:** Create summary of all incidents:
1. What failed and why
2. Response quality (timing, effectiveness)
3. Lessons learned
4. Preventive measures for Phase 2

---

## Quick Reference Commands

```bash
# Infrastructure Health Checks
curl -s https://api.dcp.sa/health
curl -s https://api.dcp.sa/api/models | jq 'length'
curl -s https://api.dcp.sa/api/templates | jq 'length'

# Database Verification
sqlite3 backend/db.sqlite "SELECT COUNT(*) FROM jobs;"
sqlite3 backend/db.sqlite ".tables"

# Test Execution
npm run test
npm run test -- --testNamePattern="specific test"
node scripts/phase1-preflight-smoke.mjs

# Performance Monitoring
time curl -s https://api.dcp.sa/health > /dev/null
npm run test -- --detectOpenHandles

# Git Investigation
git log --oneline -5
git diff HEAD~1 backend/tests/
git status

# VPS Access (REQUIRES APPROVAL)
ssh root@76.13.179.86 "pm2 status"
ssh root@76.13.179.86 "pm2 logs dc1-provider-onboarding"
```

---

**Prepared by:** QA Engineer
**Date:** 2026-03-24
**Effective:** Days 4-6 Phase 1 Execution (2026-03-26 to 2026-03-28)
**Last Updated:** 2026-03-24 22:30 UTC
