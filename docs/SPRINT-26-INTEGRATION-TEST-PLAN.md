# Sprint 26 Integration Test Plan — Phase 1 Launch Validation

**Date:** 2026-03-23
**Timeline:** Execution Day 5 (2026-03-27)
**QA Lead:** agent 891b2856-c2eb-4162-9ce4-9f903abd315f

---

## Overview

Comprehensive integration test plan validating all 6 Sprint 26 deliverables work together end-to-end. Tests the complete flow from provider deployment through renter usage with metering and billing.

**Goal:** Ensure Phase 1 launch-readiness by Day 6 (go/no-go decision)

---

## Critical Integration Paths

### Path 1: Provider Deployment → Renter Purchase → Metering → Billing

```
Provider Setup (SP26-001 containers)
    ↓
Provider Registration (existing flow)
    ↓
Provider Heartbeat with GPU metrics
    ↓
Escrow Hold Creation (SP26-002 escrow)
    ↓
Renter Views GPU Pricing (SP26-006 pricing)
    ↓
Renter Submits vLLM Job
    ↓
Metering: serve_sessions created (SP26-003 ✅)
    ↓
vLLM Execution and Token Counting
    ↓
Metering: serve_sessions updated with tokens (SP26-003 ✅)
    ↓
Cost Calculation (pricing × tokens)
    ↓
Billing: Renter balance deducted (metering → cost)
    ↓
Provider Earnings: Calculated and tracked
    ↓
Completion & Settlement
```

### Path 2: VPS Deployment Verification (SP26-004)

```
Pull Latest Code to VPS (15+ commits)
    ↓
Database Migrations Applied
    ↓
Admin Endpoints Available
    ↓
Pricing API Returns DCP Prices
    ↓
Metering Queries Work (admin endpoint)
    ↓
Provider Heartbeat Accepted
    ↓
Job Submission Succeeds
    ↓
E2E Smoke Test Passes
```

### Path 3: Provider Onboarding → Economics (SP26-005)

```
Provider Economics Calculator
    ↓
Shows Monthly Profit at 70% Utilization
    ↓
Based on DCP Floor Prices (SP26-006)
    ↓
Provider Makes Informed Decision
    ↓
Registers and Comes Online
    ↓
Completes First Job
    ↓
Earnings Recorded Correctly
```

---

## Test Suites

### Suite 1: Metering & Billing Integration (CRITICAL)

**Depends On:** SP26-003 ✅

**Test Cases:**

```
Test M1: Serve Session Creation on Job Submit
  Given: Valid renter submits vLLM job via API
  When: Job is created successfully
  Then: serve_sessions record exists with job_id
  And: total_tokens = 0, total_billed_halala = 0 (initial state)
  Expected: Database query returns session with correct fields

Test M2: Token Counting After Inference
  Given: vLLM job completes with token response
  When: Backend receives completion response
  Then: serve_sessions.total_tokens > 0
  And: serve_sessions.total_inferences = 1
  Expected: Database reflects actual token count

Test M3: Cost Calculation from Token Rate
  Given: serve_sessions has 150 tokens, RTX 4090 rate = 100 halala/token
  When: Metering UPDATE executes
  Then: serve_sessions.total_billed_halala = 150 × 100 = 15,000
  Expected: Halala calculation matches token × rate

Test M4: Silent Failure Detection (CRITICAL)
  Given: vLLM returns 150 tokens
  When: Metering UPDATE fails silently (wrapped in try-catch)
  Then: Smoke test queries /api/admin/serve-sessions/{job_id}
  And: Detects total_tokens = 0 while vLLM showed 150
  Expected: Test FAILS (alerts to silent metering failure)

Test M5: Renter Balance Deduction
  Given: Renter has 100,000 halala balance
  When: Job costs 15,000 halala (from metering)
  Then: Renter balance updated to 85,000
  Expected: Balance = original - cost

Test M6: Provider Earnings Recorded
  Given: Job completed with 15,000 halala cost
  When: Provider cut calculated (75% to provider, 25% to DCP)
  Then: provider.claimable_earnings_halala += 11,250
  Expected: Provider earnings reflect split correctly
```

**Success Criteria:**
- ✅ All M1-M6 pass
- ✅ Silent metering failures are detected
- ✅ Renter balance and provider earnings reconcile

---

### Suite 2: Pricing Engine Integration (HIGH PRIORITY)

**Depends On:** SP26-006 ✅

**Test Cases:**

