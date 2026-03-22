'use strict';

const fs = require('fs');
const path = require('path');

// Graceful fallback when ethers is not installed in backend package.
let ethers;
let EscrowABI;
try {
  ethers = require('ethers');
} catch (e) {
  try {
    ethers = require('../../../contracts/node_modules/ethers');
    console.warn('[escrow-chain] using ethers from contracts/node_modules');
  } catch (_) {
    console.warn('[escrow-chain] ethers not installed — on-chain escrow disabled');
  }
}

const ESCROW_ABI_PATH = path.resolve(__dirname, '../../../contracts/abis/Escrow.json');
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];
const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

function loadEscrowAbi() {
  if (!fs.existsSync(ESCROW_ABI_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(ESCROW_ABI_PATH, 'utf8'));
  } catch (err) {
    console.error('[escrow-chain] Failed to parse Escrow ABI JSON:', err.message);
    return null;
  }
}

/**
 * ChainEscrowService — on-chain escrow via Escrow.sol on Base Sepolia (DCP-75)
 *
 * Opt-in: only active when ESCROW_CONTRACT_ADDRESS env var is set.
 * Falls back silently if disabled or if any on-chain call fails.
 *
 * Contract pattern: consumer deposit → authorize → node createLock →
 *   job runs → claimLock (oracle-signed) → cancelExpiredLock if failed/expired
 */

// const { ethers } = require("ethers"); // moved to top with fallback
// const EscrowABI = require("../../contracts/abis/Escrow.json"); // moved to top with fallback

let _instance = null;

class ChainEscrowService {
  constructor() {
    this.enabled = !!(ethers && process.env.ESCROW_CONTRACT_ADDRESS && process.env.ESCROW_ORACLE_PRIVATE_KEY);

    if (!this.enabled) {
      if (process.env.ESCROW_CONTRACT_ADDRESS && !process.env.ESCROW_ORACLE_PRIVATE_KEY) {
        console.warn('[escrow-chain] ESCROW_CONTRACT_ADDRESS set but ESCROW_ORACLE_PRIVATE_KEY missing — on-chain escrow disabled');
      }
      return;
    }

    EscrowABI = loadEscrowAbi();
    if (!EscrowABI?.abi) {
      console.warn(`[escrow-chain] missing or invalid ABI at ${ESCROW_ABI_PATH} — on-chain escrow disabled`);
      this.enabled = false;
      return;
    }

    const rpcUrl = process.env.BASE_RPC_URL || 'https://sepolia.base.org';
    const txPrivateKey = process.env.ESCROW_TX_PRIVATE_KEY || process.env.ESCROW_ORACLE_PRIVATE_KEY;
    const usdcAddress = process.env.ESCROW_USDC_ADDRESS || EscrowABI.usdcAddress || BASE_SEPOLIA_USDC;

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.txWallet = new ethers.Wallet(txPrivateKey, this.provider);
    this.oracleWallet = new ethers.Wallet(process.env.ESCROW_ORACLE_PRIVATE_KEY);
    this.contract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS,
      EscrowABI.abi,
      this.txWallet
    );
    this.usdc = new ethers.Contract(usdcAddress, ERC20_ABI, this.txWallet);
    this.settlementProviderAddress = process.env.ESCROW_SETTLEMENT_PROVIDER_ADDRESS || this.txWallet.address;
    const configuredRelayer = process.env.ESCROW_RELAYER_ADDRESS;
    this.relayerAddress = ethers.isAddress(configuredRelayer || '')
      ? configuredRelayer
      : this.txWallet.address;
    this.usdcAddress = usdcAddress;

    console.log(
      `[escrow-chain] Enabled — contract=${process.env.ESCROW_CONTRACT_ADDRESS} ` +
      `tx=${this.txWallet.address} oracle=${this.oracleWallet.address} relayer=${this.relayerAddress} usdc=${usdcAddress} rpc=${rpcUrl}`
    );
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * Convert a string jobId to a stable bytes32 via keccak256.
   */
  _toBytes32(jobId) {
    return ethers.keccak256(ethers.toUtf8Bytes(jobId));
  }

  /**
   * Build oracle proof for claimLock.
   * The contract verifies: ECDSA.recover(toEthSignedMessageHash(keccak256(abi.encode(jobId32))), proof) == oracle
   */
  async _buildProof(jobId32, providerAddress, amount) {
    const packedHash = ethers.solidityPackedKeccak256(
      ['bytes32', 'address', 'uint256'],
      [jobId32, providerAddress, amount]
    );
    return this.oracleWallet.signMessage(ethers.getBytes(packedHash));
  }

  async _ensureAllowance(amount) {
    const allowance = await this.usdc.allowance(this.txWallet.address, this.contract.target);
    if (allowance >= amount) return;
    const tx = await this.usdc.approve(this.contract.target, ethers.MaxUint256);
    await tx.wait();
    console.log('[escrow-chain] approved USDC allowance for Escrow contract');
  }

