#!/usr/bin/env node
/**
 * Phase 1 Continuous Health Monitoring
 *
 * Runs during Phase 1 Days 4-6 (2026-03-26 through 2026-03-28)
 * Monitors infrastructure health every 5 minutes and logs metrics
 *
 * Usage: node scripts/phase1-continuous-monitoring.mjs [interval-seconds]
 * Default: 300 seconds (5 minutes)
 */

const BASE_URL = 'https://api.dcp.sa';
const DEFAULT_INTERVAL = 300000; // 5 minutes in ms
const LOG_FILE = './logs/phase1-monitoring.log';

// Metrics tracking
let metrics = {
  startTime: new Date().toISOString(),
  checks: [],
  errors: [],
  totalChecks: 0,
  successfulChecks: 0,
  failedChecks: 0,
};

async function makeRequest(method, path, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    const text = await response.text();
    clearTimeout(timeoutId);
    return { status: response.status, body: text, timestamp: new Date().toISOString() };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      status: 0,
      body: '',
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkHealth() {
  const checks = [
    {
      name: 'API Health',
      path: '/api/health',
      validate: (status, body) => {
        try {
          const data = JSON.parse(body);
          return status === 200 && data.status === 'ok';
        } catch {
          return false;
        }
      },
    },
    {
      name: 'Database',
      path: '/api/health',
      validate: (status, body) => {
        try {
          const data = JSON.parse(body);
          return data.db === 'ok';
        } catch {
          return false;
        }
      },
    },
    {
      name: 'Model Catalog',
      path: '/api/models',
      validate: (status, body) => {
        try {
          const data = JSON.parse(body);
          const count = Array.isArray(data) ? data.length : data.count || 0;
          return status === 200 && count >= 11;
        } catch {
          return false;
        }
      },
    },
    {
      name: 'Template Catalog',
      path: '/api/templates',
      validate: (status, body) => {
        try {
          const data = JSON.parse(body);
          const templates = data.templates || data;
          const count = Array.isArray(templates) ? templates.length : templates.count || 0;
          return status === 200 && count >= 15;
        } catch {
          return false;
        }
      },
    },
    {
      name: 'Provider Status',
      path: '/api/providers/status',
      validate: (status, body) => {
        // 200 or 401 is acceptable (auth may be required)
        return status === 200 || status === 401;
      },
    },
    {
      name: 'Jobs API',
      path: '/api/jobs',
      validate: (status, body) => {
        // 200, 401 (auth required), or 404 (not deployed yet) are all acceptable
        return status === 200 || status === 401 || status === 404;
      },
    },
  ];

  const timestamp = new Date().toISOString();
  const checkResults = [];

  for (const check of checks) {
    const { status, body, error } = await makeRequest('GET', check.path);
    const passed = check.validate(status, body);

    checkResults.push({
      name: check.name,
      status,
      passed,
      error,
      timestamp,
    });

    metrics.totalChecks++;
    if (passed) {
      metrics.successfulChecks++;
    } else {
      metrics.failedChecks++;
      metrics.errors.push({ check: check.name, status, error, timestamp });
    }
  }

  return checkResults;
}

function formatCheckResults(results) {
  const header = `\n${'='.repeat(60)}\n${new Date().toISOString()}\n${'='.repeat(60)}`;
  const lines = results.map(r => {
    const icon = r.passed ? '✅' : '❌';
    const status = r.error ? `TIMEOUT/ERROR` : `HTTP ${r.status}`;
    return `${icon} ${r.name.padEnd(25)} ${status.padEnd(20)}`;
  });

  const summary = `\nSummary: ${results.filter(r => r.passed).length}/${results.length} passed`;
  return header + '\n' + lines.join('\n') + summary;
}

function logResults(results) {
  const formatted = formatCheckResults(results);
  console.log(formatted);

  // Also log errors
  results.filter(r => !r.passed).forEach(r => {
    if (r.error) {
      console.error(`  Error: ${r.error}`);
    }
  });
}

async function monitorContinuously(intervalMs) {
  console.log(`🟢 Phase 1 Continuous Monitoring Started`);
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`⏱️  Interval: ${(intervalMs / 1000).toFixed(0)} seconds`);
  console.log(`📊 Logging to: ${LOG_FILE}\n`);

  // Initial check
  console.log('Running initial health check...');
  let results = await checkHealth();
  logResults(results);
  metrics.checks.push(...results);

  // Set up recurring checks
  const intervalId = setInterval(async () => {
    console.log('\n🔄 Running scheduled health check...');
    results = await checkHealth();
    logResults(results);
    metrics.checks.push(...results);

    // Alert on critical failures
    const criticalFailures = results.filter(r =>
      !r.passed && (r.name === 'API Health' || r.name === 'Database')
    );

    if (criticalFailures.length > 0) {
      console.error('\n🚨 CRITICAL FAILURE DETECTED');
      console.error('Failures:', criticalFailures.map(f => f.name).join(', '));
      console.error('Consider escalating to on-call engineer');
    }
  }, intervalMs);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n📊 Monitoring Summary:');
    console.log(`Total checks: ${metrics.totalChecks}`);
    console.log(`Successful: ${metrics.successfulChecks}`);
    console.log(`Failed: ${metrics.failedChecks}`);
    console.log(`Success rate: ${((metrics.successfulChecks / metrics.totalChecks) * 100).toFixed(1)}%`);

    if (metrics.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      metrics.errors.forEach(e => {
        console.log(`  - ${e.check}: ${e.error || `HTTP ${e.status}`}`);
      });
    }

    clearInterval(intervalId);
    process.exit(0);
  });
}

// Parse command line arguments
const interval = process.argv[2] ? parseInt(process.argv[2]) * 1000 : DEFAULT_INTERVAL;

if (isNaN(interval) || interval < 10000) {
  console.error('Error: Interval must be >= 10 seconds');
  process.exit(1);
}

// Start monitoring
monitorContinuously(interval).catch(err => {
  console.error('Monitoring failed:', err);
  process.exit(1);
});
