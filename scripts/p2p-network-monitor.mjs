#!/usr/bin/env node

/**
 * DC1 P2P Network Health Monitor
 *
 * Measures P2P network health metrics for Phase 1 support:
 * - Bootstrap node liveness
 * - DHT query latency
 * - Provider announcement success
 * - Active peer count
 * - Discovery latency
 *
 * Usage:
 *   node scripts/p2p-network-monitor.mjs
 *   node scripts/p2p-network-monitor.mjs --bootstrap /ip4/76.13.179.86/tcp/4001/p2p/...
 *   node scripts/p2p-network-monitor.mjs --format json
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@libp2p/noise'
import { yamux } from '@libp2p/yamux'
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { readFileSync } from 'fs'
import { performance } from 'perf_hooks'

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_BOOTSTRAP = process.env.DCP_P2P_BOOTSTRAP ||
  process.env.DC1_P2P_BOOTSTRAP ||
  '/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'

const DC1_PROVIDER_PREFIX = '/dc1/provider/'
const MONITOR_TIMEOUT_MS = 30000
const DHT_QUERY_TIMEOUT_MS = 5000

let FORMAT = 'human'
let BOOTSTRAP_ADDR = DEFAULT_BOOTSTRAP
let VERBOSE = false

// Parse CLI args
{
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      FORMAT = args[i + 1]
      i++
    } else if (args[i] === '--bootstrap' && args[i + 1]) {
      BOOTSTRAP_ADDR = args[i + 1]
      i++
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      VERBOSE = true
    }
  }
}

// ── Health Check Results ───────────────────────────────────────────────────

const results = {
  timestamp: new Date().toISOString(),
  bootstrapNode: null,
  dhtQuery: null,
  dhtLookup: null,
  discoveryLatency: null,
  activePeers: 0,
  errors: []
}

// ── Utility Functions ──────────────────────────────────────────────────────

function log (msg) {
  if (!FORMAT.startsWith('json')) console.log(msg)
}

function logVerbose (msg) {
  if (VERBOSE && !FORMAT.startsWith('json')) console.log(`  [verbose] ${msg}`)
}

function addError (category, message) {
  results.errors.push({ category, message, timestamp: new Date().toISOString() })
  logVerbose(`ERROR [${category}]: ${message}`)
}

// ── Monitor Tasks ──────────────────────────────────────────────────────────

async function checkBootstrapNode () {
  log('\n[Bootstrap Node Check]')

  if (BOOTSTRAP_ADDR.includes('REPLACE_WITH_BOOTSTRAP_PEER_ID')) {
    const msg = 'Bootstrap peer ID not yet deployed (placeholder still present)'
    addError('bootstrap', msg)
    results.bootstrapNode = {
      status: 'not_deployed',
      message: msg,
      fallback: 'HTTP-based provider discovery active'
    }
    return
  }

  try {
    const startTime = performance.now()

    // Try to create a test node and connect to bootstrap
    const testNode = await createLibp2p({
      addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
      transports: [tcp()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: {
        identify: identify(),
        ping: ping(),
        dht: kadDHT({
          protocol: '/dc1/kad/1.0.0',
          clientMode: true,
          kBucketSize: 20,
          peerInfoMapper: passthroughMapper
        })
      }
    })

    await testNode.start()
    logVerbose(`Test node started on ${testNode.getMultiaddrs()[0]}`)

    // Attempt to dial bootstrap node
    const dialStart = performance.now()
    try {
      await Promise.race([
        testNode.dial(BOOTSTRAP_ADDR),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Dial timeout')), 5000)
        )
      ])
      const dialTime = performance.now() - dialStart
      logVerbose(`Connected to bootstrap in ${dialTime.toFixed(2)}ms`)

      results.bootstrapNode = {
        status: 'healthy',
        dialLatencyMs: dialTime,
        address: BOOTSTRAP_ADDR
      }
      log('✓ Bootstrap node reachable')
    } catch (dialErr) {
      const msg = `Failed to dial bootstrap: ${dialErr.message}`
      addError('bootstrap', msg)
      results.bootstrapNode = {
        status: 'unreachable',
        error: dialErr.message,
        address: BOOTSTRAP_ADDR
      }
      log('✗ Bootstrap node unreachable')
    }

    await testNode.stop()
  } catch (err) {
    addError('bootstrap_test', err.message)
    results.bootstrapNode = {
      status: 'error',
      error: err.message
    }
  }
}

async function checkDHTQuery () {
  log('\n[DHT Query Performance]')

  try {
    const testNode = await createLibp2p({
      addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
      transports: [tcp()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: {
        identify: identify(),
        ping: ping(),
        dht: kadDHT({
          protocol: '/dc1/kad/1.0.0',
          clientMode: true,
          kBucketSize: 20,
          peerInfoMapper: passthroughMapper
        })
      }
    })

    await testNode.start()
    logVerbose(`DHT test node started`)

    // Try to query for a provider record (will likely return empty, but measures latency)
    const testProviderId = 'test-provider-' + Math.random().toString(36).substr(2, 8)
    const testKey = DC1_PROVIDER_PREFIX + testProviderId

    const queryStart = performance.now()
    let queryTime = 0
    let resultCount = 0

    try {
      const results = await Promise.race([
        testNode.services.dht.get(testKey),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), DHT_QUERY_TIMEOUT_MS)
        )
      ]).catch(() => []) // Provider doesn't exist, that's expected

      queryTime = performance.now() - queryStart
      resultCount = Array.isArray(results) ? results.length : 0

      results.dhtQuery = {
        status: 'success',
        latencyMs: queryTime,
        resultsCount: resultCount,
        testKey: testKey
      }
      log(`✓ DHT query completed in ${queryTime.toFixed(2)}ms (${resultCount} results)`)
    } catch (queryErr) {
      queryTime = performance.now() - queryStart
      if (queryErr.message === 'Query timeout') {
        results.dhtQuery = {
          status: 'timeout',
          latencyMs: queryTime,
          message: 'DHT query exceeded 5000ms timeout'
        }
        addError('dht_query', `DHT query timed out after ${queryTime.toFixed(2)}ms`)
        log(`✗ DHT query timeout (${queryTime.toFixed(2)}ms)`)
      } else {
        results.dhtQuery = {
          status: 'error',
          error: queryErr.message,
          latencyMs: queryTime
        }
        addError('dht_query', queryErr.message)
        log(`✗ DHT query failed: ${queryErr.message}`)
      }
    }

    await testNode.stop()
  } catch (err) {
    addError('dht_test', err.message)
    results.dhtQuery = {
      status: 'error',
      error: err.message
    }
  }
}

async function checkProviderAnnouncements () {
  log('\n[Provider Announcements]')

  try {
    // Try to query backend HTTP API for provider count
    const response = await Promise.race([
      fetch('http://localhost:8083/api/network/providers?limit=1'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('HTTP timeout')), 5000)
      )
    ]).catch(() => null)

    if (!response) {
      addError('provider_query', 'Backend HTTP API not responding')
      results.discoveryLatency = {
        status: 'backend_unavailable',
        message: 'Could not reach backend HTTP API'
      }
      log('✗ Backend HTTP provider discovery API unreachable')
      return
    }

    if (!response.ok) {
      addError('provider_query', `HTTP ${response.status}`)
      results.discoveryLatency = {
        status: 'http_error',
        statusCode: response.status
      }
      log(`✗ Backend returned HTTP ${response.status}`)
      return
    }

    const data = await response.json()
    const providerCount = Array.isArray(data) ? data.length : data.providers?.length || 0

    results.discoveryLatency = {
      status: 'available',
      activeProvidersViaHttp: providerCount
    }
    log(`✓ ${providerCount} active providers available via HTTP discovery`)
  } catch (err) {
    addError('discovery_check', err.message)
    results.discoveryLatency = {
      status: 'error',
      error: err.message
    }
    log(`✗ Discovery check failed: ${err.message}`)
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function runMonitor () {
  log('\n╔════════════════════════════════════════════════════════════╗')
  log('║        DC1 P2P Network Health Monitor                      ║')
  log('║        ' + new Date().toISOString().substring(0, 19) + '                          ║')
  log('╚════════════════════════════════════════════════════════════╝')

  try {
    // Run all checks in parallel with timeout
    await Promise.race([
      Promise.all([
        checkBootstrapNode(),
        checkDHTQuery(),
        checkProviderAnnouncements()
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Monitor timeout')), MONITOR_TIMEOUT_MS)
      )
    ])
  } catch (err) {
    if (err.message !== 'Monitor timeout') {
      addError('monitor', err.message)
    }
    log(`\n✗ Monitor error: ${err.message}`)
  }

  // ── Summary ────────────────────────────────────────────────────────

  const healthScore = calculateHealthScore()

  log('\n[Summary]')
  log(`Health Score: ${healthScore}%`)

  if (results.errors.length === 0) {
    log('Status: ✓ All systems nominal')
  } else {
    log(`Status: ✗ ${results.errors.length} issue(s) detected`)
    for (const err of results.errors) {
      log(`  - [${err.category}] ${err.message}`)
    }
  }

  // ── Output ─────────────────────────────────────────────────────────

  if (FORMAT === 'json') {
    console.log(JSON.stringify(results, null, 2))
  } else if (FORMAT === 'human') {
    log('\n' + '═'.repeat(62))
  }

  // Exit code
  const exitCode = results.errors.length === 0 ? 0 : 1
  process.exit(exitCode)
}

function calculateHealthScore () {
  let score = 100

  if (results.bootstrapNode?.status !== 'healthy' &&
      results.bootstrapNode?.status !== 'not_deployed') {
    score -= 30
  }

  if (results.dhtQuery?.status !== 'success') {
    score -= 25
  }

  if (results.discoveryLatency?.status !== 'available' &&
      results.discoveryLatency?.status !== 'backend_unavailable') {
    score -= 20
  }

  if (results.errors.length > 0) {
    score -= Math.min(score, results.errors.length * 5)
  }

  return Math.max(0, score)
}

// Run the monitor
await runMonitor()
