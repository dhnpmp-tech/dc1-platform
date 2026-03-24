# On-Chain Job Verification Design

**Version:** 2026-03-24
**Author:** Blockchain Engineer
**Status:** DESIGN COMPLETE — not yet implemented
**Related:** DCP-810, contracts/contracts/Escrow.sol, docs/blockchain/escrow-deployment-readiness.md

---

## Purpose

Define how completed GPU compute jobs are recorded on-chain for audit, billing verification, and dispute resolution. This document captures the architectural decision between per-job on-chain writes vs. batched settlement, with gas cost trade-offs.

---

## Current State (March 2026)

The existing `Escrow.sol` contract already emits `Claimed(jobId, provider, providerAmount, feeAmount)` and `Deposited(jobId, renter, provider, amount, expiry)` events. These events form an immutable on-chain audit trail for every completed job that goes through escrow.

**What we have:**
- `Deposited` event — job start, renter, provider, USDC amount locked
- `Claimed` event — job completion, provider paid, DC1 fee paid
- `Cancelled` event — job expired/refunded

**What we lack:**
- Token usage (GPU tokens / inference tokens consumed)
- Job metadata (model name, GPU type, duration)
- A queryable on-chain registry separate from event logs

---

## Proposed Job Verification Record

### Minimal On-Chain Footprint (Recommended)

Keep the existing escrow events as the primary on-chain record. Augment with off-chain indexing.

| Field | Source | On-Chain? |
|-------|--------|-----------|
| `job_id` (bytes32) | keccak256 of DC1 UUID | ✅ Already in Escrow events |
| `renter_address` | wallet | ✅ Already in `Deposited` |
| `provider_address` | wallet | ✅ Already in `Claimed` |
| `cost_wei` (USDC amount) | escrow amount | ✅ Already in `Claimed` |
| `timestamp` | block.timestamp | ✅ Implicit in block |
| `tokens_used` | vLLM metering | ❌ Not on-chain (see options below) |
| `model_name` | template catalog | ❌ Not on-chain |
| `gpu_type` | provider registration | ❌ Not on-chain |

**Recommendation:** Keep token counts off-chain in the PostgreSQL metering tables (already implemented). The escrow events provide the financial audit trail. Full job metadata lives in the DC1 backend database.

---

## Options Analysis

### Option A — Per-Job On-Chain Write (Full Transparency)

Add a `JobCompleted` event or storage record to a new `JobRegistry.sol` contract:

```solidity
event JobCompleted(
    bytes32 indexed jobId,
    address indexed renter,
    address indexed provider,
    uint256 tokensUsed,
    uint256 costUsdc,
    uint256 timestamp
);
```

**Gas cost estimate (Base L2):**

| Operation | Gas | Cost at ~0.005 gwei (Base Sepolia) | Cost at ~0.01 gwei (Base mainnet) |
|-----------|-----|-------------------------------------|-----------------------------------|
| Emit event (5 indexed fields) | ~5,000 gas | ~$0.000025 | ~$0.00005 |
| Write to storage (1 slot) | ~20,000 gas | ~$0.0001 | ~$0.0002 |
| Total per job (event only) | ~5,000 gas | **< $0.0001** | **< $0.0002** |
| Total per job (event + storage) | ~25,000 gas | **~$0.00013** | **~$0.00025** |

Base L2 gas is very cheap. Even at 1,000 jobs/day, per-job event emission costs under **$0.10/day**.

**Pros:**
- Immutable, queryable audit trail for every job
- Disputes can be resolved by pointing to on-chain proof
- Investors and enterprise customers can verify DCP activity independently

**Cons:**
- Requires backend to call `JobRegistry.sol` on every job completion
- Additional contract deployment and maintenance
- Each job completion requires a backend-signed transaction (gas + nonce management)

---

### Option B — Batched Daily Settlement (Gas Optimal)

Backend accumulates job completions off-chain, then posts a single Merkle root on-chain daily:

```solidity
event BatchSettled(
    uint256 indexed batchId,
    bytes32 merkleRoot,
    uint256 jobCount,
    uint256 totalUsdc,
    uint256 timestamp
);
```

**Gas cost estimate:**

| Operation | Gas | Cost at 0.01 gwei |
|-----------|-----|-------------------|
| Emit `BatchSettled` | ~3,000 gas | ~$0.00003 |
| Write Merkle root to storage | ~20,000 gas | ~$0.0002 |
| **Per-batch (regardless of job count)** | ~23,000 gas | **~$0.00023/day** |

**Pros:**
- Near-zero gas regardless of job volume
- Single daily transaction simplifies nonce management
- Merkle proofs enable individual job verification on-demand

**Cons:**
- Off-chain indexer required to reconstruct job records from Merkle tree
- Disputes require Merkle proof generation (more complex UX)
- 24-hour settlement lag (not real-time)

