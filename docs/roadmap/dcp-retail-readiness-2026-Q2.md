# DCP Retail Readiness Roadmap — 2026 Q2

Date: 2026-03-22 (UTC)  
Owner: CEO (execution coordinator), DevRel Engineer (publication + docs IA)  
Source of truth: Paperclip issue `DCP-545` plan document

## Executive answer (founder timeline)

- **2 weeks (foundation ship):** publish integration specs and architecture docs; release internal-preview API surfaces for model catalog and agent lifecycle.
- **4 weeks (public beta):** expose tenant-scoped Nemotron + Viking endpoints, Swarm v1 prediction APIs, and Page Agents beta lifecycle.
- **8 weeks (retail-ready GA):** ship Swarm pricing optimization guardrails, persistent Page Agents autoscaling + billing, enterprise hardening, and complete GTM positioning updates.

## Strategic objective

Move DCP from launch-readiness hardening into market-ready differentiation by shipping:
- Enterprise model portfolio leadership (Nemotron + Viking + Arabic-first paths)
- Swarm intelligence prediction layer over distributed provider data
- Persistent Page Agents lifecycle platform (not just one-off jobs)
- Clear competitive positioning against RunPod, Vast.ai, Akash, and Lambda

## Workstreams and dependencies

| Workstream | Scope | Primary owner | Dependencies | Milestone target |
|---|---|---|---|---|
| Nemotron Integration | Model registry entries, GPU fit matrix, inference + fine-tune API contract, templates | ML Infrastructure Engineer | Model catalog/auth controls, template QA, docs/SDK parity | Week 2 spec approved, Week 4 beta endpoint, Week 8 GA |
| Open Viking Integration | Multilingual templates, benchmark plan, one-click deploy flow contract | ML Infrastructure Engineer | Shared model-catalog primitives, frontend deploy flow, docs | Week 2 spec approved, Week 4 beta endpoint, Week 8 GA |
| Swarm Intelligence | Demand/ETA/reliability predictions + pricing suggestions APIs | Backend Architect | Jobs + heartbeat telemetry quality, confidence calibration | Week 2 architecture approved, Week 4 v1 internal live, Week 8 GA guardrails |
| Page Agents Platform | Deploy/configure/run/pause/resume/stop lifecycle, persistence, metered billing | Founding Engineer | Runtime isolation, storage/retention policy, billing schema | Week 2 architecture approved, Week 4 beta lifecycle, Week 8 autoscale+billing GA |
| Competitive Positioning Refresh | Site/docs/sales narrative updates based on shipped truths | UX Researcher + Copywriter | Confirmed technical outputs from all tracks | Week 2 draft, Week 4 beta messaging, Week 8 GA rollout |

## Child issue map (execution references)

| Issue | Focus | Required artifact references | Status (2026-03-22) |
|---|---|---|---|
| `DCP-551` | Nemotron integration spec + templates | Nemotron integration spec (target path: `docs/models/nemotron-integration-spec.md`) | In progress |
| `DCP-552` | Open Viking integration + benchmark spec | Viking integration spec + benchmark methodology (target path: `docs/models/open-viking-integration-spec.md`) | In progress |
| `DCP-553` | Swarm Intelligence architecture + APIs | Swarm architecture/API contract (target path: `docs/architecture/swarm-intelligence-v1.md`) | In progress |
| `DCP-554` | Page Agents lifecycle + billing architecture | Page Agents architecture/lifecycle + billing spec (target path: `docs/architecture/page-agents-v1.md`) | In progress |
| `DCP-555` | Competitive positioning refresh | Updated competitive narrative artifact (target path: `docs/research/dcp-competitive-positioning-q2-2026.md`) | In progress |
| `DCP-556` | Roadmap publication + docs IA integration | This roadmap publication + docs index links | In progress |

## Milestone matrix

### Week 2 (foundation)
- Roadmap published in `docs/roadmap/`
- Nemotron + Viking integration specs approved
- Swarm + Page Agents architecture docs approved
- Child implementation issues staffed and active

### Week 4 (public beta)
- Nemotron/Viking beta endpoints behind feature flag
- Swarm v1 predictions available for internal routing decisions
- Page Agents beta lifecycle APIs + dashboard controls available

### Week 8 (retail-ready GA)
- Swarm pricing optimization promoted with confidence/guardrail policy
- Page Agents persistent state + autoscaling + billing promoted
- Competitive positioning fully refreshed across docs/site/sales-facing assets

## Dependency map

- Model integrations (Nemotron + Viking) share one model-catalog backbone.  
- Swarm quality depends on job history + heartbeat telemetry normalization.  
- Page Agents billing integrity depends on durable lifecycle state and metering schema.  
- Positioning refresh must only claim capabilities that are actually shipped per milestone.

## Risks and controls

| Risk | Impact | Mitigation |
|---|---|---|
| Sparse early data for Swarm predictions | Low-confidence ETA/pricing suggestions | Rule-based priors + confidence intervals until telemetry volume stabilizes |
| Model licensing or runtime mismatch | Delayed Nemotron/Viking rollout | Gate model entries by license + validated GPU fit matrix before exposure |
| Long-running Page Agents isolation failures | Reliability or noisy-neighbor incidents | Runtime policy enforcement, health checks, and staged rollout by tenant cohort |
| Messaging drift vs delivered product | Commercial/reputation risk | Link all claims to shipped issue artifacts and milestone state |

## Publication notes

- This document mirrors the approved `DCP-545` plan and timeline answer.
- All child architecture/spec work is tracked in `DCP-551` through `DCP-555`.
- Docs entry-point links were updated in:
  - `docs/README.md`
  - `docs/roadmap/README.md`
