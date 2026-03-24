#!/usr/bin/env node

/**
 * Phase 1 Day 4 — Real-Time Monitoring Dashboard
 *
 * Purpose: Live system health monitoring during Day 4 execution
 * Usage: Run in Terminal 3 during Day 4 (08:00-12:00 UTC)
 * Refresh: 5-second intervals
 *
 * Displays:
 * - API health (response time, HTTP status)
 * - Model catalog status (count, pricing)
 * - Backend logs (recent errors)
 * - System resources (memory, CPU)
 * - Test progress (real-time status)
 */

import fetch from 'node-fetch';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const API_URL = 'https://api.dcp.sa';
const REFRESH_INTERVAL = 5000; // 5 seconds
const LOG_FILE = '/home/node/dc1-platform/backend/logs/app.log';
const STATUS_FILE = '/tmp/day4-test-status.json';

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Health status tracker
let lastCheck = null;
let apiErrors = [];
let modelCount = 0;
let systemStats = {
  memory: 0,
  cpu: 0,
  errors: 0,
};

/**
 * Check API health
 */
async function checkApiHealth() {
  try {
    const start = Date.now();
    const response = await fetch(`${API_URL}/api/models`, { timeout: 5000 });
    const responseTime = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      modelCount = data.length || 0;
      return {
        status: 'OK',
        statusCode: response.status,
        responseTime,
        modelCount,
        error: null,
      };
    } else {
      return {
        status: 'ERROR',
        statusCode: response.status,
        responseTime,
        modelCount: 0,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    apiErrors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
    });
    return {
      status: 'DOWN',
      statusCode: 0,
      responseTime: null,
      modelCount: 0,
      error: error.message,
    };
  }
}

/**
 * Get recent errors from backend logs
 */
function getRecentErrors() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }

    const logs = execSync(`tail -50 ${LOG_FILE} 2>/dev/null | grep -i "error\\|fail\\|warn" || true`).toString();
    return logs.split('\n').filter(line => line.trim()).slice(-5); // Last 5 errors
  } catch (error) {
    return [];
  }
}

/**
 * Get system resource usage
 */
function getSystemStats() {
  try {
    // Get memory usage
    const memInfo = execSync("free | grep Mem | awk '{print ($3/$2) * 100}'").toString().trim();
    const memory = parseFloat(memInfo) || 0;

    // Get CPU usage (simple approach)
    const cpu = parseFloat(
      execSync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'").toString().trim()
    ) || 0;

    return { memory: memory.toFixed(1), cpu: cpu.toFixed(1) };
  } catch (error) {
    return { memory: 'N/A', cpu: 'N/A' };
  }
}

/**
 * Get test progress from status file
 */
function getTestProgress() {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      return { current: 'Initializing...', count: 0, passed: 0, failed: 0 };
    }

    const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    return status;
  } catch (error) {
    return { current: 'Error reading status', count: 0, passed: 0, failed: 0 };
  }
}

/**
 * Render dashboard
 */
async function renderDashboard() {
  const apiHealth = await checkApiHealth();
  const errors = getRecentErrors();
  const stats = getSystemStats();
  const progress = getTestProgress();

  console.clear();

  // Header
  console.log(`${colors.bold}${colors.cyan}=== PHASE 1 DAY 4 MONITORING DASHBOARD ===${colors.reset}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // API Health Section
  console.log(`${colors.bold}API HEALTH:${colors.reset}`);
  const apiStatusColor = apiHealth.status === 'OK' ? colors.green :
                          apiHealth.status === 'ERROR' ? colors.yellow : colors.red;
  console.log(`  Status: ${apiStatusColor}${apiHealth.status}${colors.reset}`);
  if (apiHealth.responseTime !== null) {
    const timeColor = apiHealth.responseTime < 200 ? colors.green :
                      apiHealth.responseTime < 500 ? colors.yellow : colors.red;
    console.log(`  Response Time: ${timeColor}${apiHealth.responseTime}ms${colors.reset}`);
  }
  console.log(`  HTTP Status: ${apiHealth.statusCode}`);
  console.log(`  Model Catalog: ${colors.cyan}${modelCount}/11${colors.reset} models`);

  // System Resources
  console.log('');
  console.log(`${colors.bold}SYSTEM RESOURCES:${colors.reset}`);
  const memColor = parseFloat(stats.memory) < 70 ? colors.green :
                   parseFloat(stats.memory) < 85 ? colors.yellow : colors.red;
  const cpuColor = parseFloat(stats.cpu) < 70 ? colors.green :
                   parseFloat(stats.cpu) < 85 ? colors.yellow : colors.red;
  console.log(`  Memory: ${memColor}${stats.memory}%${colors.reset}`);
  console.log(`  CPU: ${cpuColor}${stats.cpu}%${colors.reset}`);

  // Test Progress
  console.log('');
  console.log(`${colors.bold}TEST PROGRESS:${colors.reset}`);
  console.log(`  Current: ${progress.current}`);
  console.log(`  Tests: ${colors.green}${progress.passed} passed${colors.reset} / ${colors.red}${progress.failed} failed${colors.reset} / ${progress.count} total`);

  // Recent Errors
  console.log('');
  console.log(`${colors.bold}RECENT ERRORS (Last 5):${colors.reset}`);
  if (errors.length === 0) {
    console.log(`  ${colors.green}✓ No errors${colors.reset}`);
  } else {
    errors.forEach((error, i) => {
      const shortError = error.length > 80 ? error.substring(0, 77) + '...' : error;
      console.log(`  ${i + 1}. ${colors.red}${shortError}${colors.reset}`);
    });
  }

  // Summary
  console.log('');
  console.log(`${colors.bold}SUMMARY:${colors.reset}`);
  const overallStatus = apiHealth.status === 'OK' && errors.length === 0 && progress.failed === 0;
  const statusColor = overallStatus ? colors.green : colors.red;
  console.log(`  Status: ${statusColor}${overallStatus ? '✓ HEALTHY' : '✗ ISSUES DETECTED'}${colors.reset}`);
  console.log(`  API Errors (session): ${apiErrors.length}`);

  // Alert if issues
  if (!overallStatus) {
    console.log('');
    console.log(`${colors.bold}${colors.red}⚠ ALERT: Check errors above and refer to Rapid Response Playbook${colors.reset}`);
  }

  // Footer
  console.log('');
  console.log(`Next refresh: ${(REFRESH_INTERVAL / 1000).toFixed(0)}s | Press Ctrl+C to stop`);
}

/**
 * Main loop
 */
async function main() {
  console.log('Starting Phase 1 Day 4 Monitoring Dashboard...');
  console.log('Press Ctrl+C to stop');

  // Initial render
  await renderDashboard();

  // Refresh every interval
  setInterval(renderDashboard, REFRESH_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nMonitoring dashboard stopped.');
  process.exit(0);
});

main().catch(error => {
  console.error('Dashboard error:', error);
  process.exit(1);
});
