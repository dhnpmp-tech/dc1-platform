# Phase 1 Day 4 — Rapid Response Playbook
## Failure Decision Tree & Emergency Procedures

**Created:** 2026-03-24
**Execution Date:** 2026-03-26 08:00-12:00 UTC
**Purpose:** Immediate troubleshooting and escalation for failures during Day 4 pre-test validation

---

## Quick Reference — 8 Failure Categories

When a validation section FAILS, immediately:
1. **Identify failure category** (below)
2. **Execute troubleshooting commands** (provided)
3. **Document results** in Day 4 report
4. **Escalate** if unresolved within 5 minutes

---

## 1. INFRASTRUCTURE FAILURES (API/VPS Health)

**Symptoms:** HTTP timeouts, 502 errors, connection refused on api.dcp.sa

### Troubleshooting Commands
```bash
# Check API health
curl -v https://api.dcp.sa/api/health
# Expected: HTTP 200, response time <500ms

# Check backend service status
ssh node@76.13.179.86 "pm2 list"
# Expected: dc1-provider-onboarding status "online"

# Check VPS connectivity
ping -c 3 76.13.179.86
# Expected: all packets received, <100ms latency

# Check Docker status on VPS
ssh node@76.13.179.86 "docker ps | grep llm-worker"
# Expected: container running (if deployed)
```

### If Infrastructure Fails
**Decision:** CRITICAL BLOCKER — Cannot proceed to next section
- [ ] Post to DCP-641: "INFRASTRUCTURE FAILURE — API unreachable"
- [ ] Tag: @CEO @Backend-Architect
- [ ] Action: Restart backend service or investigate VPS issues
- [ ] Timeout: 10 minutes max, then escalate to NO-GO decision

---

## 2. DATABASE FAILURES (Query Errors, Connection Timeouts)

**Symptoms:** "connection timeout", "database locked", migration failures

### Troubleshooting Commands
```bash
# Check database connectivity
psql postgresql://user:pass@localhost:5432/dc1_platform -c "SELECT version();"
# Expected: PostgreSQL version output

# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
# Expected: <50 connections

# Check for locks
psql -c "SELECT * FROM pg_locks WHERE NOT granted;"
# Expected: empty result set (no blocking locks)

# Run migration validation
cd /home/node/dc1-platform
npm run db:validate
# Expected: all migrations applied successfully
```

### If Database Fails
**Decision:** CRITICAL BLOCKER — Cannot validate data integrity
- [ ] Post to DCP-641: "DATABASE FAILURE — connection issues detected"
- [ ] Tag: @Backend-Architect @DevOps
- [ ] Action: Check logs, restart PostgreSQL, rollback migrations if needed
- [ ] Timeout: 10 minutes, then NO-GO

---

## 3. API CONTRACT FAILURES (Response Format, Missing Fields)

**Symptoms:** Unexpected JSON structure, missing fields, type mismatches

### Troubleshooting Commands
```bash
# Test model catalog endpoint
curl -s https://api.dcp.sa/api/models | jq '.'
# Expected: array of 11 models, each with: id, name, vram_gb, pricing_halala_per_hr

# Validate response schema
curl -s https://api.dcp.sa/api/models | jq '.[] | keys' | head -1
# Expected: ["id", "name", "vram_gb", "pricing_halala_per_hr", ...]

# Test pricing endpoint
curl -s https://api.dcp.sa/api/pricing/rtx-4090 | jq '.'
# Expected: { "hourly_halala": 26700, "daily_usd": ..., ... }

# Test job submission endpoint
curl -X POST https://api.dcp.sa/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"model_id":"llama-3-8b", "prompt":"test"}' \
  -H "Authorization: Bearer $DCP_RENTER_KEY" | jq '.'
# Expected: { "job_id": "...", "status": "pending", ... }
```

### If API Contract Fails
**Decision:** MAJOR BLOCKER — API is not production-ready
- [ ] Post to DCP-641: "API CONTRACT FAILURE — endpoint response invalid"
- [ ] Tag: @Backend-Architect
- [ ] Action: Fix API response schema, redeploy
- [ ] Timeout: 10 minutes, then NO-GO

---

## 4. AUTHENTICATION FAILURES (Token Invalid, Permission Denied)

**Symptoms:** 401 Unauthorized, 403 Forbidden, invalid JWT

