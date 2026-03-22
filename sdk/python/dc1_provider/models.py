"""Data models for the dc1_provider SDK."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ProviderProfile:
    """Your provider account as returned by ``GET /api/providers/me``.

    Attributes:
        id: Numeric provider ID.
        name: Display name.
        email: Registered email address.
        gpu_model: GPU model string (e.g. ``"RTX 4090"``).
        os: Operating system reported at registration.
        status: Account status — ``"registered"`` | ``"online"`` | ``"offline"`` | ``"suspended"``.
        api_key: Your provider API key (``dc1-provider-...``).
        total_jobs: Lifetime completed jobs.
        total_earnings_halala: Lifetime earnings in halala (1 SAR = 100 halala).
        today_earnings_halala: Earnings since midnight UTC today.
        reputation_score: 0-100 composite reliability score.
        uptime_pct: 7-day uptime percentage (0-100).
        last_heartbeat: ISO-8601 timestamp of most recent heartbeat, or None.
    """

    id: int
    name: str
    email: str
    gpu_model: str
    os: str
    status: str
    api_key: str
    total_jobs: int
    total_earnings_halala: int
    today_earnings_halala: int
    reputation_score: float
    uptime_pct: float
    last_heartbeat: Optional[str]
    _raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_api(cls, data: dict) -> "ProviderProfile":
        provider = data.get("provider", data)
        return cls(
            id=provider.get("id", 0),
            name=provider.get("name", ""),
            email=provider.get("email", ""),
            gpu_model=provider.get("gpu_model", ""),
            os=provider.get("os", ""),
            status=provider.get("status", "offline"),
            api_key=provider.get("api_key", ""),
            total_jobs=provider.get("total_jobs", 0),
            total_earnings_halala=provider.get("total_earnings_halala", 0),
            today_earnings_halala=provider.get("today_earnings_halala", 0),
            reputation_score=float(provider.get("reputation_score", 0)),
            uptime_pct=float(provider.get("uptime_pct", 0)),
            last_heartbeat=provider.get("last_heartbeat"),
            _raw=data,
        )

    @property
    def total_earnings_sar(self) -> float:
        """Lifetime earnings in SAR."""
        return self.total_earnings_halala / 100

    @property
    def today_earnings_sar(self) -> float:
        """Today's earnings in SAR."""
        return self.today_earnings_halala / 100

    @property
    def is_online(self) -> bool:
        return self.status == "online"


@dataclass
class ProviderJob:
    """A compute job assigned to this provider.

    Attributes:
        id: Unique job identifier.
        job_type: Workload type (e.g. ``"llm_inference"``, ``"image_gen"``).
        status: Job lifecycle status — ``"queued"`` | ``"running"`` | ``"completed"`` | ``"failed"``.
        renter_id: ID of the renter who submitted the job.
        duration_minutes: Requested duration limit.
        cost_halala: Total job cost in halala.
        provider_earnings_halala: Provider's share of cost (75%).
        payload: Workload-specific parameters dict.
        submitted_at: ISO-8601 submission timestamp.
        started_at: ISO-8601 start timestamp, or None.
        completed_at: ISO-8601 completion timestamp, or None.
        hmac_signature: HMAC task signature for daemon validation.
    """

    id: str
    job_type: str
    status: str
    renter_id: int
    duration_minutes: float
    cost_halala: int
    provider_earnings_halala: int
    payload: dict
    submitted_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    hmac_signature: Optional[str] = None
    _raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_api(cls, data: dict) -> "ProviderJob":
        payload = data.get("payload", {})
        if isinstance(payload, str):
            import json
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        return cls(
            id=str(data.get("job_id", data.get("id", ""))),
            job_type=data.get("job_type", ""),
            status=data.get("status", "queued"),
            renter_id=data.get("renter_id", 0),
            duration_minutes=float(data.get("duration_minutes", 0)),
            cost_halala=data.get("cost_halala", 0),
            provider_earnings_halala=data.get("provider_earnings_halala", 0),
            payload=payload,
            submitted_at=data.get("submitted_at", ""),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            hmac_signature=data.get("hmac_signature"),
            _raw=data,
        )

    @property
    def cost_sar(self) -> float:
        """Job cost in SAR."""
        return self.cost_halala / 100

    @property
    def earnings_sar(self) -> float:
        """Your earnings for this job in SAR."""
        return self.provider_earnings_halala / 100

    @property
    def is_terminal(self) -> bool:
        return self.status in ("completed", "failed", "cancelled")


@dataclass
class Earnings:
    """Provider earnings summary returned by ``GET /api/providers/earnings``.

    Attributes:
        available_halala: Balance available for withdrawal.
        total_earned_halala: Lifetime earnings (before fees).
        total_jobs: Count of completed jobs.
        pending_halala: Earnings from running jobs not yet settled.
    """

    available_halala: int
    total_earned_halala: int
    total_jobs: int
    pending_halala: int
    _raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_api(cls, data: dict) -> "Earnings":
        return cls(
            available_halala=data.get("available_halala", data.get("balance_halala", 0)),
            total_earned_halala=data.get("total_earned_halala", data.get("total_earnings_halala", 0)),
            total_jobs=data.get("total_jobs", 0),
            pending_halala=data.get("pending_halala", 0),
            _raw=data,
        )

    @property
    def available_sar(self) -> float:
        """Available balance in SAR."""
        return self.available_halala / 100

    @property
    def total_earned_sar(self) -> float:
        """Lifetime earnings in SAR."""
        return self.total_earned_halala / 100
