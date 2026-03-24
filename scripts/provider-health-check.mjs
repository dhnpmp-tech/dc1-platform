#!/usr/bin/env node
/**
 * Provider Heartbeat Health Check Script
 *
 * Queries registered providers and reports:
 * - Which are reachable via P2P
 * - Which are offline (never pinged back)
 * - Time since last heartbeat
 *
 * Usage:
 *   node scripts/provider-health-check.mjs [--api-url http://localhost:8083] [--format json|table]
 */

import fetch from 'node-fetch';
import { createRequire } from 'module';
import { format } from 'util';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);

// Parse arguments
const config = {
  apiUrl: 'http://localhost:8083',
  format: 'table'
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--api-url' && args[i + 1]) {
    config.apiUrl = args[i + 1];
    i++;
  }
  if (args[i] === '--format' && args[i + 1]) {
    config.format = args[i + 1];
    i++;
  }
}

const API_URL = config.apiUrl;
const FORMAT = config.format;

/**
 * Fetch all registered providers
 */
async function getRegisteredProviders() {
  try {
    const response = await fetch(`${API_URL}/api/providers`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Failed to fetch providers: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Check if a provider is reachable via P2P
 */
async function checkProviderReachability(provider) {
  try {
    const response = await fetch(`${API_URL}/api/p2p/peers/${provider.peerId}`, {
      timeout: 5000
    });

    if (response.ok) {
      const data = await response.json();
      return {
        reachable: true,
        lastSeen: data.lastSeen || new Date().toISOString(),
        addresses: data.addresses || []
      };
    }

    return {
      reachable: false,
      lastSeen: provider.lastHeartbeatAt || null,
      addresses: []
    };
  } catch (error) {
    return {
      reachable: false,
      lastSeen: provider.lastHeartbeatAt || null,
      addresses: [],
      error: error.message
    };
  }
}

/**
 * Calculate time since last heartbeat
 */
function getTimeSinceHeartbeat(lastHeartbeat) {
  if (!lastHeartbeat) return 'Never';

  const now = new Date();
  const then = new Date(lastHeartbeat);
  const diff = now - then;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  return `${minutes}m ago`;
}

/**
 * Format output as table
 */
function formatAsTable(results) {
  console.log('\n📊 Provider Health Report\n');
  console.log('='.repeat(120));
  console.log(
    format(
      '%-40s %-10s %-20s %-30s %s',
      'Provider Name',
      'Status',
      'Last Heartbeat',
      'Peer ID',
      'Reachable'
    )
  );
  console.log('-'.repeat(120));

  const online = results.filter(r => r.reachable);
  const offline = results.filter(r => !r.reachable);

  online.forEach(result => {
    console.log(
      format(
        '%-40s %-10s %-20s %-30s %s',
        result.name.substring(0, 39),
        '🟢 Online',
        result.timeSinceHeartbeat,
        result.peerId?.substring(0, 29) || 'N/A',
        '✅'
      )
    );
  });

  offline.forEach(result => {
    console.log(
      format(
        '%-40s %-10s %-20s %-30s %s',
        result.name.substring(0, 39),
        '🔴 Offline',
        result.timeSinceHeartbeat,
        result.peerId?.substring(0, 29) || 'N/A',
        '❌'
      )
    );
  });

  console.log('='.repeat(120));
  console.log(`\n📈 Summary:`);
  console.log(`  ✅ Online:  ${online.length} provider(s)`);
  console.log(`  ❌ Offline: ${offline.length} provider(s)`);
  console.log(`  📊 Total:   ${results.length} provider(s)\n`);
}

/**
 * Format output as JSON
 */
function formatAsJSON(results) {
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      online: results.filter(r => r.reachable).length,
      offline: results.filter(r => !r.reachable).length
    },
    providers: results
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Main health check logic
 */
async function runHealthCheck() {
  try {
    console.log('🔄 Fetching registered providers...');
    const providers = await getRegisteredProviders();

    if (!providers || providers.length === 0) {
      console.log('⚠️  No providers registered');
      return;
    }

    console.log(`📦 Found ${providers.length} registered provider(s)`);
    console.log('🔍 Checking P2P reachability...\n');

    const results = [];

    for (const provider of providers) {
      process.stdout.write(`  • ${provider.name}... `);

      const health = await checkProviderReachability(provider);
      const result = {
        id: provider.id,
        name: provider.name,
        peerId: provider.peerId,
        reachable: health.reachable,
        lastHeartbeat: health.lastSeen,
        timeSinceHeartbeat: getTimeSinceHeartbeat(health.lastSeen),
        addresses: health.addresses,
        error: health.error || null
      };

      results.push(result);

      if (health.reachable) {
        console.log('✅ Online');
      } else {
        console.log('❌ Offline');
      }
    }

    if (FORMAT === 'json') {
      formatAsJSON(results);
    } else {
      formatAsTable(results);
    }

    const allOnline = results.every(r => r.reachable);
    process.exit(allOnline ? 0 : 1);

  } catch (error) {
    console.error(`\n❌ Health check failed: ${error.message}`);
    process.exit(1);
  }
}

runHealthCheck();
