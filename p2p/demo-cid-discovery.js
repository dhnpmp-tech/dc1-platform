#!/usr/bin/env node

import {
  announceProviderEnvironment,
  createDiscoveryNode,
  nodeAddress,
  resolveEnvironmentByCid,
  resolveProviderByPeerId
} from './dcp-discovery-scaffold.js'

function log(message) {
  console.log(`[cid-demo] ${message}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  log('Starting provider + renter nodes for CID discovery demo')

  const providerNode = await createDiscoveryNode({
    port: 0,
    clientMode: false,
    localMode: true,
    enableMdns: false,
    enableWebSocket: false,
    enableRelay: false,
    enableGossipsub: false
  })

  const renterNode = await createDiscoveryNode({
    port: 0,
    clientMode: true,
    localMode: true,
    enableMdns: false,
    enableWebSocket: false,
    enableRelay: false,
    enableGossipsub: false
  })

  log(`Provider peer: ${providerNode.peerId.toString()}`)
  log(`Provider addr: ${nodeAddress(providerNode)}`)
  log(`Renter peer  : ${renterNode.peerId.toString()}`)
  log(`Renter addr  : ${nodeAddress(renterNode)}`)

  await renterNode.dial(providerNode.getMultiaddrs()[0])
  await sleep(500)

  const announced = await announceProviderEnvironment(providerNode, {
    gpu_model: 'RTX 4090',
    vram_gb: 24,
    price_sar_per_hour: 49,
    cuda_version: '12.4',
    driver_version: '550.54',
    os: 'ubuntu-22.04',
    region: 'riyadh-sa',
    reliability_score: 99.2,
    available_slots: 1,
    tags: ['inference', 'image-gen']
  })

  log(`Provider announced env CID: ${announced.env_cid}`)
  await sleep(700)

  const byPeer = await resolveProviderByPeerId(renterNode, providerNode.peerId.toString())
  if (!byPeer) {
    log('Provider lookup by peer ID failed')
  } else {
    log(`Lookup by peer ID resolved CID: ${byPeer.provider.env_cid}`)
    log(`Resolved GPU model           : ${byPeer.environment.env.gpu_model}`)
    log(`Resolved price (SAR/hr)      : ${byPeer.environment.env.price_sar_per_hour}`)
  }

  const byCid = await resolveEnvironmentByCid(renterNode, announced.env_cid)
  if (!byCid) {
    log('Environment lookup by CID failed')
  } else {
    log(`Lookup by CID resolved vRAM  : ${byCid.env.vram_gb} GB`)
    log(`Lookup by CID resolved region: ${byCid.env.region}`)
  }

  await renterNode.stop()
  await providerNode.stop()
  log('Demo completed')
}

main().catch((error) => {
  console.error(`[cid-demo] Fatal error: ${error.message}`)
  process.exit(1)
})

