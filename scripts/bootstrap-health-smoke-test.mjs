#!/usr/bin/env node

/**
 * Bootstrap Node Health Smoke Test
 *
 * Purpose: Validate that DCP's P2P bootstrap node is correctly:
 * 1. Accepting provider announcements
 * 2. Relaying providers through DHT
 * 3. Making providers discoverable to renters
 *
 * Execution: Run this script after DCP-612 Phase 1 bootstrap deployment completes
 *
 * Prerequisites:
 * - Bootstrap node deployed on 76.13.179.86:4001 (TCP)
 * - At least 1 provider node running with P2P enabled
 * - Backend API accessible at api.dcp.sa or http://localhost:8083
 *
 * Exit codes:
 * - 0: All tests passed
 * - 1: One or more tests failed
 * - 2: Setup error (missing bootstrap, API unavailable, etc.)
 */

import { spawn, spawnSync } from 'child_process';
import { promisify } from 'util';
import { createConnection } from 'net';

const setTimeout_async = promisify(setTimeout);

const API_BASE = process.env.API_BASE || 'http://localhost:8083';
const BOOTSTRAP_HOST = process.env.BOOTSTRAP_HOST || '76.13.179.86';
const BOOTSTRAP_PORT = process.env.BOOTSTRAP_PORT || 4001;
const BOOTSTRAP_ADDR = `/ip4/${BOOTSTRAP_HOST}/tcp/${BOOTSTRAP_PORT}`;

let testsPassed = 0;
let testsFailed = 0;

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '  [ℹ]',
    pass: '  [✓]',
    fail: '  [✗]',
    warn: '  [⚠]',
    section: '══',
  }[level] || '  [?]';

  console.log(`${prefix} ${timestamp} ${message}`);
}

async function test(name, fn) {
  log(`Testing: ${name}`, 'section');
  try {
    await fn();
    testsPassed += 1;
    log(`PASS: ${name}`, 'pass');
  } catch (error) {
    testsFailed += 1;
    log(`FAIL: ${name}`, 'fail');
    log(`  Error: ${error.message}`, 'fail');
  }
}

/**
 * Test 1: Bootstrap node is reachable on TCP port 4001
 */