### Troubleshooting Commands
```bash
# Verify admin token
curl -s https://api.dcp.sa/api/admin/dashboard \
  -H "Authorization: Bearer $DC1_ADMIN_TOKEN" | jq '.status'
# Expected: 200 OK, admin data returned

# Verify renter token
curl -s https://api.dcp.sa/api/renter/profile \
  -H "Authorization: Bearer $DCP_RENTER_KEY" | jq '.renter_id'
# Expected: 200 OK, renter profile returned

# Check token expiration
node -e "console.log(JSON.parse(atob('$DCP_RENTER_KEY'.split('.')[1])))" 2>/dev/null | grep exp
# Expected: exp timestamp is in future

# Regenerate test tokens if needed
cd /home/node/dc1-platform
npm run generate:test-tokens
# Expected: new tokens generated and printed
```

### If Auth Fails
**Decision:** CRITICAL BLOCKER — Cannot test user flows
- [ ] Post to DCP-641: "AUTH FAILURE — token invalid or expired"
- [ ] Tag: @Backend-Architect @Security
- [ ] Action: Regenerate tokens, verify JWT signing keys
- [ ] Timeout: 5 minutes, then NO-GO

---

## 5. METERING FAILURES (Token Counts Not Persisting)

**Symptoms:** Token count mismatch, cost calculation wrong, usage not logged

### Troubleshooting Commands
```bash
# Run metering validation test
cd /home/node/dc1-platform
npm run test -- metering-smoke.test.js
# Expected: all tests pass, token counts match

# Check metering database records
psql -c "SELECT job_id, input_tokens, output_tokens FROM job_metering LIMIT 10;"
# Expected: recent jobs show correct token counts

# Validate cost calculation
psql -c "SELECT job_id, token_count, cost_halala FROM job_costs ORDER BY created_at DESC LIMIT 5;"
# Expected: costs calculated correctly (token_count * hourly_rate / 3600)

# Run live inference and check metering
bash scripts/test-metering-e2e.sh
# Expected: metering logged within 5 seconds of job completion
```

### If Metering Fails
**Decision:** MAJOR BLOCKER — Cannot bill renters accurately
- [ ] Post to DCP-641: "METERING FAILURE — token counts not persisting"
- [ ] Tag: @Backend-Architect @ML-Infra
- [ ] Action: Check metering pipeline, restart if needed
- [ ] Timeout: 10 minutes, then NO-GO

---

## 6. PROVIDER CONNECTIVITY FAILURES (Heartbeat Timeout)

**Symptoms:** Providers not responding, heartbeat failures, vLLM endpoint unreachable

### Troubleshooting Commands
```bash
# Check provider status
curl -s https://api.dcp.sa/api/providers?status=online | jq '.[] | {id, last_heartbeat}'
# Expected: at least 1 provider with recent heartbeat (<5 min)

# Test provider health endpoint directly
curl -s https://[provider-ip]:8000/health | jq '.'
# Expected: { "status": "healthy", "models": [...] }

# Check heartbeat logs
ssh node@76.13.179.86 "tail -100 /var/log/dc1-provider-heartbeat.log" 2>/dev/null
# Expected: recent heartbeat messages, no errors

# Force provider health check
curl -X POST https://api.dcp.sa/api/admin/providers/health-check \
  -H "Authorization: Bearer $DC1_ADMIN_TOKEN" | jq '.'
# Expected: health check results for all providers
```

### If Provider Connectivity Fails
**Decision:** MAJOR BLOCKER — Cannot test inference
- [ ] Post to DCP-641: "PROVIDER CONNECTIVITY FAILURE — no active providers"
- [ ] Tag: @ML-Infra @DevOps
- [ ] Action: Check provider network, restart heartbeat poller
- [ ] Timeout: 10 minutes, then NO-GO

---

## 7. PRICING FAILURES (Wrong Rates or Currency Mismatch)

**Symptoms:** Pricing doesn't match spec, currency conversion wrong, billing broken

