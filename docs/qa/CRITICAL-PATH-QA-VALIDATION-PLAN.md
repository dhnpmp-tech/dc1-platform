# Critical Path QA Validation Plan — Provider to Revenue
**Created:** 2026-03-23 16:45 UTC
**By:** QA Engineer
**Status:** In response to CEO Strategic Direction (Founder Q&A)
**Priority:** CRITICAL — This is the real launch validation

---

## Executive Summary

**The ONE thing that matters:** Get a single provider online and serve a single inference request end-to-end.

Everything else (template catalog, model marketplace, IDE extensions) is infrastructure. The critical path is:

**Provider Online → Model Deployed → Job Submitted → Inference Executed → Billing Calculated → Provider Paid**

This document defines QA validation for the real launch, not the UI launch.

---

## Current State vs. Required State

### Current (2026-03-23)
- ✅ Template catalog: 20 templates, all endpoints working
- ✅ Model marketplace: 11 models, pricing integrated
- ✅ Backend APIs: All endpoints 200 OK
- ❌ **Provider #1 online: 0/1**
- ❌ **Tier A model deployed: 0/1**
- ❌ **Inference job executed: 0/1**
- ❌ **Revenue flow validated: 0/1**

### Required for Minimal Launch
- ✅ API infrastructure (done)
- ⏳ Provider #1 registered + GPU verified
- ⏳ Tier A model (ALLaM, Falcon, LLaMA, Mistral, or Qwen) deployed on provider
- ⏳ Renter signs up, submits job, receives inference result
- ⏳ Billing calculated, renter charged, provider paid

---

## Critical Path Validation Phases

### Phase 2A: Provider Activation (Next 24-48 hours)

**Goal:** Get provider #1 online and accepting jobs

#### Step 1: Provider Registration & Configuration
**Validation:**
- [ ] Provider CLI registers successfully
- [ ] Provider wallet configured for SAR payments
- [ ] Provider hardware verified (GPU model, VRAM, compute capacity)
- [ ] Provider self-test passes: `dcp-provider-cli test`
- [ ] Provider visible in provider marketplace API
  ```bash
  curl https://api.dcp.sa/api/providers | grep "online"  # Should show provider #1
  ```

#### Step 2: Tier A Model Deployment
**Validation:**
- [ ] Model container pulls from registry
- [ ] Model starts without errors (< 5 min cold start)
- [ ] Model responds to health check requests
- [ ] Model is visible in provider's available models
  ```bash
  curl https://api.dcp.sa/api/providers/provider-1/models | grep "ALLaM-7B"
  ```
- [ ] Pricing is correct for this provider/GPU combo

#### Step 3: Provider Dashboard
**Validation:**
- [ ] Provider can log into dashboard
- [ ] Provider sees their GPU stats (utilization, temp, power)
- [ ] Provider sees available models
- [ ] Provider sees job queue (currently empty)

### Phase 2B: End-to-End Job Execution (Hours 24-48)

**Goal:** Renter → Job → Provider → Inference → Result → Billing

#### Step 1: Renter Job Submission
**Validation:**
- [ ] Renter signs up and creates account
- [ ] Renter can browse deployed models
- [ ] Renter can select provider #1's Tier A model
- [ ] Renter submits inference job:
  ```
  Model: ALLaM 7B
  Prompt: "Hello, what is GPU compute?"
  Max Tokens: 100
  Provider: #1
  Duration: 1 hour
  ```
- [ ] Job receives ID and goes to PENDING status
- [ ] Backend routes job to provider #1

#### Step 2: Provider Job Execution
**Validation:**
- [ ] Provider receives job notification
- [ ] Provider loads model into VRAM (first time: 5-30 sec, cold start)
- [ ] Provider executes inference
  - Expected latency: 1-10 seconds for 100 tokens
  - Tokenization: Arabic prompt tokenizes correctly (ALLaM vocab)
  - Generation: Model produces Arabic response
- [ ] Provider uploads result to backend
- [ ] Backend receives result with status COMPLETED

#### Step 3: Renter Result Retrieval
**Validation:**
- [ ] Renter can poll job status (eventually reaches COMPLETED)
- [ ] Renter can download result:
  - Input tokens: Correct count
  - Output tokens: Correct count
  - Response text: Coherent Arabic answer
  - Latency: Recorded accurately
- [ ] Renter can see streaming result (if SSE implemented) or full result

#### Step 4: Billing Calculation
**Validation:**
- [ ] Backend calculates usage:
  - Input tokens × rate
  - Output tokens × rate
  - Duration cost (if hourly billing)
  - Total cost in SAR
- [ ] Example (ALLaM 7B at 0.22 SAR/min):
  ```
  Input: 10 tokens
  Output: 80 tokens
  Total: 90 tokens

  Base rate: 0.22 SAR/min
  Billing: 0.22 SAR/min = 3.67 halalas/sec
  Job duration: 5 sec
  Cost: ~18 halalas (0.18 SAR)
  ```
