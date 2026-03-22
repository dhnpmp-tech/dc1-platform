# DCP Platform — Q2 2026 Financial Projections (v2)
## Docker Cost Impact + Haiku Migration Savings Update

**Date:** 2026-03-20
**Period:** Q2 2026 (April, May, June)
**Prepared by:** Budget Analyst
**Issue:** DCP-327
**Prior report:** `docs/cost-reports/2026-Q2-projections.md` (DCP-290, v1)
**Exchange rate:** 1 USD = 3.75 SAR (fixed peg)

> **What changed in v2:** (1) Agent model tier corrected from "Opus" to **Sonnet 4.6** to reflect actual runtime (`claude-sonnet-4-6`). (2) Docker P0 sprint infrastructure cost impact added. (3) Break-even recalculated against current burn rate and revised GPU pricing model. Per-agent Haiku projections updated to reflect Sonnet→Haiku savings ratio.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Current model tier (non-Haiku agents) | **Sonnet 4.6** (corrected from v1 "Opus" label) |
| March 2026 projected total (15 active days) | **6,810 SAR** |
| Gap vs 2,956 SAR SaaS ceiling | **3,854 SAR overage** |
| Docker P0 new OPEX impact | **~200 SAR/mo** (model-cache storage only) |
| DCP-266 Haiku migration savings | **4,486 SAR/mo** |
| Post-Haiku agent API burn | **~2,324 SAR/mo** |
| Post-Haiku total monthly OPEX | **~5,687 SAR/mo** |
| Break-even GPU count (SaaS ceiling) | **~7 active GPUs** |
| 30-provider June target DCP revenue | **~12,960 SAR/mo** |

> **Key finding:** DCP-266 remains the single most impactful cost lever in Q2. The Docker P0 sprint added negligible OPEX (model-cache storage only; all tooling is open source). Correcting the model label from Opus to Sonnet 4.6 reduces the theoretical Opus baseline but the measured March burn rate is unchanged — Sonnet-level token costs are already reflected in the 231 SAR/day actuals.

---

## 1. Current State — March 2026

### 1a. Fixed Monthly Costs — Unchanged

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
| **SaaS subtotal** | **2,956** | **$787.73** | SaaS ceiling |
| Hostinger VPS (srv1328172) | 382 | $101.87 | Partner-subsidized until Phase B |
| Domain — dcp.sa | ~25 | ~$6.67 | SaudiNIC ~300 SAR/yr ÷ 12 |
| **Total fixed** | **~3,363** | **~$896.27** | |

### 1b. Agent API Costs — March Actuals (Sonnet 4.6 Baseline)

> **Model correction:** v1 labeled agents as "Opus 4.6." All 15 agents are running on **claude-sonnet-4-6**. The 231 SAR/day measured burn rate reflects Sonnet pricing. Sonnet 4.6 input: ~$3/M tokens; output: ~$15/M tokens (USD). Haiku 4.5 input: ~$0.80/M tokens; output: ~$4.00/M tokens. Sonnet→Haiku token ratio: ~3.75×. With event-triggered heartbeats reducing call volume ~55%, combined DCP-266 saving is ~65% of current agent API spend.

