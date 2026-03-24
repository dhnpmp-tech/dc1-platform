# Phase 1 Testing — Troubleshooting Guide

**Purpose:** Quick reference for common Phase 1 test failures and resolution steps

**Created:** 2026-03-24 (pre-deployment)
**Updated:** As issues discovered during Days 4-6 testing

---

## 🔴 API Health Check Fails

**Symptom:** `curl https://api.dcp.sa/api/health` returns 502, 503, or connection timeout

**Root Causes:**
1. Backend service not running
2. Nginx reverse proxy not running
3. Port 8083 not listening
4. SSL certificate issue

**Troubleshooting:**

```bash
# Check backend service status
ssh dc1@76.13.179.86 "pm2 list | grep dc1-provider-onboarding"
# If offline: pm2 start dc1-provider-onboarding

# Check if port 8083 is listening
ssh dc1@76.13.179.86 "netstat -tlnp | grep 8083"
# Expected: tcp 0 0 127.0.0.1:8083 LISTEN

# Check nginx status
ssh dc1@76.13.179.86 "systemctl status nginx"
# If inactive: systemctl restart nginx

# Check backend logs
ssh dc1@76.13.179.86 "pm2 logs dc1-provider-onboarding | tail -50"
# Look for: EADDRINUSE, ENOENT, db connection errors

# Check nginx error log
ssh dc1@76.13.179.86 "tail -20 /var/log/nginx/error.log"
```

**Resolution:**
- If backend crashed: Check logs for the root cause, restart with `pm2 restart dc1-provider-onboarding`
- If nginx crashed: `systemctl restart nginx`
- If port conflict: Identify process using 8083 with `lsof -i :8083`, kill if needed
- If SSL cert issue: Run `certbot renew` and restart nginx

---

## 🔴 Model Detail Endpoints Return 404

**Symptom:**
```bash
curl https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview
# Error: 404 Not Found
```

**Root Cause:**
- Routing fix (DCP-641 commit 1cbfc42) not deployed
- Incorrect regex pattern in models.js

**Verification:**

```bash
# Check if routing fix is deployed
ssh dc1@76.13.179.86
cd /home/node/dc1-platform
git log --oneline | head -1
# Expected: 1cbfc42 or later

# Verify regex in models.js
grep -n "router.get(/\^/\(\[a-zA-Z0-9._/-\]\+\)\$/" backend/src/routes/models.js
# Expected: 3 matches (lines ~847, ~868, ~926)

# Test with direct curl to backend
curl http://localhost:8083/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview
# Should NOT return 404
```

**Resolution:**
1. Verify code is pulled from main: `git checkout origin/main`
2. Restart backend: `pm2 restart dc1-provider-onboarding`
3. Retest: `curl https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview`
4. If still 404: Escalate to Backend Architect

---

## 🔴 Database Connection Fails

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: Password authentication failed
```

**Root Causes:**
1. PostgreSQL not running
2. DATABASE_URL env var not set
3. Database credentials wrong

**Troubleshooting:**

```bash
# Check PostgreSQL running
ssh dc1@76.13.179.86 "systemctl status postgresql"

# Check environment variables
ssh dc1@76.13.179.86 "ps aux | grep node | grep dc1"
# Look for: NODE_ENV=production DATABASE_URL=...

# Test database connection
ssh dc1@76.13.179.86
psql -U dc1_user -d dc1_prod -c "SELECT version();"
# Should return PostgreSQL version

# Check if migrations applied
cd /home/node/dc1-platform
npm run migrate
# Should show: all migrations up to date
```

**Resolution:**
1. Start PostgreSQL: `systemctl start postgresql`
2. Verify DATABASE_URL in /etc/systemd/system/dc1-provider-onboarding.service
3. Re-apply migrations: `npm run migrate`
4. Restart backend: `pm2 restart dc1-provider-onboarding`

---

## 🔴 Template Catalog Returns Empty

**Symptom:**
```bash
curl https://api.dcp.sa/api/models/catalog | jq '.templates'
# Returns: null or []
```

**Root Cause:**
- Arabic portfolio not loaded
- docker-templates/ directory missing

**Troubleshooting:**

```bash
# Check if file exists
ssh dc1@76.13.179.86 "ls -lh /home/node/dc1-platform/infra/config/arabic-portfolio.json"
# Expected: File exists, > 100KB

# Check file content
ssh dc1@76.13.179.86 "head -20 /home/node/dc1-platform/infra/config/arabic-portfolio.json"
# Should show: { "tiers": { "tier_a": [ ... ] } }

# Check if env var set
ssh dc1@76.13.179.86 "echo $DCP_ARABIC_PORTFOLIO_FILE"
# Expected: /home/node/dc1-platform/infra/config/arabic-portfolio.json

# Check backend loads portfolio
ssh dc1@76.13.179.86 "pm2 logs dc1-provider-onboarding | grep -i portfolio"
```

**Resolution:**
1. Verify file exists: `ls -l infra/config/arabic-portfolio.json`
2. Set env var: `export DCP_ARABIC_PORTFOLIO_FILE=/home/node/dc1-platform/infra/config/arabic-portfolio.json`
3. Restart backend: `pm2 restart dc1-provider-onboarding`
4. Retest: `curl https://api.dcp.sa/api/models/catalog`

