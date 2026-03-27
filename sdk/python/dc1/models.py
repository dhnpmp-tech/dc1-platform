"""DC1 data models."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Job:
    """Represents a DC1 compute job."""

    id: str
    status: str  # queued | running | completed | failed | cancelled
    job_type: str
    provider_id: int
    duration_minutes: float
    cost_halala: int
    submitted_at: str
    result: Optional[Any] = None        # parsed output (text, image URL, endpoint URL)
    result_type: Optional[str] = None   # text | image | endpoint
    error: Optional[str] = None
    execution_time_sec: Optional[float] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    provider_name: Optional[str] = None
    _raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_api(cls, data: dict) -> 'Job':
        raw_result = data.get('result')
        result_type = data.get('result_type')

        # Parse result into a friendly structure
        parsed = None
        if raw_result and isinstance(raw_result, dict):
            if result_type == 'image':
                parsed = raw_result
            elif result_type == 'endpoint':
                parsed = raw_result
            else:
                parsed = raw_result
        elif raw_result and isinstance(raw_result, str):
            parsed = {'output': raw_result}

        return cls(
            id=str(data.get('job_id', data.get('id', ''))),
            status=data.get('status', 'unknown'),
            job_type=data.get('job_type', ''),
            provider_id=data.get('provider_id', 0),
            duration_minutes=data.get('duration_minutes', 0),
            cost_halala=data.get('cost_halala', 0),
            submitted_at=data.get('submitted_at', ''),
            result=parsed,
            result_type=result_type,
            error=data.get('error'),
            execution_time_sec=data.get('execution_time_sec'),
            started_at=data.get('started_at'),
            completed_at=data.get('completed_at'),
            provider_name=data.get('provider_name'),
            _raw=data,
        )

    @property
    def is_done(self) -> bool:
        return self.status in ('completed', 'failed', 'cancelled')

    @property
    def cost_sar(self) -> float:
        """Cost in SAR (1 SAR = 100 halala)."""
        return self.cost_halala / 100


@dataclass
class Provider:
    """Represents an available GPU provider."""

    id: int
    name: str
    gpu_model: str
    vram_mib: int
    status: str
    reliability_score: int
    _raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_api(cls, data: dict) -> 'Provider':
        return cls(
            id=data.get('id', 0),
            name=data.get('name', ''),
            gpu_model=data.get('gpu_model', ''),
            vram_mib=data.get('vram_mib', 0),
            status=data.get('status', 'offline'),
            reliability_score=data.get('reliability_score', 0),
            _raw=data,
        )

    @property
    def vram_gb(self) -> float:
        return round(self.vram_mib / 1024, 1)


@dataclass
class Wallet:
    """Represents a renter's wallet (from /api/renters/me)."""

    balance_halala: int
    api_key: str
    name: str
    email: str
    _raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_api(cls, data: dict) -> 'Wallet':
        return cls(
            balance_halala=data.get('balance_halala', 0),
            api_key=data.get('api_key', ''),
            name=data.get('name', ''),
            email=data.get('email', ''),
            _raw=data,
        )

    @property
    def balance_sar(self) -> float:
        """Balance in SAR (1 SAR = 100 halala)."""
        return self.balance_halala / 100


@dataclass
class Balance:
    """Detailed wallet balance breakdown (from /api/renters/balance)."""

    balance_halala: int
    balance_sar: float
    held_halala: int
    held_sar: float
    available_halala: int
    total_spent_halala: int
    total_spent_sar: float
    total_jobs: int
    _raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_api(cls, data: dict) -> 'Balance':
        balance_halala = data.get('balance_halala', 0)
        total_spent_halala = data.get('total_spent_halala', 0)
        held_halala = data.get('held_halala', 0)
        return cls(
            balance_halala=balance_halala,
            balance_sar=data.get('balance_sar', balance_halala / 100),
            held_halala=held_halala,
            held_sar=data.get('held_sar', held_halala / 100),
            available_halala=data.get('available_halala', balance_halala),
            total_spent_halala=total_spent_halala,
            total_spent_sar=data.get('total_spent_sar', total_spent_halala / 100),
            total_jobs=data.get('total_jobs', 0),
            _raw=data,
        )
