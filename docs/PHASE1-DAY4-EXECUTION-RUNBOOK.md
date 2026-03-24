# Phase 1 Day 4 Execution Runbook

**QA Engineer: Ready for execution on 2026-03-26 08:00 UTC**

## Pre-Execution Setup (07:45 UTC — 15 minutes before start)

### Step 1: Verify Environment Variables

```bash
# Set test credentials (replace with actual values from secure config)
export DCP_PROVIDER_KEY="provider_test_key_from_registration"
export DCP_RENTER_KEY="renter_jwt_from_auth"
export DC1_ADMIN_TOKEN="admin_token_from_config"
export DCP_API_BASE="https://api.dcp.sa"

# Verify environment
echo "Provider Key: ${DCP_PROVIDER_KEY:0:10}..."
echo "Renter Key: ${DCP_RENTER_KEY:0:10}..."
echo "Admin Token: ${DC1_ADMIN_TOKEN:0:10}..."
echo "API Base: $DCP_API_BASE"
```

### Step 2: Open 3 Terminal Windows

```
Terminal 1: Test Execution
Terminal 2: Smoke Test Monitoring
Terminal 3: Live Log Monitoring
```

### Step 3: Pre-Flight Checks

```bash
# Verify API is responding
curl -s https://api.dcp.sa/api/health | head -c 100

# Verify model catalog
curl -s https://api.dcp.sa/api/models | grep -c "name"
# Expected output: 11

# Check database connectivity
npm run db:check
# Expected: ✅ All tables present, constraints enabled
```

## Day 4 Execution Timeline (08:00-12:00 UTC)

### 08:00 UTC — START: 12-Section Pre-Test Validation

Run the 12-section validation checklist:

1. **Environment Setup**
   ```bash
   # All environment variables exported (Step 1 above)
   ```

2. **Database Health**
   ```bash
   npm run db:health-check
   # Expected: Clean state, all tables present
   ```

3. **API Health Checks**
   ```bash
   # Health endpoint
   curl -s https://api.dcp.sa/api/health
   # Should return: 200 OK

   # Model catalog
   curl -s https://api.dcp.sa/api/models
   # Should return: 11 models with pricing

   # Pricing engine
   curl -s -H "Authorization: Bearer $DCP_ADMIN_TOKEN" \
     https://api.dcp.sa/api/pricing/rates
   # Should return: RTX 4090, 4080, H100, etc.
   ```

4. **Provider Flow Validation**
   ```bash
   # Provider registration (if needed)
   curl -X POST https://api.dcp.sa/api/providers/register \
     -H "Content-Type: application/json" \
     -d '{...}'

   # Provider heartbeat
   curl -X POST https://api.dcp.sa/api/providers/heartbeat \
     -H "Authorization: Bearer $DCP_PROVIDER_KEY" \
     -d '{...}'
   ```

5. **Renter Flow Validation**
   ```bash
   # Credit topup
   curl -X POST https://api.dcp.sa/api/renters/topup \
     -H "Authorization: Bearer $DCP_RENTER_KEY" \
     -d '{"amount": 10}'

   # Balance query
   curl -s https://api.dcp.sa/api/renters/balance \
     -H "Authorization: Bearer $DCP_RENTER_KEY"
   ```

6. **Job Lifecycle Validation**
   ```bash
   # Job submission
   curl -X POST https://api.dcp.sa/api/jobs/submit \
     -H "Authorization: Bearer $DCP_RENTER_KEY" \
     -d '{...}'
   ```

7. **Metering Validation**
   - Verify token counting works
   - Confirm cost calculations are accurate (±0.1% tolerance)
   - Check balance deduction

8. **Pricing Verification**
   ```bash
   # Verify RTX 4090 rate
   curl -s https://api.dcp.sa/api/pricing/rates | grep -A 2 "RTX 4090"
   # Expected: $0.267/hr (DCP floor)
   ```

9. **Earnings Validation**
   - Provider earnings calculation correct
   - Platform fee (15%) deducted
   - Payout functionality working

10. **Data Isolation Check**
    - Provider A cannot see Provider B's data
    - Renter A isolated from Renter B

11. **Audit Trail Verification**
    - Job events logged
    - Admin actions tracked
    - Timestamps consistent

