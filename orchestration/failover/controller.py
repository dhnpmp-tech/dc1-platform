"""DC1 Gate 0 — Failover Controller.

Automatic GPU failover in <60 seconds.
Flow: detect → verify backup → load checkpoint → relaunch → verify → notify.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from typing import Optional

import paramiko
import requests

from .checkpoint import load_checkpoint
from .models import (
    FailoverResult, FailureEvent, FailureType, TestResult,
)

logger = logging.getLogger("dc1.failover.controller")

MC_API = os.getenv("MC_API_URL", "http://76.13.179.86:8084/api")
MC_TOKEN = os.getenv("MC_API_TOKEN", "dc1-mc-gate0-2026")
SSH_TIMEOUT = 5  # seconds
THERMAL_THRESHOLD = 80  # °C
STALL_THRESHOLD_MIN = 30

_headers = lambda: {"Authorization": f"Bearer {MC_TOKEN}", "Content-Type": "application/json"}


def _audit_log(event: str, details: dict):
    """Immutable audit trail via Mission Control."""
    try:
        requests.post(f"{MC_API}/security/audit", json={
            "event_type": event,
            "severity": "high",
            "details": details,
            "source": "failover-controller",
            "timestamp": datetime.utcnow().isoformat(),
        }, headers=_headers(), timeout=5)
    except Exception as e:
        logger.error(f"Audit log failed: {e}")


def _ssh_check(host: str, port: int = 22) -> bool:
    """Quick SSH reachability check."""
    try:
        sock = paramiko.Transport((host, port))
        sock.connect(username="dc1")
        sock.close()
        return True
    except Exception:
        return False


def _get_gpu_temp(gpu_id: str) -> Optional[float]:
    """Query GPU temperature from MC API."""
    try:
        r = requests.get(f"{MC_API}/gpus/{gpu_id}/metrics", headers=_headers(), timeout=5)
        if r.ok:
            return r.json().get("temperature")
    except Exception:
        pass
    return None


def _get_gpu_status(gpu_id: str) -> Optional[dict]:
    """Get GPU status from MC API."""
    try:
        r = requests.get(f"{MC_API}/gpus/{gpu_id}", headers=_headers(), timeout=5)
        if r.ok:
            return r.json()
    except Exception:
        pass
    return None


def _get_job_progress(job_id: str) -> Optional[dict]:
    try:
        r = requests.get(f"{MC_API}/jobs/{job_id}", headers=_headers(), timeout=5)
        if r.ok:
            return r.json()
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Core API
# ---------------------------------------------------------------------------

def detect_failure(gpu_id: str) -> Optional[FailureEvent]:
    """Determine failure type for a GPU."""
    status = _get_gpu_status(gpu_id)

    # No response at all → POWER_LOSS
    if status is None:
        return FailureEvent(gpu_id=gpu_id, failure_type=FailureType.POWER_LOSS,
                            details="No response from GPU/host")

    host = status.get("ssh_host", "")
    if host and not _ssh_check(host):
        return FailureEvent(gpu_id=gpu_id, failure_type=FailureType.NETWORK_LOSS,
                            details=f"SSH unreachable: {host}")

    temp = _get_gpu_temp(gpu_id)
    if temp and temp > THERMAL_THRESHOLD:
        return FailureEvent(gpu_id=gpu_id, failure_type=FailureType.THERMAL,
                            details=f"Temperature {temp}°C > {THERMAL_THRESHOLD}°C")

    # Check for stalled job
    job_id = status.get("current_job_id")
    if job_id:
        progress = _get_job_progress(job_id)
        if progress:
            last_update = progress.get("last_progress_at")
            if last_update:
                elapsed = (datetime.utcnow() - datetime.fromisoformat(last_update)).total_seconds()
                if elapsed > STALL_THRESHOLD_MIN * 60:
                    return FailureEvent(gpu_id=gpu_id, failure_type=FailureType.TIMEOUT,
                                        details=f"No progress for {int(elapsed/60)}m")

    return None


def initiate_failover(job_id: str, failed_gpu: str, backup_gpu: str) -> FailoverResult:
    """Execute failover: verify backup → load checkpoint → relaunch → verify → notify.
    
    Target: <60 seconds total.
    """
    t0 = time.monotonic()

    def _elapsed_ms():
        return int((time.monotonic() - t0) * 1000)

    def _fail(err: str) -> FailoverResult:
        _audit_log("failover_failed", {"job_id": job_id, "error": err, "ms": _elapsed_ms()})
        return FailoverResult(success=False, time_taken_ms=_elapsed_ms(),
                              data_integrity_verified=False, failed_gpu=failed_gpu,
                              backup_gpu=backup_gpu, job_id=job_id, error=err)

    _audit_log("failover_started", {"job_id": job_id, "from": failed_gpu, "to": backup_gpu})

    # Step 1: Verify backup GPU healthy + idle (~2s)
    backup_status = _get_gpu_status(backup_gpu)
    if not backup_status:
        return _fail("Backup GPU unreachable")
    if backup_status.get("current_job_id") and backup_status.get("status") != "idle":
        return _fail("Backup GPU not idle")
    backup_host = backup_status.get("ssh_host", "")
    if backup_host and not _ssh_check(backup_host):
        return _fail("Backup GPU SSH unreachable")

    # Step 2: Load latest checkpoint (~5-10s)
    ckpt = load_checkpoint(job_id)
    ckpt_path = ckpt.nas_path if ckpt else ""
    integrity_ok = ckpt is not None

    # Step 3: Re-launch job on backup GPU (~5s)
    try:
        r = requests.post(f"{MC_API}/jobs/{job_id}/relaunch", json={
            "target_gpu": backup_gpu,
            "checkpoint_path": ckpt_path,
        }, headers=_headers(), timeout=15)
        if not r.ok:
            return _fail(f"Relaunch API error: {r.status_code}")
    except Exception as e:
        return _fail(f"Relaunch request failed: {e}")

    # Step 4: Verify job running on backup (~5s polling)
    for _ in range(10):
        time.sleep(0.5)
        progress = _get_job_progress(job_id)
        if progress and progress.get("gpu_id") == backup_gpu and progress.get("status") == "running":
            break
    else:
        return _fail("Job not confirmed running on backup")

    elapsed = _elapsed_ms()

    # Step 5: Notify renter
    minutes = max(1, elapsed // 60000)
    try:
        requests.post(f"{MC_API}/jobs/{job_id}/notify", json={
            "message": f"Brief interruption ({minutes}m), job resumed on backup hardware.",
        }, headers=_headers(), timeout=5)
    except Exception:
        logger.warning("Renter notification failed (non-critical)")

    result = FailoverResult(
        success=True, time_taken_ms=elapsed,
        data_integrity_verified=integrity_ok,
        failed_gpu=failed_gpu, backup_gpu=backup_gpu,
        job_id=job_id, checkpoint_used=ckpt_path,
    )
    _audit_log("failover_complete", {
        "job_id": job_id, "ms": elapsed, "integrity": integrity_ok,
    })
    return result


def test_failover(primary_gpu: str, backup_gpu: str) -> TestResult:
    """Monthly validation: simulate primary failure, verify backup takes over."""
    _audit_log("failover_test_started", {"primary": primary_gpu, "backup": backup_gpu})

    # Create a test job via MC API
    try:
        r = requests.post(f"{MC_API}/jobs", json={
            "type": "failover_test",
            "gpu_id": primary_gpu,
            "test": True,
        }, headers=_headers(), timeout=10)
        if not r.ok:
            return TestResult(success=False, failover_time_ms=0, data_loss=0,
                              notes=f"Could not create test job: {r.status_code}")
        test_job_id = r.json().get("id", "test-job")
    except Exception as e:
        return TestResult(success=False, failover_time_ms=0, data_loss=0, notes=str(e))

    # Execute failover
    result = initiate_failover(test_job_id, primary_gpu, backup_gpu)

    # Cleanup test job
    try:
        requests.delete(f"{MC_API}/jobs/{test_job_id}", headers=_headers(), timeout=5)
    except Exception:
        pass

    _audit_log("failover_test_complete", {
        "success": result.success, "ms": result.time_taken_ms,
    })

    return TestResult(
        success=result.success,
        failover_time_ms=result.time_taken_ms,
        data_loss=0 if result.data_integrity_verified else -1,
        notes=result.error or "OK",
    )
