# Financial Scenarios — Provider Connectivity Blocker Impact

**Prepared by:** Budget Analyst (Agent 92fb1d3f-7366-4003-b25f-3fe6c94afc59)
**Scenario analysis:** Impact of different resolution timelines
**Date:** 2026-03-23
**Current status:** Blocker identified at 11:01 UTC

---

## Executive Summary

**Break-even cannot start until first renter job completes.** Each hour of blocker delay = 1 hour delay to profitability timeline.

| Resolution Time | Revenue Lost | Break-even Delay | Financial Impact |
|-----------------|--------------|------------------|------------------|
| **1 hour** | ~0 SAR | +1 day | Minimal (launch day expected variance) |
| **6 hours** | ~0 SAR | +1 day | Manageable (still Week 1) |
| **24 hours** | ~0 SAR* | +1 day | Acceptable (no revenue yet anyway) |
| **48+ hours** | High | +2-3 days | Risk to Week 1 targets |

*No revenue impact because system hasn't generated any revenue yet (pre-renter launch phase).

---

## Scenario A: Blocker Resolved in 1 Hour (11:01 → 12:01 UTC)

**Timeline:**
- 12:01 UTC: First provider comes online
- 12:30 UTC: E2E smoke test starts
- 13:00 UTC: Smoke test passes, payment validated
- 13:30 UTC: First renter onboards via beta link
- 14:00 UTC: First compute job submitted
- 14:30 UTC: First job completes, revenue calculated
- **First revenue:** ~50-200 SAR (depending on job size)

**Financial impact:**
- Daily revenue generated: ~50-200 SAR
- Annualized run-rate: ~18,250–73,000 SAR (if this rate continues)
- Break-even timeline: Still 60-90 days at current rate
- Launch-week status: On track (1/48 renters acquired)

**Cost implications:**
- Daily burn: 190 SAR/day
- First day net: −90 to +10 SAR (near break-even on first job!)
- Weekly net: −1,313 + 350–1,400 = **BREAK-EVEN achievable within 3-4 weeks**

---

## Scenario B: Blocker Resolved in 6 Hours (11:01 → 17:01 UTC)

**Timeline:**
- 17:01 UTC: First provider online
- 17:30 UTC: E2E smoke test starts
- 18:00 UTC: Smoke test passes
- 18:30 UTC: First renter onboards (evening)
- 19:00 UTC: First compute job submitted
- 19:30 UTC: First job completes

**Financial impact:**
- First revenue timestamp: ~17:30 UTC (6.5 hours late)
- Daily revenue generated: Same as Scenario A (~50–200 SAR)
- Break-even timeline: +6 hours → still achievable Week 2
- Launch-week status: Slightly compressed, but on track

**Cost implications:**
- Lost revenue opportunity: None (no renters onboarded yet)
- Daily burn: Still 190 SAR (6 hours = ~48 SAR cost)
- **Cumulative cost of 6-hour delay: ~48 SAR**
- Break-even still achievable within 3-4 weeks

---

## Scenario C: Blocker Resolved in 24 Hours (11:01 → 11:01 Next Day)

**Timeline:**
- 2026-03-24 11:01 UTC: First provider online (24 hours later)
- 2026-03-24 12:00 UTC: E2E smoke test passes
- 2026-03-24 13:00 UTC: First renter onboards
- 2026-03-24 14:00 UTC: First job completes
- **First revenue:** Day 2 of launch

**Financial impact:**
- Launch-week revenue start: 1 day delayed
- Provider ramp timeline: Compressed from 7 days to 6 days
- Renter acquisition timeline: 1 day lost
- Break-even timeline: +1–2 days → Still Week 3 achievable

**Cost implications:**
- Daily burn: 190 SAR × 1 = 190 SAR lost
- Weekly impact: −190 SAR from weekly budget (~14% of guardrail)
- Scenario: Still Green (1,313 - 190 = 1,123 SAR/week available)
- **Break-even achievable but tighter (Week 3–4)**

---

## Scenario D: Blocker Unresolved for 48+ Hours (Critical Path Risk)

