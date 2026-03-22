"""
Example: Image Generation with Stable Diffusion

Generates an image on a DC1 provider GPU and prints the download URL.

Usage:
    DC1_API_KEY=rk_... python image_gen.py
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

# Step 1: Find an online provider with enough VRAM for image gen (≥8 GB)
print('Fetching available providers...')
providers = [p for p in client.providers.list() if p.vram_gb >= 8]
if not providers:
    print('No providers with sufficient VRAM online. Try again later.')
    sys.exit(1)

provider = providers[0]
print(f'Using provider: {provider.name} ({provider.gpu_model}, {provider.vram_gb} GB VRAM)')

# Step 2: Submit the image generation job
PROMPT = 'A futuristic data center in the Saudi Arabian desert at sunset, cinematic, 8K'

print(f'\nSubmitting image generation job...')
print(f'Prompt: {PROMPT}')

job = client.jobs.submit(
    'image_generation',
    {
        'prompt': PROMPT,
        'width': 1024,
        'height': 1024,
        'steps': 30,
    },
    provider_id=provider.id,
    duration_minutes=3,
    priority=2,
)
print(f'Job submitted: {job.id} (status: {job.status})')

# Step 3: Wait for result
print('\nGenerating image (this may take 1–3 minutes)...')
try:
    result = client.jobs.wait(job.id, timeout=300, poll_interval=10)
except JobTimeoutError:
    print(f'Timed out. Check job status manually: {job.id}')
    sys.exit(1)
except APIError as e:
    print(f'API error: {e}')
    sys.exit(1)

# Step 4: Print result
if result.status == 'completed':
    print(f'\nImage generated! (cost: {result.cost_sar:.4f} SAR)')
    image_url = result.result.get('image_url') or result.result.get('url', '(no URL)')
    print(f'Download URL: {image_url}')
else:
    print(f'Job {result.status}: {result.error}')

wallet = client.wallet.balance()
print(f'\nRemaining balance: {wallet.balance_sar:.2f} SAR')
