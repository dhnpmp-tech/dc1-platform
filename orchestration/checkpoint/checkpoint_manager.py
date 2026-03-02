"""Core checkpoint manager — save / load / delete / schedule."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Coroutine

from .config import CheckpointConfig
from .s3_client import S3Client

logger = logging.getLogger("dc1.checkpoint")


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class CheckpointError(Exception):
    """Raised when both S3 and local persistence fail."""


@dataclass
class CheckpointResult:
    s3_key: str | None
    local_path: str | None
    size_bytes: int
    duration_ms: float


@dataclass
class CheckpointMeta:
    timestamp: str
    size_bytes: int
    location: str  # "s3", "local", or "both"
    s3_key: str | None = None
    local_path: str | None = None


# ---------------------------------------------------------------------------
# Manager
# ---------------------------------------------------------------------------

class CheckpointManager:
    """Async checkpoint manager with S3 + local NAS dual-write."""

    S3_RETRY_DELAYS = [1, 2, 4]  # seconds

    def __init__(self, config: CheckpointConfig | None = None) -> None:
        self._config = config or CheckpointConfig.from_env()
        self._s3 = S3Client(self._config)
        self._schedulers: dict[str, asyncio.Task[None]] = {}

    # -- helpers --------------------------------------------------------------

    @staticmethod
    def _ts() -> str:
        return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def _local_dir(self, job_id: str) -> Path:
        return Path(self._config.local_base_path) / job_id

    @staticmethod
    def _atomic_write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            os.write(fd, data)
            os.fsync(fd)
            os.close(fd)
            fd = -1  # mark as closed
            os.rename(tmp, path)
        except BaseException:
            if fd >= 0:
                try:
                    os.close(fd)
                except OSError:
                    pass
            if os.path.exists(tmp):
                os.unlink(tmp)
            raise

    async def _s3_upload_with_retry(self, key: str, data: dict[str, Any]) -> int | None:
        """Upload to S3 with retry. Returns size or None on total failure."""
        last_exc: Exception | None = None
        for attempt, delay in enumerate(self.S3_RETRY_DELAYS):
            try:
                return await self._s3.upload_json(key, data)
            except Exception as exc:
                last_exc = exc
                logger.warning("S3 upload attempt %d failed: %s", attempt + 1, exc)
                if attempt < len(self.S3_RETRY_DELAYS) - 1:
                    await asyncio.sleep(delay)
        logger.error("S3 upload failed after %d retries: %s", len(self.S3_RETRY_DELAYS), last_exc)
        return None

    async def _mc_heartbeat(self, job_id: str, message: str) -> None:
        """Best-effort heartbeat to Mission Control API."""
        if not self._config.mc_api_url:
            return
        try:
            import aiohttp
            url = f"{self._config.mc_api_url.rstrip('/')}/heartbeat"
            payload = {
                "agent_id": self._config.agent_id,
                "job_id": job_id,
                "message": message,
                "ts": self._ts(),
            }
            headers = {"Authorization": f"Bearer {self._config.mc_api_token}"}
            async with aiohttp.ClientSession() as sess:
                async with sess.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5)):
                    pass
        except Exception as exc:
            logger.debug("MC heartbeat failed (non-fatal): %s", exc)

    # -- public API -----------------------------------------------------------

    async def save_checkpoint(
        self,
        job_id: str,
        container_id: str,
        checkpoint_data: dict[str, Any],
    ) -> CheckpointResult:
        """Save checkpoint to S3 + local NAS. Raises CheckpointError if both fail."""
        t0 = time.monotonic()
        ts = self._ts()
        s3_key = f"checkpoints/{job_id}/{ts}.json"
        local_path = self._local_dir(job_id) / f"{ts}.json"

        payload: dict[str, Any] = {
            "job_id": job_id,
            "container_id": container_id,
            "saved_at": ts,
            **checkpoint_data,
        }
        body = json.dumps(payload, default=str, ensure_ascii=False).encode()

        # S3
        s3_ok = await self._s3_upload_with_retry(s3_key, payload)

        # Local
        local_ok = True
        try:
            await asyncio.to_thread(self._atomic_write, local_path, body)
        except Exception as exc:
            logger.error("Local write failed: %s", exc)
            local_ok = False

        if s3_ok is None and not local_ok:
            raise CheckpointError(f"Both S3 and local write failed for job {job_id}")

        duration_ms = (time.monotonic() - t0) * 1000
        result = CheckpointResult(
            s3_key=s3_key if s3_ok is not None else None,
            local_path=str(local_path) if local_ok else None,
            size_bytes=len(body),
            duration_ms=round(duration_ms, 2),
        )
        logger.info("Checkpoint saved for job %s (%d bytes, %.1fms)", job_id, len(body), duration_ms)
        return result

    async def load_checkpoint(self, job_id: str) -> dict[str, Any] | None:
        """Load the latest checkpoint. Tries S3 first, falls back to local."""
        # Try S3
        try:
            keys = await self._s3.list_keys(f"checkpoints/{job_id}/")
            if keys:
                latest = sorted(keys, key=lambda k: k["key"])[-1]
                return await self._s3.download_json(latest["key"])
        except Exception as exc:
            logger.warning("S3 load failed, trying local: %s", exc)

        # Fallback: local
        local_dir = self._local_dir(job_id)
        if not local_dir.exists():
            return None
        files = sorted(local_dir.glob("*.json"))
        if not files:
            return None
        return json.loads(files[-1].read_bytes())

    async def delete_checkpoints(self, job_id: str) -> None:
        """Remove all checkpoints for a job from S3 and local."""
        try:
            await self._s3.delete_prefix(f"checkpoints/{job_id}/")
        except Exception as exc:
            logger.warning("S3 delete failed: %s", exc)

        local_dir = self._local_dir(job_id)
        if local_dir.exists():
            await asyncio.to_thread(shutil.rmtree, local_dir, ignore_errors=True)
        logger.info("Checkpoints deleted for job %s", job_id)

    async def list_checkpoints(self, job_id: str) -> list[CheckpointMeta]:
        """List checkpoint metadata from both S3 and local."""
        results: dict[str, CheckpointMeta] = {}

        # S3
        try:
            for item in await self._s3.list_keys(f"checkpoints/{job_id}/"):
                ts = item["key"].rsplit("/", 1)[-1].replace(".json", "")
                results[ts] = CheckpointMeta(
                    timestamp=ts, size_bytes=item["size"],
                    location="s3", s3_key=item["key"],
                )
        except Exception as exc:
            logger.warning("S3 list failed: %s", exc)

        # Local
        local_dir = self._local_dir(job_id)
        if local_dir.exists():
            for f in local_dir.glob("*.json"):
                ts = f.stem
                if ts in results:
                    results[ts].location = "both"
                    results[ts].local_path = str(f)
                else:
                    results[ts] = CheckpointMeta(
                        timestamp=ts, size_bytes=f.stat().st_size,
                        location="local", local_path=str(f),
                    )

        return sorted(results.values(), key=lambda m: m.timestamp)

    async def start_hourly_scheduler(
        self,
        job_id: str,
        container_id: str,
        state_fn: Callable[[], Coroutine[Any, Any, dict[str, Any]]],
    ) -> asyncio.Task[None]:
        """Start an async loop that checkpoints every hour. Returns the task."""

        async def _loop() -> None:
            while True:
                await asyncio.sleep(self._config.save_interval_s)
                try:
                    state = await state_fn()
                    result = await self.save_checkpoint(job_id, container_id, state)
                    await self._mc_heartbeat(job_id, f"checkpoint saved: {result.size_bytes}B")
                except CheckpointError:
                    logger.critical("Both stores failed for %s — job should be paused", job_id)
                    raise
                except asyncio.CancelledError:
                    logger.info("Scheduler cancelled for job %s", job_id)
                    raise
                except Exception as exc:
                    logger.error("Scheduler error for %s: %s", job_id, exc)

        task = asyncio.create_task(_loop(), name=f"checkpoint-{job_id}")
        self._schedulers[job_id] = task
        logger.info("Hourly scheduler started for job %s", job_id)
        return task
