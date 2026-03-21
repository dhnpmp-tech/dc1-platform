#!/usr/bin/env node

import {
  announceProviderEnvironment,
  createDiscoveryNode,
  resolveEnvironmentByCid,
  resolveProviderByPeerId
} from './dcp-discovery-scaffold.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
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

  try {
    await renterNode.dial(providerNode.getMultiaddrs()[0])
    await sleep(300)

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
      tags: ['inference', 'arabic-models']
    })

    assert(typeof announced.env_cid === 'string' && announced.env_cid.length > 0, 'announce did not return env_cid')

    await sleep(400)

    const resolvedByPeer = await resolveProviderByPeerId(renterNode, providerNode.peerId.toString())
    assert(resolvedByPeer?.provider?.env_cid === announced.env_cid, 'peer lookup env_cid mismatch')
    assert(resolvedByPeer?.environment?.env?.gpu_model === 'RTX 4090', 'peer lookup gpu_model mismatch')

    const resolvedByCid = await resolveEnvironmentByCid(renterNode, announced.env_cid)
    assert(resolvedByCid?.env?.region === 'riyadh-sa', 'cid lookup region mismatch')
    assert(Number(resolvedByCid?.env?.vram_gb) === 24, 'cid lookup vram mismatch')

    console.log('SMOKE PASS: publish+discover flow succeeded')
    console.log(`peer_id=${providerNode.peerId.toString()}`)
    console.log(`env_cid=${announced.env_cid}`)
  } finally {
    await renterNode.stop()
    await providerNode.stop()
  }
}

main().catch((error) => {
  console.error(`SMOKE FAIL: ${error.message}`)
  process.exit(1)
})
