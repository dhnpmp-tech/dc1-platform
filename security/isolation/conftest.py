"""
GUARDIAN-ISOLATION: Shared pytest fixtures for DC1 security tests.
Mocks Docker, nvidia-smi, Supabase, and SSH — no real hardware needed.
"""

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Docker mocks
# ---------------------------------------------------------------------------

@dataclass
class FakeContainer:
    name: str = "dc1-job-abc123"
    status: str = "running"
    attrs: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.attrs:
            self.attrs = {
                "HostConfig": {"NetworkMode": "none"},
                "Config": {
                    "Labels": {
                        "dc1.job_id": "job-001",
                        "dc1.renter_id": "renter-42",
                    }
                },
                "Mounts": [
                    {
                        "Destination": "/workspace",
                        "Mode": "ro",
                        "RW": False,
                    }
                ],
            }

    def exec_run(self, cmd: str, **kwargs) -> tuple:
        """Simulate docker exec."""
        if "ps aux" in cmd:
            # Only the job's own process visible
            return (0, b"USER  PID  CMD\nroot  1  /entrypoint.sh\n")
        return (0, b"")

    def top(self) -> dict:
        return {"Processes": [["root", "1", "/entrypoint.sh"]]}


@dataclass
class FakeContainerCollection:
    _containers: list = field(default_factory=list)

    def list(self, filters=None, **kwargs) -> list:
        return self._containers


@dataclass
class FakeDockerClient:
    containers: FakeContainerCollection = field(default_factory=FakeContainerCollection)


@pytest.fixture
def mock_docker_client():
    """Return a FakeDockerClient with one well-configured DC1 container."""
    client = FakeDockerClient()
    client.containers._containers = [FakeContainer()]
    return client


@pytest.fixture
def mock_docker_client_empty():
    """Docker client with zero running containers (pre-wipe state)."""
    return FakeDockerClient()


# ---------------------------------------------------------------------------
# nvidia-smi mock
# ---------------------------------------------------------------------------

@dataclass
class NvidiaSmiMock:
    """Simulates nvidia-smi CLI output."""

    memory_used_mb: int = 12  # post-wipe baseline

    def query(self) -> str:
        return (
            f"==== GPU 0 ====\n"
            f"Memory Used : {self.memory_used_mb} MiB\n"
            f"Memory Total: 24576 MiB\n"
        )

    def run_clocks_reset(self) -> tuple[int, str]:
        self.memory_used_mb = 8
        return (0, "Clocks reset successfully.")

    def run_gpu_reset(self) -> tuple[int, str]:
        # Should never be called — kills processes
        return (1, "ERROR: GPU reset kills running processes!")


@pytest.fixture
def nvidia_smi():
    return NvidiaSmiMock()


@pytest.fixture
def nvidia_smi_dirty():
    return NvidiaSmiMock(memory_used_mb=320)


# ---------------------------------------------------------------------------
# Supabase / Mission Control mock
# ---------------------------------------------------------------------------

@dataclass
class FakeAuditLog:
    entries: list = field(default_factory=list)
    last_wipe_ts: float = 0.0

    def log_wipe(self, gpu_id: str, memory_after: int, operator: str = "system"):
        now = time.time()
        self.entries.append({
            "event": "gpu_wipe",
            "gpu_id": gpu_id,
            "memory_after_mb": memory_after,
            "operator": operator,
            "timestamp": now,
        })
        self.last_wipe_ts = now

    def cooldown_active(self, cooldown_sec: float = 300.0) -> bool:
        return (time.time() - self.last_wipe_ts) < cooldown_sec


@pytest.fixture
def audit_log():
    return FakeAuditLog()


# ---------------------------------------------------------------------------
# Billing helpers
# ---------------------------------------------------------------------------

def compute_proof_hash(job_id: str, session_id: str, amount: int, timestamp: int) -> str:
    """Canonical billing proof hash: SHA-256(jobId|sessionId|amount|timestamp)."""
    payload = f"{job_id}|{session_id}|{amount}|{timestamp}"
    return hashlib.sha256(payload.encode()).hexdigest()


def verify_billing_integrity(job_id, session_id, amount, timestamp, proof_hash) -> bool:
    expected = compute_proof_hash(job_id, session_id, amount, timestamp)
    return proof_hash == expected


def split_payment(total_halala: int) -> tuple[int, int]:
    """75/25 split using integer arithmetic only. Returns (provider, dc1)."""
    provider = (total_halala * 75) // 100
    dc1 = total_halala - provider  # remainder goes to DC1 — no rounding leak
    return provider, dc1


def halala_to_sar_display(halala: int) -> str:
    """Convert halala (int) to SAR display string WITHOUT floating point."""
    riyals = halala // 100
    remaining = halala % 100
    return f"{riyals}.{remaining:02d} SAR"


@pytest.fixture
def billing_helpers():
    return {
        "compute_proof_hash": compute_proof_hash,
        "verify_billing_integrity": verify_billing_integrity,
        "split_payment": split_payment,
        "halala_to_sar_display": halala_to_sar_display,
    }


# ---------------------------------------------------------------------------
# SSH mock
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_paramiko():
    with patch("paramiko.SSHClient") as MockSSH:
        client_instance = MagicMock()
        MockSSH.return_value = client_instance
        yield client_instance
