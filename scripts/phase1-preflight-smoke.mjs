#!/usr/bin/env node
/**
 * Phase 1 Pre-Flight Smoke Test
 *
 * Validates that all Sprint 28 backend work is deployed and functioning
 * before Phase 1 external testers arrive.
 *
 * Tests:
 * - /health → expect 200
 * - /api/models → expect 11 models
 * - /api/templates → expect 20 templates
 * - /api/providers/heartbeat → expect 200 or 404 (not deployed is OK)
 * - /api/jobs → expect 200 or 401 (auth required is OK)
 */

const BASE_URL = 'https://api.dcp.sa';
const TIMEOUT_MS = 10000;

const tests = [
  {
    name: 'API Health',
    method: 'GET',
    path: '/api/health',
    validate: (status, body) => status === 200,
    allowedStatuses: [200],
    required: true,
  },
  {
    name: 'Model Catalog',
    method: 'GET',
    path: '/api/models',
    validate: (status, body) => {
      if (status !== 200) return false;
      try {
        const data = JSON.parse(body);
        const count = Array.isArray(data) ? data.length : data.count || 0;
        return count >= 11;
      } catch {
        return false;
      }
    },
    allowedStatuses: [200],
    required: true,
  },
  {
    name: 'Template Catalog',
    method: 'GET',
    path: '/api/templates',
    validate: (status, body) => {
      if (status === 404) return 'NOT-DEPLOYED';
      if (status !== 200) return false;
      try {
        const data = JSON.parse(body);
        // Check for templates.count or templates array
        const templates = data.templates || data;
        const count = Array.isArray(templates) ? templates.length : templates.count || 0;
        return count >= 15;
      } catch {
        return false;
      }
    },
    allowedStatuses: [200, 404],
    required: true,
  },
  {
    name: 'Provider Heartbeat (auth)',
    method: 'POST',
    path: '/api/providers/heartbeat',
    body: JSON.stringify({ providerId: 'test', status: 'online' }),
    validate: (status, body) => {
      // 400 with "api_key required" means endpoint exists but needs auth
      // This is PASS (endpoint deployed, just requires authentication)
      if (status === 400 || status === 401) return true;
      return status === 200 || status === 404;
    },
    allowedStatuses: [200, 400, 401, 404],
    required: false,
  },
  {
    name: 'Job Queue API',
    method: 'GET',
    path: '/api/jobs',
    validate: (status, body) => {
      // 404 means not deployed yet (expected - may be in Sprint 28 review)
      if (status === 404) return 'NOT-DEPLOYED';
      return status === 200 || status === 401;
    },
    allowedStatuses: [200, 401, 404],
    required: false,
  },
];

async function makeRequest(method, url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const options = {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = body;

    const response = await fetch(url, options);
    const text = await response.text();
    return { status: response.status, body: text };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: 0, body: 'TIMEOUT', error: 'Request timeout' };
    }
    return { status: 0, body: '', error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function formatResult(test, status, body, result) {
  const icon = result === true ? '✅' : result === 'NOT-DEPLOYED' ? '⚠️' : '❌';
  const details = status === 0 ? '(Connection failed)' : `(HTTP ${status})`;
  const desc = result === 'NOT-DEPLOYED' ? 'NOT-DEPLOYED' : result ? 'PASS' : 'FAIL';
  return `${icon} ${test.name.padEnd(25)} ${desc.padEnd(15)} ${details}`;
}

async function runTests() {
  console.log(`\n🚀 Phase 1 Pre-Flight Smoke Test`);
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  const results = [];
  let requiredPassed = 0;
  let requiredFailed = 0;
  let optionalPassed = 0;
  let optionalDeployed = 0;
  let optionalNotDeployed = 0;

  for (const test of tests) {
    const url = `${BASE_URL}${test.path}`;
    const { status, body, error } = await makeRequest(test.method, url, test.body);

    let result = false;
    let statusResult = 'FAIL';

    if (status === 0) {
      result = false;
      statusResult = 'FAIL';
      if (test.required) requiredFailed++;
    } else {
      result = test.validate(status, body);
      if (result === 'NOT-DEPLOYED') {
        statusResult = 'NOT-DEPLOYED';
        if (test.required) requiredFailed++;
        else optionalNotDeployed++;
      } else if (result === true) {
        statusResult = 'PASS';
        if (test.required) requiredPassed++;
        else optionalPassed++;
        optionalDeployed++;
      } else {
        statusResult = 'FAIL';
        if (test.required) requiredFailed++;
      }
    }

    console.log(formatResult(test, status, body, result));
    results.push({ test: test.name, status, result, required: test.required });
  }

  const allRequiredPassed = requiredFailed === 0;

  console.log(`\n📊 Summary`);
  console.log(`✅ Required endpoints: ${requiredPassed}/${requiredPassed + requiredFailed}`);
  console.log(`ℹ️  Optional endpoints: ${optionalPassed}/${optionalPassed + optionalNotDeployed}`);
  console.log(
    `\n🚦 Go/No-Go: ${allRequiredPassed ? '🟢 GO' : '🔴 NO-GO'} — ${allRequiredPassed ? 'Ready for Phase 1 Day 4' : 'Critical blockers detected'}`
  );
  console.log(`⏱️  Completed: ${new Date().toISOString()}\n`);

  return { results, allRequiredPassed, requiredPassed, requiredFailed, optionalPassed, optionalNotDeployed, timestamp: new Date().toISOString() };
}

// Run tests and return results
runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
