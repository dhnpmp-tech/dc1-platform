/**
 * DCP Heartbeat Protocol Tests
 *
 * Tests for the heartbeat protocol for tracking provider node liveness.
 * Focuses on heartbeat record generation, validation, and emitter functionality.
 */

import * as heartbeat from './heartbeat-protocol.js'

/**
 * Test 1: Heartbeat record generation
 */
function testHeartbeatRecordGeneration() {
  console.log('\n=== Test 1: Heartbeat Record Generation ===')
  const peerId = '12D3KooWJo4ukW9LpDyoghsk9v8ZzRjdpQMBA4UjhF8idAPfQem3'

  const hb = heartbeat.buildHeartbeat(peerId, {
    sequence: 0,
    metrics: {
      cpu_utilization: 45.5,
      memory_utilization: 60.2,
      gpu_utilization: 80.1,
    },
    status: 'healthy',
  })

  console.log(`✓ Generated heartbeat:`)
  console.log(`  - peer_id: ${hb.peer_id}`)
  console.log(`  - timestamp: ${hb.timestamp}`)
  console.log(`  - sequence: ${hb.sequence}`)
  console.log(`  - status: ${hb.status}`)
  console.log(`  - gpu_utilization: ${hb.metrics.gpu_utilization}%`)

  const validation = heartbeat.validateHeartbeat(hb)
  if (!validation.ok) {
    return { passed: false, reason: `validation failed: ${validation.reason}` }
  }

  console.log(`✓ Heartbeat validation passed`)
  return { passed: true }
}

/**
 * Test 2: Heartbeat staleness detection
 */
function testHeartbeatStaleness() {
  console.log('\n=== Test 2: Heartbeat Staleness Detection ===')

  const now = Date.now()
  const recentHb = heartbeat.buildHeartbeat('peer1', {
    sequence: 0,
    metrics: { gpu_utilization: 75 },
    status: 'healthy',
  })

  const isRecentStale = heartbeat.isHeartbeatStale(recentHb, now)
  console.log(`✓ Recent heartbeat stale=${isRecentStale}`)

  if (isRecentStale) {
    return { passed: false, reason: 'recent heartbeat marked as stale' }
  }

  // Simulate a 2-minute old heartbeat
  const oldTimestamp = new Date(now - 120_000).toISOString()
  const oldHb = { ...recentHb, timestamp: oldTimestamp }

  const isOldStale = heartbeat.isHeartbeatStale(oldHb, now)
  console.log(`✓ 2-minute old heartbeat stale=${isOldStale}`)

  if (!isOldStale) {
    return { passed: false, reason: '2-minute old heartbeat not marked as stale' }
  }

  console.log(`✓ Staleness detection working correctly`)
  return { passed: true }
}

/**
 * Test 3: Health summary
 */
function testHealthSummary() {
  console.log('\n=== Test 3: Health Summary ===')

  const results = [
    {
      peer_id: 'peer1',
      found: true,
      stale: false,
      heartbeat: {
        status: 'healthy',
        metrics: { gpu_utilization: 75 },
      },
    },
    {
      peer_id: 'peer2',
      found: true,
      stale: false,
      heartbeat: {
        status: 'degraded',
        metrics: { gpu_utilization: 90 },
      },
    },
    {
      peer_id: 'peer3',
      found: false,
      stale: true,
      heartbeat: null,
    },
  ]

  const summary = heartbeat.summarizeHeartbeatHealth(results)

  console.log(`✓ Health summary:`)
  console.log(`  - healthy: ${summary.healthy.length} (expected 1)`)
  console.log(`  - degraded: ${summary.degraded.length} (expected 1)`)
  console.log(`  - offline: ${summary.offline.length} (expected 1)`)
  console.log(`  - total: ${summary.total}`)

  if (summary.healthy.length !== 1 || summary.degraded.length !== 1 || summary.offline.length !== 1) {
    return { passed: false, reason: 'health summary counts incorrect' }
  }

  return { passed: true }
}

/**
 * Test 4: Metric normalization (0-100%)
 */
