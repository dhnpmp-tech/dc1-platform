# Escrow.sol — Deployment Runbook

> **Status**: Ready to deploy. Blocked on funded `PRIVATE_KEY` wallet.
> **Contract**: `contracts/contracts/Escrow.sol`
> **Target network**: Base Sepolia (chainId 84532)
> **Estimated time once wallet is funded**: ~2 minutes

---

## Prerequisites

| Requirement | Detail |
|---|---|
| Node.js | ≥ 18.0.0 |
| `PRIVATE_KEY` | Deployer wallet private key — must have ≥ 0.01 SepoliaETH |
| `ORACLE_ADDRESS` | DCP backend signing address (the wallet whose private key signs job-completion proofs) |
| `BASESCAN_API_KEY` | Optional — only needed for contract verification on Basescan |

### Get testnet ETH

Fund the deployer wallet at one of these faucets:
- https://sepoliafaucet.com (requires Alchemy account)
- https://faucet.quicknode.com/base/sepolia
- https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

---

## Environment Setup

Create `contracts/.env` (copy from `contracts/.env.example` if present):

```bash
# Required
PRIVATE_KEY=0xabc123...          # deployer wallet private key
ORACLE_ADDRESS=0xDEF456...       # DCP backend signing address

# Optional — for Basescan verification
BASESCAN_API_KEY=your_key_here
```

> **Security**: Never commit `.env` to git. It is already in `.gitignore`.

---

## Deploy

```bash
cd contracts/
# Install Hardhat dependencies (local dev only — do NOT run on VPS)
npm ci --include=dev
npm run deploy:sepolia
```

This runs `npx hardhat run scripts/deploy.js --network base-sepolia`.

### Expected output

```
─────────────────────────────────────────
DCP Escrow Deployment
─────────────────────────────────────────
Network   : base-sepolia (chainId 84532)
Deployer  : 0xYOUR_ADDRESS
Balance   : 0.05 ETH

USVC address : 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Oracle address: 0xORACLE_ADDRESS

Deploying Escrow.sol...

✓ Escrow deployed to: 0xNEW_CONTRACT_ADDRESS
✓ ABI + address exported to contracts/abis/Escrow.json
─────────────────────────────────────────
```

---

## Post-Deploy Steps

### 1. Record the contract address

The deploy script writes the address automatically to `contracts/abis/Escrow.json`. Verify it:

```bash
node -e "const d=require('./abis/Escrow.json'); console.log('Deployed:', d.address, 'on', d.network)"
```

### 2. Update environment variables

Add to `.env.example` (and real `.env` files on VPS and Vercel):

```bash
# Escrow contract
ESCROW_CONTRACT_ADDRESS=0xNEW_CONTRACT_ADDRESS

# Frontend (Next.js public vars)
NEXT_PUBLIC_ESCROW_ADDRESS=0xNEW_CONTRACT_ADDRESS
NEXT_PUBLIC_BASE_CHAIN_ID=84532
```

### 3. Verify on Basescan (optional but recommended)

```bash
cd contracts/
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> "0x036CbD53842c5426634e7929541eC2318f3dCF7e" "<ORACLE_ADDRESS>"
```

View verified contract at: `https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>`

---

## Contract Parameters (fixed at deploy)

| Parameter | Value |
|---|---|
| USDC (Base Sepolia) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Fee | 2500 BPS = 25% to DCP owner |
| Oracle | Set at deploy, updatable by owner via `setOracle()` |
| Solidity version | 0.8.27, evmVersion: cancun |

---

## Monitoring (VPS Health + Telegram)

`scripts/vps-health.sh` now sends Telegram alerts to chat `7652446182` when any threshold is breached:
- CPU usage > 85%
- Disk usage (`/`) > 80%
- Memory usage > 90%
- Any PM2 process is not `ONLINE`

### Alert Idempotency

The script uses lockfile `/tmp/dcp-vps-health-alert.lock` and suppresses repeated alerts for 30 minutes.

### Environment Variable

Set this in PM2 env before enabling cron:

```bash
TELEGRAM_BOT_TOKEN=<your_bot_token>
```

### PM2 Cron Scheduling

`backend/ecosystem.config.js` includes `dcp-vps-health-cron`, scheduled every 10 minutes:

```bash
name: dcp-vps-health-cron
script: /bin/bash
args: -lc "/root/dc1-platform/scripts/vps-health.sh >> /root/dc1-platform/backend/logs/vps-health.log 2>&1"
cron_restart: */10 * * * *
autorestart: false
```

Apply/reload PM2 config:

```bash
cd backend
pm2 startOrReload ecosystem.config.js --only dcp-vps-health-cron
pm2 save
```

Verify latest health checks:

```bash
tail -n 100 /root/dc1-platform/backend/logs/vps-health.log
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| `insufficient funds` | Fund deployer wallet with SepoliaETH |
| `PRIVATE_KEY not set` | Ensure `.env` is present in `contracts/` directory |
| `nonce too low` | A prior transaction is pending; wait for it to confirm |
| `Cannot find module 'hardhat'` | Run `npm ci --include=dev` inside `contracts/` (local dev only) |
| Verification fails | Ensure `BASESCAN_API_KEY` is set and constructor args match exactly |

---

## What Not To Do

- **Do NOT deploy to Base mainnet** — the mainnet network config is commented out in `hardhat.config.js` until a security audit is complete.
- **Do NOT use the deployer wallet as oracle in production** — set a dedicated DCP backend signing wallet as `ORACLE_ADDRESS`.
- **Do NOT commit `.env`** — contains the private key.
