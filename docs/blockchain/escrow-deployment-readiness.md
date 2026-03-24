# Escrow Deployment Readiness Checklist

**Version:** 2026-03-24
**Author:** Blockchain Engineer
**Status:** READY — waiting on founder wallet funding
**Related:** DCP-654, DCP-810, contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md, contracts/contracts/Escrow.sol

---

## TL;DR — What Needs to Happen

The Escrow.sol contract is **fully written, tested, and deployment-ready**. The only blocker is a funded wallet on Base Sepolia. Once the founder provides:

1. A wallet with ≥ 0.01 SepoliaETH (for gas)
2. An oracle signing keypair (can generate fresh)

...the entire deployment can complete in **under 20 minutes** by following the steps below.

---

## Pre-Deployment State (Current — 2026-03-23)

| Item | Status |
|------|--------|
| `Escrow.sol` written and reviewed | ✅ Done |
| Hardhat config for base-sepolia | ✅ Done |
| Deploy script (`scripts/deploy.js`) | ✅ Done |
| ABI export to `contracts/abis/Escrow.json` | ✅ Done (post-deploy) |
| Backend `escrow-chain` integration | ✅ Done |
| Test suite passing (local Hardhat) | ✅ Done |
| Funded deployer wallet | ❌ **BLOCKED — founder action required** |
| Oracle keypair generated | ❌ **BLOCKED — founder action required** |

---

## Required Inputs from Founder

### 1. Deployer Wallet (`PRIVATE_KEY`)
- A new wallet with ≥ **0.01 SepoliaETH** for deployment gas
- Base Sepolia ETH is free — get from faucet: https://faucet.quicknode.com/base/sepolia
- The wallet that deploys becomes the `owner` of the contract (receives 25% fees)
- Can also be the DC1 treasury wallet

### 2. Oracle Keypair (`ORACLE_ADDRESS` + `ESCROW_ORACLE_PRIVATE_KEY`)
- The oracle is the DC1 backend signing key that authorizes job completion
- Generate a fresh keypair (never reuse a hot wallet):
  ```bash
  node -e "const {ethers}=require('ethers'); const w=ethers.Wallet.createRandom(); console.log('address:',w.address,'pk:',w.privateKey)"
  ```
- `ORACLE_ADDRESS` → goes in `.env` for deployment (embedded in contract)
- `ESCROW_ORACLE_PRIVATE_KEY` → goes in backend PM2 env vars (never committed to git)

### 3. Gas Cost Estimate

| Operation | Estimated Gas | Est. Cost at 0.1 gwei |
|-----------|---------------|------------------------|
| Escrow.sol deployment | ~1,200,000 gas | ~0.00012 ETH |
| MockUSDC deployment (testnet only) | ~800,000 gas | ~0.00008 ETH |
| Total | ~2,000,000 gas | **~0.0002 ETH** |

Base Sepolia gas is nearly free. **0.01 SepoliaETH is more than sufficient.**

---

## Step-by-Step Deployment (<20 minutes)

### Step 1 — Clone and prepare environment (2 min)
```bash
cd /home/node/dc1-platform/contracts
cp .env.example .env
```

Edit `.env`:
```bash
PRIVATE_KEY=<deployer wallet private key>
ORACLE_ADDRESS=<oracle public address>
BASESCAN_API_KEY=<optional, for verification>
```

### Step 2 — Compile and test (3 min)
```bash
npm run compile
npm test
```
Expected: all tests pass (18 unit tests + integration tests).

### Step 3 — Deploy to Base Sepolia (2 min)
```bash
npm run deploy:sepolia
```

Expected output:
```
DC1 Escrow Deployment
Network   : base-sepolia (chainId 84532)
Deployer  : 0x...
Balance   : 0.0X ETH
USDC address : 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Oracle address: 0x...
Deploying Escrow.sol...
✓ Escrow deployed to: 0x<CONTRACT_ADDRESS>
✓ ABI + address exported to contracts/abis/Escrow.json
```

Record `CONTRACT_ADDRESS`.

### Step 4 — Optional: Verify on Basescan (5 min)
```bash
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> \
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" \
  "<ORACLE_ADDRESS>"
```

Verification URL: `https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>`

### Step 5 — Wire backend environment (3 min)

Add to PM2 env for `dc1-provider-onboarding` service:
```bash
ESCROW_CONTRACT_ADDRESS=<deployed address>
ESCROW_ORACLE_PRIVATE_KEY=<oracle private key>
BASE_RPC_URL=https://sepolia.base.org
ESCROW_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

> **IMPORTANT:** Do not commit `ESCROW_ORACLE_PRIVATE_KEY` to git. Set it only in the PM2 ecosystem file or server env.
> **IMPORTANT:** No PM2 restarts without founder approval (see CLAUDE.md deployment restriction).

### Step 6 — Validate (5 min)

After backend restart (with founder approval):
```bash
curl https://api.dcp.sa/api/admin/escrow-chain/status
```

Expected response:
```json
{
  "enabled": true,
  "contractAddress": "0x<CONTRACT_ADDRESS>",
  "oracleAddress": "0x<ORACLE_ADDRESS>",
  "network": "base-sepolia",
  "chainId": 84532
}
```

---

## Post-Deployment Smoke Test

```bash
# 1. Get some Base Sepolia USDC from Circle testnet faucet
# 2. Approve escrow contract to spend USDC
# 3. Call depositAndLock with a test job
# 4. Backend oracle signs a completion proof
# 5. Relayer calls claimLock
# 6. Verify 75% went to provider, 25% to DC1 treasury
```

A full smoke test script is available at `scripts/phase1-e2e-smoke.mjs` (created by QA Engineer in Sprint 26).

---

## Key Contract Parameters (Fixed at Deploy Time)

| Parameter | Value | Notes |
|-----------|-------|-------|
| USDC address | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Base Sepolia official |
| Fee (DC1 take rate) | 25% (2500 BPS) | Hardcoded in contract |
| Oracle address | Set by founder | Must match backend signing key |
| Relayer address | Same as deployer (owner) initially | Can be updated via `setRelayer()` |
| Solidity version | 0.8.27 | |
| EVM version | cancun | |
| Network | Base Sepolia (chainId 84532) | Testnet first |

---

## Security Notes

- Contract is `Ownable` — owner (deployer) receives 25% fees and can update oracle/relayer
- `nonReentrant` guard on all state-changing functions — reentrancy protected
- EIP-712 typed data signing — prevents signature replay across chains/contracts
- USDC is `immutable` — cannot be changed after deploy
- Fee is a constant (`FEE_BPS = 2500`) — immutable to protect providers from unexpected fee changes

---

## Deployment Decision Checklist (Founder Sign-off)

Before triggering deployment, founder confirms:
- [ ] Deployer wallet funded with ≥ 0.01 SepoliaETH
- [ ] Oracle keypair generated and stored securely (not in git)
- [ ] DC1 treasury wallet identified (receives 25% fees)
- [ ] Backend env vars staged (not yet applied to production)
- [ ] `npm test` passing (Blockchain Engineer confirms)
- [ ] No active user sessions that would be disrupted by backend restart
- [ ] Deployment request issue created and approved (per CLAUDE.md policy)

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Wallet funding (faucet) | 5 min |
| Key generation | 2 min |
| Compile + test | 3 min |
| Deploy | 2 min |
| Verify on Basescan | 5 min |
| Backend env wiring | 3 min |
| Smoke test (with founder approval for restart) | 10 min |
| **Total** | **~30 min** |
