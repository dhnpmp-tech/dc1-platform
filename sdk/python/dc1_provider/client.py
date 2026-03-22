"""DC1ProviderClient — main entry point for the dc1_provider SDK."""
from __future__ import annotations

import os
import platform
import subprocess
from typing import Any, Optional

from ._http import _HttpClient
from .exceptions import DC1APIError
from .models import Earnings, ProviderJob, ProviderProfile

_PRIMARY_BASE_URL = "https://api.dcp.sa"
_FALLBACK_BASE_URL = "https://dcp.sa/api/dc1"


class DC1ProviderClient:
    """Python client for the DC1 provider API.

    Register your GPU hardware, send heartbeats, fetch assigned jobs, and
    track your earnings — all without reading raw HTTP docs.

    Args:
        api_key: Your provider API key (``dc1-provider-<hex>``).
            Pass ``None`` only when calling :meth:`register` on a fresh account.
        base_url: Override the API base URL. Defaults to ``https://api.dcp.sa``.
        timeout: HTTP request timeout in seconds. Defaults to ``30``.

    Example::

        from dc1_provider import DC1ProviderClient

        client = DC1ProviderClient(api_key="dc1-provider-abc123")

        # Profile
        me = client.me()
        print(f"{me.name} | {me.gpu_model} | {me.status}")
        print(f"Lifetime earnings: {me.total_earnings_sar:.2f} SAR")

        # Send a heartbeat with auto-detected GPU spec
        spec = client.build_resource_spec()
        client.announce(spec)

        # Poll for work
        jobs = client.get_jobs(status="queued")
        for job in jobs:
            print(f"Job {job.id}: {job.job_type} — earns {job.earnings_sar:.2f} SAR")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = _PRIMARY_BASE_URL,
        timeout: int = 30,
    ):
        self._api_key = api_key or ""
        self._http = _HttpClient(
            api_key=self._api_key,
            base_url=base_url,
            timeout=timeout,
        )

    # ------------------------------------------------------------------
    # Auth / Profile
    # ------------------------------------------------------------------

    def me(self) -> ProviderProfile:
        """Fetch your provider profile and current stats.

        Returns:
            :class:`~dc1_provider.models.ProviderProfile` with earnings,
            reputation, and heartbeat info.

        Raises:
            :class:`~dc1_provider.exceptions.AuthError`: If the API key is invalid.
            :class:`~dc1_provider.exceptions.DC1APIError`: On any other API error.
        """
        data = self._http.get("/api/providers/me")
        return ProviderProfile.from_api(data)

    def register(
        self,
        name: str,
        email: str,
        gpu_model: str,
        os: Optional[str] = None,
        phone: Optional[str] = None,
        resource_spec: Optional[dict] = None,
    ) -> dict:
        """Register a new provider account and receive an API key.

        You do not need an ``api_key`` to call this method — registration
        is unauthenticated.  Store the returned ``api_key`` and pass it
        when constructing the client for subsequent calls.

        Args:
            name: Your display name.
            email: Registration email (must be unique).
            gpu_model: GPU model string, e.g. ``"RTX 4090"``.
            os: Operating system — ``"Windows"``, ``"Linux"``, or ``"Mac"``.
                Auto-detected if omitted.
            phone: Optional contact phone number.
            resource_spec: Optional resource spec dict (CPU, RAM, VRAM, etc.).
                Use :meth:`build_resource_spec` to generate one automatically.

        Returns:
            Dict with ``api_key``, ``provider_id``, ``installer_url``, and ``message``.

        Raises:
            :class:`~dc1_provider.exceptions.DC1APIError`: If the email is already
                registered (HTTP 409) or required fields are missing (HTTP 400).

        Example::

            result = client.register(
                name="Khalid GPU Farm",
                email="khalid@example.com",
                gpu_model="RTX 4090",
            )
            print("Your API key:", result["api_key"])
        """
        body: dict[str, Any] = {
            "name": name,
            "email": email,
            "gpu_model": gpu_model,
            "os": os or _detect_os(),
        }
        if phone:
            body["phone"] = phone
        if resource_spec:
            body["resource_spec"] = resource_spec

        return self._http.post("/api/providers/register", body=body, auth_header=False)

    # ------------------------------------------------------------------
    # Heartbeat / Announce
    # ------------------------------------------------------------------

    def heartbeat(self, gpu_spec: Optional[dict] = None) -> dict:
        """Send a heartbeat to DC1 to keep your provider status online.

        The DC1 daemon (``dc1_daemon.py``) calls this automatically every 30s.
        Call it manually when running a custom integration or testing.

        Args:
            gpu_spec: Optional dict with GPU metrics (``vram_used_mib``,
                ``gpu_util_pct``, ``temp_c``, etc.).  If omitted, DC1 records
                the heartbeat with no GPU detail.

        Returns:
            Dict with ``status``, ``update_available``, and optional task info.

        Raises:
            :class:`~dc1_provider.exceptions.AuthError`: If the API key is invalid.
        """
        body: dict[str, Any] = {"daemon_version": "sdk/0.1.0"}
        if gpu_spec:
            body["gpu_spec"] = gpu_spec
        return self._http.post("/api/providers/heartbeat", body=body)

    def announce(self, resource_spec: dict) -> dict:
        """Send a heartbeat with a full resource spec to advertise capacity.

        Use :meth:`build_resource_spec` to build *resource_spec* automatically,
        or construct it manually:

        .. code-block:: python

            spec = {
                "gpu_model": "RTX 4090",
                "vram_mib": 24576,
                "cpu_cores": 16,
                "ram_mib": 65536,
            }
            client.announce(spec)

        Args:
            resource_spec: Dict describing your hardware.

        Returns:
            Heartbeat response dict from the server.
        """
        body: dict[str, Any] = {
            "daemon_version": "sdk/0.1.0",
            "resource_spec": resource_spec,
        }
        return self._http.post("/api/providers/heartbeat", body=body)

    # ------------------------------------------------------------------
    # Jobs
    # ------------------------------------------------------------------

    def get_jobs(self, status: Optional[str] = None) -> list[ProviderJob]:
        """Fetch compute jobs assigned to this provider.

        Args:
            status: Filter by status — ``"queued"``, ``"running"``,
                ``"completed"``, ``"failed"``.  Returns all statuses if omitted.

        Returns:
            List of :class:`~dc1_provider.models.ProviderJob` objects.

        Example::

            pending = client.get_jobs(status="queued")
            for job in pending:
                print(job.id, job.job_type, job.earnings_sar, "SAR")
        """
        params = {}
        if status:
            params["status"] = status
        data = self._http.get(f"/api/providers/{self._api_key}/jobs", params=params if params else None)

        raw_list = data if isinstance(data, list) else data.get("jobs", [])
        return [ProviderJob.from_api(j) for j in raw_list]

    # ------------------------------------------------------------------
    # Earnings
    # ------------------------------------------------------------------

    def get_earnings(self) -> Earnings:
        """Fetch your earnings summary.

        Returns:
            :class:`~dc1_provider.models.Earnings` with available balance,
            lifetime earnings, and pending job settlements.

        Example::

            e = client.get_earnings()
            print(f"Available: {e.available_sar:.2f} SAR")
            print(f"Total earned: {e.total_earned_sar:.2f} SAR")
        """
        data = self._http.get("/api/providers/earnings")
        return Earnings.from_api(data)

    # ------------------------------------------------------------------
    # Resource spec
    # ------------------------------------------------------------------

    def build_resource_spec(self) -> dict:
        """Auto-detect GPU and system resources on the current machine.

        Runs ``nvidia-smi`` (if available) to get GPU info, then reads
        ``/proc/meminfo`` (Linux) or uses ``platform`` for basic CPU info.

        Returns:
            Dict suitable for passing to :meth:`announce` or :meth:`register`.
            Falls back to a stub dict if detection fails.

        Example::

            spec = client.build_resource_spec()
            print(spec)
            # {'gpu_model': 'NVIDIA GeForce RTX 4090', 'vram_mib': 24576, ...}
            client.announce(spec)
        """
        spec: dict[str, Any] = {
            "os": _detect_os(),
            "cpu_cores": os.cpu_count() or 1,
        }

        # GPU via nvidia-smi
        gpu_info = _query_nvidia_smi()
        if gpu_info:
            spec.update(gpu_info)

        # RAM via /proc/meminfo (Linux) or platform fallback
        ram_mib = _detect_ram_mib()
        if ram_mib:
            spec["ram_mib"] = ram_mib

        return spec


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _detect_os() -> str:
    sys = platform.system()
    if sys == "Windows":
        return "Windows"
    if sys == "Darwin":
        return "Mac"
    return "Linux"


def _query_nvidia_smi() -> Optional[dict]:
    """Run nvidia-smi and parse GPU model + VRAM.  Returns None if not available."""
    try:
        out = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,temperature.gpu,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            stderr=subprocess.DEVNULL,
            timeout=10,
        ).decode().strip()
    except Exception:
        return None

    parts = [p.strip() for p in out.split(",")]
    if len(parts) < 2:
        return None

    info: dict[str, Any] = {"gpu_model": parts[0]}
    try:
        info["vram_mib"] = int(parts[1])
    except ValueError:
        pass
    if len(parts) >= 3:
        try:
            info["gpu_temp_c"] = int(parts[2])
        except ValueError:
            pass
    if len(parts) >= 4:
        try:
            info["gpu_util_pct"] = int(parts[3])
        except ValueError:
            pass
    return info


def _detect_ram_mib() -> Optional[int]:
    """Read total RAM from /proc/meminfo on Linux.  Returns None on other platforms."""
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return kb // 1024
    except Exception:
        pass
    return None
