"""Jobs resource."""
from __future__ import annotations
import time
from typing import Any, Optional

from ..models import Job
from ..exceptions import JobTimeoutError

TERMINAL_STATUSES = {'completed', 'failed', 'cancelled'}


class JobsResource:
    def __init__(self, http):
        self._http = http

    def submit(
        self,
        job_type: str,
        params: dict,
        *,
        provider_id: int,
        duration_minutes: float,
        priority: int = 2,
    ) -> Job:
        """Submit a compute job.

        Args:
            job_type: One of 'llm_inference', 'image_generation', 'vllm_serve',
                      'rendering', 'training', 'benchmark', 'custom_container'.
            params: Job-type-specific parameters dict (e.g. {'prompt': '...', 'model': 'llama3'}).
            provider_id: ID of the provider to run on. Use client.providers.list() to discover.
            duration_minutes: Maximum runtime in minutes. Billing is based on actual usage.
            priority: 1=high, 2=normal (default), 3=low.

        Returns:
            Job object with id and initial status.
        """
        body = {
            'provider_id': provider_id,
            'job_type': job_type,
            'duration_minutes': duration_minutes,
            'priority': priority,
            'params': params,
        }
        data = self._http.post('/api/jobs/submit', body)
        # submit returns minimal info; enrich via get()
        job_id = str(data.get('job_id', data.get('id', '')))
        return self.get(job_id)

    def get(self, job_id: str) -> Job:
        """Fetch current status and result of a job.

        Args:
            job_id: The job ID returned by submit().

        Returns:
            Job object with current status and result (if completed).
        """
        data = self._http.get(f'/api/jobs/{job_id}/output')
        return Job.from_api(data)

    def wait(
        self,
        job_id: str,
        *,
        timeout: int = 300,
        poll_interval: int = 5,
    ) -> Job:
        """Block until job completes (or timeout).

        Args:
            job_id: The job ID to wait on.
            timeout: Maximum seconds to wait (default 300).
            poll_interval: Seconds between status polls (default 5).

        Returns:
            Completed Job object.

        Raises:
            JobTimeoutError: If the job doesn't complete within timeout seconds.
        """
        deadline = time.monotonic() + timeout
        while True:
            job = self.get(job_id)
            if job.is_done:
                return job
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise JobTimeoutError(job_id, timeout)
            time.sleep(min(poll_interval, remaining))

    def list(self, limit: int = 20) -> list[Job]:
        """List recent jobs for the authenticated renter.

        Args:
            limit: Maximum number of jobs to return (default 20).

        Returns:
            List of Job objects, newest first.
        """
        data = self._http.get('/api/jobs', params={'limit': limit})
        jobs_raw = data if isinstance(data, list) else data.get('jobs', [])
        return [Job.from_api(j) for j in jobs_raw]
