"""Internal HTTP transport for the dc1_provider SDK.

Uses only stdlib (urllib) — no third-party dependencies required.
Provider auth uses the ``x-provider-key`` header for POST endpoints and
the ``?key=`` query param for GET endpoints (matching the backend contract).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

from .exceptions import AuthError, DC1APIError

_SDK_VERSION = "0.1.0"


class _HttpClient:
    """Minimal stdlib-only HTTP client for the DC1 provider API."""

    def __init__(self, api_key: str, base_url: str, timeout: int):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def get(self, path: str, params: Optional[dict] = None) -> Any:
        """GET request.  Injects ``?key=`` auth param automatically."""
        p = dict(params or {})
        p["key"] = self._api_key
        return self._request("GET", path, params=p)

    def post(self, path: str, body: Optional[dict] = None, *, auth_header: bool = True) -> Any:
        """POST request.  Injects ``x-provider-key`` header when *auth_header* is True."""
        return self._request("POST", path, body=body, auth_header=auth_header)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[dict] = None,
        params: Optional[dict] = None,
        auth_header: bool = True,
    ) -> Any:
        url = self._base_url + path
        if params:
            url = url + "?" + urllib.parse.urlencode(params)

        data = json.dumps(body).encode() if body is not None else None
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "User-Agent": f"dc1-provider-python/{_SDK_VERSION}",
        }
        if auth_header:
            headers["x-provider-key"] = self._api_key

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode()
            try:
                payload = json.loads(raw)
            except Exception:
                payload = {"error": raw or str(exc)}

            msg = payload.get("error", f"HTTP {exc.code}")
            if exc.code in (401, 403):
                raise AuthError(msg, status_code=exc.code, response=payload) from exc
            raise DC1APIError(msg, status_code=exc.code, response=payload) from exc
        except urllib.error.URLError as exc:
            raise DC1APIError(f"Connection error: {exc.reason}") from exc
