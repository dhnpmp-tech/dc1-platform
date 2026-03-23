# DCP Deployment & QA Execution Guide
**Status:** 🟢 READY FOR DEPLOYMENT
**Date:** 2026-03-23 15:50 UTC
**QA Engineer:** 891b2856-c2eb-4162-9ce4-9f903abd315f

---

## Overview

Complete guide for deploying DCP infrastructure and executing the full QA validation suite (Phase 1 & Phase 2). This document provides step-by-step instructions for DevOps, QA, and Engineering teams.

---

## Pre-Deployment Checklist

### Backend Engineer (DCP-524)
- [ ] VPS 76.13.179.86 is accessible via SSH
- [ ] API service configured to listen on port 8083
- [ ] NGINX reverse proxy configured for api.dcp.sa:443
- [ ] TLS/HTTPS certificate valid (Let's Encrypt confirmed through 2026-06-21)
- [ ] Backend routes deployed:
  - [ ] `backend/src/routes/templates.js` (110 lines)
  - [ ] `backend/src/routes/models.js` (3,500+ lines)
  - [ ] `backend/src/routes/providers.js` (marketplace)
  - [ ] All admin and monitoring endpoints
- [ ] PM2 services started:
  - [ ] `dc1-provider-onboarding` on port 8083
  - [ ] `dc1-webhook`
  - [ ] Monitoring processes

### DevOps / Infrastructure
- [ ] Provider VPS networking configured
- [ ] GPU node access enabled for Phase 2 testing
- [ ] Model pre-fetching infrastructure ready
  - [ ] `infra/docker/prefetch-models.sh` deployable
  - [ ] Tier A models (ALLaM, Falcon, Qwen, Llama, Mistral, Nemotron) queued for prefetch

### QA Engineer
- [ ] All test infrastructure committed:
  - [ ] `scripts/template-catalog-e2e.mjs` ✅
  - [ ] `scripts/model-catalog-smoke.mjs` ✅
  - [ ] `scripts/inference-benchmarks-runner.mjs` ✅
  - [ ] `scripts/arabic-rag-validation-runner.mjs` ✅
  - [ ] `scripts/monitor-phase1-deployment.sh` ✅
  - [ ] `scripts/monitor-phase2-providers.sh` ✅
- [ ] All documentation completed:
  - [ ] `MASTER-QA-EXECUTION-PLAN.md` ✅
  - [ ] `PHASE1-GO-READINESS-CHECKPOINT.md` ✅
  - [ ] `PHASE2-IMPLEMENTATION-STATUS.md` ✅
  - [ ] `post-deploy-checklist.md` ✅

---

## Deployment Phase (DCP-524)

### Step 1: Verify API Deployment
```bash
# From any machine with network access to api.dcp.sa:
curl -s -H "Authorization: Bearer <test-key>" https://api.dcp.sa/api/health
# Expected response: HTTP 200

curl -s https://api.dcp.sa/api/templates
# Expected response: HTTP 200, valid JSON array
```

### Step 2: Signal Deployment Completion
Once api.dcp.sa responds to both /api/templates and /api/models endpoints:
1. Update DCP-524 issue status to `done`
2. Post comment: "API deployment completed, all endpoints live"
3. This triggers automatic Phase 1 test execution

---

## Phase 1: New Feature Validation

### Automatic Execution (Recommended)
```bash
# From the platform directory:
export DCP_RENTER_KEY="<test-renter-credentials>"
./scripts/monitor-phase1-deployment.sh https://api.dcp.sa

# This script:
# 1. Polls api.dcp.sa every 10 seconds (up to 1 hour)
# 2. Upon deployment detection, runs both test suites
# 3. Generates comprehensive report
# 4. Outputs GO/NO-GO decision
```

**Expected Duration:** 1-2 minutes (from script start to results)

### Manual Execution (If needed)
```bash
# Set environment
export DCP_API_BASE="https://api.dcp.sa"
export DCP_RENTER_KEY="<test-key>"

# Run tests
node scripts/template-catalog-e2e.mjs
node scripts/model-catalog-smoke.mjs

# Expected: Both scripts complete in ~1 minute total
# Expected output: Detailed check results with PASS/FAIL summary
```

### Phase 1 Post-Deploy Verification
```bash
# Execute post-deploy smoke checklist
./infra/scripts/post-deploy-verify.sh --batch phase1-launch --api-base https://api.dcp.sa

# Checks: DCP-172, DCP-216, DCP-234, DCP-241, DCP-254
# Duration: ~8 minutes
# Output: infra/artifacts/post-deploy/<run_id>/summary.txt
```

### Phase 1 GO/NO-GO Decision
**GO Criteria:**
- ✅ Template Catalog test: All 8 checks pass
- ✅ Model Catalog test: All 15+ checks pass
- ✅ Post-deploy checklist: All 5 batches green
- ✅ No 401/403/404/429/500 errors
- ✅ Monitoring systems healthy

**Result:** Post to Paperclip issue with:
```
Phase 1 QA: GO for template/model catalog activation
- Template Catalog E2E: PASS (8/8 checks)
- Model Catalog Smoke: PASS (15+/15+ checks)
- Post-Deploy Checklist: PASS (DCP-172, 216, 234, 241, 254 all green)
- Duration: 10 minutes
- Ready for renters to access templates and models
```

---

## Phase 2: Performance & RAG Validation

### Prerequisites
- [ ] DCP-524 deployment complete and Phase 1 tests passed
- [ ] At least 1 provider registered and GPU-equipped
- [ ] Tier A models deployed to provider(s)
- [ ] Model pre-fetching complete (ALLaM, Falcon, Qwen, Llama, Mistral, Nemotron)
- [ ] Provider marketplace responding with GPU availability

### Automatic Execution (Recommended)
```bash
# From the platform directory:
export DCP_RENTER_KEY="<test-renter-credentials>"
./scripts/monitor-phase2-providers.sh https://api.dcp.sa

# This script:
# 1. Polls marketplace for active providers (every 30 seconds)
# 2. Checks for Tier A model availability
# 3. Upon readiness, runs both test suites in sequence:
#    - Inference benchmarks (40 minutes)
#    - Arabic RAG validation (30 minutes)
# 4. Generates comprehensive performance reports
# 5. Outputs final launch readiness assessment
```

**Expected Duration:** 70 minutes (test execution only, not polling)

### Manual Execution (If needed)
```bash
# Set environment
export DCP_API_BASE="https://api.dcp.sa"
export DCP_RENTER_KEY="<test-key>"

# Run inference benchmarks (40 minutes)
node scripts/inference-benchmarks-runner.mjs
# Output: docs/qa/sprint27-inference-benchmarks-report.md

# Run Arabic RAG validation (30 minutes)
node scripts/arabic-rag-validation-runner.mjs
# Output: docs/qa/sprint27-arabic-rag-validation-report.md
```

### Phase 2 GO/NO-GO Decision
**GO Criteria:**
- ✅ All 6 Tier A models deploy and respond
- ✅ Latency metrics within SLA targets:
  - Single-request latency: < 3000ms
  - Batch throughput: > 50 tokens/sec
  - Arabic overhead: < 20%
- ✅ Arabic RAG components functional:
  - Embeddings: 1024-dim vectors generated
  - Reranker: Relevance scores (0-1, properly ordered)
  - LLM: Coherent Arabic answers generated
- ✅ All metrics within SLA targets
- ✅ Human quality assessment passed (RAG answers)

**Result:** Post to Paperclip issue with:
```
Phase 2 QA: GO for production deployment
- Inference Benchmarks: PASS (6/6 models, all SLA targets met)
- Arabic RAG Validation: PASS (3/3 components, quality approved)
- Performance Metrics: Within SLA
- Duration: 70 minutes
- Ready for production launch
```

---

## Test Results & Artifacts

### Phase 1 Results Location
```
docs/qa/phase1-results/<timestamp>/
├── PHASE1-TEST-RESULTS.md          (Summary report)
├── template-catalog-output.txt     (Test output)
└── model-catalog-output.txt        (Test output)
```

### Phase 2 Results Location
```
docs/qa/phase2-results/<timestamp>/
├── PHASE2-TEST-SUMMARY.md                        (Summary)
├── LAUNCH-READINESS-REPORT.md                    (Final report)
├── sprint27-inference-benchmarks-report.md       (Auto-generated)
├── sprint27-arabic-rag-validation-report.md      (Auto-generated)
├── inference-benchmarks-output.txt               (Test output)
└── arabic-rag-validation-output.txt              (Test output)
```

---

## Failure Recovery

### Phase 1 Failure
If Phase 1 tests fail:
1. Review error logs in phase1-results/<timestamp>/
2. Identify failure reason (missing endpoint, auth issue, etc.)
3. **Escalate to Backend Engineer immediately**
4. Do NOT proceed to Phase 2 until Phase 1 passes
5. Once fix deployed, re-run Phase 1 tests

### Phase 2 Failure
If Phase 2 tests fail:
1. Review specific test output (benchmarks or RAG)
2. Identify latency or functional issue
3. **Escalate to ML Infra Engineer** (latency issues)
4. **Escalate to Product Team** (answer quality issues)
5. Once optimized, re-run Phase 2 tests

### Timeout Failures
If monitoring scripts timeout:
1. Manually check deployment status:
   ```bash
   curl https://api.dcp.sa/api/templates
   curl https://api.dcp.sa/api/models
   ```
2. Verify network connectivity to api.dcp.sa
3. If endpoints not live, escalate to Backend Engineer
4. If endpoints live, run tests manually

---

## Escalation & Communication

### During Execution
- Monitor test script output for real-time status
- If any checks fail, escalation messages print to console
- Results automatically saved to timestamped directories

### Upon Completion
1. Review final GO/NO-GO decision
2. Post results to Paperclip issue
3. If GO: proceed to production launch
4. If NO-GO: escalate to respective team, identify fixes, re-test

### Required Notifications
- **Phase 1 Complete:** Post comment with summary, attach test results
- **Phase 2 Complete:** Post comment with summary, attach performance metrics
- **Any Failure:** Immediate escalation comment with diagnostics

---

## Monitoring Scripts Reference

### Phase 1 Monitor
**Script:** `scripts/monitor-phase1-deployment.sh`
```bash
Usage: ./scripts/monitor-phase1-deployment.sh [--api-base <url>]
Default API: https://api.dcp.sa
Poll Interval: 10 seconds
Timeout: 1 hour
Tests: Template + Model catalog (1 min total)
```

### Phase 2 Monitor
**Script:** `scripts/monitor-phase2-providers.sh`
```bash
Usage: ./scripts/monitor-phase2-providers.sh [--api-base <url>]
Default API: https://api.dcp.sa
Poll Interval: 30 seconds
Timeout: 2 hours
Tests: Inference + RAG (70 min total)
```

---

## Complete Timeline

```
T+0:00   DCP-524 deployment starts
T+0:XX   Backend Engineer signals: "api.dcp.sa responding"
T+1:00   Phase 1 tests complete
T+1:10   Phase 1 GO decision posted
T+4:00   Provider activation signal received
T+4:30   Phase 2 tests start (auto-triggered)
T+75:00  Phase 2 tests complete
T+76:00  Final launch readiness report generated
T+80:00  TOTAL: Full QA validation complete
```

**Expected from DCP-524 signal to launch readiness: ~80 minutes**

---

## Success Checklist

- [ ] Backend Engineer: DCP-524 deployed and confirmed
- [ ] QA Engineer: Phase 1 tests executed and GO issued
- [ ] DevOps: Providers activated and Tier A models available
- [ ] QA Engineer: Phase 2 tests executed and GO issued
- [ ] Product Team: Human quality review of RAG answers passed
- [ ] CEO/Leadership: Final launch approval granted
- [ ] DevOps: Production launch authorized and monitored

---

## Support & Troubleshooting

### API Connectivity Issues
```bash
# Test basic connectivity
ping api.dcp.sa
curl -v https://api.dcp.sa/api/health
```

### Test Failures
- Check test script output: `docs/qa/phase<N>-results/<timestamp>/`
- Verify environment variables: `echo $DCP_API_BASE $DCP_RENTER_KEY`
- Check API logs: `tail -f /var/log/dc1-api.log`

### Timeout Issues
- Check network: `curl -v https://api.dcp.sa/api/templates`
- Verify provider status: Check marketplace endpoint
- Monitor provider GPU utilization during Phase 2

---

**Document Version:** 1.0
**Last Updated:** 2026-03-23 15:50 UTC
**Status:** Ready for production deployment

Contact QA Engineer for questions or issues.
