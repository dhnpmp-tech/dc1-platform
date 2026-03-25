# Base Sepolia Escrow Launch Checklist (DCP-441)

This checklist is for a testnet-executable escrow launch using `Escrow.sol` + backend `escrow-chain` bridge.

## 1) Required Secrets (must exist before deploy)

- `PRIVATE_KEY` (deployer wallet for contract deployment)
- `ORACLE_ADDRESS` (public address used to verify claim proofs on-chain)
- `ESCROW_ORACLE_PRIVATE_KEY` (private key that signs claim proofs in backend)
- `ESCROW_CONTRACT_ADDRESS` (filled after deploy; then set in backend env)

## 2) Optional Secrets / Config (recommended)

- `BASESCAN_API_KEY` (for `hardhat verify`)
- `USDC_ADDRESS` (override token address; default is Base Sepolia USDC)
- `ESCROW_TX_PRIVATE_KEY` (separate tx sender; defaults to `ESCROW_ORACLE_PRIVATE_KEY`)
- `ESCROW_SETTLEMENT_PROVIDER_ADDRESS` (fallback provider wallet when provider has no EVM address)
- `ESCROW_USDC_ADDRESS` (backend override; default Base Sepolia USDC)
- `BASE_RPC_URL` (RPC endpoint; default `https://sepolia.base.org`)

## 3) Preflight (contracts workspace)

```bash
cd /home/node/dc1-platform/contracts
cp .env.example .env
```

Fill `.env` with `PRIVATE_KEY`, `ORACLE_ADDRESS`, and (optionally) `BASESCAN_API_KEY`.

Compile and test — **`npm test` MUST pass before deploy**:

```bash
npm run compile
npm test
```

**Expected test output (104 tests):**
```
  Escrow — Integration
    USDC token interaction (4 tests) ✔
    EIP-712 signature security (5 tests) ✔
    75/25 fee split precision (4 tests) ✔
    multiple concurrent escrows (2 tests) ✔
    full lifecycle accounting (2 tests) ✔
    reentrancy guard (1 test) ✔
    admin — access control completeness (2 tests) ✔
  Escrow
    depositAndLock (6 tests) ✔
    claimLock (6 tests) ✔
    cancelExpiredLock (5 tests) ✔
    setOracle (3 tests) ✔
    setRelayer (3 tests) ✔
    getEscrow (1 test) ✔
    Edge cases — DCP-916 (6 tests) ✔
  JobAttestation (24 tests) ✔
  ProviderStake (14 tests) ✔

  104 passing (~4s)
```

**Coverage (Escrow.sol — last measured 2026-03-25):**
| File        | Statements | Branch | Functions | Lines |
|-------------|-----------|--------|-----------|-------|
| Escrow.sol  | 100%      | 87.5%  | 100%      | 100%  |

Run coverage locally: `npx hardhat coverage`

## 3a) Dry-Run Verification (safe — no transactions)

Run this at any time to validate your environment without spending ETH:

```bash
cd /home/node/dc1-platform
PRIVATE_KEY=0x<your-key> ORACLE_ADDRESS=0x<oracle-addr> node scripts/deploy-escrow-base-sepolia.mjs --dry-run
```

**Expected dry-run output:**
```
[DRY RUN] — No transactions will be broadcast.

────────────────────────────────────────────────────────────
DCP Escrow — Base Sepolia Deployment Preflight
────────────────────────────────────────────────────────────

1. Required environment variables:
  ✓ PRIVATE_KEY set (0xXXXXXX...XXXX)
  ✓ ORACLE_ADDRESS: 0x<oracle-addr>

2. Optional configuration:
  ✓ USDC_ADDRESS: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (default Circle USDC)
  ✓ BASE_RPC_URL: https://sepolia.base.org (default)
  ⚠ BASESCAN_API_KEY not set — contract verification will be manual

3. Contracts workspace:
  ✓ Escrow.sol found
  ✓ hardhat.config.js found

4. Dependencies:
  ✓ contracts/node_modules present

5. Wallet funding requirement:
  Minimum balance required: 0.01 SepoliaETH

6. Network configuration (hardhat.config.js):
  Network: base-sepolia
  Chain ID: 84532
  RPC URL: https://sepolia.base.org

Preflight PASSED — all checks satisfied.

[DRY RUN COMPLETE] All preflight checks passed.
Remove --dry-run flag and get founder approval before deploying.
```

