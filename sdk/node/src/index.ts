/**
 * @dc1/client — Official Node.js SDK for the DC1 GPU compute marketplace.
 *
 * @example
 * ```typescript
 * import { DC1Client } from '@dc1/client';
 * const client = new DC1Client({ apiKey: 'rk_...' });
 * const job = await client.jobs.submit({ jobType: 'llm_inference', params: { prompt: 'Hello!' }, providerId: 1, durationMinutes: 1 });
 * const result = await client.jobs.wait(job.id);
 * ```
 */

export { DC1Client } from './client';
export { DC1Error, AuthError, APIError, JobTimeoutError } from './errors';
export type {
  Job,
  Provider,
  Wallet,
  SubmitJobParams,
  WaitOptions,
  DC1ClientConfig,
  JobType,
  JobStatus,
  JobPriority,
  ProviderStatus,
} from './types';
