'use strict';

// Graceful fallback when ethers is not installed
let ethers, EscrowABI;
try {
  ethers = require('ethers');
  EscrowABI = require('../../contracts/abis/Escrow.json');
} catch (e) {
  console.warn('[escrow-chain] ethers not installed — on-chain escrow disabled');
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
    this.enabled = !!(process.env.ESCROW_CONTRACT_ADDRESS && process.env.ESCROW_ORACLE_PRIVATE_KEY);

    if (!this.enabled) {
      if (process.env.ESCROW_CONTRACT_ADDRESS && !process.env.ESCROW_ORACLE_PRIVATE_KEY) {
        console.warn('[escrow-chain] ESCROW_CONTRACT_ADDRESS set but ESCROW_ORACLE_PRIVATE_KEY missing — on-chain escrow disabled');
      }
      return;
    }

    const rpcUrl = process.env.BASE_RPC_URL || 'https://sepolia.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(process.env.ESCROW_ORACLE_PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS,
      EscrowABI.abi,
      this.wallet
    );

    console.log(
      `[escrow-chain] Enabled — contract=${process.env.ESCROW_CONTRACT_ADDRESS} ` +
      `oracle=${this.wallet.address} rpc=${rpcUrl}`
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
  async _buildProof(jobId32) {
    const msgHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [jobId32])
    );
    return this.wallet.signMessage(ethers.getBytes(msgHash));
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
      // Use oracle address as fallback provider address on testnet when provider has no EVM wallet
      const toAddress = (providerAddress && ethers.isAddress(providerAddress))
        ? providerAddress
        : this.wallet.address;
      const amount = BigInt(amountHalala);
      const expiry = BigInt(Math.floor(expiryMs / 1000));

      const tx = await this.contract.depositAndLock(jobId32, toAddress, amount, expiry);
      const receipt = await tx.wait();
      console.log(`[escrow-chain] depositAndLock jobId=${jobId} tx=${receipt.hash}`);
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
      const proof = await this._buildProof(jobId32);
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
        oracleAddress: this.wallet.address
      };
    } catch (err) {
      return {
        enabled: true,
        contractAddress: process.env.ESCROW_CONTRACT_ADDRESS,
        network: 'base-sepolia',
        oracleAddress: this.wallet.address,
        error: err.message
      };
    }
  }
}

function getChainEscrow() {
  if (!ethers) return { depositAndLock: async () => null, claimLock: async () => null, cancelExpiredLock: async () => null, getEscrowState: async () => null };
}
function _getChainEscrow() {
  if (!_instance) {
    _instance = new ChainEscrowService();
  }
  return _instance;
}

module.exports = { getChainEscrow };
