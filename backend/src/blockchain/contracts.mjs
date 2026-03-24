/**
 * contracts.mjs - Contract ABI and address config for DCP blockchain integration
 *
 * DCP-920 | Blockchain Engineer | 2026-03-24
 *
 * Exports PROVIDER_STAKE_ABI and CONTRACTS config used by stake-verifier.mjs.
 * If PROVIDER_STAKE_ADDRESS is not set, stake checks fall back to Phase 1 bypass
 * (hasMinimumStake=true) so job routing is unaffected before mainnet deployment.
 */

// Minimal ABI -- only functions needed by stake-verifier.mjs
// Derived from contracts/artifacts/contracts/ProviderStake.sol/ProviderStake.json
export const PROVIDER_STAKE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'provider', type: 'address' }],
    name: 'getStake',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'amount',   type: 'uint256' },
          { internalType: 'uint256', name: 'stakedAt', type: 'uint256' },
          { internalType: 'bool',    name: 'isActive', type: 'bool'    },
        ],
        internalType: 'struct ProviderStake.Stake',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_STAKE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'LOCK_PERIOD',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: 'address', name: 'provider', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount',   type: 'uint256' },
    ],
    name: 'Staked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: 'address', name: 'provider', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount',   type: 'uint256' },
    ],
    name: 'Unstaked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: 'address', name: 'provider', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount',   type: 'uint256' },
      { indexed: false, internalType: 'string',  name: 'reason',   type: 'string'  },
    ],
    name: 'Slashed',
    type: 'event',
  },
];

/**
 * Contract address config.
 * Address is null until DCP-909 deploys to Base Sepolia.
 * When null, stake-verifier returns hasMinimumStake=true (Phase 1 bypass).
 */
export const CONTRACTS = {
  providerStake: process.env.PROVIDER_STAKE_ADDRESS || null,
};

/**
 * RPC endpoint for Base Sepolia (or mainnet in Phase 2).
 * Falls back to public Base Sepolia RPC if not configured.
 */
export const RPC_URL =
  process.env.BASE_RPC_URL || 'https://sepolia.base.org';
