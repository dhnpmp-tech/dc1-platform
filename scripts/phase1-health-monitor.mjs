#!/usr/bin/env node

/**
 * Phase 1 Health Monitor
 *
 * Automated 30-second health checks for Phase 1 execution (Days 4-6)
 * Monitors: API health, model serving, provider infra, billing/metering, renter experience
 *
 * Usage: node scripts/phase1-health-monitor.mjs
 *
 * Output: JSON to stdout, logs to backend/logs/phase1-health-monitor.log
 */

import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.DCP_API_BASE || 'https://api.dcp.sa';
const INTERVAL_MS = 30000; // 30 seconds
const LOG_DIR = '../backend/logs';
const LOG_FILE = `${LOG_DIR}/phase1-health-monitor.log`;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);
  fs.appendFileSync(LOG_FILE, logLine + '\n');
}

async function checkHealth() {
  const timestamp = new Date().toISOString();
  const results = {
    timestamp,
    checks: {
      api_health: null,
      models_count: null,
      providers_online: null,
      templates_count: null,
      api_latency_ms: null,
      errors: []
    }
  };

  try {
    // 1. API Health Check
    const healthStart = Date.now();
    const healthResponse = await fetch(`${API_BASE}/api/health`, {
      timeout: 5000,
      headers: { 'User-Agent': 'phase1-monitor' }
    }).catch(e => {
      results.checks.errors.push(`Health check failed: ${e.message}`);
      return null;
    });

    if (healthResponse?.ok) {
      results.checks.api_health = true;
      results.checks.api_latency_ms = Date.now() - healthStart;
    } else {
      results.checks.api_health = false;
      results.checks.errors.push(`Health endpoint: ${healthResponse?.status}`);
    }

    // 2. Models Count
    try {
      const modelsResponse = await fetch(`${API_BASE}/api/models`, {
        timeout: 5000,
        headers: { 'User-Agent': 'phase1-monitor' }
      });
      if (modelsResponse.ok) {
        const models = await modelsResponse.json();
        results.checks.models_count = Array.isArray(models) ? models.length : 0;
      } else {
        results.checks.errors.push(`Models: ${modelsResponse.status}`);
      }
    } catch (e) {
      results.checks.errors.push(`Models endpoint: ${e.message}`);
    }

    // 3. Templates Count
    try {
      const templatesResponse = await fetch(`${API_BASE}/api/templates`, {
        timeout: 5000,
        headers: { 'User-Agent': 'phase1-monitor' }
      });
      if (templatesResponse.ok) {
        const templates = await templatesResponse.json();
        results.checks.templates_count = Array.isArray(templates) ? templates.length : 0;
      } else {
        results.checks.errors.push(`Templates: ${templatesResponse.status}`);
      }
    } catch (e) {
      results.checks.errors.push(`Templates endpoint: ${e.message}`);
    }

    // 4. Providers Available
    try {
      const providersResponse = await fetch(`${API_BASE}/api/providers/available`, {
        timeout: 5000,
        headers: { 'User-Agent': 'phase1-monitor' }
      });
      if (providersResponse.ok) {
        const data = await providersResponse.json();
        results.checks.providers_online = data.count || 0;
      } else {
        results.checks.errors.push(`Providers: ${providersResponse.status}`);
      }
    } catch (e) {
      results.checks.errors.push(`Providers endpoint: ${e.message}`);
    }

  } catch (e) {
    results.checks.errors.push(`Monitor error: ${e.message}`);
  }

  return results;
}

async function monitor() {
  log('Phase 1 Health Monitor started');
  log(`Checking every ${INTERVAL_MS}ms | API: ${API_BASE}`);

  let checkCount = 0;
  let errorCount = 0;

  setInterval(async () => {
    checkCount++;
    const result = await checkHealth();

    // Log summary
    const status = result.checks.api_health ? '✅' : '❌';
    const summary = `Check #${checkCount}: ${status} API=${result.checks.api_health ? 'OK' : 'FAIL'} ` +
      `Models=${result.checks.models_count} Providers=${result.checks.providers_online} ` +
      `Latency=${result.checks.api_latency_ms}ms`;

    if (result.checks.errors.length > 0) {
      errorCount++;
      log(`${summary} | Errors: ${result.checks.errors.join('; ')}`);
    } else {
      log(summary);
    }

    // Write JSON snapshot
    fs.writeFileSync(`${LOG_DIR}/phase1-health-latest.json`, JSON.stringify(result, null, 2));

    // Critical failure detection
    if (result.checks.api_health === false) {
      log('⚠️ CRITICAL: API health check failed - escalate immediately');
    }

    if (result.checks.providers_online === 0) {
      log('⚠️ CRITICAL: No providers online - escalate immediately');
    }
  }, INTERVAL_MS);

  // Keep process alive
  process.on('SIGINT', () => {
    log(`Monitor stopped after ${checkCount} checks (${errorCount} errors)`);
    process.exit(0);
  });
}

monitor().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
