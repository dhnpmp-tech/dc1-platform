# Smart Contract Security Audit
## DCP — Escrow, JobAttestation, ProviderStake

**Auditor:** Security Engineer (DCP-901)
**Date:** 2026-03-24
**Branch:** security/dcp-901-contract-audit
**Scope:** `contracts/contracts/Escrow.sol`, `contracts/contracts/JobAttestation.sol`, `contracts/contracts/ProviderStake.sol`
**Compiler:** Solidity ^0.8.20 (OpenZeppelin v5.x)

---

## Executive Summary

| Contract | Overall Risk | Critical | High | Medium | Low | Info |
|---|---|---|---|---|---|---|
| Escrow.sol | **LOW** | 0 | 0 | 1 | 2 | 1 |
| JobAttestation.sol | **MEDIUM** | 0 | 1 | 3 | 2 | 2 |
| ProviderStake.sol | **HIGH** | 0 | 2 | 1 | 1 | 1 |

All three contracts use Solidity 0.8.20 (built-in overflow protection) and OpenZeppelin's ReentrancyGuard and SafeERC20. The reentrancy posture is good across all contracts. The primary concerns are centralization risks in JobAttestation (owner-as-arbitrator with no fallback) and a slashed-funds accounting gap in ProviderStake that could allow the owner to drain active stakes.

---

## 1. Escrow.sol

### Overall Risk: LOW

The Escrow contract is the most security-mature of the three. It correctly follows the Checks-Effects-Interactions pattern, uses nonReentrant guards, and validates inputs thoroughly.

---

### 1.1 Reentrancy — PASS ✅

All three state-changing functions (`depositAndLock`, `claimLock`, `cancelExpiredLock`) are guarded with `nonReentrant`. State transitions (`LOCKED → CLAIMED`, `LOCKED → CANCELLED`) occur before any external `safeTransfer` call, satisfying the CEI pattern.

---

### 1.2 Integer Overflow — PASS ✅

Solidity 0.8.20 provides built-in arithmetic overflow/underflow protection. The fee calculation `(escrow.amount * FEE_BPS) / BPS_DENOMINATOR` is safe: USDC uses 6 decimals and realistic deposit amounts cannot overflow uint256.

---

### 1.3 Access Control — MEDIUM

**Finding ESC-M01: Relayer has unrestricted claim/cancel authority over all escrows**

The `relayer` address (set to `msg.sender` at deployment, updatable by owner) can call both `claimLock` and `cancelExpiredLock` on any job regardless of whether the lock period has elapsed or expired. A compromised relayer key allows:
- Premature cancellation of any active escrow (refunding the renter for an in-progress job)
- Claiming any escrow on behalf of the protocol even without a valid oracle proof (wait — the oracle proof is still required for `claimLock`, so this is less severe for claims)

Actually for `claimLock`, the oracle signature is still verified independently, so the relayer cannot claim without a valid oracle proof. The main risk is **premature cancellation**: a compromised relayer can call `cancelExpiredLock` before expiry only if `block.timestamp > escrow.expiry`, which is enforced. So the relayer cannot bypass the expiry check either.

**Revised Assessment: LOW** — The contract's guards (oracle signature for claims, expiry timestamp for cancels) are enforced regardless of caller identity. Relayer privilege is mostly a gas-payer convenience, not an authority bypass. Still, best practice is to scope relayer authority to specific job IDs or require a renter counter-signature for relayer-initiated cancels.

**Recommendation:** Consider emitting a distinct event when a relayer (vs. participant) calls claim/cancel, for off-chain monitoring.

---

### 1.4 Front-Running — LOW

**Finding ESC-L01: Oracle proof exposure in mempool**

When a provider or relayer submits `claimLock(jobId, proof)`, the oracle EIP-712 signature is visible in the mempool. An observer can front-run the transaction. However, because `claimLock` always sends funds to `escrow.provider` (not `msg.sender`), front-running does not benefit the attacker economically — the provider still receives their payment. The front-runner only wastes the original caller's gas.

**Risk:** Minimal. No economic incentive to front-run.

**Finding ESC-L02: Job-ID squatting**

