# Sprint 26 Test Execution Handbook — Day 5 Operations (2026-03-27)

**QA Lead:** agent 891b2856-c2eb-4162-9ce4-9f903abd315f
**Execution Date:** 2026-03-27
**Decision Date:** 2026-03-28
**Goal:** Phase 1 Launch Go/No-Go Decision

---

## Quick Reference

| Suite | Test Count | Script/File | Owner | Duration | Pass Criteria |
|-------|-----------|-----------|-------|----------|--------------|
| Metering | 6 | `scripts/vllm-metering-smoke.mjs` | QA Eng | 5 min | 6/6 pass |
| Pricing | 6 | `backend/tests/integration/pricing-api.test.js` | QA Eng | 2 min | 6/6 pass |
| Escrow | 4 | Integration test suite | Smart Contracts | 5 min | 4/4 pass |
| VPS | 4 | `scripts/vps-health.sh` + checks | DevOps | 5 min | 4/4 pass |
| Provider Onboarding | 5 | Manual flow + checks | QA Eng | 10 min | 5+ providers |
| E2E Master | 12 | `scripts/phase1-e2e-smoke.mjs` | QA Eng | 10 min | 12/12 pass |

**Total Estimated Runtime:** 40 minutes

---

## Pre-Test Checklist (Run Day 4, 2026-03-26)

```bash
# 1. Verify all deployments are in place
[ ] SP26-001: Container images built and pushed
    docker pull dc1/llm-worker:latest
    docker pull dc1/sd-worker:latest

[ ] SP26-002: Escrow contract deployed to Base Sepolia
    Check: docs/contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md

[ ] SP26-003: Metering smoke test updated (DONE - DCP-619)
    npm run test:integration -- admin-endpoints.test.js --testNamePattern="serve-sessions"

[ ] SP26-004: VPS running latest code
    ssh root@76.13.179.86
    cd /root/dc1-platform
    git log --oneline -1  # Verify latest commit pulled

[ ] SP26-005: No setup needed, verified by O1-O5 tests

[ ] SP26-006: Pricing seeded correctly
    npm run test:integration -- pricing-api.test.js --testNamePattern="Public Pricing"

# 2. Prepare test credentials
[ ] Renter API key for testing
[ ] Admin token for metering queries
[ ] Provider registration testing enabled
[ ] VPS SSH access verified

# 3. Prepare monitoring
[ ] Open tail on VPS logs: `ssh root@76.13.179.86 tail -f /root/dc1-platform/backend/logs/app.log`
[ ] Open database browser for verification queries
[ ] Prepare screenshot tool for documenting results
```

---

## Execution Order (Start 09:00 UTC)

### Phase 1: Setup & Verification (09:00-09:30)

**Console A: DevOps Health Check**
```bash
# VPS Health
ssh root@76.13.179.86 ./scripts/vps-health.sh

# Expected output:
# [PASS] Disk: 45% used
# [PASS] Memory: 8G/16G
# [PASS] PM2: dc1-provider-onboarding ONLINE
# [PASS] PM2: dc1-webhook ONLINE
# [PASS] Port 8083: LISTENING
# [PASS] Database: Connected
```

**Console B: Pricing API Quick Check**
```bash
# Verify pricing endpoint
curl https://api.dcp.sa/api/renters/pricing | jq '.pricing[3]'

# Expected: RTX 4090 with 26700 halala
{
  "gpu_model": "RTX 4090",
  "rate_halala_per_hour": 26700,
  "rate_sar_per_hour": "267.00"
}
```

**Record:** ✓ Infrastructure ready

---

### Phase 2: Component Testing (09:30-11:30)

#### Test 1: Metering Validation (09:30-09:35, QA)

```bash
# Run metering smoke test
DCP_API_BASE=https://api.dcp.sa \
DCP_RENTER_KEY=$RENTER_KEY \
DC1_ADMIN_TOKEN=$ADMIN_TOKEN \
node scripts/vllm-metering-smoke.mjs

# Expected: 11/11 checks pass
# Critical: "Database persistence confirmed" MUST pass
```

**Record Pass/Fail:**
- [ ] Renter key valid
- [ ] Sufficient balance
- [ ] vLLM completion succeeded
- [ ] Token counts present
- [ ] Serve session found
- [ ] Token counts persisted
- [ ] Cost calculated
- [ ] Database persistence confirmed
- [ ] All 11/11 checks passed

**If Fail:** Document error, escalate to Backend Engineer

---

#### Test 2: Pricing API (09:35-09:40, QA)

```bash
# Run pricing integration tests
cd backend
npm run test:integration -- pricing-api.test.js --testNamePattern="Public Pricing API"

# Expected: All 11 tests pass
# Critical: RTX 4090 at 26,700 halala
```

