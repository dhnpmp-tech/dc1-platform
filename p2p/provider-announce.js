#!/usr/bin/env node
/**
 * DC1 P2P Provider Announce — daemon integration hook
 *
 * Called by dc1_daemon.py after each heartbeat to advertise this machine's
 * GPU compute spec to the DC1 Kademlia DHT.
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *
 *   # Inline spec (from daemon subprocess call):
 *   node p2p/provider-announce.js --spec '{"gpu":"RTX 4090","vram_gb":24,"price_sar_per_hour":45}'
 *
 *   # From a JSON file:
 *   node p2p/provider-announce.js --spec-file /tmp/dc1-spec.json
 *
 *   # With a custom bootstrap node:
 *   DC1_P2P_BOOTSTRAP=/ip4/76.13.179.86/tcp/4001/p2p/<PEER_ID> \
 *     node p2p/provider-announce.js --spec '...'
 *
 * ── How dc1_daemon.py calls this ────────────────────────────────────────
 *
 *   Option A (subprocess — simplest):
 *     import subprocess, json
 *     spec = {"gpu": gpu_name, "vram_gb": vram, "price_sar_per_hour": price}
 *     subprocess.Popen(
 *       ["node", "p2p/provider-announce.js", "--spec", json.dumps(spec)],
 *       cwd="/opt/dc1"
 *     )
 *
 *   Option B (HTTP — if daemon already has aiohttp):
 *     POST /api/p2p/announce  { spec: {...} }
 *     (backend IPC route calls this module — see backend/src/routes/p2p.js in Phase D)
 *
 * ── Environment vars ─────────────────────────────────────────────────────
 *   DC1_P2P_BOOTSTRAP   Full multiaddr of bootstrap node (required in prod)
 *   DC1_P2P_PORT        Local TCP port for this provider's libp2p node (default: 0)
 *   DC1_P2P_TIMEOUT_MS  How long to wait for DHT put before exit (default: 15000)
 */

import { readFileSync } from 'fs'
import { createDC1Node, announceProvider, waitForPeers, DEFAULT_BOOTSTRAP_ADDR, nodeAddr } from './dc1-node.js'

// ── Argument parsing ───────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spec' && args[i + 1]) {
      result.spec = args[++i]
    } else if (args[i] === '--spec-file' && args[i + 1]) {
      result.specFile = args[++i]
    }
  }
  return result
}

function loadSpec (parsed) {
  if (parsed.spec) {
    try {
      return JSON.parse(parsed.spec)
    } catch (e) {
      console.error('[announce] --spec is not valid JSON:', e.message)
      process.exit(1)
    }
  }
  if (parsed.specFile) {
    try {
      return JSON.parse(readFileSync(parsed.specFile, 'utf8'))
    } catch (e) {
      console.error('[announce] Failed to read --spec-file:', e.message)
      process.exit(1)
    }
  }
  console.error('[announce] Error: provide --spec <json> or --spec-file <path>')
  process.exit(1)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main () {
  const parsed = parseArgs()
  const spec = loadSpec(parsed)

  const port = parseInt(process.env.DC1_P2P_PORT ?? '0', 10)
  const timeoutMs = parseInt(process.env.DC1_P2P_TIMEOUT_MS ?? '15000', 10)
  const bootstrapAddr = DEFAULT_BOOTSTRAP_ADDR

  // Skip if no real bootstrap is configured (placeholder addr)
  if (bootstrapAddr.includes('REPLACE_WITH_BOOTSTRAP_PEER_ID')) {
    console.warn('[announce] DC1_P2P_BOOTSTRAP not set — running in local-only mode')
    console.warn('[announce] Start bootstrap.js on VPS and set DC1_P2P_BOOTSTRAP env var')
  }

  const bootstrapList = bootstrapAddr.includes('REPLACE_WITH_BOOTSTRAP_PEER_ID')
    ? []
    : [bootstrapAddr]

  console.log('[announce] Starting provider node...')
  const node = await createDC1Node({
    port,
    bootstrapList,
    clientMode: false  // providers participate in routing
  })

  console.log(`[announce] Peer ID : ${node.peerId.toString()}`)
  console.log(`[announce] Address : ${nodeAddr(node)}`)
  console.log(`[announce] Spec    : ${JSON.stringify(spec)}`)

  // Wait for at least one peer if we have bootstrap peers
  if (bootstrapList.length > 0) {
    console.log('[announce] Waiting for peer connections...')
    const connected = await waitForPeers(node, Math.min(timeoutMs, 8000))
    if (!connected) {
      console.warn('[announce] No peers connected — DHT put may only be local')
    } else {
      console.log(`[announce] Connected to ${node.getPeers().length} peer(s)`)
    }
  }

  // Announce to DHT
  await announceProvider(node, spec)
  console.log('[announce] DHT announcement complete')

  // Graceful shutdown
  await node.stop()
  console.log('[announce] Node stopped')
  process.exit(0)
}

main().catch(err => {
  console.error('[announce] Fatal error:', err)
  process.exit(1)
})