function testMetricNormalization() {
  console.log('\n=== Test 4: Metric Normalization ===')

  // Test clamping to 0-100
  const hb = heartbeat.buildHeartbeat('peer1', {
    sequence: 0,
    metrics: {
      cpu_utilization: -10, // Should clamp to 0
      memory_utilization: 150, // Should clamp to 100
      gpu_utilization: 50,
    },
    status: 'healthy',
  })

  console.log(`✓ Input: cpu=-10, memory=150, gpu=50`)
  console.log(`  Normalized: cpu=${hb.metrics.cpu_utilization}, memory=${hb.metrics.memory_utilization}, gpu=${hb.metrics.gpu_utilization}`)

  if (hb.metrics.cpu_utilization !== 0 || hb.metrics.memory_utilization !== 100) {
    return { passed: false, reason: 'metric normalization failed' }
  }

  console.log(`✓ Metrics properly clamped to 0-100%`)
  return { passed: true }
}

/**
 * Test 5: Multiple heartbeat records from same peer
 */
function testMultipleHeartbeats() {
  console.log('\n=== Test 5: Multiple Heartbeat Records ===')

  const peerId = 'peer1'
  const hb1 = heartbeat.buildHeartbeat(peerId, { sequence: 0, metrics: { gpu_utilization: 50 } })
  const hb2 = heartbeat.buildHeartbeat(peerId, { sequence: 1, metrics: { gpu_utilization: 60 } })
  const hb3 = heartbeat.buildHeartbeat(peerId, { sequence: 2, metrics: { gpu_utilization: 70 } })

  console.log(`✓ Generated 3 sequential heartbeats:`)
  console.log(`  - seq ${hb1.sequence}: GPU=${hb1.metrics.gpu_utilization}% at ${hb1.timestamp}`)
  console.log(`  - seq ${hb2.sequence}: GPU=${hb2.metrics.gpu_utilization}% at ${hb2.timestamp}`)
  console.log(`  - seq ${hb3.sequence}: GPU=${hb3.metrics.gpu_utilization}% at ${hb3.timestamp}`)

  // Validate all
  for (const hb of [hb1, hb2, hb3]) {
    const validation = heartbeat.validateHeartbeat(hb)
    if (!validation.ok) {
      return { passed: false, reason: `validation failed for seq ${hb.sequence}` }
    }
  }

  console.log(`✓ All heartbeats valid`)
  return { passed: true }
}

/**
 * Test 6: Heartbeat validation edge cases
 */
function testHeartbeatValidation() {
  console.log('\n=== Test 6: Heartbeat Validation ===')

  const testCases = [
    {
      name: 'missing peer_id',
      record: { timestamp: new Date().toISOString(), sequence: 0 },
      shouldFail: true,
    },
    {
      name: 'missing timestamp',
      record: { peer_id: 'peer1', sequence: 0 },
      shouldFail: true,
    },
    {
      name: 'invalid timestamp',
      record: { peer_id: 'peer1', timestamp: 'not-a-date', sequence: 0 },
      shouldFail: true,
    },
    {
      name: 'negative sequence',
      record: { peer_id: 'peer1', timestamp: new Date().toISOString(), sequence: -1 },
      shouldFail: true,
    },
    {
      name: 'valid minimal record',
      record: { peer_id: 'peer1', timestamp: new Date().toISOString(), sequence: 0 },
      shouldFail: false,
    },
  ]

  for (const testCase of testCases) {
    const validation = heartbeat.validateHeartbeat(testCase.record)
    const passed = testCase.shouldFail ? !validation.ok : validation.ok

    if (!passed) {
      return { passed: false, reason: `validation test "${testCase.name}" failed` }
    }
    console.log(`  ✓ ${testCase.name}: ${testCase.shouldFail ? 'correctly rejected' : 'correctly accepted'}`)
  }

  return { passed: true }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('========================================')
  console.log('DCP Heartbeat Protocol Tests')
  console.log('========================================')

  const tests = [
    { name: 'Heartbeat Record Generation', fn: testHeartbeatRecordGeneration },
    { name: 'Heartbeat Staleness Detection', fn: testHeartbeatStaleness },
    { name: 'Health Summary', fn: testHealthSummary },
    { name: 'Metric Normalization', fn: testMetricNormalization },
    { name: 'Multiple Heartbeats', fn: testMultipleHeartbeats },
    { name: 'Heartbeat Validation', fn: testHeartbeatValidation },
  ]

  const results = []
  for (const test of tests) {
    try {
      const result = await test.fn()
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