⚠ **DO NOT deploy without explicit founder approval.** Create a `DEPLOY REQUEST` issue first.

## 4) Deploy Escrow.sol (Base Sepolia)

```bash
cd /home/node/dc1-platform/contracts
npm run deploy:sepolia
```

Expected output:
- deployed contract address
- updated `contracts/abis/Escrow.json` with `address`, `usdcAddress`, `oracleAddress`, `chainId`

Optional verification:

```bash
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> "<USDC_ADDRESS>" "<ORACLE_ADDRESS>"
```

## 5) Backend Env Wiring (PM2 app)

Set these env vars for backend runtime:

```bash
ESCROW_CONTRACT_ADDRESS=<deployed address>
ESCROW_ORACLE_PRIVATE_KEY=<oracle signer private key>
BASE_RPC_URL=https://sepolia.base.org
```

Optional:

```bash
ESCROW_TX_PRIVATE_KEY=<tx sender private key>
ESCROW_SETTLEMENT_PROVIDER_ADDRESS=<fallback provider wallet>
ESCROW_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## 5a) Frontend Integration (after deploy)

Add the deployed address to the Next.js frontend environment:

**`.env.local` (local dev) or Vercel environment settings (production):**
```bash
NEXT_PUBLIC_ESCROW_ADDRESS=<deployed contract address>
NEXT_PUBLIC_BASE_CHAIN_ID=84532
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
```

**Vercel dashboard steps:**
1. Go to dcp.sa project → Settings → Environment Variables
2. Add `NEXT_PUBLIC_ESCROW_ADDRESS` = `<deployed address>`
3. Add `NEXT_PUBLIC_BASE_CHAIN_ID` = `84532`
4. Trigger a redeploy (or wait for next push to main)

**Verification:** The renter checkout flow should show the on-chain escrow option
when `NEXT_PUBLIC_ESCROW_ADDRESS` is set.

## 6) Runtime Validation (after backend restart)

1. `GET /api/admin/escrow-chain/status` should return:
   - `enabled: true`
   - expected `contractAddress`
   - expected `oracleAddress`
2. Submit a small renter job with on-chain escrow enabled.
3. Confirm logs show:
   - `depositAndLock jobId=... tx=...`
   - `claimLock jobId=... tx=...` (success path) or skip warnings with actionable reason.
4. On-chain inspect with `getEscrow(jobId32)` from a console script if needed.

## 7) Gas Estimates (measured locally — DCP-957, 2026-03-25)

Run against a Hardhat local network with optimizer enabled (200 runs):

| Operation                    | Gas Used  | Est. cost @ 0.001 gwei, ETH=$2,500 |
| ---------------------------- | --------- | ----------------------------------- |
| Escrow.sol deployment        | 1,431,216 | ~$0.004 USD                         |
| `depositAndLock`             | 152,253   | ~$0.0004 USD                        |
| `claimLock` (provider)       | 102,892   | ~$0.0003 USD                        |
| `cancelExpiredLock` (renter) | 47,011    | ~$0.0001 USD                        |
| `setOracle` (admin)          | 30,685    | ~$0.0001 USD                        |
| `setRelayer` (admin)         | 30,708    | ~$0.0001 USD                        |

**Deployer wallet funding requirement:**
Base Sepolia deployment gas: ~1.43M gas. At a safe gas price of 0.01 gwei:
- `1,431,216 * 0.01e-9 ETH = ~0.0000143 ETH`
- Recommended minimum: **0.01 SepoliaETH** (covers deployment + test transactions)
- Get SepoliaETH free from: https://faucet.quicknode.com/base/sepolia or https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

**To reproduce locally:**
```bash
cd /home/node/dc1-platform/contracts
node scripts/escrow-gas-estimate.mjs
```

## 8) Known Constraints for This Testnet Pack

- If provider wallet addresses are not registered, backend uses settlement fallback address.
- `cancelExpiredLock` is only valid after escrow expiry; immediate failure paths remain off-chain refunded first.
- Off-chain escrow tables remain source of truth unless explicitly switching billing policy.
