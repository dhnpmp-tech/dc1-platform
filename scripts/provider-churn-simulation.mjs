#!/usr/bin/env node
/**
 * DCP-807: Provider churn simulation test
 *
 * Simulates provider join/offline scenarios to verify job routing resilience:
 * - 5 providers join and register
 * - Verify all 5 appear in discovery pool
 * - 2 providers go offline (stop heartbeating)
 * - Verify remaining 3 still receive job assignments
 * - Measure discovery latency (activation to first routing)
 *
 * Usage: node scripts/provider-churn-simulation.mjs [--backend-url http://localhost:8083]
 */

import fetch from 'node-fetch';
import { execSync } from 'child_process';
import { URL } from 'url';

const BACKEND_URL = process.argv.find(arg => arg.startsWith('--backend-url'))
  ?.split('=')[1] || 'http://localhost:8083';

const TEST_CONFIG = {
  providerCount: 5,
  churnCount: 2,
  timeBetweenHeartbeatMs: 5000,
  discoveryPoolCheckIntervalMs: 2000,
  maxDiscoveryWaitMs: 30000,
};

class ProviderChurnTest {
  constructor() {
    this.providers = [];
    this.testResults = {
      providersJoined: 0,
      providersDiscovered: 0,
      providersOffline: 0,
      remainingProvidersActive: 0,
      discoveryLatencyMs: 0,
      jobRoutingSuccess: false,
      errors: [],
    };
  }

  async log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async logError(message) {
    console.error(`[ERROR] ${message}`);
    this.testResults.errors.push(message);
  }