---

## 🔴 Load Testing Causes High Error Rate

**Symptom:**
- During load test (100+ RPS): error rate jumps to 10-50%
- Errors: 502, 503, timeout

**Root Causes:**
1. Backend memory exhaustion
2. Database connection pool exhausted
3. Nginx worker limit reached
4. Rate limiter triggering

**Troubleshooting:**

```bash
# Check backend memory during load
ssh dc1@76.13.179.86 "watch -n 1 'ps aux | grep node | grep dc1'"
# Expected: memory < 1GB, stays stable

# Check database connections
ssh dc1@76.13.179.86
psql -U dc1_user -d dc1_prod -c "SELECT count(*) FROM pg_stat_activity;"
# Expected: < 20 connections (pool size)

# Check nginx worker processes
ssh dc1@76.13.179.86 "ps aux | grep nginx | grep worker | wc -l"
# Expected: 4-8 workers (depends on CPU)

# Check rate limiter logs
ssh dc1@76.13.179.86 "tail -100 /var/log/nginx/access.log | grep 429"
# 429 = Too Many Requests (rate limited)

# Monitor during load test
ssh dc1@76.13.179.86 "vmstat 1 60"  # CPU, memory stats
```

**Resolution:**

**If memory exhaustion:**
- Increase Node.js heap: `NODE_OPTIONS="--max-old-space-size=2048" pm2 restart dc1-provider-onboarding`
- Reduce batch sizes in load test

**If database pool exhausted:**
- Increase pool size in backend config (default: 20)
- Check for connection leaks: `SELECT * FROM pg_stat_activity WHERE state = 'idle';`

**If rate limited:**
- Check rate limiter config in backend/src/middleware/rateLimiter.js
- Increase limits for test: `publicEndpointLimiter: 1000 requests/15min` (temporary)
- Verify test client respects Retry-After header

**If all resources normal:**
- Issue may be application-level (slow query, sync blocking)
- Escalate to Backend Architect with logs

---

## 🔴 Security Test Finds Vulnerability

**Symptom:**
- XSS vulnerability found in API response
- SQL injection possible in query parameter
- CORS headers too permissive

**Immediate Actions:**

```bash
1. Document exact vulnerability:
   - Endpoint: /api/...
   - Method: GET/POST/etc
   - Payload: [exact input that triggers]
   - Expected: should be escaped/validated
   - Actual: raw output, executable code, etc

2. Reproduce locally:
   curl -X GET "https://api.dcp.sa/api/endpoint?param=[payload]" \
     -H "Content-Type: application/json"

3. Check backend code:
   grep -n "req.query.param" backend/src/routes/...
   # Look for: sanitization, validation, escaping

4. Post on DCP-641:
   🔴 **SECURITY FINDING - CRITICAL**
   - Endpoint: /api/...
   - Issue: [description]
   - Reproduction: [curl command]
   - Impact: [severity]
   @Backend Architect — needs immediate fix
```

**If HIGH/CRITICAL finding discovered:**
- Mark test as **BLOCKED**
- Escalate immediately to Backend Architect and Founder
- Do NOT continue testing until fixed
- Deploy patch, re-test security section

---

## 🔴 Go/No-Go Decision: Which Failures Block Launch?

**BLOCKING FAILURES (STOP testing, require fix):**
- ❌ API health check fails (backend down)
- ❌ Model routing endpoints 404 (DCP-641 not deployed)
- ❌ Database completely unavailable
- ❌ HIGH/CRITICAL security findings
- ❌ Authentication completely broken (can't sign in)

**NON-BLOCKING FAILURES (Continue testing, document, prioritize fix):**
- ⚠️ Single endpoint returns 500 (not critical path)
- ⚠️ Rate limiter too aggressive
- ⚠️ Minor data validation issue
- ⚠️ LOW security findings (e.g., info disclosure)
- ⚠️ Performance slightly below target (p99 latency 2.5s vs 2.0s target)

**Decision Framework:**
- **GO:** All blocking failures resolved, no HIGH/CRITICAL findings, load test passes, renter flow works
- **NO-GO:** Any blocking failure unresolved, or 3+ non-blocking failures affecting revenue path

---

## 📞 ESCALATION CONTACTS

**Backend/API Issues:** Backend Architect
**Database Issues:** DevOps / Database Administrator
**Security Findings:** Security Engineer
**Infrastructure/VPS Issues:** DevOps
**Urgent Blocker:** Post on DCP-641 and @Founder

---

## 📋 ISSUE TEMPLATE FOR ESCALATION

When posting issues on DCP-641:

```markdown
🔴 **Phase 1 Day X Test Blocker: [Brief title]**

**Endpoint:** /api/...
**Error:** [Exact error message]
**Reproduction:**
\`\`\`bash
curl -X GET https://api.dcp.sa/api/... \
  -H "Authorization: Bearer $DCP_RENTER_KEY"
\`\`\`

**Expected:** [What should happen]
**Actual:** [What actually happened]
**Impact:** [Why this blocks testing]
**Logs:** [Relevant log excerpts]

@Backend Architect — needs investigation
Test paused until resolved
```

---

**Last Updated:** 2026-03-24 00:25 UTC
**Created by:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