  /**
   * Lock funds on-chain after off-chain escrow hold is created.
   *
   * @param {string} jobId          - DC1 job_id string
   * @param {string} providerAddress - Provider EVM address (or oracle address fallback on testnet)
   * @param {number} amountHalala   - Cost in halala (treated as smallest USDC unit on testnet)
   * @param {number} expiryMs       - Escrow expiry as Unix milliseconds
   * @returns {ethers.TransactionReceipt|null}
   */
  async depositAndLock(jobId, providerAddress, amountHalala, expiryMs) {
    if (!this.enabled) return null;
    try {
      const jobId32 = this._toBytes32(jobId);
      // Use configured settlement provider when provider has no EVM wallet.
      const toAddress = (providerAddress && ethers.isAddress(providerAddress))
        ? providerAddress
        : this.settlementProviderAddress;
      const amount = BigInt(amountHalala);
      const expiry = BigInt(Math.floor(expiryMs / 1000));

      await this._ensureAllowance(amount);
      const tx = await this.contract.depositAndLock(jobId32, toAddress, amount, expiry);
      const receipt = await tx.wait();
      console.log(`[escrow-chain] depositAndLock jobId=${jobId} provider=${toAddress} tx=${receipt.hash}`);
      return receipt;
    } catch (err) {
      console.error(`[escrow-chain] depositAndLock failed jobId=${jobId}:`, err.message);
      return null;
    }
  }

  /**
   * Claim locked funds for the provider after successful job completion.
   * Oracle signs the jobId to authorize release.
   *
   * @param {string} jobId - DC1 job_id string
   * @returns {ethers.TransactionReceipt|null}
   */
  async claimLock(jobId) {
    if (!this.enabled) return null;
    try {
      const jobId32 = this._toBytes32(jobId);
      const rec = await this.contract.getEscrow(jobId32);
      if (Number(rec.status) !== 1) {
        return null;
      }

      const proof = await this._buildProof(jobId32, rec.provider, rec.amount);
      const tx = await this.contract.claimLock(jobId32, proof);
      const receipt = await tx.wait();
      console.log(`[escrow-chain] claimLock jobId=${jobId} tx=${receipt.hash}`);
      return receipt;
    } catch (err) {
      console.error(`[escrow-chain] claimLock failed jobId=${jobId}:`, err.message);
      return null;
    }
  }

  /**
   * Cancel an expired or failed escrow lock, returning funds to the renter.
   *
   * @param {string} jobId - DC1 job_id string
   * @returns {ethers.TransactionReceipt|null}
   */
  async cancelExpiredLock(jobId) {
    if (!this.enabled) return null;
    try {
      const jobId32 = this._toBytes32(jobId);
      const rec = await this.contract.getEscrow(jobId32);
      if (Number(rec.status) !== 1) {
        return null;
      }
      const now = Math.floor(Date.now() / 1000);
      if (BigInt(rec.expiry) > BigInt(now)) {
        return null;
      }
      const tx = await this.contract.cancelExpiredLock(jobId32);
      const receipt = await tx.wait();
      console.log(`[escrow-chain] cancelExpiredLock jobId=${jobId} tx=${receipt.hash}`);
      return receipt;
    } catch (err) {
      console.error(`[escrow-chain] cancelExpiredLock failed jobId=${jobId}:`, err.message);
      return null;
    }
  }

  /**
   * Read escrow state for a job from the contract.
   *
   * @param {string} jobId - DC1 job_id string
   * @returns {{ renter, provider, amount, expiry, status }|null}
   */
  async getEscrow(jobId) {
    if (!this.enabled) return null;
    try {
      const jobId32 = this._toBytes32(jobId);
      const rec = await this.contract.getEscrow(jobId32);
      return {
        renter: rec.renter,
        provider: rec.provider,
        amount: rec.amount.toString(),
        expiry: rec.expiry.toString(),
        status: Number(rec.status) // 0=None,1=Held,2=Claimed,3=Cancelled
      };
    } catch (err) {
      console.error(`[escrow-chain] getEscrow failed jobId=${jobId}:`, err.message);
      return null;
    }
  }

  /**
   * Return service status for the admin endpoint.
   */
  async getStatus() {
    if (!this.enabled) {
      return { enabled: false, contractAddress: null, network: null, oracleAddress: null };
    }
    try {
      const network = await this.provider.getNetwork();
      return {
        enabled: true,
        contractAddress: process.env.ESCROW_CONTRACT_ADDRESS,
        network: `${network.name} (chainId: ${Number(network.chainId)})`,
        txAddress: this.txWallet.address,
        oracleAddress: this.oracleWallet.address,
        usdcAddress: this.usdcAddress,
        settlementProviderAddress: this.settlementProviderAddress,
        relayerAddress: this.relayerAddress,
      };
    } catch (err) {
      return {
        enabled: true,
        contractAddress: process.env.ESCROW_CONTRACT_ADDRESS,
        network: 'base-sepolia',
        txAddress: this.txWallet.address,
        oracleAddress: this.oracleWallet.address,
        usdcAddress: this.usdcAddress,
        settlementProviderAddress: this.settlementProviderAddress,
        relayerAddress: this.relayerAddress,
        error: err.message
      };
    }
  }
}

function getChainEscrow() {
  if (!ethers) {
    return {
      isEnabled: () => false,
      depositAndLock: async () => null,
      claimLock: async () => null,
      cancelExpiredLock: async () => null,
      getEscrow: async () => null,
      getStatus: async () => ({
        enabled: false,
        contractAddress: null,
        network: null,
        oracleAddress: null,
        relayerAddress: null,
      }),
    };
  }
  return _getChainEscrow();
}
function _getChainEscrow() {
  if (!_instance) {
    _instance = new ChainEscrowService();
  }
  return _instance;
}

module.exports = { getChainEscrow };