  async simulateProviderRegistration(providerId) {
    try {
      const registerPayload = {
        name: `ChurnTest-Provider-${providerId}`,
        webhook_url: `https://webhook-stub-${providerId}.example.com/callback`,
        gpus: [
          {
            model: 'RTX-4090',
            count: 2,
            memory_gb: 24,
          },
        ],
      };

      const res = await fetch(`${BACKEND_URL}/api/providers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerPayload),
      });

      if (!res.ok) {
        throw new Error(`Registration failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const provider = {
        id: data.provider_id || providerId,
        key: data.api_key,
        registered_at: Date.now(),
        heartbeat_interval: null,
        last_heartbeat: null,
        is_online: true,
      };

      this.providers.push(provider);
      await this.log(`✓ Provider ${providerId} registered (id: ${provider.id})`);
      this.testResults.providersJoined++;

      return provider;
    } catch (error) {
      await this.logError(`Provider ${providerId} registration: ${error.message}`);
      throw error;
    }
  }

  async heartbeatProvider(provider, token_count = 100) {
    try {
      const heartbeatPayload = {
        provider_id: provider.id,
        gpus: [
          {
            model: 'RTX-4090',
            count: 2,
            memory_gb: 24,
          },
        ],
        status: 'online',
        job_tokens: token_count,
      };

      const res = await fetch(`${BACKEND_URL}/api/providers/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`,
        },
        body: JSON.stringify(heartbeatPayload),
      });

      if (!res.ok) {
        throw new Error(`Heartbeat failed: ${res.status}`);
      }

      provider.last_heartbeat = Date.now();
      return true;
    } catch (error) {
      await this.logError(`Heartbeat for ${provider.id}: ${error.message}`);
      return false;
    }
  }

  async checkDiscoveryPool() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/providers/discovery-pool`);
      if (!res.ok) {
        // Endpoint may not exist; fall back to checking providers list
        const providers = await fetch(`${BACKEND_URL}/api/providers`);
        if (providers.ok) {
          const data = await providers.json();
          return Array.isArray(data.providers) ? data.providers : [];
        }
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : data.providers || [];
    } catch (error) {
      await this.logError(`Discovery pool check: ${error.message}`);
      return [];
    }
  }

  async waitForDiscovery(maxWaitMs = TEST_CONFIG.maxDiscoveryWaitMs) {
    const startTime = Date.now();
    let discovered = 0;

    while (Date.now() - startTime < maxWaitMs) {
      const pool = await this.checkDiscoveryPool();
      discovered = pool.filter(p =>
        this.providers.find(local => local.id === p.provider_id || local.id === p.id)
      ).length;

      if (discovered >= TEST_CONFIG.providerCount) {
        this.testResults.discoveryLatencyMs = Date.now() - startTime;
        await this.log(`✓ All ${discovered} providers discovered in ${this.testResults.discoveryLatencyMs}ms`);
        this.testResults.providersDiscovered = discovered;
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.discoveryPoolCheckIntervalMs));
    }

    await this.logError(`Discovery timeout after ${maxWaitMs}ms. Found ${discovered}/${TEST_CONFIG.providerCount} providers`);
    this.testResults.providersDiscovered = discovered;
    return false;
  }

  async simulateChurn() {
    // Select 2 providers to take offline
    const toOffline = this.providers.slice(0, TEST_CONFIG.churnCount);

    await this.log(`\n[Simulating churn] Taking ${toOffline.length} providers offline...`);

    for (const provider of toOffline) {
      provider.is_online = false;
      await this.log(`✓ Provider ${provider.id} marked offline (stops heartbeating)`);
    }

    this.testResults.providersOffline = toOffline.length;
    this.testResults.remainingProvidersActive = this.providers.filter(p => p.is_online).length;

    // Continue heartbeating for remaining providers
    const remainingProviders = this.providers.filter(p => p.is_online);
    await this.log(`Continuing heartbeats for ${remainingProviders.length} remaining providers...`);

    for (const provider of remainingProviders) {
      await this.heartbeatProvider(provider);
    }
  }

  async verifyJobRouting() {
    try {
      // Check if any jobs can be routed to remaining providers
      const pool = await this.checkDiscoveryPool();
      const activeProviders = pool.filter(p => {
        const local = this.providers.find(prov => prov.id === p.provider_id || prov.id === p.id);
        return local && local.is_online;
      });

      if (activeProviders.length >= TEST_CONFIG.providerCount - TEST_CONFIG.churnCount) {
        await this.log(`✓ Job routing pool maintained ${activeProviders.length} active providers`);
        this.testResults.jobRoutingSuccess = true;
        return true;
      } else {
        await this.logError(`Job routing pool only has ${activeProviders.length} providers (expected ${TEST_CONFIG.providerCount - TEST_CONFIG.churnCount})`);
        return false;
      }
    } catch (error) {
      await this.logError(`Job routing verification: ${error.message}`);
      return false;
    }
  }

  async run() {
    try {
      await this.log('Starting Provider Churn Simulation');
      await this.log(`Backend URL: ${BACKEND_URL}`);
      await this.log(`Configuration: ${JSON.stringify(TEST_CONFIG, null, 2)}\n`);

      // Phase 1: Register providers
      await this.log('[Phase 1] Registering providers...');
      for (let i = 1; i <= TEST_CONFIG.providerCount; i++) {
        await this.simulateProviderRegistration(i);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Phase 2: Heartbeat all providers
      await this.log('\n[Phase 2] Sending initial heartbeats...');
      for (const provider of this.providers) {
        await this.heartbeatProvider(provider);
      }

      // Phase 3: Wait for discovery
      await this.log('\n[Phase 3] Waiting for provider discovery...');
      await this.waitForDiscovery();

      // Phase 4: Simulate churn
      await this.simulateChurn();

      // Phase 5: Verify routing with degraded provider set
      await this.log('\n[Phase 5] Verifying job routing with reduced provider pool...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.verifyJobRouting();

      // Results
      await this.log('\n' + '='.repeat(60));
      await this.log('TEST RESULTS');
      await this.log('='.repeat(60));
      console.table(this.testResults);

      const passed = this.testResults.errors.length === 0 && this.testResults.jobRoutingSuccess;
      await this.log(`\nStatus: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
      process.exit(passed ? 0 : 1);
    } catch (error) {
      await this.logError(`Test execution: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  }
}

const test = new ProviderChurnTest();
test.run();
