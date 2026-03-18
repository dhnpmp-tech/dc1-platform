"""
Example: LLM Inference with LLaMA 3

Submits a prompt to a DC1 provider, waits for the result, and prints it.

Usage:
    DC1_API_KEY=rk_... python llm_inference.py
"""
import os
import sys
import dc1
from dc1 import JobTimeoutError, APIError

API_KEY = os.environ.get('DC1_API_KEY')
if not API_KEY:
    print('Set DC1_API_KEY environment variable to your renter API key')
    sys.exit(1)

client = dc1.DC1Client(api_key=API_KEY)

# Step 1: Find an online provider
print('Fetching available providers...')
providers = client.providers.list()
if not providers:
    print('No providers online. Try again later.')
    sys.exit(1)

provider = providers[0]
print(f'Using provider: {provider.name} ({provider.gpu_model}, {provider.vram_gb} GB VRAM)')

# Step 2: Submit the job
print('\nSubmitting LLM inference job...')
job = client.jobs.submit(
    'llm_inference',
    {
        'prompt': 'Explain the transformer attention mechanism in two paragraphs.',
        'model': 'llama3',
    },
    provider_id=provider.id,
    duration_minutes=2,
    priority=2,
)
print(f'Job submitted: {job.id} (status: {job.status})')

# Step 3: Wait for result
print('\nWaiting for result (up to 5 minutes)...')
try:
    result = client.jobs.wait(job.id, timeout=300, poll_interval=5)
except JobTimeoutError as e:
    print(f'Timed out waiting for job {e.job_id}')
    sys.exit(1)
except APIError as e:
    print(f'API error: {e}')
    sys.exit(1)

# Step 4: Print result
if result.status == 'completed':
    print(f'\nResult (execution time: {result.execution_time_sec:.1f}s, cost: {result.cost_sar:.4f} SAR):')
    print('-' * 60)
    print(result.result.get('output', '(no output)'))
else:
    print(f'Job {result.status}: {result.error}')

# Step 5: Show wallet balance
wallet = client.wallet.balance()
print(f'\nRemaining balance: {wallet.balance_sar:.2f} SAR')