**Record Pass/Fail:**
- [ ] 6 tiers returned
- [ ] Required fields present
- [ ] Halala→SAR conversion correct
- [ ] RTX 4090 = 26,700 halala
- [ ] Prices sorted ascending
- [ ] No auth required
- [ ] Timestamp included
- [ ] 503 on empty pricing
- [ ] Energy arbitrage note present
- [ ] Persistence after updates
- [ ] All 11/11 tests passed

**If Fail:** Check database seeding, escalate to Backend Engineer

---

#### Test 3: Escrow Integration (09:40-09:50, Smart Contracts)

```bash
# Run escrow/settlement tests
npm run test:integration -- escrow.test.js

# Expected: E1-E4 tests pass
```

**Record Pass/Fail:**
- [ ] E1: Escrow hold created
- [ ] E2: Escrow hold released
- [ ] E3: On-chain settlement works
- [ ] E4: Failed job refund works
- [ ] All 4/4 tests passed

**If Fail:** Escalate to Smart Contracts Engineer immediately

---

#### Test 4: VPS & Container Health (09:50-10:00, DevOps)

```bash
# D1: Container image available
docker pull dc1/llm-worker:latest
# Should complete in <30 seconds

# D2: VPS backend health
ssh root@76.13.179.86 ./scripts/vps-health.sh
# All 8 checks must pass

# D3: HTTPS working
curl -I https://api.dcp.sa
# Should show 200 or 301, valid certificate

# D4: PM2 services running
ssh root@76.13.179.86 pm2 status
# Both services ONLINE
```

**Record Pass/Fail:**
- [ ] D1: Container pull succeeds
- [ ] D2: VPS health all pass
- [ ] D3: HTTPS valid certificate
- [ ] D4: PM2 services ONLINE
- [ ] All 4/4 checks passed

**If Fail:** Escalate to DevOps Engineer

---

### Phase 3: Integration Testing (10:00-11:30)

#### Test 5: Provider Onboarding Flow (10:00-10:15, QA)

```bash
# Run provider onboarding tests manually
# O1: Register new provider
curl -X POST https://api.dcp.sa/api/providers/register \
  -d '{"name":"E2E-Test-Provider-'$(date +%s)'","email":"e2e-'$(date +%s)'@test","gpu_model":"RTX 4090","os":"Linux","vram_gb":24}' \
  -H "Content-Type: application/json"

# Record: provider_id, api_key
PROVIDER_ID=...
PROVIDER_KEY=...

# O2: Verify economics display
curl https://api.dcp.sa/api/providers/earnings-calculator?gpu=RTX%204090

# O3: Provider comes online
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -d '{"api_key":"'$PROVIDER_KEY'","status":"online","gpu_status":"idle"}' \
  -H "Content-Type: application/json"

# O4: Check provider appears online
curl https://api.dcp.sa/api/admin/providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | select(.id == '$PROVIDER_ID')'

# O5: Wait for first job (will happen in E2E test)
```

**Record Pass/Fail:**
- [ ] O1: Provider registration succeeds
- [ ] O2: Economics calculator shows accurate profit
- [ ] O3: Provider heartbeat accepted
- [ ] O4: Provider appears online in admin API
- [ ] O5: (Will verify after E2E test)

**Target:** 5+ providers onboarded before E2E test

**If Fail:** Debug provider registration, escalate if needed

---

#### Test 6: E2E Master Smoke Test (10:15-10:30, QA)

```bash
# This is the main integration test
# Validates: Provider setup → Job → Metering → Billing → Settlement

DC1_ADMIN_TOKEN=$ADMIN_TOKEN \
node scripts/phase1-e2e-smoke.mjs

# Expected output:
# Step 1: Provider Registration & Onboarding ✓
# Step 2: Renter Creation & Funding ✓
# Step 3: Pricing Verification ✓
# Step 4: vLLM Job Submission ✓
# Step 5: Metering Verification ✓
# Step 6: Billing Verification ✓
# Summary: 12/12 checks passed ✓
```

**Record Each Check:**
- [ ] Provider registration: PASS
- [ ] Provider heartbeat: PASS
- [ ] Renter registration: PASS
- [ ] Renter balance funded: PASS
- [ ] Pricing API available: PASS
- [ ] RTX 4090 price verified: PASS
- [ ] vLLM job submitted: PASS
- [ ] Token counts present: PASS
- [ ] Serve session created: PASS
- [ ] Token count persisted: PASS
- [ ] Cost calculated: PASS
- [ ] Database persistence confirmed: PASS

**If Any Fail:**
1. Re-run failed test with verbose output
2. Check VPS logs for errors: `ssh root@76.13.179.86 tail -50 /root/dc1-platform/backend/logs/app.log`
3. Query database directly to verify state
4. Escalate to appropriate engineer (Backend/DevOps/Smart Contracts)

---

## Post-Test Analysis (11:30-12:00)

### Data Collection

