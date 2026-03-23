# DCP Platform — Financial Model & Break-Even Analysis

**Date:** 2026-03-23 (Updated) | **Original:** 2026-03-19 | **Prepared by:** Budget Analyst
**Purpose:** Informs pricing, hiring, and fundraising decisions.
**Sources:** Cost Model 100/100 (DCP-592), Cost-Control Report (DCP-436), Launch-Week Guardrails (DCP-539), Cost Report (corrected 2026-03-19).

---

## 1. Executive Summary

**UPDATED 2026-03-23 — Post-DCP-266 Cost Reductions Effective**

| Metric | Value | Status |
|--------|-------|--------|
| Monthly fixed opex (SaaS floor) | **2,956 SAR** ($788) | Locked |
| Monthly VPS cost (partner-subsidized) | **382 SAR** ($102) | Locked |
| Monthly agent API cost (post-DCP-266) | **2,324 SAR** ($619) | ✅ Actual (was 6,200 pre-DCP-266) |
| **Current monthly total** | **5,707 SAR** ($1,522) | ✅ Actual (down 40% from 9,538) |
| **Launch-week guardrail (weekly cap)** | **1,313 SAR/week** | Green threshold |
| Standard compute rate | **15 halala/min = 9 SAR/hr** | From pricing-guide.md |
| Break-even vs. OPEX floor (25% util) | **~8 providers** | Unchanged |
| Break-even vs. current total (25% util) | **~15 providers** | Updated (was 24) |
| Break-even for renter-model | **48 renters @ 12.5k SAR avg spend** | Per DCP-592 100/100 model |
| Exchange rate | 1 USD = 3.75 SAR (fixed peg) | Central bank fixed |

---

## 2. Monthly Cost Structure

> **Three separate cost buckets** — not one pool. See detailed cost reports for full breakdown.
>
> **Latest financial documents (2026-03-23):**
> - **DCP-592** ([Cost Model 100/100](cost-model-100-providers-100-renters.md)) — Scale-to-profitability analysis: 100 providers + 100 renters = 312.5k SAR revenue vs. 120k SAR COGS → 61.6% margin at 12.5k SAR avg renter spend
> - **DCP-539** ([Launch-Week Guardrails](reports/2026-03-22-launch-week-burn-guardrails.md)) — Weekly cost tracking framework; Green ≤1,313 SAR/week, Red ≥1,445 SAR/week triggers P1–P3 cost-down bundle
> - **DCP-436** ([Cost-Control Report](reports/2026-03-21-1900-cost-control-report.md)) — DCP-266 impact analysis; 44.7% burn reduction via Haiku downgrades
> - **Financial Dashboard** ([Sprint 25](reports/2026-03-23-sprint25-financial-dashboard.md)) — Unified tracking framework linking cost, revenue, and break-even metrics

### Bucket 1: OPEX Floor — 2,956 SAR/mo (Fixed)

SaaS subscriptions that do not change with usage.

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
| Vercel (Hobby) | 0 | $0 | Frontend hosting (free tier) |
| GitHub | 0 | $0 | Source control (free tier) |
| **TOTAL** | **2,956** | **$787.73** | |

### Bucket 2: Agent API Costs — 2,324 SAR/mo (Post-DCP-266)

Paperclip-managed AI compute. **DCP-266 executed March 23** — downgrade to Haiku-class models for non-core agents.

**What changed:** 10 support/ops agents downgraded from Sonnet (expensive) to Haiku (75% cheaper). CEO, Core Engineers remain on Sonnet.

| Impact | Before DCP-266 | After DCP-266 | Reduction |
|--------|----------------|---------------|-----------|
| Total Agent API cost/mo | ~6,200 SAR | **2,324 SAR** | **−62.6%** |
| Monthly burn rate | 9,538 SAR | **5,707 SAR** | **−40.2%** |
| Provider break-even (25% util) | 24 providers | **15 providers** | -9 providers |

**Cost-down actions still available (DCP-539):** P1–P3 bundle worth additional 794 SAR/mo if launch-week spend crosses Red threshold (≥1,445 SAR/week).

### Bucket 3: VPS — 382 SAR/mo (Partner-Subsidized)

| Resource | Monthly SAR | Monthly USD | Notes |
|----------|-------------|-------------|-------|
| Hostinger VPS srv1328172 | 382 | $101.87 | Runs DCP API (PM2), Paperclip, Bella/Laura, PostgreSQL |
| **TOTAL** | **382** | **$101.87** | Paid by Peter. Transfers to DCP at Phase B close. |

### Combined Monthly Total

