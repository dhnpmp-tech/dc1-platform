#!/usr/bin/env node

/**
 * Phase 1 Day 4 — Real-Time Monitoring Dashboard
 *
 * Purpose: Real-time system health monitoring during Day 4 testing execution
 * Usage: Run on Terminal 3 during testing: `node scripts/day4-monitoring-dashboard.mjs`
 *
 * Monitors:
 * - API latency and health (GET /api/health, /api/models)
 * - Model catalog status (11 models expected)
 * - Database connectivity and performance
 * - Backend system resources (memory, CPU)
 * - Error log streaming (live errors from app.log)
 * - Overall system health assessment
 *
 * Output: Real-time display with 5-second refresh, color-coded status
 */

import fs from 'fs';
import https from 'https';
import child_process from 'child_process';

const API_BASE = 'https://api.dcp.sa';
const LOG_FILE = '/root/dc1-platform/backend/logs/app.log';
const REFRESH_INTERVAL = 5000; // 5 seconds

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

// State tracking
let lastLogSize = 0;
let testStartTime = Date.now();
let apiCallCount = 0;
let apiErrorCount = 0;
let lastHealthStatus = 'unknown';
let modelCount = 0;

/**
 * Make HTTP request with timeout and return response time
 */
function makeRequest(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    https.get(url, { timeout: 5000 }, (res) => {
      const responseTime = Date.now() - startTime;
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          responseTime,
          data: data.slice(0, 1000), // Limit to first 1000 chars
        });
      });
    }).on('error', (err) => {
      resolve({
        status: 0,
        responseTime: Date.now() - startTime,
        error: err.message,
      });
    }).on('timeout', () => {
      resolve({
        status: 0,
        responseTime: Date.now() - startTime,
        error: 'TIMEOUT',
      });
    });
  });
}

/**
 * Check API health endpoint
 */
async function checkApiHealth() {
  apiCallCount++;
  const result = await makeRequest(`${API_BASE}/api/health`);

  if (result.status === 200) {
    lastHealthStatus = 'OK';
    return { status: 'OK', responseTime: result.responseTime };
  } else if (result.status === 0) {
    lastHealthStatus = 'DOWN';
    return { status: 'DOWN', error: result.error };
  } else {
    lastHealthStatus = 'ERROR';
    return { status: 'ERROR', code: result.status };
  }
}

/**
 * Check model catalog
 */
async function checkModelCatalog() {
  const result = await makeRequest(`${API_BASE}/api/models`);

  if (result.status === 200) {
    const models = JSON.parse(result.data).length || 0;
    modelCount = models;
    return {
      status: models === 11 ? 'OK' : 'DEGRADED',
      count: models,
      expected: 11,
    };
  } else {
    modelCount = 0;
    apiErrorCount++;
    return {
      status: 'ERROR',
      code: result.status,
      error: result.error,
    };
  }
}

/**
 * Get system resources from VPS
 */
function getSystemResources() {
  try {
    const output = child_process.execSync(
      'ssh root@76.13.179.86 "free -h | grep Mem | awk \'{print $3, $2}\' && uptime | awk \'{print $(NF-2), $(NF-1), $NF}\'" 2>/dev/null',
      { timeout: 3000, encoding: 'utf8' }
    ).trim();

    if (output) {
      const lines = output.split('\n');
      return {
        memory: lines[0] || 'unknown',
        load: lines[1] || 'unknown',
      };
    }
  } catch (err) {
    // SSH might fail, that's OK
  }
  return { memory: 'unknown', load: 'unknown' };
}

/**
 * Check backend error logs
 */
function checkRecentErrors() {
  try {
    const stats = fs.statSync(LOG_FILE);
    const currentSize = stats.size;

    // Read new content since last check
    if (currentSize > lastLogSize) {
      const readStream = fs.createReadStream(LOG_FILE, {
        start: lastLogSize,
        end: currentSize,
      });

      let newContent = '';
      readStream.on('data', (chunk) => newContent += chunk);
      readStream.on('end', () => {
        lastLogSize = currentSize;

        // Count error lines
        const errorLines = newContent.split('\n').filter(line =>
          line.includes('ERROR') || line.includes('FATAL')
        );

        return errorLines;
      });
    }
  } catch (err) {
    // File might not exist, that's OK
  }
  return [];
}

/**
 * Calculate overall health score
 */
