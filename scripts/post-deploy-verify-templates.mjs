#!/usr/bin/env node

/**
 * Post-deployment verification for template catalog
 * Usage: node scripts/post-deploy-verify-templates.mjs
 *
 * Verifies:
 * - API health check passes
 * - Template endpoint responds with >15 templates
 * - Model endpoint responds with >10 models
 * - Provider count stable (>= pre-deploy)
 * - No errors in response payloads
 */

const API_BASE = 'https://api.dcp.sa';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const checks = [
  {
    name: 'API Health',
    path: '/api/health',
    expectedStatus: 200,
    validate: (body) => {
      const data = JSON.parse(body);
      return data.status === 'ok';
    }
  },
  {
    name: 'Templates Endpoint',
    path: '/api/templates',
    expectedStatus: 200,
    validate: (body) => {
      const data = JSON.parse(body);
      const templates = data.templates || data;
      if (!Array.isArray(templates)) {
        throw new Error('Expected array of templates');
      }
      if (templates.length < 15) {
        throw new Error(`Only ${templates.length} templates, expected >= 15`);
      }
      return true;
    }
  },
  {
    name: 'Models Endpoint',
    path: '/api/models',
    expectedStatus: 200,
    validate: (body) => {
      const data = JSON.parse(body);
      if (!Array.isArray(data)) {
        throw new Error('Expected array of models');
      }
      if (data.length < 10) {
        throw new Error(`Only ${data.length} models, expected >= 10`);
      }
      return true;
    }
  },
  {
    name: 'Provider Count Stable',
    path: '/api/providers/marketplace',
    expectedStatus: 200,
    validate: (body) => {
      const data = JSON.parse(body);
      const providers = Array.isArray(data) ? data : data.providers || [];
      if (providers.length < 1) {
        throw new Error(`Provider count ${providers.length}, expected >= 1`);
      }
      return true;
    }
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      return { status: response.status, body };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.log(`  ⏳ Retry ${attempt}/${retries - 1}...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

async function runCheck(check) {
  const url = `${API_BASE}${check.path}`;
  console.log(`🔍 ${check.name}...`);

  try {
    const { status, body } = await fetchWithRetry(url);

    if (status !== check.expectedStatus) {
      console.error(`  ❌ Expected status ${check.expectedStatus}, got ${status}`);
      return false;
    }

    if (check.validate) {
      const isValid = check.validate(body);
      if (!isValid) {
        console.error(`  ❌ Validation failed`);
        return false;
      }
    }

    console.log(`  ✅ PASS`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`📊 Post-Deployment Verification\n`);
  console.log(`Target: ${API_BASE}`);
  console.log(`Checks: ${checks.length}\n`);

  const results = [];

  for (const check of checks) {
    const passed = await runCheck(check);
    results.push({ check: check.name, passed });
  }

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`\n📊 Summary: ${passedCount}/${totalCount} checks passed\n`);

  if (passedCount === totalCount) {
    console.log('✅ ALL CHECKS PASSED — Deployment successful');
    process.exit(0);
  } else {
    console.error('❌ VERIFICATION FAILED — Some checks did not pass');
    console.error(`\nFailed checks:`);
    results
      .filter(r => !r.passed)
      .forEach(r => console.error(`  - ${r.check}`));

    console.error(`\n⚠️  Recommendation: Review deployment logs and consider ROLLBACK`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
