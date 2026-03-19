/**
 * DC1 P2P Bootstrap Node
 *
 * Run on the VPS (76.13.179.86) alongside the Express API.
 * Provides a stable, well-known peer address so that newly started
 * provider and renter nodes can find the DHT on first boot.
 *
 * This node ONLY routes — it does NOT store provider records or
 * participate in DC1 business logic.
 *
 * ── Quick start ───────────────────────────────────────────────
 *   node p2p/bootstrap.js
 *
 * ── PM2 (recommended for VPS) ─────────────────────────────────
 *   pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
 *   pm2 save
 *
 * ── After first run ───────────────────────────────────────────
 *   Copy the printed multiaddr and set it as:
 *     DC1_P2P_BOOTSTRAP env var on all provider machines
 *     DEFAULT_BOOTSTRAP_ADDR in dc1-node.js
 *
 * ── Stable peer ID across restarts ────────────────────────────
 *   libp2p generates a random peer ID each start by default.
 *   For a stable, predictable multiaddr, generate a key once and
 *   persist it (future enhancement tracked in Phase D backlog).
 *
 * ── Environment vars ──────────────────────────────────────────
 *   DC1_P2P_BOOTSTRAP_PORT  TCP port (default: 4001)
 */

import { createDC1Node, nodeAddr } from './dc1-node.js'

const PORT = parseInt(process.env.DC1_P2P_BOOTSTRAP_PORT ?? '4001', 10)

async function main () {
  console.log('[Bootstrap] Starting DC1 P2P bootstrap node...')

  const node = await createDC1Node({
    port: PORT,
    bootstrapList: [],  // bootstrap itself has no upstream seeds
    clientMode: false   // full server mode: participates in DHT routing
  })

  // In libp2p 3.x, getMultiaddrs() already includes /p2p/{peerId}
  const fullAddr = nodeAddr(node)

  console.log('[Bootstrap] ─────────────────────────────────────────────')
  console.log(`[Bootstrap] Peer ID  : ${node.peerId.toString()}`)
  console.log(`[Bootstrap] Address  : ${fullAddr}`)
  console.log('[Bootstrap] ─────────────────────────────────────────────')
  console.log('[Bootstrap]')
  console.log('[Bootstrap] Set this as DC1_P2P_BOOTSTRAP on provider machines:')
  console.log(`[Bootstrap]   ${fullAddr}`)
  console.log('[Bootstrap]')
  console.log('[Bootstrap] Also update DEFAULT_BOOTSTRAP_ADDR in p2p/dc1-node.js')
  console.log('[Bootstrap] ─────────────────────────────────────────────')
  console.log('[Bootstrap] Listening for peers...')

  node.addEventListener('peer:connect', (event) => {
    console.log(`[Bootstrap] + peer connected   : ${event.detail.toString()}`)
    console.log(`[Bootstrap]   routing table size: ${node.getPeers().length}`)
  })

  node.addEventListener('peer:disconnect', (event) => {
    console.log(`[Bootstrap] - peer disconnected: ${event.detail.toString()}`)
  })

  process.on('SIGINT', async () => {
    console.log('\n[Bootstrap] Received SIGINT — shutting down...')
    await node.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n[Bootstrap] Received SIGTERM — shutting down...')
    await node.stop()
    process.exit(0)
  })
}

main().catch(err => {
  console.error('[Bootstrap] Fatal error:', err)
  process.exit(1)
})
