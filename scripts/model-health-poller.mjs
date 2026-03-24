#!/usr/bin/env node

/**
 * Model Serving Health Poller
 *
 * Monitors health of active providers and their vLLM endpoints.
 * Records health status, latency, and model availability for each provider.
 *
 * Features:
 * - Polls GET /api/admin/providers?status=online for active provider list
 * - Probes vLLM /health endpoint on each provider
 * - Records: provider_id, provider_name, gpu_model, model_id, is_healthy, latency_ms, checked_at
 * - Writes results to infra/state/provider-health.json
 * - Designed to run via PM2 on the VPS as a background health monitor
 * - Uses exponential backoff for failed providers
 *
 * Usage:
 *   node scripts/model-health-poller.mjs [--api-url http://localhost:8083] [--output infra/state/provider-health.json] [--interval 300000]
 *
 * Environment variables:
 *   POLLER_API_URL — Backend API base URL (default: http://localhost:8083)
 *   POLLER_OUTPUT_PATH — Output file path (default: infra/state/provider-health.json)
 *   POLLER_INTERVAL_MS — Polling interval in milliseconds (default: 300000 = 5 minutes)
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  apiUrl: process.env.POLLER_API_URL || 'http://localhost:8083',
  outputPath: process.env.POLLER_OUTPUT_PATH || path.join(__dirname, '../infra/state/provider-health.json'),
  intervalMs: parseInt(process.env.POLLER_INTERVAL_MS || '300000'),
  timeoutMs: 5000,
  retryLimit: 3,
};

// Parse command-line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--api-url' && args[i + 1]) {
    config.apiUrl = args[i + 1];
    i++;
  }
  if (args[i] === '--output' && args[i + 1]) {
    config.outputPath = args[i + 1];
    i++;
  }
  if (args[i] === '--interval' && args[i + 1]) {
    config.intervalMs = parseInt(args[i + 1]);
    i++;
  }
}

// State tracking
const providerBackoffMap = new Map(); // Track retry backoff per provider

/**
 * Fetch online providers from backend admin API
 * @returns {Promise<Array>} Array of provider objects with id, name, gpu_model
 */
async function getOnlineProviders() {
  try {
    const url = `${config.apiUrl}/api/admin/providers?status=online`;
    const response = await fetch(url, { timeout: config.timeoutMs });

    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch providers: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.providers || [];
  } catch (error) {
    console.warn(`⚠️  Error fetching online providers: ${error.message}`);
    return [];
  }
}

/**
 * Probe vLLM health endpoint for a provider
 * @param {string} providerId - Provider ID
 * @param {string} providerIp - Provider IP address
 * @param {number} port - vLLM port (default 8000)
 * @returns {Promise<{is_healthy: boolean, latency_ms: number, models: Array, error?: string}>}
 */
async function probeProviderHealth(providerId, providerIp, port = 8000) {
  const startTime = Date.now();

  try {
    // Check if provider is in backoff (exponential backoff on consecutive failures)
    const backoffEntry = providerBackoffMap.get(providerId);
    if (backoffEntry && backoffEntry.retries > 0) {
      const backoffMs = Math.min(1000 * Math.pow(2, backoffEntry.retries - 1), 30000); // Max 30s backoff
      const timeSinceLastFailure = Date.now() - backoffEntry.lastFailureTime;

      if (timeSinceLastFailure < backoffMs) {
        return {
          is_healthy: false,
          latency_ms: 0,
          models: [],
          error: `Backoff active (${backoffEntry.retries}/${config.retryLimit} retries)`,
        };
      }
    }

    const healthUrl = `http://${providerIp}:${port}/health`;
    const response = await fetch(healthUrl, { timeout: config.timeoutMs });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      recordFailure(providerId);
      return {
        is_healthy: false,
        latency_ms: latency,
        models: [],
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    clearBackoff(providerId);

    return {
      is_healthy: data.status === 'healthy' || data.status === 'ok',
      latency_ms: latency,
      models: data.model_names || [],
      error: null,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    recordFailure(providerId);

    return {
      is_healthy: false,
      latency_ms: latency,
      models: [],
      error: error.message,
    };
  }
}

/**
 * Record a health probe failure for backoff calculation
 */
function recordFailure(providerId) {
  const entry = providerBackoffMap.get(providerId) || { retries: 0, lastFailureTime: Date.now() };
  entry.retries = Math.min(entry.retries + 1, config.retryLimit);
  entry.lastFailureTime = Date.now();
  providerBackoffMap.set(providerId, entry);
}

/**
 * Clear backoff tracking after successful probe
 */
function clearBackoff(providerId) {
  providerBackoffMap.delete(providerId);
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  const dir = path.dirname(config.outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Run a single health polling cycle
 */
async function pollHealthStatus() {
  const checkedAt = new Date().toISOString();

  console.log(`🔄 [${checkedAt}] Polling provider health...`);

  try {
    const providers = await getOnlineProviders();
    console.log(`📦 Found ${providers.length} online provider(s)`);

    const results = [];

    for (const provider of providers) {
      process.stdout.write(`  • ${provider.name} (${provider.gpu_model})... `);

      const health = await probeProviderHealth(provider.id, provider.provider_ip);

      const result = {
        provider_id: provider.id,
        provider_name: provider.name,
        gpu_model: provider.gpu_model,
        gpu_count: provider.gpu_count || 1,
        vram_gb: provider.vram_gb || 0,
        is_healthy: health.is_healthy,
        latency_ms: health.latency_ms,
        models: health.models,
        checked_at: checkedAt,
        error: health.error,
      };

      results.push(result);

      if (health.is_healthy) {
        console.log(`✅ Healthy (${health.latency_ms}ms, ${health.models.length} models)`);
      } else {
        console.log(`❌ Unhealthy (${health.error || 'timeout'})`);
      }
    }

    // Write results to file
    ensureOutputDir();
    const output = {
      version: '2026-03-24',
      timestamp: checkedAt,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.is_healthy).length,
        unhealthy: results.filter(r => !r.is_healthy).length,
      },
      providers: results,
    };

    fs.writeFileSync(config.outputPath, JSON.stringify(output, null, 2));
    console.log(`✅ Results written to ${config.outputPath}\n`);

    return output;
  } catch (error) {
    console.error(`❌ Polling error: ${error.message}\n`);
    return null;
  }
}

/**
 * Main loop: poll health at configured interval
 */
async function runHealthPoller() {
  console.log(`🚀 Health Poller started`);
  console.log(`   API URL: ${config.apiUrl}`);
  console.log(`   Output: ${config.outputPath}`);
  console.log(`   Interval: ${config.intervalMs}ms\n`);

  // Run once immediately
  await pollHealthStatus();

  // Then run on interval
  setInterval(async () => {
    await pollHealthStatus();
  }, config.intervalMs);
}

// Start the poller
runHealthPoller().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
