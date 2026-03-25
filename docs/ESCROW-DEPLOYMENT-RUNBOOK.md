# DCP Escrow Deployment Runbook

**Target:** Base Sepolia testnet → Base mainnet (when audited)
**Contract:** `contracts/contracts/Escrow.sol` (EIP-712, USDC, 25% platform fee)
**Goal:** Any engineer can complete deployment in under 30 minutes using this document.

---

## Prerequisites

| Requirement | Value |
|---|---|
| Node.js | ≥ 18.0.0 |
| Wallet balance | **≥ 0.01 SepoliaETH** (gas for deploy + verification) |
| USDC | Base Sepolia USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| RPC | `https://sepolia.base.org` (default, no key needed) |

Get free SepoliaETH from: `https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet`

---

## Step 1 — Prepare Secrets

```bash
cd /home/node/dc1-platform/contracts
cp .env.example .env
```

Edit `.env` and fill in:

```env
# REQUIRED
PRIVATE_KEY=0x<deployer-wallet-private-key>
ORACLE_ADDRESS=0x<dc1-backend-signing-address>

# RECOMMENDED
BASESCAN_API_KEY=<basescan-api-key>  # for source verification

# OPTIONAL (backend runtime — fill after deploy)
ESCROW_CONTRACT_ADDRESS=             # fill after Step 3
ESCROW_ORACLE_PRIVATE_KEY=<same-key-as-oracle-or-separate>
```

**Oracle address** is the public address of the key DCP backend uses to sign job-completion proofs.
Derive it from `ESCROW_ORACLE_PRIVATE_KEY` using:
```bash
node -e "const {ethers}=require('ethers'); console.log(new ethers.Wallet('<ESCROW_ORACLE_PRIVATE_KEY>').address)"
```

---

## Step 2 — Compile and Test

```bash
cd /home/node/dc1-platform/contracts
npm run compile
npm test
```

Expected: all tests pass, no compilation errors.

If `node_modules` is missing:
```bash
npm ci
```

---

## Step 3 — Deploy to Base Sepolia

```bash
cd /home/node/dc1-platform/contracts
npm run deploy:sepolia
```

Expected output:
```
─────────────────────────────────────────
DC1 Escrow Deployment
─────────────────────────────────────────
Network   : base-sepolia (chainId 84532)
Deployer  : 0x<your-address>
Balance   : 0.0XX ETH

USDC address : 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Oracle address: 0x<oracle-address>

Deploying Escrow.sol...

✓ Escrow deployed to: 0x<CONTRACT_ADDRESS>
✓ ABI + address exported to contracts/abis/Escrow.json
```

**Copy the contract address.** You will need it for backend wiring and Basescan verification.

---

## Step 4 — Verify on Basescan (Optional but Recommended)

```bash
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> "0x036CbD53842c5426634e7929541eC2318f3dCF7e" "<ORACLE_ADDRESS>"
```

View contract on: `https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>`

---

## Step 5 — Wire Backend Environment

On the VPS (76.13.179.86), update the PM2 environment for `dc1-provider-onboarding`:

```bash
# These vars must be set in the backend process environment
ESCROW_CONTRACT_ADDRESS=<deployed-address-from-step-3>
ESCROW_ORACLE_PRIVATE_KEY=<oracle-signing-key>
BASE_RPC_URL=https://sepolia.base.org

# Optional overrides
ESCROW_TX_PRIVATE_KEY=<tx-sender-key>         # separate tx sender; defaults to oracle key
ESCROW_SETTLEMENT_PROVIDER_ADDRESS=<fallback> # fallback when provider has no EVM wallet
ESCROW_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

> **Note:** Do NOT restart PM2 without founder approval. See CLAUDE.md deployment rules.
> Create a DEPLOY REQUEST issue and wait for approval before running `pm2 restart`.

---

## Step 6 — Validate After Backend Restart

Once founder approves and PM2 is restarted:

```bash
# 1. Check escrow chain status
curl -s https://api.dcp.sa/api/admin/escrow-chain/status

# Expected response:
# { "enabled": true, "contractAddress": "0x<CONTRACT_ADDRESS>", "oracleAddress": "0x<ORACLE_ADDRESS>" }
```

```bash
# 2. Submit a small test job with on-chain escrow and watch logs
pm2 logs dc1-provider-onboarding --lines 50

# Expected log lines:
# depositAndLock jobId=... tx=0x...
# claimLock jobId=... tx=0x...   (success path)
```

```bash
# 3. Inspect escrow on-chain (optional)
node -e "
const {ethers} = require('ethers');
const abi = require('./contracts/abis/Escrow.json').abi;
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const contract = new ethers.Contract('<CONTRACT_ADDRESS>', abi, provider);
contract.getEscrow(ethers.encodeBytes32String('<JOB_UUID>')).then(console.log);
"
```

---

## Step 7 — Update Frontend (if applicable)

If the frontend reads the contract address from an env var or config file, update:

```env
# frontend/.env.local or Vercel dashboard
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=<CONTRACT_ADDRESS>
NEXT_PUBLIC_BASE_CHAIN_ID=84532
```

Redeploy frontend via Vercel if the address is baked in at build time.

---

## Rollback Procedure

The Escrow contract has **no upgrade mechanism** (immutable by design). If a critical bug is found:

1. **Do not restart backend with the buggy contract address.**
2. Set `ESCROW_CONTRACT_ADDRESS=` (empty) in backend env to disable on-chain escrow.
3. All payments fall back to the existing off-chain escrow system.
4. Deploy a fixed contract using this runbook and repeat Steps 3–6.

There is no pause/kill switch in the deployed contract. Funds already locked in a buggy contract can still be recovered:
- Provider calls `claimLock` with valid oracle proof (success path).
- Renter calls `cancelExpiredLock` after expiry (refund path).
- Owner/relayer can call either as fallback.

---

## Key Contract Facts for Support Reference

| Parameter | Value |
|---|---|
| Platform fee | 25% (2500 BPS) |
| Provider share | 75% |
| Payment token | USDC (6 decimals) |
| Signature scheme | EIP-712 typed data |
| Claim typehash | `Claim(bytes32 jobId,address provider,uint256 amount)` |
| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Chain ID | 84532 (Sepolia) |

---

## Checklist Summary

- [ ] Deployer wallet has ≥ 0.01 SepoliaETH
- [ ] `.env` has `PRIVATE_KEY` and `ORACLE_ADDRESS` set
- [ ] `npm run compile` passes with no errors
- [ ] `npm test` passes
- [ ] `npm run deploy:sepolia` succeeds — contract address noted
- [ ] `contracts/abis/Escrow.json` updated with new address
- [ ] Basescan verification submitted (optional)
- [ ] Founder approved backend env update
- [ ] Backend restarted with new `ESCROW_CONTRACT_ADDRESS`
- [ ] `/api/admin/escrow-chain/status` returns `enabled: true`
- [ ] End-to-end test job completes successfully

---

*Document owner: Blockchain Engineer | Last updated: 2026-03-25 | Ref: DCP-953*
