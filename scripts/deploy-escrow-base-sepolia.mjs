#!/usr/bin/env node
/**
 * deploy-escrow-base-sepolia.mjs
 *
 * Standalone ESM deployment script for Escrow.sol on Base Sepolia.
 * Wraps the Hardhat deploy.js script with preflight checks, address
 * recording in contracts/deployed-addresses.json, and verification hints.
 *
 * ─────────────────────────────────────────────────────────────────
 * USAGE (from repo root):
 *   node scripts/deploy-escrow-base-sepolia.mjs [--dry-run]
 *
 * FLAGS:
 *   --dry-run   Print env checks and configuration without deploying.
 *               Safe to run without a funded wallet to verify readiness.
 *
 * REQUIRED ENV VARS:
 *   PRIVATE_KEY         Deployer wallet private key (0x-prefixed, 32 bytes)
 *   ORACLE_ADDRESS      DC1 backend signing address (0x-prefixed, 20 bytes)
 *
 * OPTIONAL ENV VARS:
 *   USDC_ADDRESS        Override USDC token address (default: Base Sepolia Circle USDC)
 *   BASESCAN_API_KEY    Enable automatic Basescan contract verification
 *   BASE_RPC_URL        Override RPC endpoint (default: https://sepolia.base.org)
 *
 * MINIMUM WALLET BALANCE:
 *   >= 0.01 SepoliaETH  (~$20 at mainnet rates; testnet ETH is free from faucets)
 *
 * FAUCETS (testnet ETH):
 *   https://www.alchemy.com/faucets/base-sepolia
 *   https://faucet.quicknode.com/base/sepolia
 *   https://coinbase.com/faucets/base-ethereum-sepolia-faucet
 *
 * ─────────────────────────────────────────────────────────────────
 * DO NOT DEPLOY WITHOUT FOUNDER APPROVAL.
 * Create a DEPLOY REQUEST issue and wait for written sign-off first.
 * ─────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');
const CONTRACTS  = resolve(ROOT, 'contracts');

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_USDC     = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const BASE_SEPOLIA_RPC      = 'https://sepolia.base.org';
const BASESCAN_BROWSER      = 'https://sepolia.basescan.org';
const BASESCAN_API          = 'https://api-sepolia.basescan.org/api';
const MIN_BALANCE_ETH       = 0.01;

const DEPLOYED_ADDRESSES_PATH = resolve(CONTRACTS, 'deployed-addresses.json');
const ESCROW_ABI_PATH         = resolve(CONTRACTS, 'abis', 'Escrow.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(green(`  ✓ ${msg}`)); }
function warn(msg) { console.log(yellow(`  ⚠ ${msg}`)); }
function fail(msg) { console.error(red(`  ✗ ${msg}`)); }
function sep()     { log('─'.repeat(60)); }

function isValidAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidPrivateKey(key) {
  return /^0x[0-9a-fA-F]{64}$/.test(key);
}

// ── Preflight checks ──────────────────────────────────────────────────────────

function preflight() {
  sep();
  log(bold('DCP Escrow — Base Sepolia Deployment Preflight'));
  sep();

  const errors = [];

  // 1. Required env vars
  const privateKey    = process.env.PRIVATE_KEY;
  const oracleAddress = process.env.ORACLE_ADDRESS;
  const usdcAddress   = process.env.USDC_ADDRESS || BASE_SEPOLIA_USDC;
  const rpcUrl        = process.env.BASE_RPC_URL || BASE_SEPOLIA_RPC;

  log('\n1. Required environment variables:');

  if (!privateKey) {
    fail('PRIVATE_KEY is not set');
    errors.push('PRIVATE_KEY missing');
  } else if (!isValidPrivateKey(privateKey)) {
    fail('PRIVATE_KEY must be a 0x-prefixed 32-byte hex string');
    errors.push('PRIVATE_KEY invalid format');
  } else {
    // Derive address from private key for display (without exposing the key).
    // We use a simple approach: log only the first 6 and last 4 chars.
    const masked = `${privateKey.slice(0, 8)}...${privateKey.slice(-4)}`;
    ok(`PRIVATE_KEY set (${masked})`);
  }

  if (!oracleAddress) {
    fail('ORACLE_ADDRESS is not set — this is the DC1 backend signing key address');
    errors.push('ORACLE_ADDRESS missing');
  } else if (!isValidAddress(oracleAddress)) {
    fail('ORACLE_ADDRESS must be a 0x-prefixed 20-byte hex address');
    errors.push('ORACLE_ADDRESS invalid format');
  } else {
    ok(`ORACLE_ADDRESS: ${oracleAddress}`);
  }

  // 2. Optional env vars
  log('\n2. Optional configuration:');
  ok(`USDC_ADDRESS: ${usdcAddress}${usdcAddress === BASE_SEPOLIA_USDC ? ' (default Circle USDC)' : ' (custom override)'}`);
  ok(`BASE_RPC_URL: ${rpcUrl}${rpcUrl === BASE_SEPOLIA_RPC ? ' (default)' : ' (override)'}`);

  const basescanKey = process.env.BASESCAN_API_KEY;
  if (basescanKey) {
    ok(`BASESCAN_API_KEY: set (automatic verification enabled)`);
  } else {
    warn('BASESCAN_API_KEY not set — contract verification will be manual');
  }

  // 3. Contracts workspace
  log('\n3. Contracts workspace:');

  if (!existsSync(resolve(CONTRACTS, 'contracts', 'Escrow.sol'))) {
    fail('contracts/contracts/Escrow.sol not found — run from repo root');
    errors.push('Escrow.sol missing');
  } else {
    ok('Escrow.sol found');
  }

  if (!existsSync(resolve(CONTRACTS, 'hardhat.config.js'))) {
    fail('hardhat.config.js not found');
    errors.push('hardhat.config.js missing');
  } else {
    ok('hardhat.config.js found');
  }

  // 4. Node modules
  log('\n4. Dependencies:');
  if (!existsSync(resolve(CONTRACTS, 'node_modules'))) {
    fail('contracts/node_modules missing — run: cd contracts && npm install');
    errors.push('node_modules missing in contracts/');
  } else {
    ok('contracts/node_modules present');
  }

  // 5. Wallet balance check hint
  log('\n5. Wallet funding requirement:');
  log(cyan(`  Minimum balance required: ${MIN_BALANCE_ETH} SepoliaETH`));
  log(cyan('  Check your balance at: https://sepolia.basescan.org/address/<YOUR_DEPLOYER_ADDRESS>'));
  log(cyan('  Faucets:'));
  log(cyan('    - https://www.alchemy.com/faucets/base-sepolia'));
  log(cyan('    - https://faucet.quicknode.com/base/sepolia'));
  log(cyan('    - https://coinbase.com/faucets/base-ethereum-sepolia-faucet'));

  // 6. Hardhat network config check
  log('\n6. Network configuration (hardhat.config.js):');
  log(cyan(`  Network: base-sepolia`));
  log(cyan(`  Chain ID: ${BASE_SEPOLIA_CHAIN_ID}`));
  log(cyan(`  RPC URL: ${rpcUrl}`));

  sep();

  if (errors.length > 0) {
    log(red('\nPreflight FAILED — resolve these errors before deploying:\n'));
    errors.forEach((e, i) => log(red(`  ${i + 1}. ${e}`)));
    sep();
    return false;
  }

  log(green('\nPreflight PASSED — all checks satisfied.\n'));
  return true;
}

// ── Compile ───────────────────────────────────────────────────────────────────

function compile() {
  log(bold('\nCompiling Escrow.sol...'));
  try {
    execSync('npm run compile', {
      cwd: CONTRACTS,
      stdio: 'inherit',
      env: { ...process.env },
    });
    ok('Compilation successful');
    return true;
  } catch (err) {
    fail(`Compilation failed: ${err.message}`);
    return false;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

function runTests() {
  log(bold('\nRunning contract tests...'));
  try {
    execSync('npm test', {
      cwd: CONTRACTS,
      stdio: 'inherit',
      env: { ...process.env },
    });
    ok('All tests passed');
    return true;
  } catch (err) {
    fail(`Tests failed — do NOT deploy with failing tests`);
    return false;
  }
}

// ── Deploy ────────────────────────────────────────────────────────────────────

function deploy() {
  log(bold('\nDeploying Escrow.sol to Base Sepolia...'));
  log(yellow('  This will broadcast a real transaction and spend testnet ETH.'));

  try {
    execSync('npx hardhat run scripts/deploy.js --network base-sepolia', {
      cwd: CONTRACTS,
      stdio: 'inherit',
      env: { ...process.env },
    });
    return true;
  } catch (err) {
    fail(`Deployment failed: ${err.message}`);
    return false;
  }
}

// ── Record deployed address ───────────────────────────────────────────────────

function recordDeployedAddress() {
  // The deploy.js script writes address into contracts/abis/Escrow.json.
  // We read that and write a lightweight summary to contracts/deployed-addresses.json.

  if (!existsSync(ESCROW_ABI_PATH)) {
    warn('contracts/abis/Escrow.json not found after deploy — cannot record address');
    return null;
  }

  let abiData;
  try {
    abiData = JSON.parse(readFileSync(ESCROW_ABI_PATH, 'utf8'));
  } catch (err) {
    warn(`Failed to parse Escrow.json: ${err.message}`);
    return null;
  }

  if (!abiData.address) {
    warn('Escrow.json has no address field — recording skipped');
    return null;
  }

  // Load or create deployed-addresses.json
  let deployed = {};
  if (existsSync(DEPLOYED_ADDRESSES_PATH)) {
    try {
      deployed = JSON.parse(readFileSync(DEPLOYED_ADDRESSES_PATH, 'utf8'));
    } catch (_) {
      deployed = {};
    }
  }

  // Write entry keyed by network name + chainId for safety.
  const key = `${abiData.network || 'base-sepolia'}-${abiData.chainId || BASE_SEPOLIA_CHAIN_ID}`;
  deployed[key] = {
    contract:      'Escrow',
    address:       abiData.address,
    usdcAddress:   abiData.usdcAddress,
    oracleAddress: abiData.oracleAddress,
    network:       abiData.network || 'base-sepolia',
    chainId:       abiData.chainId || BASE_SEPOLIA_CHAIN_ID,
    deployedAt:    abiData.deployedAt || new Date().toISOString(),
  };

  writeFileSync(DEPLOYED_ADDRESSES_PATH, JSON.stringify(deployed, null, 2));
  ok(`Deployed address recorded in contracts/deployed-addresses.json`);
  ok(`  Key: ${key}`);
  ok(`  Address: ${abiData.address}`);

  return abiData.address;
}

// ── Verify on Basescan ────────────────────────────────────────────────────────

function verify(contractAddress) {
  const usdcAddress   = process.env.USDC_ADDRESS || BASE_SEPOLIA_USDC;
  const oracleAddress = process.env.ORACLE_ADDRESS;

  log(bold('\nBasescan verification:'));

  if (!process.env.BASESCAN_API_KEY) {
    warn('BASESCAN_API_KEY not set — skipping automatic verification');
    log(cyan('\n  Run this manually to verify:'));
    log(cyan(`  cd contracts`));
    log(cyan(`  npx hardhat verify --network base-sepolia ${contractAddress} "${usdcAddress}" "${oracleAddress}"`));
    return;
  }

  log(`  Verifying ${contractAddress} on Basescan...`);
  try {
    execSync(
      `npx hardhat verify --network base-sepolia ${contractAddress} "${usdcAddress}" "${oracleAddress}"`,
      { cwd: CONTRACTS, stdio: 'inherit', env: { ...process.env } }
    );
    ok(`Contract verified: ${BASESCAN_BROWSER}/address/${contractAddress}#code`);
  } catch (err) {
    warn(`Verification failed: ${err.message}`);
    warn('You can retry verification manually (see command above)');
  }
}

// ── Post-deploy instructions ──────────────────────────────────────────────────

function postDeployInstructions(contractAddress) {
  sep();
  log(bold('POST-DEPLOY CHECKLIST'));
  sep();

  log(bold('\n1. Set backend environment variables (VPS — requires founder approval):'));
  log(cyan('   ESCROW_CONTRACT_ADDRESS=' + contractAddress));
  log(cyan('   ESCROW_ORACLE_PRIVATE_KEY=<oracle signing key>'));
  log(cyan('   BASE_RPC_URL=https://sepolia.base.org'));
  log(cyan('   ESCROW_ENABLED=true'));

  log(bold('\n2. Set frontend environment variables:'));
  log(cyan('   NEXT_PUBLIC_ESCROW_ADDRESS=' + contractAddress));
  log(cyan('   NEXT_PUBLIC_BASE_CHAIN_ID=84532'));

  log(bold('\n3. Restart backend via PM2 (requires founder approval):'));
  log(cyan('   pm2 restart dc1-provider-onboarding'));

  log(bold('\n4. Runtime validation:'));
  log(cyan('   GET /api/admin/escrow-chain/status'));
  log(cyan('   → expected: { enabled: true, contractAddress: "' + contractAddress + '" }'));

  log(bold('\n5. Basescan links:'));
  log(cyan(`   Contract: ${BASESCAN_BROWSER}/address/${contractAddress}`));
  log(cyan(`   Code:     ${BASESCAN_BROWSER}/address/${contractAddress}#code`));

  log(bold('\n6. USDC approval (one-time, backend hot-wallet):'));
  log(cyan('   The DC1 backend hot-wallet must approve the escrow contract to spend USDC.'));
  log(cyan('   Call: usdcContract.approve(ESCROW_CONTRACT_ADDRESS, MaxUint256)'));
  log(cyan('   (This is done programmatically in the backend service on first run.)'));

  sep();
  log(yellow('\n⚠  REMINDER: Create a DEPLOY REQUEST issue and get founder approval'));
  log(yellow('   before running this script against ANY live environment.'));
  sep();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    log(yellow('\n[DRY RUN] — No transactions will be broadcast.\n'));
  }

  // Step 1: Preflight
  const preflightOk = preflight();
  if (!preflightOk) {
    process.exit(1);
  }

  if (isDryRun) {
    log(green('\n[DRY RUN COMPLETE] All preflight checks passed.'));
    log(yellow('Remove --dry-run flag and get founder approval before deploying.\n'));
    process.exit(0);
  }

  // Step 2: Compile
  const compileOk = compile();
  if (!compileOk) process.exit(1);

  // Step 3: Tests
  const testsOk = runTests();
  if (!testsOk) {
    log(red('\nAborting deployment — fix failing tests first.'));
    process.exit(1);
  }

  // Step 4: Deploy
  const deployOk = deploy();
  if (!deployOk) process.exit(1);

  // Step 5: Record address
  const contractAddress = recordDeployedAddress();
  if (!contractAddress) {
    fail('Could not determine deployed contract address — check contracts/abis/Escrow.json manually.');
    process.exit(1);
  }

  // Step 6: Verify
  verify(contractAddress);

  // Step 7: Post-deploy instructions
  postDeployInstructions(contractAddress);

  log(green('\n✓ Deployment complete!\n'));
}

main().catch((err) => {
  console.error(red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
