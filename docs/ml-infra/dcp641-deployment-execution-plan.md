# DCP-641 Deployment Execution Plan

**Document**: ML Infrastructure Deployment Support
**Active Period**: 2026-03-24 04:11 UTC → 2026-03-25 06:00 UTC (25h 49m)
**Owner**: ML Infrastructure Engineer (agent 66668463-251a-4825-8a39-314000491624)
**Status**: ⏳ AWAITING FOUNDER APPROVAL SIGNAL

---

## Executive Summary

DCP-641 (model routing fix) is code-complete and merged to main. Once founder approval is given, deployment execution is straightforward:
- **Duration**: 35 minutes VPS deployment
- **Owner**: Founding Engineer / DevOps
- **ML Infrastructure Role**: Monitor readiness, verify post-deployment

This document outlines the 26-hour monitoring window and execution procedures.

---

## Critical Timeline

```
NOW (04:11 UTC)
    ↓
TODAY 18:00 UTC — DCP-676 Recruitment Checkpoint
    ↓
TODAY 23:59 UTC — DCP-676 Auto-Trigger Fallback
    ↓
TOMORROW 00:00 UTC — PHASE 1 TESTING START (Hard deadline)
    ↓
TOMORROW 06:00 UTC — DCP-641 DEPLOYMENT DEADLINE
    (26h 49m from now)
```

**Critical Window**: If DCP-641 not approved by 06:00 UTC, Phase 1 testing shifts to afternoon (contingency plan)

---

## What I'm Monitoring

### 1. **Founder Approval Signal** (PRIMARY)
**Watch for**: Git commit, issue comment, or Slack message indicating founder GO decision on DCP-641

**Search terms**:
```bash
git log main --since="2 hours ago" --grep="DCP-641\|deployment\|GO\|approve" -i
git log main --all --oneline | grep -i "dcp-641"
```

**Expected indicators**:
- New commit with "approved" or "deployment" in message
- Issue comment with "GO" or founder approval emoji
- Status change to deployment execution

---

### 2. **Code Readiness Verification** (SECONDARY)
**Confirm** DCP-641 code is on main and ready:
```bash
# Verify commit exists
git log main --oneline | grep "1cbfc42\|DCP-641"

# Check routing fix code
git show HEAD:backend/src/routes/models.js | grep -i "hugging\|slash"

# Verify no blockers
git log main --since="1 hour ago" --grep="rollback\|revert" -i
```

---

### 3. **Infrastructure Prerequisites** (TERTIARY)
**Verify** VPS infrastructure is ready:
```bash
# PM2 status on VPS (if access available)
pm2 list

# Port checks
netstat -tlnp | grep 8083  # Backend port
netstat -tlnp | grep 4001  # P2P bootstrap port

# Git status on VPS
cd /home/node/dc1-platform && git status
```

---

## Execution Procedures (Once Approval Given)

### Phase 1: Code Deployment (5 minutes)
```bash
# On VPS 76.13.179.86
ssh root@76.13.179.86

cd /home/node/dc1-platform
git pull origin main  # Pull latest code including DCP-641

# Expected: No conflicts, clean pull
```

**Verification**:
```bash
git log main -1 --oneline
# Should show: "feat(DCP-641): model routing fix..."
```

### Phase 2: Service Restart (3 minutes)
```bash
pm2 restart dc1-provider-onboarding

# Monitor logs for startup
pm2 logs dc1-provider-onboarding | tail -20
# Should show: No errors, service online
```

### Phase 3: Model Catalog Verification (5 minutes)

#### Test 1: Model List Endpoint
```bash
curl -s https://api.dcp.sa/api/models | jq '.models | length'
# Expected: > 10 models returned
```

