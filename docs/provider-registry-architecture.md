# ProviderRegistry — Architecture Notes

## Overview

`ProviderRegistry.sol` is an on-chain reputation ledger for DCP GPU compute providers.
It complements the off-chain P2P scoring system (DCP-867) with a tamper-proof,
publicly auditable record of provider performance.

---

## Contract Roles

| Role | Address set at | Capabilities |
|------|---------------|--------------|
| **Owner** | Deploy time | Resolve disputes, deregister providers, rotate oracle |
| **Oracle** | Constructor / `setOracle` | Record job completions, update uptime scores |
| **Provider** | Self-registration | `registerProvider`, receives payouts from Escrow |
| **Renter** | Any EOA | `raiseDispute` |

On mainnet the Owner should be a Gnosis Safe (DAO multi-sig); on Base Sepolia it is the deployer EOA.

---

## Integration with Escrow.sol

```
Renter ──depositAndLock(jobId, provider, amount)──► Escrow.sol
                                                        │
                              Oracle signs EIP-712 proof│
                                                        ▼
Provider ──claimLock(jobId, proof)───────────────► Escrow.sol
                                                        │
              Oracle records completion on-chain        │
                                                        ▼
Oracle ──recordJobCompletion(provider, jobId, tokens)─► ProviderRegistry.sol
```

**Key linkage:** The `provider` address in `Escrow.depositAndLock` is the same EOA
registered in `ProviderRegistry.registerProvider`.  There is no on-chain enforcement
of this link (to avoid coupling the contracts), but the DC1 backend oracle only calls
`recordJobCompletion` after verifying the escrow job was settled.

---

## Reputation Score Formula

```
score = clamp(0, 100,
          50                                         ← base
          + min(30, completedJobs)                   ← track-record bonus (max +30)
          − resolvedFaults × 10                      ← fault penalty (−10 each)
          + (uptimeScore × 20) / 10_000              ← uptime bonus (max +20)
        )
```

### Worked examples

| Scenario | Score |
|----------|-------|
| New provider, 100 % uptime | 70 |
| 30 jobs, 100 % uptime, 0 faults | 100 |
| 30 jobs, 85 % uptime, 1 fault | 87 |
| 0 jobs, 0 % uptime, 0 faults | 50 |
| 0 jobs, 100 % uptime, 8 faults | 10 |
| Any scenario, ≥ 11 faults (no positive offset) | 0 |

---

## Dispute Lifecycle

```
renter calls raiseDispute(provider, jobId, reason)
        │
        ▼
  Dispute stored; provider.disputes++; DisputeRaised event emitted
        │
        ▼
  Owner investigates (off-chain evidence, escrow logs, P2P uptime data)
        │
    ┌───┴───┐
    │       │
providerFault=true   providerFault=false
    │       │
    ▼       ▼
resolvedFaults++   no penalty
    │
    ▼
score recalculated; DisputeResolved event emitted
```

Unresolved disputes do not affect the score — only disputes resolved as
`providerFault=true` apply the −10 penalty.  This prevents griefing by
malicious renters.

---

## Stake Mechanics

- Providers stake ERC-20 tokens at registration time.
- Stake is held in the registry contract until `deregisterProvider` is called by the owner.
- On mainnet, slashing (reducing stake on fault) can be added as a future upgrade.
- For Base Sepolia launch, MockUSDC is used as the stake token (no live DCP token yet).

---

## Deployment

```bash
cd contracts
npx hardhat run scripts/deploy-registry.js --network base-sepolia
```

Constructor arguments:
1. `_stakeToken` — USDC address on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
2. `_oracle`     — DC1 backend wallet address (must be kept secret; use env var `ORACLE_ADDRESS`)

---

## Security Considerations

- **ReentrancyGuard** on `registerProvider` and `deregisterProvider` prevents token re-entry attacks.
- **Oracle key rotation** via `setOracle` allows the DC1 team to rotate the backend signing key without redeploying.
- **Dispute griefing**: unresolved disputes do not penalise score; only owner-resolved faults do.
- **Score floor**: `clamp(0, …)` ensures score never underflows to a large uint.
- **Stake custody**: stake is held by the contract, not the oracle — oracle compromise cannot drain funds.

---

## Future Upgrades (out of scope for Sprint 28)

- **Stake slashing** on `providerFault=true` (deduct from stake, send to DAO treasury).
- **ERC-20 DCP token** as canonical stake asset (replace MockUSDC).
- **On-chain dispute evidence** via IPFS CID stored in the Dispute struct.
- **Upgradeable proxy** pattern for registry evolution without migration.
