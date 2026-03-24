# P2P Phase 1 Launch Day Checklist — 2026-03-25 00:00 UTC

**P2P Network Engineer responsibilities** during Phase 1 testing launch
**Duration**: 3 days (2026-03-25 00:00 UTC → 2026-03-28 08:00 UTC)
**Status**: Ready (awaiting Phase 1 bootstrap execution)

---

## PRE-LAUNCH (T-24h to T-0: 2026-03-24 to 2026-03-25 00:00 UTC)

### T-2 hours (2026-03-24 22:00 UTC)
- [ ] Verify Phase 1 bootstrap is running: `pm2 status | grep dc1-p2p-bootstrap`
- [ ] Confirm peer ID was injected: `grep -v "REPLACE_WITH" p2p/dc1-node.js | grep 12D3Koo`
- [ ] Backend service is online: `pm2 status | grep dc1-provider-onboarding`
- [ ] Run readiness check: `bash scripts/p2p-phase1-readiness-check.sh`
- [ ] All checks PASS before proceeding

### T-30 minutes (2026-03-24 23:30 UTC)
- [ ] Review monitoring dashboard: `docs/P2P-PROVIDER-ACTIVATION-MONITORING.md`
- [ ] Verify DB is accessible: `sqlite3 backend/data/dc1.db "SELECT COUNT(*) FROM providers"`
- [ ] Check VPS health: `ssh root@76.13.179.86 "pm2 status"`
- [ ] Test provider endpoint: `curl https://api.dcp.sa/api/providers/available | head -20`
- [ ] Confirm on-call setup is ready (notifications, escalation path)

### T-15 minutes (2026-03-24 23:45 UTC)
- [ ] Execute Phase 4 validation: `bash scripts/validate-p2p-setup.sh`
- [ ] Document validation results
- [ ] Post "GO" or "NO-GO" status to DCP-612
- [ ] **If NO-GO detected**: Escalate immediately, execute contingency plan

---

## LAUNCH DAY (T+0: 2026-03-25 00:00 UTC)

### T+0 to T+30m (Phase 1 testing begins)
- [ ] Monitor provider registration rate: `SELECT COUNT(*) FROM providers WHERE registered_at > datetime('now', '-1 hour')`
- [ ] Check first provider heartbeats: `SELECT COUNT(*) FROM providers WHERE status='online'`
- [ ] Watch for errors in backend logs: `pm2 logs dc1-provider-onboarding | tail -50`
- [ ] Verify bootstrap node stability: `pm2 logs dc1-p2p-bootstrap | tail -50`
- [ ] Note baseline metrics (timestamp: T+0)

### T+30m to T+1h (Critical first activation window)
- [ ] Target: ≥1 provider online by now
- [ ] If <1 provider: Check logs for blockage
  - Provider daemon issues? → See provider-connectivity-runbook.md
  - P2P network issue? → See P2P-TROUBLESHOOTING-RUNBOOK.md
  - Database issue? → Check db.js schema and connection pool
- [ ] Monitor provider dashboard for errors
- [ ] Ready to escalate if activation blocked

### T+1h to T+2h (Activation ramp)
- [ ] Target: ≥5 providers online
- [ ] Track activation trend (should be 5+ per hour)
- [ ] Monitor for common issues:
  - Providers stuck in "pending"? → Check self-test endpoint
  - High offline rate? → Check liveness monitor (5-min threshold)
  - Network errors? → Check VPS connectivity/load
- [ ] Log observations for post-Phase-1 analysis

### T+2h to T+6h (Growth phase)
- [ ] Target: ≥10 providers online
- [ ] Expected pattern: 1-2 new providers per 10 minutes
- [ ] Watch for drop-offs (indicates blockers)
- [ ] Check database performance: `SELECT COUNT(*) FROM heartbeat_log WHERE created_at > datetime('now', '-1 hour')`
- [ ] Verify no bootstrap crashes: `pm2 logs dc1-p2p-bootstrap | grep -i restart`

