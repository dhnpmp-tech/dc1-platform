#!/usr/bin/env node
/**
 * DCP Provider Heartbeat Announcer
 *
 * Emits periodic heartbeats from a provider node to the P2P DHT.
 * Called by the Python daemon via subprocess to announce node liveness and metrics.
 *
 * Usage:
 *   node provider-heartbeat.js --peer-id <id> --metrics '{"cpu":45,"memory":60,"gpu":80}' --status healthy
 *
 * Environment:
 *   DCP_P2P_BOOTSTRAP: Bootstrap multiaddr (e.g., /ip4/76.13.179.86/tcp/4001/p2p/...)
 *   P2P_DISCOVERY_ENABLED: Enable P2P announcements (default: false)
 */

import * as heartbeat from './heartbeat-protocol.js'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@libp2p/noise'
import { yamux } from '@libp2p/yamux'
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { multiaddr } from '@multiformats/multiaddr'

const BOOTSTRAP_PROTOCOL = '/dcp/nodes/1.0.0/kad/1.0.0'
const P2P_ENABLED = (process.env.P2P_DISCOVERY_ENABLED || '').toLowerCase() === 'true'

function parseArgs() {
  const args = {}
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, '')
    const value = process.argv[i + 1]
    if (key === 'metrics' && value) {
      try {
        args[key] = JSON.parse(value)
      } catch {
        args[key] = {}
      }
    } else {
      args[key] = value
    }
  }
  return args
}

function normalizeMetrics(raw) {
  return {
    cpu_utilization: Math.min(100, Math.max(0, Number(raw?.cpu) || 0)),
    memory_utilization: Math.min(100, Math.max(0, Number(raw?.memory) || 0)),
    gpu_utilization: Math.min(100, Math.max(0, Number(raw?.gpu) || 0)),
  }
}

async function createProviderNode(bootstrapAddrs = []) {
  const config = {
    addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      ping: ping(),
      dht: kadDHT({
        protocol: BOOTSTRAP_PROTOCOL,
        clientMode: false, // Providers are full nodes
        kBucketSize: 2,
        querySelfInterval: 10000,
        peerInfoMapper: passthroughMapper,
      }),
    },
  }

  if (bootstrapAddrs.length > 0) {
    config.services.bootstrap = bootstrap({
      list: bootstrapAddrs,
    })
  }

  return createLibp2p(config)
}

async function announceHeartbeat(peerId, metrics, status, sequence = 0) {
  const bootstrapEnv = process.env.DCP_P2P_BOOTSTRAP || process.env.DC1_P2P_BOOTSTRAP || ''
  const bootstrapAddrs = bootstrapEnv
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && !a.includes('REPLACE_WITH_BOOTSTRAP_PEER_ID'))

  if (!P2P_ENABLED) {
    return { status: 'skipped', reason: 'P2P_DISCOVERY_ENABLED not set' }
  }

  if (!bootstrapAddrs.length) {
    return { status: 'skipped', reason: 'no_bootstrap_configured' }
  }

  let node = null
  try {
    console.error(`[heartbeat] Creating P2P node...`)
    node = await createProviderNode(bootstrapAddrs.map((a) => multiaddr(a)))
    await node.start()
    console.error(`[heartbeat] Node started: ${node.peerId}`)

    // Wait for DHT to initialize
    await new Promise((r) => setTimeout(r, 500))

    // Announce heartbeat
    console.error(`[heartbeat] Announcing heartbeat for peer ${peerId}...`)
    const result = await heartbeat.announceHeartbeat(node, peerId, {
      sequence,
      metrics,
      status,
      timeoutMs: 5000,
    })

    console.error(`[heartbeat] Announcement result: ${result.status}`)
    return result
  } catch (error) {
    console.error(`[heartbeat] Error: ${error.message}`)
    return { status: 'failed', reason: error.message }
  } finally {
    if (node) {
      try {
        await node.stop()
        console.error(`[heartbeat] Node stopped`)
      } catch (e) {
        console.error(`[heartbeat] Stop error: ${e.message}`)
      }
    }
  }
}

async function main() {
  const args = parseArgs()
  const peerId = args['peer-id'] || process.env.DCP_PEER_ID
  const rawMetrics = args.metrics || {}
  const status = args.status || 'healthy'
  const sequence = parseInt(args.sequence, 10) || 0

  if (!peerId) {
    console.error('[heartbeat] Error: --peer-id required or DCP_PEER_ID env var')
    process.exit(1)
  }

  const metrics = normalizeMetrics(rawMetrics)
  console.error(
    `[heartbeat] Peer: ${peerId}, Status: ${status}, CPU: ${metrics.cpu_utilization}%, Memory: ${metrics.memory_utilization}%, GPU: ${metrics.gpu_utilization}%`
  )

  const result = await announceHeartbeat(peerId, metrics, status, sequence)
  console.log(JSON.stringify(result))
  process.exit(result.status === 'failed' ? 1 : 0)
}

main().catch((error) => {
  console.error(`[heartbeat] Fatal: ${error.message}`)
  process.exit(1)
})