| Agent | Current Model | Sonnet Sprint Rate (SAR/mo) | Post-DCP-266 Model | Post-DCP-266 (SAR/mo) | Savings (SAR/mo) |
|-------|--------------|----------------------------|---------------------|------------------------|------------------|
| CEO | Sonnet 4.6 | 1,132 | Sonnet 4.6 (unchanged) | 510 | 622 |
| Backend Architect | Sonnet 4.6 | 1,110 | Sonnet 4.6 + event-triggered | 500 | 610 |
| DevOps Automator | Sonnet 4.6 | 1,108 | **Haiku 4.5** + event-triggered | 133 | 975 |
| Code Reviewer 1 | Sonnet 4.6 | 750 | **Haiku 4.5** + event-triggered | 90 | 660 |
| Code Reviewer 2 | Sonnet 4.6 | 600 | **Haiku 4.5** + event-triggered | 72 | 528 |
| Frontend Developer | Sonnet 4.6 | 844 | Sonnet 4.6 + event-triggered | 380 | 464 |
| Security Engineer | Sonnet 4.6 | 614 | Sonnet 4.6 + event-triggered | 276 | 338 |
| QA Engineer | Sonnet 4.6 | 532 | **Haiku 4.5** + event-triggered | 64 | 468 |
| Founding Engineer | Sonnet 4.6 | 454 | Sonnet 4.6 + event-triggered | 204 | 250 |
| Budget Analyst | Sonnet 4.6 | 272 | **Haiku 4.5** + event-triggered | 33 | 239 |
| DevRel Engineer | Sonnet 4.6 | 188 | **Haiku 4.5** + event-triggered | 23 | 165 |
| ML Infrastructure Eng | Sonnet 4.6 | 118 | Sonnet 4.6 + event-triggered | 53 | 65 |
| IDE Extension Dev | Sonnet 4.6 | 84 | **Haiku 4.5** + event-triggered | 10 | 74 |
| P2P Network Eng | Sonnet 4.6 | 56 | **Haiku 4.5** + event-triggered | 7 | 49 |
| Blockchain Engineer | Sonnet 4.6 | 24 | **Haiku 4.5** + event-triggered | 3 | 21 |
| **TOTAL** | | **6,930** | | **~2,358** | **~4,572** |

_Sprint rate (SAR/mo) = 3-day actuals ÷ 3 × 30 (from March 2026 actuals). Post-DCP-266: Sonnet agents include event-triggered reduction (~55% fewer heartbeats). Haiku agents: ~3.75× cheaper tokens + 55% fewer heartbeats = ~12% of current Sonnet cost. Totals rounded; ~2,324–2,358 SAR/mo range consistent with DCP-266 estimate of ~2,324 SAR/mo._

### 1c. March 2026 Burn Summary vs. 2,956 SAR Ceiling

| Bucket | Value (SAR) | Notes |
|--------|-------------|-------|
| SaaS OPEX ceiling | 2,956 | Fixed subscriptions |
| VPS + domain | +407 | Infrastructure; VPS partner-subsidized |
| Agent API (15 active days, March 17–31) | +3,447 | 231 SAR/day × 15 days |
| **March projected total** | **6,810** | |
| **Gap vs 2,956 ceiling** | **3,854** | Overage is agent API + infra above SaaS floor |

> The 2,956 SAR ceiling was defined for SaaS subscriptions only. Agent API is **additive** variable spend. The true monthly ceiling question is whether total OPEX can reach break-even via GPU revenue.

---

## 2. Docker Infrastructure — Cost Impact Assessment

The Docker P0 sprint (DCP-309–319) significantly expanded technical capabilities but added **minimal OPEX**:

### 2a. New Infrastructure Components

| Component | Cost Model | Monthly Impact (SAR) | Notes |
|-----------|------------|----------------------|-------|
| Docker Engine + Compose | Open source | **0** | Already on VPS |
| NVIDIA Container Toolkit | Open source | **0** | Already on VPS |
| /opt/dcp/model-cache storage | VPS disk (Hostinger pricing) | **~200** | 2,000 GB @ ~0.10 SAR/GB/mo (10 providers) |
| Per-job container startup | Overhead ~2–3s per job | **Negligible** | <1% job execution overhead |
| Trivy image scanning | Free tier | **0** | 100 scans/day; sufficient for launch |
| Docker Hub image pulls | Free tier | **0** | Public images; rate limits not an issue at beta scale |
| CRIU checkpoint storage | VPS disk | **~20** | Snapshot files ~100MB each; 200 jobs/day est. |
| **Total new Docker OPEX** | | **~220 SAR/mo** | |

### 2b. Model Cache Storage Projection by Provider Count

| Provider Count | Avg Models Cached | Total Storage | Monthly Cost (SAR) |
|---------------|-------------------|---------------|-------------------|
| 5 providers | 200 GB | 1,000 GB | ~100 |
| **10 providers (launch target)** | **200 GB** | **2,000 GB** | **~200** |
| 20 providers | 200 GB | 4,000 GB | ~400 |
| 30 providers (June target) | 200 GB | 6,000 GB | ~600 |

