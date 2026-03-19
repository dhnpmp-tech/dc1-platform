/**
 * DC1 Renter SDK — Browse available GPU providers
 *
 * Run with:
 *   npx ts-node examples/list-providers.ts
 *
 * No API key required — provider listing is public.
 */

import { DC1RenterClient } from '../src';

async function main() {
  // Provider listing is public — any key works (or pass a placeholder)
  const client = new DC1RenterClient({
    apiKey: process.env.DC1_API_KEY ?? 'dc1-renter-placeholder',
  });

  console.log('Fetching available GPU providers...\n');
  const providers = await client.listProviders();

  if (providers.length === 0) {
    console.log('No providers currently online.');
    return;
  }

  // Print a table
  console.log(`${'Name'.padEnd(20)} ${'GPU'.padEnd(24)} ${'VRAM'.padEnd(10)} ${'Score'.padEnd(8)} Status`);
  console.log('-'.repeat(75));

  for (const p of providers) {
    const vram = p.vramGb > 0 ? `${p.vramGb} GB` : `${p.vramMib} MiB`;
    console.log(
      `${p.name.padEnd(20)} ${p.gpuModel.padEnd(24)} ${vram.padEnd(10)} ${String(p.reliabilityScore).padEnd(8)} ${p.status}`,
    );
  }

  console.log(`\n${providers.length} provider(s) online`);

  // Filter example: providers with ≥ 24 GB VRAM (good for 7B+ models)
  const highVram = await client.listProviders({ minVramGb: 24 });
  console.log(`\nProviders with ≥ 24 GB VRAM (suitable for 7B+ LLMs): ${highVram.length}`);
  for (const p of highVram) {
    console.log(`  - ${p.name}: ${p.gpuModel} (${p.vramGb} GB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
