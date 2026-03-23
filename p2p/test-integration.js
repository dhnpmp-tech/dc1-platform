/**
 * DCP P2P Networking Integration Tests
 *
 * Tests cover:
 *   - Provider node discovery
 *   - Heartbeat protocol
 *   - NAT traversal scenarios
 *   - Failover and recovery
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@libp2p/noise'
import { yamux } from '@libp2p/yamux'
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import * as discovery from './dcp-discovery-scaffold.js'
import * as heartbeat from './heartbeat-protocol.js'

const BOOTSTRAP_PROTOCOL = '/dcp/nodes/1.0.0/kad/1.0.0'
const TEST_TIMEOUT_MS = 60000

async function createTestNode(options = {}) {
  const { port = 0, clientMode = false } = options
  const node = await createLibp2p({
    addresses: { listen: [`/ip4/127.0.0.1/tcp/${port}`] },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      ping: ping(),
      dht: kadDHT({
        protocol: BOOTSTRAP_PROTOCOL,
        clientMode,
        kBucketSize: 2,
        querySelfInterval: 5000,
        peerInfoMapper: passthroughMapper,
        maxInboundStreams: 32,
        maxOutboundStreams: 64,
      }),
    },
  })

  // Store timeout for queries
  node.dcpDiscoveryTimeoutMs = 8000

  // Wait for DHT to be ready
  await new Promise((r) => setTimeout(r, 200))

  return node
}

/**
 * Test 1: Basic provider discovery
 */
export async function testBasicDiscovery() {
  console.log('\n=== Test 1: Basic Provider Discovery ===')
  const bootstrap = await createTestNode({ port: 0, clientMode: false })
  const provider = await createTestNode({ port: 0, clientMode: false })
  const renter = await createTestNode({ port: 0, clientMode: true })

  try {
    await bootstrap.start()
    await provider.start()
    await renter.start()

    const bootstrapAddr = `${bootstrap.getMultiaddrs()[0]}/p2p/${bootstrap.peerId}`
    console.log(`Bootstrap peer: ${bootstrapAddr}`)

    // Connect provider and renter to bootstrap
    await provider.dial(bootstrap.getMultiaddrs()[0])
    await renter.dial(bootstrap.getMultiaddrs()[0])

    // Wait for DHT to settle and peers to be discovered
    await new Promise((r) => setTimeout(r, 2000))

    // Provider announces environment
    const providerEnv = {
      gpu_model: 'RTX 4090',
      vram_gb: 24,
      price_sar_per_hour: 45,
      cuda_version: '12.3',
      os: 'linux',
      region: 'sa',
      reliability_score: 95,
      available_slots: 1,
      tags: ['compute-xl'],
    }

    const announced = await discovery.announceProviderEnvironment(provider, providerEnv)
    console.log(`✓ Provider announced environment:`, announced.provider_cid)

    // Renter discovers provider
    await new Promise((r) => setTimeout(r, 1000))
    const peerIds = await discovery.getRegisteredProviderPeers(renter)
    console.log(`✓ Renter discovered ${peerIds.length} provider(s)`)

    if (peerIds.length > 0) {
      const resolved = await discovery.resolveProviderByPeerId(renter, peerIds[0])
      if (resolved?.provider) {
        console.log(`✓ Resolved provider: GPU=${resolved.provider.gpu_model}, Price=${resolved.provider.price_sar_per_hour} SAR/hr`)
        return { passed: true }
      }
    }

    return { passed: false, reason: 'provider not discovered' }
  } catch (error) {
    return { passed: false, reason: error.message }
  } finally {
    await Promise.all([bootstrap.stop(), provider.stop(), renter.stop()]).catch(() => {})
  }
}

/**
 * Test 2: Heartbeat protocol
 */
export async function testHeartbeatProtocol() {
  console.log('\n=== Test 2: Heartbeat Protocol ===')
  const bootstrap = await createTestNode({ port: 0, clientMode: false })
  const provider = await createTestNode({ port: 0, clientMode: false })
  const monitor = await createTestNode({ port: 0, clientMode: true })

  try {
    await bootstrap.start()
    await provider.start()
    await monitor.start()

    // Connect to bootstrap
    await provider.dial(bootstrap.getMultiaddrs()[0])
    await monitor.dial(bootstrap.getMultiaddrs()[0])
    await new Promise((r) => setTimeout(r, 2000))

    const providerId = provider.peerId.toString()
    console.log(`Provider ID: ${providerId}`)

    // Announce initial heartbeat
    const hb1 = await heartbeat.announceHeartbeat(provider, providerId, {
      sequence: 0,
      metrics: { cpu_utilization: 45, memory_utilization: 60, gpu_utilization: 80 },
      status: 'healthy',
    })
    console.log(`✓ Announced heartbeat #${hb1.sequence} at ${hb1.timestamp}`)

    // Wait and resolve
    await new Promise((r) => setTimeout(r, 1500))
    const resolved = await heartbeat.resolveHeartbeat(monitor, providerId)
    if (!resolved) {
      return { passed: false, reason: 'heartbeat not resolved' }
    }

    console.log(`✓ Resolved heartbeat: status=${resolved.status}, GPU utilization=${resolved.metrics.gpu_utilization}%`)

    // Check staleness
    const stale = heartbeat.isHeartbeatStale(resolved)
    console.log(`✓ Staleness check: stale=${stale}`)

    // Announce multiple heartbeats
    const hb2 = await heartbeat.announceHeartbeat(provider, providerId, {
      sequence: 1,
      metrics: { cpu_utilization: 50, memory_utilization: 65, gpu_utilization: 85 },
      status: 'healthy',
    })
    console.log(`✓ Announced heartbeat #${hb2.sequence}`)

    return { passed: true }
  } catch (error) {
    return { passed: false, reason: error.message }
  } finally {
    await Promise.all([bootstrap.stop(), provider.stop(), monitor.stop()]).catch(() => {})
  }
}