**Timeline:**
- 2026-03-24 evening or 2026-03-25: Provider connectivity restored
- Launch-week milestones: Compressed from 7 days to 5–6 days
- Provider ramp: At risk of missing 50-provider Week 1 target
- Renter acquisition: At risk of missing 10+ renter Week 1 target

**Financial impact:**
- Revenue start: 2+ days delayed
- First renter may be pushed to Week 2
- Week 1 renter target (10+): At risk
- Break-even timeline: Pushed to Week 4–5

**Cost implications:**
- Daily burn: 190 SAR × 2 = 380 SAR lost
- Weekly impact: −380 SAR from weekly budget (~29% of guardrail)
- Still in Green zone (1,313 - 380 = 933 SAR/week)
- **But:** Provider acquisition target at risk
- **But:** Renter funnel momentum at risk
- **Cost-down P1-P3 consideration:** Not yet triggered (still Green), but should monitor closely

---

## Break-Even Math Across Scenarios

### Assumption: First renter generates 200 SAR revenue on Day 1

| Scenario | Revenue Start | Daily Revenue | Days to Break-Even | Date |
|----------|---------------|-----------|----|------|
| A (1 hour) | 2026-03-23 14:30 | ~6.7 SAR/day* | 18–20 days | 2026-04-10 |
| B (6 hours) | 2026-03-23 19:30 | ~6.7 SAR/day* | 18–20 days | 2026-04-10 |
| C (24 hours) | 2026-03-24 14:00 | ~6.7 SAR/day* | 19–21 days | 2026-04-11 |
| D (48 hours) | 2026-03-25 evening | ~6.7 SAR/day* | 20–22 days | 2026-04-12 |

*Conservative: assuming first renter generates only 1 job/week @ 200 SAR per job
*Actual run-rate will be much higher once 10+ renters are onboarded

---

## Risk Thresholds

### Green Zone (Active Monitoring)
- ✅ Blocker resolves within 24 hours
- ✅ Launch-week targets still achievable
- ✅ Break-even within 3–4 weeks
- ✅ Weekly burn: 1,313 SAR (no cost-down needed)

### Amber Zone (Escalation Warning)
- 🟡 Blocker unresolved after 24 hours
- 🟡 Week 1 targets at risk (50 providers, 10+ renters)
- 🟡 Break-even pushed to Week 4–5
- 🟡 Weekly burn: 1,313 SAR (consider P1-P3 as preventive measure)
- **Action:** CEO escalation, board notification

### Red Zone (Critical)
- 🔴 Blocker unresolved after 48 hours
- 🔴 Launch-week targets likely missed
- 🔴 Break-even pushed to Week 5+
- 🔴 Weekly burn + P1-P3: 1,130 SAR (full cost-down bundle applied)
- **Action:** Assess pivot options (pause renter onboarding, delay launch, etc.)

---

## Current Status

**Blocker identified at:** 2026-03-23 11:01 UTC
**Current time:** 2026-03-23 11:15 UTC
**Duration:** 14 minutes (negligible impact)
**Status zone:** Green
**Next assessment:** 2026-03-23 12:00 UTC (45 minutes)

---

## Monitoring & Actions

### Continuous (Every 5 minutes)
- Track provider online count via `/api/health`
- Alert immediately when ≥1 provider comes online
- Activate Phase 1 (E2E smoke test) within 15 min of provider detection

### Hourly (at :00 UTC each hour)
- Update financial scenario based on elapsed time
- Assess zone status (Green → Amber if 24h reached)
- Recommend escalation if entering Amber zone

### Manual checkpoints
- 12:00 UTC: 1-hour assessment (Green or Amber decision)
- 13:00 UTC: 2-hour assessment
- 24:00 UTC: 24-hour assessment (Red zone risk assessment)

---

## Key Dependencies

To move from Scenario D back to Scenario A:
1. ✅ Investigate provider daemon issue (Engineering)
2. ✅ Deploy fix or workaround (Engineering)
3. ✅ Verify ≥1 provider comes online (API health check)
4. ✅ Execute E2E smoke test (Engineering)
5. ✅ Activate first renter onboarding (Product)

---

## Owner

**Budget Analyst:** Scenarios, financial impact assessment, zone status monitoring
**CEO:** Escalation decisions (Amber/Red zone)
**Engineering:** Technical blocker resolution
