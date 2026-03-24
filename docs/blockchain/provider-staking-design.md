# Provider Staking Design

> **Type:** Architectural Decision Record (ADR) — Future Phase
> **Status:** Spec only — not yet implemented
> **Purpose:** Provider economic alignment, Sybil resistance, and SLA enforcement
> **DCP-810** | Blockchain Engineer | 2026-03-24

---

## Executive Summary

Provider staking requires each active GPU provider to lock a USDC stake on-chain. The stake is:
- **Slashed** (partially burned/redistributed) if the provider delivers bad service
- **Released** when the provider gracefully exits
- **Earning multiplier** — higher stake unlocks premium job routing and higher utilization

This creates economic alignment: providers with skin-in-the-game are incentivized to stay online, serve jobs correctly, and not front-run or ghost renters.

---

## 1. Why Staking?

**Current problem:** DCP has 43 registered providers and 0 active. There is no economic cost to registration, so registered providers have no urgency to go live. There is also no mechanism to deter:

- **Ghosting** — accepting a job, going offline mid-execution
- **Sybil attacks** — one bad actor registering many fake providers to game job routing
- **Under-provisioning** — claiming RTX 4090 VRAM but serving from a slower GPU

**Staking solution:** A minimum economic stake creates:
1. A cost-per-registration that deters Sybil registrations
2. A slashing risk that deters bad behavior
3. An exit barrier that ensures graceful handoff of running jobs

---

## 2. Stake Parameters

### Minimum Stake by GPU Tier

| GPU Tier | Example GPUs | Minimum Stake |
|----------|-------------|--------------|
| Entry    | RTX 3080, 3090 | 10 USDC |
| Standard | RTX 4080, 4090 | 25 USDC |
| High     | A100, L40S | 100 USDC |
| Enterprise | H100, H200 | 250 USDC |

**Rationale:** Stake is calibrated to ~10% of the monthly provider revenue at 50% utilization. It represents meaningful "skin in the game" without being prohibitive for the internet cafe tier (primary onboarding target).

- RTX 4090 at 50% utilization earns ~$90/mo → 25 USDC stake ≈ 3.5 days earnings
- H100 at 50% utilization earns ~$900/mo → 250 USDC stake ≈ 2 days earnings

### Stake Multipliers (Optional Enhancement)

Providers may stake above the minimum to unlock routing priority:

| Stake (× minimum) | Routing Priority | Display Badge |
|-------------------|-----------------|---------------|
| 1× (minimum)      | Standard        | None |
| 2× | +10% job allocation weight | Bronze |
| 5× | +25% job allocation weight | Silver |
| 10× | +50% job allocation weight + premium listing | Gold |

---

## 3. Slash Conditions

Slashing is triggered by documented evidence of provider misconduct:

| Condition | Slash Amount | Evidence Required |
|-----------|-------------|-------------------|
| Job ghosting (accepted but timed out before first token) | 5% of stake | Escrow timeout + oracle log |
| Repeated job failure (>3 consecutive failures within 24h) | 10% of stake | Oracle failure logs |
| VRAM misrepresentation (claimed > actual by >20%) | 20% of stake | On-chain benchmark proof |
| Fraudulent job reporting (inflated token counts) | 50% of stake | Metering discrepancy report |
| Stake falls below minimum (slashed below floor) | Provider deactivated | Automatic on-chain check |

**Slashed funds distribution:**
- 50% → burned (deflationary, reduces USDC supply in system)
- 30% → affected renter (compensation)
- 20% → DCP treasury (dispute resolution cost coverage)

**Important:** In Phase 1, slashing is **admin-triggered** (DC1 oracle signs the slash). Fully autonomous slashing via ZK proofs is Phase 3 scope.

---

## 4. Unstaking Period

To prevent providers from withdrawing stake during or immediately after a disputed job:

- **Cooldown period:** 7 days from unstaking request to fund release
- **Active job lock:** Cannot initiate unstake while jobs are `in_progress` or `disputed`
- **Grace period warning:** 48h notice to active renters before provider goes offline
- **Emergency exit:** Contract owner (DC1) can reduce cooldown to 24h for verified hardware failures

