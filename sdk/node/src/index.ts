/**
 * dc1-renter-sdk — Official TypeScript/JavaScript SDK for DC1 GPU compute marketplace renters.
 *
 * @example
 * ```typescript
 * import { DC1RenterClient } from 'dc1-renter-sdk';
 *
 * const client = new DC1RenterClient({ apiKey: 'dc1-renter-abc123' });
 * const providers = await client.listProviders();
 * const job = await client.submitJob({
 *   providerId: providers[0].id,
 *   jobType: 'llm_inference',
 *   params: { prompt: 'Hello, DC1!' },
 *   durationMinutes: 2,
 * });
 * const result = await client.waitForJob(job.id);
 * console.log(result.result?.output);
 * ```
 */

export { DC1RenterClient } from './DC1RenterClient';
export type { SubmitJobOptions, ListProvidersFilters } from './DC1RenterClient';

// Legacy resource-based client (still exported for compatibility)
export { DC1Client } from './client';

export { DC1Error, AuthError, APIError, JobTimeoutError } from './errors';
export type {
  Job,
  Provider,
  Wallet,
  Balance,
  RegisterResult,
  PaymentHistory,
  PaymentHistoryItem,
  JobLog,
  SubmitJobParams,
  WaitOptions,
  DC1ClientConfig,
  JobType,
  JobStatus,
  JobPriority,
  ProviderStatus,
} from './types';
