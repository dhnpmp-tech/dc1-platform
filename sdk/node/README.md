# @dc1/client

Official Node.js/TypeScript SDK for [DC1](https://dc1st.com) — Saudi Arabia's GPU compute marketplace.

## Installation

```bash
npm install @dc1/client
```

No third-party runtime dependencies. Requires Node.js 18+.

## Quickstart

```typescript
import { DC1Client } from '@dc1/client';

const client = new DC1Client({ apiKey: 'rk_your_key_here' });

// 1. Browse available GPUs
const providers = await client.providers.list();
console.log(`${providers[0].gpuModel} — ${providers[0].vramGb} GB VRAM`);

// 2. Submit an LLM inference job
const job = await client.jobs.submit({
  jobType: 'llm_inference',
  params: { prompt: 'Explain transformers in one paragraph.', model: 'llama3' },
  providerId: providers[0].id,
  durationMinutes: 2,
});

// 3. Wait for result (async poll, 5-min default timeout)
const result = await client.jobs.wait(job.id);
console.log(result.result?.output);

// 4. Check wallet
const wallet = await client.wallet.balance();
console.log(`Balance: ${wallet.balanceSar.toFixed(2)} SAR`);
```

## Authentication

Get your API key from the [DC1 renter dashboard](https://dc1st.com/renter). Keys look like `dc1-renter-abc123...`.

```typescript
const client = new DC1Client({ apiKey: 'dc1-renter-abc123' });
```

## Reference

### `new DC1Client(config)`

| Field        | Type     | Default                    | Description                    |
|--------------|----------|----------------------------|--------------------------------|
| `apiKey`     | `string` | required                   | Your renter API key            |
| `baseUrl`    | `string` | `https://dcp.sa/api/dc1`   | Override for staging/local     |
| `timeoutMs`  | `number` | `30000`                    | HTTP timeout in milliseconds   |

---

### `client.jobs`

#### `jobs.submit(options) → Promise<Job>`

Submit a compute job.

```typescript
const job = await client.jobs.submit({
  jobType: 'llm_inference',           // required
  params: { prompt: '...', model: 'llama3' }, // required
  providerId: 26,                     // required — get from client.providers.list()
  durationMinutes: 2,                 // required
  priority: 2,                        // optional: 1=high, 2=normal, 3=low
});
```

**Job types and their `params`:**

| `jobType`            | Required params                                   | Optional params               |
|----------------------|---------------------------------------------------|-------------------------------|
| `llm_inference`      | `prompt: string`                                  | `model: string` (default `llama3`) |
| `image_generation`   | `prompt: string`                                  | `width`, `height`, `steps`    |
| `vllm_serve`         | `model: string` (e.g. `mistralai/Mistral-7B-v0.1`) | `tensor_parallel_size`      |
| `rendering`          | `scene_url: string`                               | `frames`, `resolution`        |
| `benchmark`          | _(none required)_                                 | —                             |

**Billing rates:**
- `llm_inference`: 15 halala/min
- `image_generation`: 20 halala/min
- `vllm_serve`: 20 halala/min (~12 SAR/hr)

#### `jobs.get(jobId) → Promise<Job>`

Fetch current status and result.

#### `jobs.wait(jobId, options?) → Promise<Job>`

Poll until job reaches a terminal state.

```typescript
const result = await client.jobs.wait(job.id, {
  timeoutMs: 300_000,    // default 5 minutes
  pollIntervalMs: 5_000, // default 5 seconds
});
```

Throws `JobTimeoutError` if the job doesn't finish in time.

#### `jobs.list(limit?) → Promise<Job[]>`

List recent jobs (default `limit=20`).

---

### `client.providers`

#### `providers.list() → Promise<Provider[]>`

List all online GPU providers.

#### `providers.get(providerId) → Promise<Provider>`

Fetch a single provider by ID.

---

### `client.wallet`

#### `wallet.balance() → Promise<Wallet>`

Fetch current balance and account info.

---

### Types

#### `Job`

| Field               | Type                          | Description                                           |
|---------------------|-------------------------------|-------------------------------------------------------|
| `id`                | `string`                      | Unique job ID                                         |
| `status`            | `JobStatus`                   | `queued \| running \| completed \| failed \| cancelled` |
| `jobType`           | `JobType`                     | Job type string                                       |
| `providerId`        | `number`                      | Provider that ran the job                             |
| `durationMinutes`   | `number`                      | Requested max duration                                |
| `costHalala`        | `number`                      | Billed in halala                                      |
| `costSar`           | `number`                      | `costHalala / 100`                                    |
| `result`            | `Record<string,unknown> \| null` | Parsed output                                      |
| `resultType`        | `'text' \| 'image' \| 'endpoint' \| null` | Output type                            |
| `error`             | `string \| null`              | Error if `status === 'failed'`                        |
| `isDone`            | `boolean`                     | `true` when status is terminal                        |
| `executionTimeSec`  | `number \| null`              | Actual wall-clock time                                |

#### `Provider`

| Field              | Type     | Description                     |
|--------------------|----------|---------------------------------|
| `id`               | `number` | Numeric provider ID             |
| `name`             | `string` | Display name                    |
| `gpuModel`         | `string` | GPU model (e.g. `RTX 4090`)     |
| `vramMib`          | `number` | VRAM in MiB                     |
| `vramGb`           | `number` | `vramMib / 1024`                |
| `status`           | `string` | `online \| offline \| paused`   |
| `reliabilityScore` | `number` | 0–100 reliability percentage    |

#### `Wallet`

| Field           | Type     | Description          |
|-----------------|----------|----------------------|
| `balanceHalala` | `number` | Balance in halala    |
| `balanceSar`    | `number` | `balanceHalala / 100`|
| `name`          | `string` | Account name         |
| `email`         | `string` | Account email        |

---

### Errors

```typescript
import { DC1Client, JobTimeoutError, APIError, AuthError } from '@dc1/client';

try {
  const result = await client.jobs.wait(job.id, { timeoutMs: 60_000 });
} catch (e) {
  if (e instanceof JobTimeoutError) {
    console.log(`Still running after ${e.timeoutMs}ms: ${e.jobId}`);
  } else if (e instanceof AuthError) {
    console.log('Invalid API key');
  } else if (e instanceof APIError) {
    console.log(`API error ${e.statusCode}:`, e.message);
  }
}
```

| Error            | When thrown                                               |
|------------------|-----------------------------------------------------------|
| `DC1Error`       | Base class                                                |
| `AuthError`      | 401 — API key invalid or missing                         |
| `APIError`       | Non-2xx response. Has `.statusCode` and `.response`       |
| `JobTimeoutError`| `jobs.wait()` exceeded `timeoutMs`. Has `.jobId`          |

## License

MIT © DC1 / dhnpmp-tech