| Bucket | Pre-DCP-266 | Current (Post-DCP-266) | Further-Optimized (P1–P3) |
|--------|-------------|----------------------|---------------------------|
| OPEX Floor (fixed) | 2,956 | 2,956 | 2,956 |
| Agent API (variable) | ~6,200 | **2,324** | ~1,530 (if P1–P3 apply) |
| VPS (partner-subsidized) | 382 | 382 | 382 |
| **MONTHLY TOTAL** | **~9,538** | **5,707** | **~4,868** |
| **Status** | 93% over ceiling | Still 93% over ceiling | Would be 65% over |

**Key dates:**
- March 23: DCP-266 executed (Haiku downgrades: 6,200 → 2,324 SAR/mo)
- Launch-week activation: P1–P3 cost-down actions available if weekly spend ≥1,445 SAR

---

## 3. Revenue Model

DCP takes a **25% platform fee** on all compute billed. Providers keep 75%.

- **Formula:** `DCP Revenue = Gross Compute Volume × 0.25`
- **Formula:** `Net = DCP Revenue − Monthly Total Cost`

### Standard Compute Rate

| Rate | Conversion | Notes |
|------|-----------|-------|
| **15 halala/min** | = 0.15 SAR/min | Standard listed rate (pricing-guide.md) |
| **9 SAR/hr** | = 15 × 60 / 100 | Hourly equivalent |
| **216 SAR/day** | @ 24h continuous | Theoretical max per GPU |

### GPU Tier Pricing Context (from [Pricing Guide](pricing-guide.md))

| GPU Tier | SAR/hr Range | Midpoint | Halala/min | Typical Use |
|----------|-------------|----------|-----------|-------------|
| RTX 3090 (24 GB) | 10–14 | 12 | ~20 | 7B–13B inference |
| RTX 4090 (24 GB) | 14–20 | 17 | ~28 | 7B–14B, better perf/watt |
| A100 80GB | 45–65 | 55 | ~92 | 70B class, Mixtral |
| H100 80GB | 80–120 | 100 | ~167 | Premium low-latency serving |

> **Modeling note:** Sections 4–5 use the standard 15 halala/min (9 SAR/hr) rate. This sits below the RTX 3090 market midpoint of 12 SAR/hr — projections are therefore conservative.

---

## 4. Provider Growth Curve & Revenue Projections

> Target trajectory: **10 → 50 → 200 active providers** over 12 months.
> Basis: 15 halala/min (9 SAR/hr), 25% DCP fee, 25% average GPU utilization (6 hrs/day).

### 4A. Monthly Revenue by Provider Count (25% Utilization Baseline)

```
DCP Revenue = Providers × 6 hrs/day × 30 days × 9 SAR/hr × 0.25
```

| Month | Active Providers | Gross Volume (SAR) | DCP Revenue (SAR) | Net vs OPEX Floor | Net vs True Total (Current) |
|-------|-----------------|-------------------|-------------------|------------------|-----------------------------|
| 1 | 10 | 16,200 | 4,050 | **+1,094** | −5,488 |
| 2 | 15 | 24,300 | 6,075 | **+3,119** | −3,463 |
| 3 | 20 | 32,400 | 8,100 | **+5,144** | −1,438 |
| 4 | 28 | 45,360 | 11,340 | **+8,384** | +1,802 |
| 5 | 38 | 61,560 | 15,390 | **+12,434** | +5,852 |
| 6 | 50 | 81,000 | 20,250 | **+17,294** | +10,712 |
| 7 | 65 | 105,300 | 26,325 | **+23,369** | +16,787 |
| 8 | 85 | 137,700 | 34,425 | **+31,469** | +24,887 |
| 9 | 100 | 162,000 | 40,500 | **+37,544** | +30,962 |
| 10 | 130 | 210,600 | 52,650 | **+49,694** | +43,112 |
| 11 | 160 | 259,200 | 64,800 | **+61,844** | +55,262 |
| 12 | 200 | 324,000 | 81,000 | **+78,044** | +71,462 |

### 4B. Milestone Summary

| Milestone | Month | Providers | DCP Monthly Revenue (SAR) |
|-----------|-------|-----------|--------------------------|
| OPEX floor covered | ~1 | ~8 | ~2,956 |
| True cost covered (current) | ~4 | ~24 | ~9,538 |
| True cost covered (optimized) | ~3 | ~15 | ~5,782 |
| 3× revenue surplus | ~7 | ~65 | ~28,614 |
| Series A signal | ~11 | ~155 | ~155,700 ARR approx. |

### 4C. Annual Revenue at 12-Month End-State (200 providers)

