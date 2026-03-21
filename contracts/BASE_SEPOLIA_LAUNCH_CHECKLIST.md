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

Compile and test:

```bash
npm run compile
npm test
```

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

## 7) Known Constraints for This Testnet Pack

- If provider wallet addresses are not registered, backend uses settlement fallback address.
- `cancelExpiredLock` is only valid after escrow expiry; immediate failure paths remain off-chain refunded first.
- Off-chain escrow tables remain source of truth unless explicitly switching billing policy.
