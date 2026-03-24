#!/usr/bin/env node
/**
 * P2P Network Metrics Collector
 * Collects and reports P2P bootstrap and provider discovery metrics
 * Used by: Phase 1 monitoring, continuous health tracking
 * Owner: P2P Network Engineer
 */

import fetch from 'node-fetch';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import sqlite3 from 'sqlite3';
import fs from 'fs/promises';

const exec = promisify(execCallback);

const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:8083',
  dbPath: process.env.DB_PATH || 'dcp.db',
  bootstrapHost: process.env.BOOTSTRAP_HOST || 'localhost',
  bootstrapPort: process.env.BOOTSTRAP_PORT || 30333,
  logFile: process.env.LOG_FILE || '/var/log/dc1-provider-onboarding.log',
  pollingInterval: process.env.POLLING_INTERVAL || 300000, // 5 minutes
  metricsFile: process.env.METRICS_FILE || '/tmp/p2p-metrics.json',
};

class P2PMetricsCollector {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      backend: null,
      bootstrap: null,
      providers: null,
      discovery: null,
      errors: [],
    };
  }

  // Collect backend API metrics
  async collectBackendMetrics() {
    try {
      const startTime = Date.now();
      const response = await fetch(`${config.backendUrl}/api/health`, {
        timeout: 5000,
      });
      const latency = Date.now() - startTime;

      this.metrics.backend = {
        healthy: response.ok,
        statusCode: response.status,
        latency: latency,
        timestamp: new Date().toISOString(),
      };

      // Collect provider count from API
      try {
        const providersResponse = await fetch(`${config.backendUrl}/api/providers/count`, {
          timeout: 5000,
        });

        if (providersResponse.ok) {
          const data = await providersResponse.json();
          if (!this.metrics.providers) this.metrics.providers = {};
          this.metrics.providers.apiCount = data.total || 0;
        }
      } catch (err) {
        this.metrics.errors.push(`Failed to fetch provider count: ${err.message}`);
      }
    } catch (err) {
      this.metrics.errors.push(`Backend health check failed: ${err.message}`);
      this.metrics.backend = { healthy: false, error: err.message };
    }
  }

  // Collect bootstrap connectivity metrics
  async collectBootstrapMetrics() {
    try {
      const startTime = Date.now();
      const { error } = await exec(`timeout 3 nc -zv ${config.bootstrapHost} ${config.bootstrapPort}`, {
        timeout: 5000,
      }).catch((e) => ({ error: e }));

      const latency = Date.now() - startTime;

      this.metrics.bootstrap = {
        reachable: !error,
        host: config.bootstrapHost,
        port: config.bootstrapPort,
        latency: latency,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.metrics.errors.push(`Bootstrap connectivity check failed: ${err.message}`);
      this.metrics.bootstrap = { reachable: false, error: err.message };
    }
  }

  // Collect provider database metrics
  async collectProviderMetrics() {
    try {
      const dbExists = await fs
        .access(config.dbPath)
        .then(() => true)
        .catch(() => false);

      if (!dbExists) {
        this.metrics.errors.push(`Database not found at ${config.dbPath}`);
        this.metrics.providers = { available: false };
        return;
      }

      const db = new sqlite3.Database(config.dbPath);
      const queries = [
        {
          name: 'totalProviders',
          sql: 'SELECT COUNT(*) as count FROM providers;',
        },
        {
          name: 'onlineProviders',
          sql: "SELECT COUNT(*) as count FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');",
        },
        {
          name: 'withPeerIds',
          sql: 'SELECT COUNT(*) as count FROM providers WHERE p2p_peer_id IS NOT NULL;',
        },
        {
          name: 'recentHeartbeats',
          sql: "SELECT COUNT(*) as count FROM heartbeat_log WHERE received_at > datetime('now', '-1 hour');",
        },
      ];

      const results = {};
      for (const query of queries) {
        results[query.name] = await this.executeDbQuery(db, query.sql);
      }

      db.close();

      this.metrics.providers = {
        available: true,
        total: results.totalProviders,
        online: results.onlineProviders,
        withPeerIds: results.withPeerIds,
        recentHeartbeats: results.recentHeartbeats,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.metrics.errors.push(`Provider metrics collection failed: ${err.message}`);
      this.metrics.providers = { available: false, error: err.message };
    }
  }

  // Execute database query
  executeDbQuery(db, sql) {
    return new Promise((resolve, reject) => {
      db.get(sql, (err, row) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });
  }

  // Collect provider discovery metrics
  async collectDiscoveryMetrics() {
    try {
      const startTime = Date.now();
      const response = await fetch(`${config.backendUrl}/api/providers/discover`, {
        timeout: 5000,
      });
      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        this.metrics.discovery = {
          available: true,
          latency: latency,
          providerCount: Array.isArray(data) ? data.length : 0,
          timestamp: new Date().toISOString(),
        };
      } else {
        this.metrics.errors.push(`Discovery endpoint returned ${response.status}`);
        this.metrics.discovery = { available: false, statusCode: response.status };
      }
    } catch (err) {
      this.metrics.errors.push(`Discovery metrics collection failed: ${err.message}`);
      this.metrics.discovery = { available: false, error: err.message };
    }
  }

  // Collect error logs
  async collectLogMetrics() {
    try {
      const logExists = await fs
        .access(config.logFile)
        .then(() => true)
        .catch(() => false);

      if (!logExists) {
        this.metrics.logs = { available: false };
        return;
      }

      const { stdout } = await exec(`tail -200 ${config.logFile} | grep -i "error\\|warning\\|critical" | wc -l`, {
        timeout: 5000,
      });

      const errorCount = parseInt(stdout.trim()) || 0;

      this.metrics.logs = {
        available: true,
        errorCount: errorCount,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.metrics.errors.push(`Log metrics collection failed: ${err.message}`);
      this.metrics.logs = { available: false };
    }
  }

  // Check PM2 service status
  async collectPM2Metrics() {
    try {
      const { stdout } = await exec('pm2 list --json', {
        timeout: 5000,
      }).catch(() => ({ stdout: '[]' }));

      const processes = JSON.parse(stdout);
      const p2pServices = processes.filter((p) => p.name.includes('dc1'));

      this.metrics.pm2 = {
        processCount: p2pServices.length,
        processes: p2pServices.map((p) => ({
          name: p.name,
          status: p.pm2_env?.status,
          uptime: p.pm2_env?.pm_uptime,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.metrics.pm2 = { available: false };
    }
  }

  // Calculate overall health status
  calculateHealthStatus() {
    const backendHealthy = this.metrics.backend?.healthy === true;
    const bootstrapReachable = this.metrics.bootstrap?.reachable === true;
    const providersHealthy =
      this.metrics.providers?.available === true && (this.metrics.providers?.total || 0) > 0;
    const discoveryWorking = this.metrics.discovery?.available === true;

    const status = backendHealthy && bootstrapReachable && providersHealthy && discoveryWorking ? 'healthy' : 'degraded';

    return {
      status: status,
      checks: {
        backend: backendHealthy,
        bootstrap: bootstrapReachable,
        providers: providersHealthy,
        discovery: discoveryWorking,
      },
    };
  }

  // Collect all metrics
  async collect() {
    console.log('[P2P Monitor] Starting metrics collection...');

    const startTime = Date.now();

    await Promise.all([
      this.collectBackendMetrics(),
      this.collectBootstrapMetrics(),
      this.collectProviderMetrics(),
      this.collectDiscoveryMetrics(),
      this.collectLogMetrics(),
      this.collectPM2Metrics(),
    ]);

    this.metrics.health = this.calculateHealthStatus();
    this.metrics.collectionTime = Date.now() - startTime;
    this.metrics.timestamp = new Date().toISOString();

    console.log(`[P2P Monitor] Collection completed in ${this.metrics.collectionTime}ms`);

    return this.metrics;
  }

  // Format metrics for output
  formatOutput() {
    return {
      timestamp: this.metrics.timestamp,
      health: this.metrics.health?.status || 'unknown',
      checks: this.metrics.health?.checks || {},
      backend: this.metrics.backend,
      bootstrap: this.metrics.bootstrap,
      providers: this.metrics.providers,
      discovery: this.metrics.discovery,
      pm2: this.metrics.pm2,
      errorCount: this.metrics.logs?.errorCount || 0,
      collectionTime: this.metrics.collectionTime,
      errors: this.metrics.errors,
    };
  }

  // Save metrics to file
  async saveMetrics() {
    try {
      await fs.writeFile(config.metricsFile, JSON.stringify(this.metrics, null, 2));
      console.log(`[P2P Monitor] Metrics saved to ${config.metricsFile}`);
    } catch (err) {
      console.error(`[P2P Monitor] Failed to save metrics: ${err.message}`);
    }
  }
}

// Main execution
async function main() {
  const collector = new P2PMetricsCollector();

  try {
    const metrics = await collector.collect();
    const output = collector.formatOutput();

    console.log('\n=== P2P Network Metrics ===');
    console.log(JSON.stringify(output, null, 2));

    await collector.saveMetrics();

    // Exit with code based on health status
    process.exit(output.health === 'healthy' ? 0 : 1);
  } catch (err) {
    console.error('[P2P Monitor] Fatal error:', err);
    process.exit(2);
  }
}

main();