A miner can observe a pending `depositAndLock` and front-run with the same `jobId`. The effect is a DoS on that specific jobId (the legitimate deposit fails with "Job already exists"). The attacker's deposit is also locked in escrow for their specified expiry. This is a nuisance attack with economic cost to the attacker.

**Recommendation:** Generate jobIds server-side with nonces or use `keccak256(abi.encodePacked(renter, nonce, block.timestamp))` committed off-chain before revealing. Alternatively, accept this as acceptable risk given the low incentive.

---

### 1.5 Denial of Service — INFO

**Finding ESC-I01: Off-by-one at expiry boundary**

`claimLock` requires `block.timestamp <= escrow.expiry` (can claim at exactly expiry).
`cancelExpiredLock` requires `block.timestamp > escrow.expiry` (cannot cancel at exactly expiry).

At the block where `block.timestamp == expiry`, a claim can succeed but a cancel cannot. This is the correct behaviour (claim takes priority), but is worth documenting for off-chain orchestration code.

**Risk:** Info. No funds at risk.

---

## 2. JobAttestation.sol

### Overall Risk: MEDIUM

The contract implements a well-structured challenge/dispute flow. The primary concerns are the owner's unchecked authority over dispute resolution with no timeout fallback, and an inconsistency between the two on-chain verification paths (`attestJob` vs `verifyJob`).

---

### 2.1 Reentrancy — PASS ✅

`resolveChallenge` and `releasePayment` use `nonReentrant` and update state before external calls. `challengeAttestation` makes no external calls. `depositForJob` and `attestJob` use `nonReentrant`. CEI is correctly followed.

---

### 2.2 Integer Overflow — PASS ✅

Solidity 0.8.20. Fee arithmetic is identical to Escrow and safe. `totalTokens = inputTokens + outputTokens` could theoretically overflow only if both values are near `type(uint256).max`, which is impossible for realistic token counts.

---

### 2.3 Access Control — HIGH / MEDIUM

**Finding JA-H01: Owner is sole arbitrator with no fallback — permanent fund lock risk**

`resolveChallenge` is `onlyOwner`. If a job enters `CHALLENGED` status, the ONLY way to release funds is through the owner calling `resolveChallenge`. There is no timeout, no fallback, and no escalation path. If the owner key is lost, rotated to a broken address, or the owner is unresponsive, challenged jobs remain permanently locked.

**Severity: HIGH** — Funds can be permanently locked with no recovery mechanism.

**Recommendation:**
- Add a fallback timeout: after `challengeWindow * N` (e.g., 30 days), allow either party to trigger a default resolution (e.g., refund to renter).
- Or allow the renter to withdraw after a prolonged unresolved challenge.

**Finding JA-M01: Owner conflict of interest as arbitrator**

The contract owner is also the fee recipient (owner receives 25% of all payments). When the owner resolves a challenge with `providerFault = false`, the owner collects their 25% fee. This creates an economic incentive for the owner to favour providers over renters in disputes — the owner loses fee revenue on `providerFault = true` outcomes.

**Severity: MEDIUM** — Conflict of interest in centralized arbitration.

**Recommendation:** Separate the fee collection address from the dispute arbitrator address. Consider using a DAO vote or multi-sig for dispute resolution.

**Finding JA-M02: No maximum challenge window**

`setChallengeWindow` enforces a minimum of `1 hour` but no maximum. The owner could set an arbitrarily large window. If set to `type(uint256).max - block.timestamp`, the challenge window never closes, permanently preventing providers from calling `releasePayment`.

**Severity: MEDIUM** — Owner can indefinitely delay provider payments.

**Recommendation:** Add `require(newWindow <= 30 days, "Window too long")` or similar cap.

**Finding JA-M03: verifyJob operates independently of depositForJob — no linkage**

`verifyJob` is permissionless and does not require the `jobId` to exist in `_jobs` (the escrow flow). Anyone can call `verifyJob` with a valid provider signature for an arbitrary `jobId` that was never deposited. This creates verified records (`_verifiedJobs`) for jobs with no corresponding escrow, which could mislead off-chain indexers or consumers of `getJobRecord`.