_Model cache is stored on provider machines (not VPS). VPS impact is only for container registry manifests and job logs (~20 SAR/mo baseline)._

### 2c. Docker Sprint Cost Impact Summary

| Item | v1 Projection | v2 Actual Impact | Change |
|------|--------------|-----------------|--------|
| Docker tooling | Not modeled | 0 SAR/mo | No change |
| Model cache (VPS-side) | Not modeled | ~20 SAR/mo | +20 SAR/mo |
| Trivy scanning | Unknown | 0 SAR/mo | No change |
| Per-job execution overhead | Not modeled | Negligible | No change |
| **Total Docker OPEX delta** | **0** | **~20 SAR/mo** | **+20 SAR/mo** |

> **Verdict:** The Docker P0 sprint adds approximately **20 SAR/mo** to VPS-side OPEX. This is immaterial. Provider-side model cache storage is an on-provider cost, not a DCP OPEX line item. No new subscriptions or licenses required.

---

## 3. DCP-266 Haiku Migration — Savings Detail

### 3a. Migration Scope

**9 agents switching to Haiku 4.5 + event-triggered heartbeats** (low-complexity, repetitive tasks):

| Agent | Rationale for Haiku |
|-------|-------------------|
| DevOps Automator | Scripted deployments; structured outputs; deterministic tasks |
| Code Reviewer 1 | Diff analysis; follows a fixed review rubric |
| Code Reviewer 2 | Same as CR1; parallel reviewer |
| QA Engineer | Test scaffolding; structured test output |
| Budget Analyst | Financial tables; numerical formatting |
| DevRel Engineer | Docs generation; templated SDK guides |
| IDE Extension Developer | JSON/VSIX configs; repetitive scaffolding |
| P2P Network Engineer | Protocol scaffolding; boilerplate code |
| Blockchain Engineer | Smart contract templates; low activity |

**6 agents remaining on Sonnet 4.6** (high-complexity, architectural decisions):

| Agent | Rationale for Sonnet |
|-------|---------------------|
| CEO | Orchestration; cross-agent reasoning; triage decisions |
| Backend Architect | API design; schema migrations; security-sensitive code |
| Frontend Developer | Complex UI state; Next.js App Router patterns |
| Security Engineer | Threat modeling; auth flows; HMAC/rate-limit design |
| Founding Engineer | Full-stack integration; cross-cutting concerns |
| ML Infrastructure Engineer | GPU routing logic; VRAM scheduling; job dispatch |

### 3b. Savings Summary

| Scenario | Agent API SAR/mo | vs. Current Sonnet Sprint Rate |
|----------|-----------------|-------------------------------|
| **Current (Sonnet 4.6, sprint cadence)** | **6,930** | baseline |
| **Post-DCP-266 (Haiku + event-triggered)** | **~2,324** | **−65% (−4,606 SAR/mo)** |

_DCP-266 original estimate cited savings of 4,486 SAR/mo. Updated Sonnet→Haiku ratio (3.75× token cost reduction + 55% event-triggered heartbeat reduction) projects ~4,572–4,606 SAR/mo savings, consistent with the original estimate within rounding._

### 3c. Total Monthly OPEX Post-DCP-266

| Bucket | Post-DCP-266 (SAR/mo) |
|--------|----------------------|
| Fixed SaaS | 2,956 |
| VPS + domain | 407 |
| Docker (new) | ~20 |
| Agent API (post-Haiku) | ~2,324 |
| **Total** | **~5,707 SAR/mo** |

> Post-DCP-266 total OPEX drops from **~10,313 SAR/mo** (current sprint pace) to **~5,707 SAR/mo** — a **45% reduction**. This brings DCP within range of break-even at modest provider volumes.

### 3d. DCP-266 Cumulative Q2 Savings

| Month | Current Pace OPEX (SAR) | Post-DCP-266 OPEX (SAR) | Savings (SAR) |
|-------|------------------------|------------------------|---------------|
| April (half-month transition) | 10,313 | 8,010 | 2,303 |
| May (full Haiku) | 10,313 | 5,707 | 4,606 |
| June (full Haiku, optimized) | 10,313 | 5,463 | 4,850 |
| **Q2 Total** | **30,939** | **19,180** | **11,759** |

