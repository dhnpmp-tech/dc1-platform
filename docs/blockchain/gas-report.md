# DCP Smart Contract Gas Report

**Generated:** 2026-03-24
**Solc version:** 0.8.27
**Optimizer:** enabled (200 runs)
**EVM target:** cancun
**Block gas limit:** 60,000,000
**Network:** Base Sepolia (L2)
**Test run:** 104 passing

---

## Summary

All contract deployments are well within block limits (< 4% each).
**5 functions exceed the 100k gas threshold** and are flagged below for review.

---

## Method Gas Costs

### Escrow.sol

| Method | Min | Max | Avg | >100k? |
|---|---|---|---|---|
| `depositAndLock` | 135,153 | 152,253 | 150,200 | YES |
| `claimLock` | 82,992 | 107,692 | 103,049 | YES (max) |
| `cancelExpiredLock` | 47,011 | 51,811 | 48,035 | No |
| `setOracle` | - | - | 30,697 | No |
| `setRelayer` | - | - | 30,720 | No |

**Notes:**
- `depositAndLock` avg 150k gas: ERC-20 safeTransferFrom + full struct write to storage.
- `claimLock` peaks at 107k on first-call paths (status transition + two safeTransfer calls).

### ProviderStake.sol

| Method | Min | Max | Avg | >100k? |
|---|---|---|---|---|
| `stake` | 74,830 | 91,930 | 90,130 | No |
| `unstake` | 38,380 | 42,150 | 39,008 | No |
| `slash` | 30,365 | 35,124 | 32,729 | No |
| `withdrawSlashed` | - | - | 33,289 | No |

**Notes:** All ProviderStake methods well under 100k. Native ETH transfers cheaper than ERC-20.

### JobAttestation.sol

| Method | Min | Max | Avg | >100k? |
|---|---|---|---|---|
| `depositForJob` | - | - | 187,633 | YES |
| `attestJob` | 158,571 | 158,583 | 158,581 | YES |
| `verifyJob` | - | - | 119,631 | YES |
| `releasePayment` | - | - | 96,446 | No |
| `resolveChallenge` | 51,449 | 94,636 | 75,442 | No |
| `challengeAttestation` | 59,318 | 104,463 | 68,417 | No (avg) |
| `setChallengeWindow` | - | - | 29,988 | No |

**Notes:**
- `depositForJob` (187k): full job record struct write + ERC-20 transfer + event.
- `attestJob` (158k): EIP-712 signature verification + struct write. ECDSA recover is expensive.
- `verifyJob` (119k): EIP-712 signature recovery + storage writes.

---

## Deployment Gas

| Contract | Gas Used | % of Block Limit |
|---|---|---|
| `JobAttestation` | 2,095,615 | 3.5% |
| `Escrow` | 1,431,216 | 2.4% |
| `ProviderStake` | 625,888 | 1.0% |
| `MockUSDC` | 507,940 | 0.8% |

---

## Functions Exceeding 100k Gas (Flagged)

| # | Contract | Method | Avg Gas | Risk | Notes |
|---|---|---|---|---|---|
| 1 | `JobAttestation` | `depositForJob` | 187,633 | Medium | Initial storage write + ERC-20. Acceptable on L2. |
| 2 | `JobAttestation` | `attestJob` | 158,581 | Medium | EIP-712 + full struct update. Expected. |
| 3 | `Escrow` | `depositAndLock` | 150,200 | Medium | ERC-20 transfer + full struct write. Acceptable. |
| 4 | `JobAttestation` | `verifyJob` | 119,631 | Medium | EIP-712 signature recovery. Expected. |
| 5 | `Escrow` | `claimLock` | 103,049 | Low | Avg borderline; max 107k. Two ERC-20 transfers. |

**Assessment:** None represent gas vulnerabilities. On Base L2, gas costs are 10-100x cheaper
than Ethereum mainnet. All functions are within production limits. No optimization required now.

---

## Recommendations

1. No immediate action needed -- all functions within Base L2 limits.
2. If deploying to Ethereum mainnet: `depositForJob` (187k) and `attestJob` (158k) should be
   profiled against USDC gas prices before go-live.
3. `claimLock` peaks at 107k -- acceptable, but monitor during gas price spikes.
4. Consider `SSTORE` batching in `attestJob` if gas optimization becomes a sprint priority.
