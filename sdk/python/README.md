# DC1 Python SDK

Official Python client for [DC1](https://dc1st.com) — Saudi Arabia's GPU compute marketplace.

## Installation

```bash
pip install dc1
```

No third-party dependencies. Requires Python 3.9+.

## Quickstart

```python
import dc1

client = dc1.DC1Client(api_key='rk_your_key_here')

# 1. Browse available GPUs
providers = client.providers.list()
for p in providers:
    print(f"{p.name}: {p.gpu_model} ({p.vram_gb} GB VRAM) — reliability {p.reliability_score}%")

# 2. Submit an LLM inference job
job = client.jobs.submit(
    'llm_inference',
    {'prompt': 'Explain quantum computing in one paragraph.', 'model': 'llama3'},
    provider_id=providers[0].id,
    duration_minutes=2,
)

# 3. Wait for the result (polls every 5s, times out after 300s)
result = client.jobs.wait(job.id)
print(result.result['output'])

# 4. Check your wallet
wallet = client.wallet.balance()
print(f'Balance: {wallet.balance_sar:.2f} SAR')
```

## Authentication

Get your API key from the [DC1 renter dashboard](https://dc1st.com/renter). Keys look like `dc1-renter-abc123...`.

```python
client = dc1.DC1Client(api_key='dc1-renter-abc123')
```

## Reference

### `DC1Client(api_key, base_url=None, timeout=30)`

| Parameter  | Type  | Default                     | Description                      |
|------------|-------|-----------------------------|----------------------------------|
| `api_key`  | `str` | required                    | Your renter API key              |
| `base_url` | `str` | `https://dcp.sa/api/dc1`    | Override to hit staging/local    |
| `timeout`  | `int` | `30`                        | HTTP timeout in seconds          |

---

### `client.jobs`

#### `jobs.submit(job_type, params, *, provider_id, duration_minutes, priority=2) → Job`

Submit a compute job.

| Parameter          | Type    | Description                                                    |
|--------------------|---------|----------------------------------------------------------------|
| `job_type`         | `str`   | `llm_inference`, `image_generation`, `vllm_serve`, `rendering`, `training`, `benchmark`, `custom_container` |
| `params`           | `dict`  | Job-type-specific parameters (see below)                       |
| `provider_id`      | `int`   | Provider to run on — get from `client.providers.list()`        |
| `duration_minutes` | `float` | Max runtime in minutes (billing capped at actual usage)        |
| `priority`         | `int`   | `1`=high, `2`=normal (default), `3`=low                        |

**`params` by job type:**

| `job_type`           | Required params                              | Optional params         |
|----------------------|----------------------------------------------|-------------------------|
| `llm_inference`      | `prompt` (str)                               | `model` (str, default `llama3`) |
| `image_generation`   | `prompt` (str)                               | `width`, `height`, `steps` |
| `vllm_serve`         | `model` (str, e.g. `mistralai/Mistral-7B-v0.1`) | `tensor_parallel_size` |
| `rendering`          | `scene_url` (str)                            | `frames`, `resolution`  |
| `benchmark`          | _(none required)_                            | —                       |

**Billing rates:**
- `llm_inference`: 15 halala/minute
- `image_generation`: 20 halala/minute
- `vllm_serve`: 20 halala/minute (~12 SAR/hr)

#### `jobs.get(job_id) → Job`

Fetch the current status and result of a job by ID.

#### `jobs.wait(job_id, *, timeout=300, poll_interval=5) → Job`

Block until the job reaches a terminal state (`completed`, `failed`, `cancelled`).

Raises `JobTimeoutError` if the job doesn't finish within `timeout` seconds.

#### `jobs.list(limit=20) → list[Job]`

List recent jobs for the authenticated renter.

---

### `client.providers`

#### `providers.list() → list[Provider]`

List all online GPU providers. No authentication required at the API level, but the SDK always sends your key.

#### `providers.get(provider_id) → Provider`

Fetch a single provider by ID.

---

### `client.wallet`

#### `wallet.balance() → Wallet`

Fetch the current wallet balance and account info.

---

### Models

#### `Job`

| Attribute             | Type            | Description                                    |
|-----------------------|-----------------|------------------------------------------------|
| `id`                  | `str`           | Unique job ID                                  |
| `status`              | `str`           | `queued`, `running`, `completed`, `failed`, `cancelled` |
| `job_type`            | `str`           | Job type string                                |
| `provider_id`         | `int`           | Provider that ran the job                      |
| `duration_minutes`    | `float`         | Requested max duration                         |
| `cost_halala`         | `int`           | Billed amount in halala                        |
| `cost_sar`            | `float`         | `cost_halala / 100`                            |
| `result`              | `dict \| None`  | Parsed output (`{'output': ...}` for text, `{'image_url': ...}` for images, `{'endpoint_url': ...}` for vllm_serve) |
| `result_type`         | `str \| None`   | `text`, `image`, or `endpoint`                 |
| `error`               | `str \| None`   | Error message if `status == 'failed'`          |
| `execution_time_sec`  | `float \| None` | Actual wall-clock time                         |
| `is_done`             | `bool`          | `True` when status is terminal                 |

#### `Provider`

| Attribute           | Type  | Description                          |
|---------------------|-------|--------------------------------------|
| `id`                | `int` | Numeric provider ID                  |
| `name`              | `str` | Provider display name                |
| `gpu_model`         | `str` | GPU model string (e.g. `RTX 4090`)   |
| `vram_mib`          | `int` | VRAM in MiB                          |
| `vram_gb`           | `float` | `vram_mib / 1024`                  |
| `status`            | `str` | `online` or `offline`               |
| `reliability_score` | `int` | 0–100 reliability percentage         |

#### `Wallet`

| Attribute         | Type  | Description              |
|-------------------|-------|--------------------------|
| `balance_halala`  | `int` | Balance in halala        |
| `balance_sar`     | `float` | `balance_halala / 100` |
| `name`            | `str` | Account name             |
| `email`           | `str` | Account email            |

---

### Exceptions

| Exception        | When raised                                                          |
|------------------|----------------------------------------------------------------------|
| `DC1Error`       | Base class for all SDK errors                                        |
| `AuthError`      | API key missing or invalid (HTTP 401)                               |
| `APIError`       | API returned an error. Has `.status_code` and `.response` attributes |
| `JobTimeoutError`| `jobs.wait()` exceeded the timeout. Has `.job_id` and `.timeout`   |

```python
from dc1 import DC1Client, JobTimeoutError, APIError

try:
    result = client.jobs.wait(job.id, timeout=60)
except JobTimeoutError as e:
    print(f'Job {e.job_id} is still running after {e.timeout}s')
except APIError as e:
    print(f'API error {e.status_code}: {e}')
```

## Examples

See [`examples/`](examples/) for runnable scripts:

- [`llm_inference.py`](examples/llm_inference.py) — run LLaMA3 inference
- [`image_gen.py`](examples/image_gen.py) — generate an image with Stable Diffusion
- [`vllm_endpoint.py`](examples/vllm_endpoint.py) — spin up an OpenAI-compatible vLLM endpoint

## License

MIT © DC1 / dhnpmp-tech
