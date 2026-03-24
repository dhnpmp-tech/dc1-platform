/**
 * stake-verifier.mjs - Provider stake verification for DCP job routing
 *
 * DCP-920 | Blockchain Engineer | 2026-03-24
 *
 * Reads the provider's EVM wallet address from the providers table and checks
 * ProviderStake.sol for sufficient collateral before job assignment.
 *
 * Phase 1 behaviour (REQUIRE_STAKE=false, no contract address):
 *   - Returns hasMinimumStake=true for all providers (bypass)
 *   - Logs a warning if RPC is unavailable
 *
 * Phase 2 behaviour (REQUIRE_STAKE=true + PROVIDER_STAKE_ADDRESS set):
 *   - Enforces minimum stake strictly per GPU tier
 *   - Skips providers below threshold
 */

import { PROVIDER_STAKE_ABI, CONTRACTS, RPC_URL } from './contracts.mjs';

// Graceful ethers import -- mirrors escrow-chain.js pattern
let ethers;
try {
  const mod = await import('ethers');
  ethers = mod;
} catch {
  try {
    // Try contracts/node_modules if backend doesn't have ethers
    const mod = await import('../../../contracts/node_modules/ethers/lib/ethers.js');
    ethers = mod;
  } catch {
    console.warn('[stake-verifier] ethers not available -- stake checks will bypass');
  }
}

// db import (CJS module)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('../db.js');

// ---- Tier minimum stakes (ETH in wei as bigint) --------------------------------
// Source: docs/blockchain/provider-stake-integration.md section 2
// gpu_tier column in providers: 0=unclassified, 1=entry, 2=standard, 3=high, 4=enterprise

export const TIER_MIN_STAKE_ETH = {
  0: 0n,                   // unclassified -- no requirement (Phase 1 leniency)
  1: 3000000000000000n,    // Entry (RTX 3080/3090): 0.003 ETH
  2: 8000000000000000n,    // Standard (RTX 4090/4080): 0.008 ETH
  3: 31000000000000000n,   // High (A100 40GB, L40S): 0.031 ETH
  4: 78000000000000000n,   // Enterprise (H100 80GB, H200 141GB): 0.078 ETH
};

export const TIER_NAMES = {
  0: 'unclassified',
  1: 'entry',
  2: 'standard',
  3: 'high',
  4: 'enterprise',
};

// Module-level contract instance (lazy-initialised, shared across calls)
let _contract = null;

/**
 * Lazy-initialise the ProviderStake contract reader.
 * Returns false (falsy) if not configured (Phase 1 bypass).
 */
function getContract() {
  if (_contract !== null) return _contract;

  if (!ethers || !CONTRACTS.providerStake) {
    _contract = false; // falsy sentinel
    return false;
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    _contract = new ethers.Contract(CONTRACTS.providerStake, PROVIDER_STAKE_ABI, provider);
    console.log(`[stake-verifier] Initialised at ${CONTRACTS.providerStake} on ${RPC_URL}`);
    return _contract;
  } catch (err) {
    console.warn('[stake-verifier] Failed to initialise contract:', err.message);
    _contract = false;
    return false;
  }
}

/**
 * Verify that a provider has the minimum stake for their GPU tier.
 *
 * @param {number|string} providerId - providers.id
 * @returns {Promise<{ hasMinimumStake: boolean, stakeAmount: bigint, minimumRequired: bigint, tier: number }>}
 */
export async function verifyProviderStake(providerId) {
  const requireStake = process.env.REQUIRE_STAKE === 'true';

  // Phase 1 fast path: bypass if flag not set
  if (!requireStake) {
    return { hasMinimumStake: true, stakeAmount: 0n, minimumRequired: 0n, tier: 0 };
  }

  // Fetch provider wallet + tier from DB
  const provider = db.get(
    'SELECT id, evm_wallet_address, gpu_tier FROM providers WHERE id = ?',
    providerId
  );

  if (!provider) {
    console.warn(`[stake-verifier] Provider ${providerId} not found`);
    return { hasMinimumStake: false, stakeAmount: 0n, minimumRequired: 0n, tier: 0 };
  }

  const { evm_wallet_address: walletAddress, gpu_tier: gpuTier = 0 } = provider;
  const tier = Number(gpuTier) || 0;
  const minimumRequired = TIER_MIN_STAKE_ETH[tier] ?? TIER_MIN_STAKE_ETH[0];

  if (!walletAddress) {
    console.warn(`[stake-verifier] Provider ${providerId} has no EVM wallet`);
    return { hasMinimumStake: false, stakeAmount: 0n, minimumRequired, tier };
  }

  // No contract address: bypass (contract not yet deployed)
  const contract = getContract();
  if (!contract) {
    console.warn(
      `[stake-verifier] PROVIDER_STAKE_ADDRESS not set -- bypassing stake check for provider ${providerId}`
    );
    return { hasMinimumStake: true, stakeAmount: 0n, minimumRequired, tier };
  }

  // On-chain call
  try {
    const stake = await contract.getStake(walletAddress);
    const stakeAmount = BigInt(stake.amount.toString());
    const hasMinimumStake = stake.isActive && stakeAmount >= minimumRequired;

    if (!hasMinimumStake) {
      console.warn(
        `[stake-verifier] Provider ${providerId} (${TIER_NAMES[tier]}) ` +
        `stake ${stakeAmount} < required ${minimumRequired}`
      );
    }

    return { hasMinimumStake, stakeAmount, minimumRequired, tier };
  } catch (err) {
    // RPC failure -- Phase 1 leniency: allow job, log warning
    console.warn(
      `[stake-verifier] RPC error for provider ${providerId}: ${err.message} -- allowing job`
    );
    return { hasMinimumStake: true, stakeAmount: 0n, minimumRequired, tier };
  }
}

/**
 * Get the minimum stake required for a given GPU tier.
 * Exported for use by the stake-status API endpoint.
 *
 * @param {number} tier - GPU tier (0-4)
 * @returns {bigint}
 */
export function getTierMinimumStake(tier) {
  return TIER_MIN_STAKE_ETH[Number(tier)] ?? TIER_MIN_STAKE_ETH[0];
}
