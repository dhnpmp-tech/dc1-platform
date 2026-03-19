/**
 * DC1 Renter SDK — Submit an LLM inference job
 *
 * Run with:
 *   npx ts-node examples/submit-job.ts
 *
 * Prerequisites:
 *   npm install dc1-renter-sdk ts-node typescript
 */

import { DC1RenterClient, JobTimeoutError, APIError } from '../src';

const API_KEY = process.env.DC1_API_KEY ?? 'dc1-renter-your-key-here';

async function main() {
  const client = new DC1RenterClient({ apiKey: API_KEY });

  // 1. Check wallet balance
  const balance = await client.getBalance();
  console.log(`Balance: ${balance.balanceSar.toFixed(2)} SAR (${balance.balanceHalala} halala)`);

  if (balance.balanceHalala < 30) {
    console.error('Insufficient balance. Top up at https://dcp.sa/renter');
    process.exit(1);
  }

  // 2. Find an online provider with at least 8 GB VRAM
  const providers = await client.listProviders({ minVramGb: 8 });
  if (providers.length === 0) {
    console.error('No providers online with ≥ 8 GB VRAM. Try again later.');
    process.exit(1);
  }

  const provider = providers[0];
  console.log(`Using provider: ${provider.name} (${provider.gpuModel}, ${provider.vramGb} GB VRAM)`);

  // 3. Submit an LLM inference job
  const job = await client.submitJob({
    providerId: provider.id,
    jobType: 'llm_inference',
    params: {
      prompt: 'Explain transformer attention in two sentences.',
      model: 'microsoft/phi-2',
    },
    durationMinutes: 2,
    priority: 2, // normal priority
  });

  console.log(`Job submitted: ${job.id} (status: ${job.status})`);
  console.log(`Estimated cost: ${(job.costHalala / 100).toFixed(2)} SAR`);

  // 4. Wait for result, logging progress
  console.log('Waiting for result...');
  try {
    const result = await client.waitForJob(job.id, {
      timeout: 300_000,    // 5 minutes max
      pollInterval: 3_000, // check every 3 seconds
      onProgress: (status) => process.stdout.write(`  status: ${status}\r`),
    });

    console.log(`\nCompleted in ${result.executionTimeSec?.toFixed(1) ?? '?'}s`);
    console.log('Output:', result.result?.output ?? result.result);
  } catch (e) {
    if (e instanceof JobTimeoutError) {
      console.error(`\nTimeout: job ${e.jobId} did not complete within ${e.timeoutMs / 1000}s`);
      // Optionally cancel to reclaim balance
      await client.cancelJob(job.id);
      console.log('Job cancelled, balance refunded.');
    } else if (e instanceof APIError) {
      console.error(`\nAPI error ${e.statusCode}:`, e.message);
    } else {
      throw e;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
