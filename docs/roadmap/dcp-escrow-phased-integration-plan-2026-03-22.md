# DCP Escrow Readiness and Phased Integration Plan — 2026-03-22

Date: 2026-03-22 (UTC)
Owner: Blockchain Engineer
Scope: Base L2 USDC escrow integration sequencing aligned to current launch policy and active roadmap (`DCP-308`, `DCP-521`).

## 1) Current state snapshot

- Smart contract artifacts already exist in repo (`contracts/contracts/Escrow.sol`, Hardhat config, deploy runbook).
- Integration references also exist (`docs/escrow-frontend-integration.md`, `docs/escrow-deploy-runbook.md`) but are not a launch-gate requirement.
- Current platform policy explicitly prioritizes launch hardening and states no escrow rollout until platform stability is achieved.
- Therefore escrow should proceed as a staged post-launch track with strict gates and rollback-safe activation.

## 2) Non-negotiable gates

Escrow work does **not** move to production activation until all are true:

1. `DCP-308` launch gate is completed and post-deploy checks are green.
2. P0 payment/reconciliation and security regression tasks are closed (`DCP-525`, `DCP-527`, `DCP-528`).
3. Runtime operations are stable for at least 7 consecutive days without Sev-1 payment/job settlement incidents.

If any gate regresses, escrow remains dark (design and test only).

## 3) Phased rollout plan

## Phase 0 — Launch-safe escrow readiness (now, pre-activation)

Goal: lock architecture, test strategy, and operator runbooks without changing live payment behavior.

Deliverables:
- Contract/code parity review between `Escrow.sol` and backend job lifecycle semantics.
- Deterministic mapping table for off-chain statuses (`held`, `released_provider`, `released_renter`, `expired`) to on-chain statuses (`LOCKED`, `CLAIMED`, `CANCELLED`).
- Threat model and key management policy for oracle/relayer/deployer wallets.
- Final go/no-go checklist for enabling chain integration flag.

Files to update:
- `docs/escrow-frontend-integration.md`
- `docs/escrow-deploy-runbook.md`
- `docs/ops/runtime-verification.mdx`

Exit criteria:
- No code paths changed in production billing routes.
- Checklist approved by Backend Architect + Security Engineer + Founding Engineer.

## Phase 1 — Testnet integration in shadow mode (post-launch, no user-facing dependence)

Goal: wire backend to Base Sepolia and execute duplicate settlement actions in shadow mode only.

Deliverables:
- Deploy `Escrow.sol` to Base Sepolia and store address in env (non-production critical path).
- Add `escrow_mode` feature flag: `off | shadow | enforce` (default `off`, then `shadow`).
- On job submit/completion/expiry, emit simulated and on-chain shadow transactions while canonical source of truth remains off-chain DB.
- Persist tx hashes and chain outcomes for audit.

Files to update:
- `backend/src/services/chain-escrow.js` (or current escrow service module)
- `backend/src/routes/jobs.js`
- `backend/src/routes/admin.js` (status visibility)
- `backend/src/db.js` (only if additional metadata columns are required)

Exit criteria:
- 95%+ shadow transaction success on Base Sepolia for 3 consecutive days.
- Zero impact on renter/provider balances when chain errors are injected.
- QA sign-off on shadow-mode regression report.

## Phase 2 — Controlled enforce mode for allowlist providers

Goal: enable real on-chain settlement for a narrow cohort with automatic fallback.

Deliverables:
- Allowlist switch for provider wallets and/or specific job types.
- `enforce` mode only for allowlist; rest stays off-chain.
- Automatic fallback rule: if chain call fails or latency > threshold, mark settlement pending and route to recovery queue.
- Operator dashboard section for pending/failed chain settlements.

Files to update:
- `backend/src/routes/jobs.js`
- `backend/src/services/recovery-engine.js`
- `backend/src/routes/admin.js`
- `app/admin/*` settlement visibility pages (if missing)

Exit criteria:
- No funds-loss incidents in pilot cohort.
- Recovery queue drains within defined SLA during fault drills.
- Security review confirms key rotation + signer restrictions are operational.

## Phase 3 — General availability + mainnet readiness

Goal: graduate from pilot to broad usage with formal risk controls.

Deliverables:
- External audit remediation completed for `Escrow.sol`.
- Mainnet deployment runbook with separation of duties (deployer, owner, oracle, relayer).
- Incident playbook for pause/cancel pathways.
- Final migration policy for legacy off-chain holds.

Files to update:
- `contracts/contracts/Escrow.sol` (only if audit fixes required)
- `contracts/scripts/deploy.js` and deployment docs
- `docs/ops/non-payment-restart-rollback.md` (split out payment/escrow-specific runbook if needed)

Exit criteria:
- Audit findings resolved/accepted with explicit risk sign-off.
- Go-live approved by CEO + Security Engineer + Founding Engineer.
- Production observability dashboards cover lock/claim/cancel success rate and stuck-lock aging.

## 4) Technical decision records needed before Phase 1

1. **Wallet custody model**: backend-held pooled USDC vs per-renter wallet settlement.
2. **Oracle signature payload versioning**: include chainId, contract address, and nonce strategy to prevent replay across environments.
3. **Job ID canonicalization**: freeze UTF-8/UUID-to-`bytes32` hashing strategy and test vectors.
4. **Failure accounting**: define accounting precedence when chain and DB status diverge.

## 5) Risk register (top items)

- Replay or signature-domain mismatch causing unauthorized claims.
- Chain congestion causing settlement lag and reconciliation drift.
- Key compromise (oracle/owner) without rapid rotation and emergency controls.
- UX confusion if settlement finality timing differs from existing off-chain completion timing.

## 6) Recommended immediate next issues

1. `P2`: Escrow TDR pack (custody, signature domain, failure accounting) — assignee: Blockchain Engineer + Backend Architect.
2. `P2`: Escrow shadow-mode observability schema + admin dashboard cards — assignee: Backend Architect + QA Engineer.
3. `P1`: Escrow signer/relayer security runbook + rotation drill — assignee: Security Engineer.

## 7) Definition of done for DCP-538

- This phased plan is documented in-repo.
- Gates explicitly tie escrow activation to launch stability and P0 closure.
- File-level implementation path and measurable exit criteria exist for each phase.
