"""Tests for the DC1 Checkpoint Manager — fully mocked, no real S3 or FS."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from orchestration.checkpoint.config import CheckpointConfig
from orchestration.checkpoint.checkpoint_manager import (
    CheckpointError,
    CheckpointManager,
    CheckpointResult,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _cfg(tmp_path: Path) -> CheckpointConfig:
    return CheckpointConfig(
        s3_bucket="test-bucket",
        s3_region="me-south-1",
        s3_access_key="AKTEST",
        s3_secret_key="secret",
        s3_endpoint_url="",
        local_base_path=str(tmp_path / "checkpoints"),
        save_interval_s=1,
        retention_days=60,
        mc_api_url="",
        mc_api_token="",
        agent_id="test",
    )


SAMPLE_STATE = {
    "gpu_model": "A100",
    "started_at": "2026-01-01T00:00:00Z",
    "elapsed_seconds": 3600,
    "env_vars": {"FOO": "bar"},
    "docker_image": "dc1/worker:latest",
    "code_path": "/workspace/train.py",
    "last_tick_halala": 500,
    "wallet_reserved_halala": 10000,
    "custom_state": {"epoch": 5, "loss": 0.42},
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_save_writes_to_s3_and_local(tmp_path: Path):
    """save_checkpoint writes to both S3 and local."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.upload_json = AsyncMock(return_value=100)

    result = await mgr.save_checkpoint("job-1", "ctr-1", SAMPLE_STATE)

    assert result.s3_key is not None
    assert result.local_path is not None
    assert result.size_bytes > 0
    mgr._s3.upload_json.assert_awaited_once()
    assert Path(result.local_path).exists()


@pytest.mark.asyncio
async def test_load_returns_latest_from_s3(tmp_path: Path):
    """load_checkpoint returns the latest checkpoint from S3."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    expected = {**SAMPLE_STATE, "job_id": "job-1"}
    mgr._s3.list_keys = AsyncMock(return_value=[
        {"key": "checkpoints/job-1/20260101T000000Z.json", "size": 100, "last_modified": "x"},
        {"key": "checkpoints/job-1/20260101T010000Z.json", "size": 100, "last_modified": "x"},
    ])
    mgr._s3.download_json = AsyncMock(return_value=expected)

    result = await mgr.load_checkpoint("job-1")

    assert result == expected
    mgr._s3.download_json.assert_awaited_once_with("checkpoints/job-1/20260101T010000Z.json")


@pytest.mark.asyncio
async def test_load_falls_back_to_local(tmp_path: Path):
    """load_checkpoint falls back to local NAS when S3 fails."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.list_keys = AsyncMock(side_effect=RuntimeError("S3 down"))

    # Write a local file
    local_dir = Path(tmp_path / "checkpoints" / "job-2")
    local_dir.mkdir(parents=True)
    payload = {"job_id": "job-2", "epoch": 3}
    (local_dir / "20260101T000000Z.json").write_text(json.dumps(payload))

    result = await mgr.load_checkpoint("job-2")
    assert result == payload


@pytest.mark.asyncio
async def test_load_returns_none_when_empty(tmp_path: Path):
    """load_checkpoint returns None when no checkpoints exist."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.list_keys = AsyncMock(return_value=[])

    result = await mgr.load_checkpoint("job-nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_delete_checkpoints(tmp_path: Path):
    """delete_checkpoints removes from S3 and local."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.delete_prefix = AsyncMock(return_value=2)

    local_dir = Path(tmp_path / "checkpoints" / "job-3")
    local_dir.mkdir(parents=True)
    (local_dir / "test.json").write_text("{}")

    await mgr.delete_checkpoints("job-3")

    mgr._s3.delete_prefix.assert_awaited_once()
    assert not local_dir.exists()


@pytest.mark.asyncio
async def test_scheduler_calls_state_fn(tmp_path: Path):
    """start_hourly_scheduler calls state_fn and saves result."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.upload_json = AsyncMock(return_value=50)
    state_fn = AsyncMock(return_value=SAMPLE_STATE)

    task = await mgr.start_hourly_scheduler("job-4", "ctr-4", state_fn)
    await asyncio.sleep(0.1)  # let one iteration run
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    state_fn.assert_awaited()
    mgr._s3.upload_json.assert_awaited()


@pytest.mark.asyncio
async def test_scheduler_stops_on_cancel(tmp_path: Path):
    """Scheduler task stops cleanly when cancelled."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.upload_json = AsyncMock(return_value=50)
    state_fn = AsyncMock(return_value=SAMPLE_STATE)

    task = await mgr.start_hourly_scheduler("job-5", "ctr-5", state_fn)
    await asyncio.sleep(0.05)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert task.cancelled()


@pytest.mark.asyncio
async def test_s3_retry_succeeds_on_third(tmp_path: Path):
    """S3 retry: fails 2x then succeeds on 3rd attempt."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.upload_json = AsyncMock(side_effect=[
        RuntimeError("fail1"),
        RuntimeError("fail2"),
        100,
    ])
    # Patch sleep to avoid real delays
    with patch("orchestration.checkpoint.checkpoint_manager.asyncio.sleep", new_callable=AsyncMock):
        result = await mgr.save_checkpoint("job-6", "ctr-6", SAMPLE_STATE)

    assert result.s3_key is not None
    assert mgr._s3.upload_json.await_count == 3


@pytest.mark.asyncio
async def test_checkpoint_error_when_both_fail(tmp_path: Path):
    """CheckpointError raised when both S3 and local fail."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.upload_json = AsyncMock(side_effect=RuntimeError("S3 down"))

    # Make local write fail by using an invalid path
    mgr._config = CheckpointConfig(
        s3_bucket="test", s3_region="me-south-1",
        s3_access_key="x", s3_secret_key="x", s3_endpoint_url="",
        local_base_path="/proc/nonexistent/impossible",
        save_interval_s=1, retention_days=60,
        mc_api_url="", mc_api_token="", agent_id="test",
    )

    with patch("orchestration.checkpoint.checkpoint_manager.asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(CheckpointError):
            await mgr.save_checkpoint("job-7", "ctr-7", SAMPLE_STATE)


@pytest.mark.asyncio
async def test_json_integrity(tmp_path: Path):
    """Loaded checkpoint matches saved checkpoint exactly."""
    mgr = CheckpointManager(config=_cfg(tmp_path))
    mgr._s3.upload_json = AsyncMock(return_value=100)

    result = await mgr.save_checkpoint("job-8", "ctr-8", SAMPLE_STATE)

    # Read back from local
    loaded = json.loads(Path(result.local_path).read_bytes())
    assert loaded["job_id"] == "job-8"
    assert loaded["container_id"] == "ctr-8"
    assert loaded["gpu_model"] == "A100"
    assert loaded["custom_state"] == {"epoch": 5, "loss": 0.42}
    assert loaded["wallet_reserved_halala"] == 10000
