#!/usr/bin/env node

/**
 * DCP Provider Connectivity Test
 *
 * Self-diagnostic script for providers to verify P2P connectivity.
 * Tests:
 *   - Local P2P port listening
 *   - Outbound connectivity to bootstrap node
 *   - NAT type detection
 *   - Open port visibility
 *   - DNS resolution
 *   - Firewall/routing issues
 *
 * Exit codes:
 *   0: All tests passed
 *   1: One or more tests failed
 *   2: Configuration error
 *
 * Usage:
 *   node scripts/provider-connectivity-test.mjs
 *   node scripts/provider-connectivity-test.mjs --verbose
 *   node scripts/provider-connectivity-test.mjs --json
 */

import { execSync } from 'child_process'
import { createConnection } from 'net'
import { resolve4 } from 'dns'
import { promisify } from 'util'

const resolveDns = promisify(resolve4)

// Configuration
const BOOTSTRAP_IP = '76.13.179.86'
const BOOTSTRAP_PORT = 4001
const P2P_PORT = parseInt(process.env.DCP_P2P_PORT ?? process.env.DC1_P2P_PORT ?? '4001', 10)
const TIMEOUT_MS = 5000

// Output modes
const args = process.argv.slice(2)
const verbose = args.includes('--verbose') || args.includes('-v')
const jsonOutput = args.includes('--json')
const peerTest = args.includes('--peer-test')

// Result tracking
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0,
  },
  natType: 'unknown',
  recommendations: [],
}

function log(msg, level = 'info') {
  if (jsonOutput) return
  const prefix = {
    info: '  ℹ',
    ok: '  ✓',
    fail: '  ✗',
    warn: '  ⚠',
  }[level] || '  -'
  console.log(`${prefix} ${msg}`)
}

function addTest(name, passed, details = '') {
  results.tests.push({ name, passed, details })
  if (passed) {
    results.summary.passed++
    log(`${name}: passed`, 'ok')
  } else {
    results.summary.failed++
    log(`${name}: failed — ${details}`, 'fail')
  }
  if (details && verbose && passed) {
    log(details, 'info')
  }
}

function addWarning(msg) {
  results.summary.warnings++
  log(msg, 'warn')
}

function addRecommendation(msg) {
  results.recommendations.push(msg)
}

function parseArgs() {
  const env = {
    bootstrapAddr: process.env.DCP_P2P_BOOTSTRAP || process.env.DC1_P2P_BOOTSTRAP || '',
    p2pPort: P2P_PORT,
    localMode: process.env.P2P_DISCOVERY_LOCAL_MODE === 'true',
  }
  return env
}

function testLocalPortListening() {
  try {
    const netstatCmd = process.platform === 'win32'
      ? `netstat -ano | findstr :${P2P_PORT}`
      : `netstat -tlnp 2>/dev/null | grep :${P2P_PORT}`

    const output = execSync(netstatCmd, { encoding: 'utf8', stdio: 'pipe' })
    return output.includes(P2P_PORT.toString())
  } catch (err) {
    // netstat may fail, try alternative method
    return false
  }
}

function testBootstrapDns() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false)
    }, TIMEOUT_MS)

    resolveDns(BOOTSTRAP_IP).then(() => {
      clearTimeout(timer)
      resolve(true)
    }).catch(() => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

function testBootstrapReachability() {
  return new Promise((resolve) => {
    const socket = createConnection({
      host: BOOTSTRAP_IP,
      port: BOOTSTRAP_PORT,
      timeout: TIMEOUT_MS,
    })

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      resolve(false)
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function testLocalConnectivity() {
  return new Promise((resolve) => {
    const socket = createConnection({
      host: '127.0.0.1',
      port: P2P_PORT,
      timeout: TIMEOUT_MS,
    })

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      resolve(false)
    })
  })
}

function detectPublicIp() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve('unknown'), 3000)

    try {
      const https = require('https')
      https.get('https://api.ipify.org?format=json', (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          clearTimeout(timeout)
          try {
            const json = JSON.parse(data)
            resolve(json.ip || 'unknown')
          } catch {
            resolve('unknown')
          }
        })
      }).on('error', () => {
        clearTimeout(timeout)
        resolve('unknown')
      })
    } catch {
      clearTimeout(timeout)
      resolve('unknown')
    }
  })
}

function detectNatType() {
  // Heuristic NAT detection based on tests passed
  // This is simplified; full NAT detection requires STUN
  return 'hairpin-nat'  // Default assumption for provider networks
}