---

## 4. Break-Even Analysis

### 4a. GPU Revenue Model

| Parameter | Value | Source |
|-----------|-------|--------|
| Avg GPU listing rate | 2.4 SAR/hr (gross, renter-facing) | RTX 4070 baseline seed data |
| DCP platform fee | 25% of gross billings | Platform contract |
| DCP revenue per GPU-hour | **0.60 SAR/hr** | 2.4 SAR × 25% |
| GPU-hours per month (full utilization) | 720 hrs | 30 days × 24 hrs |
| DCP revenue per GPU per month | **432 SAR** | 0.60 × 720 |
| Gross billing per GPU per month | **1,728 SAR** | 2.4 × 720 |

_Note: GPU rate updated from v1 (5 SAR/hr) to 2.4 SAR/hr — reflects actual seed-data pricing. DCP fee remains 25%._

### 4b. Break-Even GPU Count by OPEX Scenario

| OPEX Target | DCP Revenue Needed (SAR/mo) | GPUs @ Full Util | GPUs @ 60% Util | GPUs @ 30% Util |
|-------------|----------------------------|------------------|-----------------|-----------------|
| SaaS floor only (2,956 SAR) | 2,956 | **7** | **12** | **23** |
| Post-Haiku total (5,707 SAR) | 5,707 | **14** | **23** | **44** |
| Current sprint pace (10,313 SAR) | 10,313 | **24** | **40** | **80** |

_GPUs @ full util: OPEX ÷ 432 SAR/GPU/mo. Utilization scenarios discount GPU-hours proportionally._

> **Break-even verdict:** At full utilization, **7 active GPUs** covers the SaaS OPEX floor (2,956 SAR). Post-DCP-266 total OPEX requires **14 GPUs** at full utilization — achievable by June 2026 under the optimistic provider growth scenario.

### 4c. 30-Provider Target — June 2026

| Metric | Value |
|--------|-------|
| Target provider count (June) | 30 |
| Gross billing per provider/mo (full util) | 1,728 SAR |
| Total gross billing (30 providers) | **51,840 SAR/mo** |
| DCP revenue (25% fee) | **12,960 SAR/mo** |
| Post-DCP-266 total OPEX | ~5,707 SAR/mo |
| **Projected June surplus** | **+7,253 SAR/mo** |

> At 30 providers with full utilization (optimistic), June generates a **+7,253 SAR surplus** — covering Q2 cash losses and establishing positive cash flow entering Q3.

### 4d. Monthly P&L — Conservative vs. Optimistic (v2 Revised)

**Conservative (1 → 5 → 15 providers, 30% utilization):**

| Month | OPEX (SAR) | DCP Revenue (SAR) | Net (SAR) | Coverage % |
|-------|-----------|------------------|-----------|-----------|
| April | 8,010 | 130 | −7,880 | 2% |
| May | 5,707 | 648 | −5,059 | 11% |
| June | 5,463 | 1,944 | −3,519 | 36% |
| **Q2 Total** | **~19,180** | **~2,722** | **−16,458** | **14%** |

_Revenue = providers × 432 SAR × utilization factor. April assumes DCP-84 payments live mid-month (50% effective)._

**Optimistic (1 → 10 → 30 providers, 60% utilization):**

| Month | OPEX (SAR) | DCP Revenue (SAR) | Net (SAR) | Coverage % |
|-------|-----------|------------------|-----------|-----------|
| April | 8,010 | 259 | −7,751 | 3% |
| May | 5,707 | 2,592 | −3,115 | 45% |
| June | 5,463 | 7,776 | +2,313 | 142% |
| **Q2 Total** | **~19,180** | **~10,627** | **−8,553** | **55%** |