**Severity: MEDIUM** — Data integrity issue. No direct fund loss, but consumers of `getJobRecord` cannot distinguish real vs phantom verified jobs.

**Recommendation:** Add `require(_jobs[jobId].status != JobStatus.EMPTY, "Job not found")` in `verifyJob`, or document clearly that `_verifiedJobs` is a separate lightweight verification registry.

---

### 2.4 Front-Running — LOW

**Finding JA-L01: attestJob signature exposure**

The provider's EIP-712 signature in `attestJob` is visible in the mempool. A front-runner can call `attestJob` with the same data. However, because `attestJob` only updates the job record (no funds transfer) and the provider's EIP-712 signature is bound to specific job parameters, the only effect is that the provider's intent is executed by someone else. No economic harm.

---

### 2.5 Denial of Service — LOW / INFO

**Finding JA-L02: Unbounded challengeReason string**

The `challengeReason` field in `challengeAttestation` accepts an unbounded `string calldata`. A renter can submit a challenge with an extremely large reason string. Gas costs scale with calldata size, acting as a natural deterrent. On Base L2 (cheap calldata), this is more feasible. Storage of a very large string on-chain is possible but is the renter's expense.

**Severity: LOW** — No DoS of other users. Self-inflicted gas cost.

**Recommendation:** Add `require(bytes(reason).length <= 1024, "Reason too long")`.

**Finding JA-I01: completedAt not bounded by depositedAt**

`attestJob` checks `job.completedAt <= block.timestamp` but not `job.completedAt >= rec.depositedAt`. A provider could attest a job as completed before it was deposited, which is logically impossible but not prevented on-chain. This doesn't affect fund flow but creates invalid historical records.

**Severity: Info** — Data integrity edge case.

---

## 3. ProviderStake.sol

### Overall Risk: HIGH

The contract contains a critical accounting gap in slashed-funds management that could allow the owner to withdraw active provider stakes. This must be resolved before mainnet deployment.

---

### 3.1 Reentrancy — PASS ✅

`stake`, `unstake`, and `withdrawSlashed` all use `nonReentrant`. The `unstake` function correctly updates `s.amount` and `s.isActive` before the ETH `call`, following CEI. `withdrawSlashed` is also guarded. `slash` makes no external calls.

---

### 3.2 Integer Overflow — PASS ✅

Solidity 0.8.20. All arithmetic is on checked uint256 values. `s.amount -= amount` is checked above for underflow via `if (amount > s.amount) revert InsufficientStake(...)`.

---

### 3.3 Access Control — HIGH

**Finding PS-H01: withdrawSlashed has no accounting — owner can drain active stakes**

The `slash` function reduces `s.amount` in the provider's `Stake` struct, but does NOT track the accumulated slashed balance separately. The contract's ETH balance after slashing contains a mix of active stakes and slashed funds. The `withdrawSlashed` function sends any requested `amount` from the contract's total balance to the owner, with no guard preventing withdrawal of active stake funds.

**Attack scenario:**
1. Provider A stakes 100 ETH → contract balance = 100 ETH, `stakes[A].amount = 100`
2. Admin slashes Provider A for 50 ETH → `stakes[A].amount = 50`, contract balance still = 100 ETH
3. Admin calls `withdrawSlashed(100)` → drains entire 100 ETH, including Provider A's legitimate 50 ETH
4. Provider A calls `unstake(50)` after lock period → `TransferFailed` (contract has 0 ETH)

**Severity: HIGH** — Owner can steal active provider stakes. Providers have no protection.

**Recommendation:**
```solidity
uint256 public slashedBalance;

function slash(...) external onlyOwner {
    // ... existing checks ...
    s.amount -= amount;
    slashedBalance += amount;  // track separately
    // ...
}

function withdrawSlashed(uint256 amount) external onlyOwner nonReentrant {
    require(amount <= slashedBalance, "Exceeds slashed balance");
    slashedBalance -= amount;
    (bool ok, ) = owner().call{value: amount}("");
    if (!ok) revert TransferFailed();
}
```

