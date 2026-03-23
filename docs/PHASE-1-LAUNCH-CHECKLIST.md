# Phase 1 Launch Readiness Checklist

**Date:** 2026-03-23
**Task:** DCP-612 (S26: P2P network deployment)
**Purpose:** Final verification checklist for Phase 1 launch confirmation

---

## Overview

This checklist provides step-by-step verification for each phase of the P2P deployment sequence. All items must be completed and verified before Phase 1 launch confirmation.

---

## Phase 1: VPS Bootstrap Deployment (DevOps)

### Pre-Execution
- [ ] Read `docs/PHASE-1-DEPLOYMENT-SEQUENCE.md` (Phase 1 section)
- [ ] SSH access to VPS 76.13.179.86 confirmed
- [ ] `pm2` command available on VPS
- [ ] Node.js version >= 18.x verified
- [ ] Port 4001 not in use: `lsof -i :4001`

### Execution
- [ ] Repository updated: `cd /home/node/dc1-platform && git pull`
- [ ] Bootstrap file present: `ls -l p2p/bootstrap.js`
- [ ] Bootstrap started: `pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap`
- [ ] PM2 saved: `pm2 save && pm2 startup`
- [ ] Bootstrap status online: `pm2 status | grep dc1-p2p-bootstrap`

### Verification
- [ ] Bootstrap logs show "Listening on": `pm2 logs dc1-p2p-bootstrap | grep -i "listening\|bootstrap"`
- [ ] Peer ID captured from logs: `pm2 logs dc1-p2p-bootstrap | grep "Peer ID"`
- [ ] **CRITICAL:** Peer ID format is `12D3Koo[A-Za-z0-9]{40,}` (libp2p format)

### Completion
- [ ] Peer ID posted as comment to DCP-612
  - Format: "Peer ID: 12D3KooWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  - Include full peer ID string, no abbreviations
- [ ] DevOps confirms: "Phase 1 Complete - peer ID posted"

### Troubleshooting (if needed)
- **Bootstrap won't start:**
  - Check Node.js: `node --version`
  - Check npm install: `cd p2p && npm list`
  - Check port: `lsof -i :4001 && kill -9 <PID>`
  - Retry: `pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap`
  - Reference: `docs/P2P-OPERATOR-CONFIG-GUIDE.md`

---

## Phase 2: Backend Configuration Update (Backend)

### Pre-Execution
- [ ] Phase 1 complete: DevOps posted peer ID to DCP-612
- [ ] Read `docs/PHASE-1-DEPLOYMENT-SEQUENCE.md` (Phase 2 section)
- [ ] Copy peer ID from DCP-612 comment
- [ ] Repository up-to-date: `git pull origin main`

