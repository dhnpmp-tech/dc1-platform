# Provider Staking Design — Architectural Decision Record

**Version:** 2026-03-24
**Author:** Blockchain Engineer
**Status:** DESIGN ONLY — not scheduled for implementation (post-Series A)
**Related:** DCP-810, contracts/contracts/Escrow.sol, docs/FOUNDER-STRATEGIC-BRIEF.md

---

## Summary

This document is a 1-page architectural decision record (ADR) for provider staking on DCP. It is intended to answer investor questions about economic security and provider accountability — not to drive immediate implementation.

---

## Why Provider Staking?

DCP currently has 43 registered providers with 0 active. The primary activation blockers are operational (no active renter demand, no pre-warmed models) — not economic. However, as the marketplace scales, staking serves three purposes:

1. **Sybil resistance** — prevent registration spam (currently free)
2. **Performance accountability** — providers lose stake for SLA violations
3. **Investor signal** — demonstrates provider commitment (skin in the game)

At the current stage (0 active providers), requiring stake would be counterproductive. This design is for **Phase 2** (post-launch, 50+ active providers).

---

## Proposed Staking Parameters

### Minimum Stake by GPU Tier

| GPU Tier | Minimum Stake | Rationale |
|----------|--------------|-----------|
| Entry (RTX 3080, A10) | 50 USDC | ~1 week earnings at 50% utilization |
| Standard (RTX 4080, 4090) | 100 USDC | ~2–3 days earnings at 70% utilization |
| Professional (H100, H200) | 500 USDC | ~1–2 days earnings at 70% utilization |
| Premium (A100 80GB) | 500 USDC | ~1–2 days earnings at 70% utilization |

Stakes are denominated in USDC (not ETH) to eliminate volatility risk for providers. Values are calibrated to be meaningful (not trivial) but not prohibitive for legitimate providers.

### Slashing Conditions

| Condition | Slash Amount | Notes |
|-----------|-------------|-------|
| Job abandonment (job accepted, never started) | 10% of stake | Backend detects via timeout |
| Repeated offline violations (>3 in 30 days) | 5% of stake per event | Accumulates |
| Fraudulent completion proof | 100% of stake | Oracle detects mismatch |
| Renter dispute upheld (after review) | 25% of stake | Manual DC1 review required |

Slashed amounts: 50% burned (address(0)), 50% credited to injured renter or DC1 treasury. Burning ensures slashing is punitive, not just redistributive.

### Unstaking Period

- **Request unstake** → 7-day cooldown before funds release
- Cooldown prevents providers from unstaking immediately before a known SLA violation
- During cooldown, stake remains slashable for in-flight jobs
- After cooldown: full unstake, no penalty

---

## Contract Design (Sketch)

```
ProviderStaking.sol (Phase 2)
├── stake(amount)          — deposit USDC, register as staked provider
├── requestUnstake()       — begin 7-day cooldown
├── completeUnstake()      — release funds after cooldown
├── slash(provider, amt, reason)  — onlyOracle, slashes up to full stake
└── getStake(provider)     — view current stake + cooldown state
```

The staking contract would be separate from `Escrow.sol` to keep escrow logic clean. The oracle address is shared — the same backend key that signs job completions would authorize slash events.

---

## Investor Q&A

**Q: What stops a bad provider from taking jobs and disappearing?**
A: The escrow contract pays providers only after oracle-signed job completion. A provider cannot steal renter funds — they just fail to earn. Staking adds reputational and economic consequences for repeated abandonment.

**Q: What is the minimum stake to join DCP?**
A: At launch: zero (to maximize provider recruitment). Phase 2: 50–500 USDC depending on GPU tier. This is comparable to Vast.ai's identity verification requirement, but on-chain.

**Q: Can providers lose more than their stake?**
A: No. Maximum slash is 100% of stake. Renters are made whole from slashed funds or DC1 treasury; providers cannot be put into debt.

**Q: How does staking compare to competitors?**
A: io.net requires validator node deposits. Akash requires AKT tokens (volatile). DCP's USDC staking eliminates crypto volatility risk — providers know exactly what they're committing.

---

## Implementation Sequencing

| Phase | Staking State | Trigger |
|-------|--------------|---------|
| Phase 1 (now) | No staking required | Provider recruitment priority |
| Phase 2 (50+ active providers) | Optional staking, staked providers get priority routing | Post-launch traction |
| Phase 3 (Series A) | Mandatory staking for Tier B+ providers | Marketplace maturity |

---

## Decision

**Deferred to Phase 2.** The staking contract is not blocking launch. The escrow contract already provides financial accountability at the job level. Staking adds provider-level accountability at scale. Implementing staking before there are active providers would add complexity with no benefit.

**Next action:** When DCP reaches 20+ active providers, revisit this ADR and schedule `ProviderStaking.sol` implementation.
