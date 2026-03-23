# SDK Examples

Code examples for submitting jobs to DCP in your language of choice.

**Supported languages:** JavaScript/Node.js, Python, cURL, Go, Rust (coming soon)

---

## JavaScript / Node.js

### Installation

```bash
npm install dcp-sdk
```

Or use fetch API directly (no SDK needed).

### Basic Setup

```javascript
const DCPClient = require('dcp-sdk');

const client = new DCPClient({
  baseURL: 'https://api.dcp.sa',
  apiKey: 'dcp-renter-a1b2c3d4e5f6...'
});
```

### Submit an LLM Inference Job

```javascript
async function runInference() {
  const job = await client.jobs.submit({
    provider_id: 3,
    job_type: 'llm_inference',
    duration_minutes: 5,
    params: {
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      prompt: 'Explain blockchain in one sentence',
      max_tokens: 100,
      temperature: 0.7
    },
    gpu_requirements: {
      min_vram_gb: 16
    }
  });

  console.log(`Job submitted: ${job.job_id}`);
  console.log(`Estimated cost: ${job.estimated_cost_sar} SAR`);
}

runInference().catch(console.error);
```

### Poll for Job Results

```javascript
async function waitForJobCompletion(jobId, maxWaitMs = 300000) {
  const startTime = Date.now();
  const pollIntervalMs = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    const status = await client.jobs.getStatus(jobId);

    console.log(`Job ${jobId} status: ${status.status}`);

    if (status.status === 'completed') {
      const output = await client.jobs.getOutput(jobId);
      return output;
    }

    if (status.status === 'failed') {
      throw new Error(`Job failed: ${status.error_message}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Job timeout');
}

const result = await waitForJobCompletion('job-1710843200000-x7k2p');
console.log('Result:', result);
```

### Image Generation Job

```javascript
async function generateImage() {
  const job = await client.jobs.submit({
    provider_id: 5,
    job_type: 'image_generation',
    duration_minutes: 3,
    params: {
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      prompt: 'A futuristic city with flying cars',
      steps: 20,
      width: 1024,
      height: 768
    }
  });

  // Wait for completion
  let status;
  while (true) {
    status = await client.jobs.getStatus(job.job_id);
    if (status.status === 'completed') break;
    await new Promise(r => setTimeout(r, 2000));
  }

  // Get image
  const imageBuffer = await client.jobs.getOutput(job.job_id);
  fs.writeFileSync('output.png', imageBuffer);
}
```

### Get Provider Marketplace

```javascript
async function listProviders() {
  const { providers } = await client.providers.marketplace();

  const liveProviders = providers.filter(p => p.is_live);

  console.table(liveProviders.map(p => ({
    name: p.name,
    gpu: p.gpu_model,
    vram: p.vram_gb,
    reliability: p.reliability_score,
    cached_models: p.cached_models.join(', ')
  })));
}

listProviders();
```

### Check Account Balance

```javascript
async function checkBalance() {
  const balance = await client.renters.getBalance();

  console.log(`Available: ${balance.available_sar} SAR`);
  console.log(`Total spent: ${balance.total_spent_sar} SAR`);
  console.log(`Jobs completed: ${balance.total_jobs}`);
}

checkBalance();
```

### Using Fetch API (No SDK)

```javascript
async function submitJobWithFetch() {
  const response = await fetch('https://api.dcp.sa/api/jobs/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-renter-key': 'dcp-renter-a1b2c3d4e5f6...'
    },
    body: JSON.stringify({
      provider_id: 3,
      job_type: 'llm_inference',
      duration_minutes: 5,
      params: {
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        prompt: 'What is DCP?',
        max_tokens: 100,
        temperature: 0.7
      }
    })
  });

  const job = await response.json();
  console.log(`Job ${job.job_id} submitted`);
  return job;
}
```

---

## Python

### Installation

```bash
pip install dcp-sdk
# or
pip install requests  # For manual requests
```

### Basic Setup

```python
from dcp import DCPClient