> **v2 vs. v1 comparison:** v2 revenue projections are lower than v1 because the GPU rate was corrected from 5 SAR/hr to 2.4 SAR/hr (v1 was overstated). v2 OPEX is slightly lower due to the Docker sprint adding minimal cost. The optimistic scenario now reaches break-even in June (not May as v1 projected) and the conservative scenario ends Q2 at 36% OPEX coverage (vs. 73% in v1 — again due to corrected GPU rate).

---

## 5. Recommendations

### Priority 1 — Immediate (March 2026)

| Action | Issue | Monthly Savings (SAR) | Effort |
|--------|-------|-----------------------|--------|
| Deploy all 9 Haiku migration batches | DCP-266 | **~4,606** | Medium |
| Switch all 15 agents to event-triggered heartbeats | DCP-266 | Included above | Low |

### Priority 2 — April 2026

| Action | Issue | Financial Impact |
|--------|-------|----------------|
| Launch live payment gateway (Moyasar/Tap) | DCP-84 | Unblocks all Q2 revenue — currently 0 SAR/mo |
| Onboard first paying provider | Provider ops | +432 SAR/mo DCP revenue |
| Onboard first paying renter | Renter ops | Direct GPU utilization → billable hours |

### Priority 3 — May–June 2026

| Action | Issue | Financial Impact |
|--------|-------|----------------|
| Scale to 10 active providers | Provider growth | +4,320 SAR/mo DCP revenue (60% util) |
| Provider referral / DevRel campaign | DCP-323+ | Accelerate ramp to 30 providers by June |
| Implement provider price controls | Gap item | Enables market-rate pricing; higher gross billing per GPU |

### Financial Targets

| Milestone | Target Date | Metric |
|-----------|------------|--------|
| DCP-266 full deployment | April 2026 | Agent API drops to ~2,324 SAR/mo |
| First revenue | April 2026 (DCP-84) | >0 SAR collected |
| SaaS floor covered by revenue | June 2026 (optimistic) | 7 active GPUs at full util |
| Monthly cash flow positive | June 2026 (optimistic) | 30 providers @ 60% util |
| Monthly cash flow positive | Q3 2026 (conservative) | 14 providers @ 60% util |

---

## Appendix A — Key Rate Changes: v1 → v2

| Parameter | v1 Value | v2 Value | Reason |
|-----------|----------|----------|--------|
| Agent model tier (non-Haiku) | Opus 4.6 | **Sonnet 4.6** | Corrected to actual runtime model |
| GPU listing rate | 5 SAR/hr | **2.4 SAR/hr** | Corrected to actual seed-data price |
| DCP revenue per GPU/mo | 1.25 SAR/hr × 720 = 900 SAR | **0.60 SAR/hr × 720 = 432 SAR** | Flows from corrected GPU rate |
| Docker OPEX delta | Not modeled | **~20 SAR/mo** | VPS-side logs + registry metadata only |
| Post-Haiku total OPEX | 5,807 SAR/mo | **~5,707 SAR/mo** | −100 SAR from refined Haiku estimates |

## Appendix B — Key Rates Reference

| Item | Rate | Unit |
|------|------|------|
| GPU rental (renter-facing, Sonnet-era seed) | 2.4 SAR/hr | per GPU-hour gross |
| DCP platform fee | 25% | of gross billings |
| DCP revenue per GPU-hour | 0.60 SAR | net |
| GPU-months to cover SaaS floor (full util) | 2,956 ÷ 432 = 6.84 | **~7 GPUs** |
| Claude Sonnet 4.6 | ~$3/$15 per M tokens (in/out) | ~11.25/56.25 SAR |
| Claude Haiku 4.5 | ~$0.80/$4.00 per M tokens (in/out) | ~3.00/15.00 SAR |
| Sonnet→Haiku token ratio | ~3.75× cheaper per token | — |
| USD/SAR | 3.75 (fixed peg) | — |

---

_Report prepared by: Budget Analyst (DCP-327)_
_Exchange rate: 1 USD = 3.75 SAR (fixed USD/SAR peg)_
_All figures in SAR unless noted. Supersedes `docs/cost-reports/2026-Q2-projections.md` (DCP-290, v1)._
_GPU provider count projections are estimates; actual results depend on DCP-84 live payment launch and provider acquisition activity._