### T+6h to T+24h (Plateau phase)
- [ ] Continue monitoring activation (should slow to <1 per hour)
- [ ] Watch for long-tail activation patterns
- [ ] Monitor provider uptime and job success rates
- [ ] Generate 6-hour and 12-hour status reports
- [ ] Document any issues for Phase 2 improvements

---

## PHASE 1 TESTING WINDOW (T+24h to T+72h)

### Daily Checklist (Each Morning)
- [ ] Provider online count check
- [ ] Check for any overnight crashes or restarts
- [ ] Review error logs for patterns
- [ ] Generate status report
- [ ] Escalate any critical issues

### Provider Activation Tracking
- [ ] Maintain live count of online providers
- [ ] Track activation by tier (A, B, C)
- [ ] Monitor geographic distribution (if available)
- [ ] Document activation velocity

### P2P Network Health
- [ ] Bootstrap node uptime: Target 99.9%
- [ ] Average provider heartbeat latency: <100ms
- [ ] DHT discovery success rate: >95%
- [ ] Provider discovery latency: <500ms

### Emergency Procedures
**If P2P network down:**
1. Check bootstrap: `pm2 status dc1-p2p-bootstrap`
2. Check logs: `pm2 logs dc1-p2p-bootstrap`
3. Restart if needed: `pm2 restart dc1-p2p-bootstrap`
4. If restart fails: Escalate to DevOps/Founder immediately

**If providers can't activate:**
1. Check heartbeat endpoint: `curl http://localhost:8083/api/providers/heartbeat`
2. Check database: `sqlite3 backend/data/dc1.db "SELECT COUNT(*) FROM providers"`
3. Check logs for permission errors
4. If backend down: Escalate to Backend Architect

**If >30% providers offline:**
1. Check liveness monitor (5-min threshold)
2. Check VPS load and network
3. Consider enabling HTTP fallback (DCP-783)
4. Escalate if infrastructure issue

---

## END OF PHASE 1 (T+72h: 2026-03-28 08:00 UTC)

### Final Checklist
- [ ] Collect final provider count and uptime statistics
- [ ] Document any issues that arose and resolutions
- [ ] Archive logs for analysis
- [ ] Create Phase 1 post-mortem report
- [ ] Prepare recommendations for Phase 2

### Success Criteria (Go/No-Go)
- [ ] ≥10 providers online and stable
- [ ] >95% provider uptime
- [ ] <5% job failure due to provider
- [ ] No unresolved P2P network issues
- [ ] All monitoring systems working

**Phase 1 GO/NO-GO decision**: Post to DCP-612 by T+72h

---

## Reference Materials

| Document | Purpose |
|----------|---------|
| `docs/P2P-PROVIDER-ACTIVATION-MONITORING.md` | Real-time monitoring procedures |
| `scripts/p2p-phase1-readiness-check.sh` | Automated validation |
| `scripts/validate-p2p-setup.sh` | Full P2P infrastructure check |
| `docs/provider-connectivity-runbook.md` | Provider troubleshooting |
| `docs/P2P-TROUBLESHOOTING-RUNBOOK.md` | P2P network diagnostics |
| `docs/URGENT-DCP-612-BLOCKER-ESCALATION.md` | Bootstrap deployment blocker |

---

## Escalation Chain

**Priority**: Issue Type → Owner → Next Level

- **Critical**: P2P Network Engineer → DevOps → Founder
- **High**: P2P Network Engineer → Backend Architect → CEO
- **Medium**: P2P Network Engineer → Provider Activation Officer → Manager

---

## Notes

- Keep this checklist handy during entire Phase 1 window
- Update timestamps as you progress through milestones
- Document deviations from expected milestones
- Prepare to execute contingency procedures if needed
- Post daily status updates to DCP-612 comments

**P2P Network Engineer is on-call during entire Phase 1 testing window.**

---

**Created by**: P2P Network Engineer
**Status**: Ready for Phase 1 launch (2026-03-25 00:00 UTC)
**Last Updated**: 2026-03-24 07:15 UTC
