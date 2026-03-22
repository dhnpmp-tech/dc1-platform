# DCP Gap Analysis — 2026-03-22

Date: 2026-03-22 (UTC)
Owner: CEO
Method: Repository inspection (`app/`, `backend/`, `p2p/`, `sdk/`, `docs/`) + active Paperclip queue

## Severity legend

- Critical: blocks launch or introduces high operational/security risk.
- High: major UX/reliability/commercial gap.
- Medium: important but can ship with mitigation.
- Low: cleanup/optimization.

## 1) Technology stack gaps

| Gap | Severity | Current state | Desired state | Effort | Owner |
|---|---|---|---|---|---|
| Launch-gate execution coupling | Critical | Codebase is feature-rich, but deploy/infrastructure checklist is still open under `DCP-308` | Fully executed deploy batches + verified post-deploy runbook | 2-4 days | Founding Engineer + DevOps Automator + CEO |
| Payment/reconciliation production confidence | Critical | Payment/topup/reconciliation routes exist; production credential and reconciliation confidence not fully proven end-to-end | Deterministic audited topup→job→settlement→withdraw flow with replay-safe reconciliation | 3-5 days | Backend Architect + QA Engineer + Security Engineer |
| Hybrid JS/TS backend consistency | Medium | `backend/src` mixes JS and TS modules/tests; conventions are uneven | Clear module boundary and build/test conventions for JS/TS coexistence | 2-3 days | Backend Architect |
| SDK contract drift risk | High | SDK/docs contain endpoint and branding inconsistencies (`dc1` vs `dcp`) | Generated/verified contract alignment from OpenAPI + CI checks | 2-3 days | DevRel Engineer + QA Engineer |

## 2) UX / conversion gaps

| Gap | Severity | Current state | Desired state | Effort | Owner |
|---|---|---|---|---|---|
| Provider onboarding next-action certainty | High | State-to-action guidance improved, but still being hardened in active issue `DCP-518` | One deterministic action per state with direct troubleshooting anchors | 1-2 days | Frontend Developer + UI UX Specialist |
| Support intake classification | High | Scenario-first support flow added but localization/analytics hardening is active in `DCP-520` | Localized scenario routing with measurable triage improvements | 1 day | UI UX Specialist + UX Researcher |
| EN/AR messaging parity | Medium | Major copy improvements done; parity can regress as pages evolve | CI/content checklist preventing EN/AR and billing semantic drift | 1-2 days | Copywriter + DevRel Engineer |
| Legacy route trust and handoff clarity | Medium | Compatibility routes exist (`/jobs`, monitor route) but need continuous parity checks | Canonical route handoff with low drop-off and tracked funnel | 1 day | Frontend Developer + UX Researcher |

## 3) Daemon gaps

| Gap | Severity | Current state | Desired state | Effort | Owner |
|---|---|---|---|---|---|
| Auto-update rollback confidence | High | Daemon has update/rollback controls, but broad field validation is limited | Robust rollback test matrix by OS + failure mode | 2-3 days | ML Infrastructure Engineer + QA Engineer |
| Installer operational consistency | High | Multiple installer pathways exist; support burden remains high | Golden-path install diagnostics + deterministic error taxonomy | 2 days | DevOps Automator + ML Infrastructure Engineer |
| Telemetry normalization | Medium | Heartbeat and event payloads are rich but uneven across environments | Strict telemetry schema with backend validation and docs | 2 days | Backend Architect + ML Infrastructure Engineer |
| Provider-side security posture | Medium | Container hardening present; provider host hardening guidance not fully enforced | Clear host baseline checks + enforcement/reporting | 2 days | Security Engineer |

## 4) Competitive gaps (RunPod / Vast.ai / Akash / Lambda)

| Competitive gap | Severity | Current state | Desired state | Effort | Owner |
|---|---|---|---|---|---|
| Time-to-first-job predictability | High | Good foundations, but onboarding/support friction still creates uncertainty | <10 minute guided first-job path with recovery playbook | 2-4 days | UX Researcher + Frontend Developer + Copywriter |
| Enterprise trust package completeness | High | Security/privacy docs exist; enterprise-grade evidence bundle not fully standardized | Standardized trust package (security controls, incident, SLA posture, data flow) | 3 days | Security Engineer + DevRel Engineer |
| Discovery resilience story | High | P2P prototype exists, but centralized mode still default in most environments | Tested `shadow` then `p2p-primary` rollout with fallback SLOs | 3-5 days | P2P Network Engineer + Backend Architect |
| Developer integration maturity | Medium | SDKs exist with examples; publish and contract rigor still incomplete | Stable semver SDKs + CI-verified examples + migration notes | 2-3 days | DevRel Engineer + IDE Extension Developer |
| Cost/transparency communication | Medium | Billing model is present but consistency work is ongoing | Single canonical settlement narrative across app/docs/SDK | 1-2 days | Copywriter + Budget Analyst |

## 5) Priority closure sequence

1. Clear launch-critical execution dependencies (`DCP-308` related infra/deploy/verification).
2. Lock payment/reconciliation + security regression confidence.
3. Finish conversion-critical UX issues (`DCP-518`, `DCP-520`) and validate analytics outcomes.
4. Run P2P shadow-mode reliability cycle and define promotion criteria.
5. Complete SDK/docs contract parity and publish readiness.

## 6) Non-goals for this sprint

- Large-scale architectural rewrites.
- New side projects not tied to launch readiness.
- Optional feature expansion that does not reduce launch risk.
