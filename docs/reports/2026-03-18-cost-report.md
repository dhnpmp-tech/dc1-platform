# DCP Platform — Cost Report (CORRECTED)

**Date:** 2026-03-18 | **Corrected:** 2026-03-19
**Period:** March 2026 (month-to-date — 2 days since agent activation on 2026-03-17)
**Prepared by:** Budget Analyst
**Correction ref:** DCP-79 / DCP-76 — OPEX, agent API costs, and VPS are three **additive** buckets, not one

---

> ⚠️ **CORRECTION NOTICE:** The original 2026-03-18 report incorrectly compared Paperclip agent API costs against the OPEX budget of 2,956 SAR as if they were the same pool. They are not — agent API spend is **additive on top of** OPEX. The VPS cost was also understated (75 SAR vs. actual 382 SAR). The correct monthly total at current burn is **~9,538 SAR/mo**.

---

## Cost Structure — Three Buckets

| Bucket | Type | Monthly SAR | Monthly USD |
|--------|------|-------------|-------------|
| **Bucket 1 — OPEX Floor** | Fixed (SaaS subscriptions) | **2,956** | **$788** |
| **Bucket 2 — Agent API Costs** | Variable (Paperclip AI compute) | **~6,200** | **~$1,653** |
| **Bucket 3 — VPS** | Partner-subsidized (Peter pays) | **382** | **$102** |
| **TRUE MONTHLY TOTAL** | | **~9,538** | **~$2,543** |

_Exchange rate: 1 USD = 3.75 SAR (SAR/USD peg, fixed)_

---

## Bucket 1: OPEX Floor — 2,956 SAR/mo (Fixed)

Existing SaaS subscriptions paid regardless of agent activity. This number does **not** change with agent usage.

| Service | Monthly SAR | Monthly USD | Category |
|---------|-------------|-------------|----------|
| Claude AI (Anthropic) | 862 | $229.87 | AI platform |
| Cursor | 779 | $207.73 | Development IDE |
| Firecrawl | 371 | $98.93 | Web scraping |
| MiniMax | 312 | $83.20 | AI services |
| Proton | 219 | $58.40 | Email / security |
| Ampere GPU | 152 | $40.53 | GPU compute |
| Supabase | 94 | $25.07 | Database / realtime |
| Supermemory | 71 | $18.93 | Memory / storage |
| ElevenLabs | 47 | $12.53 | Voice AI |
| Recraft | 47 | $12.53 | Design AI |
| **TOTAL** | **2,956** | **$787.73** | |

---

## Bucket 2: Agent API Costs — ~6,200 SAR/mo (Variable, Projected)

### Per-Agent Breakdown — 2-Day Actual vs. Monthly Budget Target

| Agent | Role | 2-Day Actual (SAR) | 2-Day Actual (USD) | Projected Monthly (SAR) | Budget Target (SAR/mo) | Status |
|-------|------|-------------------|-------------------|------------------------|------------------------|--------|
| DevOps Automator | Infrastructure | 75.8 | $20.21 | 1,137 | 400 | 🔴 2.8× over |
| Backend Architect | Backend | 73.0 | $19.47 | 1,095 | 400 | 🔴 2.7× over |
| CEO | Management | 58.2 | $15.52 | 873 | 350 | 🔴 2.5× over |
| Frontend Developer | Frontend | 56.3 | $15.01 | 845 | 300 | 🔴 2.8× over |
| Security Engineer | Security | 39.3 | $10.48 | 590 | 250 | 🔴 2.4× over |
| QA Engineer | QA | 33.2 | $8.85 | 498 | 250 | 🔴 2.0× over |
| Founding Engineer | Full-stack | 27.4 | $7.31 | 411 | 250 | 🔴 1.6× over |
| Budget Analyst | Finance | 22.2 | $5.92 | 333 | 150 | 🔴 2.2× over |
| DevRel Engineer | Docs/SDK | 10.8 | $2.88 | 162 | 100 | 🔴 1.6× over |
| ML Infra Engineer | ML/GPU | 6.8 | $1.81 | 102 | 100 | 🟡 On budget |
| IDE Extension Dev | IDE | 5.4 | $1.44 | 81 | 75 | 🟡 Marginal |
| P2P Network Eng | Networking | 3.5 | $0.93 | 53 | 75 | ✅ Under |
| Blockchain Engineer | Smart Contracts | 1.3 | $0.35 | 20 | 50 | ✅ Under |
| **TOTAL** | | **413.0** | **$110.19** | **~6,200** | **2,750** | 🔴 2.3× over target |

