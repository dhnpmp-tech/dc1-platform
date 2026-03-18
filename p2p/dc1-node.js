/**
 * DC1 P2P Node — libp2p Kademlia DHT (Phase C Prototype)
 *
 * Factory for creating DC1 libp2p nodes. Each node can operate as:
 *   - Provider (server mode): announces GPU specs to DHT, participates in routing
 *   - Renter (client mode):   queries DHT to discover providers, no routing duty
 *   - Bootstrap:              stable well-known router on the VPS, no data storage
 *
 * Stack:
 *   Transport:   TCP  (WebSocket added in Phase D for browser renters)
 *   Encryption:  Noise protocol
 *   Muxer:       Yamux
 *   Discovery:   Kademlia DHT (/dc1/kad/1.0.0 — scoped, won't touch public IPFS DHT)
 *   Peers:       Bootstrap node on VPS for initial seeding
 *
 * DHT key schema:
 *   /dc1/provider/{peerId}   →  JSON GPU spec for that provider
 *
 * Phase D additions (not in this file):
 *   WebSocket transport, Circuit Relay for NAT, GossipSub for real-time availability
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@libp2p/noise'
import { yamux } from '@libp2p/yamux'
import { kadDHT } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'

// ── Constants ──────────────────────────────────────────────────────────────

/** DHT key prefix for all DC1 provider records */
const DC1_PROVIDER_PREFIX = '/dc1/provider/'

/**
 * Default bootstrap node on the DC1 VPS.
 * Update DC1_P2P_BOOTSTRAP env var (or this const) after running bootstrap.js.
 */
export const DEFAULT_BOOTSTRAP_ADDR =
  process.env.DC1_P2P_BOOTSTRAP ||
  '/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'

// ── Node factory ───────────────────────────────────────────────────────────

/**
 * Create and start a DC1 libp2p node.
 *
 * @param {object}   opts
 * @param {number}   opts.port          TCP port to listen on (0 = OS-assigned random)
 * @param {string[]} opts.bootstrapList Multiaddrs of bootstrap peers to connect to
 * @param {boolean}  opts.clientMode    If true, node only queries DHT (light client)
 * @returns {Promise<import('libp2p').Libp2p>}
 */
export async function createDC1Node ({
  port = 0,
  bootstrapList = [],
  clientMode = false
} = {}) {
  const config = {
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${port}`]
    },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      dht: kadDHT({
        // Scoped protocol — DC1 DHT is isolated from the public IPFS DHT
        protocol: '/dc1/kad/1.0.0',
        // clientMode=true: queries only (renters). false: full routing table + stores data.
        clientMode,
        // Small kBucketSize suits prototype networks with < 20 nodes.
        // Production default is 20.
        kBucketSize: 2,
        // How often this node refreshes its own position in the DHT
        querySelfInterval: 10_000
      })
    }
  }

  if (bootstrapList.length > 0) {
    config.peerDiscovery = [
      bootstrap({ list: bootstrapList })
    ]
  }

  const node = await createLibp2p(config)
  await node.start()
  return node
}

// ── DHT key helpers ────────────────────────────────────────────────────────

/**
 * Build the DHT key for a provider peer.
 * Key format: /dc1/provider/{peerId}
 *
 * @param {string} peerId
 * @returns {Uint8Array}
 */
export function providerKey (peerId) {
  return new TextEncoder().encode(`${DC1_PROVIDER_PREFIX}${peerId}`)
}

// ── Provider operations ────────────────────────────────────────────────────

/**
 * Announce this node's GPU compute spec to the DHT.
 *
 * The record is stored at /dc1/provider/{peerId} and replicated to the
 * K closest peers in the routing table.  Call this every ~30 s (daemon
 * heartbeat cadence) to keep the record alive.
 *
 * @param {import('libp2p').Libp2p} node  The provider's libp2p node
 * @param {object} spec                   GPU spec (gpu, vram_gb, price_sar_per_hour…)
 */
export async function announceProvider (node, spec) {
  const key = providerKey(node.peerId.toString())
  const record = {
    ...spec,
    peer_id: node.peerId.toString(),
    announced_at: new Date().toISOString(),
    addrs: node.getMultiaddrs().map(ma => ma.toString())
  }
  const value = new TextEncoder().encode(JSON.stringify(record))

  // DHT put() returns an async iterator of routing events; consume them all.
  for await (const event of node.services.dht.put(key, value)) {
    if (event.name === 'QUERY_ERROR') {
      console.warn(`[P2P] DHT put warning: ${event.error?.message ?? 'unknown'}`)
    }
  }
  console.log(`[P2P] Announced: ${DC1_PROVIDER_PREFIX}${node.peerId.toString()}`)
}

// ── Renter operations ──────────────────────────────────────────────────────

/**
 * Fetch a single provider's GPU spec from the DHT by peer ID.
 *
 * Traverses the DHT routing table to find the K closest nodes that
 * store /dc1/provider/{peerId}, then returns the parsed spec.
 *
 * @param {import('libp2p').Libp2p} node  The renter's libp2p node
 * @param {string} peerId                 Target provider's peer ID string
 * @returns {Promise<object|null>}        Parsed spec or null if not found
 */
export async function getProviderSpec (node, peerId) {
  const key = providerKey(peerId)
  try {
    for await (const event of node.services.dht.get(key)) {
      if (event.name === 'VALUE') {
        return JSON.parse(new TextDecoder().decode(event.value))
      }
    }
  } catch (err) {
    console.warn(`[P2P] DHT get failed for ${peerId}: ${err.message}`)
  }
  return null
}

// ── Utility ────────────────────────────────────────────────────────────────

/**
 * Return the first TCP multiaddr of a node as a string.
 *
 * @param {import('libp2p').Libp2p} node
 * @returns {string}
 */
export function nodeAddr (node) {
  const addrs = node.getMultiaddrs()
  return addrs.length > 0 ? addrs[0].toString() : '(no address yet)'
}

/**
 * Wait for a node to connect to at least one peer, up to a timeout.
 *
 * @param {import('libp2p').Libp2p} node
 * @param {number} timeoutMs
 * @returns {Promise<boolean>} true if connected, false if timeout
 */
export async function waitForPeers (node, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (node.getPeers().length > 0) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}
