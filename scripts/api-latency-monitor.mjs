#!/usr/bin/env node

/**
 * API Latency Monitor
 *
 * Tracks request latency percentiles (p50, p95, p99) for Phase 1 monitoring
 * Helps identify performance regressions and bottlenecks
 *
 * Usage: node scripts/api-latency-monitor.mjs
 *
 * Output: Percentile summaries to stdout and JSON snapshots to backend/logs/
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.DCP_API_BASE || 'https://api.dcp.sa';
const SAMPLE_INTERVAL = 10000; // Sample every 10 seconds
const LOG_DIR = '../backend/logs';
const LOG_FILE = `${LOG_DIR}/api-latency-monitor.log`;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class LatencyTracker {
  constructor() {
    this.samples = [];
    this.endpoints = {
      '/api/health': [],
      '/api/models': [],
      '/api/templates': [],
      '/api/providers/available': []
    };
  }

  addSample(endpoint, latencyMs) {
    this.samples.push({ endpoint, latencyMs, timestamp: new Date() });
    if (this.endpoints[endpoint]) {
      this.endpoints[endpoint].push(latencyMs);
    }
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getStats() {
    const stats = {};
    for (const [endpoint, latencies] of Object.entries(this.endpoints)) {
      if (latencies.length > 0) {
        stats[endpoint] = {
          count: latencies.length,
          min: Math.min(...latencies),
          max: Math.max(...latencies),
          avg: Math.round(latencies.reduce((a, b) => a + b) / latencies.length),
          p50: this.percentile(latencies, 50),
          p95: this.percentile(latencies, 95),
          p99: this.percentile(latencies, 99)
        };
      }
    }
    return stats;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n');
  }

  reset() {
    for (const endpoint of Object.keys(this.endpoints)) {
      this.endpoints[endpoint] = [];
    }
  }
}

const tracker = new LatencyTracker();

async function sampleEndpoints() {
  const endpoints = [
    '/api/health',
    '/api/models',
    '/api/templates',
    '/api/providers/available'
  ];

  for (const endpoint of endpoints) {
    try {
      const start = Date.now();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        timeout: 10000,
        headers: { 'User-Agent': 'latency-monitor' }
      });
      const latency = Date.now() - start;

      if (response.ok) {
        tracker.addSample(endpoint, latency);
      } else {
        tracker.log(`⚠️ ${endpoint}: ${response.status} (${latency}ms)`);
      }
    } catch (e) {
      tracker.log(`❌ ${endpoint}: ${e.message}`);
    }
  }
}

async function monitor() {
  tracker.log('API Latency Monitor started');
  tracker.log(`Sampling every ${SAMPLE_INTERVAL}ms | API: ${API_BASE}`);

  let sampleCount = 0;
  let reportCount = 0;

  // Sample immediately, then every SAMPLE_INTERVAL
  setInterval(async () => {
    sampleCount++;
    await sampleEndpoints();

    // Report every 60 seconds (6 samples at 10s interval)
    if (sampleCount % 6 === 0) {
      reportCount++;
      const stats = tracker.getStats();

      // Log percentile summary
      tracker.log(`\n📊 Report #${reportCount} — Latency Percentiles (${sampleCount} samples)\n` +
        JSON.stringify(stats, null, 2));

      // Write JSON snapshot
      const snapshot = {
        report: reportCount,
        timestamp: new Date().toISOString(),
        totalSamples: sampleCount,
        stats
      };
      fs.writeFileSync(
        `${LOG_DIR}/api-latency-report-${reportCount}.json`,
        JSON.stringify(snapshot, null, 2)
      );

      // Check for latency spikes
      for (const [endpoint, latencies] of Object.entries(tracker.endpoints)) {
        if (latencies.length > 0) {
          const latest = latencies[latencies.length - 1];
          const avg = latencies.reduce((a, b) => a + b) / latencies.length;
          if (latest > avg * 1.5) {
            tracker.log(`⚠️ Latency spike on ${endpoint}: ${latest}ms (avg ${Math.round(avg)}ms)`);
          }
        }
      }

      // Reset for next report window
      tracker.reset();
    }
  }, SAMPLE_INTERVAL);

  process.on('SIGINT', () => {
    const stats = tracker.getStats();
    tracker.log(`\nMonitor stopped after ${sampleCount} samples, ${reportCount} reports`);
    tracker.log(`Final stats: ${JSON.stringify(stats, null, 2)}`);
    process.exit(0);
  });
}

monitor().catch(err => {
  tracker.log(`Fatal error: ${err.message}`);
  process.exit(1);
});
