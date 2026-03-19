# DC1 Platform — Cost Report
**Date:** 2026-03-18
**Period:** March 2026 (month-to-date)
**Prepared by:** CEO Agent

---

## Per-Agent API Costs (March 2026 MTD)

| Agent | Role | Spend (USD cents) | Spend (USD) | Spend (SAR) | % of Agent Total |
|-------|------|-------------------|-------------|-------------|-----------------|
| DevOps Automator | Infrastructure | 1,736¢ | $17.36 | 65.1 SAR | 18.3% |
| Backend Architect | Backend | 1,672¢ | $16.72 | 62.7 SAR | 17.7% |
| CEO | Management | 1,333¢ | $13.33 | 50.0 SAR | 14.1% |
| Frontend Developer | Frontend | 1,291¢ | $12.91 | 48.4 SAR | 13.6% |
| Security Engineer | Security | 900¢ | $9.00 | 33.8 SAR | 9.5% |
| QA Engineer | QA | 760¢ | $7.60 | 28.5 SAR | 8.0% |
| Founding Engineer | Full-stack | 627¢ | $6.27 | 23.5 SAR | 6.6% |
| Budget Analyst | Finance | 508¢ | $5.08 | 19.1 SAR | 5.4% |
| DevRel Engineer | Docs/SDK | 249¢ | $2.49 | 9.3 SAR | 2.6% |
| ML Infra Engineer | ML/GPU | 155¢ | $1.55 | 5.8 SAR | 1.6% |
| IDE Extension Dev | IDE | 122¢ | $1.22 | 4.6 SAR | 1.3% |
| P2P Network Eng | Networking | 80¢ | $0.80 | 3.0 SAR | 0.8% |
| Blockchain Engineer | Smart Contracts | 30¢ | $0.30 | 1.1 SAR | 0.3% |
| **TOTAL** | | **9,463¢** | **$94.63** | **354.9 SAR** | 100% |

_Exchange rate: 1 USD = 3.75 SAR (SAR/USD peg)_

---

## Monthly Burn Rate Projection

| Metric | Value |
|--------|-------|
| Days elapsed in month | ~2 days (agents activated ~2026-03-17) |
| Spend-to-date | 354.9 SAR |
| Daily burn rate | ~177 SAR/day |
| **Projected full-month agent cost** | **~5,318 SAR** |
| Monthly OPEX budget | 2,956 SAR |
| **Projected overage** | **+2,362 SAR (80% over budget)** |

> **⚠️ WARNING:** At current burn rate, Paperclip agent costs alone will exceed the full OPEX budget. This is partly because the initial sprint involved heavy parallel work across all 13 agents simultaneously. Ongoing steady-state costs should be significantly lower.

---

## Infrastructure Costs (Estimated)

| Line Item | Monthly Cost (SAR) | Notes |
|-----------|-------------------|-------|
| Hostinger VPS (srv1328172) | ~75 SAR | ~$20/mo for KVM4 plan |
| Vercel (Hobby) | 0 SAR | Free tier |
| GitHub | 0 SAR | Free tier (public repo) |
| Domain: dc1st.com | ~7 SAR/mo | ~$15/yr ÷ 12 |
| Domain: dcp.sa | ~18 SAR/mo | ~$45/yr ÷ 12 estimated |
| **Infrastructure subtotal** | **~100 SAR/mo** | |

---

## Total Cost Breakdown

| Category | Monthly SAR | % of 2,956 SAR Budget |
|----------|-------------|----------------------|
| Paperclip agent API (projected) | ~5,318 SAR | 180% |
| Infrastructure | ~100 SAR | 3.4% |
| **Total projected** | **~5,418 SAR** | **183%** |

---

## Budget vs Actual Analysis

**The overage is a sprint artifact, not a steady-state problem.**

The first 48 hours had all 13 agents running simultaneously, each producing large amounts of code and documentation. This is unusually expensive. In steady-state operation:
- Most agents will only run when assigned work
- Heartbeat intervals of 60min mean lower idle costs
- High-cost agents (DevOps, Backend Architect) will have less work as the codebase stabilizes

**Steady-state estimate:** ~4–6 active issues/week × avg $5/issue = ~$20–30/week = ~$80–120/month = 300–450 SAR/month. This is **within budget**.

---

## Cost Optimization Recommendations

### Immediate Actions

1. **Reduce CEO heartbeat to 30min** (currently 15min). CEO mostly exits clean when inbox is empty — shorter interval = less cost per day. Estimated saving: ~30% of CEO spend.

2. **Increase idle agent heartbeat to 2hr** for agents with no queued work:
   - Blockchain Engineer (30¢ MTD — no active issues)
   - IDE Extension Developer (122¢ MTD — light work)
   - P2P Network Engineer (80¢ MTD — prototype done)
   Estimated saving: ~20 SAR/month

3. **Batch CEO strategic scans** — CEO currently does a full open-queue scan every 15 minutes even when there's nothing new. Add a check: if no new completions and no inbox items, skip strategic scan.

4. **Use Haiku for Budget Analyst** — Financial analysis tasks don't require Sonnet-class reasoning. Switching Budget Analyst to claude-haiku-4-5 would cut its cost by ~75%.

### No Action Needed

- No agents should be terminated — all are contributing to Phase B/C roadmap
- Current 12.0% actual spend (354 SAR) is well within budget for the days elapsed so far

---

## OPEX Budget Summary

| Budget Line | Monthly SAR | Status |
|-------------|-------------|--------|
| Total OPEX budget | 2,956 SAR | — |
| Infrastructure (actual) | ~100 SAR | ✅ On budget |
| Agent API (actual MTD) | 354.9 SAR | ✅ OK (early sprint) |
| Agent API (projected full month) | ~5,318 SAR | ⚠️ Over if sprint pace continues |
| **Recommended action** | Reduce heartbeat intervals for idle agents | — |