client = DCPClient(
    base_url='https://api.dcp.sa',
    api_key='dcp-renter-a1b2c3d4e5f6...'
)
```

### Submit an LLM Inference Job

```python
def run_inference():
    job = client.jobs.submit(
        provider_id=3,
        job_type='llm_inference',
        duration_minutes=5,
        params={
            'model': 'mistralai/Mistral-7B-Instruct-v0.2',
            'prompt': 'Write a haiku about artificial intelligence',
            'max_tokens': 100,
            'temperature': 0.7
        },
        gpu_requirements={
            'min_vram_gb': 16
        }
    )

    print(f"Job submitted: {job['job_id']}")
    print(f"Estimated cost: {job['estimated_cost_sar']} SAR")
    return job['job_id']

job_id = run_inference()
```

### Wait for Results

```python
import time

def wait_for_completion(job_id, max_wait_seconds=300):
    start_time = time.time()
    poll_interval = 5  # seconds

    while time.time() - start_time < max_wait_seconds:
        status = client.jobs.get_status(job_id)
        print(f"Job {job_id} status: {status['status']}")

        if status['status'] == 'completed':
            output = client.jobs.get_output(job_id)
            return output['result']

        if status['status'] == 'failed':
            raise Exception(f"Job failed: {status.get('error_message')}")

        time.sleep(poll_interval)

    raise TimeoutError('Job took too long')

result = wait_for_completion('job-1710843200000-x7k2p')
print("Result:", result)
```

### Image Generation

```python
from PIL import Image
from io import BytesIO

def generate_image():
    job = client.jobs.submit(
        provider_id=5,
        job_type='image_generation',
        duration_minutes=3,
        params={
            'model': 'stabilityai/stable-diffusion-xl-base-1.0',
            'prompt': 'A stunning Saudi Arabian desert landscape',
            'steps': 20,
            'width': 1024,
            'height': 768
        }
    )

    # Wait for completion
    status = None
    while True:
        status = client.jobs.get_status(job['job_id'])
        if status['status'] == 'completed':
            break
        time.sleep(2)

    # Get and save image
    image_data = client.jobs.get_output(job['job_id'])
    image = Image.open(BytesIO(image_data))
    image.save('generated_image.png')
    print("Image saved to generated_image.png")

generate_image()
```

### Get Available Providers

```python
def list_providers():
    data = client.providers.marketplace()

    live_providers = [p for p in data['providers'] if p['is_live']]

    for p in live_providers:
        print(f"{p['name']}")
        print(f"  GPU: {p['gpu_model']} ({p['vram_gb']}GB)")
        print(f"  Reliability: {p['reliability_score']}%")
        print(f"  Cached models: {', '.join(p['cached_models'])}")
        print()

list_providers()
```

### Check Balance

```python
def check_balance():
    balance = client.renters.get_balance()

    print(f"Available: {balance['available_sar']} SAR")
    print(f"Held: {balance['held_sar']} SAR")
    print(f"Total spent: {balance['total_spent_sar']} SAR")
    print(f"Jobs: {balance['total_jobs']}")

check_balance()
```

### Using Requests (No SDK)

```python
import requests
import json

def submit_job_with_requests():
    headers = {
        'Content-Type': 'application/json',
        'x-renter-key': 'dcp-renter-a1b2c3d4e5f6...'
    }

    payload = {
        'provider_id': 3,
        'job_type': 'llm_inference',
        'duration_minutes': 5,
        'params': {
            'model': 'mistralai/Mistral-7B-Instruct-v0.2',
            'prompt': 'Summarize quantum mechanics',
            'max_tokens': 150,
            'temperature': 0.7
        }
    }

    response = requests.post(
        'https://api.dcp.sa/api/jobs/submit',
        headers=headers,
        json=payload
    )

    job = response.json()
    print(f"Job {job['job_id']} submitted")
    return job['job_id']

submit_job_with_requests()
```

---

## cURL (Command Line)

### Register a Renter Account

```bash
curl -X POST https://api.dcp.sa/api/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "you@example.com",
    "organization": "Your Company"
  }'
```

### Top Up Balance

```bash
curl -X POST https://api.dcp.sa/api/renters/topup \
  -H "Content-Type: application/json" \
  -H "x-renter-key: dcp-renter-a1b2c3d4e5f6..." \
  -d '{
    "amount_sar": 100
  }'
```

### List Available Providers

```bash
curl https://api.dcp.sa/api/renters/available-providers | jq '.providers'
```

### Submit a Job

```bash
curl -X POST https://api.dcp.sa/api/jobs/submit \
  -H "Content-Type: application/json" \
  -H "x-renter-key: dcp-renter-a1b2c3d4e5f6..." \
  -d '{
    "provider_id": 3,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "params": {
      "model": "mistralai/Mistral-7B-Instruct-v0.2",
      "prompt": "What is the meaning of life?",
      "max_tokens": 100,
      "temperature": 0.7
    }
  }'