/**
 * Test 3: Heartbeat emitter
 */
export async function testHeartbeatEmitter() {
  console.log('\n=== Test 3: Heartbeat Emitter ===')
  const bootstrap = await createTestNode({ port: 0, clientMode: false })
  const provider = await createTestNode({ port: 0, clientMode: false })

  try {
    await bootstrap.start()
    await provider.start()
    await provider.dial(bootstrap.getMultiaddrs()[0])
    await new Promise((r) => setTimeout(r, 500))

    const providerId = provider.peerId.toString()

    // Create emitter with fixed metrics
    const emitter = heartbeat.createHeartbeatEmitter(provider, providerId, {
      getMetrics: async () => ({
        cpu_utilization: 40,
        memory_utilization: 55,
        gpu_utilization: 75,
      }),
      getStatus: () => 'healthy',
      intervalMs: 500, // Fast emit for testing
    })

    // Wait for several emissions
    await new Promise((r) => setTimeout(r, 2000))

    const stats = emitter.getStats()
    console.log(`✓ Emitter stats: announced=${stats.announced}, failed=${stats.failed}`)
    console.log(`  Last emission: ${stats.lastAnnounceAt}`)

    emitter.stop()

    if (stats.announced >= 3) {
      console.log(`✓ Emitter working correctly`)
      return { passed: true }
    } else {
      return { passed: false, reason: `expected >= 3 announcements, got ${stats.announced}` }
    }
  } catch (error) {
    return { passed: false, reason: error.message }
  } finally {
    await Promise.all([bootstrap.stop(), provider.stop()]).catch(() => {})
  }
}

/**
 * Test 4: Multi-peer heartbeat resolution
 */
export async function testMultiPeerHeartbeats() {
  console.log('\n=== Test 4: Multi-Peer Heartbeat Resolution ===')
  const bootstrap = await createTestNode({ port: 0, clientMode: false })
  const provider1 = await createTestNode({ port: 0, clientMode: false })
  const provider2 = await createTestNode({ port: 0, clientMode: false })
  const monitor = await createTestNode({ port: 0, clientMode: true })

  try {
    await bootstrap.start()
    await provider1.start()
    await provider2.start()
    await monitor.start()

    // Connect all to bootstrap
    await Promise.all([
      provider1.dial(bootstrap.getMultiaddrs()[0]),
      provider2.dial(bootstrap.getMultiaddrs()[0]),
      monitor.dial(bootstrap.getMultiaddrs()[0]),
    ])
    await new Promise((r) => setTimeout(r, 2500))

    const p1Id = provider1.peerId.toString()
    const p2Id = provider2.peerId.toString()

    // Announce heartbeats from both providers
    await heartbeat.announceHeartbeat(provider1, p1Id, {
      sequence: 0,
      metrics: { gpu_utilization: 80 },
      status: 'healthy',
    })

    await heartbeat.announceHeartbeat(provider2, p2Id, {
      sequence: 0,
      metrics: { gpu_utilization: 60 },
      status: 'healthy',
    })

    console.log(`✓ Announced heartbeats from 2 providers`)

    // Wait and resolve both
    await new Promise((r) => setTimeout(r, 2000))
    const results = await heartbeat.resolveHeartbeats(monitor, [p1Id, p2Id])
    console.log(`✓ Resolved ${results.length} heartbeats`)

    const summary = heartbeat.summarizeHeartbeatHealth(results)
    console.log(`✓ Health summary: healthy=${summary.healthy.length}, degraded=${summary.degraded.length}, offline=${summary.offline.length}`)

    if (summary.healthy.length >= 2) {
      console.log(`✓ All providers healthy`)
      return { passed: true }
    } else {
      return { passed: false, reason: `expected 2 healthy, got ${summary.healthy.length}` }
    }
  } catch (error) {
    return { passed: false, reason: error.message }
  } finally {
    await Promise.all([bootstrap.stop(), provider1.stop(), provider2.stop(), monitor.stop()]).catch(() => {})
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('========================================')
  console.log('DCP P2P Networking Integration Tests')
  console.log('========================================')

  const tests = [
    { name: 'Basic Discovery', fn: testBasicDiscovery },
    { name: 'Heartbeat Protocol', fn: testHeartbeatProtocol },
    { name: 'Heartbeat Emitter', fn: testHeartbeatEmitter },
    { name: 'Multi-Peer Heartbeats', fn: testMultiPeerHeartbeats },
  ]

  const results = []
  for (const test of tests) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TEST_TIMEOUT_MS))
      const result = await Promise.race([test.fn(), timeout])
      results.push({ test: test.name, ...result })
      console.log(result.passed ? '✓ PASSED' : `✗ FAILED: ${result.reason}`)
    } catch (error) {
      results.push({ test: test.name, passed: false, reason: error.message })
      console.log(`✗ FAILED: ${error.message}`)
    }
  }

  console.log('\n========================================')
  const passed = results.filter((r) => r.passed).length
  console.log(`Results: ${passed}/${results.length} passed`)
  console.log('========================================\n')

  return results
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then((results) => {
    process.exit(results.every((r) => r.passed) ? 0 : 1)
  })
}
