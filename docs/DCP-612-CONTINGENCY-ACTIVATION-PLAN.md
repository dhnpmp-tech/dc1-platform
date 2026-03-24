# DCP-612 Contingency Activation Plan — Phase 1 Without P2P Bootstrap

**Trigger**: Phase 1 bootstrap NOT deployed by 2026-03-24 18:00 UTC (T-6h decision point)
**Status**: Ready to activate
**Owner**: P2P Network Engineer (with CEO approval)

---

## Decision Point: T-6h (18:00 UTC on 2026-03-24)

If Phase 1 bootstrap deployment has **NOT** been executed by 18:00 UTC, activate this contingency plan.

---

## What Activates This Contingency

- ❌ Phase 1 bootstrap NOT running
- ❌ Peer ID NOT injected in p2p/dc1-node.js
- ❌ PM2 shows no `dc1-p2p-bootstrap` process
- ✅ Founder confirms cannot execute Phase 1 or delays decision
- ✅ Phase 1 testing deadline (00:00 UTC) is within 6 hours

---

## Contingency Option A: Launch with HTTP-Only Discovery (RECOMMENDED)

**Goal**: Proceed with Phase 1 testing using HTTP-only provider discovery (DCP-783)

### What This Means
- ✅ Phase 1 testing launches on schedule (2026-03-25 00:00 UTC)
- ✅ Providers still register and activate via HTTP API
- ✅ Renters discover providers via HTTP endpoint (`/api/providers/available`)
- ❌ P2P DHT discovery NOT available
- ❌ Model-aware routing NOT available (simplified provider list)

### Who Can Activate This
- CEO or Founder (decision authority)
- P2P Network Engineer (implementation)
- No other approvals needed

### Steps to Activate

1. **Create a decision comment on DCP-612:**
   ```
   CONTINGENCY ACTIVATED: HTTP-Only Provider Discovery

   Reason: Phase 1 bootstrap deployment cannot proceed
   Timeline: Phase 1 testing launches 2026-03-25 00:00 UTC with HTTP fallback
   Impact: Providers will use HTTP API; P2P DHT disabled for Phase 1
   Recovery: Can re-enable P2P after Phase 1 testing once bootstrap is deployed

   Status: PROCEED with Phase 1 — HTTP-only mode
   ```

2. **P2P Network Engineer**: No code changes needed — HTTP fallback (DCP-783) already deployed and active

3. **Backend Team**: Verify `/api/providers/available` endpoint responding

4. **Proceed with Phase 1** at 2026-03-25 00:00 UTC using HTTP-only provider discovery

### Success Criteria for Contingency
- ✅ Phase 1 testing launches on schedule
- ✅ 43 registered providers can register via HTTP
- ✅ Renters can discover providers via HTTP endpoint
- ✅ ≥10 providers activate within first 6 hours
- ✅ Job submission and execution work end-to-end

### Limitations Under Contingency
- ❌ No model-aware provider matching
- ❌ Renters see flat provider list
- ❌ No DHT-based discovery
- ❌ Higher provider discovery latency (polling-based, not real-time)

### Recovery Path
Once Phase 1 testing completes (or during Phase 1):
1. Deploy Phase 1 bootstrap when founder has VPS access
2. Inject peer ID in p2p/dc1-node.js
3. Restart backend service (activates P2P mode)
4. P2P network will be live for Phase 2+ testing

---

## Contingency Option B: Delay Phase 1 Testing

**Goal**: Defer Phase 1 testing until Phase 1 bootstrap is deployed

### Timeline Impact
- Phase 1 bootstrap deployed: TBD
- Phase 1 testing rescheduled: TBD (typically 24+ hours later)
- QA/testing window compressed: Risk of incomplete testing

### Who Can Activate This
- CEO or Founder (decision authority)

### Steps
1. **Post decision to DCP-612**: "Phase 1 testing delayed pending bootstrap deployment"
2. **Notify all teams**: QA, Backend, Provider Activation, Marketing
3. **Reschedule Phase 1** once bootstrap is deployed
4. **Re-execute Phase 1 readiness checks** before new launch date

### Limitations
- ❌ 72-hour testing window lost
- ❌ Delays provider activation campaign
- ❌ Marketing/outreach already scheduled
- ❌ 43 providers waiting to activate (morale risk)
- ✅ Guarantees P2P network is operational for testing

