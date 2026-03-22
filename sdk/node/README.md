# dc1-renter-sdk

Official TypeScript/JavaScript SDK for GPU renters on [DC1](https://dcp.sa) — Saudi Arabia's decentralized compute marketplace.

## Installation

```bash
npm install dc1-renter-sdk
```

No third-party runtime dependencies. Requires Node.js 18+.

## Quickstart — 5 lines to your first LLM job

```typescript
import { DC1RenterClient } from 'dc1-renter-sdk';

const client = new DC1RenterClient({ apiKey: 'dc1-renter-abc123' });
const providers = await client.listProviders();
const job = await client.submitJob({
  providerId: providers[0].id,
  jobType: 'llm_inference',
  params: { prompt: 'Explain transformer attention in two sentences.' },
  durationMinutes: 2,
});
const result = await client.waitForJob(job.id);
console.log(result.result?.output);
```

## Authentication

Get your API key from the [DC1 renter dashboard](https://dcp.sa/renter). Keys look like `dc1-renter-<hex>`.

```typescript
const client = new DC1RenterClient({ apiKey: 'dc1-renter-abc123' });
```

New accounts can be created programmatically:

```typescript
const { apiKey } = await client.register('Ahmed Al-Rashid', 'ahmed@example.com');
// Save apiKey — it won't be shown again
```

## API Reference

### `new DC1RenterClient(config)`

| Field       | Type     | Default                | Description                   |
|-------------|----------|------------------------|-------------------------------|
| `apiKey`    | `string` | required               | Your renter API key           |
| `baseUrl`   | `string` | `https://api.dcp.sa`   | Override for staging/local    |
| `timeoutMs` | `number` | `30000`                | HTTP timeout in milliseconds  |

---

### Auth

#### `client.me() → Promise<Wallet>`

Fetch your profile and current balance.

#### `client.register(name, email, organization?) → Promise<RegisterResult>`

Register a new renter account.

```typescript
const { apiKey, renterId } = await client.register('Ahmed', 'ahmed@acme.com', 'Acme Corp');
```

---

### Providers

#### `client.listProviders(filters?) → Promise<Provider[]>`

List all online GPU providers.

```typescript
// All providers
const all = await client.listProviders();

// Filter: only providers with ≥ 24 GB VRAM
const highVram = await client.listProviders({ minVramGb: 24 });

// Filter: RTX 4090s only
const rtx4090s = await client.listProviders({ gpuModel: '4090' });
```

| Filter field | Type     | Description                          |
|--------------|----------|--------------------------------------|
| `minVramGb`  | `number` | Minimum VRAM in GB                   |
| `gpuModel`   | `string` | GPU model substring (case-insensitive) |

---

### Jobs

#### `client.submitJob(options) → Promise<Job>`

Submit a compute job.

```typescript
const job = await client.submitJob({
  providerId: 26,                    // from listProviders()
  jobType: 'llm_inference',         // see job types below
  params: { prompt: 'Hello, DC1!', model: 'microsoft/phi-2' },
  durationMinutes: 2,
  priority: 2,                       // 1=high, 2=normal, 3=low
});
```

**Job types and params:**

| `jobType`          | Required params          | Optional params                           | Billing       |
|--------------------|--------------------------|-------------------------------------------|---------------|
| `llm_inference`    | `prompt: string`         | `model: string`                           | 15 h/min      |
| `image_generation` | `prompt: string`         | `width`, `height`, `steps`, `model`       | 20 h/min      |
| `vllm_serve`       | `model: string`          | `max_model_len`, `dtype`                  | 20 h/min      |
| `rendering`        | `scene_url: string`      | —                                         | 20 h/min      |
| `training`         | _(custom)_               | —                                         | 25 h/min      |
| `benchmark`        | _(none)_                 | —                                         | 10 h/min      |

> **Billing note:** 1 SAR = 100 halala. A 2-minute `llm_inference` job costs 30 halala (0.30 SAR).

Throws `APIError` with status `402` if balance is insufficient — call `getBalance()` and top up in the dashboard first.

#### `client.getJob(jobId) → Promise<Job>`

Fetch current status and result.

#### `client.waitForJob(jobId, options?) → Promise<Job>`

Poll until the job reaches a terminal state.

```typescript
const result = await client.waitForJob(job.id, {
  timeout: 300_000,     // 5 min (default)
  pollInterval: 3_000,  // 3s between polls (default)
  onProgress: (status) => console.log('Status:', status),
});

// result.result?.output — text output
// result.result?.image_url — for image_generation jobs
// result.result?.endpoint_url — for vllm_serve jobs
```

Throws `JobTimeoutError` if the job doesn't finish in time.

#### `client.getJobLogs(jobId, since?) → Promise<JobLog[]>`

Fetch execution log lines written by the daemon during job execution.

```typescript
const logs = await client.getJobLogs(job.id);
// Incremental tail — only lines after line 50:
const newLines = await client.getJobLogs(job.id, 50);
```

#### `client.cancelJob(jobId) → Promise<{ success, jobId }>`

Cancel a queued or running job. The estimated cost is refunded to your balance.

---

### Billing

#### `client.getBalance() → Promise<Balance>`

Fetch detailed wallet balance.

```typescript
const balance = await client.getBalance();
console.log(`Available: ${balance.balanceSar.toFixed(2)} SAR`);
console.log(`Held for active jobs: ${balance.heldSar.toFixed(2)} SAR`);
```

#### `client.getPaymentHistory(limit?) → Promise<PaymentHistory>`

Fetch job billing history (default `limit=20`).

```typescript
const history = await client.getPaymentHistory(50);
for (const item of history.jobs) {
  console.log(`${item.jobType} — ${item.costSar} SAR — ${item.status}`);
}
```

---

## Types

### `Job`

| Field             | Type                                   | Description                             |
|-------------------|----------------------------------------|-----------------------------------------|
| `id`              | `string`                               | Job ID (e.g. `job-1234-abcdef`)         |
| `status`          | `'queued' \| 'running' \| 'completed' \| 'failed' \| 'cancelled'` | Current state |
| `jobType`         | `JobType`                              | Job type string                         |
| `providerId`      | `number`                               | Provider that ran the job               |
| `durationMinutes` | `number`                               | Requested max duration                  |
| `costHalala`      | `number`                               | Billed amount in halala                 |
| `costSar`         | `number`                               | `costHalala / 100`                      |
| `isDone`          | `boolean`                              | `true` when status is terminal          |
| `result`          | `Record<string,unknown> \| null`       | Parsed output                           |
| `resultType`      | `'text' \| 'image' \| 'endpoint' \| null` | Output type                         |
| `error`           | `string \| null`                       | Error message if `status === 'failed'`  |
| `executionTimeSec`| `number \| null`                       | Actual wall-clock execution time        |

### `Provider`

| Field              | Type     | Description                     |
|--------------------|----------|---------------------------------|
| `id`               | `number` | Numeric provider ID             |
| `name`             | `string` | Display name                    |
| `gpuModel`         | `string` | GPU model (e.g. `RTX 4090`)     |
| `vramMib`          | `number` | VRAM in MiB                     |
| `vramGb`           | `number` | VRAM in GB (rounded to 1 dp)    |
| `status`           | `string` | `online \| offline \| paused`   |
| `reliabilityScore` | `number` | 0–100 reliability score         |

### `Balance`

| Field               | Type     | Description                     |
|---------------------|----------|---------------------------------|
| `balanceHalala`     | `number` | Total balance in halala         |
| `balanceSar`        | `number` | Total balance in SAR            |
| `heldHalala`        | `number` | Funds held for active jobs      |
| `availableHalala`   | `number` | Immediately spendable           |
| `totalSpentHalala`  | `number` | Lifetime spend                  |

### `JobLog`

| Field      | Type                                | Description            |
|------------|-------------------------------------|------------------------|
| `lineNo`   | `number`                            | Sequential line number |
| `level`    | `'info' \| 'warn' \| 'error' \| 'debug'` | Log level        |
| `message`  | `string`                            | Log message            |
| `loggedAt` | `string`                            | ISO timestamp          |

---

## Error handling

```typescript
import { DC1RenterClient, JobTimeoutError, APIError, AuthError } from 'dc1-renter-sdk';

try {
  const result = await client.waitForJob(job.id, { timeout: 60_000 });
} catch (e) {
  if (e instanceof JobTimeoutError) {
    console.log(`Still running after ${e.timeoutMs / 1000}s — cancelling...`);
    await client.cancelJob(e.jobId);
  } else if (e instanceof AuthError) {
    console.log('Invalid API key — check https://dcp.sa/renter');
  } else if (e instanceof APIError) {
    console.log(`API error ${e.statusCode}:`, e.message, e.response);
  }
}
```

| Error            | When thrown                                                |
|------------------|------------------------------------------------------------|
| `AuthError`      | 401 — API key invalid or missing                          |
| `APIError`       | Non-2xx response. Has `.statusCode` and `.response`        |
| `JobTimeoutError`| `waitForJob()` exceeded `timeout`. Has `.jobId`            |

---

## Examples

See the [`examples/`](./examples) directory:

- [`submit-job.ts`](./examples/submit-job.ts) — full LLM job lifecycle with error handling
- [`list-providers.ts`](./examples/list-providers.ts) — browse and filter GPU providers

```bash
npx ts-node examples/list-providers.ts
DC1_API_KEY=dc1-renter-abc123 npx ts-node examples/submit-job.ts
```

## License

MIT © DC1 / dhnpmp-tech
