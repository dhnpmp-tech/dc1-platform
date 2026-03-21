/**
 * DCP P2P Discovery Scaffold (Phase A/B -> Phase C migration)
 *
 * This module keeps today's working TCP + Kad-DHT path, while adding:
 * - CID-based compute environment advertisements in the DHT
 * - Ocean-style DHT namespace: /dcp/nodes/1.0.0/kad/1.0.0/*
 * - optional mDNS, WebSocket, Circuit Relay, and GossipSub hooks
 *
 * Optional features are loaded lazily. If related packages are not installed,
 * the node still starts and logs a warning.
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@libp2p/noise'
import { yamux } from '@libp2p/yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { kadDHT, passthroughMapper, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as jsonCodec from 'multiformats/codecs/json'
import { multiaddr } from '@multiformats/multiaddr'

export { multiaddr, CID }

export const DCP_KAD_PROTOCOL = '/dcp/nodes/1.0.0/kad/1.0.0'
export const DCP_ENV_PREFIX = `${DCP_KAD_PROTOCOL}/environments/`
export const DCP_PROVIDER_PREFIX = `${DCP_KAD_PROTOCOL}/providers/`
export const DCP_GOSSIP_TOPIC = '/dcp/providers/availability/1.0.0'
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function encodeJson(obj) {
  return textEncoder.encode(JSON.stringify(obj))
}

function decodeJson(bytes) {
  return JSON.parse(textDecoder.decode(bytes))
}

function withTimeout(ms) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout)
  }
}

async function importOptional(featureName, importer, symbols) {
  try {
    const loaded = await importer()
    return { enabled: true, module: loaded }
  } catch {
    console.warn(`[DCP-P2P] ${featureName} package not installed - running without it`)
    return { enabled: false, module: null }
  }
}

async function loadOptionalFeatures(options) {
  const loaded = {
    webSockets: null,
    mdns: null,
    circuitRelayTransport: null,
    circuitRelayServer: null,
    gossipsub: null
  }

  if (options.enableWebSocket) {
    const ws = await importOptional(
      'WebSocket transport',
      () => import('@libp2p/websockets')
    )
    loaded.webSockets = ws.enabled ? ws.module.webSockets : null
  }

  if (options.enableMdns) {
    const mdns = await importOptional(
      'mDNS peer discovery',
      () => import('@libp2p/mdns')
    )
    loaded.mdns = mdns.enabled ? mdns.module.mdns : null
  }

  if (options.enableRelay) {
    const relay = await importOptional(
      'Circuit Relay v2',
      () => import('@libp2p/circuit-relay-v2')
    )
    loaded.circuitRelayTransport = relay.enabled ? relay.module.circuitRelayTransport : null
    loaded.circuitRelayServer = relay.enabled ? relay.module.circuitRelayServer : null
  }

  if (options.enableGossipsub) {
    const pubsub = await importOptional(
      'GossipSub',
      () => import('@chainsafe/libp2p-gossipsub')
    )
    loaded.gossipsub = pubsub.enabled ? pubsub.module.gossipsub : null
  }

  return loaded
}

function toEnvCid(envRecord) {
  const bytes = jsonCodec.encode(envRecord)
  return Promise.resolve(sha256.digest(bytes)).then((digest) => CID.createV1(jsonCodec.code, digest))
}

export function environmentKeyFromCid(cid) {
  return textEncoder.encode(`${DCP_ENV_PREFIX}${cid.toString()}`)
}

export function providerKey(peerId) {
  return textEncoder.encode(`${DCP_PROVIDER_PREFIX}${peerId}`)
}

async function dhtPutJson(node, key, value, timeoutMs = 8000) {
  const timeout = withTimeout(timeoutMs)
  try {
    for await (const event of node.services.dht.put(key, encodeJson(value), { signal: timeout.signal })) {
      if (event.name === 'QUERY_ERROR') {
        console.warn(`[DCP-P2P] DHT put warning: ${event.error?.message ?? 'unknown'}`)
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError' && error.name !== 'TimeoutError') {
      throw error
    }
    console.warn('[DCP-P2P] DHT put timed out in small network - continuing')
  } finally {
    timeout.clear()
  }
}

async function dhtGetJson(node, key, timeoutMs = 8000) {
  const timeout = withTimeout(timeoutMs)
  try {
    for await (const event of node.services.dht.get(key, { signal: timeout.signal })) {
      if (event.name === 'VALUE') {
        return decodeJson(event.value)
      }
    }
    return null
  } catch {
    return null
  } finally {
    timeout.clear()
  }
}

export async function createDiscoveryNode({
  port = 0,
  bootstrapList = [],
  clientMode = false,
  localMode = true,
  enableMdns = true,
  enableWebSocket = true,
  enableRelay = true,
  enableGossipsub = true
} = {}) {
  const optional = await loadOptionalFeatures({
    enableMdns,
    enableWebSocket,
    enableRelay,
    enableGossipsub
  })

  const transports = [tcp()]
  if (optional.webSockets) {
    transports.push(optional.webSockets())
  }
  if (optional.circuitRelayTransport) {
    transports.push(optional.circuitRelayTransport())
  }

  const peerDiscovery = []
  if (bootstrapList.length > 0) {
    peerDiscovery.push(bootstrap({ list: bootstrapList }))
  }
  if (optional.mdns) {
    peerDiscovery.push(optional.mdns())
  }

  const services = {
    identify: identify(),
    ping: ping(),
    dht: kadDHT({
      protocol: DCP_KAD_PROTOCOL,
      clientMode,
      kBucketSize: 20,
      querySelfInterval: 15_000,
      peerInfoMapper: localMode ? passthroughMapper : removePrivateAddressesMapper,
      validators: {
        dcp: async () => {}
      },
      selectors: {
        dcp: (_key, _records) => 0
      }
    })
  }

  if (optional.gossipsub) {
    services.pubsub = optional.gossipsub({
      allowPublishToZeroPeers: true
    })
  }

  if (optional.circuitRelayServer) {
    services.relay = optional.circuitRelayServer()
  }

  const node = await createLibp2p({
    addresses: {
      listen: [
        `/ip4/0.0.0.0/tcp/${port}`,
        ...(optional.webSockets ? [`/ip4/0.0.0.0/tcp/${port}/ws`] : [])
      ]
    },
    transports,
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery,
    services
  })

  await node.start()
  return node
}

export function nodeAddress(node) {
  const addrs = node.getMultiaddrs()
  return addrs.length > 0 ? addrs[0].toString() : '(no address yet)'
}

function normalizeProviderEnv(providerEnv) {
  return {
    gpu_model: providerEnv.gpu_model ?? providerEnv.gpu ?? 'unknown',
    vram_gb: Number(providerEnv.vram_gb ?? providerEnv.vram ?? 0),
    price_sar_per_hour: Number(providerEnv.price_sar_per_hour ?? 0),
    cuda_version: providerEnv.cuda_version ?? null,
    driver_version: providerEnv.driver_version ?? null,
    os: providerEnv.os ?? null,
    region: providerEnv.region ?? providerEnv.location ?? 'sa',
    reliability_score: Number(providerEnv.reliability_score ?? 0),
    daemon_version: providerEnv.daemon_version ?? null,
    available_slots: Number(providerEnv.available_slots ?? 1),
    tags: Array.isArray(providerEnv.tags) ? providerEnv.tags : []
  }
}

export async function announceProviderEnvironment(node, providerEnv) {
  const normalized = normalizeProviderEnv(providerEnv)
  const envCid = await toEnvCid(normalized)
  const now = new Date().toISOString()

  const envEnvelope = {
    version: 1,
    cid: envCid.toString(),
    env: normalized,
    announced_at: now
  }

  const providerEnvelope = {
    version: 1,
    peer_id: node.peerId.toString(),
    env_cid: envCid.toString(),
    announced_at: now,
    addrs: node.getMultiaddrs().map((address) => address.toString())
  }

  await dhtPutJson(node, environmentKeyFromCid(envCid), envEnvelope)
  await dhtPutJson(node, providerKey(node.peerId.toString()), providerEnvelope)

  if (node.services.pubsub) {
    await node.services.pubsub.publish(DCP_GOSSIP_TOPIC, encodeJson({
      type: 'provider.announce',
      peer_id: providerEnvelope.peer_id,
      env_cid: providerEnvelope.env_cid,
      announced_at: providerEnvelope.announced_at
    }))
  }

  return providerEnvelope
}

export async function resolveProviderByPeerId(node, peerId) {
  const provider = await dhtGetJson(node, providerKey(peerId))
  if (!provider || !provider.env_cid) {
    return null
  }

  const env = await dhtGetJson(node, environmentKeyFromCid(CID.parse(provider.env_cid)))
  if (!env) {
    return null
  }

  return {
    provider,
    environment: env
  }
}

export async function resolveEnvironmentByCid(node, cidInput) {
  const cid = typeof cidInput === 'string' ? CID.parse(cidInput) : cidInput
  return dhtGetJson(node, environmentKeyFromCid(cid))
}

export async function subscribeProviderAvailability(node, onEvent) {
  if (!node.services.pubsub) {
    console.warn('[DCP-P2P] GossipSub is not enabled on this node')
    return () => {}
  }

  const handler = (evt) => {
    if (evt.detail.topic !== DCP_GOSSIP_TOPIC) {
      return
    }

    try {
      onEvent(decodeJson(evt.detail.data))
    } catch (error) {
      console.warn(`[DCP-P2P] Failed to decode gossip event: ${error.message}`)
    }
  }

  node.services.pubsub.addEventListener('message', handler)
  await node.services.pubsub.subscribe(DCP_GOSSIP_TOPIC)

  return async () => {
    await node.services.pubsub.unsubscribe(DCP_GOSSIP_TOPIC)
    node.services.pubsub.removeEventListener('message', handler)
  }
}
