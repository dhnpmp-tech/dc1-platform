# P2P Provider Activation Monitoring — Phase 1 Launch Dashboard

**Date**: 2026-03-24 07:10 UTC
**Purpose**: Monitor provider activation progress during Phase 1 launch window
**Timeline**: 2026-03-25 00:00 UTC → 2026-03-28 08:00 UTC (72 hours)
**Owner**: P2P Network Engineer (on-call support)

---

## Overview

Phase 1 testing launches with 43 registered providers. This guide provides real-time monitoring procedures to track provider activation progress, identify connectivity issues, and enable rapid troubleshooting.

---

## Key Metrics to Track

### 1. Provider Activation Status
| Metric | Goal | Check Method |
|--------|------|--------------|
| Providers online | ≥10 by T+2h | `SELECT COUNT(*) FROM providers WHERE status='online'` |
| Providers registering | >1 per 10 min | Monitor `/api/providers/register` logs |
| Provider heartbeats | 100% of online | Check DHT heartbeat records |
| Avg. discovery latency | <500ms | Run `scripts/validate-p2p-setup.sh` |

### 2. Provider by Tier Activation
```
Expected activation pattern:

T+0 to T+1h: First 5-10 providers activate (early adopters)
T+1h to T+6h: Gradual activation ramp (1-2 per hour)
T+6h to T+24h: Plateau phase (most activation complete)
T+24h+: Long-tail providers (educational, weekend users)
```

### 3. Geographic Distribution (if available)
- Monitor provider locations from registration data
- Expected: Mix of Saudi (70%), international (30%)
- Alert if: Single region >80% or <20%

---

## Real-Time Monitoring Commands

### Check Provider Online Count
```bash
# Current online providers
sqlite3 backend/data/dc1.db "SELECT COUNT(*) FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes')"

# Providers by status
sqlite3 backend/data/dc1.db "SELECT status, COUNT(*) FROM providers GROUP BY status"

# Last heartbeat timestamps (top 10)
sqlite3 backend/data/dc1.db "SELECT name, status, last_heartbeat FROM providers ORDER BY last_heartbeat DESC LIMIT 10"
```

### Check Provider Registration Rate
```bash
# Registrations in last hour
sqlite3 backend/data/dc1.db "SELECT COUNT(*) FROM providers WHERE registered_at > datetime('now', '-1 hour')"

# Registrations today
sqlite3 backend/data/dc1.db "SELECT COUNT(*) FROM providers WHERE date(registered_at) = date('now')"
```

### Check P2P Network Health
```bash
# Validate P2P setup
bash scripts/p2p-phase1-readiness-check.sh

# Check bootstrap node status (requires VPS SSH)
ssh root@76.13.179.86 "pm2 status | grep dc1-p2p-bootstrap"

# Monitor DHT announcements (if logging enabled)
pm2 logs dc1-p2p-bootstrap | grep -i "announce\|peer\|heartbeat"
```

### Check Provider Discovery Success
```bash
# Endpoint availability
curl -s http://localhost:8083/api/providers/available | jq '.providers | length'

# DNS/routing verification
nslookup api.dcp.sa
curl -s https://api.dcp.sa/api/providers/available | jq '.providers | length'
```

---

## Troubleshooting by Symptom

### Symptom: No providers showing as online
**Diagnosis:**
1. Check if bootstrap is running: `pm2 list | grep bootstrap`
2. Verify peer ID was injected: `grep -v "REPLACE_WITH" p2p/dc1-node.js`
3. Check daemon logs on a provider: `tail -f /var/log/dcp_daemon.log | grep heartbeat`

**Solution:**
- If bootstrap not running: Restart with `pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap`
- If peer ID missing: Execute Phase 2 config update
- If daemon logs show errors: Check provider connectivity runbook

### Symptom: Providers register but don't activate
**Diagnosis:**
1. Check self-test endpoint: `curl -s http://localhost:8083/api/providers/self-test?key=<provider_key>`
2. Check GPU detection: `curl -s -X POST http://localhost:8083/api/providers/<id>/self-test`
3. Monitor provider daemon for errors

**Solution:**
- High GPU requirements: Offer subset of models (Tier B instead of Tier A)
- Network timeouts: Check provider VPN/firewall (see NAT-TRAVERSAL.md)
- Docker issues: Provide fallback provider (for manual activation)

### Symptom: High provider offline rate (>30%)
**Diagnosis:**
1. Check heartbeat timeout: Threshold is 5 minutes in liveness monitor
2. Check for VPS latency spikes: `pm2 logs dcp-vps-health-cron | tail -50`
3. Check database performance: Look for SQLite write lock contention

**Solution:**
- If VPS under load: Scale horizontally (provision second bootstrap node)
- If database slow: Implement connection pooling
- If providers behind NAT: Enable Circuit Relay v2 (Phase 1.5 feature)

---

## Contingency Triggers

### Trigger: <5 providers online after 1 hour
**Action**: Escalate to DevOps/Founder
- Check if Phase 1 bootstrap actually deployed
- Verify network connectivity from VPS to renters
- Consider HTTP fallback (DCP-783)

### Trigger: Provider registration crash
**Action**: Check backend logs
- Look for database errors: `pm2 logs dc1-provider-onboarding | grep -i error`
- Restart backend if needed: `pm2 restart dc1-provider-onboarding`
- Roll back to last stable commit if necessary

### Trigger: >50% provider failures during testing
**Action**: Pause renter job submissions
- Activate HTTP-only provider discovery mode
- Run diagnostics: `bash scripts/validate-p2p-setup.sh`
- Escalate to infrastructure team

---

## Success Criteria for Phase 1

✅ **Go/No-Go Checklist** (for end of Phase 1):

- [ ] ≥10 providers online and discoverable
- [ ] Average provider uptime >95% (uptime_percent field)
- [ ] Provider discovery latency <500ms average
- [ ] <5% job failure rate due to provider unavailability
- [ ] No unresolved provider connectivity issues
- [ ] All provider logs clean (no permission errors)
- [ ] P2P network stable (no bootstrap restarts)

---

## Key Contact/Escalation

| Issue | Owner | Escalation |
|-------|-------|-----------|
| Provider activation | Provider Activation Officer | CEO → Founder |
| P2P network health | P2P Network Engineer | Backend Architect → DevOps |
| Database performance | Backend Architect | DevOps → Infrastructure |
| VPS connectivity | DevOps | Infrastructure → CEO |
| Provider registration | Backend Team | Backend Architect → CEO |

**P2P Network Engineer** is on-call for Phase 1 testing window (2026-03-25 to 2026-03-28).

---

## Related Documentation

- `docs/provider-connectivity-runbook.md` — Provider troubleshooting procedures
- `docs/P2P-TROUBLESHOOTING-RUNBOOK.md` — P2P network diagnostics
- `docs/P2P-STATUS-PHASE-1.md` — Phase 1 readiness summary
- `docs/URGENT-DCP-612-BLOCKER-ESCALATION.md` — Current deployment blocker
- `scripts/p2p-phase1-readiness-check.sh` — Automated validation

---

## Notes for Phase 1 Launch

1. **First 10 minutes**: Monitor bootstrap node for crashes
2. **First hour**: Watch for registration storm (could spike load)
3. **Hours 1-6**: Gradual activation phase - watch for patterns
4. **Hours 6-24**: Long-tail activation - less critical monitoring
5. **Hours 24-72**: Stability phase - daily health checks sufficient

**If anything unexpected occurs, activate contingency mode immediately.**

---

**Created by**: P2P Network Engineer (DCP-612 Session 3)
**Status**: Ready for Phase 1 launch
