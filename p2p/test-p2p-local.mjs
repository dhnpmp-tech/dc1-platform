#!/usr/bin/env node
/**
 * Local P2P Test Harness — DCP-826
 *
 * Spins up 3 libp2p nodes locally using the DC1 factory:
 *   - Node A (bootstrap): acts as DHT entry point
 *   - Node B (provider): registers GPU spec to DHT
 *   - Node C (renter): discovers Node B via DHT through Node A
 *
 * Success: Node C finds Node B within 5 seconds, latency < 100ms typically.
 * Purpose: Proves P2P discovery works before VPS bootstrap deployment (DCP-612).
 *
 * Usage: node test-p2p-local.mjs
 * Exit codes:
 *   0 = success (discovery works)
 *   1 = failure (discovery timeout or error)
 */

import { createDC1Node, nodeAddr, providerKey, announceProvider, getProviderSpec, waitForPeers } from './dc1-node.js'

async function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runTest () {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  DC1 Local P2P Test Harness — DCP-826')
  console.log('═══════════════════════════════════════════════════════════\n')

  let nodeA, nodeB, nodeC
  const startTime = Date.now()

  try {
    // Step 1: Create bootstrap node (Node A)
    console.log('[Step 1] Starting bootstrap node (Node A)...')
    nodeA = await createDC1Node({
      port: 9001,
      bootstrapList: [],
      clientMode: false,
      localMode: true
    })
    const addrA = nodeAddr(nodeA)
    console.log(`✓ [Bootstrap] Started`)
    console.log(`  Peer ID: ${nodeA.peerId.toString()}`)
    console.log(`  Address: ${addrA}`)

    // Step 2: Create provider node (Node B)
    console.log('\n[Step 2] Starting provider node (Node B)...')
    nodeB = await createDC1Node({
      port: 9002,
      bootstrapList: [addrA],
      clientMode: false,
      localMode: true
    })
    const addrB = nodeAddr(nodeB)
    console.log(`✓ [Provider] Started`)
    console.log(`  Peer ID: ${nodeB.peerId.toString()}`)
    console.log(`  Address: ${addrB}`)

    // Step 3: Wait for bootstrap to propagate
    console.log('\n[Step 3] Waiting for peer connections and DHT bootstrap (3 sec)...')
    await sleep(3000)

    // Step 4: Provider publishes GPU spec to DHT
    console.log('\n[Step 4] Provider announcing GPU spec to DHT...')
    const gpuSpec = {
      gpu_model: 'RTX 4090',
      vram_gb: 24,
      price_sar_per_hour: 50,
      tier: 'A'
    }

    try {
      await announceProvider(nodeB, gpuSpec)
      console.log(`✓ Published to DHT: /dc1/provider/${nodeB.peerId.toString()}`)
      console.log(`  GPU: ${gpuSpec.gpu_model} / ${gpuSpec.vram_gb}GB VRAM / Tier ${gpuSpec.tier}`)
    } catch (err) {
      console.error(`⚠ Publish warning (expected in small networks): ${err.message}`)
    }

    // Step 5: Create renter node (Node C)
    console.log('\n[Step 5] Starting renter node (Node C)...')
    nodeC = await createDC1Node({
      port: 9003,
      bootstrapList: [addrA],
      clientMode: true,  // client mode: queries only
      localMode: true
    })
    const addrC = nodeAddr(nodeC)
    console.log(`✓ [Renter] Started`)
    console.log(`  Peer ID: ${nodeC.peerId.toString()}`)
    console.log(`  Address: ${addrC}`)

    // Step 6: Renter discovers provider via DHT
    console.log('\n[Step 6] Renter discovering provider on DHT (max 5 sec)...')
    const discoveryStartTime = Date.now()
    let discovered = false
    let discoveryLatency = null
    let providerSpec = null

    for (let i = 0; i < 50; i++) {
      try {
        const spec = await getProviderSpec(nodeC, nodeB.peerId.toString())
        if (spec) {
          discoveryLatency = Date.now() - discoveryStartTime
          providerSpec = spec
          console.log(`✓ DISCOVERED in ${discoveryLatency}ms`)
          console.log(`  GPU: ${spec.gpu_model} / ${spec.vram_gb}GB VRAM`)
          console.log(`  Provider: ${spec.peer_id}`)
          discovered = true
          break
        }
      } catch (e) {
        // Key not found yet, keep polling
        if (i % 10 === 0) {
          process.stdout.write('.')
        }
      }
      await sleep(100)
    }

    if (!discovered) {
      throw new Error('Provider discovery FAILED: timeout after 5 seconds')
    }

    // Final summary
    const totalTime = Date.now() - startTime
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('  ✅ TEST PASSED')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`  Discovery Latency:  ${discoveryLatency}ms`)
    console.log(`  Total Test Time:    ${totalTime}ms`)
    console.log(`  Bootstrap Nodes:    1 (Node A)`)
    console.log(`  Provider Nodes:     1 (Node B)`)
    console.log(`  Renter Nodes:       1 (Node C)`)
    console.log(`  DHT Protocol:       /dc1/kad/1.0.0`)
    console.log(``)
    console.log(`  ✓ P2P discovery functional`)
    console.log(`  ✓ DHT routing works across local network`)
    console.log(`  ✓ Ready for VPS bootstrap deployment (DCP-612)`)
    console.log('═══════════════════════════════════════════════════════════\n')

    process.exit(0)
  } catch (err) {
    console.error('\n❌ TEST FAILED')
    console.error(`Error: ${err.message}`)
    console.error(`Stack: ${err.stack}`)
    process.exit(1)
  } finally {
    // Cleanup
    if (nodeC) {
      try {
        await nodeC.stop()
      } catch (e) { /* ignore */ }
    }
    if (nodeB) {
      try {
        await nodeB.stop()
      } catch (e) { /* ignore */ }
    }
    if (nodeA) {
      try {
        await nodeA.stop()
      } catch (e) { /* ignore */ }
    }
  }
}

runTest()