```

### Check Job Status

```bash
JOB_ID="job-1710843200000-x7k2p"

curl https://api.dcp.sa/api/jobs/$JOB_ID/status \
  -H "x-renter-key: dcp-renter-a1b2c3d4e5f6..."
```

### Get Job Output

```bash
curl https://api.dcp.sa/api/jobs/job-1710843200000-x7k2p/output \
  -H "x-renter-key: dcp-renter-a1b2c3d4e5f6..." \
  -o result.txt
```

### Check Balance

```bash
curl https://api.dcp.sa/api/renters/balance \
  -H "x-renter-key: dcp-renter-a1b2c3d4e5f6..." | jq
```

### Provider Endpoints

#### Register a Provider

```bash
curl -X POST https://api.dcp.sa/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My GPU Node",
    "location": "SA",
    "contact_email": "ops@example.com"
  }'
```

#### Provider Heartbeat

```bash
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -H "x-provider-key: dcp-provider-a1b2c3d4e5f6..." \
  -d '{
    "status": "online",
    "gpu_utilization": 45,
    "temperature": 65
  }'
```

#### Check Provider Earnings

```bash
curl https://api.dcp.sa/api/providers/earnings \
  -H "x-provider-key: dcp-provider-a1b2c3d4e5f6..."
```

---

## Common Patterns

### Error Handling (JavaScript)

```javascript
async function submitJobWithErrorHandling() {
  try {
    const job = await client.jobs.submit({
      provider_id: 3,
      job_type: 'llm_inference',
      duration_minutes: 5,
      params: {
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        prompt: 'Hello',
        max_tokens: 100,
        temperature: 0.7
      }
    });
    return job.job_id;
  } catch (error) {
    if (error.statusCode === 400) {
      console.error('Bad request:', error.details);
    } else if (error.statusCode === 401) {
      console.error('Unauthorized: Check your API key');
    } else if (error.statusCode === 429) {
      console.error('Rate limited: Wait before retrying');
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
```

### Error Handling (Python)

```python
from dcp import DCPClient, DCPException

try:
    job = client.jobs.submit(...)
except DCPException as e:
    if e.status_code == 400:
        print("Bad request:", e.details)
    elif e.status_code == 401:
        print("Unauthorized: Check API key")
    elif e.status_code == 429:
        print("Rate limited: Retry after delay")
    else:
        print("Error:", e)
```

### Batch Job Submission (JavaScript)

```javascript
async function submitBatchJobs(prompts) {
  const jobs = [];

  for (const prompt of prompts) {
    const job = await client.jobs.submit({
      provider_id: 3,
      job_type: 'llm_inference',
      duration_minutes: 3,
      params: {
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        prompt: prompt,
        max_tokens: 100,
        temperature: 0.7
      }
    });
    jobs.push(job.job_id);

    // Rate limit: 10 jobs per minute
    await new Promise(r => setTimeout(r, 6000));
  }

  return jobs;
}

const prompts = [
  'What is AI?',
  'Explain quantum computing',
  'Summarize relativity'
];

const jobIds = await submitBatchJobs(prompts);
console.log(`Submitted ${jobIds.length} jobs`);
```

### Retry Logic (Python)

```python
import time
from dcp import DCPClient

def submit_with_retry(job_config, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.jobs.submit(**job_config)
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Attempt {attempt + 1} failed. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise

job = submit_with_retry({
    'provider_id': 3,
    'job_type': 'llm_inference',
    'duration_minutes': 5,
    'params': {...}
})
```

---

## SDK Resources

- **JavaScript SDK**: [npm/dcp-sdk](https://www.npmjs.com/package/dcp-sdk)
- **Python SDK**: [PyPI/dcp-sdk](https://pypi.org/project/dcp-sdk/)
- **Go SDK** (beta): [github.com/dcp-ai/sdk-go](https://github.com/dcp-ai/sdk-go)
- **Rust SDK** (beta): [crates.io/dcp-sdk](https://crates.io/crates/dcp-sdk)

---

**Next:** [API Reference](./openapi.yaml) | [Quickstarts](./quickstart-renter.md)