12. **Error Handling Validation**
    ```bash
    # Invalid API key
    curl -s -H "Authorization: Bearer invalid_key" \
      https://api.dcp.sa/api/models
    # Expected: 401 Unauthorized

    # Malformed request
    curl -s -X POST https://api.dcp.sa/api/jobs/submit \
      -H "Authorization: Bearer $DCP_RENTER_KEY" \
      -d '{invalid json'
    # Expected: 400 Bad Request
    ```

**Document results:** Create Day 4 report with pass/fail status for each section.

### 08:30 UTC — Execute Unit Test Suite

**Terminal 1:**
```bash
cd /home/node/dc1-platform
npm run test:e2e
# Runs: backend/tests/e2e-marketplace.test.js
# Expected: 100% pass rate
```

**Capture:**
- Pass/fail counts
- Test execution time
- Any failures (escalate immediately)

### 09:15 UTC — Execute Metering Smoke Test

**Terminal 2:**
```bash
cd /home/node/dc1-platform
node scripts/vllm-metering-smoke.mjs
# Verify token counting and cost calculation
```

**Capture:**
- Token counts match
- Costs calculated correctly
- Balance deductions working

### 10:00 UTC — Execute GPU Job Lifecycle Smoke Test

**Terminal 2:**
```bash
cd /home/node/dc1-platform
node scripts/gpu-job-lifecycle-smoke.mjs
# End-to-end job flow validation
```

**Capture:**
- Job submission → Assignment → Result → Billing
- All stage transitions complete
- Timing metrics

### 11:00 UTC — Execute Model Catalog Smoke Test

**Terminal 2:**
```bash
cd /home/node/dc1-platform
node scripts/model-catalog-smoke.mjs
# Verify model catalog accessibility
```

**Capture:**
- 11 models present
- Pricing displayed correctly
- Metadata complete

### 11:30 UTC — Final Validation

**Terminal 1:**
```bash
# Re-verify critical endpoints
curl -s https://api.dcp.sa/api/health
curl -s https://api.dcp.sa/api/models | wc -l
curl -s -H "Authorization: Bearer $DCP_ADMIN_TOKEN" \
  https://api.dcp.sa/api/pricing/rates
```

**Document:** All Day 4 results in final report.

### 12:00 UTC — DECISION POINT

**PASS Criteria (ALL must pass):**
- ✅ All 12 pre-test sections PASS
- ✅ e2e-marketplace.test.js: 100% tests pass
- ✅ Zero silent metering failures
- ✅ Job lifecycle: all stages transition correctly
- ✅ Pricing: rates accurate, SAR conversion correct
- ✅ Data isolation: provider/renter boundaries enforced
- ✅ Audit trail: all actions logged

**NO-GO Triggers (any blocks Day 5):**
- ❌ Critical endpoint returns 500+
- ❌ Test suite >5% failures
- ❌ Silent metering failure
- ❌ Balance corruption or earnings miscalculation
- ❌ Data isolation breach

**Decision:**
- **If PASS:** Post "GO FOR DAY 5" comment to DCP-641, proceed to DCP-774
- **If NO-GO:** Post "BLOCKER FOUND" comment with details, escalate to CEO

## Real-Time Monitoring (Throughout Day 4)

### Terminal 3: Live API Logs
```bash
tail -f backend/logs/app.log
# Watch for errors, slow queries, exceptions
```

### Health Metrics
- API response times (target <200ms)
- Database query times
- Metering accuracy (±0.1% tolerance)
- Memory usage (no leaks)

## Escalation Path

If any critical failure detected:

1. **Post comment to DCP-641** with blocker details
2. **Ping CEO** (@CEO) with impact summary
3. **Create incident document** with:
   - What failed
   - When it failed
   - Root cause (if known)
   - Recovery steps taken
   - Recommendation for Day 5

## Success Criteria

**Day 4 PASS → Day 5 Execution (2026-03-27 09:00 UTC)**
- All 12 sections validated ✅
- All smoke tests complete ✅
- Zero critical failures ✅
- Signed off by QA ✅

---

**Prepared by:** QA Engineer (Agent 891b2856-c2eb-4162-9ce4-9f903abd315f)
**Prepared at:** 2026-03-24 06:02 UTC
**Ready for execution:** 2026-03-26 08:00 UTC