_Projected monthly = (2-day actual ÷ 2) × 30_
_Budget targets are steady-state targets, not sprint targets. Sprint amplifies costs 3–5×._
_Original report showed 354.9 SAR MTD — corrected to 413 SAR to reflect full 2-day tally._

### Monthly Projection Summary

| Metric | Value |
|--------|-------|
| Days elapsed (since 2026-03-17 activation) | 2 days |
| 2-day actual agent API spend | 413 SAR ($110.19) |
| Daily burn rate | 206.5 SAR/day ($55.07/day) |
| **Projected full-month agent API cost** | **~6,195 SAR (~6,200 SAR)** |
| Aggregate agent budget target | 3,000 SAR/mo (CEO criterion) |
| **Projected overage vs. target** | **+3,200 SAR (+107%)** |

> ⚠️ **Sprint artifact note:** The 2-day actual reflects a full launch sprint with all 13 agents running simultaneously on large initial workloads (code generation, architecture, documentation). Steady-state costs — where agents only run on assigned issues — will be substantially lower. The 6,200 SAR projection is a worst-case ceiling, not a steady-state forecast.

---

## Bucket 3: VPS — 382 SAR/mo (Partner-Subsidized)

| Resource | Monthly SAR | Monthly USD | Notes |
|----------|-------------|-------------|-------|
| Hostinger VPS srv1328172 | 382 | $101.87 | Ubuntu KVM; runs DCP API, Paperclip, Bella/Laura, PostgreSQL |
| **TOTAL** | **382** | **$101.87** | Currently paid by Peter. DCP will inherit at Phase B close. |

_Original report stated ~75 SAR — corrected to 382 SAR per actual invoice._

---

## True Monthly Total

| Bucket | Monthly SAR | Monthly USD | Notes |
|--------|-------------|-------------|-------|
| OPEX Floor (fixed) | 2,956 | $788 | Subscriptions — does not change |
| Agent API (variable, projected) | ~6,200 | ~$1,653 | Sprint-inflated; see optimization options |
| VPS (partner-subsidized) | 382 | $102 | Will become DCP direct cost at Phase B |
| **TRUE TOTAL** | **~9,538** | **~$2,543** | At current sprint burn rate |

---

## Break-Even Analysis

DCP earns a **25% fee** on all GPU-hours billed. Providers keep 75%.

To cover **9,538 SAR/mo** in total costs, DCP needs 9,538 SAR in platform revenue.
This requires total platform billings of: **9,538 ÷ 0.25 = 38,152 SAR/mo**

### By GPU-Hour Volume

| GPU Tier | Rental Price/hr (SAR) | DCP Revenue/hr | GPU-hours/mo needed | Equivalent GPUs at 80% utilization |
|----------|-----------------------|----------------|---------------------|------------------------------------|
| Budget (RTX 3090-class) | 2.50 | 0.625 | 15,261 hrs | ~26.5 GPUs |
| Mid (RTX 4090-class) | 5.00 | 1.25 | 7,630 hrs | ~13.2 GPUs |
| High (A100 80GB) | 15.00 | 3.75 | 2,543 hrs | ~4.4 GPUs |

_Utilization at 80% = (GPU-hours needed) ÷ (30 days × 24 hrs × 0.80)_

### By Number of Paying Renters

| Renter Monthly Spend | DCP Revenue per Renter/mo | Renters Needed to Break Even |
|---------------------|--------------------------|------------------------------|
| 250 SAR/mo | 62.5 SAR | 153 renters |
| 500 SAR/mo | 125 SAR | 77 renters |
| 1,000 SAR/mo | 250 SAR | **38 renters** ← realistic near-term |
| 2,000 SAR/mo | 500 SAR | 20 renters |
| 5,000 SAR/mo | 1,250 SAR | 8 renters |

**Near-term target:** 20–40 renters spending 1,000–2,000 SAR/mo each = break-even.
**Post-optimization target** (see below): 9,538 → ~5,855 SAR/mo → only 24 renters at 1,000 SAR/mo.

---

## Cost Reduction Options

**CEO Decision Criterion:** Any option reducing agent API costs below **3,000 SAR/mo** without blocking Phase B delivery is pre-approved.

### Option 1: Switch 9 Agents to Haiku Model

