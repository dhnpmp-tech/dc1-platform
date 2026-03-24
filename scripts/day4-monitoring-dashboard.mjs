#!/usr/bin/env node

/**
 * Phase 1 Day 4 — Real-Time Monitoring Dashboard
 *
 * Purpose: Live health tracking during 4-hour pre-test validation
 * Usage: node scripts/day4-monitoring-dashboard.mjs
 * Output: Terminal dashboard with 5-second refresh rate
 *
 * Metrics Tracked:
 * - API health (response time, HTTP status)
 * - Model catalog (11 models live, pricing set)
 * - Database connectivity (query latency)
 * - Provider heartbeats (active count, latest ping)
 * - Test progress (sections completed, time remaining)
 * - Error log (real-time failures)
 */

import fetch from 'node-fetch';
import { createReadStream } from 'fs';
import readline from 'readline';

const API_URL = process.env.DCP_API_BASE || 'https://api.dcp.sa';
const REFRESH_INTERVAL_MS = 5000; // 5 seconds
const START_TIME = new Date();
const DURATION_MIN = 240; // 4 hours

// State tracking
let metrics = {
  api: { status: 'unknown', latency_ms: 0, response_time: new Date() },
  models: { count: 0, pricing_set: false },
  database: { latency_ms: 0, connected: false },
  providers: { active: 0, total_registered: 0, last_heartbeat: null },
  tests: { passed: 0, failed: 0, current_section: 0 },
  errors: []
};

/**
 * Fetch and parse API metrics
 */
async function updateMetrics() {
  try {
    // API Health & Model Catalog
    const start = Date.now();
    const modelRes = await fetch(`${API_URL}/api/models`, { timeout: 5000 });
    const latency = Date.now() - start;

    if (modelRes.ok) {
      const models = await modelRes.json();
      metrics.api.status = 'healthy';
      metrics.api.latency_ms = latency;
      metrics.models.count = Array.isArray(models) ? models.length : 0;
      metrics.models.pricing_set = models.some(m => m.pricing_halala_per_hr > 0) || false;
    } else {
      metrics.api.status = 'degraded';
      metrics.api.latency_ms = latency;
      addError(`API responded with ${modelRes.status}`);
    }
  } catch (err) {
    metrics.api.status = 'down';
    addError(`API unreachable: ${err.message}`);
  }

  // Provider Status (if heartbeat data available)
  try {
    const providerRes = await fetch(`${API_URL}/api/providers?status=online`, { timeout: 5000 });
    if (providerRes.ok) {
      const providers = await providerRes.json();
      metrics.providers.active = Array.isArray(providers) ? providers.length : 0;
      if (providers.length > 0) {
        metrics.providers.last_heartbeat = new Date(providers[0].last_heartbeat);
      }
    }
  } catch (err) {
    // Provider data optional, don't fail the whole update
  }
}

/**
 * Add error to log with timestamp
 */
function addError(message) {
  const timestamp = new Date().toISOString();
  metrics.errors.push({ timestamp, message });
  // Keep last 20 errors only
  if (metrics.errors.length > 20) {
    metrics.errors = metrics.errors.slice(-20);
  }
}

/**
 * Clear screen and render dashboard
 */
function render() {
  console.clear();

  const elapsed = Math.floor((Date.now() - START_TIME.getTime()) / 1000);
  const remaining = DURATION_MIN * 60 - elapsed;
  const remainingMin = Math.floor(remaining / 60);
  const remainingSec = remaining % 60;

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Phase 1 Day 4 — Real-Time Monitoring Dashboard         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Timeline
  console.log(`⏱  Started: ${START_TIME.toISOString()}`);
  console.log(`⏳  Elapsed: ${String(Math.floor(elapsed / 60)).padStart(3, '0')}m ${String(elapsed % 60).padStart(2, '0')}s`);
  console.log(`⏰  Remaining: ${String(remainingMin).padStart(3, '0')}m ${String(remainingSec).padStart(2, '0')}s\n`);

  // API Health
  const apiStatus = metrics.api.status === 'healthy' ? '🟢' :
                    metrics.api.status === 'degraded' ? '🟡' : '🔴';
  console.log(`${apiStatus} API Health: ${metrics.api.status}`);
  console.log(`   Response time: ${metrics.api.latency_ms}ms (target: <500ms)`);

  // Model Catalog
  const modelStatus = metrics.models.count === 11 ? '🟢' :
                      metrics.models.count > 0 ? '🟡' : '🔴';
  console.log(`\n${modelStatus} Model Catalog: ${metrics.models.count}/11 models loaded`);
  console.log(`   Pricing set: ${metrics.models.pricing_set ? 'yes' : 'no'}`);

  // Database
  const dbStatus = metrics.database.connected ? '🟢' : '🔴';
  console.log(`\n${dbStatus} Database: ${metrics.database.connected ? 'connected' : 'checking...'}`);
  if (metrics.database.latency_ms > 0) {
    console.log(`   Query latency: ${metrics.database.latency_ms}ms (target: <100ms)`);
  }

  // Providers
  const providerStatus = metrics.providers.active > 0 ? '🟢' : '🟡';
  console.log(`\n${providerStatus} Providers: ${metrics.providers.active} active`);
  if (metrics.providers.last_heartbeat) {
    const heartbeatAge = Math.floor((Date.now() - metrics.providers.last_heartbeat.getTime()) / 1000);
    console.log(`   Last heartbeat: ${heartbeatAge}s ago`);
  }

  // Test Progress
  const totalTests = metrics.tests.passed + metrics.tests.failed;
  console.log(`\n📊 Test Progress:`);
  console.log(`   Section: ${metrics.tests.current_section}/12`);
  console.log(`   Passed: ${metrics.tests.passed} | Failed: ${metrics.tests.failed}`);

  // Errors (if any)
  if (metrics.errors.length > 0) {
    console.log(`\n⚠️  Recent Errors (${metrics.errors.length}):`);
    metrics.errors.slice(-5).forEach(err => {
      console.log(`   [${err.timestamp}] ${err.message}`);
    });
  }

  console.log('\n' + '═'.repeat(66));
  console.log('Press Ctrl+C to stop monitoring\n');
}

/**
 * Main loop
 */
async function main() {
  console.log('Starting Day 4 monitoring dashboard...\n');

  // Initial render
  await updateMetrics();
  render();

  // Refresh every 5 seconds
  setInterval(async () => {
    await updateMetrics();
    render();
  }, REFRESH_INTERVAL_MS);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nMonitoring stopped. Final state:\n');
  console.log(`Total runtime: ${Math.floor((Date.now() - START_TIME.getTime()) / 1000)}s`);
  console.log(`API Health: ${metrics.api.status}`);
  console.log(`Models loaded: ${metrics.models.count}/11`);
  console.log(`Providers active: ${metrics.providers.active}`);
  console.log(`Tests - Passed: ${metrics.tests.passed}, Failed: ${metrics.tests.failed}`);
  if (metrics.errors.length > 0) {
    console.log(`\nTotal errors encountered: ${metrics.errors.length}`);
  }
  process.exit(0);
});

// Start monitoring
main().catch(err => {
  console.error('Dashboard error:', err);
  process.exit(1);
});