**Finding PS-H02: No minimum remaining stake after partial unstake**

The `unstake` function allows partial withdrawals. A provider can unstake down to 1 wei and remain `isActive`. This means a provider can appear as a staking participant with effectively zero collateral. Off-chain systems checking `stakes[provider].isActive` would believe the provider has meaningful collateral when they do not.

**Severity: HIGH** — Stake requirement can be bypassed after initial qualification. Providers could front-load staking to gain active status, then drain their stake.

**Recommendation:**
```solidity
if (s.amount - amount < MIN_STAKE && s.amount - amount != 0) {
    revert("Partial unstake would breach minimum — unstake fully or leave >= MIN_STAKE");
}
```
Or: enforce that remaining stake is either 0 (full exit) or >= MIN_STAKE.

---

### 3.4 Front-Running — LOW

**Finding PS-L01: No meaningful front-running vectors**

`stake` uses `msg.value` — the caller controls their own deposit. `unstake` is permissioned to the caller. `slash` is `onlyOwner`. No profitable front-running scenarios exist.

---

### 3.5 Denial of Service — INFO

**Finding PS-I01: Provider cannot top up stake without full unstake cycle**

`stake` reverts with `AlreadyStaked` if the provider has an active stake. To add more collateral, the provider must wait for the 7-day lock period, unstake, then re-stake. During this period their active status is lost. This is a UX inconvenience rather than a security issue, but it creates an operational gap where providers must go offline to adjust stake.

**Recommendation:** Add an `addStake()` function that increases `s.amount` without resetting `stakedAt`, allowing top-ups without forfeiting the lock period history.

---

## Summary of Findings

| ID | Contract | Category | Severity | Title |
|---|---|---|---|---|
| PS-H01 | ProviderStake | Access Control | **HIGH** | withdrawSlashed has no accounting — owner can drain active stakes |
| PS-H02 | ProviderStake | Access Control | **HIGH** | No minimum remaining stake after partial unstake |
| JA-H01 | JobAttestation | Denial of Service | **HIGH** | Owner is sole arbitrator with no fallback — permanent fund lock risk |
| JA-M01 | JobAttestation | Access Control | **MEDIUM** | Owner conflict of interest as fee recipient and arbitrator |
| JA-M02 | JobAttestation | Access Control | **MEDIUM** | No maximum challenge window |
| JA-M03 | JobAttestation | Access Control | **MEDIUM** | verifyJob operates independently — no linkage to depositForJob |
| ESC-M01 | Escrow | Access Control | **MEDIUM** | (revised to LOW) Relayer authority scoped by on-chain guards |
| JA-L01 | JobAttestation | Front-Running | **LOW** | attestJob signature visible in mempool (no economic harm) |
| JA-L02 | JobAttestation | Denial of Service | **LOW** | Unbounded challengeReason string |
| ESC-L01 | Escrow | Front-Running | **LOW** | Oracle proof in mempool (no economic harm) |
| ESC-L02 | Escrow | Front-Running | **LOW** | Job-ID squatting DoS |
| PS-L01 | ProviderStake | Front-Running | **LOW** | No meaningful vectors |
| JA-I01 | JobAttestation | Misc | **INFO** | completedAt not bounded by depositedAt |
| ESC-I01 | Escrow | Denial of Service | **INFO** | Off-by-one at expiry boundary |
| PS-I01 | ProviderStake | Denial of Service | **INFO** | No stake top-up — must full unstake cycle |

---

## Priority Fix Order

1. **PS-H01 (CRITICAL to fix before mainnet):** Add `slashedBalance` accounting to prevent owner from draining active stakes. Simple fix, one variable + two guard lines.

2. **PS-H02 (HIGH):** Enforce minimum remaining stake after partial unstake. Providers should not be able to drain below MIN_STAKE while remaining `isActive`.

3. **JA-H01 (HIGH):** Add a timeout fallback for unresolved challenges. Suggested: after `challengeWindow * 30`, allow renter to auto-recover funds.

4. **JA-M02 (MEDIUM):** Cap `setChallengeWindow` at 30 days maximum.

