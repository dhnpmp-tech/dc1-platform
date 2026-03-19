"""Exceptions raised by the dc1_provider SDK."""


class DC1APIError(Exception):
    """Raised when the DC1 API returns an error response.

    Attributes:
        status_code: HTTP status code from the server.
        response: Parsed JSON response body (may be empty dict).
    """

    def __init__(self, message: str, status_code: int = 0, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}


class AuthError(DC1APIError):
    """Raised when the provider API key is missing, invalid, or not authorized.

    This typically means the key passed as ``api_key`` does not match any
    registered provider, or the provider account has been suspended.
    """