```
Test P1: Public Pricing API Returns DCP Prices
  Given: No authentication
  When: GET /api/renters/pricing
  Then: HTTP 200, 6 GPU tiers returned
  And: RTX 4090 = 26,700 halala/hour
  Expected: Frontend can display competitive prices

Test P2: Frontend Pricing Dashboard Integration
  Given: Renter navigates to pricing page
  When: Page loads
  Then: Pricing API called and data displayed
  And: All 6 GPUs shown with SAR and USD conversion
  Expected: User sees DCP 23.7% below Vast.ai

Test P3: Provider Economics Calculator (SP26-005 dependency)
  Given: Provider views earnings projections
  When: Calculator uses RTX 4090 price (26,700 halala/hr)
  Then: Monthly profit at 70% utilization calculated
  And: 26,700 × 24 × 30 × 0.70 = ~13.4M halala/month
  Expected: Provider sees accurate economics

Test P4: Renter Job Cost Estimation
  Given: Renter selects RTX 4090
  When: Requests 1-hour job
  Then: Estimated cost = 26,700 halala
  Expected: Cost matches pricing API

Test P5: Escrow Hold Uses DCP Prices
  Given: Renter submits job on RTX 4090
  When: Escrow hold created for job duration
  Then: Hold amount = 26,700 × duration_hours
  Expected: Escrow matches pricing not legacy rates

Test P6: Admin Can Update Prices
  Given: Market price changes
  When: Admin updates RTX 4090 to 27,000 halala
  Then: GET /api/renters/pricing returns 27,000
  Expected: Price change visible to all renters immediately
```

**Success Criteria:**
- ✅ All P1-P6 pass
- ✅ Frontend displays pricing correctly
- ✅ Provider economics calculator shows accurate projections
- ✅ Escrow and cost estimation use DCP prices

---

### Suite 3: Escrow & Settlement Integration [DEFERRED]

**Status:** Deferred pending funded wallet (founder directive 2026-03-23 14:00 UTC)

**Depends On:** SP26-002 escrow deployment (awaits funded wallet)

**Note:** Not critical for Phase 1 MVP. Will be tested after wallet is funded.

**Planned Test Cases (will run post-wallet-funding):**

```
Test E1: Escrow Hold Created on Job Submit
  Given: Renter submits vLLM job
  When: Job created successfully
  Then: Escrow hold recorded with job_id
  And: Amount = cost_estimate in halala
  Expected: Hold prevents balance double-spend

Test E2: Escrow Hold Released After Completion
  Given: Job completed with metering recorded
  When: Billing finalized
  Then: Escrow hold marked as 'released'
  And: Actual cost deducted from balance
  Expected: No escrow leaks, balance correct

Test E3: On-Chain Escrow (Base Sepolia)
  Given: Job completed on Base Sepolia network
  When: Settlement triggered
  Then: Escrow.sol contract releases funds to provider
  And: Transaction recorded on-chain
  Expected: Provider receives payment via blockchain

Test E4: Failed Job Escrow Release
  Given: Job failed or cancelled
  When: Escrow release triggered
  Then: Hold released without payment
  And: Renter balance restored
  Expected: No charge for failed job
```

**Success Criteria (post-wallet-funding):**
- ✅ All E1-E4 pass
- ✅ Escrow prevents double-spend
- ✅ On-chain settlement works
- ✅ Failed jobs refund correctly

---

### Suite 4: VPS & Container Deployment (SP26-001 + SP26-004)

**Test Cases:**

```
Test D1: Container Image Available
  Given: Provider pulls dc1/llm-worker:latest
  When: Docker pull from registry
  Then: Image downloads successfully
  And: Nemotron models pre-baked and ready
  Expected: Provider can run models immediately

Test D2: VPS Backend Health Check
  Given: Latest code deployed to 76.13.179.86
  When: Run /scripts/vps-health.sh
  Then: All 8 health checks pass
  And: Port 8083 listening, DB responsive
  Expected: Backend ready for traffic

Test D3: HTTPS on api.dcp.sa Live
  Given: Request to https://api.dcp.sa
  When: TLS handshake
  Then: Certificate valid (Let's Encrypt)
  And: No certificate warnings
  Expected: Secure API endpoint works

Test D4: PM2 Services Running
  Given: SSH to VPS
  When: pm2 status
  Then: dc1-provider-onboarding ONLINE
  And: dc1-webhook ONLINE
  Expected: Services auto-restart on failure
```

**Success Criteria:**
- ✅ All D1-D4 pass
- ✅ Container images accessible and working
- ✅ VPS fully operational
- ✅ HTTPS enforced and working

---

### Suite 5: Provider Onboarding End-to-End (SP26-005)

**Test Cases:**

```
Test O1: Provider Registration Flow
  Given: New provider visits signup
  When: Completes registration (email, GPU model, vram)
  Then: Account created, status = pending
  And: Receives welcome email
  Expected: Provider can proceed to onboarding

Test O2: Provider Economics Display
  Given: Provider views earnings projections
  When: Page loads
  Then: Calculator shows:
    - RTX 4090: 26,700 halala/hr × 24h × 30d × 70% = ~13.4M/month profit
    - Based on DCP floor price (SP26-006)
  Expected: Provider sees clear economics

Test O3: Provider Comes Online
  Given: Provider approves, starts daemon
  When: Sends first heartbeat
  Then: Provider status = online
  And: Appears in GET /api/admin/providers
  Expected: Provider ready to accept jobs

Test O4: Provider Gets First Job
  Given: Provider online, renter submits job
  When: Job matches GPU requirements
  Then: Provider receives job assignment
  And: Can execute and return results
  Expected: End-to-end flow works

Test O5: Provider Earnings Accrual
  Given: Provider completes job with 15,000 halala cost
  When: Metering and billing complete
  Then: provider.claimable_earnings_halala updated
  And: Shows in provider dashboard
  Expected: Provider can track earnings
```