---

### Option C — Escrow Events Only (Current State, No New Contract)

Use the existing `Claimed` events from `Escrow.sol` as the sole on-chain record. Token counts and job metadata stay in PostgreSQL.

**Gas cost:** Zero additional gas — events emitted by existing escrow flow.

**Pros:**
- No new contracts, no new transactions
- Escrow events already provide financial audit trail
- Simplest path to launch

**Cons:**
- No on-chain record of token consumption or job metadata
- Financial audit only — cannot verify compute claims on-chain
- Enterprise customers cannot independently audit GPU usage

---

## Recommendation: Phased Approach

### Phase 1 (Now — escrow launch)
Use **Option C**: escrow events only. This is zero additional work and provides a complete financial audit trail for the testnet launch. The `Deposited` and `Claimed` events already record: job ID, renter, provider, USDC amount, and timestamp.

### Phase 2 (Post-launch — first 10 active providers)
Implement **Option A** (per-job events) in a lightweight `JobRegistry.sol`. At DCP's current and near-term job volume, per-job gas costs are negligible on Base L2 (<$0.0002/job). This gives enterprises and investors a fully transparent audit trail.

### Phase 3 (Scale — 10,000+ jobs/day)
Re-evaluate **Option B** (Merkle batching) if gas costs or transaction throughput become a concern. At Base L2 pricing, this threshold is unlikely to be reached before Series A.

---

## JobRegistry.sol Interface (Phase 2 Design)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DC1 Job Registry
 * @notice Immutable on-chain record of completed GPU compute jobs.
 *         Called by the DC1 backend oracle after each job completion.
 */
interface IJobRegistry {
    event JobRecorded(
        bytes32 indexed jobId,
        address indexed renter,
        address indexed provider,
        uint256 tokensUsed,
        uint256 costUsdc6,   // USDC with 6 decimals
        uint256 completedAt  // block.timestamp
    );

    /**
     * @param jobId       keccak256 of DC1 job UUID
     * @param renter      wallet that paid for the job
     * @param provider    wallet that ran the job
     * @param tokensUsed  inference tokens (input + output)
     * @param costUsdc6   actual USDC charged (6 decimals)
     */
    function recordJob(
        bytes32 jobId,
        address renter,
        address provider,
        uint256 tokensUsed,
        uint256 costUsdc6
    ) external;

    function getJob(bytes32 jobId) external view returns (
        address renter,
        address provider,
        uint256 tokensUsed,
        uint256 costUsdc6,
        uint256 completedAt
    );
}
```

**Access control:** Only the DC1 oracle address (same as escrow oracle) can call `recordJob`. This prevents fake job injection.

---

## Integration with Existing Escrow

The `JobRegistry.sol` would be called by the backend immediately after `claimLock` succeeds:

```
Backend flow (Phase 2):
1. Job completes → vLLM reports token count → backend records metering in PostgreSQL
2. Backend oracle signs EIP-712 Claim proof
3. Backend calls Escrow.claimLock(jobId, proof) → USDC transferred
4. Backend calls JobRegistry.recordJob(jobId, renter, provider, tokens, cost) → on-chain record
```

Both calls can be submitted in the same transaction bundle to reduce latency.

---

## Dispute Resolution Flow

With on-chain job records (Phase 2):

1. Renter disputes: "I was charged $50 but only ran 1,000 tokens"
2. Backend provides: `JobRegistry.getJob(jobId)` → shows 50,000 tokens, $50 cost
3. Renter can independently verify on Basescan
4. If discrepancy found: DC1 ops reviews off-chain metering logs
5. Refund issued via owner `cancelExpiredLock` or manual USDC transfer

With escrow events only (Phase 1):

1. Renter disputes the USDC amount charged
2. Backend points to `Claimed` event on Basescan — immutable proof of amount
3. Token count disputes resolved off-chain via PostgreSQL metering logs

---

## Gas Cost Summary

| Approach | Gas/Job | Cost/Job (Base mainnet) | Cost/1K jobs/day |
|----------|---------|--------------------------|------------------|
| Option C: Events only (current) | 0 extra | $0 | $0 |
| Option A: Per-job registry event | ~5,000 | ~$0.0002 | ~$0.20/day |
| Option A: Per-job registry event + storage | ~25,000 | ~$0.001 | ~$1.00/day |
| Option B: Daily Merkle batch | ~23,000/batch | ~$0.0002/day | ~$0.0002/day |

Base L2 gas prices sourced from basescan.org (March 2026 average: ~0.01 gwei).

**Conclusion:** For DCP's current scale, Option A (per-job events) is affordable and provides maximum transparency. Implement in Phase 2 after escrow goes live.
