#!/usr/bin/env node

/**
 * Provider Uptime Check
 *
 * Daily monitoring of provider availability and heartbeat status
 * Generates uptime reports for Phase 1 execution
 *
 * Usage: node scripts/provider-uptime-check.mjs
 *
 * Output: JSON reports to backend/logs/provider-uptime-*.json
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.DCP_API_BASE || 'https://api.dcp.sa';
const CHECK_INTERVAL = 300000; // 5 minutes
const LOG_DIR = '../backend/logs';
const STATE_FILE = '../infra/state/provider-health.json';

// Ensure directories exist
[LOG_DIR, '../infra/state'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const LOG_FILE = `${LOG_DIR}/provider-uptime-check.log`;

class UptimeTracker {
  constructor() {
    this.providers = new Map();
    this.checkCount = 0;
    this.startTime = new Date();
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n');
  }

  recordCheck(providerId, online) {
    if (!this.providers.has(providerId)) {
      this.providers.set(providerId, {
        id: providerId,
        checks: [],
        onlineCount: 0,
        offlineCount: 0
      });
    }

    const provider = this.providers.get(providerId);
    provider.checks.push({
      timestamp: new Date(),
      online
    });

    if (online) {
      provider.onlineCount++;
    } else {
      provider.offlineCount++;
    }

    // Keep only last 288 checks (24 hours at 5-min intervals)
    if (provider.checks.length > 288) {
      provider.checks.shift();
    }
  }

  getUptimePercent(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider || provider.checks.length === 0) return 0;
    return (provider.onlineCount / provider.checks.length) * 100;
  }

  generateReport() {
    const totalUptime = Array.from(this.providers.values())
      .reduce((sum, p) => sum + this.getUptimePercent(p.id), 0) / (this.providers.size || 1);

    const report = {
      timestamp: new Date().toISOString(),
      checkNumber: this.checkCount,
      totalProviders: this.providers.size,
      overallUptimePercent: Math.round(totalUptime * 100) / 100,
      providers: Array.from(this.providers.values()).map(p => ({
        id: p.id,
        uptimePercent: Math.round(this.getUptimePercent(p.id) * 100) / 100,
        checksRecorded: p.checks.length,
        onlineCount: p.onlineCount,
        offlineCount: p.offlineCount,
        lastStatus: p.checks.length > 0 ? p.checks[p.checks.length - 1].online : null
      }))
    };

    return report;
  }

  saveState() {
    const state = {
      timestamp: new Date().toISOString(),
      totalChecks: this.checkCount,
      startTime: this.startTime.toISOString(),
      providers: Array.from(this.providers.values()).map(p => ({
        id: p.id,
        latestStatus: p.checks.length > 0 ? p.checks[p.checks.length - 1].online : null,
        latestTimestamp: p.checks.length > 0 ? p.checks[p.checks.length - 1].timestamp : null,
        uptime: Math.round(this.getUptimePercent(p.id) * 100) / 100
      }))
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }
}

const tracker = new UptimeTracker();

async function checkProviders() {
  tracker.checkCount++;

  try {
    const response = await fetch(`${API_BASE}/api/providers/available`, {
      timeout: 10000,
      headers: { 'User-Agent': 'uptime-check' }
    });

    if (!response.ok) {
      tracker.log(`❌ Failed to fetch providers: ${response.status}`);
      return;
    }

    const data = await response.json();
    const providers = data.providers || [];

    // Record online providers
    const onlineIds = new Set();
    providers.forEach(p => {
      tracker.recordCheck(p.id, true);
      onlineIds.add(p.id);
    });

    // If we've seen providers before, mark missing ones as offline
    for (const providerId of tracker.providers.keys()) {
      if (!onlineIds.has(providerId)) {
        tracker.recordCheck(providerId, false);
      }
    }

    // Log summary
    const report = tracker.generateReport();
    const statusLine = `Check #${tracker.checkCount}: ${report.totalProviders} providers, ` +
      `${report.overallUptimePercent}% overall uptime`;
    tracker.log(statusLine);

    // Save state
    tracker.saveState();

    // Report every 12 checks (1 hour)
    if (tracker.checkCount % 12 === 0) {
      const reportPath = `${LOG_DIR}/provider-uptime-report-${tracker.checkCount}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      tracker.log(`📊 Hourly report saved: ${reportPath}`);

      // Check for critical issues
      const criticalProviders = report.providers.filter(p => p.uptimePercent < 95);
      if (criticalProviders.length > 0) {
        tracker.log(`⚠️ ${criticalProviders.length} providers below 95% uptime: ` +
          criticalProviders.map(p => `${p.id}(${p.uptimePercent}%)`).join(', '));
      }
    }

  } catch (e) {
    tracker.log(`❌ Check failed: ${e.message}`);
  }
}

async function monitor() {
  tracker.log('Provider Uptime Monitor started');
  tracker.log(`Checking every ${CHECK_INTERVAL / 1000}s | API: ${API_BASE}`);

  // Check immediately
  await checkProviders();

  // Then check every interval
  setInterval(async () => {
    await checkProviders();
  }, CHECK_INTERVAL);

  process.on('SIGINT', () => {
    const report = tracker.generateReport();
    tracker.log(`\nMonitor stopped after ${tracker.checkCount} checks`);
    tracker.log(`Final report: ${JSON.stringify(report, null, 2)}`);
    process.exit(0);
  });
}

monitor().catch(err => {
  tracker.log(`Fatal error: ${err.message}`);
  process.exit(1);
});
