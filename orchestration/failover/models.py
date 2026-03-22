"""DC1 Gate 0 — Failover data models."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class FailureType(str, Enum):
    NETWORK_LOSS = "NETWORK_LOSS"   # SSH unreachable
    THERMAL = "THERMAL"             # temp >80°C
    POWER_LOSS = "POWER_LOSS"       # no response at all
    TIMEOUT = "TIMEOUT"             # job stalled >30min


class RecoveryState(str, Enum):
    RUNNING = "RUNNING"
    INTERRUPTION_DETECTED = "INTERRUPTION_DETECTED"
    RECONNECTING = "RECONNECTING"
    FAILING_OVER = "FAILING_OVER"
    ESCALATING = "ESCALATING"
    RESOLVED = "RESOLVED"
    FAILED = "FAILED"


@dataclass
class FailureEvent:
    gpu_id: str
    failure_type: FailureType
    detected_at: datetime = field(default_factory=datetime.utcnow)
    details: str = ""


@dataclass
class FailoverResult:
    success: bool
    time_taken_ms: int
    data_integrity_verified: bool
    failed_gpu: str
    backup_gpu: str
    job_id: str
    checkpoint_used: str = ""
    error: str = ""


@dataclass
class TestResult:
    success: bool
    failover_time_ms: int
    data_loss: int  # bytes, should be 0
    notes: str = ""


@dataclass
class CheckpointRef:
    job_id: str
    checkpoint_num: int
    nas_path: str
    s3_key: str
    checksum_sha256: str
    size_bytes: int
    saved_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RecoveryContext:
    job_id: str
    gpu_id: str
    state: RecoveryState = RecoveryState.RUNNING
    interrupt_type: str = ""
    reconnect_attempts: int = 0
    failover_attempted: bool = False
    started_at: datetime = field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