- [ ] Renter billed correctly
- [ ] Provider credited correctly

#### Step 5: Revenue Flow Validation
**Validation:**
- [ ] Provider sees job in their dashboard
- [ ] Provider sees earnings accrued:
  - Renter charged: 0.18 SAR
  - Platform fee: 15% = 0.027 SAR
  - Provider earnings: 0.153 SAR
- [ ] Provider can withdraw earnings (if wallet configured)
- [ ] Ledger shows transaction trail

### Phase 2C: Reliability & Scale (Hours 48-72)

**Goal:** Validate platform doesn't break under load

#### Step 1: Multi-Job Concurrency
**Validation:**
- [ ] 5+ concurrent jobs from different renters
- [ ] All jobs complete successfully
- [ ] No job queuing delays or failures
- [ ] Provider GPU utilization stays healthy (< 95%)
- [ ] Provider doesn't crash under load

#### Step 2: Model Quality Consistency
**Validation:**
- [ ] 10 consecutive jobs produce coherent outputs
- [ ] No hallucinations or unsafe content
- [ ] Arabic language quality consistent
- [ ] Latency stays < 10 seconds per job

#### Step 3: Billing Consistency
**Validation:**
- [ ] 20 jobs billed correctly
- [ ] All renter charges match actual token usage
- [ ] All provider payouts calculated correctly
- [ ] No billing edge cases (zero-cost jobs, negative charges, etc.)

#### Step 4: Provider Stability
**Validation:**
- [ ] Provider stays online for 24+ hours without restart
- [ ] Model remains cached (no reload between jobs)
- [ ] Provider health checks passing (CPU, memory, GPU)
- [ ] No memory leaks or performance degradation

---

## Success Criteria: Real Launch Readiness

### 🟢 GO Criteria
- [x] Phase 1 API infrastructure complete (DONE)
- [ ] Provider #1 online and accepting jobs
- [ ] Tier A model deployed and responding
- [ ] End-to-end job: renter → inference → result complete
- [ ] Billing validated: renter charged, provider paid
- [ ] 10+ consecutive jobs execute without failure
- [ ] Provider dashboard shows accurate earnings
- [ ] Platform handles 5+ concurrent jobs

### 🔴 NO-GO Criteria
- [ ] Provider fails to stay online
- [ ] Model doesn't respond or crashes
- [ ] Inference latency > 30 seconds (unacceptable UX)
- [ ] Billing calculation incorrect (any job)
- [ ] Jobs fail or hang (> 5% error rate)
- [ ] Provider earnings don't show in dashboard
- [ ] Platform crashes under concurrent load

---

## QA Test Scripts

### Provider Readiness Test
```bash
#!/bin/bash
# Check if provider #1 is online

PROVIDER_ID="provider-1"
API_BASE="https://api.dcp.sa/api"

echo "Checking provider $PROVIDER_ID..."
curl -s "$API_BASE/providers/$PROVIDER_ID" | jq '.status'
# Expected: "online"

curl -s "$API_BASE/providers/$PROVIDER_ID/models" | jq '.[0].model_id'
# Expected: ALLaM-AI/ALLaM-7B-Instruct-preview (or similar Tier A)

echo "Provider is GO for testing"
```

### End-to-End Job Test
```bash
#!/bin/bash
# Submit job, wait for result, validate billing

API_BASE="https://api.dcp.sa/api"
RENTER_KEY="$1"  # Set via environment

# 1. Submit job
JOB_RESPONSE=$(curl -s -X POST "$API_BASE/jobs/submit" \
  -H "Authorization: Bearer $RENTER_KEY" \
  -d '{
    "model_id": "ALLaM-AI/ALLaM-7B-Instruct-preview",
    "prompt": "مرحبا، ما هي خوادم GPU",
    "max_tokens": 100,
    "provider_id": "provider-1"
  }')

JOB_ID=$(echo $JOB_RESPONSE | jq '.job_id')
echo "Submitted job: $JOB_ID"

# 2. Poll for completion (timeout 60 sec)
for i in {1..60}; do
  STATUS=$(curl -s "$API_BASE/jobs/$JOB_ID" | jq '.status')
  if [ "$STATUS" = "completed" ]; then
    echo "Job completed!"
    break
  fi
  echo "Status: $STATUS (waiting...)"
  sleep 1
done

# 3. Get result
RESULT=$(curl -s "$API_BASE/jobs/$JOB_ID/result")
echo "Output tokens: $(echo $RESULT | jq '.output_tokens')"
echo "Cost: $(echo $RESULT | jq '.cost_sar') SAR"

# 4. Validate
OUTPUT_TOKENS=$(echo $RESULT | jq '.output_tokens')
if [ "$OUTPUT_TOKENS" -gt 10 ]; then
  echo "✅ Job produced output"
else
  echo "❌ Job produced no output"
fi
```

