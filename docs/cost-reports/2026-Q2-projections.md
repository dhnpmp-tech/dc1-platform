# DCP Platform — Q2 2026 Financial Projections
## Break-Even Analysis & Provider Growth Model

**Date:** 2026-03-20
**Period:** Q2 2026 (April, May, June)
**Prepared by:** Budget Analyst
**Issue:** DCP-290
**Prior report:** `docs/cost-reports/2026-03-march.md` (DCP-264)
**Exchange rate:** 1 USD = 3.75 SAR (fixed peg)

---

## Executive Summary

| Metric | Conservative | Optimistic |
|--------|-------------|-----------|
| Apr OPEX (Haiku transition month) | **8,050 SAR** | **8,050 SAR** |
| May OPEX (full Haiku) | **5,807 SAR** | **5,807 SAR** |
| Jun OPEX (optimized) | **5,563 SAR** | **5,563 SAR** |
| Apr DCP revenue | **270 SAR** | **540 SAR** |
| May DCP revenue | **1,350 SAR** | **5,400 SAR** |
| Jun DCP revenue | **4,050 SAR** | **16,200 SAR** |
| Q2 total OPEX | **~19,420 SAR** | **~19,420 SAR** |
| Q2 total revenue | **~5,670 SAR** | **~22,140 SAR** |
| Break-even reached? | ❌ Q2 ends at 72% coverage | ✅ May/June (surplus in Jun) |

> **Key finding:** DCP-266 (Haiku migration) is the single most important cost action in Q2 — it cuts monthly agent API spend by ~65% (from 6,930 → 2,444 SAR). Under the optimistic provider growth scenario (30 providers, 60% utilization by June), DCP reaches break-even in May and runs a ~10,637 SAR surplus in June.

---

## 1. Monthly OPEX (April / May / June)

### 1a. Fixed Costs — Unchanged from March

| Service | Monthly SAR | Monthly USD | Category |
|---------|-------------|-------------|----------|
| Claude AI (Anthropic) | 862 | $229.87 | AI platform |
| Cursor | 779 | $207.73 | Dev IDE |
| Firecrawl | 371 | $98.93 | Web scraping |
| MiniMax | 312 | $83.20 | AI services |
| Proton | 219 | $58.40 | Email / security |
| Ampere GPU | 152 | $40.53 | GPU compute |
| Supabase | 94 | $25.07 | DB / realtime |
| Supermemory | 71 | $18.93 | Memory / storage |
| ElevenLabs | 47 | $12.53 | Voice AI |
| Recraft | 47 | $12.53 | Design AI |
| Vercel | 0 | $0 | Frontend (free tier) |
| GitHub | 0 | $0 | Source control (free tier) |
| **SaaS subtotal** | **2,956** | **$787.73** | |
| Hostinger VPS (srv1328172) | 382 | $101.87 | Partner-subsidized; DCP inherits at Phase B |
| Domain — dcp.sa | ~25 | ~$6.67 | SaudiNIC ~300 SAR/yr ÷ 12 |
| **Total fixed** | **~3,363** | **~$896.27** | |

### 1b. Agent API Costs — Opus vs. Post-DCP-266 Haiku

DCP-266 migrates 9 of 15 support-tier agents from Opus to Claude Haiku 4.5 and switches to event-triggered heartbeats (from scheduled polling). Based on March actuals:

| Scenario | Daily burn (SAR) | Monthly (30-day, SAR) | vs. Opus baseline |
|----------|-----------------|----------------------|-------------------|
| **Current Opus (all agents)** | 231 | **6,930** | baseline |
| **Post-DCP-266 (Haiku + event-triggered)** | ~81 | **~2,444** | −65% (−4,486 SAR/mo) |

**Per-agent breakdown — Opus vs. Haiku monthly projection:**

