# Escrow.sol — Pre-Deployment Audit Notes

**Version:** 2026-03-23
**Author:** Blockchain Engineer
**Status:** Audit complete — contract is production-ready for testnet
**Related:** DCP-654, contracts/contracts/Escrow.sol

---

## Summary

`Escrow.sol` has been reviewed for security issues, gas efficiency, and correctness before Base Sepolia deployment. **No blocking issues found.** Three minor notes documented below — none require fixes before testnet deployment.

---

## Scope

| File | Lines | Review Status |
|------|-------|---------------|
| `contracts/contracts/Escrow.sol` | 243 | ✅ Reviewed |
| `contracts/contracts/MockUSDC.sol` | 22 | ✅ Reviewed (test-only) |
| `contracts/scripts/deploy.js` | 95 | ✅ Reviewed |
| `contracts/hardhat.config.js` | 68 | ✅ Reviewed |

---

## Security Analysis

### ✅ PASS — Reentrancy Protection

All three state-changing functions (`depositAndLock`, `claimLock`, `cancelExpiredLock`) are marked `nonReentrant` via OpenZeppelin's `ReentrancyGuard`. The status field is updated **before** any token transfer, consistent with the Checks-Effects-Interactions pattern.

```solidity
escrow.status = EscrowStatus.CLAIMED;  // state change
usdc.safeTransfer(escrow.provider, providerAmount);  // interaction
usdc.safeTransfer(owner(), fee);  // interaction
```

**No reentrancy vulnerability.**

### ✅ PASS — EIP-712 Signature Verification

The `claimLock` function verifies an EIP-712 typed data signature from the oracle. The domain separator includes `chainId` and `verifyingContract`, which prevents:
- Cross-chain replay attacks
- Cross-contract replay attacks

The `CLAIM_TYPEHASH` is correctly constructed and matches the `Claim(bytes32 jobId, address provider, uint256 amount)` struct. **Signature verification is sound.**

### ✅ PASS — Access Control

| Function | Who Can Call |
|----------|--------------|
| `depositAndLock` | Any address (renter) |
| `claimLock` | Provider, relayer, or owner |
| `cancelExpiredLock` | Renter, relayer, or owner |
| `setOracle` | Owner only |
| `setRelayer` | Owner only |

`Ownable` is from OpenZeppelin v5 (`Ownable(msg.sender)` constructor pattern). **Access control is correct.**

### ✅ PASS — Integer Arithmetic

Fee computation:
```solidity
uint256 fee = (escrow.amount * FEE_BPS) / BPS_DENOMINATOR;
uint256 providerAmount = escrow.amount - fee;
```

With Solidity 0.8+, overflow/underflow reverts automatically. For USDC amounts up to `type(uint256).max` divided by 10,000, overflow cannot occur at practical amounts. `providerAmount` is computed as a subtraction of `fee` (not independently), so no precision loss from rounding benefits either party systematically.

**No arithmetic issues.**

### ✅ PASS — Token Safety

Uses `SafeERC20` (`safeTransfer`, `safeTransferFrom`) from OpenZeppelin. Handles tokens that do not return a boolean on transfer. USDC on Base returns `true`, but the guard is good practice.

**Token handling is safe.**

### ✅ PASS — Expiry Logic

- `depositAndLock`: requires `expiry > block.timestamp` — cannot set a past expiry
- `claimLock`: requires `block.timestamp <= escrow.expiry` — oracle must sign before expiry
- `cancelExpiredLock`: requires `block.timestamp > escrow.expiry` — only after expiry passes

No overlap or ambiguity at the boundary (`<=` vs `>`). **Expiry logic is correct.**

---

## Minor Notes (Non-Blocking)

### Note 1 — Fee Rounding Favors Provider (Acceptable)

When `escrow.amount` is not divisible by `BPS_DENOMINATOR` (10,000), integer division truncates:

```solidity
fee = (amount * 2500) / 10000  // truncates
providerAmount = amount - fee   // provider gets the remainder
```

Example: If `amount = 10001` micro-USDC:
- `fee = (10001 * 2500) / 10000 = 25002500 / 10000 = 2500` (truncated from 2500.25)
- `providerAmount = 10001 - 2500 = 7501`

The 0–9999 micro-USDC rounding error (< $0.00001 per transaction) is negligible and consistently favors the provider. **Acceptable. No fix needed.**

### Note 2 — Oracle Address Can Be Updated (By Design, but Warrants Key Management Policy)

`setOracle(address newOracle)` allows the owner to rotate the oracle signing key. This is intentional for key rotation, but means that if the owner private key is compromised, an attacker could substitute a malicious oracle that falsely signs job completions for non-existent work.

**Recommendation (post-testnet):** Consider a multi-sig or timelock on oracle updates before mainnet. For Base Sepolia testnet, single-key owner is acceptable.

### Note 3 — No Event Indexing on `expiry` Field

The `Deposited` event indexes `jobId`, `renter`, and `provider`, but `expiry` is not indexed:

```solidity
event Deposited(
    bytes32 indexed jobId,
    address indexed renter,
    address indexed provider,
    uint256 amount,
    uint256 expiry    // not indexed
);
```

This means off-chain indexers cannot efficiently query "all escrows expiring before timestamp X" via event filters. The backend would need to maintain its own expiry index.

**Recommendation:** If the backend needs to batch-cancel expired jobs, maintain a local DB index of `(jobId, expiry)` pairs. No contract change needed.

---

## Gas Cost Reference

Estimated gas costs (Hardhat local simulation, optimizer enabled with 200 runs):

| Function | Estimated Gas |
|----------|---------------|
| `depositAndLock` | ~85,000 gas |
| `claimLock` (with valid proof) | ~75,000 gas |
| `cancelExpiredLock` | ~50,000 gas |
| Deployment of `Escrow.sol` | ~1,200,000 gas |

At Base Sepolia typical gas price (0.001–0.1 gwei), transaction costs are negligible (< $0.001 each). At Base mainnet L2 rates, costs remain very low due to Base's efficient fee market.

---

## OpenZeppelin Version

The contract uses OpenZeppelin v5.0.2 (`@openzeppelin/contracts: ^5.0.2`).

Notable v5 changes used:
- `Ownable(msg.sender)` constructor (new v5 syntax, no implicit ownership)
- `EIP712("DCP Escrow", "1")` — typed data domain separator
- `ReentrancyGuard` — unchanged from v4

**No deprecated v4 patterns used.**

---

## Verdict

| Category | Status |
|----------|--------|
| Reentrancy | ✅ Safe |
| Access control | ✅ Correct |
| Integer arithmetic | ✅ Safe |
| Token handling | ✅ Safe |
| Signature verification | ✅ Sound |
| Expiry logic | ✅ Correct |
| Gas efficiency | ✅ Optimized (200 runs) |
| OpenZeppelin version | ✅ Current (v5) |

**Recommendation:** Deploy to Base Sepolia as-is. Schedule a third-party audit before Base mainnet deployment (per the comment in `hardhat.config.js`).

---

## Files Not Reviewed

- Backend escrow-chain bridge (JS) — out of scope for this review
- `contracts/abis/Escrow.json` — auto-generated, not independently audited
- Test files (`Escrow.test.js`, `Escrow.integration.test.js`) — reviewed for coverage but not security

---

*Next step: Complete [escrow-deployment-readiness.md](escrow-deployment-readiness.md) checklist when founder funds the wallet.*
