# Wallet Integration Checklist — Escrow Go-Live

> **DCP-836** | Blockchain Engineer | 2026-03-24
> **Status:** Ready — waiting on founder wallet funding
> **Related:** DCP-836 (SAR rails spec), contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md, contracts/contracts/Escrow.sol
> **Estimated time from funded wallet to live escrow: ~30 minutes**

---

## TL;DR

Everything is built. The contract is written, tested, and deployment-ready. The backend integration is complete. The only blocker is a funded wallet. When the founder provides a wallet with ≥ 0.01 SepoliaETH, this checklist takes ~30 minutes to execute.

---

## Pre-Flight State (as of 2026-03-24)

| Component | Status |
|-----------|--------|
| `Escrow.sol` — written, reviewed | ✅ Done |
| Hardhat config for `base-sepolia` | ✅ Done |
| Deploy script (`contracts/scripts/deploy.js`) | ✅ Done |
| ABI export (`contracts/abis/Escrow.json`) | ✅ Done (populated after deploy) |
| Backend `escrow-chain.js` service | ✅ Done |
| Backend env var wiring (`escrow-chain.js` reads from `process.env`) | ✅ Done |
| Verification smoke test script | ✅ Done (`scripts/phase1-e2e-smoke.mjs`) |
| Funded deployer wallet | ❌ **BLOCKED — requires founder action** |
| Oracle signing keypair | ❌ **BLOCKED — requires founder action** |
| Backend env vars staged on VPS | ❌ Not yet (blocked on wallet) |
| Contract deployed to Base Sepolia | ❌ Not yet (blocked on wallet) |

---

## Step 1 — Fund Deployer Wallet (~5 minutes)

