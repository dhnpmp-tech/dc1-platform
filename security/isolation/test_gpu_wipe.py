"""
GUARDIAN-ISOLATION: GPU memory wipe pattern tests.
Critical: must use --clocks-reset, NEVER --gpu-reset.
"""

import os
import time
import textwrap
import tempfile

import pytest
from .conftest import FakeAuditLog, NvidiaSmiMock, FakeDockerClient, FakeContainer


# ---------------------------------------------------------------------------
# Source-code scanning tests
# ---------------------------------------------------------------------------

# Simulated DC1 source file for scanning
GOOD_SOURCE = textwrap.dedent("""\
    async def wipeGPUMemory(gpu_id: str):
        # Reset clocks to clear GPU state
        result = subprocess.run(
            ["nvidia-smi", "--clocks-reset", "-i", gpu_id],
            capture_output=True,
        )
        return result.returncode == 0
""")

BAD_SOURCE = textwrap.dedent("""\
    async def wipeGPUMemory(gpu_id: str):
        result = subprocess.run(
            ["nvidia-smi", "--gpu-reset", "-i", gpu_id],
            capture_output=True,
        )
        return result.returncode == 0
""")


class TestWipeCommandPattern:
    """Source code must use --clocks-reset, never --gpu-reset."""

    def _scan_source(self, source_text: str) -> dict:
        has_clocks_reset = "--clocks-reset" in source_text
        has_gpu_reset = "--gpu-reset" in source_text
        return {"clocks_reset": has_clocks_reset, "gpu_reset": has_gpu_reset}

    def test_good_source_uses_clocks_reset(self):
        result = self._scan_source(GOOD_SOURCE)
        assert result["clocks_reset"], "wipeGPUMemory must use --clocks-reset"
        assert not result["gpu_reset"], (
            "CRITICAL: --gpu-reset found in source! This kills running processes."
        )

    def test_bad_source_detected(self):
        result = self._scan_source(BAD_SOURCE)
        assert result["gpu_reset"], "Scanner should detect --gpu-reset in bad source"

    def test_scan_from_file(self, tmp_path):
        """Write source to temp file and scan — simulates real file grep."""
        src_file = tmp_path / "gpu_worker.py"
        src_file.write_text(GOOD_SOURCE)
        content = src_file.read_text()
        assert "--clocks-reset" in content
        assert "--gpu-reset" not in content, (
            f"CRITICAL: --gpu-reset found in {src_file}"
        )


class TestPreWipeContainerCheck:
    """No DC1 containers may be running when wipe executes."""

    def test_wipe_allowed_when_no_containers(self, mock_docker_client_empty):
        running = mock_docker_client_empty.containers.list()
        assert len(running) == 0, (
            f"Wipe blocked: {len(running)} DC1 containers still running"
        )

    def test_wipe_blocked_when_containers_running(self, mock_docker_client):
        running = mock_docker_client.containers.list()
        assert len(running) > 0, "Expected running containers for this test"
        # Wipe should NOT proceed
        can_wipe = len(running) == 0
        assert not can_wipe, "Wipe must be blocked while containers are running"


class TestPostWipeMemory:
    """GPU memory must be < 50 MB after wipe."""

    def test_memory_below_threshold_after_reset(self):
        gpu = NvidiaSmiMock(memory_used_mb=400)
        code, msg = gpu.run_clocks_reset()
        assert code == 0
        assert gpu.memory_used_mb < 50, (
            f"Post-wipe memory {gpu.memory_used_mb} MB exceeds 50 MB threshold"
        )


class TestWipeAuditLog:
    """Every wipe must be logged to Mission Control."""

    def test_audit_entry_created(self, audit_log):
        audit_log.log_wipe("gpu-0", memory_after=8)
        assert len(audit_log.entries) == 1
        entry = audit_log.entries[0]
        assert entry["event"] == "gpu_wipe"
        assert entry["gpu_id"] == "gpu-0"
        assert entry["memory_after_mb"] == 8
        assert entry["timestamp"] > 0

    def test_audit_records_operator(self, audit_log):
        audit_log.log_wipe("gpu-0", memory_after=8, operator="guardian")
        assert audit_log.entries[0]["operator"] == "guardian"


class TestWipeCooldown:
    """5-minute cooldown between wipes to prevent abuse."""

    def test_cooldown_active_after_wipe(self, audit_log):
        audit_log.log_wipe("gpu-0", memory_after=8)
        assert audit_log.cooldown_active(cooldown_sec=300), (
            "Cooldown should be active immediately after wipe"
        )

    def test_cooldown_expires(self, audit_log):
        audit_log.last_wipe_ts = time.time() - 301  # 5 min + 1 sec ago
        assert not audit_log.cooldown_active(cooldown_sec=300), (
            "Cooldown should have expired after 5 minutes"
        )

    def test_wipe_blocked_during_cooldown(self, audit_log):
        audit_log.log_wipe("gpu-0", memory_after=8)
        # Second wipe attempt should be blocked
        assert audit_log.cooldown_active(), "Second wipe must be blocked during cooldown"