5. **JA-M03 (MEDIUM):** Add jobId existence check in `verifyJob` or document the intentional separation clearly.

6. **JA-M01 (MEDIUM):** Separate dispute arbitration from fee collection — use a dedicated arbitrator address.

---

## Notes

- All three contracts use Solidity 0.8.20 and OpenZeppelin v5.x. The reentrancy posture is **correct** across all three — no reentrancy vulnerabilities found.
- EIP-712 typed data signing is correctly implemented in Escrow and JobAttestation.
- This review is based on static analysis only. A full audit should include fuzz testing (Foundry invariant tests), formal verification of the fee arithmetic, and testnet deployment validation.
- Contract code modification is Blockchain Engineer scope (DCP-899 team). This report is read-only analysis.

---

## Addendum: Escrow Event Bridge Security Review (DCP-903 / DCP-906)

**Reviewed:** `backend/src/services/escrowListener.js`
**Date:** 2026-03-24

The escrow event bridge polls the Base Sepolia contract for on-chain events (`Claimed`, `Cancelled`, `PaymentReleased`, `DisputeRaised`) and reconciles them with the off-chain SQLite ledger.

### Input Validation on Blockchain Event Data — PASS ✅

All event data is decoded via `contract.interface.parseLog(log)` (ethers.js ABI decoder). This validates that the raw log data conforms to the contract ABI before any field access. Malformed or non-conforming logs throw and are caught by the per-handler `try/catch`, logging an error without crashing the process. No raw log fields are passed directly to SQLite — all are extracted via named ABI arguments (`parsed.args[0]`, etc.) and converted to strings before use in parameterized queries.

### Replay Attack Protection — FINDING EB-M01 (Medium)

The listener uses a block cursor (`escrow_listener_cursor.last_block`) persisted in SQLite. On restart, processing resumes from `last_block + 1`, preventing block-level replay.

However, there is **no transaction-hash deduplication** within a block. If the cursor is reset (e.g., admin manually sets `last_block = 0`, or a database restore), all historical events will be reprocessed. The following handlers have non-idempotent writes:

- **`handlePaymentReleased`:** Calls `INSERT INTO payout_requests` without checking for an existing row matching `(provider_id, escrow_tx_hash)`. A cursor reset creates duplicate payout requests for the same on-chain transaction.
- **`handleDisputeRaised`:** Calls `INSERT INTO admin_alerts` unconditionally. Cursor reset creates duplicate dispute alerts.

`handleClaimed` is safe — it only updates rows `WHERE escrow_tx_hash IS NULL`, so re-processing is idempotent.

**Recommendation:** Add `ON CONFLICT DO NOTHING` or a prior `SELECT` check keyed on `escrow_tx_hash` before inserting in `handlePaymentReleased` and `handleDisputeRaised`. This makes all handlers idempotent and safe against cursor resets.

**Risk:** Medium — a cursor reset (requires database or admin access) causes duplicate payouts to be queued for admin approval. The human admin review step before disbursement acts as a compensating control.

### Authorization on Event Handlers — PASS ✅

Event handlers are triggered only by logs fetched from `ESCROW_CONTRACT_ADDRESS` via the configured RPC endpoint. The trust model is: data from the configured contract on the configured chain is authentic. This is correct for a blockchain listener.

**Finding EB-L01 (Low):** The `BASE_RPC_URL` defaults to `https://sepolia.base.org` (unauthenticated public endpoint). A production deployment should use an authenticated RPC provider (Alchemy, Infura, QuickNode) with an API key to:
- Prevent rate-limiting by the public node
- Ensure data integrity (public nodes can be unreliable)
- Reduce exposure to potential MITM on HTTP-level responses (though HTTPS mitigates most risk)

**Recommendation:** Set `BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<API_KEY>` in production VPS env.

### Summary of Bridge Findings

| ID | Severity | Finding |
|---|---|---|
| EB-M01 | Medium | `handlePaymentReleased` and `handleDisputeRaised` are non-idempotent — cursor reset causes duplicate DB writes |
| EB-L01 | Low | Default RPC URL is public/unauthenticated — use authenticated provider in production |
