"""DC1 SDK exceptions."""


class DC1Error(Exception):
    """Base exception for all DC1 SDK errors."""


class AuthError(DC1Error):
    """Raised when the API key is missing, invalid, or unauthorized."""


class APIError(DC1Error):
    """Raised when the DC1 API returns an error response."""

    def __init__(self, message: str, status_code: int = 0, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}


class JobTimeoutError(DC1Error):
    """Raised when client.jobs.wait() exceeds the timeout."""

    def __init__(self, job_id: str, timeout: int):
        super().__init__(f"Job {job_id} did not complete within {timeout}s")
        self.job_id = job_id
        self.timeout = timeout