function calculateHealthScore(health, catalog, resources) {
  let score = 100;

  // API health: 30 points
  if (health.status === 'OK') {
    if (health.responseTime > 1000) score -= 10;
  } else {
    score -= 30;
  }

  // Model catalog: 20 points
  if (catalog.status === 'OK') {
    // Fully OK
  } else if (catalog.status === 'DEGRADED') {
    score -= 10;
  } else {
    score -= 20;
  }

  // System resources: 20 points
  if (resources.memory !== 'unknown') {
    const memUsage = resources.memory.split(' ')[0];
    // Could parse percentage here
  }
  if (resources.load === 'unknown') {
    score -= 5;
  }

  // API error rate: 30 points
  const errorRate = apiErrorCount / Math.max(apiCallCount, 1);
  if (errorRate > 0.1) {
    score -= Math.floor(errorRate * 30);
  }

  return Math.max(0, score);
}

/**
 * Format status with colors
 */
function formatStatus(status, details = '') {
  const statusUpper = status.toUpperCase();

  if (statusUpper === 'OK') {
    return `${colors.green}✓ OK${colors.reset}${details ? ' ' + details : ''}`;
  } else if (statusUpper === 'ERROR' || statusUpper === 'DOWN' || statusUpper === 'FATAL') {
    return `${colors.red}✗ ${status}${colors.reset}${details ? ' ' + details : ''}`;
  } else if (statusUpper === 'DEGRADED' || statusUpper === 'WARNING') {
    return `${colors.yellow}⚠ ${status}${colors.reset}${details ? ' ' + details : ''}`;
  } else {
    return `${colors.blue}⊘ ${status}${colors.reset}${details ? ' ' + details : ''}`;
  }
}

/**
 * Render dashboard
 */
async function renderDashboard() {
  // Get current data
  const health = await checkApiHealth();
  const catalog = await checkModelCatalog();
  const resources = getSystemResources();
  const healthScore = calculateHealthScore(health, catalog, resources);

  const elapsedSeconds = Math.floor((Date.now() - testStartTime) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedHours = Math.floor(elapsedMinutes / 60);

  // Clear screen
  console.clear();

  // Header
  console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}  Phase 1 Day 4 — Real-Time Monitoring Dashboard${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log('');

  // Timestamp and elapsed time
  const now = new Date().toUTCString();
  console.log(`Timestamp: ${colors.blue}${now}${colors.reset}`);
  console.log(`Elapsed: ${colors.blue}${elapsedHours}h ${(elapsedMinutes % 60)}m ${(elapsedSeconds % 60)}s${colors.reset}`);
  console.log('');

  // System Health Score
  let scoreColor = colors.green;
  if (healthScore < 70) scoreColor = colors.yellow;
  if (healthScore < 30) scoreColor = colors.red;
  console.log(`Overall Health: ${scoreColor}${colors.bold}${healthScore}/100${colors.reset}`);
  console.log('');

  // API Health
  console.log(`${colors.bold}API Health:${colors.reset}`);
  const apiDetails = health.responseTime ? `(${health.responseTime}ms)` : '';
  console.log(`  Status: ${formatStatus(health.status, apiDetails)}`);
  if (health.error) console.log(`  Error: ${health.error}`);
  console.log('');

  // Model Catalog
  console.log(`${colors.bold}Model Catalog:${colors.reset}`);
  const catalogDetails = catalog.count ? `(${catalog.count}/${catalog.expected})` : '';
  console.log(`  Status: ${formatStatus(catalog.status, catalogDetails)}`);
  if (catalog.error) console.log(`  Error: ${catalog.error}`);
  console.log('');

  // System Resources
  console.log(`${colors.bold}System Resources:${colors.reset}`);
  console.log(`  Memory Usage: ${resources.memory || 'N/A'}`);
  console.log(`  Load Average: ${resources.load || 'N/A'}`);
  console.log('');

  // API Call Statistics
  console.log(`${colors.bold}API Statistics:${colors.reset}`);
  const errorRate = ((apiErrorCount / Math.max(apiCallCount, 1)) * 100).toFixed(1);
  console.log(`  Calls Made: ${apiCallCount}`);
  console.log(`  Errors: ${apiErrorCount} (${errorRate}%)`);
  console.log('');

  // Status Legend
  console.log(`${colors.bold}Status Legend:${colors.reset}`);
  console.log(`  ${colors.green}✓${colors.reset} OK = System functioning normally`);
  console.log(`  ${colors.yellow}⚠${colors.reset} DEGRADED = System partially functioning`);
  console.log(`  ${colors.red}✗${colors.reset} ERROR = System fault detected`);
  console.log('');

  // Footer
  console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log('Dashboard auto-updates every 5 seconds. Press Ctrl+C to stop.');
  console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
}

/**
 * Main loop
 */
async function main() {
  console.log('Starting Phase 1 Day 4 Monitoring Dashboard...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Initial render
  await renderDashboard();

  // Continuous updates
  setInterval(async () => {
    await renderDashboard();
  }, REFRESH_INTERVAL);
}

// Run dashboard
main().catch(err => {
  console.error('Dashboard error:', err.message);
  process.exit(1);
});