| Metric | Value |
|--------|-------|
| Annual Gross Compute Volume | **~3,888,000 SAR** |
| Annual DCP Revenue (25%) | **~972,000 SAR** |
| Annual OPEX (fixed × 12) | 35,472 SAR |
| Annual Net (vs. OPEX floor) | **~936,528 SAR** |

---

## 5. Break-Even Analysis

### A. Break-Even Formula (15 halala/min = 9 SAR/hr)

```
Required providers = Monthly Cost ÷ (utilization_hrs/day × 30 × 9 × 0.25)
```

At 25% utilization (6 hrs/day active):
```
Revenue per provider/mo = 6 × 30 × 9 × 0.25 = 405 SAR
```

### B. Break-Even by Cost Baseline (UPDATED 2026-03-23)

| Cost Baseline | Monthly Cost (SAR) | Providers @ 10% util | Providers @ 25% util | Providers @ 50% util | Status |
|---------------|-------------------|---------------------|---------------------|---------------------|--------|
| OPEX floor only | 2,956 | **~19** | **~8** | **~4** | Achievable Q2 |
| Post-DCP-266 actual | **5,707** | **~35** | **~15** | **~7** | ✅ Current |
| Further-optimized (P1–P3) | ~4,868 | ~30 | ~13 | ~6 | If launch-week Red threshold |

_Calculations: util% hrs/day = 10%→2.4h, 25%→6h, 50%→12h. Revenue/provider/mo = hrs×30×9×0.25_

### C. Break-Even by GPU Tier (25% utilization)

| GPU Tier | SAR/hr | Revenue/Provider/mo | OPEX Break-Even (providers) | True Total Break-Even (providers) |
|----------|--------|--------------------|-----------------------------|-----------------------------------|
| Standard model | 9 | 405 | 8 | 24 |
| RTX 3090 | 12 | 540 | 6 | 18 |
| RTX 4090 | 17 | 765 | 4 | 13 |
| A100 80GB | 55 | 2,475 | 2 | 4 |
| H100 80GB | 100 | 4,500 | 1 | 3 |

### D. Break-Even by Renter Spend

| Renter Monthly Spend | DCP Revenue per Renter | Renters Needed (current) | Renters Needed (optimized) |
|---------------------|----------------------|--------------------------|----------------------------|
| 250 SAR/mo | 62.5 SAR | 153 renters | 93 renters |
| 500 SAR/mo | 125 SAR | 77 renters | 47 renters |
| 1,000 SAR/mo | 250 SAR | **38 renters** | **24 renters** |
| 2,000 SAR/mo | 500 SAR | 20 renters | 12 renters |
| 5,000 SAR/mo | 1,250 SAR | 8 renters | 5 renters |

**Near-term milestone:** 20–25 renters spending 1,000–2,000 SAR/mo → break-even (optimized cost).

---

## 6. Sensitivity Table — DCP Revenue by Utilization × Provider Count

> Rate: 15 halala/min (9 SAR/hr). DCP takes 25% fee. Figures in SAR/month.
> Color guide: 🔴 below OPEX floor | 🟡 between OPEX floor and true total | 🟢 above true total (current)

| Providers | 10% util (2.4 h/day) | 25% util (6 h/day) | 50% util (12 h/day) |
|-----------|---------------------|-------------------|---------------------|
| **5** | 324 🔴 | 810 🔴 | 1,620 🔴 |
| **10** | 648 🔴 | 1,620 🔴 | 3,240 🟡 |
| **15** | 972 🔴 | 2,430 🔴 | 4,860 🟡 |
| **20** | 1,296 🔴 | 3,240 🟡 | 6,480 🟡 |
| **25** | 1,620 🔴 | 4,050 🟡 | 8,100 🟡 |
| **30** | 1,944 🔴 | 4,860 🟡 | 9,720 🟢 |
| **50** | 3,240 🟡 | 8,100 🟡 | 16,200 🟢 |
| **100** | 6,480 🟡 | 16,200 🟢 | 32,400 🟢 |
| **200** | 12,960 🟢 | 32,400 🟢 | 64,800 🟢 |

### Sensitivity Key Thresholds

| Threshold | 10% util | 25% util | 50% util |
|-----------|----------|----------|----------|
| OPEX floor (2,956 SAR) | ~46 providers | ~8 providers | ~4 providers |
| True total / current (9,538 SAR) | ~147 providers | ~24 providers | ~12 providers |
| True total / optimized (5,782 SAR) | ~90 providers | ~15 providers | ~8 providers |

---

## 7. Revenue Milestones & Funding Path

