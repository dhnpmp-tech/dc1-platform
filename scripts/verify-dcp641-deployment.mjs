#!/usr/bin/env node
/**
 * DCP-641 Deployment Verification Script
 * Verifies that the routing fix for HuggingFace model IDs is working correctly
 *
 * Usage:
 *   DCP_API_BASE=https://api.dcp.sa node scripts/verify-dcp641-deployment.mjs
 *   Or locally: DCP_API_BASE=http://localhost:8083 node scripts/verify-dcp641-deployment.mjs
 */

import https from 'https';
import http from 'http';

const API_BASE = process.env.DCP_API_BASE || 'https://api.dcp.sa';
const TIMEOUT = 5000;

// Test models with HuggingFace-style IDs (contain slashes)
const TEST_MODELS = [
  'ALLaM-AI/ALLaM-7B-Instruct-preview',
  'BAAI/bge-m3',
  'meta-llama/Meta-Llama-3-8B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.2',
];

const TEST_ENDPOINTS = [
  '/api/models/{model_id}',
  '/api/models/{model_id}/deploy/estimate',
];

/**
 * Make HTTP(S) request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { timeout: TIMEOUT }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Test a single endpoint
 */
async function testEndpoint(model_id, endpoint) {
  const url = `${API_BASE}${endpoint.replace('{model_id}', model_id)}`;
  try {
    const result = await makeRequest(url);
    return {
      endpoint,
      model_id,
      url,
      status: result.status,
      success: result.status === 200,
      error: null,
      body: result.status === 200 ? JSON.parse(result.body) : null,
    };
  } catch (error) {
    return {
      endpoint,
      model_id,
      url,
      status: null,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main verification routine
 */
async function verify() {
  console.log('🔍 DCP-641 Deployment Verification');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log('━'.repeat(60));

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const model_id of TEST_MODELS) {
    console.log(`\n📦 Testing model: ${model_id}`);

    for (const endpoint of TEST_ENDPOINTS) {
      const result = await testEndpoint(model_id, endpoint);
      results.push(result);

      if (result.success) {
        console.log(`  ✅ ${endpoint.replace('{model_id}', '')} → HTTP ${result.status}`);
        passed++;
      } else {
        console.log(`  ❌ ${endpoint.replace('{model_id}', '')} → ${result.status || result.error}`);
        failed++;
      }
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n✅ VERIFICATION PASSED');
    console.log('   Routing fix is working correctly.');
    console.log('   All HuggingFace-style model IDs are routable.');
    console.log('   ✨ Ready for Phase 1 testing!\n');
    process.exit(0);
  } else {
    console.log('\n❌ VERIFICATION FAILED');
    console.log(`   ${failed} endpoint(s) returned errors.`);
    console.log('   Check deployment or API status.\n');

    // Print detailed errors
    const failures = results.filter(r => !r.success);
    console.log('Details:');
    failures.forEach(r => {
      console.log(`  - ${r.url}`);
      console.log(`    Status: ${r.status || 'No response'}`);
      console.log(`    Error: ${r.error || 'Unknown'}`);
    });

    process.exit(1);
  }
}

// Run verification
verify().catch(error => {
  console.error('🔥 Verification script error:', error);
  process.exit(2);
});