The deployer wallet is the Ethereum address that will:
- Pay gas for contract deployment (~0.0002 SepoliaETH)
- Become the `owner` of `Escrow.sol` (receives DCP's 25% fee share)
- Be stored as `PRIVATE_KEY` in the contracts `.env` (never committed to git)

**Option A — Use the DC1 treasury wallet (recommended):**
- The same wallet that receives platform fees should own the contract
- Fund with ≥ 0.01 SepoliaETH from Base Sepolia faucet

**Option B — Create a fresh wallet:**
```bash
node -e "
const {ethers} = require('./contracts/node_modules/ethers');
const w = ethers.Wallet.createRandom();
console.log('Address:', w.address);
console.log('Private key:', w.privateKey);
console.log('Mnemonic:', w.mnemonic.phrase);
"
```
Store the private key and mnemonic in a password manager. Never commit to git.

**Get free Base Sepolia ETH:**
- Quicknode faucet: https://faucet.quicknode.com/base/sepolia (requires account, 0.05 ETH/day)
- Coinbase faucet: https://coinbase.com/faucets/base-ethereum-goerli-faucet
- Alchemy faucet: https://basefaucet.com

**Verify balance:**
```bash
node -e "
const {ethers} = require('./contracts/node_modules/ethers');
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
provider.getBalance('<YOUR_WALLET_ADDRESS>').then(b => console.log('Balance:', ethers.formatEther(b), 'ETH'));
"
```

---

## Step 2 — Generate Oracle Signing Keypair (~2 minutes)

The oracle keypair is used by the DCP backend to sign job completion proofs. The `Escrow.sol` contract verifies these signatures before releasing funds to providers.

```bash
node -e "
const {ethers} = require('./contracts/node_modules/ethers');
const w = ethers.Wallet.createRandom();
console.log('=== ORACLE KEYPAIR ===');
console.log('ORACLE_ADDRESS:', w.address);
console.log('ESCROW_ORACLE_PRIVATE_KEY:', w.privateKey);
console.log('Store the private key in your password manager. NEVER commit to git.');
"
```

**Security rules:**
- `ORACLE_ADDRESS` — safe to share, goes in contract constructor (embedded on-chain)
- `ESCROW_ORACLE_PRIVATE_KEY` — treat like a production secret, store in password manager
- This is a hot signing key (backend uses it per-job). Use a dedicated keypair, not the deployer wallet.

---

## Step 3 — Configure Contracts `.env` (~2 minutes)

```bash
cd /home/node/dc1-platform/contracts
cp .env.example .env
```

Edit `.env`:
```bash
# Required
PRIVATE_KEY=<deployer wallet private key from Step 1>
ORACLE_ADDRESS=<oracle address from Step 2>

# Optional but recommended
BASESCAN_API_KEY=<your Basescan API key for contract verification>
# Get free at: https://basescan.org/myapikey
```

**Do not add `ESCROW_ORACLE_PRIVATE_KEY` to this file** — it belongs only in the backend environment.

---

## Step 4 — Compile and Test (~3 minutes)

```bash
cd /home/node/dc1-platform/contracts
npm install  # if node_modules not present
npm run compile
npm test
```

Expected output:
```
Compiled 5 Solidity files successfully

  DC1 Escrow
    Deployment
      ✓ should deploy with correct USDC and oracle
      ✓ should set relayer to deployer
    depositAndLock
      ✓ should lock USDC for a job
      ✓ should reject zero amount
      ✓ should reject duplicate jobId
      ...

  18 passing (2s)
```

**If tests fail:** Do not proceed. Check Solidity compiler version and OpenZeppelin imports.

---

## Step 5 — Deploy to Base Sepolia (~2 minutes)

```bash
cd /home/node/dc1-platform/contracts
npm run deploy:sepolia
```

Expected output:
```
DC1 Escrow Deployment
Network   : base-sepolia (chainId 84532)
Deployer  : 0x<DEPLOYER_ADDRESS>
Balance   : 0.0X ETH
USDC address : 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Oracle address: 0x<ORACLE_ADDRESS>
Deploying Escrow.sol...
✓ Escrow deployed to: 0x<CONTRACT_ADDRESS>
✓ ABI + address exported to contracts/abis/Escrow.json
```

**Record the `CONTRACT_ADDRESS`.** This is needed for Step 7.

**Verify deployment on Basescan:**
```
https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>
```

---

## Step 6 — Optional: Verify Contract on Basescan (~5 minutes)

Verification publishes the Solidity source code publicly, enabling trust audits.

```bash
cd /home/node/dc1-platform/contracts
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> \
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" \
  "<ORACLE_ADDRESS>"
```

Expected output:
```
Successfully verified contract Escrow on Etherscan
https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>#code
```

---

## Step 7 — Stage Backend Environment Variables (~3 minutes)

The following env vars must be set in the backend runtime (PM2 ecosystem file or server environment).

**⚠️ IMPORTANT: Per CLAUDE.md, no backend restarts without founder approval. Stage these vars and create a deploy request issue before applying.**

Add to PM2 environment for `dc1-provider-onboarding` service:

```bash
ESCROW_CONTRACT_ADDRESS=0x<deployed address from Step 5>
ESCROW_ORACLE_PRIVATE_KEY=<oracle private key from Step 2>
BASE_RPC_URL=https://sepolia.base.org
ESCROW_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Optional (for advanced configuration):
```bash
ESCROW_TX_PRIVATE_KEY=<separate tx sender key, defaults to oracle key>
ESCROW_SETTLEMENT_PROVIDER_ADDRESS=<fallback provider wallet if provider has no EVM address>
ESCROW_MIN_JOB_VALUE_HALALA=10000  # min job value for on-chain escrow (~100 SAR = ~26 USDC)
```

**To stage without applying (safe — no restart required):**
```bash
# Add to ecosystem.config.js on VPS (requires founder approval to restart)
# Or export as environment variables (takes effect on next restart)
export ESCROW_CONTRACT_ADDRESS=0x<ADDRESS>
export ESCROW_ORACLE_PRIVATE_KEY=<KEY>
export BASE_RPC_URL=https://sepolia.base.org
```

---

## Step 8 — Create Deploy Request Issue

Per CLAUDE.md mandatory policy, create an issue before any VPS changes:

**Title:** `DEPLOY REQUEST: Enable escrow-chain service with Base Sepolia contract`

**Body:**
```
Contract deployed: 0x<ADDRESS> (Base Sepolia, chainId 84532)
Commands to run on VPS (require founder approval):
  1. pm2 set dc1-provider-onboarding ESCROW_CONTRACT_ADDRESS 0x<ADDRESS>
  2. pm2 set dc1-provider-onboarding ESCROW_ORACLE_PRIVATE_KEY <KEY>
  3. pm2 set dc1-provider-onboarding BASE_RPC_URL https://sepolia.base.org
  4. pm2 restart dc1-provider-onboarding
  5. curl https://api.dcp.sa/api/admin/escrow-chain/status  (verify)
Expected: enabled: true in response
No database migrations required.
```

**Priority:** critical
**Assignee:** Founding Engineer (DCP-524 owner)

---

## Step 9 — Validate Escrow Service (~5 minutes)

After backend restart (with founder approval):

```bash
# Health check
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

If `enabled: false`, check:
1. `ESCROW_CONTRACT_ADDRESS` is set in PM2 env
2. `ESCROW_ORACLE_PRIVATE_KEY` is set in PM2 env
3. `contracts/abis/Escrow.json` exists and has `.abi` and `.address` fields
4. Backend logs for `[escrow-chain]` warning messages

---

## Step 10 — Run End-to-End Smoke Test (~10 minutes)

```bash
cd /home/node/dc1-platform
node scripts/phase1-e2e-smoke.mjs
```

This script (created by QA Engineer in Sprint 26) verifies the full flow:
1. Creates a test job
2. Calls `depositAndLock()` with 1 USDC test amount
3. Backend oracle signs a completion proof
4. Relayer calls `claimLock()`
5. Verifies 75% USDC reached provider wallet, 25% reached DCP treasury
6. Verifies `job_settlements` row matches on-chain amounts

**If smoke test fails:**
- Check relayer wallet has ETH for gas
- Check USDC approval: relayer must `approve()` escrow contract before `depositAndLock()`
- Review backend logs: `pm2 logs dc1-provider-onboarding --lines 100`

---

## Quick Reference — Key Addresses and Values

| Parameter | Value | Notes |
|-----------|-------|-------|
| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Official Circle testnet USDC |
| Base Sepolia Chain ID | `84532` | |
| Base Sepolia RPC | `https://sepolia.base.org` | Public, no API key needed |
| Basescan (testnet) | `https://sepolia.basescan.org` | |
| DCP fee in contract | 25% (2500 BPS) | Hardcoded, cannot change without redeploy |
| Gas per `depositAndLock` | ~80,000 L2 gas | ~$0.01 on mainnet |
| Minimum ETH in relayer | 0.01 ETH | Keep topped up for gas |

---

## Summary Timeline

| Step | Action | Duration | Who |
|------|--------|----------|-----|
| 1 | Fund deployer wallet | 5 min | Founder |
| 2 | Generate oracle keypair | 2 min | Blockchain Engineer |
| 3 | Configure `.env` | 2 min | Blockchain Engineer |
| 4 | Compile & test | 3 min | Blockchain Engineer |
| 5 | Deploy to Base Sepolia | 2 min | Blockchain Engineer |
| 6 | Verify on Basescan | 5 min | Blockchain Engineer |
| 7 | Stage backend env vars | 3 min | Founding Engineer |
| 8 | Create deploy request | 2 min | Blockchain Engineer |
| 9 | Restart backend (founder approval) | 2 min | Founding Engineer |
| 10 | Run smoke test | 10 min | QA Engineer |
| **Total** | | **~36 min** | |

**Single blocker:** Founder provides a funded wallet (Step 1). Everything else is ready.

---

*Related: `contracts/contracts/Escrow.sol`, `backend/src/services/escrow-chain.js`, `docs/blockchain/sar-payment-rails-spec.md`, `contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md`*
*Last updated: 2026-03-24 — DCP-836*