| Milestone | Providers | Renters | Est. Monthly Revenue (SAR) | Target |
|-----------|-----------|---------|---------------------------|--------|
| Pre-revenue | 0 | 0 | 0 | Current (Mar 2026) |
| First revenue | 1–3 | 1–5 | 100–500 | Q2 2026 |
| Cover OPEX floor | ~8 | ~10 | ~2,956 | Q2 2026 |
| Cover true costs (optimized) | ~15 | ~24 | ~5,782 | Q3 2026 |
| Cover true costs (current) | ~24 | ~38 | ~9,538 | Q3 2026 |
| 3× revenue surplus | ~65 | ~130 | ~28,000 | Q4 2026 |
| Series A range | ~200 | ~500 | ~81,000/mo | Q1 2027 |

### Fundraising Context

| Round | Use of Funds | GMV Signal |
|-------|-------------|-----------|
| Bootstrapped | Infrastructure, agents | <50K SAR/mo GMV |
| Pre-seed / angel | Payment infra, sales hire | 50K–200K SAR/mo GMV |
| Seed | Provider acquisition, Saudi BD | 200K–1M SAR/mo GMV |
| Series A | Regional expansion, enterprise contracts | >1M SAR/mo GMV |

---

## 8. Cost Optimization Roadmap

Three pre-approved optimization options (CEO criterion: any option bringing agent API below 3,000 SAR/mo without blocking Phase B).

| Option | Action | Monthly Savings (SAR) | Meets Target? |
|--------|--------|----------------------|---------------|
| 1 | Switch 9 support agents to Haiku model (75% cheaper) | ~1,687 | ❌ alone |
| 2 | Event-triggered heartbeats (no idle polling) | ~1,500–2,000 | ❌ alone |
| 3 | Suspend 4 inactive agents (P2P, Blockchain, IDE, ML) | ~256 | ❌ alone |
| **1+2** | Haiku + event-triggered | **~3,500** | ✅ |
| **1+2+3** | All three combined | **~3,756** | ✅ |

**Recommendation: Implement Options 1+2 immediately. Add Option 3 as secondary.**

| Cost Component | Current (SAR/mo) | After 1+2+3 (SAR/mo) | Delta |
|----------------|-----------------|----------------------|-------|
| OPEX Floor | 2,956 | 2,956 | — |
| Agent API | ~6,200 | ~2,444 | −3,756 |
| VPS | 382 | 382 | — |
| **TRUE TOTAL** | **~9,538** | **~5,782** | **−39%** |

---

## 9. Key Performance Indicators (Weekly)

These 5 KPIs must be reported every Monday to assess platform health:

| # | KPI | Definition | Target (MVP phase) |
|---|-----|------------|-------------------|
| 1 | **Active Providers** | Providers with heartbeat < 2h ago | ≥5 |
| 2 | **Jobs Completed** | Jobs with `status = completed` this 7-day window | ≥10 |
| 3 | **Gross Compute Billed** | Sum of `cost_sar` on all completed jobs this week | ≥2,000 SAR |
| 4 | **DCP Platform Revenue** | Gross Compute × 0.25 | ≥500 SAR |
| 5 | **Provider Earnings Paid** | Sum of pending provider payouts (75% of gross) | Tracked, payout infra TBD |

**Secondary metrics (Phase B):**
- Payment gateway conversion rate (top-up started → succeeded)
- Job queue depth (jobs waiting for a provider)
- Provider uptime rate (hours online ÷ total hours registered)
- Average job latency (queue wait + execution time)

---

## 10. Admin Finance Page — KPI Gap Analysis

**File reviewed:** `app/admin/finance/page.tsx` | **Date:** 2026-03-19

### What Is Currently Shown

| Category | KPIs Displayed |
|----------|---------------|
| All-time revenue | Total Revenue, DC1 Fees (25%), Provider Payouts (75%), Completed Jobs |
| Period breakdown | Today / This Week / This Month (revenue + jobs) |
| Renter balances | Total held, active renters, funded accounts |
| Withdrawals | Pending, approved, paid out |
| Charts | Daily revenue bar chart (14 days) |
| Top performers | Top providers by earnings, top renters by spend |
| Transactions | Paginated table with job/renter/provider/fee breakdown |
| Audit | Billing discrepancies, financial reconciliation (7/14/30/90d) |

### Missing KPIs — Priority Order

