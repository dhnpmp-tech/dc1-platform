# DCP Platform Roadmap Report — 2026 Q1

Date: 2026-03-22 (UTC)
Owner: CEO
Scope: Current repo state (`/home/node/dc1-platform`) + active Paperclip queue (`DCP-308`, `DCP-518`, `DCP-520`, `DCP-521`)

## 1) Executive status

DCP is in late pre-launch hardening, not yet launch-complete. Core renter/provider/admin flows exist in the codebase, but public launch is blocked by launch-gate execution and production-readiness gaps.

Current launch gate: `DCP-308` (in progress).

## 2) Milestones, status, dependencies, and next ship target

| Milestone | Scope | Status (2026-03-22) | Dependencies | Target date | What ships next |
|---|---|---|---|---|---|
| M0 — Core platform foundation | Next.js app shell + Express API + SQLite schema | Done | None | Shipped | N/A |
| M1 — Provider lifecycle v1 | Register, heartbeat, pause/resume, earnings, daemon download/setup | Done (operational) | Daemon stability + provider docs parity | Shipped | Troubleshooting matrix + deterministic onboarding state actions |
| M2 — Renter lifecycle v1 | Register/login, provider marketplace, submit job, monitor results, billing views | Done (operational) | Pricing clarity + status consistency | Shipped | Finalize estimate-hold/settlement parity across all UI/docs |
| M3 — Job execution pipeline | Container spec validation, queue/assignment, retries, logs, output capture, timeout sweeps | Done (operational) | Container policy hardening + telemetry quality | Shipped | Push to production with post-deploy smoke and load verification |
| M4 — Security hardening baseline | Rate limits, auth middleware, webhook safeguards, admin controls | In progress | Security test expansion + key rotation UX + CSP/auth audits | 2026-03-27 | Final auth/rate-limit/webhook regression pass and operator runbook |
| M5 — P2P discovery migration | DHT scaffold, heartbeat announcement bridge, DHT-backed listing path | In progress (prototype integrated; not default) | Bootstrap peers, NAT traversal plan, failover policy, reliability SLOs | 2026-04-05 | Shadow-mode soak, then controlled `p2p-primary` rollout |
| M6 — Billing/payments maturity | Halala pricing model, provider/renter balances, payment/webhook routes, reconciliation routes | In progress | Payment gateway production credentials + reconciliation automation + audit trail | 2026-04-02 | End-to-end topup→job→settlement→withdraw verification |
| M7 — SDK/docs/public DX | Node/Python SDK code, OpenAPI, quickstart/provider/renter docs EN/AR | In progress | Branding/domain consistency, package publish credentials, contract parity tests | 2026-03-30 | Versioned SDK publish + contract-tested examples |
| M8 — Launch gate execution | Infra env, DNS/TLS, deploy batches, post-deploy validation, launch comms | Blocked by execution checklist | DCP-84, DCP-85, DCP-266 + operator deployment cadence | 2026-04-07 | Complete launch-gate checklist and run launch week |

## 3) Feature inventory by subsystem

## Backend/API (`backend/src`)

Implemented:
- Multi-route API surface: providers, renters, jobs, admin, payments, templates, containers, p2p, security, reconciliation, verification, intelligence, sync.
- Rate limiting and security headers in `backend/src/server.js`.
- Provider heartbeat + readiness + job result + daemon event channels.
- Job pipeline supports container workloads, billing calculations, retries, execution logs, webhook/email notifications.

Open roadmap focus:
- Harden payment + reconciliation flows under production credentials.
- Raise automated contract coverage for route-level auth/error conventions.
- Standardize naming where legacy `dc1` strings remain in SDK/docs metadata.

## Frontend/App (`app/`)

Implemented:
- Role-specific renter/provider/admin surfaces.
- Docs experience (`/docs` + role chooser), support flows, legacy route compatibility bridges.
- Dashboard and control pages for jobs, providers, billing, security, status.

Open roadmap focus:
- Conversion-critical onboarding determinism (provider troubleshooting matrix currently active work in `DCP-518`).
- Localization parity cleanup across EN/AR for newly introduced UX blocks.
- End-to-end instrumentation normalization for key CTAs.

## Daemon and installers (`backend/installers`)

Implemented:
- Python daemon v3.3.x with heartbeat, job polling, container execution, update checks, crash watchdog, model pre-cache hooks.
- Installer/setup script delivery from backend endpoints.

Open roadmap focus:
- Cross-platform operational validation matrix (Win/Linux/macOS).
- More deterministic rollback semantics around auto-update failure windows.
- Better observability payload normalization for field support.

## P2P (`p2p/` + backend bridge)

Implemented:
- DHT discovery scaffold and provider announce flow.
- Backend discovery adapter with `sqlite`, `shadow`, and `p2p-primary` modes.

Open roadmap focus:
- Production-grade bootstrap/relay topology and NAT strategy.
- Availability SLOs + fallback thresholds for discovery mode switching.
- Security model (record authenticity/spam controls) before defaulting to p2p-primary.

## SDK + Docs (`sdk/`, `docs/`)

Implemented:
- Node and Python SDK clients with examples.
- OpenAPI and multiple onboarding guides (EN/AR).

Open roadmap focus:
- Contract parity tests between SDK methods and live API behavior.
- Fix branding/domain drift in package metadata/docs (`dc1`/`dc1st.com` leftovers).
- Publish readiness (credentials + version strategy + changelog discipline).

## 4) What ships next (ordered)

1. Complete `DCP-521` outputs and issue seeding from the sprint plan.
2. Finish active UX work (`DCP-518`, `DCP-520`) and merge into onboarding/support conversion path.
3. Execute remaining board/operator launch-gate tasks under `DCP-308` (infra + deploy + post-deploy checks).
4. Complete SDK publish readiness and docs parity checks before launch communications.

## 5) Roadmap risks

- Launch risk: operator-owned infra/deploy dependencies remain outside code-only control.
- Product risk: mixed centralized/P2P discovery messaging can confuse operators and renters if defaults are not explicit.
- GTM risk: docs/SDK publish lag would block external developer onboarding even if core runtime is healthy.

## 6) Go/No-Go criteria for launch

Go requires all of:
- `DCP-308` checklist fully cleared.
- P0 security + billing regression tests pass.
- Provider/renter onboarding flows deterministic in EN/AR.
- SDK and docs reflect exact production endpoints/contracts.

If any are not met, hold launch and continue sprint execution.