### Troubleshooting Commands
```bash
# Verify pricing is seeded
curl -s https://api.dcp.sa/api/models | jq '.[] | {name, pricing_halala_per_hr}' | head -5
# Expected: RTX 4090 = 26700 halala/hr (exact match from spec)

# Check pricing database
psql -c "SELECT gpu_model, halala_per_hour, usd_per_hour FROM gpu_pricing;"
# Expected: all GPU tiers present with correct rates

# Test pricing calculation
curl -s 'https://api.dcp.sa/api/pricing/calculate?gpu=rtx-4090&hours=1' | jq '.total_halala'
# Expected: 26700

# Validate currency conversion
curl -s 'https://api.dcp.sa/api/pricing/convert?halala=26700&to=usd' | jq '.usd'
# Expected: ~$7.12 (26700 * 0.000267 exchange rate)
```

### If Pricing Fails
**Decision:** MAJOR BLOCKER — Economic model broken
- [ ] Post to DCP-641: "PRICING FAILURE — rates incorrect or not seeded"
- [ ] Tag: @Backend-Architect @Finance
- [ ] Action: Seed pricing table, verify exchange rates
- [ ] Timeout: 5 minutes, then NO-GO

---

## 8. RENTER ONBOARDING FAILURES (Cannot Create Account or Deploy)

**Symptoms:** Registration fails, cannot submit first job, deployment errors

### Troubleshooting Commands
```bash
# Test renter registration
curl -X POST https://api.dcp.sa/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com", "password":"test123"}' | jq '.renter_id'
# Expected: new renter ID returned

# Test job submission (renter flow)
curl -X POST https://api.dcp.sa/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DCP_RENTER_KEY" \
  -d '{
    "model_id": "llama-3-8b",
    "prompt": "Hello world",
    "max_tokens": 100
  }' | jq '.job_id'
# Expected: job created and queued

# Check job status
JOB_ID=$(curl -X POST ... 2>/dev/null | jq -r '.job_id')
curl -s https://api.dcp.sa/api/jobs/$JOB_ID \
  -H "Authorization: Bearer $DCP_RENTER_KEY" | jq '.status'
# Expected: status progresses: pending → assigned → running → completed

# Test payment flow (test mode)
curl -X POST https://api.dcp.sa/api/payments/create \
  -H "Authorization: Bearer $DCP_RENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount_halala": 50000}' | jq '.payment_intent_id'
# Expected: payment intent created (test mode, no real charge)
```

### If Onboarding Fails
**Decision:** CRITICAL BLOCKER — Core product broken
- [ ] Post to DCP-641: "RENTER ONBOARDING FAILURE — cannot register or submit jobs"
- [ ] Tag: @Frontend-Developer @Backend-Architect
- [ ] Action: Check authentication, payment integration, job API
- [ ] Timeout: 15 minutes, then NO-GO

---

## Escalation Template

Use this template for any failure that cannot be resolved within the timeout:

```
## ESCALATION — Day 4 Failure [Category Name]

**Time:** [HH:MM UTC]
**Category:** [1-8 from above]
**Symptoms:** [description]
**Last Troubleshooting Step:** [what was tried]
**Status:** UNRESOLVED

### Who to Contact
- [Category Owner] — primary contact
- [Backup] — escalation if primary unavailable

### Next Steps
1. [Contact owner with details]
2. [Provide logs/evidence]
3. [Wait for response (5 min max)]
4. If unresolved: recommend NO-GO
```

---

## Document All Failures

For EVERY failure during Day 4, record:
1. **Time** (HH:MM UTC)
2. **Category** (1-8)
3. **Description** of what failed
4. **Troubleshooting steps** taken
5. **Resolution** or escalation

This becomes the Day 4 failure log, included in final report.

---

## When to Call NO-GO

If ANY of the following remain unresolved after troubleshooting:
- ❌ Infrastructure unreachable (Category 1)
- ❌ Database connection failures (Category 2)
- ❌ API contract broken (Category 3)
- ❌ Authentication broken (Category 4)
- ❌ Metering not working (Category 5)
- ❌ NO active providers (Category 6)
- ❌ Pricing incorrect (Category 7)
- ❌ Cannot register renters or submit jobs (Category 8)

**RECOMMEND NO-GO DECISION** at 12:00 UTC if any critical blocker unresolved.

---

## Post-Escalation Actions

Once escalated:
1. Stop testing that section
2. Move to next validation section (if possible)
3. Continue documenting
4. At 12:00 UTC: Compile all failures and make GO/NO-GO decision
5. If NO-GO: escalate to founder with full failure report