### Execution
- [ ] File identified: `p2p/dc1-node.js`
- [ ] Line 47 located: `grep -n "REPLACE_WITH_BOOTSTRAP_PEER_ID" p2p/dc1-node.js`
- [ ] Placeholder found (line 47)
- [ ] Peer ID injected (replace full placeholder with actual peer ID)
  - Before: `/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID`
  - After: `/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- [ ] No placeholder remaining: `grep "REPLACE_WITH_BOOTSTRAP_PEER_ID" p2p/dc1-node.js` (should return nothing)
- [ ] Syntax check: `node -c p2p/dc1-node.js` (no errors)

### Git Verification
- [ ] Changes staged: `git add p2p/dc1-node.js`
- [ ] Diff reviewed: `git diff --cached p2p/dc1-node.js`
- [ ] Commit message clear: "config(p2p): update bootstrap peer ID for Phase 1 launch"
- [ ] Committed: `git commit -am "config(p2p): update bootstrap peer ID for Phase 1 launch"`
- [ ] Pushed to main: `git push origin main`
- [ ] Remote verified: `git log origin/main -1 --oneline`

### Backend Service Restart
- [ ] Backend service status: `pm2 status | grep dc1-provider-onboarding`
- [ ] Backend restarted: `pm2 restart dc1-provider-onboarding`
- [ ] PM2 saved: `pm2 save`
- [ ] Backend status online: `pm2 status | grep dc1-provider-onboarding`
- [ ] No errors in logs: `pm2 logs dc1-provider-onboarding | tail -50 | grep -i "error\|fail"`

### Verification
- [ ] Config in memory: Restart successful, no startup errors
- [ ] P2P service initialized: `pm2 logs dc1-provider-onboarding | grep -i "p2p\|bootstrap" | tail -5`
- [ ] Database connectivity: `pm2 logs dc1-provider-onboarding | tail -20` (no DB errors)

### Completion
- [ ] Backend confirms: "Phase 2 Complete - configuration updated and service restarted"
- [ ] Post comment to DCP-612 with:
  - Peer ID used
  - Commit hash
  - Restart timestamp
  - Confirmation status

### Troubleshooting (if needed)
- **Backend won't restart:**
  - Check logs: `pm2 logs dc1-provider-onboarding | tail -100`
  - Check syntax: `node -c p2p/dc1-node.js`
  - Manual restart: `pm2 delete dc1-provider-onboarding && pm2 start backend/src/index.js --name dc1-provider-onboarding`
  - Reference: `docs/P2P-OPERATOR-CONFIG-GUIDE.md`

---

## Phase 3: Provider Discovery Activation (Automatic)

### Automatic Process
- [ ] Phase 2 backend restart completed
- [ ] Wait 30 seconds for provider re-announcement cycle
- [ ] Providers automatically discover bootstrap node
- [ ] Provider status updates: pending → online

### Monitoring (during 30-second wait)
- [ ] Backend logs show P2P initialization: `pm2 logs dc1-provider-onboarding | grep -i "p2p\|discovery" | tail -10`
- [ ] No P2P errors: `pm2 logs dc1-provider-onboarding | grep -i "error" | grep -i "p2p"`
- [ ] Provider heartbeats flowing: Monitor database or API

### Expected Outcome
- [ ] Providers have peer IDs: `SELECT COUNT(*) FROM providers WHERE p2p_peer_id IS NOT NULL`
- [ ] Providers showing online: `SELECT COUNT(*) FROM providers WHERE status='online'`
- [ ] No P2P errors in logs

### Completion
- [ ] Phase 3 automatically completes ~30 seconds after Phase 2
- [ ] P2P Engineer monitors and confirms completion

---

## Phase 4: P2P Validation (P2P Engineer)

### Pre-Validation
- [ ] Phase 3 complete (30 seconds after Phase 2 restart)
- [ ] Read `docs/PHASE-4-VALIDATION-PLAN.md`
- [ ] Validation script ready: `ls -l scripts/validate-p2p-setup.sh`

### Automated Validation (Step 1)
- [ ] Run validation: `bash scripts/validate-p2p-setup.sh`
- [ ] Exit code: 0 (success)
- [ ] Output contains: "All critical checks passed! Ready for Phase 1 launch"
- [ ] No test failures reported

### Manual Verification (Step 2)
- [ ] Query 1 - Provider online count: `SELECT COUNT(*) FROM providers WHERE status='online'`
  - Expected: > 0 (at least 1 online)
- [ ] Query 2 - Peer ID coverage: `SELECT COUNT(*) FROM providers WHERE p2p_peer_id IS NOT NULL`
  - Expected: > 0, ideally all providers
- [ ] Query 3 - Heartbeat freshness: Average < 30 seconds
  - Expected: < 30 seconds (ideally 5-20)

### Log Inspection (Step 3)
- [ ] Backend logs clean: `pm2 logs dc1-provider-onboarding | tail -100 | grep -i "error.*p2p"`
  - Expected: No matches
- [ ] Bootstrap logs clean: `ssh root@76.13.179.86 "pm2 logs dc1-p2p-bootstrap" | grep -i "error"`
  - Expected: No P2P/bootstrap errors

### Validation Success Criteria
- [ ] Validation script exit code: 0
- [ ] All 9 test suites pass
- [ ] > 0 providers online
- [ ] Provider heartbeats fresh (< 5 minutes)
- [ ] No P2P errors in logs
- [ ] "Ready for Phase 1 launch" message present

### Reporting
- [ ] Validation report compiled
- [ ] Results posted to DCP-612 comment with:
  - Validation exit code
  - Test suite results
  - Provider counts
  - Heartbeat freshness
  - Overall status: PASS or FAIL
- [ ] If PASS: "Phase 1 Launch Ready - All validations passed"
- [ ] If FAIL: Reference troubleshooting runbook and escalate

### Completion
- [ ] P2P Engineer confirms: "Phase 4 Complete - Phase 1 launch ready"
- [ ] DCP-612 task status update: Ready for Phase 1 launch

---

## Final Phase 1 Launch Confirmation

### All Phases Complete
- [ ] Phase 1 (DevOps): Peer ID posted
- [ ] Phase 2 (Backend): Configuration updated and deployed
- [ ] Phase 3 (System): Provider discovery activated
- [ ] Phase 4 (P2P Engineer): Validation passed

### Launch Decision
- [ ] All 4 phases completed successfully
- [ ] All success criteria met
- [ ] No blockers or critical issues
- [ ] Team confirmation comments posted
- [ ] **PHASE 1 LAUNCH READY**

### Post-Launch
- [ ] Document lessons learned
- [ ] Archive checklist with completion timestamps
- [ ] Begin Phase 1 smoke tests (SP25-006)
- [ ] Monitor provider status for first 24 hours
- [ ] Update DCP-612 with Phase 1 launch confirmation

---

## Failure Recovery

### If Phase 1 Fails
1. Review error message
2. Reference `docs/P2P-TROUBLESHOOTING-RUNBOOK.md` (12 categories)
3. Post issue to DCP-612 with:
   - Error message
   - Reproduction steps
   - Root cause analysis
   - Recommended fix
4. Mark DCP-612 as `blocked`
5. Escalate to DevOps via chain of command

### If Phase 2 Fails
1. Check configuration syntax: `node -c p2p/dc1-node.js`
2. Check git status: `git status`
3. Post error to DCP-612
4. Mark as `blocked`
5. Escalate to Backend

### If Phase 4 Validation Fails
1. Run validation again: `bash scripts/validate-p2p-setup.sh`
2. Check database queries manually
3. Review logs for P2P/bootstrap errors
4. Reference troubleshooting runbook
5. Post detailed error to DCP-612
6. Mark as `blocked` and escalate

---

## Quick Reference

**Phase 1 (DevOps):** 5-10 minutes
```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
pm2 logs dc1-p2p-bootstrap | grep "Peer ID"
```

**Phase 2 (Backend):** 5 minutes
```bash
# Edit p2p/dc1-node.js line 47 (replace peer ID)
git commit -am "config(p2p): update bootstrap peer ID for Phase 1 launch"
git push origin main
pm2 restart dc1-provider-onboarding
```

**Phase 3 (Automatic):** 30 seconds (no action required)

**Phase 4 (P2P Engineer):** 5 minutes
```bash
bash scripts/validate-p2p-setup.sh
# Post results to DCP-612
```

---

## References

- `docs/PHASE-1-DEPLOYMENT-SEQUENCE.md` — Detailed execution procedures
- `docs/PHASE-4-VALIDATION-PLAN.md` — Validation procedures
- `docs/P2P-TROUBLESHOOTING-RUNBOOK.md` — Issue diagnosis (12 categories)
- `docs/P2P-OPERATOR-CONFIG-GUIDE.md` — Configuration reference
- `scripts/validate-p2p-setup.sh` — Automated validation

---

*Created: 2026-03-23 12:10 UTC*
*Task: DCP-612*
*Status: Ready for team execution*