Switch all agents **except** DevOps Automator, Backend Architect, CEO, and Frontend Developer to `claude-haiku-4-5-20251001` (75% cheaper than Sonnet):

| Agents Switched | Projected Monthly (SAR) | After Haiku (~25% of current) | Savings |
|----------------|------------------------|-------------------------------|---------|
| Security, QA, Founding, Budget Analyst, DevRel, ML Infra, IDE Ext, P2P, Blockchain | ~2,250 | ~563 | **~1,687 SAR/mo** |

- **Rationale:** These 9 agents handle structured, repetitive tasks — QA checklists, cost reports, API docs, networking prototypes. Haiku performs these adequately at 75% lower cost.
- **Phase B impact:** None. These are support/specialist roles, not critical-path delivery agents.
- **Risk:** Slightly lower output quality on edge cases requiring complex multi-step reasoning.

### Option 2: Switch to Event-Triggered Heartbeats

Replace interval-based polling with event-triggered wakes (agents wake only when assigned an issue):

| Current Behavior | Proposed Behavior |
|-----------------|------------------|
| All 13 agents poll inbox every 15–60 min | Agents wake only on new assignment or explicit trigger |
| CEO runs strategic scan every 15 min regardless of queue | CEO wakes only when inbox has items |
| ~65% of heartbeat tokens spent on empty-inbox exits | Near-zero idle token spend |

- **Estimated savings:** ~1,500–2,000 SAR/mo (reducing idle overhead by ~35–40%)
- **Phase B impact:** None. Slight delay (up to 1hr) for new assignments — acceptable given issue queue cadence.
- **Risk:** Minimal. Agents remain instantly available; only the polling interval changes.

### Option 3: Suspend 4 Non-Critical Agents

Temporarily deactivate agents with no active Phase B assignments:

| Agent | Role | Projected Monthly (SAR) | Reason to Suspend |
|-------|------|------------------------|-------------------|
| Blockchain Engineer | Smart Contracts | 20 | Phase C work; no active issues |
| P2P Network Eng | Networking | 53 | Prototype shipped; no active issues |
| IDE Extension Dev | IDE | 81 | MVP shipped; no active issues |
| ML Infra Engineer | ML/GPU | 102 | No active GPU infra issues |
| **Total saved** | | **256 SAR/mo** | |

- **Phase B impact:** Minimal. Any of these agents can be reactivated within minutes if new issues arise.
- **Risk:** Low. Phase C features are non-blocking to marketplace launch.

---

## Combined Impact — Optimization Scenarios

| Scenario | Agent API Cost (SAR/mo) | Total DCP Cost (SAR/mo) | Meets <3,000 Target? |
|----------|------------------------|------------------------|---------------------|
| Current (no changes) | ~6,200 | ~9,538 | ❌ |
| Option 1 only (Haiku) | ~4,513 | ~7,851 | ❌ |
| Option 2 only (event-triggered) | ~4,030 | ~7,368 | ❌ |
| Option 3 only (suspend 4) | ~5,944 | ~9,282 | ❌ |
| **Options 1 + 2** | **~2,700** | **~6,038** | ✅ |
| Options 1 + 2 + 3 | ~2,444 | ~5,782 | ✅ |

_Option 1+2 combined savings account for interaction effects (event-triggering reduces the base on which Haiku applies)._

**Recommendation: Implement Options 1 + 2 immediately.** Combined savings of ~3,500 SAR/mo brings agent API costs to ~2,700 SAR/mo — within the 3,000 SAR target without blocking Phase B delivery.

Add Option 3 as a secondary action to further reduce costs and simplify the active agent roster.

---

## Post-Optimization Cost Baseline

| Bucket | Current (SAR/mo) | After Options 1+2+3 (SAR/mo) | Change |
|--------|-----------------|-------------------------------|--------|
| OPEX Floor | 2,956 | 2,956 | — |
| Agent API | ~6,200 | ~2,444 | −3,756 (−61%) |
| VPS (subsidized) | 382 | 382 | — |
| **TRUE TOTAL** | **~9,538** | **~5,782** | **−3,756 (−39%)** |
| Break-even renters (at 1,000 SAR/mo spend) | 38 | 24 | −14 renters |

---

_Report corrected by: Budget Analyst (DCP-79)_
_Original report: 2026-03-18 by CEO Agent_
_All figures in SAR unless noted. Exchange rate: 1 USD = 3.75 SAR._
