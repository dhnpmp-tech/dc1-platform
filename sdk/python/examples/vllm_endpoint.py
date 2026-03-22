"""
Example: vLLM Serve — OpenAI-Compatible Endpoint

Starts a vLLM serving endpoint on a DC1 GPU, then calls it like any OpenAI-compatible API.
The endpoint supports the /v1/chat/completions interface.

Usage:
    DC1_API_KEY=rk_... python vllm_endpoint.py

Requirements:
    pip install openai  # optional — the example also shows raw HTTP usage
"""
import os
import sys
import json
import urllib.request
import dc1
from dc1 import JobTimeoutError, APIError

API_KEY = os.environ.get('DC1_API_KEY')
if not API_KEY:
    print('Set DC1_API_KEY environment variable to your renter API key')
    sys.exit(1)

client = dc1.DC1Client(api_key=API_KEY)

# Step 1: Pick a provider with enough VRAM (≥16 GB for 7B models)
print('Fetching available providers...')
providers = [p for p in client.providers.list() if p.vram_gb >= 16]
if not providers:
    print('No providers with ≥16 GB VRAM online. A 7B model needs at least 14 GB.')
    sys.exit(1)

provider = providers[0]
print(f'Using provider: {provider.name} ({provider.gpu_model}, {provider.vram_gb} GB VRAM)')

# Step 2: Start a vLLM serving job (runs until duration_minutes expires)
MODEL = 'mistralai/Mistral-7B-Instruct-v0.2'
DURATION_HOURS = 1  # keep alive for 1 hour

print(f'\nStarting vLLM endpoint for {MODEL}...')
print(f'Duration: {DURATION_HOURS}h (billed at actual usage)')

job = client.jobs.submit(
    'vllm_serve',
    {'model': MODEL},
    provider_id=provider.id,
    duration_minutes=DURATION_HOURS * 60,
    priority=1,  # high priority for serving workloads
)
print(f'Job submitted: {job.id}')

# Step 3: Wait for the endpoint to become ready (typically 2–5 min for model download)
print('\nWaiting for endpoint to be ready (model loading may take a few minutes)...')
try:
    result = client.jobs.wait(job.id, timeout=600, poll_interval=10)
except JobTimeoutError:
    print('Endpoint did not start within 10 minutes. Check job status.')
    sys.exit(1)
except APIError as e:
    print(f'API error: {e}')
    sys.exit(1)

if result.status != 'running' and result.status != 'completed':
    print(f'Job {result.status}: {result.error}')
    sys.exit(1)

endpoint_url = result.result.get('endpoint_url', '')
if not endpoint_url:
    # For running jobs, endpoint URL comes through result
    print('Endpoint is starting. Checking for URL...')
    result = client.jobs.get(job.id)
    endpoint_url = (result.result or {}).get('endpoint_url', '')

print(f'\nEndpoint ready: {endpoint_url}')
print('This is a standard OpenAI-compatible API. Use it with any OpenAI client library.')

# Step 4: Call the endpoint (raw HTTP — no openai package needed)
print('\nSending test request...')
payload = json.dumps({
    'model': MODEL,
    'messages': [{'role': 'user', 'content': 'What is DC1 GPU compute marketplace?'}],
    'max_tokens': 200,
}).encode()

req = urllib.request.Request(
    f'{endpoint_url}/v1/chat/completions',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST',
)

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        response = json.loads(resp.read().decode())
        content = response['choices'][0]['message']['content']
        print(f'\nResponse:\n{content}')
except Exception as e:
    print(f'Request failed: {e}')
    print('The endpoint is ready at:', endpoint_url)
    print('You can use it with: openai.OpenAI(base_url=endpoint_url, api_key="any")')

wallet = client.wallet.balance()
print(f'\nRemaining balance: {wallet.balance_sar:.2f} SAR')
print(f'Note: vLLM endpoints accrue charges at {20/100:.2f} SAR/min while running.')
