# Base Sepolia Escrow — Launch Checklist

**Audience:** Engineer executing the first Base Sepolia escrow deployment
**Goal:** Deploy `Escrow.sol`, wire backend, run integration smoke test
**Time estimate:** 20–30 minutes from a funded wallet

---

## Prerequisites

Before you start, confirm all of these are true:

- [ ] Deployer wallet funded with **≥ 0.01 ETH** on Base Sepolia
      (faucet: https://www.alchemy.com/faucets/base-sepolia)
- [ ] You have the wallet private key (`PRIVATE_KEY`)
- [ ] You have generated or will generate an oracle key pair (`ORACLE_ADDRESS` + `ESCROW_ORACLE_PRIVATE_KEY`)
- [ ] Node.js ≥ 18 installed
- [ ] SSH / CLI access to backend environment

---

## Step 1 — Compile and Test Contracts (5 min)

```bash
cd /home/node/dc1-platform/contracts
npm install
npm run compile
npm test
```

Expected: all tests pass, no compilation errors.

---

## Step 2 — Configure Environment (2 min)

```bash
cd /home/node/dc1-platform/contracts
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Required
PRIVATE_KEY=<deployer wallet private key — must have ≥ 0.01 ETH on Base Sepolia>
ORACLE_ADDRESS=<public address of the oracle signer>

# Optional but recommended
BASESCAN_API_KEY=<from https://basescan.org/myapikey>
```

> **Oracle key generation** (if you don't have one):
> ```bash
> node -e "const {Wallet}=require('ethers');const w=Wallet.createRandom();console.log('address:',w.address,'privateKey:',w.privateKey)"
> ```
> Save `address` as `ORACLE_ADDRESS` and `privateKey` as `ESCROW_ORACLE_PRIVATE_KEY`.

---

## Step 3 — Deploy to Base Sepolia (5 min)

```bash
cd /home/node/dc1-platform/contracts
npm run deploy:sepolia
```

Expected output includes:
```
Escrow deployed to: 0x<CONTRACT_ADDRESS>
USDC address:       0x036CbD53842c5426634e7929541eC2318f3dCF7e
Oracle address:     0x<ORACLE_ADDRESS>
Chain ID:           84532
```

**Record the contract address — you need it in Step 4.**

---

## Step 4 — Verify on BaseScan (optional, 2 min)

```bash
cd /home/node/dc1-platform/contracts
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> \
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" \
  "<ORACLE_ADDRESS>"
```

Confirm at: `https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>#code`

---

## Step 5 — Wire Backend Environment (3 min)

Set these environment variables in the backend (PM2 ecosystem file or `.env.production`):

```env
# Required for on-chain escrow
ESCROW_CONTRACT_ADDRESS=<deployed contract address from Step 3>
ESCROW_ORACLE_PRIVATE_KEY=<oracle private key>
BASE_RPC_URL=https://sepolia.base.org

# Optional overrides
ESCROW_TX_PRIVATE_KEY=<separate tx sender key, defaults to ESCROW_ORACLE_PRIVATE_KEY>
ESCROW_SETTLEMENT_PROVIDER_ADDRESS=<fallback provider wallet if provider has no EVM address>
ESCROW_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

> **Deploy restriction:** Do NOT restart PM2 or apply env changes on production VPS without
> explicit written approval from the founder (Peter / setup@oida.ae). Create a
> "DEPLOY REQUEST" issue instead. See CLAUDE.md for the full rule.

---

## Step 6 — Runtime Validation (5 min)

After backend restart (with founder approval):

### 6a. Check escrow chain status

```bash
curl https://api.dcp.sa/api/admin/escrow-chain/status \
  -H "x-admin-token: $DC1_ADMIN_TOKEN"
```

Expected response:
```json
{
  "enabled": true,
  "contractAddress": "0x<CONTRACT_ADDRESS>",
  "oracleAddress": "0x<ORACLE_ADDRESS>",
  "chainId": 84532
}
```

### 6b. Submit a test job

Submit a minimal job via the API and observe backend logs for:
```
[escrow-chain] depositAndLock jobId=... tx=0x...
[escrow-chain] claimLock jobId=... tx=0x...
```

### 6c. Verify on-chain via Hardhat console

```bash
cd /home/node/dc1-platform/contracts
npx hardhat console --network base-sepolia
```

```js
const Escrow = await ethers.getContractAt("Escrow", "<CONTRACT_ADDRESS>");
const state = await Escrow.getEscrow(ethers.encodeBytes32String("<job_id>"));
console.log(state);
```

Expected: `status` field reflects `Settled` (2) after claimLock succeeds.

---

## Step 7 — Integration Test: deposit + claim (5 min)

```bash
# From contracts directory
npx hardhat run scripts/test-escrow-flow.js --network base-sepolia
```

If that script doesn't exist, run manually via console:
```js
// deposit 0.001 USDC-equivalent test
const jobId = ethers.encodeBytes32String("test-job-001");
const tx = await Escrow.deposit(jobId, 1000, { gasLimit: 200000 });
await tx.wait();
console.log("deposit tx:", tx.hash);
```

Verify the `Deposit` event is emitted on BaseScan.

---

## Step 8 — Update pending payment events (post-go-live)

Once escrow is live, the off-chain ledger can be synced. Check pending events:

```bash
curl https://api.dcp.sa/api/payments/pending \
  -H "x-admin-token: $DC1_ADMIN_TOKEN"
```

These are jobs completed before on-chain escrow was active. They need manual settlement
or a backfill script — coordinate with Backend Architect before running any batch operations.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `insufficient funds` on deploy | Wallet < 0.01 ETH | Top up via Base Sepolia faucet |
| `enabled: false` from status endpoint | Env vars not set or backend not restarted | Check PM2 env, request restart approval |
| `claimLock` fails with oracle error | Oracle address mismatch | Verify `ORACLE_ADDRESS` matches `ESCROW_ORACLE_PRIVATE_KEY` |
| BaseScan verification fails | Wrong constructor args | Re-run `npx hardhat verify` with correct USDC + oracle args |
| `depositAndLock` skipped in logs | `ESCROW_CONTRACT_ADDRESS` not set | Check backend env, look for `[escrow-sim]` log prefix |

---

## Rollback

If escrow misbehaves after go-live:

1. Remove `ESCROW_CONTRACT_ADDRESS` from backend env (request approval first)
2. Backend falls back to off-chain simulation automatically (`[escrow-sim]` log prefix)
3. All payment events remain in `payment_events` table for manual reconciliation
4. File a critical issue and notify founder immediately

---

*Last updated: 2026-03-24 — DCP-825*