#### Test 2: Model Detail Endpoint (HuggingFace-style ID)
```bash
# Test with URL-encoded slash: ALLaM-AI%2FALLaM-7B-Instruct-preview
curl -s 'https://api.dcp.sa/api/models/ALLaM-AI%2FALLaM-7B-Instruct-preview' | jq '.model.id'
# Expected: "ALLaM-AI/ALLaM-7B-Instruct-preview"
```

#### Test 3: Pricing Display
```bash
curl -s 'https://api.dcp.sa/api/models?category=llm' | jq '.[0] | {id, name, pricing}'
# Expected: Pricing data returned (SAR/hour, competitor comparison)
```

#### Test 4: Earnings Calculator Integration
```bash
curl -s 'https://api.dcp.sa/api/providers/earnings/estimate?gpu=RTX_4090&utilization=0.70' | jq '.monthly_net'
# Expected: ~268 (SAR earnings)
```

---

## Post-Deployment Verification Checklist

- [ ] Code pulled successfully to VPS
- [ ] PM2 service restart completed
- [ ] No errors in pm2 logs
- [ ] Model list endpoint returns > 10 models
- [ ] HuggingFace-style ID routing works (slash handling correct)
- [ ] Pricing data displays correctly
- [ ] Earnings calculator API responds
- [ ] Zero downtime during restart
- [ ] Database connections stable
- [ ] All 3 ML Infrastructure components functional:
  - [ ] DCP-770: Earnings calculator responding
  - [ ] DCP-766: Provider onboarding CLI works (local test)
  - [ ] DCP-757: Metering endpoints collecting tokens

---

## Support & Escalation

### If Approved by 06:00 UTC Tomorrow
✅ **Execution Path**: Proceed with 35-minute deployment

### If NOT Approved by 06:00 UTC
🔴 **Escalation Path**:
1. **04:00 UTC** (2h before deadline) — Flag as critical blocker to CEO
2. **06:00 UTC** (deadline) — Activate contingency (afternoon testing slot)
3. **Post-mortification** — Document delay reasons and lessons learned

### Support Contact
- **ML Infrastructure Engineer**: agent 66668463-251a-4825-8a39-314000491624
- **On Call**: Continuous monitoring 2026-03-24 04:11 UTC → 2026-03-25 06:00 UTC
- **Slack**: Available for immediate coordination
- **Escalation**: Ready to escalate to CEO/founder if deadline at risk

---

## Parallel Work While Monitoring

While waiting for DCP-641 approval, I'm tracking:

1. **DCP-676 Checkpoint** (18:00 UTC today)
   - UX recruitment decision
   - Financial impact assessment
   - Contingency activation if needed

2. **DCP-642 Docker Hub Credentials**
   - Monitor GitHub Actions for secret availability
   - If available, trigger container builds

3. **DCP-759 Clarification**
   - Await CEO guidance on task definition
   - If clarified, plan Sprint 28 execution

4. **Provider Activation Campaign** (Post-DCP-641)
   - DCP-751 readiness check
   - Earnings calculator integration testing
   - Onboarding CLI field testing

---

## Success Criteria

**Phase 1 Launch Success**: All three ML Infrastructure components operational by 2026-03-25 00:00 UTC

| Component | Success Criteria |
|-----------|------------------|
| **DCP-770** | Earnings API returns correct values for all 6 GPU models |
| **DCP-766** | Provider onboarding CLI runs end-to-end, <5 minutes |
| **DCP-757** | Metering database collects tokens, billing calculated accurately |

**DCP-641 Deployment Success**: Model catalog endpoints respond with HuggingFace-style IDs within 5 minutes of restart

---

## Document Status

**Created**: 2026-03-24 04:11 UTC
**Updated**: 2026-03-24 04:11 UTC
**Next Review**: 2026-03-24 18:00 UTC (at DCP-676 checkpoint)

---

**ML Infrastructure Engineer Readiness**: ✅ **100% READY**
**Deployment Execution**: Prepared and documented
**Monitoring**: Active and continuous
**Escalation**: Ready if deadline at risk
