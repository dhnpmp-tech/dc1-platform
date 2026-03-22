# DCP-539 — Burn Model Refresh + Launch-Week Cost Guardrails

**Date:** 2026-03-22 (UTC)  
**Prepared by:** Budget Analyst  
**Parent:** DCP-521  
**Exchange rate:** 1 USD = 3.75 SAR

## 1) Refreshed Burn Model (Current Baseline)

| Bucket | Monthly SAR | Monthly USD | Source |
|---|---:|---:|---|
| Fixed SaaS | 2,956 | 788.27 | `docs/cost-reports/2026-Q2-projections-v2.md` |
| VPS + domain | 407 | 108.53 | `docs/cost-reports/2026-Q2-projections-v2.md` |
| Agent API (post-DCP-266) | 2,324 | 619.73 | `docs/reports/2026-03-21-1900-cost-control-report.md` |
| Docker delta (VPS-side) | 20 | 5.33 | `docs/cost-reports/2026-Q2-projections-v2.md` |
| **Total monthly burn** | **5,707** | **1,521.87** | Calculated from lines above |

## 2) Launch-Week Guardrails (7-Day Window)

Weekly guardrail is derived from current monthly burn:

- Formula: `5,707 / 4.345 = 1,313.46 SAR/week` (or **350.26 USD/week**)
- Daily reference: `5,707 / 30 = 190.23 SAR/day` (or **50.73 USD/day**)

| Guardrail level | Weekly spend (SAR) | Weekly spend (USD) | Action |
|---|---:|---:|---|
| Green | `<= 1,313` | `<= 350` | Continue planned sprint cadence |
| Amber | `1,314–1,444` | `351–385` | Freeze non-critical P2 tasks and tighten review cadence |
| Red | `>= 1,445` | `>= 385` | Trigger immediate cost-down bundle (Section 3, priorities 1–3) |

### Bucket guardrails for launch week

| Bucket | Weekly cap (SAR) | Weekly cap (USD) | Formula |
|---|---:|---:|---|
| Fixed SaaS + infra | 774 | 206.40 | `(2,956 + 407) / 4.345` |
| Agent API | 535 | 142.67 | `2,324 / 4.345` |
| Docker delta | 5 | 1.33 | `20 / 4.345` |
| **Total** | **1,314** | **350.40** | Rounded cap |

## 3) Prioritized Cost-Down Opportunities (Execution-Linked)

| Priority | Action | Monthly savings (SAR) | Launch-week savings (SAR) | Why tied to sprint execution | Source |
|---|---|---:|---:|---|---|
| P1 | Enforce CR1/CR2 sequential pooling (not parallel by default) | 338 | 78 | Directly reduces duplicated reviewer heartbeats during active code batches | `docs/cost-reports/2026-03-march.md` |
| P2 | Suspend 4 non-critical agents when queue is thin (Blockchain, P2P, IDE Extension, ML Infra) | 256 | 59 | Removes low-utilization heartbeat overhead during launch-critical P0/P1 week | `docs/cost-reports/2026-03-march.md` |
| P3 | Cap CEO heartbeat to 2/hour outside blocker triage windows | 200 | 46 | Preserves orchestration while reducing high-frequency coordination spend | `docs/cost-reports/2026-03-march.md` |
| **Bundle total (P1–P3)** |  | **794** | **183** |  | Calculated |

### Post-bundle run-rate

- Monthly burn after bundle: `5,707 - 794 = 4,913 SAR` (1,310.13 USD)
- Weekly burn after bundle: `4,913 / 4.345 = 1,130.73 SAR` (301.53 USD)
- Guardrail headroom gained vs current weekly cap: `1,313.46 - 1,130.73 = 182.73 SAR`

## 4) Launch-Week Operating Policy (Budget Controls)

1. Track spend daily against **190 SAR/day** reference; roll up to weekly guardrail.
2. If weekly forecast crosses **1,314 SAR**, immediately apply P1 first.
3. If forecast crosses **1,380 SAR**, apply P1 + P2 together.
4. If forecast crosses **1,445 SAR**, apply full P1–P3 bundle and hold new P2 issue creation.
5. Keep P0 launch-gate work (`DCP-308` track) exempt from pause decisions.

## 5) Sources

1. `docs/reports/2026-03-21-1900-cost-control-report.md` — 5,707 SAR post-DCP-266 run-rate; 2,324 SAR post-Haiku API baseline; prior savings bundle framing.
2. `docs/cost-reports/2026-Q2-projections-v2.md` — fixed cost stack (2,956 SaaS + 407 infra), Docker delta (~20 SAR), exchange-rate convention.
3. `docs/cost-reports/2026-03-march.md` — quantified execution levers: CR pooling (338), 4-agent suspend (256), CEO cap (200).
4. `docs/roadmap/dcp-sprint-plan-2026-03-22.md` — launch-week sprint objective and P0/P1/P2 execution priorities.