| Agent | Model (current) | Full Opus/mo (SAR) | Model (DCP-266) | Haiku/mo (SAR) | Savings (SAR) |
|-------|----------------|-------------------|-----------------|----------------|---------------|
| CEO | Opus | 1,132 | Opus (unchanged) | 1,132 | 0 |
| Backend Architect | Opus | 1,110 | Sonnet | 390 | 720 |
| DevOps Automator | Opus | 1,108 | Haiku | 198 | 910 |
| Code Reviewer 1 | Opus | 750 | Sonnet | 265 | 485 |
| Code Reviewer 2 | Opus | 600 | Haiku | 108 | 492 |
| Frontend Developer | Opus | 844 | Haiku | 152 | 692 |
| Security Engineer | Opus | 614 | Sonnet | 216 | 398 |
| QA Engineer | Opus | 532 | Haiku | 96 | 436 |
| Founding Engineer | Opus | 454 | Haiku | 82 | 372 |
| Budget Analyst | Opus | 272 | Haiku | 49 | 223 |
| DevRel Engineer | Opus | 188 | Haiku | 34 | 154 |
| ML Infra Engineer | Opus | 118 | Haiku | 21 | 97 |
| IDE Extension Dev | Opus | 84 | Haiku | 15 | 69 |
| P2P Network Eng | Opus | 56 | Haiku | 10 | 46 |
| Blockchain Engineer | Opus | 24 | Haiku | 4 | 20 |
| **TOTAL** | | **6,930** | | **~2,444** | **~4,486** |

_Haiku estimates: Haiku 4.5 input $0.80/M tokens, output $4.00/M tokens vs. Opus 4.6 input ~$15/M, output ~$75/M; ~18× cheaper per token. Event-triggered cadence reduces heartbeat frequency by ~55% for low-activity agents. Net result modeled at ~65% cost reduction for migrated agents._

### 1c. Monthly OPEX Totals by Quarter

DCP-266 is scheduled for deployment in April (all 7 batches per Q2 milestone). Modeled as mid-month transition in April, full effect from May:

| Month | Fixed (SAR) | Agent API (SAR) | Notes | **Total OPEX (SAR)** |
|-------|-------------|-----------------|-------|----------------------|
| **April** | 3,363 | 4,687 | Opus first half (3,465) + Haiku second half (1,222) | **8,050** |
| **May** | 3,363 | 2,444 | Full Haiku post-DCP-266 | **5,807** |
| **June** | 3,363 | 2,200 | Haiku + event-triggered full optimization | **5,563** |
| **Q2 Total** | **10,089** | **~9,331** | | **~19,420** |

**DCP-266 cumulative savings vs. full Opus in Q2:**

| Period | Opus OPEX (SAR) | Haiku OPEX (SAR) | Savings (SAR) |
|--------|----------------|-----------------|---------------|
| April (half-month saving) | 10,293 | 8,050 | 2,243 |
| May | 10,293 | 5,807 | 4,486 |
| June | 10,293 | 5,563 | 4,730 |
| **Q2 Total** | **30,879** | **19,420** | **11,459** |

---

## 2. Revenue Model

### 2a. Assumptions

| Parameter | Value | Source |
|-----------|-------|--------|
| Avg GPU rate | 500 halala/hr = **5 SAR/hr** | RTX 3060 Ti baseline (seed data) |
| DCP platform fee | **25%** of gross billings | Platform contract |
| DCP revenue per GPU-hour | **1.25 SAR/GPU-hr** | 5 SAR × 25% |
| Hours per month | **720** | 30 days × 24 hrs |
| Payment gateway live | **April (DCP-84)** | Q2 Milestone 1 |

### 2b. Provider Count & Utilization Ramp

| Month | Conservative (providers) | Conservative (util %) | Optimistic (providers) | Optimistic (util %) |
|-------|--------------------------|----------------------|------------------------|---------------------|
| April | 1 | 30% | 1 | 60% |
| May | 5 | 30% | 10 | 60% |
| June | 15 | 30% | 30 | 60% |

### 2c. Revenue Projections

**Conservative scenario (1 → 5 → 15 providers, 30% utilization):**

| Month | Providers | GPU-hrs/provider/mo | Total GPU-hrs | Gross billings (SAR) | DCP revenue (SAR) | Provider earnings (SAR) |
|-------|-----------|--------------------|--------------|-----------------------|-------------------|-------------------------|
| April | 1 | 216 | 216 | 1,080 | **270** | 810 |
| May | 5 | 216 | 1,080 | 5,400 | **1,350** | 4,050 |
| June | 15 | 216 | 3,240 | 16,200 | **4,050** | 12,150 |
| **Q2 Total** | — | — | **4,536** | **22,680** | **~5,670** | **17,010** |

_GPU-hrs/provider/mo = 720 hrs × 30% utilization = 216 hrs_

**Optimistic scenario (1 → 10 → 30 providers, 60% utilization):**