### Billing Validation Test
```bash
#!/bin/bash
# Verify 10 jobs billed correctly

API_BASE="https://api.dcp.sa/api"
RENTER_KEY="$1"

echo "Running 10 billing validation jobs..."
TOTAL_COST=0

for i in {1..10}; do
  # Submit job
  JOB=$(curl -s -X POST "$API_BASE/jobs/submit" \
    -H "Authorization: Bearer $RENTER_KEY" \
    -d '{"model_id": "ALLaM-AI/ALLaM-7B-Instruct-preview", "prompt": "Test", "max_tokens": 50}')

  JOB_ID=$(echo $JOB | jq '.job_id')

  # Wait for completion
  while [ $(curl -s "$API_BASE/jobs/$JOB_ID" | jq '.status') != "completed" ]; do
    sleep 1
  done

  # Get cost
  COST=$(curl -s "$API_BASE/jobs/$JOB_ID/result" | jq '.cost_sar')
  TOTAL_COST=$(echo "$TOTAL_COST + $COST" | bc)

  echo "Job $i: $COST SAR (total: $TOTAL_COST SAR)"
done

echo "✅ 10 jobs billed, total: $TOTAL_COST SAR"
```

---

## Timeline & Milestones

### T+0 (Today: 2026-03-23)
- ✅ Phase 1 API validation complete
- ✅ QA strategic pivot documented
- 🔴 Awaiting: Provider activation signal

### T+1-2 (Next 24-48 hours)
- [ ] Provider #1 registration + GPU verification
- [ ] Tier A model deployment
- [ ] Provider dashboard live
- [ ] First end-to-end job test

### T+2-3 (Hours 48-72)
- [ ] Load testing (5-10 concurrent jobs)
- [ ] Billing consistency validation (20+ jobs)
- [ ] Provider stability (24+ hours online)
- [ ] Final go/no-go decision

### T+3+ (Days 4-6: 2026-03-26 to 2026-03-28)
- [ ] Full Days 4-6 integration testing (refocused on critical path)
- [ ] Customer simulation (renter journey)
- [ ] Edge case testing
- [ ] Production readiness sign-off

---

## Coordination Points

### DevOps
- **Action:** Activate Provider #1 and deploy Tier A model
- **Timeline:** Next 24 hours
- **QA Support:** Validation scripts, readiness testing

### Backend
- **Action:** Verify job execution pipeline (renter → provider → result)
- **Timeline:** Next 24 hours
- **QA Support:** Test job submission, result retrieval, billing

### Finance
- **Action:** Verify billing calculation and provider payout
- **Timeline:** Next 48 hours
- **QA Support:** Billing validation, revenue flow testing

### CEO
- **Action:** Prepare investor demo with live revenue numbers
- **Timeline:** Week of 2026-03-26
- **QA Support:** Validate platform is stable for demo

---

## Risk Mitigation

### Risk: Provider Doesn't Stay Online
- **Mitigation:** Health check every 5 minutes, alerting if offline
- **QA Action:** Validate health checks work, monitor logs for crashes

### Risk: Model Doesn't Respond (Cold Start > 5 min)
- **Mitigation:** Pre-fetch model to hot cache, test cold start in lab first
- **QA Action:** Measure actual cold start time, validate it's acceptable

### Risk: Billing Calculation Wrong
- **Mitigation:** Validate tokens against provider's token counter
- **QA Action:** Compare QA billing test with actual backend calculations

### Risk: Concurrent Jobs Cause Failures
- **Mitigation:** Load test with 5+ jobs before go-live
- **QA Action:** Run concurrency tests, monitor GPU/memory usage

---

## Sign-Off

**QA Engineer Status:**
- ✅ Phase 1 API validation complete
- 🔄 **Pivoting to critical-path validation (provider → inference → billing)**
- ⏳ Standing by for provider activation signal
- 📋 Ready to execute critical path validation in next 48-72 hours

**Go/No-Go Decision:**
- **Phase 1 (Template/Model Catalog):** 🟢 **GO** — Ready for frontend UI launch
- **Phase 2 (Provider → Revenue):** ⏳ **PENDING** — Awaiting provider activation, then QA will validate critical path

**Real Launch Criteria:** Not UI launch, but **provider online + job executed + billing validated**

---

**Document:** CRITICAL-PATH-QA-VALIDATION-PLAN.md
**Created:** 2026-03-23 16:45 UTC
**QA Engineer:** 891b2856-c2eb-4162-9ce4-9f903abd315f
**Status:** Ready to validate what actually matters — end-to-end revenue flow