**Success Criteria:**
- ✅ All O1-O5 pass
- ✅ 5+ providers onboarded
- ✅ At least 1 provider completes first job
- ✅ Provider earnings displayed correctly

---

### Suite 6: Full E2E Smoke Test (MASTER)

**Script:** `scripts/gpu-job-lifecycle-smoke.mjs`

**Test Flow:**

```
Step 1: Provider Setup
  └─ Register provider, approve, come online

Step 2: Renter Preparation
  └─ Create renter, fund balance with 100,000 halala

Step 3: Pricing Verification
  └─ Fetch /api/renters/pricing, verify RTX 4090 = 26,700

Step 4: Job Submission
  └─ Renter submits vLLM job on RTX 4090
  └─ Escrow hold created for estimated cost

Step 5: Metering Creation
  └─ Verify serve_sessions record created with job_id

Step 6: vLLM Execution
  └─ Provider executes model, returns 150 tokens

Step 7: Metering Update
  └─ Verify serve_sessions.total_tokens updated to 150

Step 8: Billing Calculation
  └─ Cost = 150 tokens × 100 halala/token = 15,000

Step 9: Balance Deduction
  └─ Renter balance: 100,000 → 85,000

Step 10: Provider Earnings
  └─ Provider earnings += 11,250 (75% of 15,000)

Step 11: Job Completion
  └─ Job marked done, escrow released

Step 12: Verification
  └─ Query admin endpoints, verify all data persisted
  └─ Confirm metering pipeline end-to-end
```

**Expected Output:** 12/12 checks pass

---

## Test Execution Schedule

**Day 5 (2026-03-27):**

| Time | Activity | Responsible |
|------|----------|-------------|
| 09:00 | Infrastructure check (VPS, containers) | DevOps Engineer |
| 09:30 | Run pricing API tests | QA Engineer |
| 10:00 | Run metering tests (suites M1-M6) | QA Engineer |
| 10:30 | Run pricing integration tests (suites P1-P6) | QA Engineer |
| 11:00 | Run escrow tests (suites E1-E4) | Smart Contracts Eng |
| 11:30 | Run provider onboarding tests (O1-O5) | QA Engineer |
| 12:00 | Run E2E smoke test (full master flow) | QA Engineer |
| 13:00 | Collect results, document findings | QA Engineer |
| 14:00 | Escalate any failures, decision meeting | CEO |

---

## Pass/Fail Criteria

### GO Decision (Phase 1 Launch Approved)
- ✅ All 6 test suites pass 100%
- ✅ E2E smoke test: 12/12 checks pass
- ✅ No silent metering failures detected
- ✅ Pricing correctly displays DCP advantage
- ✅ At least 5 providers onboarded
- ✅ At least 1 successful provider job completion

### NO-GO Decision (Launch Delayed)
- ❌ Any test suite fails >5%
- ❌ Silent metering failure detected (M4 fails)
- ❌ Pricing API unavailable or incorrect (P1, P2 fail)
- ❌ Escrow settlement fails (E3, E4 fail)
- ❌ VPS unhealthy or containers unavailable
- ❌ Provider cannot complete job

---

## Risk Mitigation

**If Metering Fails (M suite):**
- Fallback: Use vLLM response tokens for billing (less accurate)
- Escalate: Smart Contracts Engineer for escrow logic review

**If Pricing API Down (P suite):**
- Fallback: Use hardcoded fallback prices from code
- Escalate: Backend Engineer for database/API debugging

**If Escrow Fails (E suite):**
- Fallback: Use off-chain billing until on-chain fixed
- Escalate: Smart Contracts Engineer immediately

**If Provider Cannot Come Online (O suite):**
- Check container availability (SP26-001)
- Check heartbeat endpoint (backend routing)
- Fallback: Manual provider setup for demo

---

## Sign-Off

**Pre-Test Checklist:**
- [ ] All 6 Sprint 26 deliverables deployed
- [ ] VPS running latest code
- [ ] Containers accessible from registry
- [ ] Database migrations applied
- [ ] Test credentials prepared (renter key, admin token)
- [ ] Test script dependencies installed (Node.js, fetch support)

**Test Execution:**
- [ ] Run all 6 test suites
- [ ] Document pass/fail for each
- [ ] Escalate failures immediately
- [ ] Collect metering data from admin endpoint

**Launch Decision (Day 6):**
- [ ] All tests pass: **GO DECISION** → Launch Phase 1
- [ ] Failures fixable same day: **HOLD** → Fix and retest
- [ ] Critical failures unfixable: **NO-GO** → Delay launch

---

*QA Engineer: agent 891b2856-c2eb-4162-9ce4-9f903abd315f*
*Sprint 26 Integration Testing Coordinator*
*Execution: Day 5 (2026-03-27) | Decision: Day 6 (2026-03-28)*
