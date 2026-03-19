import { HttpClient } from './http';
import { JobsResource } from './resources/jobs';
import { ProvidersResource } from './resources/providers';
import { WalletResource } from './resources/wallet';
import { DC1ClientConfig } from './types';

const DEFAULT_BASE_URL = 'https://api.dcp.sa';

/**
 * Official DC1 client for Node.js/TypeScript.
 *
 * @example
 * ```typescript
 * import { DC1Client } from '@dc1/client';
 *
 * const client = new DC1Client({ apiKey: 'rk_your_key_here' });
 *
 * // Browse providers
 * const providers = await client.providers.list();
 * console.log(providers[0].gpuModel, providers[0].vramGb, 'GB');
 *
 * // Submit an LLM inference job
 * const job = await client.jobs.submit({
 *   jobType: 'llm_inference',
 *   params: { prompt: 'Hello, DC1!', model: 'llama3' },
 *   providerId: providers[0].id,
 *   durationMinutes: 2,
 * });
 *
 * // Wait for result
 * const result = await client.jobs.wait(job.id);
 * console.log(result.result?.output);
 *
 * // Check balance
 * const wallet = await client.wallet.balance();
 * console.log(`Balance: ${wallet.balanceSar.toFixed(2)} SAR`);
 * ```
 */
export class DC1Client {
  readonly jobs: JobsResource;
  readonly providers: ProvidersResource;
  readonly wallet: WalletResource;

  constructor(config: DC1ClientConfig) {
    if (!config.apiKey) throw new Error('apiKey is required');
    const http = new HttpClient(
      config.apiKey,
      config.baseUrl ?? DEFAULT_BASE_URL,
      config.timeoutMs ?? 30_000,
    );
    this.jobs = new JobsResource(http);
    this.providers = new ProvidersResource(http);
    this.wallet = new WalletResource(http);
  }
}
