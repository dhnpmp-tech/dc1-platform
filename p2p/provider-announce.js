#!/usr/bin/env node
/**
 * DC1 P2P Provider Announce — daemon integration hook
 *
 * Called by dc1_daemon.py after each heartbeat to advertise this machine's
 * GPU compute spec to the DC1 Kademlia DHT.
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *
 *   node p2p/provider-announce.js --spec '{"gpu":"RTX 4090","vram_gb":24,"price_sar_per_hour":45}'
 */

import { readFileSync } from 'fs'

function parseArgs () {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spec' && args[i + 1]) {
      result.spec = args[i + 1]
      i++
    } else if (args[i] === '--spec-file' && args[i + 1]) {
      result.specFile = args[i + 1]
      i++
    }
  }
  return result
}

function parseBoolean (value, fallback = false) {
  const normalized = String(value || '').toLowerCase()
  if (!normalized) return fallback
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parsePositiveInt (value, fallback = 0) {
  const num = Number.parseInt(value, 10)
  if (!Number.isFinite(num) || num < 0) return fallback
  return num
}

function normalizeBootstrapList (value) {
  if (Array.isArray(value)) {
    return value
  }
  return String(value || '')
    .split(',')
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry.length > 0 && !entry.includes('REPLACE_WITH_BOOTSTRAP_PEER_ID'))
}

function getBootstrapEnvRaw () {
  return process.env.DCP_P2P_BOOTSTRAP || process.env.DC1_P2P_BOOTSTRAP || ''
}

function buildNodeOptions () {
  return {
    port: parsePositiveInt(process.env.DCP_P2P_PORT ?? process.env.DC1_P2P_PORT, 0),
    bootstrapList: normalizeBootstrapList(getBootstrapEnvRaw()),
    clientMode: false,
    localMode: parseBoolean(process.env.P2P_DISCOVERY_LOCAL_MODE, false),
    enableMdns: parseBoolean(process.env.P2P_DISCOVERY_ENABLE_MDNS, false),
    enableWebSocket: parseBoolean(process.env.P2P_DISCOVERY_ENABLE_WEBSOCKET, false),
    enableRelay: parseBoolean(process.env.P2P_DISCOVERY_ENABLE_RELAY, false),
    enableGossipsub: parseBoolean(process.env.P2P_DISCOVERY_ENABLE_GOSSIPSUB, false),
  }
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

async function waitForPeers (node, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (node.getPeers().length > 0) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

async function loadRuntime () {
  try {
    const scaffold = await import('./dcp-discovery-scaffold.js')
    return {
      flavor: 'scaffold',
      createNode: scaffold.createDiscoveryNode,
      announce: scaffold.announceProviderEnvironment,
      stopOnFinish: async (node) => node.stop(),
      getAddress: scaffold.nodeAddress,
      announceSpec: (spec) => spec,
    }
  } catch (error) {
    console.warn('[announce] Falling back to legacy DHT module:', error.message)
  }

  const legacy = await import('./dc1-node.js')
  return {
    flavor: 'legacy',
    createNode: legacy.createDC1Node,
    announce: legacy.announceProvider,
    stopOnFinish: async (node) => node.stop(),
    getAddress: legacy.nodeAddr,
    announceSpec: (spec) => ({
      ...spec,
      announced_at: new Date().toISOString(),
    }),
  }
}

async function main () {
  const parsed = parseArgs()
  const spec = loadSpec(parsed)
  const nodeOptions = buildNodeOptions()
  const runtime = await loadRuntime()
  const timeoutMs = parsePositiveInt(process.env.DCP_P2P_TIMEOUT_MS ?? process.env.DC1_P2P_TIMEOUT_MS, 15000)
  const ttlMs = parsePositiveInt(process.env.P2P_DISCOVERY_TTL_MS, 120000)

  if (!runtime || !runtime.createNode) {
    throw new Error('No announcement runtime available')
  }

  if (!nodeOptions.bootstrapList.length) {
    console.warn('[announce] DCP_P2P_BOOTSTRAP (or DC1_P2P_BOOTSTRAP) not set — using local-only mode')
  }

  console.log('[announce] Starting provider node...')
  const node = await runtime.createNode(nodeOptions)
  console.log(`[announce] Flavor     : ${runtime.flavor}`)
  console.log(`[announce] Peer ID    : ${node.peerId.toString()}`)
  console.log(`[announce] Address    : ${runtime.getAddress(node)}`)
  console.log(`[announce] Spec       : ${JSON.stringify(spec)}`)

  if (nodeOptions.bootstrapList.length > 0) {
    const connected = await waitForPeers(node, Math.min(timeoutMs, 8000))
    if (!connected) {
      console.warn('[announce] No peers connected before timeout')
    } else {
      console.log(`[announce] Connected to ${node.getPeers().length} peer(s)`)
    }
  }

  if (runtime.flavor === 'scaffold') {
    const advertised = await runtime.announce(node, runtime.announceSpec(spec), {
      ttlMs,
    })
    console.log('[announce] DHT envelope:', JSON.stringify({
      peer_id: advertised.peer_id,
      env_cid: advertised.env_cid,
    }))
  } else {
    await runtime.announce(node, runtime.announceSpec(spec))
  }

  await runtime.stopOnFinish(node)
  console.log('[announce] Node stopped')
  process.exit(0)
}

main().catch((err) => {
  console.error('[announce] Fatal error:', err)
  process.exit(1)
})