```bash
# Query metering data for report
curl https://api.dcp.sa/api/admin/serve-sessions/$JOB_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'

# Query pricing seed
sqlite3 /root/dc1-platform/backend/data/providers.db \
  'SELECT * FROM gpu_pricing ORDER BY rate_halala ASC;'

# Check provider earnings
sqlite3 /root/dc1-platform/backend/data/providers.db \
  'SELECT id, name, claimable_earnings_halala FROM providers WHERE id IN (...);'
```

### Results Summary

Create report with:
- [ ] Total checks passed / failed
- [ ] Any test retries and outcomes
- [ ] Database integrity checks passed
- [ ] Performance metrics (if any anomalies)
- [ ] Screenshots of successful E2E flow

---

## Go/No-Go Decision Matrix

### GO CRITERIA (All Must Pass)

✓ Metering: 11/11 checks pass (including silent failure detection)
✓ Pricing: 11/11 tests pass (RTX 4090 at 26,700 confirmed)
✓ Escrow: 4/4 tests pass (settlement working)
✓ VPS: 4/4 health checks pass (services online, HTTPS working)
✓ Provider: 5+ providers onboarded (from O tests)
✓ E2E: 12/12 checks pass (complete pipeline validated)
✓ No silent metering failures detected (critical)

**Decision:** ✅ **GO** → Launch Phase 1 immediately

---

### NO-GO CRITERIA (Any One Blocks Launch)

✗ Metering test fails (M4 silent failure detection fails)
✗ Pricing API unavailable or incorrect
✗ Escrow settlement fails (E3 on-chain)
✗ VPS unhealthy or services offline
✗ Fewer than 5 providers onboarded
✗ E2E test fails any critical check
✗ Database inconsistencies detected

**Decision:** ❌ **NO-GO** → Fix issues and retest Day 5 afternoon or delay to Day 6

---

## Troubleshooting Guide

### "Serve session not found" (DCP-619 test)

**Symptom:** `/api/admin/serve-sessions/{job_id}` returns 404

**Causes:**
1. Job ID mismatch (typo or parsing issue)
2. serve_sessions.job_id != jobs.job_id
3. Database not persisting inserts

**Fix:**
1. Verify job_id from job response matches query
2. Query database directly: `SELECT * FROM serve_sessions WHERE job_id = '...'`
3. Check backend logs for INSERT errors
4. Escalate to Backend Engineer if persist fails

---

### "Token counts 0" (Silent metering failure)

**Symptom:** vLLM returns 150 tokens but serve_sessions.total_tokens = 0

**Causes:**
1. serve_sessions UPDATE wrapped in try-catch is failing silently
2. Database transaction issue
3. Job ID mismatch on UPDATE clause

**Fix:**
1. Check backend logs for UPDATE errors (they're caught but may be logged)
2. Query serve_sessions.updated_at timestamp
3. If UPDATE never ran, restart backend and retest
4. **CRITICAL**: This is a launch-blocking issue

---

### "Pricing API returns empty" (SP26-006)

**Symptom:** GET /api/renters/pricing returns 503 "pricing table empty"

**Causes:**
1. gpu_pricing table not seeded on startup
2. INSERT OR IGNORE not working due to duplicate
3. Database schema mismatch

**Fix:**
1. Check database: `SELECT COUNT(*) FROM gpu_pricing;`
2. If empty, manually seed: `INSERT INTO gpu_pricing VALUES (...)`
3. Restart backend to re-seed
4. Escalate to Backend Engineer if persist fails

---

### "Provider cannot come online" (SP26-005)

**Symptom:** Provider heartbeat accepted but appears offline in admin API

**Causes:**
1. Heartbeat endpoint not updating provider.status
2. Admin API not reflecting database changes
3. Database transaction not committed

**Fix:**
1. Check provider status in database directly
2. Verify /api/admin/providers returns latest data
3. Query with fresh credentials to avoid caching
4. Escalate if database not updating

---

## Escalation Contacts

- **Backend Engineer:** Code fixes, API issues, database consistency
- **Smart Contracts Engineer:** Escrow settlement, on-chain issues
- **DevOps Engineer:** VPS health, container availability, infrastructure
- **CEO:** Go/No-Go decision, launch coordination

---

## Success Confirmation

When all tests pass:

```
✓ Phase 1 Integration Testing COMPLETE
✓ All 6 Suite: 100% pass rate
✓ E2E smoke test: 12/12 checks pass
✓ Silent metering failures: DETECTED and PREVENTED
✓ Pricing: Competitive advantage confirmed (23.7% below Vast.ai)
✓ VPS: Fully operational
✓ 5+ providers: Online and ready
✓ Database integrity: Verified

DECISION: ✅ GO FOR LAUNCH
```

---

*QA Lead: agent 891b2856-c2eb-4162-9ce4-9f903abd315f*
*Execution Date: 2026-03-27*
*Last Updated: 2026-03-23 12:15 UTC*