| Priority | Missing KPI | Why It Matters | Data Source |
|----------|------------|----------------|-------------|
| 🔴 High | **Gross Merchandise Volume (GMV)** | Primary marketplace health signal; currently buried in revenue math | `SUM(actual_cost_halala)` on completed jobs |
| 🔴 High | **Break-even progress bar** | Visual distance to profitability (% of 9,538 SAR covered) | GMV × 0.25 vs. opex constant |
| 🔴 High | **Monthly Recurring Revenue (MRR) trend** | Only spot figures shown; no time-series to gauge acceleration | Aggregate `this_month` revenue by month |
| 🔴 High | **Average Revenue Per Job (ARPU)** | Pricing health; falling ARPU signals races to the bottom | `total_revenue ÷ completed_jobs` |
| 🟡 Medium | **GPU utilization rate** | Core marketplace efficiency metric; drives all growth projections | `(active_hours ÷ registered_hours)` from heartbeat data |
| 🟡 Medium | **Average job duration** | Informs pricing model accuracy | `AVG(duration_minutes)` on completed jobs |
| 🟡 Medium | **Provider earnings pending payout** | Cash liability exposure; needed before payout infra ships | `SUM(pending_withdrawals)` |
| 🟡 Medium | **Revenue per active provider** | Efficiency of supply-side; flags low-performing providers | `DCP_revenue ÷ active_provider_count` |
| 🟡 Medium | **Renter balance utilization rate** | % of held balance actually spent this month; idle capital risk | `(monthly_spend ÷ renter_balances_held) × 100` |
| 🟡 Medium | **Platform fee rate display** | 25% is hardcoded — should be displayed as a named metric | Constant or configurable setting |
| 🟢 Low | **Job queue depth** | Supply/demand imbalance indicator | `COUNT(jobs WHERE status='queued')` |
| 🟢 Low | **Agent API cost burn (monthly)** | Operational cost side entirely absent from finance page | Paperclip API `/api/agents/me` budget data |
| 🟢 Low | **Cost vs. Revenue ratio** | No profitability metric visible; admin can't see net margin | `(monthly_revenue ÷ monthly_opex) × 100` |
| 🟢 Low | **Top GPU models by revenue** | Informs provider acquisition targeting | Group completed jobs by `gpu_model` |

### Hardcoded Bugs / Label Issues

- `DC1 Fee` label in `StatCard` and transaction table — should be `DCP Fee` per brand standards
- `halalaToSar()` rounds to 2 decimal places but displays raw SAR — consider showing halala for sub-SAR amounts
- No currency symbol normalization (some display `SAR`, some bare numbers)

---

## 11. Assumptions & Caveats

| Assumption | Value | Confidence |
|------------|-------|------------|
| SAR/USD peg | 1 USD = 3.75 SAR | High (central bank fixed) |
| Standard compute rate | 15 halala/min = 9 SAR/hr | High (from pricing-guide.md) |
| Average GPU utilization for projections | 25% (6 hrs/day active) | Medium (no real data yet) |
| Provider growth curve | 10→50→200 over 12 months | Low-medium (aspirational) |
| Agent API projections | Based on 2-day sprint sample × 30 | Low (sprint ≠ steady state) |
| Steady-state agent API costs | ~2,000–3,000 SAR/mo | Medium (post-optimization estimate) |
| VPS cost transfer to DCP | At Phase B close | Per CEO / Peter agreement |
| Payment gateway (Stripe/Tap) | Not yet built | Critical gap — needed before revenue |
| Provider payout infra (bank/IBAN) | Not yet built | Critical gap — needed before provider acquisition |

---

---

## Update History

| Date | Update | Document | Impact |
|------|--------|----------|--------|
| 2026-03-23 | Post-DCP-266 cost refresh | DCP-266 execution, DCP-436 cost-control | Burn down to 5,707 SAR/mo (−40%); break-even now 15 providers |
| 2026-03-23 | Added 100/100 scale model | DCP-592 cost model | 312.5k SAR revenue @ 100 renters + 100 providers; 61.6% margin |
| 2026-03-23 | Added launch-week framework | DCP-539 guardrails | Weekly thresholds, cost-down actions, tracking protocol |
| 2026-03-19 | Initial model | DCP-209 | Pre-DCP-266 baseline (9,538 SAR/mo burn) |

---

_Last updated: 2026-03-23 by Budget Analyst (Paperclip session)_
_Sources: [DCP-592 Cost Model](cost-model-100-providers-100-renters.md) · [DCP-539 Guardrails](reports/2026-03-22-launch-week-burn-guardrails.md) · [DCP-436 Cost Control](reports/2026-03-21-1900-cost-control-report.md) · [Sprint 25 Dashboard](reports/2026-03-23-sprint25-financial-dashboard.md) · [Pricing Guide](pricing-guide.md)_
_All figures in SAR unless noted. Exchange rate: 1 USD = 3.75 SAR (fixed peg)._