---

## Contingency Option C: Partial Hybrid Mode

**Goal**: Launch Phase 1 with HTTP, add P2P later during testing window

### Timeline
1. **Phase 1 launch** (T+0): HTTP-only mode
2. **During Phase 1** (T+12h to T+24h): Deploy Phase 1 bootstrap if founder available
3. **Mid-Phase 1 switch** (T+24h): Transition from HTTP to P2P

### Pros
- ✅ Phase 1 launches on schedule
- ✅ P2P available for Phase 1 tail-end testing
- ✅ Collect HTTP-mode baseline metrics

### Cons
- ⚠️ Switching mid-test (complicates results)
- ⚠️ Providers may not discover P2P mode switch
- ⚠️ Testing interrupted during transition

### Recommendation
**Use only if founder confirms bootstrap can be deployed within 24 hours**

---

## Recommendation: Option A (HTTP-Only Launch)

**This is the recommended contingency:**
1. ✅ Phase 1 testing proceeds on schedule
2. ✅ Minimal code changes (none needed)
3. ✅ Providers can still activate
4. ✅ Provides baseline metrics for HTTP-only mode
5. ✅ P2P can be added in Phase 2 or recovery pass

**Activation requires only:**
- CEO/Founder decision
- One comment posted to DCP-612
- Backend verification of HTTP endpoint

---

## Key Dates & Deadlines

| Date/Time | Event | Action |
|-----------|-------|--------|
| 2026-03-24 18:00 UTC | **T-6h decision point** | CEO evaluates Phase 1 bootstrap progress |
| 2026-03-24 22:00 UTC | Final contingency decision | Announce Option A/B/C to teams |
| 2026-03-25 00:00 UTC | **Phase 1 launch** | Proceeds with chosen contingency |
| 2026-03-25 to 2026-03-28 | **72-hour testing** | Execute Phase 1 with selected option |

---

## Documentation & Communication

**If contingency activates:**

1. **Post to DCP-612**: Decision and activation
2. **Notify teams**: Backend, QA, DevOps, Frontend, Provider Activation
3. **Update CLAUDE.md**: Phase 1 status (if needed)
4. **Monitor closely**: Track provider activation and job success rates

**If Phase 1 bootstrap deploys before contingency trigger:**

1. Execute normal Phase 1-4 procedure
2. Archive this contingency plan
3. Proceed with P2P-enabled Phase 1 testing

---

## Recovery Plan (Post-Contingency)

If contingency activates and Phase 1 proceeds with HTTP-only:

### During Phase 1
- Monitor provider activation via HTTP
- Collect baseline metrics
- Plan P2P bootstrap deployment window

### Post-Phase 1
- Deploy Phase 1 bootstrap (when founder available)
- Run Phase 2 with P2P-enabled providers
- Publish comparison: HTTP vs P2P mode

---

## References

- **Primary blocker**: `docs/URGENT-DCP-612-BLOCKER-ESCALATION.md`
- **Critical countdown**: `docs/CRITICAL-DCP-612-17HOUR-COUNTDOWN.md`
- **HTTP fallback**: DCP-783 (already deployed)
- **Phase 1 launch checklist**: `docs/P2P-PHASE1-LAUNCH-DAY-CHECKLIST.md`

---

## Summary

**If Phase 1 bootstrap cannot be deployed by T-6h (18:00 UTC):**

🟢 **Option A (Recommended)**: Launch Phase 1 with HTTP-only discovery
- Proceed on schedule
- P2P network unavailable
- Fallback already deployed and active

🟡 **Option B**: Delay Phase 1 testing
- Risk: Compressed testing window, provider morale
- Benefit: P2P network operational from start

🔴 **Option C**: Hybrid (launch HTTP, add P2P mid-test)
- Only if bootstrap can be deployed within 24 hours

---

**CONTINGENCY STATUS**: Ready to activate
**DECISION AUTHORITY**: Founder / CEO
**DECISION DEADLINE**: 2026-03-24 18:00 UTC (T-6h)

**P2P Network Engineer stands by for activation orders.**

---

**Created**: 2026-03-24 07:20 UTC
**Owner**: P2P Network Engineer (DCP-612)
**Status**: Ready for immediate activation if needed