The 7-day cooldown covers:
- The 72h dispute window renters have to report job issues
- Backend settlement batch processing time
- Manual review time for edge cases

---

## 5. Smart Contract Design

### New contract: `ProviderStaking.sol`

Separate from `Escrow.sol` to keep concerns isolated. Escrow handles job payments; staking handles provider deposits and slashing.

```solidity
// Core interface
function stake(uint256 amount, bytes32 providerId) external;
function requestUnstake(bytes32 providerId) external;
function finalizeUnstake(bytes32 providerId) external; // after 7-day cooldown
function slash(bytes32 providerId, uint256 amount, address recipient, bytes calldata oracleSignature) external;
function getStakeInfo(bytes32 providerId) external view returns (StakeInfo memory);

struct StakeInfo {
    address owner;          // wallet that staked
    uint256 amount;         // current stake in USDC
    uint256 lockedUntil;    // cooldown expiry (0 if not unstaking)
    bool isActive;          // provider allowed to receive jobs
    uint256 stakedAt;
}
```

**Key design decisions:**
- Staking token: USDC (same as escrow — no new token required)
- `providerId` is `keccak256(providerEmail)` from the existing provider registry — no EVM address required at registration
- Provider must set an EVM wallet address before staking (one-time action)
- Contract is upgradeable via proxy (Beacon pattern) — allows Phase 2 parameter changes without migration

---

## 6. Backend Integration

When staking is live:

1. Provider registration flow adds: "Set your stake to go live" as Step 4 (after the existing 3-step onboarding)
2. Job routing (`/api/jobs/queue` handler) checks `stake_status = active` before assigning jobs
3. `escrow-chain` bridge calls `getStakeInfo()` before accepting `depositAndLock` — no stake, no jobs
4. Settlement service triggers slash check after each failed job

The `providers` table gains a `stake_status` column: `none | pending | active | slashed | withdrawn`.

---

## 7. Provider UX Impact

For the primary onboarding target (Saudi internet cafes with RTX 4090s):

- **Stake required:** 25 USDC ≈ SAR 93.75
- **Time to recoup:** ~1.5 days at 50% utilization (RTX 4090 earns ~$3/day)
- **Presented as:** "Activate your GPU — deposit $25 to start earning"
- **Incentive framing:** "Your stake is your earnings buffer — you can withdraw anytime after a 7-day cooling period"

This is positioned as a **deposit**, not a fee. Providers get it back when they exit.

---

## 8. Investor Q&A Preparation

**Q: How does staking prevent Sybil attacks?**
A: Each active GPU requires a real USDC deposit. Registering 100 fake providers now costs $2,500+ in locked capital. The registration fee (near zero) deters nothing; the stake requirement deters everything.

**Q: Can DCP confiscate provider stakes unfairly?**
A: No. The slash function requires a valid oracle signature over specific evidence (job ID, failure type). The oracle key is the same one used in escrow — already trusted for payment. Slashing events are on-chain and auditable. A dispute contract (Phase 3) will allow providers to challenge slashes on-chain.

**Q: What's the total staking TVL at target scale?**
A: At 1,000 active providers (Phase 2 target): 700 Standard × $25 + 200 High × $100 + 100 Enterprise × $250 = **$62,500 TVL** in ProviderStaking.sol — modest but meaningful.

---

## 9. Implementation Roadmap

| Phase | Milestone | When |
|-------|-----------|------|
| Phase 1 (current) | No staking — registration free, any provider can receive jobs | Live |
| Phase 2 | `ProviderStaking.sol` deployed, staking optional but incentivized (routing priority) | Post-mainnet launch |
| Phase 2.5 | Staking mandatory for new registrations; existing providers grandfathered for 30 days | Q3 2026 |
| Phase 3 | On-chain dispute resolution; slash challenges via ZK proofs | 2027 |

---

*Related: Escrow.sol, docs/blockchain/escrow-deployment-readiness.md, docs/FOUNDER-STRATEGIC-BRIEF.md*
*Last updated: 2026-03-24 — DCP-810*