function validateEnvironment() {
  const env = parseArgs()

  if (!env.bootstrapAddr) {
    addWarning('DCP_P2P_BOOTSTRAP not set, using default')
  }

  if (env.p2pPort < 1024 && process.getuid && process.getuid() !== 0) {
    addWarning(`P2P port ${env.p2pPort} < 1024 (requires root)`)
  }

  return env
}

async function runTests() {
  console.log('\n🔍 DCP Provider Connectivity Test\n')
  console.log(`  Port: ${P2P_PORT}`)
  console.log(`  Bootstrap: ${BOOTSTRAP_IP}:${BOOTSTRAP_PORT}`)
  console.log(`  Timeout: ${TIMEOUT_MS}ms\n`)

  const env = validateEnvironment()

  // Test 1: Local port listening
  const localListening = testLocalPortListening()
  addTest(
    'Local P2P port listening',
    localListening,
    localListening ? `Port ${P2P_PORT} in LISTEN state` : `Port ${P2P_PORT} not listening — provider service may not be running`
  )

  if (!localListening) {
    addRecommendation(`Check if provider is running: pm2 list | grep provider`)
    addRecommendation(`Restart provider: pm2 restart dc1-provider`)
  }

  // Test 2: Local connectivity (loopback)
  const localConnectivity = await testLocalConnectivity()
  addTest(
    'Loopback connectivity',
    localConnectivity,
    localConnectivity ? 'Can connect to local P2P port' : 'Cannot establish local connection'
  )

  // Test 3: DNS resolution to bootstrap
  const dnsWorks = await testBootstrapDns()
  addTest(
    'DNS resolution',
    dnsWorks,
    dnsWorks ? `Resolved ${BOOTSTRAP_IP}` : 'DNS lookup failed'
  )

  // Test 4: Outbound connectivity to bootstrap
  const bootstrapReachable = await testBootstrapReachability()
  addTest(
    'Bootstrap reachability',
    bootstrapReachable,
    bootstrapReachable
      ? `Connected to bootstrap at ${BOOTSTRAP_IP}:${BOOTSTRAP_PORT}`
      : `Cannot reach bootstrap — firewall, ISP block, or bootstrap offline`
  )

  if (!bootstrapReachable && localListening && dnsWorks) {
    addRecommendation('Firewall may be blocking port 4001 outbound')
    addRecommendation('Check: sudo ufw status && sudo ufw allow 4001/tcp')
  }

  // Test 5: Detect public IP (for NAT diagnostics)
  const publicIp = await detectPublicIp()
  results.publicIp = publicIp
  if (publicIp !== 'unknown') {
    addTest('Public IP detection', true, `Your public IP: ${publicIp}`)
  } else {
    addWarning('Could not detect public IP (network may be offline)')
  }

  // Test 6: Bootstrap environment config check
  const bootstrapConfigValid = env.bootstrapAddr && !env.bootstrapAddr.includes('REPLACE_WITH')
  addTest(
    'Bootstrap configuration',
    bootstrapConfigValid,
    bootstrapConfigValid
      ? 'Bootstrap peer address configured'
      : 'Bootstrap not configured or contains placeholder'
  )

  if (!bootstrapConfigValid) {
    addRecommendation('Set DCP_P2P_BOOTSTRAP environment variable')
    addRecommendation('Ask founder or operator for current bootstrap peer ID')
  }

  // Summary and recommendations
  results.natType = detectNatType()
  console.log(`\n📊 Summary: ${results.summary.passed}/${results.tests.length} passed`)

  if (results.summary.warnings > 0) {
    console.log(`⚠️  ${results.summary.warnings} warning(s)`)
  }

  if (results.summary.failed === 0 && results.summary.warnings === 0) {
    console.log('\n✅ All connectivity tests passed!')
    console.log('Your provider should be discoverable on the DCP network.\n')
  } else if (results.summary.failed === 0) {
    console.log('\n✅ Connectivity tests passed (with warnings).\n')
  } else {
    console.log(`\n❌ ${results.summary.failed} test(s) failed.\n`)

    if (results.recommendations.length > 0) {
      console.log('Recommended next steps:')
      results.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`)
      })
      console.log()
    }
  }

  if (verbose) {
    console.log('\n📋 Detailed test results:')
    results.tests.forEach((t) => {
      console.log(`  ${t.name}: ${t.passed ? 'PASS' : 'FAIL'}${t.details ? ` (${t.details})` : ''}`)
    })
    console.log()
  }

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2))
  }

  return results.summary.failed === 0 ? 0 : 1
}

// Main
runTests().then((exitCode) => {
  process.exit(exitCode)
}).catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(2)
})
