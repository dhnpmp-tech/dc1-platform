#!/usr/bin/env node
/**
 * Provider Churn Simulation Script
 *
 * Tests P2P network resilience by simulating provider join/leave cycles.
 * Verifies that job routing gracefully handles provider churn.
 *
 * Usage:
 *   node scripts/provider-churn-simulation.mjs [--backend-url=http://localhost:8083]
 *
 * Expected behavior:
 *   - 5 providers join and are registered
 *   - System assigns jobs to available providers
 *   - 2 providers go offline (simulated network disconnect)
 *   - Remaining 3 providers continue routing jobs
 *   - Discovery detects offline providers within 5 minutes
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

const DEFAULT_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8083';
const SIMULATION_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const JOB_SUBMIT_INTERVAL_MS = 10 * 1000; // Submit job every 10 seconds

// Test provider configuration
const TEST_PROVIDERS = [
  { id: 'test-provider-1', gpuCount: 4, gpuModel: 'RTX 4090' },
  { id: 'test-provider-2', gpuCount: 4, gpuModel: 'RTX 4090' },
  { id: 'test-provider-3', gpuCount: 8, gpuModel: 'H100' },
  { id: 'test-provider-4', gpuCount: 8, gpuModel: 'H100' },
  { id: 'test-provider-5', gpuCount: 2, gpuModel: 'L40' },
];

const OFFLINE_PROVIDERS = ['test-provider-2', 'test-provider-4']; // These will go offline

class ChurnSimulator {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
    this.results = {
      startTime: new Date().toISOString(),
      providersRegistered: [],
      providersOffline: [],
      jobsSubmitted: 0,
      jobsSuccessful: 0,
      jobsFailed: 0,
      discoveryLatency: null,
      metrics: {
        joinLatency: [],
        jobRoutingLatency: [],
        discoveryDetectionTime: null,
      },
      errors: [],
    };
    this.activeProviders = new Set();
    this.onlineProviders = new Set();
    this.simulationStartTime = null;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async registerProvider(providerConfig) {
    try {
      const startTime = performance.now();

      const response = await fetch(`${this.backendUrl}/api/providers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: providerConfig.id,
          gpuCount: providerConfig.gpuCount,
          gpuModel: providerConfig.gpuModel,
          endpoint: `mock://provider/${providerConfig.id}`,
        }),
      });

      const latency = performance.now() - startTime;
      this.results.metrics.joinLatency.push(latency);

      if (response.ok) {
        this.activeProviders.add(providerConfig.id);
        this.onlineProviders.add(providerConfig.id);
        this.results.providersRegistered.push(providerConfig.id);
        this.log(`✓ Provider ${providerConfig.id} registered (${latency.toFixed(2)}ms)`);
        return true;
      } else {
        this.log(`✗ Failed to register ${providerConfig.id}: ${response.statusText}`);
        this.results.errors.push({
          type: 'registration_failed',
          provider: providerConfig.id,
          status: response.status,
        });
        return false;
      }
    } catch (error) {
      this.log(`✗ Error registering ${providerConfig.id}: ${error.message}`);
      this.results.errors.push({
        type: 'registration_error',
        provider: providerConfig.id,
        error: error.message,
      });
      return false;
    }
  }

  async submitJob(jobId) {
    try {
      const startTime = performance.now();

      // Pick a random online provider
      const providers = Array.from(this.onlineProviders);
      if (providers.length === 0) {
        this.results.jobsFailed++;
        this.log(`✗ Job ${jobId}: No providers available`);
        return false;
      }

      const targetProvider = providers[Math.floor(Math.random() * providers.length)];

      const response = await fetch(`${this.backendUrl}/api/jobs/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          model: 'nemotron-nano',
          providerId: targetProvider,
          estimatedDuration: 10000,
        }),
      });

      const latency = performance.now() - startTime;
      this.results.metrics.jobRoutingLatency.push(latency);

      if (response.ok) {
        this.results.jobsSuccessful++;
        this.log(`✓ Job ${jobId} routed to ${targetProvider} (${latency.toFixed(2)}ms)`);
        return true;
      } else {
        this.results.jobsFailed++;
        this.log(`✗ Job ${jobId} routing failed: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      this.results.jobsFailed++;
      this.log(`✗ Error submitting job ${jobId}: ${error.message}`);
      return false;
    }
  }

  async simulateProviderOffline(providerId) {
    this.onlineProviders.delete(providerId);
    this.results.providersOffline.push({
      providerId,
      offlineTime: new Date().toISOString(),
    });
    this.log(`🔴 Provider ${providerId} gone offline (simulated network disconnect)`);
  }

  async detectOfflineProviders() {
    // Poll provider health to detect offline providers
    try {
      const response = await fetch(`${this.backendUrl}/api/providers/health`, {
        method: 'GET',
      });

      if (response.ok) {
        const healthData = await response.json();
        const detectedOffline = healthData.providers
          .filter((p) => !p.online)
          .map((p) => p.providerId);

        if (detectedOffline.length > 0) {
          const elapsedSeconds = (Date.now() - this.simulationStartTime) / 1000;
          this.results.metrics.discoveryDetectionTime = elapsedSeconds;
          this.log(`✓ Discovery detected offline providers after ${elapsedSeconds.toFixed(1)}s: ${detectedOffline.join(', ')}`);
          return true;
        }
      }
    } catch (error) {
      // Expected during early phases
    }

    return false;
  }

  async run() {
    this.log('Starting Provider Churn Simulation');
    this.log(`Backend URL: ${this.backendUrl}`);
    this.log(`Simulation duration: ${SIMULATION_DURATION_MS / 1000}s`);
    this.simulationStartTime = Date.now();

    // Phase 1: Register providers
    this.log('\n=== PHASE 1: Provider Registration ===');
    for (const provider of TEST_PROVIDERS) {
      await this.registerProvider(provider);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Stagger registrations
    }

    // Phase 2: Normal operation with job submissions
    this.log('\n=== PHASE 2: Normal Job Routing ===');
    let jobCounter = 1;
    let jobSubmissionPhaseEnd = Date.now() + 60 * 1000; // First minute

    // Phase 3: Provider churn
    this.log('\n=== PHASE 3: Simulating Provider Churn ===');
    let churnPhaseEnd = Date.now() + 180 * 1000; // Next 2 minutes

    // Main simulation loop
    let lastHeartbeat = Date.now();
    let lastJobSubmission = Date.now();
    let lastDiscoveryCheck = Date.now();
    let offlinePhaseStarted = false;
    let discoveryDetected = false;

    while (Date.now() - this.simulationStartTime < SIMULATION_DURATION_MS) {
      const now = Date.now();

      // Submit jobs
      if (now - lastJobSubmission > JOB_SUBMIT_INTERVAL_MS) {
        await this.submitJob(`job-test-${jobCounter++}`);
        this.results.jobsSubmitted++;
        lastJobSubmission = now;
      }

      // Trigger provider offline after 60 seconds
      if (!offlinePhaseStarted && now - this.simulationStartTime > 60 * 1000) {
        this.log('\n=== PHASE 3: Providers Going Offline ===');
        for (const providerId of OFFLINE_PROVIDERS) {
          await this.simulateProviderOffline(providerId);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        offlinePhaseStarted = true;
      }

      // Check for discovery detection (every 30 seconds)
      if (!discoveryDetected && now - lastDiscoveryCheck > 30 * 1000) {
        const detected = await this.detectOfflineProviders();
        if (detected) discoveryDetected = true;
        lastDiscoveryCheck = now;
      }

      // Brief pause to avoid busy loop
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.log('\n=== Simulation Complete ===');
    this.results.endTime = new Date().toISOString();
    this.generateReport();

    return this.results;
  }

  generateReport() {
    this.log('\n========== SIMULATION RESULTS ==========\n');

    this.log('Provider Summary:');
    this.log(`  Registered: ${this.results.providersRegistered.length}`);
    this.log(`  Online: ${this.onlineProviders.size}`);
    this.log(`  Offline: ${this.results.providersOffline.length}`);

    this.log('\nJob Routing:');
    this.log(`  Submitted: ${this.results.jobsSubmitted}`);
    this.log(`  Successful: ${this.results.jobsSuccessful}`);
    this.log(`  Failed: ${this.results.jobsFailed}`);
    const successRate =
      this.results.jobsSubmitted > 0
        ? ((this.results.jobsSuccessful / this.results.jobsSubmitted) * 100).toFixed(1)
        : 0;
    this.log(`  Success Rate: ${successRate}%`);

    if (this.results.metrics.joinLatency.length > 0) {
      const avgJoin = this.results.metrics.joinLatency.reduce((a, b) => a + b, 0) / this.results.metrics.joinLatency.length;
      this.log(`\nProvider Registration Latency: ${avgJoin.toFixed(2)}ms (avg)`);
    }

    if (this.results.metrics.jobRoutingLatency.length > 0) {
      const avgRouting =
        this.results.metrics.jobRoutingLatency.reduce((a, b) => a + b, 0) / this.results.metrics.jobRoutingLatency.length;
      this.log(`Job Routing Latency: ${avgRouting.toFixed(2)}ms (avg)`);
    }

    if (this.results.metrics.discoveryDetectionTime !== null) {
      this.log(`\nDiscovery Detection Latency: ${this.results.metrics.discoveryDetectionTime.toFixed(1)}s`);
      const targetMetSeconds = 30;
      if (this.results.metrics.discoveryDetectionTime <= targetMetSeconds) {
        this.log(`✓ PASS: Detected offline providers within ${targetMetSeconds}s target`);
      } else {
        this.log(`✗ FAIL: Took ${this.results.metrics.discoveryDetectionTime.toFixed(1)}s (target: ${targetMetSeconds}s)`);
      }
    } else {
      this.log(`\n✗ FAIL: Discovery detection did not occur within simulation window`);
    }

    if (this.results.errors.length > 0) {
      this.log(`\nErrors encountered: ${this.results.errors.length}`);
      this.results.errors.slice(0, 5).forEach((err) => {
        this.log(`  - ${err.type}: ${err.error || err.status}`);
      });
    }

    this.log('\n========================================\n');

    // Output JSON results
    console.log(JSON.stringify(this.results, null, 2));
  }
}

// Main execution
const backendUrl = process.argv
  .find((arg) => arg.startsWith('--backend-url='))
  ?.split('=')[1] || DEFAULT_BACKEND_URL;

const simulator = new ChurnSimulator(backendUrl);
simulator.run().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});

export { ChurnSimulator };