| Month | Providers | GPU-hrs/provider/mo | Total GPU-hrs | Gross billings (SAR) | DCP revenue (SAR) | Provider earnings (SAR) |
|-------|-----------|--------------------|--------------|-----------------------|-------------------|-------------------------|
| April | 1 | 432 | 432 | 2,160 | **540** | 1,620 |
| May | 10 | 432 | 4,320 | 21,600 | **5,400** | 16,200 |
| June | 30 | 432 | 12,960 | 64,800 | **16,200** | 48,600 |
| **Q2 Total** | — | — | **17,712** | **88,560** | **~22,140** | **66,420** |

_GPU-hrs/provider/mo = 720 hrs × 60% utilization = 432 hrs_

---

## 3. Break-Even Analysis

### 3a. GPU-Hours Required to Cover OPEX

At **1.25 SAR DCP revenue per GPU-hour** (500 halala/hr × 25% fee):

| OPEX Target | GPU-hrs/mo needed | Providers @ 30% util | Providers @ 60% util |
|-------------|------------------|--------------------|---------------------|
| Fixed SaaS floor only (2,956 SAR) | 2,365 | **11 providers** | **6 providers** |
| Optimized monthly (5,807 SAR — May/Jun) | 4,646 | **22 providers** | **11 providers** |
| April OPEX (8,050 SAR) | 6,440 | **30 providers** | **15 providers** |
| Opus sprint pace (10,293 SAR) | 8,234 | **38 providers** | **19 providers** |

### 3b. Scenario: Opus Agents (OPEX = 10,293 SAR/mo)

Break-even requires: **8,234 GPU-hours/month**

| Provider count | 30% util GPU-hrs | 60% util GPU-hrs | Covers Opus OPEX? |
|---------------|------------------|------------------|--------------------|
| 5 providers | 1,080 | 2,160 | ❌ 10% / 21% |
| 10 providers | 2,160 | 4,320 | ❌ 26% / 52% |
| 20 providers | 4,320 | 8,640 | ❌ 52% / ✅ 105% |
| 30 providers | 6,480 | 12,960 | ❌ 79% / ✅ 157% |

**With Opus agents, break-even requires ~20 providers at 60% utilization** — not achievable in Q2.

### 3c. Scenario: Haiku Agents post-DCP-266 (OPEX = 5,807 SAR/mo — May/Jun)

Break-even requires: **4,646 GPU-hours/month**

| Provider count | 30% util GPU-hrs | 60% util GPU-hrs | Covers Haiku OPEX? |
|---------------|------------------|------------------|---------------------|
| 5 providers | 1,080 | 2,160 | ❌ 23% / 47% |
| 10 providers | 2,160 | 4,320 | ❌ 46% / **93%** |
| 11 providers | 2,376 | 4,752 | ❌ 51% / **✅ 102%** |
| 15 providers | 3,240 | 6,480 | ❌ 70% / **✅ 140%** |
| 22 providers | 4,752 | 9,504 | **✅ 102%** / ✅ 205% |

**With Haiku agents:**
- Break-even at 30% utilization: **22 providers** (achievable Q3 2026)
- Break-even at 60% utilization: **11 providers** (achievable Q2 June under optimistic ramp)

### 3d. Monthly P&L — Conservative vs. Optimistic

**Conservative (1 → 5 → 15 providers, 30% util, Haiku OPEX):**

| Month | OPEX (SAR) | Revenue (SAR) | Net (SAR) | Coverage % |
|-------|-----------|--------------|-----------|-----------|
| April | 8,050 | 270 | −7,780 | 3% |
| May | 5,807 | 1,350 | −4,457 | 23% |
| June | 5,563 | 4,050 | −1,513 | 73% |
| **Q2 Total** | **19,420** | **5,670** | **−13,750** | **29%** |

**Optimistic (1 → 10 → 30 providers, 60% util, Haiku OPEX):**

| Month | OPEX (SAR) | Revenue (SAR) | Net (SAR) | Coverage % |
|-------|-----------|--------------|-----------|-----------|
| April | 8,050 | 540 | −7,510 | 7% |
| May | 5,807 | 5,400 | −407 | 93% |
| June | 5,563 | 16,200 | +10,637 | 291% |
| **Q2 Total** | **19,420** | **22,140** | **+2,720** | **114%** |

> **Break-even verdict:** Under Haiku agents, Q2 break-even is achievable **only in the optimistic scenario** (June, 30 providers @ 60% util). Conservative scenario ends Q2 at 73% coverage and is projected to reach break-even in **Q3 (September 2026)** assuming continued provider growth to ~22 GPUs.

---

## 4. Q2 Milestones & Financial Impact

