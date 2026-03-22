# DC1 Smart Contracts — Escrow on Base L2

Trustless payment escrow for DC1 GPU compute jobs. USDC is held on-chain while jobs run; providers claim funds on completion; renters get refunded if jobs expire unclaimed.

**Network**: Base Sepolia (testnet) / Base mainnet (future)
**Token**: USDC (6 decimals)
**Fee split**: 75 % provider / 25 % DC1 (hardcoded as `FEE_BPS = 2500`)

---

## Contract Architecture

### `Escrow.sol`

| Function | Caller | Description |
|---|---|---|
| `depositAndLock(jobId, provider, amount, expiry)` | Renter | Pulls USDC from renter and locks it against a jobId |
| `claimLock(jobId, proof)` | Provider / authorized relayer / owner | Claims after job completes; verifies DC1 oracle ECDSA signature |
| `cancelExpiredLock(jobId)` | Renter / authorized relayer / owner | Reclaims full amount if job expired without a claim |
| `getEscrow(jobId)` | Anyone | Read-only: returns `EscrowRecord` struct |
| `setOracle(address)` | Owner | Updates the DC1 oracle signing address |
| `setRelayer(address)` | Owner | Updates the backend relayer/operator address used for service-initiated settlement |

#### EscrowRecord struct

```solidity
struct EscrowRecord {
    address renter;
    address provider;
    uint256 amount;      // USDC micro-units (6 decimals)
    uint256 expiry;      // Unix timestamp
    EscrowStatus status; // EMPTY(0) | LOCKED(1) | CLAIMED(2) | CANCELLED(3)
}
```

#### Oracle proof format

The DC1 backend signs job completion using its private key. The proof is an EIP-191 personal signature over:

```
keccak256(abi.encodePacked(jobId, providerAddress, amount))
```

The backend constructs this in `backend/src/services/escrow.js` (future issue) using ethers.js:

```js
const messageHash = ethers.solidityPackedKeccak256(
  ["bytes32", "address", "uint256"],
  [jobId, providerAddress, amount]
);
const proof = await oracleWallet.signMessage(ethers.getBytes(messageHash));
```

### `MockUSDC.sol`

Test-only ERC20 token with 6 decimals and open `mint()`. **Do not deploy to mainnet.**

---

## Setup

```bash
cd contracts
npm install
```

---

## Running Tests

Tests use Hardhat's local in-process EVM — no external RPC needed.

```bash
npm test
# or with gas report:
npm run test:gas
```

### What the tests cover

| Suite | Tests |
|---|---|
| `depositAndLock` | happy path, duplicate jobId, past expiry, zero amount, zero provider |
| `claimLock` | 75/25 split, operator claim, invalid oracle sig, wrong caller, post-expiry, double-claim |
| `cancelExpiredLock` | happy path, relayer cancel, pre-expiry revert, wrong caller, double-cancel |
| `setOracle` | owner update, non-owner revert, zero-address revert |
| `setRelayer` | owner update, non-owner revert, zero-address revert |
| `getEscrow` | unknown jobId returns EMPTY |

---

## Deploying to Base Sepolia

For an operator-friendly runbook, use `contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md`.

1. **Copy and fill env vars**

   ```bash
   cp .env.example .env
   # Edit .env: PRIVATE_KEY, USDC_ADDRESS, ORACLE_ADDRESS, BASESCAN_API_KEY
   ```

2. **Compile**

   ```bash
   npm run compile
   ```

3. **Deploy**

   ```bash
   npm run deploy:sepolia
   ```

   The script writes `abis/Escrow.json` with deployed metadata (`address`, `usdcAddress`, `oracleAddress`, `chainId`, `abi`).

4. **Verify on Basescan** (optional)

   ```bash
   npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> "<USDC_ADDRESS>" "<ORACLE_ADDRESS>"
   ```

### Base Sepolia addresses

| Token | Address |
|---|---|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Get testnet ETH from the [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet).

---

## Backend Integration Plan

The Express.js backend already contains an opt-in chain bridge at `backend/src/services/escrow-chain.js`.
When `ESCROW_CONTRACT_ADDRESS` and `ESCROW_ORACLE_PRIVATE_KEY` are set, job routes call the contract in fire-and-forget mode.

Recommended backend envs:

- `ESCROW_CONTRACT_ADDRESS` (required)
- `ESCROW_ORACLE_PRIVATE_KEY` (required, signs completion proof)
- `ESCROW_TX_PRIVATE_KEY` (optional, tx sender; defaults to oracle key)
- `ESCROW_SETTLEMENT_PROVIDER_ADDRESS` (optional fallback provider wallet when provider has no EVM wallet)
- `ESCROW_RELAYER_ADDRESS` (optional; operator address authorized to claim/cancel when wallet addresses are routed through backend)
- `ESCROW_USDC_ADDRESS` (optional; defaults to Base Sepolia USDC)
- `BASE_RPC_URL` (optional; defaults to `https://sepolia.base.org`)

Current launch workflow:

1. Backend sender wallet funds and approves USDC, then calls `depositAndLock`.
2. On success completion paths, backend signs proof and calls `claimLock` (provider or relayer can submit).
3. On failure/timeout paths, backend attempts `cancelExpiredLock` once expiry is reached (renter or relayer can submit).

The current off-chain SQL escrow (DCP-32) remains the default. The on-chain path is opt-in for renters who want trustless settlement.

---

## Security Notes

- Contract owner receives the 25% fee — set owner to a DC1 multisig before mainnet
- `oracle` private key must be kept secret; rotate via `setOracle()` if compromised
- Expiry should be at least `job_estimated_duration + buffer` — set in the backend
- No upgradeability — contract is immutable by design; re-deploy for fixes
- **Do not deploy to mainnet without a professional audit**

---

## File Structure

```
contracts/
├── contracts/
│   ├── Escrow.sol       — main escrow contract
│   └── MockUSDC.sol     — test-only ERC20
├── scripts/
│   └── deploy.js        — Hardhat deploy + ABI export
├── test/
│   └── Escrow.test.js   — full test suite
├── abis/
│   └── Escrow.json      — ABI + deployed address (consumed by backend)
├── hardhat.config.js
├── package.json
├── .env.example
└── README.md            — you are here
```
