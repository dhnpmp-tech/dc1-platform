# ML Infrastructure Support for Phase 1 Deployment

**Document Date**: 2026-03-24
**Owner**: ML Infrastructure Engineer
**Status**: ✅ READY FOR DEPLOYMENT
**Critical Dependency**: DCP-641 founder deployment approval

---

## Executive Summary

All ML Infrastructure components are **built, tested, merged to main, and ready for production deployment**. This document ensures deployment teams can quickly integrate and verify infrastructure components once founder approval triggers Phase 1 launch.

**What's Ready:**
- Provider earnings calculator (DCP-770) — for provider onboarding
- Provider onboarding CLI (DCP-766) — 5-minute setup automation
- vLLM per-token metering verification (DCP-757) — billing accuracy validated

**What's Blocked (external dependencies):**
- DCP-641: Awaiting founder deployment approval (code merged, ready to deploy)
- DCP-642: Docker Hub image builds — awaiting GitHub Actions secrets

---

## 1. Earnings Calculator (DCP-770) — Ready to Integrate

**Merged Commit**: 3bc1efe (2026-03-24 02:37 UTC)
**File**: `backend/src/services/earningsCalculator.js` (250 LOC)

### What It Provides
Calculates monthly provider earnings based on GPU model, utilization, and DCP pricing.

**Supported GPU Models**:
- RTX 4090: $268/month net (18.7 month payback)
- RTX 4080: $166/month net (24.1 month payback)
- H100: $408/month net (14.2 month payback)
- H200: $446/month net (13.1 month payback)
- A100: $357/month net (15.8 month payback)
- L40S: $204/month net (22.5 month payback)

### API Endpoints
- `GET /api/providers/earnings/gpus` — Available models
- `GET /api/providers/earnings/estimate?gpu=RTX_4090&utilization=0.70` — Earnings calculation
- `GET /api/providers/earnings/ranges?gpu=RTX_4090` — Earning curves
- `GET /api/providers/earnings/compare?utilization=0.70` — GPU comparison

**Status**: ✅ PRODUCTION READY

---

## 2. Provider Onboarding CLI (DCP-766) — Ready to Deploy

**Merged Commit**: 6e4c198 + 8a01a9a (2026-03-24 02:22-02:26 UTC)
**File**: `scripts/provider-onboard.mjs` (450+ LOC)

### What It Does
Zero-to-active provider setup in ~5 minutes:
1. Prerequisite checks (Node.js, Docker, GPU)
2. GPU benchmark (30 seconds)
3. Provider registration
4. Benchmark submission
5. Display activation summary with earnings

### Usage
```bash
node scripts/provider-onboard.mjs  # Interactive
node scripts/provider-onboard.mjs --dry-run  # Test mode
```

**Status**: ✅ PRODUCTION READY

---

## 3. vLLM Per-Token Metering (DCP-757) — Ready for Production

**Merged Commit**: 33b7167 (2026-03-24 02:07 UTC)

### What It Verifies
End-to-end billing accuracy for vLLM token-based metering with 26 verification checks:
- Database schema validation
- Token count persistence
- Accurate billing calculations
- Invoice generation
- Settlement records

### Test Coverage
```bash
npm test -- metering-smoke.test.js  # Jest tests
node scripts/metering-smoke-test.mjs  # Standalone
```

**Status**: ✅ PRODUCTION READY FOR BILLING

---

## 4. Critical Blocker: DCP-641 Deployment Approval

**Status**: Code merged, awaiting founder approval
**Duration**: ~35 minutes VPS deployment
**Owner**: DevOps / Founding Engineer

Once approved, enables:
- Model catalog queryable
- IDE Extension Phase 1 testing
- QA model integration tests
- UX researcher sessions with live data
- Provider activation campaigns

---

## 5. Blocked: DCP-642 Docker Container Builds

**Blocker**: Missing GitHub Actions secrets
- DOCKER_HUB_USERNAME
- DOCKER_HUB_TOKEN

Once provided, enables:
- Automatic image builds on main push
- Provider self-service docker pull
- Provider activation automation

---

## 6. Sprint 28 ML Infrastructure Status

**Completed & Merged**:
- ✅ DCP-770: Earnings calculator
- ✅ DCP-766: Onboarding CLI
- ✅ DCP-757: Metering verification

**Awaiting**:
- ⏳ DCP-641: Founder approval (critical)
- 🔴 DCP-642: Docker credentials
- ❓ DCP-759: Task clarification

---

## 7. Deployment Verification

### Pre-Deployment
```bash
git log main --oneline | grep "DCP-770\|DCP-766\|DCP-757"
```

### Post-Deployment (Once DCP-641 Approved)
```bash
curl -s http://api.dcp.sa/api/providers/earnings/gpus | jq .
curl -s http://api.dcp.sa/api/providers/earnings/estimate?gpu=RTX_4090 | jq .
node scripts/provider-onboard.mjs --dry-run
```

---

**Status**: ✅ **ALL INFRASTRUCTURE READY FOR PHASE 1**
**Critical Path**: DCP-641 founder approval
**Timeline**: Phase 1 testing at 2026-03-25 00:00 UTC (20 hours away)
**Support**: ML Infrastructure Engineer (agent 66668463-251a-4825-8a39-314000491624)
