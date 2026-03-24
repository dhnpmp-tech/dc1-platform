#!/usr/bin/env node
/**
 * HTTP Provider Discovery Load Test — DCP-826 Task 2
 *
 * Simulates 100 concurrent renter requests to the HTTP provider discovery
 * endpoint (GET /api/network/providers?available=true), measuring latency
 * percentiles and checking for race conditions.
 *
 * This validates the HTTP fallback (DCP-783) when P2P bootstrap is unavailable
 * during Phase 1 testing.
 *
 * Usage: node test-discovery-load.mjs [api-url] [concurrency] [requests]
 * Defaults:
 *   - API URL: http://localhost:8083 (backend on local VPS dev)
 *   - Concurrency: 100
 *   - Total requests: 500
 *
 * Exit codes:
 *   0 = success (p99 < 200ms and no race conditions)
 *   1 = failure (latency exceeded or errors detected)
 */

import http from 'http'

const API_URL = process.argv[2] || 'http://localhost:8083'
const CONCURRENCY = parseInt(process.argv[3] || '100', 10)
const TOTAL_REQUESTS = parseInt(process.argv[4] || '500', 10)

const TARGET_P99_MS = 200
const HEARTBEAT_TIMEOUT_MS = 90_000

const stats = {
  total: 0,
  success: 0,
  errors: 0,
  latencies: [],
  duplicateDetected: false,
  statusCodes: {}
}

/**
 * Make a single HTTP request to the provider discovery endpoint.
 * @returns {Promise<{latency: number, statusCode: number, providerCount: number, error?: string}>}
 */
async function makeRequest () {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const url = new URL('/api/network/providers?available=true&limit=100', API_URL)

    const req = http.get(url.toString(), {
      timeout: 5000
    }, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        const latency = Date.now() - startTime
        const statusCode = res.statusCode

        try {
          const body = data.length > 0 ? JSON.parse(data) : { providers: [] }
          const providers = Array.isArray(body) ? body : body.providers || []
          const providerCount = providers.length

          // Basic race condition detection: all providers should have recent heartbeat
          let raceConditionDetected = false
          if (res.statusCode === 200) {
            for (const p of providers) {
              if (!p.last_heartbeat) {
                raceConditionDetected = true
                break
              }
              const heartbeatAge = Date.now() - new Date(p.last_heartbeat).getTime()
              if (heartbeatAge > HEARTBEAT_TIMEOUT_MS) {
                raceConditionDetected = true
                break
              }
            }
          }

          if (raceConditionDetected) {
            stats.duplicateDetected = true
          }

          resolve({
            latency,
            statusCode,
            providerCount,
            error: null
          })
        } catch (err) {
          resolve({
            latency,
            statusCode,
            providerCount: 0,
            error: `JSON parse error: ${err.message}`
          })
        }
      })
    })

    req.on('timeout', () => {
      req.destroy()
      const latency = Date.now() - startTime
      resolve({
        latency,
        statusCode: 0,
        providerCount: 0,
        error: 'Request timeout'
      })
    })

    req.on('error', (err) => {
      const latency = Date.now() - startTime
      resolve({
        latency,
        statusCode: 0,
        providerCount: 0,
        error: err.message
      })
    })
  })
}

/**
 * Run concurrent requests with a queue to limit concurrency.
 */
async function runLoadTest () {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  HTTP Provider Discovery Load Test — DCP-826')
  console.log('═══════════════════════════════════════════════════════════\n')
  console.log(`Configuration:`)
  console.log(`  API URL:        ${API_URL}`)
  console.log(`  Concurrency:    ${CONCURRENCY} concurrent requests`)
  console.log(`  Total Requests: ${TOTAL_REQUESTS}`)
  console.log(`  Target P99:     < ${TARGET_P99_MS}ms`)
  console.log('')

  const testStartTime = Date.now()
  const queue = []
  let activeRequests = 0

  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const promise = (async () => {
      activeRequests++
      const result = await makeRequest()
      activeRequests--
      stats.total++
      stats.latencies.push(result.latency)

      if (result.statusCode === 200) {
        stats.success++
      } else {
        stats.errors++
      }

      stats.statusCodes[result.statusCode] =
        (stats.statusCodes[result.statusCode] || 0) + 1

      if (result.error) {
        console.error(
          `✗ Request ${stats.total}: ${result.statusCode} (${result.latency}ms) - ${result.error}`
        )
      } else if (stats.total % 50 === 0) {
        process.stdout.write(
          `✓ ${stats.total}/${TOTAL_REQUESTS} (${result.latency}ms, ${result.providerCount} providers)\n`
        )
      }
    })()

    queue.push(promise)

    // Limit concurrency
    if (activeRequests >= CONCURRENCY) {
      await Promise.race(queue)
      queue.splice(queue.indexOf(promise), 1)
    }
  }

  // Wait for all remaining requests
  await Promise.all(queue)

  const testTotalTime = Date.now() - testStartTime

  // Analyze results
  stats.latencies.sort((a, b) => a - b)

  const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.50)]
  const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)]
  const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)]
  const min = Math.min(...stats.latencies)
  const max = Math.max(...stats.latencies)
  const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length

  const passP99 = p99 < TARGET_P99_MS
  const passErrors = stats.errors === 0
  const passRaceCondition = !stats.duplicateDetected

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════════\n')

  console.log(`Latency Percentiles:`)
  console.log(`  Min:    ${min}ms`)
  console.log(`  P50:    ${p50}ms`)
  console.log(`  P95:    ${p95}ms`)
  console.log(`  P99:    ${p99}ms ${passP99 ? '✓' : '✗ FAILED'}`)
  console.log(`  Max:    ${max}ms`)
  console.log(`  Avg:    ${avg.toFixed(1)}ms`)
  console.log('')

  console.log(`Request Summary:`)
  console.log(`  Total:      ${stats.total}`)
  console.log(`  Success:    ${stats.success}`)
  console.log(`  Errors:     ${stats.errors} ${passErrors ? '✓' : '✗ FAILED'}`)
  console.log(`  Test Time:  ${testTotalTime}ms`)
  console.log('')

  console.log(`Status Codes:`)
  for (const [code, count] of Object.entries(stats.statusCodes).sort()) {
    console.log(`  ${code}: ${count}`)
  }
  console.log('')

  console.log(`Race Conditions:`)
  console.log(`  Stale heartbeats detected: ${stats.duplicateDetected ? '✗ YES' : '✓ NO'} ${passRaceCondition ? '✓' : '✗ FAILED'}`)
  console.log('')

  const allPass = passP99 && passErrors && passRaceCondition
  if (allPass) {
    console.log('═══════════════════════════════════════════════════════════')
    console.log('  ✅ LOAD TEST PASSED')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`  HTTP discovery is production-ready.`)
    console.log(`  DCP-783 fallback validated under load.`)
    console.log('═══════════════════════════════════════════════════════════\n')
    process.exit(0)
  } else {
    console.log('═══════════════════════════════════════════════════════════')
    console.log('  ❌ LOAD TEST FAILED')
    console.log('═══════════════════════════════════════════════════════════')
    if (!passP99) {
      console.log(`  ✗ P99 latency exceeded: ${p99}ms > ${TARGET_P99_MS}ms target`)
    }
    if (!passErrors) {
      console.log(`  ✗ ${stats.errors} request errors detected`)
    }
    if (!passRaceCondition) {
      console.log(`  ✗ Race conditions detected (stale heartbeats)`)
    }
    console.log('═══════════════════════════════════════════════════════════\n')
    process.exit(1)
  }
}

runLoadTest().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