| # | Month | Milestone | Financial Impact |
|---|-------|-----------|-----------------|
| 1 | April | Deploy all 7 DCP-266 batches (Haiku migration) | −4,486 SAR/mo agent API from May onwards |
| 2 | April | DCP-84: Live payment gateway (Stripe/Tap) | Revenue collection begins; 0 SAR → positive |
| 3 | April | 1 active provider, first paying renter | **+270 SAR DCP revenue** |
| 4 | May | 5 active providers (conservative) / 10 (optimistic) | **+1,350 / +5,400 SAR DCP revenue** |
| 5 | May | First 100 jobs completed | Validates job execution pipeline; unlock marketing |
| 6 | June | 15 providers (cons.) / 30 providers (opt.) | **+4,050 / +16,200 SAR DCP revenue** |
| 7 | June | SDK downloads > 100 | Ecosystem growth; renter acquisition signal |
| 8 | June | VS Code extension 50 installs | Developer adoption; renter pipeline |

**Critical path:** DCP-84 (live payments) gates all Q2 revenue. Without it, April and May revenue remains 0 SAR regardless of provider count.

---

## 5. Cost Risk Flags

### 5a. Budget Pause Triggers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Daily agent API burn | > 400 SAR/day for 3 consecutive days | CEO auto-pauses non-critical agents |
| MTD agent spend | > 80% of monthly ceiling before day 20 | CEO reviews; pause Blockchain, P2P, ML Infra |
| Any single agent | > 200% of monthly budget target | Suspend agent; CEO creates audit issue |
| Q2 revenue shortfall | < 10% of OPEX coverage by May 15 | Delay DCP-84-dependent spend; activate Option 3 (suspend 4 non-critical agents) |
| VPS bill inherited | Phase B close occurs | Add 382 SAR/mo to formal DCP OPEX; adjust ceiling |

### 5b. Recommended Agent Budget Floor (Post-DCP-266 Haiku Rates)

Minimum monthly spend that must be preserved to keep the platform operational:

| Agent | Role | Monthly floor (SAR) | Reason |
|-------|------|--------------------|---------|
| CEO | Orchestration | 200 | Cannot pause; all coordination flows through CEO |
| Backend Architect | Core API | 100 | Job execution, provider routes |
| Security Engineer | Hardening | 75 | Rate limiting, HMAC, auth |
| Frontend Developer | UI | 75 | Renter/provider dashboards |
| DevOps Automator | Deploy | 75 | PM2, Docker, VPS ops |
| Code Reviewer 1/2 | QA | 50 each | Minimum 1 review cycle per sprint |
| All others | Support | 25 each | Event-triggered only; may pause between sprints |
| **Total floor** | | **~725 SAR/mo** | Haiku rates; minimum viable platform |

### 5c. Risk Summary

| Risk | Probability | Financial Impact | Mitigation |
|------|-------------|-----------------|------------|
| DCP-84 delayed past April | High | −Q2 revenue = 0 SAR; extend burn | Treat DCP-84 as P0; no new feature work until live |
| Provider acquisition stalls at 1–2 GPUs | Medium | Conservative scenario only; Q2 loss ~13,750 SAR | Activate DevRel / referral program for providers |
| VPS Phase B inheritance (382 SAR/mo) | Certain | +382 SAR/mo to DCP books | Budget for it; already in projections |
| Agent API exceeds ceiling | Medium | +2,000–4,000 SAR/mo | DCP-266 is the primary mitigation |
| Haiku quality regression on complex tasks | Low | Revert 2–3 agents to Sonnet (+~400 SAR/mo) | Monitor task failure rate during DCP-266 rollout |

---

## Appendix — Key Rates Reference

| Item | Rate | Unit |
|------|------|------|
| GPU rental (RTX 3060 Ti baseline) | 500 halala = 5.00 SAR | per GPU-hour |
| DCP platform fee | 25% | of gross billings |
| DCP revenue per GPU-hour | 1.25 SAR | net |
| Claude Opus 4.6 | ~$15/$75 per M tokens (in/out) | ~56.25/281.25 SAR |
| Claude Haiku 4.5 | ~$0.80/$4.00 per M tokens (in/out) | ~3.00/15.00 SAR |
| Haiku cost ratio vs. Opus | ~18× cheaper per token | — |
| USD/SAR | 3.75 (fixed peg) | — |

---

_Report prepared by: Budget Analyst (DCP-290)_
_Exchange rate: 1 USD = 3.75 SAR (fixed USD/SAR peg)_
_All figures in SAR unless noted. Provider count projections are estimates; actual results depend on DCP-84 live payment launch and provider acquisition activity._
