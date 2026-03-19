"""
dc1_provider — Python SDK for DC1 GPU compute marketplace providers.

Register your GPU hardware, send heartbeats, and track earnings with a
clean, zero-dependency interface to the DC1 provider API.

Usage::

    from dc1_provider import DC1ProviderClient

    client = DC1ProviderClient(api_key="dc1-provider-<your-key>")

    # Check your profile
    me = client.me()
    print(f"{me.name} — {me.gpu_model} — {me.status}")

    # Send a heartbeat
    client.heartbeat()

    # List pending jobs
    jobs = client.get_jobs(status="queued")
    for job in jobs:
        print(job.id, job.job_type)
"""

from .client import DC1ProviderClient
from .models import ProviderProfile, ProviderJob, Earnings
from .exceptions import DC1APIError, AuthError

__version__ = "0.1.0"
__all__ = [
    "DC1ProviderClient",
    "ProviderProfile",
    "ProviderJob",
    "Earnings",
    "DC1APIError",
    "AuthError",
]
