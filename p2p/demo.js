#!/usr/bin/env node
/**
 * DC1 P2P Demo — end-to-end provider discovery without the VPS
 *
 * Spawns two in-process libp2p nodes:
 *   1. Provider node  — announces an RTX 4090 GPU spec to the DHT
 *   2. Renter node    — discovers the provider by peer ID lookup
 *
 * Run:
 *   node p2p/demo.js
 *
 * Expected output:
 *   [demo] Provider peer ID: 12D3Koo...
 *   [demo] Renter  peer ID: 12D3Koo...
 *   [demo] Provider announced GPU spec to DHT
 *   [demo] Renter querying DHT for provider 12D3Koo...
 *   [demo] ✓ Provider discovered!
 *   [demo]   gpu              : RTX 4090
 *   [demo]   vram_gb          : 24
 *   [demo]   price_sar_per_hour: 45
 *   [demo]   peer_id          : 12D3Koo...
 *   [demo]   announced_at     : 2026-03-18T...
 *   [demo]   addrs            : ["/ip4/127.0.0.1/tcp/..."]
 *   [demo] Done.
 *
 * Notes:
 *   - No bootstrap server required; provider addr is dialled directly.
 *   - This simulates Phase C: renters know the provider's peer ID from a
 *     DHT walk started at any well-known node (VPS bootstrap in production).
 *   - In Phase D, renters will walk the full DHT using a shared key prefix
 *     (/dc1/provider/*) once libp2p Kademlia supports prefix scans. For now
 *     direct lookup by peer ID is the stable API.
 */

import { createDC1Node, announceProvider, getProviderSpec, nodeAddr } from './dc1-node.js'

const PROVIDER_SPEC = {
  gpu: 'RTX 4090',
  vram_gb: 24,
  price_sar_per_hour: 45,
  cuda_version: '12.3',
  driver_version: '545.23.08',
  location: 'Riyadh, SA'
}

// ── Utility ────────────────────────────────────────────────────────────────

function log (msg) {
  console.log(`[demo] ${msg}`)
}

function separator () {
  console.log('[demo] ─────────────────────────────────────────────────────')
}

/** Wait ms milliseconds */
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Demo ───────────────────────────────────────────────────────────────────

async function main () {
  separator()
  log('DC1 P2P Provider Discovery Demo')
  log('Phase C — libp2p Kademlia DHT prototype')
  separator()

  // ── 1. Start provider node ──────────────────────────────────────────────
  log('Starting provider node (no bootstrap)...')
  const providerNode = await createDC1Node({
    port: 0,          // OS-assigned random port
    bootstrapList: [], // direct demo: nodes discover each other via dial
    clientMode: false
  })
  const providerAddr = nodeAddr(providerNode)
  const providerId = providerNode.peerId.toString()
  const providerFullAddr = `${providerAddr}/p2p/${providerId}`

  log(`Provider peer ID : ${providerId}`)
  log(`Provider address : ${providerFullAddr}`)

  // ── 2. Start renter node ────────────────────────────────────────────────
  log('Starting renter node...')
  const renterNode = await createDC1Node({
    port: 0,
    bootstrapList: [],
    clientMode: true   // renters are DHT clients only
  })
  log(`Renter  peer ID : ${renterNode.peerId.toString()}`)
  log(`Renter  address : ${nodeAddr(renterNode)}`)

  separator()

  // ── 3. Dial provider directly (simulates bootstrap-assisted discovery) ──
  log(`Renter dialling provider at ${providerFullAddr}...`)
  try {
    await renterNode.dial(providerFullAddr)
    log('Connection established')
  } catch (err) {
    log(`Dial failed: ${err.message}`)
    log('Aborting demo — ensure TCP is available on loopback')
    await providerNode.stop()
    await renterNode.stop()
    process.exit(1)
  }

  // Brief pause so DHT routing tables settle
  await sleep(500)

  // ── 4. Provider announces GPU spec to DHT ──────────────────────────────
  log(`Provider announcing spec: ${JSON.stringify(PROVIDER_SPEC)}`)
  await announceProvider(providerNode, PROVIDER_SPEC)
  log('Spec written to DHT')

  // Give DHT propagation a moment
  await sleep(800)

  // ── 5. Renter discovers provider ───────────────────────────────────────
  separator()
  log(`Renter querying DHT for provider ${providerId}...`)
  const discovered = await getProviderSpec(renterNode, providerId)

  if (!discovered) {
    log('✗ Provider not found in DHT')
    log('  (This can happen in very small networks. Try running demo.js again.)')
  } else {
    log('✓ Provider discovered!')
    separator()
    const fields = [
      'gpu', 'vram_gb', 'price_sar_per_hour',
      'cuda_version', 'driver_version', 'location',
      'peer_id', 'announced_at', 'addrs'
    ]
    for (const f of fields) {
      if (discovered[f] !== undefined) {
        const val = Array.isArray(discovered[f])
          ? JSON.stringify(discovered[f])
          : discovered[f]
        log(`  ${f.padEnd(20)}: ${val}`)
      }
    }
  }

  separator()

  // ── 6. Illustrate multiple provider scenario (same process, new node) ──
  log('Bonus: announcing a second provider (RTX 3090)...')
  const provider2Node = await createDC1Node({
    port: 0,
    bootstrapList: [],
    clientMode: false
  })
  const provider2Id = provider2Node.peerId.toString()
  await renterNode.dial(`${nodeAddr(provider2Node)}/p2p/${provider2Id}`)
  await sleep(200)
  await announceProvider(provider2Node, {
    gpu: 'RTX 3090',
    vram_gb: 24,
    price_sar_per_hour: 30,
    location: 'Jeddah, SA'
  })
  await sleep(500)

  const discovered2 = await getProviderSpec(renterNode, provider2Id)
  if (discovered2) {
    log(`✓ Second provider discovered: ${discovered2.gpu} @ ${discovered2.price_sar_per_hour} SAR/hr`)
  } else {
    log('✗ Second provider not found (small network race — normal in prototype)')
  }

  separator()
  log('Phase C demo complete.')
  log('')
  log('Next steps (Phase D):')
  log('  • Run bootstrap.js on VPS (port 4001) for stable peer seeding')
  log('  • Set DC1_P2P_BOOTSTRAP env var on provider machines')
  log('  • Call provider-announce.js from dc1_daemon.py after heartbeat')
  log('  • Add WebSocket transport for browser-based renter discovery')
  log('  • Add GossipSub for real-time provider availability events')
  log('  • Build /dc1/rendezvous prefix-scan so renters find ALL providers')
  separator()

  // Graceful shutdown
  await provider2Node.stop()
  await renterNode.stop()
  await providerNode.stop()
  log('All nodes stopped. Bye.')
  process.exit(0)
}

main().catch(err => {
  console.error('[demo] Fatal error:', err)
  process.exit(1)
})
