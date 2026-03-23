# Phase 1 User Acceptance Testing (UAT) Framework
**Purpose:** Validate all critical user flows work end-to-end before launch
**Owner:** UX Researcher
**Date:** 2026-03-23
**Status:** Framework ready for deployment (SAT 3/29, post-deployment)
**Trigger:** After Phase 1 deployment to staging, before production launch

---

## Overview

UAT validates that the complete user experience works as designed. Unlike research (which explores problems), UAT is acceptance testing — verifying that implemented solutions work correctly.

**Timeline:** SAT 3/29 (post-deployment) through MON 3/31 (go-live decision)

---

## Critical User Flows to Validate

### Flow 1: Buyer Journey (Renter)
```
Signup → Wallet Setup → Template Selection → Job Submission → Results Viewing
```

**Success Criteria:**
- ✓ Signup completes without errors
- ✓ Wallet connects successfully (test with testnet)
- ✓ Can view and select templates
- ✓ Can submit a job
- ✓ Can view results & job history
- ✓ Dashboard displays earnings/cost correctly

**Test Data Needed:**
- Test wallet (with testnet funds)
- Test renter account
- Sample job (inference request)

### Flow 2: Provider Journey
```
Signup → Daemon Setup → Provider Dashboard → Job Execution → Earnings Withdrawal
```

**Success Criteria:**
- ✓ Signup completes
- ✓ Daemon installation documented & working
- ✓ Provider dashboard loads correctly
- ✓ Job execution starts successfully
- ✓ Earnings calculation is correct
- ✓ Withdrawal flow works (test with testnet)

**Test Data Needed:**
- Test provider account
- Test daemon (local or staging)
- Test withdrawal (small amount)

### Flow 3: Dashboard Analytics
```
Renter Dashboard: Costs, Usage, Job History
Provider Dashboard: Earnings, Jobs, Uptime, Withdrawals
```

**Success Criteria:**
- ✓ Renter dashboard metrics match backend data
- ✓ Provider dashboard earnings accurate
- ✓ Job history queries work
- ✓ Uptime calculation correct
- ✓ Cost breakdown understandable

### Flow 4: Payment & Escrow
```
Buyer deposits funds → Smart contract holds → Job completes → Payment released
```

**Success Criteria:**
- ✓ Deposit accepted
- ✓ Escrow contract receives funds
- ✓ Job execution triggers payment release
- ✓ Provider receives payment
- ✓ Withdrawal succeeds

### Flow 5: Error Handling
```
Daemon offline → Job fails → User notified → Retry/Cancel options
```

**Success Criteria:**
- ✓ Offline provider marked as unavailable
- ✓ Failed jobs show clear error messages
- ✓ User can retry or cancel
- ✓ No data loss on failure
- ✓ Support contact available

---

## UAT Test Cases

### Test Case 1: Happy Path — Buyer Rents GPU

**Preconditions:**
- Staging environment deployed
- Test buyer account created
- Test GPU available
- Testnet funds available

**Steps:**
1. Login as buyer
2. View available GPUs
3. Select RTX 4090
4. Submit inference job (e.g., "Hello world")
5. Wait for job completion
6. View results
7. Check billing/cost

**Expected Results:**
- All steps complete successfully
- Results are correct
- Billing shows correct amount
- No errors in console

**Acceptance:** Pass/Fail

---

### Test Case 2: Happy Path — Provider Earns

**Preconditions:**
- Staging environment deployed
- Test provider account created
- Daemon running
- Jobs available

**Steps:**
1. Login as provider
2. Check job queue
3. Job arrives
4. Job executes successfully
5. Check earnings updated
6. Initiate withdrawal

**Expected Results:**
- All steps complete successfully
- Earnings calculated correctly
- Withdrawal initiated
- Status updates in real-time

**Acceptance:** Pass/Fail

---

### Test Case 3: Error Handling — Job Fails

**Preconditions:**
- Staging environment deployed
- Test buyer/provider setup

**Steps:**
1. Submit job that will fail (e.g., timeout)
2. Wait for failure
3. Check error message
4. Try to retry

**Expected Results:**
- Error message is clear
- Buyer is notified
- Buyer can retry
- No charges for failed job

**Acceptance:** Pass/Fail

---

### Test Case 4: Dashboard Data Accuracy

**Preconditions:**
- 5-10 jobs completed
- Earnings calculated
- Cost recorded

**Steps:**
1. Check buyer dashboard cost totals
2. Verify against backend data
3. Check provider earnings totals
4. Verify against transaction logs

**Expected Results:**
- All numbers match
- No discrepancies
- Decimal precision correct

**Acceptance:** Pass/Fail

---

### Test Case 5: Payment Flow

**Preconditions:**
- Escrow contract deployed
- Testnet ETH available
- Provider wallet connected

**Steps:**
1. Deposit funds as buyer
2. Submit job
3. Job completes
4. Check provider wallet
5. Provider withdraws

**Expected Results:**
- Funds flow correctly
- No loss in transaction
- All receipts recorded
- On-chain events match UI

**Acceptance:** Pass/Fail

---

## Test Execution Schedule

**SAT 3/29 (Post-Deployment):**
- [ ] Deploy to staging
- [ ] Create test accounts (buyer + provider)
- [ ] Run smoke test (verify basic connectivity)
- [ ] Run happy path tests (TC1, TC2)

**SUN 3/30:**
- [ ] Run error handling tests (TC3)
- [ ] Run dashboard accuracy tests (TC4)
- [ ] Run payment flow test (TC5)
- [ ] Verify all data integrity
- [ ] Check for any regressions

**MON 3/31 (Pre-Launch):**
- [ ] Final regression testing
- [ ] Sign-off from engineering
- [ ] Final go/no-go decision
- [ ] Deploy to production

---

## Test Execution Template

```
Test Case: [TC#]
Executed By: [Name]
Date: [Date/Time]
Environment: [Staging]
Result: [ ] PASS [ ] FAIL

Issues Found:
1. [Issue description]
   - Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
   - Blocker: [ ] Yes [ ] No
   - Fix: [What needs to happen]

Sign-off:
- [ ] QA Engineer reviewed
- [ ] Engineering lead approved
- [ ] Blocker resolved (if any)
```

---

## Go/No-Go Criteria

**LAUNCH (MON 3/31):**
✓ All 5 critical flows execute end-to-end
✓ No critical or high-severity blockers
✓ Data accuracy verified (±0% discrepancy)
✓ Payment flow works correctly
✓ Error handling is clear

**CONDITIONAL LAUNCH:**
⚠ 1-2 high-severity issues with documented workaround
⚠ Minor cosmetic issues
⚠ Non-critical feature missing (post-launch fix)

**DELAY:**
✗ Critical flow fails
✗ Data loss or accuracy issues
✗ Payment flow broken
✗ Security issue discovered

---

## Sign-Off & Stakeholders

**QA Lead:** Approves all test results
**Engineering Lead:** Signs off on fixes
**Product Manager:** Makes go/no-go decision
**UX Researcher:** Validates user experience assumptions

---

## Post-Launch Monitoring

**Week 1 (3/29 - 4/4):**
- Monitor early user signup/jobs
- Track error rates
- Collect user feedback
- Document any UX friction

**Week 2 (4/5 - 4/11):**
- Analyze user behavior patterns
- Prioritize post-launch improvements
- Prepare Phase 2 roadmap

---

**Prepared by:** UX Researcher
**For:** Phase 1 Launch Validation
**Status:** Ready to execute SAT 3/29+
**Owned by:** QA Engineer (execution), UX Researcher (user experience validation)
