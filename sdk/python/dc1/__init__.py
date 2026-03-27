"""
DC1 Python SDK — Official client for the DC1 GPU compute marketplace.

Usage:
    import dc1
    client = dc1.DC1Client(api_key='rk_...')
    job = client.jobs.submit('llm_inference', {'prompt': 'Hello!'}, duration_minutes=1)
    result = client.jobs.wait(job.id)
    print(result.result['output'])
"""

from .client import DC1Client
from .models import Job, Provider, Wallet, Balance
from .exceptions import DC1Error, AuthError, JobTimeoutError, APIError

__version__ = '0.1.0'
__all__ = ['DC1Client', 'Job', 'Provider', 'Wallet', 'Balance', 'DC1Error', 'AuthError', 'JobTimeoutError', 'APIError']
