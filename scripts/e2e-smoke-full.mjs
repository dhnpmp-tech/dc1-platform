#!/usr/bin/env node

/**
 * DCP Phase 1 E2E Smoke Test Orchestration
 * SP25-006: Comprehensive validation of production-ready flows
 *
 * Prerequisites:
 * - SP25-001: Per-token metering (billing persistence)
 * - SP25-002: Escrow contract deployed to Base Sepolia
 *
 * Runs 4 validation suites:
 * 1. Health & readiness checks
 * 2. GPU job lifecycle (submit → run → result → artifact)
 * 3. vLLM metering (token billing accuracy)
 * 4. Escrow contract interaction (once deployed)
 *
 * Usage:
 *   DCP_API_BASE=https://api.dcp.sa \
 *   DCP_PROVIDER_KEY=xxx \
 *   DCP_RENTER_KEY=xxx \
 *   DC1_ADMIN_TOKEN=xxx \
 *   node scripts/e2e-smoke-full.mjs
 */

const fs = require('fs');
const { spawn } = require('child_process');

const API_BASE = (process.env.DCP_API_BASE || 'http://76.13.179.86:8083/api').replace(/\/$/, '');
const PROVIDER_KEY = process.env.DCP_PROVIDER_KEY || '';
const RENTER_KEY = process.env.DCP_RENTER_KEY || '';
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || '';

const testSuites = [
  { name: 'HTTP Health Checks', script: 'scripts/smoke-test.sh', required: true },
  { name: 'GPU Lifecycle E2E', script: 'scripts/gpu-job-lifecycle-smoke.mjs', required: true, env: { PROVIDER_KEY, RENTER_KEY } },
  { name: 'vLLM Metering', script: 'scripts/vllm-metering-smoke.mjs', required: true, env: { RENTER_KEY, ADMIN_TOKEN } },
  { name: 'Escrow Contract', script: 'scripts/escrow-smoke-test.mjs', required: false, env: { PROVIDER_KEY, RENTER_KEY, ADMIN_TOKEN } },
];

const results = [];

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

function runTest(suite) {
  return new Promise((resolve) => {
    const isShell = suite.script.endsWith('.sh');
    const cmd = isShell ? 'bash' : 'node';
    const args = isShell ? [suite.script] : [suite.script];

    const env = {
      ...process.env,
      DCP_API_BASE: API_BASE,
    };

    if (suite.env) {
      Object.assign(env, {
        DCP_PROVIDER_KEY: suite.env.PROVIDER_KEY,
        DCP_RENTER_KEY: suite.env.RENTER_KEY,
        DC1_ADMIN_TOKEN: suite.env.ADMIN_TOKEN,
      });
    }

    log('INFO', `Starting: ${suite.name}`);
    const start = Date.now();

    const proc = spawn(cmd, args, { env, stdio: 'inherit' });
    proc.on('close', (code) => {
      const duration = Date.now() - start;
      const success = code === 0;
      const status = success ? 'PASS' : 'FAIL';
      log(success ? 'INFO' : 'ERROR', `Completed: ${suite.name} (${status}, ${duration}ms)`);
      results.push({ suite: suite.name, success, duration, required: suite.required });
      resolve(success);
    });

    proc.on('error', (error) => {
      log('ERROR', `Error running ${suite.name}: ${error.message}`);
      results.push({ suite: suite.name, success: false, required: suite.required });
      resolve(false);
    });
  });
}

async function main() {
  log('INFO', 'DCP Phase 1 E2E Smoke Test — SP25-006');
  log('INFO', `API Base: ${API_BASE}`);
  log('INFO', `Test suites: ${testSuites.map((s) => s.name).join(', ')}`);

  // Check prerequisites
  const missing = [];
  if (!RENTER_KEY) missing.push('DCP_RENTER_KEY');
  if (!PROVIDER_KEY) missing.push('DCP_PROVIDER_KEY');
  if (!ADMIN_TOKEN) missing.push('DC1_ADMIN_TOKEN');

  if (missing.length > 0) {
    log('ERROR', `Missing required environment variables: ${missing.join(', ')}`);
    process.exit(2);
  }

  // Run all required test suites sequentially
  const requiredTests = testSuites.filter((s) => s.required);
  const optionalTests = testSuites.filter((s) => !s.required);

  for (const suite of requiredTests) {
    const success = await runTest(suite);
    if (!success) {
      log('ERROR', `Required test ${suite.name} failed. Aborting.`);
      process.exit(1);
    }
  }

  // Run optional test suites (e.g., Escrow) if script exists
  for (const suite of optionalTests) {
    if (fs.existsSync(suite.script)) {
      await runTest(suite);
    } else {
      log('INFO', `Optional test ${suite.name} skipped (script not found)`);
    }
  }

  // Print summary
  log('INFO', '=== E2E Smoke Test Summary ===');
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const failedRequired = results.filter((r) => !r.success && r.required).length;

  for (const result of results) {
    const status = result.success ? '✓' : '✗';
    const req = result.required ? '[REQUIRED]' : '[OPTIONAL]';
    console.log(`${status} ${req} ${result.suite} (${result.duration}ms)`);
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed (${failedRequired} required failures)`);

  if (failedRequired > 0) {
    log('ERROR', 'E2E smoke test FAILED');
    process.exit(1);
  }

  log('INFO', 'E2E smoke test PASSED — production ready for Phase 1');
  process.exit(0);
}

main().catch((error) => {
  log('ERROR', `Fatal error: ${error.message}`);
  process.exit(1);
});