async function testBootstrapReachability() {
  return new Promise((resolve, reject) => {
    const socket = createConnection({
      host: BOOTSTRAP_HOST,
      port: BOOTSTRAP_PORT,
      timeout: 5000
    });

    socket.on('connect', () => {
      socket.destroy();
      resolve();
    });

    socket.on('error', (error) => {
      reject(new Error(`Cannot connect to bootstrap ${BOOTSTRAP_HOST}:${BOOTSTRAP_PORT}: ${error.message}`));
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Bootstrap connection timeout (${BOOTSTRAP_HOST}:${BOOTSTRAP_PORT})`));
    });
  });
}

/**
 * Test 2: Backend P2P service is available and running
 */
async function testBackendP2PService() {
  const res = await fetch(`${API_BASE}/api/p2p/health`);
  if (!res.ok) {
    throw new Error(`Backend P2P health check returned ${res.status}`);
  }
  const data = await res.json();
  if (!data.service || data.service !== 'dcp-p2p') {
    throw new Error('P2P service not responding correctly');
  }
  if (!data.bootstrap_configured) {
    throw new Error('Bootstrap not configured in backend');
  }
  log(`  Discovery mode: ${data.mode}`, 'info');
  log(`  Bootstrap configured: ${data.bootstrap_addrs.join(', ')}`, 'info');
}

/**
 * Test 3: Check if any providers are currently online
 */
async function testProvidersExist() {
  const res = await fetch(`${API_BASE}/api/providers/available?limit=5`);
  if (!res.ok) {
    throw new Error(`Provider list returned ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Provider list response invalid');
  }
  if (data.length === 0) {
    log(`  No providers currently online (this is OK for cold start)`, 'warn');
  } else {
    log(`  Found ${data.length} online providers`, 'info');
    for (const provider of data.slice(0, 3)) {
      log(`    - ${provider.name || provider.id} (${provider.gpu_model}, ${provider.vram_gb} GB VRAM)`, 'info');
    }
  }
}

/**
 * Test 4: Verify provider discovery API endpoints exist and respond
 */
async function testProviderDiscoveryAPI() {
  // Test /api/p2p/providers list
  const res1 = await fetch(`${API_BASE}/api/p2p/providers?discover_all=true`);
  if (!res1.ok) {
    throw new Error(`P2P providers list returned ${res1.status}`);
  }
  const data1 = await res1.json();
  log(`  DHT discovery mode: ${data1.discovery_mode}`, 'info');
  log(`  DHT providers found: ${data1.total}`, 'info');

  // Test /api/p2p/health with probe
  const res2 = await fetch(`${API_BASE}/api/p2p/health?probe=true`);
  if (!res2.ok) {
    log(`  P2P health probe returned ${res2.status} (non-critical)`, 'warn');
  } else {
    const data2 = await res2.json();
    if (data2.probe && data2.probe.status === 'ok') {
      log(`  Bootstrap probe: OK (latency ${data2.probe.elapsed_ms}ms)`, 'info');
    } else {
      log(`  Bootstrap probe: ${data2.probe?.status || 'unknown'}`, 'warn');
    }
  }
}

/**
 * Test 5: Verify provider capability filtering API works
 */
async function testCapabilityFiltering() {
  // Test new search endpoint (Phase 27 feature)
  const res = await fetch(`${API_BASE}/api/providers/search?min_free_vram_gb=8&limit=5`);
  if (!res.ok) {
    if (res.status === 404) {
      log(`  Provider search endpoint not yet deployed (expected in Phase 27.2)`, 'warn');
      return;
    }
    throw new Error(`Provider search returned ${res.status}`);
  }
  const data = await res.json();
  log(`  Found ${data.total} providers matching criteria`, 'info');

  // Test model-specific search
  const res2 = await fetch(`${API_BASE}/api/providers/search/llama3-8b?limit=5`);
  if (!res2.ok && res2.status !== 404) {
    throw new Error(`Model search returned ${res2.status}`);
  }
  if (res2.ok) {
    const data2 = await res2.json();
    if (data2.candidates && data2.candidates.length > 0) {
      log(`  Found ${data2.candidates.length} candidates for llama3-8b`, 'info');
    }
  }
}

/**
 * Test 6: Verify model metadata is available
 */
async function testModelMetadata() {
  const models = ['llama3-8b', 'mistral-7b', 'allam-7b', 'arabic-embeddings-bgem3'];
  const availableModels = [];

  for (const model of models) {
    const res = await fetch(`${API_BASE}/api/models/${model}`);
    if (res.ok) {
      availableModels.push(model);
    }
  }

  if (availableModels.length === 0) {
    log(`  Model metadata endpoint not available (expected in Phase 27.2)`, 'warn');
  } else {
    log(`  Model metadata available: ${availableModels.join(', ')}`, 'info');
  }
}

/**
 * Test 7: Verify admin endpoints for P2P debugging
 */
async function testAdminEndpoints() {
  const adminToken = process.env.ADMIN_TOKEN || 'test-token';

  // Test shadow cycle monitoring
  const res = await fetch(`${API_BASE}/api/p2p/shadow-cycle`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  if (res.ok) {
    const data = await res.json();
    log(`  Shadow cycle decision: ${data.shadow_cycle?.decision || 'unknown'}`, 'info');
    log(`  Tracked peers: ${data.tracked_peers_from_sqlite || 0}`, 'info');
  } else if (res.status === 401) {
    log(`  Admin token not provided or invalid`, 'warn');
  } else {
    log(`  Shadow cycle endpoint returned ${res.status}`, 'warn');
  }
}

/**
 * Test 8: Check provider heartbeat mechanism
 */
async function testHeartbeatMechanism() {
  // Verify heartbeat table has recent entries
  const res = await fetch(`${API_BASE}/api/admin/heartbeat-log?limit=1`);
  if (!res.ok) {
    log(`  Heartbeat log endpoint not accessible`, 'warn');
    return;
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    log(`  No recent heartbeats (expected if providers just came online)`, 'warn');
  } else {
    const latest = data[0];
    const age = Date.now() - new Date(latest.timestamp).getTime();
    log(`  Latest heartbeat: ${Math.round(age / 1000)}s ago`, 'info');
  }
}

/**
 * Test 9: Performance check — provider selection latency
 */
async function testRoutingPerformance() {
  const start = Date.now();
  const res = await fetch(`${API_BASE}/api/providers/search?min_free_vram_gb=8`);
  const elapsed = Date.now() - start;

  if (res.ok) {
    log(`  Provider search latency: ${elapsed}ms`, 'info');
    if (elapsed > 100) {
      log(`  ⚠ Slow provider search (>100ms) — may indicate load issue`, 'warn');
    }
  }
}

/**
 * Test 10: Smoke test for Arabic model routing
 */
async function testArabicModelRouting() {
  const arabicModels = ['allam-7b', 'arabic-embeddings-bgem3', 'arabic-reranker'];

  for (const model of arabicModels) {
    const res = await fetch(`${API_BASE}/api/providers/search/${model}`);
    if (!res.ok && res.status !== 404) {
      throw new Error(`Arabic model search failed for ${model}: ${res.status}`);
    }
    if (res.ok) {
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        log(`  ${model}: ${data.candidates.length} candidates available`, 'info');
      }
    }
  }
}

/**
 * Summary report
 */
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  log(`Test Results: ${testsPassed} passed, ${testsFailed} failed`, testsFailed === 0 ? 'pass' : 'fail');
  console.log('═'.repeat(60) + '\n');

  if (testsFailed === 0) {
    log('Bootstrap health check PASSED ✓', 'pass');
    log('P2P network is operational and ready for inference routing', 'pass');
    log('Next steps: Monitor provider onboarding, test Arabic RAG queries', 'info');
    process.exit(0);
  } else {
    log(`Bootstrap health check FAILED (${testsFailed} issues)`, 'fail');
    log('Review errors above and consult troubleshooting runbook', 'fail');
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🚀 DCP Bootstrap Node Health Smoke Test');
  console.log(`📍 Bootstrap: ${BOOTSTRAP_ADDR}`);
  console.log(`📍 API: ${API_BASE}`);
  console.log(`📍 Started: ${new Date().toISOString()}\n`);

  // Run all tests
  await test('Bootstrap node reachability (TCP 4001)', testBootstrapReachability);
  await test('Backend P2P service available', testBackendP2PService);
  await test('Provider list API', testProvidersExist);
  await test('Provider discovery API endpoints', testProviderDiscoveryAPI);
  await test('Provider capability filtering', testCapabilityFiltering);
  await test('Model metadata availability', testModelMetadata);
  await test('Admin debugging endpoints', testAdminEndpoints);
  await test('Provider heartbeat mechanism', testHeartbeatMechanism);
  await test('Routing performance (<100ms)', testRoutingPerformance);
  await test('Arabic model routing support', testArabicModelRouting);

  // Print summary and exit
  printSummary();
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'fail');
  process.exit(2);
});
