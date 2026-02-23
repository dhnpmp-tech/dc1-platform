"""DC1 Gate 0 — Recovery Orchestrator.

State machine: RUNNING → INTERRUPTION_DETECTED → RECONNECTING → FAILING_OVER → ESCALATING → RESOLVED/FAILED

Exponential backoff reconnect: 1s, 2s, 4s, 8s, 16s (~31s total).
If reconnect fails → failover to backup GPU.
If backup fails → escalate to human (Peter via Telegram + MC CRITICAL).
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import paramiko
import requests

from .controller import initiate_failover, _ssh_check, _get_gpu_status, _audit_log
from .models import RecoveryContext, RecoveryState

logger = logging.getLogger("dc1.failover.recovery")

MC_API = os.getenv("MC_API_URL", "http://76.13.179.86:8084/api")
MC_TOKEN = os.getenv("MC_API_TOKEN", "dc1-mc-gate0-2026")
TELEGRAM_GROUP = os.getenv("DC1_TELEGRAM_GROUP", "-5275672778")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ESCALATION_TIMEOUT_S = 600  # 10 minutes

# Gate 0 GPU mapping
GPU_BACKUP_MAP = {
    "pc1-rtx3090": "pc1-rtx3060",
    "pc1-rtx3060": "pc1-rtx3090",  # reverse fallback
}

BACKOFF_DELAYS = [1, 2, 4, 8, 16]  # total ~31s

_headers = lambda: {"Authorization": f"Bearer {MC_TOKEN}", "Content-Type": "application/json"}


def _log_transition(ctx: RecoveryContext, old: RecoveryState, new: RecoveryState, details: str = ""):
    """Log every state transition to MC audit trail."""
    ctx.state = new
    _audit_log("recovery_state_transition", {
        "job_id": ctx.job_id, "gpu_id": ctx.gpu_id,
        "from": old.value, "to": new.value,
        "attempt": ctx.reconnect_attempts, "details": details,
    })
    logger.info(f"Recovery [{ctx.job_id}]: {old.value} → {new.value} | {details}")


class RecoveryOrchestrator:
    """Intelligent retry/failover/escalate state machine."""

    def handle_interruption(self, job_id: str, gpu_id: str, interrupt_type: str) -> RecoveryContext:
        """Main entry point for handling a GPU interruption."""
        ctx = RecoveryContext(job_id=job_id, gpu_id=gpu_id, interrupt_type=interrupt_type)
        _log_transition(ctx, RecoveryState.RUNNING, RecoveryState.INTERRUPTION_DETECTED,
                        f"type={interrupt_type}")

        # Attempt reconnect with exponential backoff
        _log_transition(ctx, RecoveryState.INTERRUPTION_DETECTED, RecoveryState.RECONNECTING)

        for attempt, delay in enumerate(BACKOFF_DELAYS, 1):
            ctx.reconnect_attempts = attempt
            time.sleep(delay)
            if self._attempt_reconnect(gpu_id, attempt):
                _log_transition(ctx, RecoveryState.RECONNECTING, RecoveryState.RUNNING,
                                f"Reconnected after {attempt} attempts")
                ctx.resolved_at = datetime.utcnow()
                ctx.state = RecoveryState.RESOLVED
                return ctx

        # Reconnect exhausted → failover
        _log_transition(ctx, RecoveryState.RECONNECTING, RecoveryState.FAILING_OVER,
                        "5 retries exhausted")

        backup_gpu = GPU_BACKUP_MAP.get(gpu_id)
        if backup_gpu and self._trigger_failover(job_id, gpu_id, backup_gpu):
            _log_transition(ctx, RecoveryState.FAILING_OVER, RecoveryState.RUNNING,
                            f"Failover to {backup_gpu} succeeded")
            ctx.resolved_at = datetime.utcnow()
            ctx.state = RecoveryState.RESOLVED
            return ctx

        # Failover failed → escalate
        ctx.failover_attempted = True
        _log_transition(ctx, RecoveryState.FAILING_OVER, RecoveryState.ESCALATING,
                        "Backup GPU also unavailable")

        self._escalate_to_human(job_id, gpu_id,
                                f"Primary {gpu_id} down, backup {backup_gpu or 'N/A'} also unavailable. "
                                f"Type: {interrupt_type}")

        # Wait for manual resolution (up to 10 min)
        deadline = time.monotonic() + ESCALATION_TIMEOUT_S
        while time.monotonic() < deadline:
            time.sleep(30)
            # Check if job was manually resolved
            try:
                r = requests.get(f"{MC_API}/jobs/{job_id}", headers=_headers(), timeout=5)
                if r.ok and r.json().get("status") == "running":
                    _log_transition(ctx, RecoveryState.ESCALATING, RecoveryState.RESOLVED,
                                    "Manual intervention succeeded")
                    ctx.resolved_at = datetime.utcnow()
                    return ctx
            except Exception:
                pass

        _log_transition(ctx, RecoveryState.ESCALATING, RecoveryState.FAILED,
                        "Timeout exceeded (10 min)")
        return ctx

    def _attempt_reconnect(self, gpu_id: str, attempt: int) -> bool:
        """SSH reconnect attempt."""
        status = _get_gpu_status(gpu_id)
        if not status:
            logger.debug(f"Reconnect attempt {attempt}: GPU {gpu_id} status unavailable")
            return False
        host = status.get("ssh_host", "")
        if not host:
            return False
        ok = _ssh_check(host)
        logger.debug(f"Reconnect attempt {attempt}: SSH {'OK' if ok else 'FAIL'} for {host}")
        return ok

    def _trigger_failover(self, job_id: str, primary: str, backup: str) -> bool:
        """Call failover controller."""
        result = initiate_failover(job_id, primary, backup)
        return result.success

    def _escalate_to_human(self, job_id: str, gpu_id: str, reason: str):
        """Telegram alert to Peter + Mission Control CRITICAL event."""
        msg = f"🔴 DC1 CRITICAL: Job {job_id} needs manual intervention. {reason}. GPU: {gpu_id}"

        # Telegram
        if TELEGRAM_BOT_TOKEN:
            try:
                requests.post(
                    f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={"chat_id": TELEGRAM_GROUP, "text": msg, "parse_mode": "HTML"},
                    timeout=10,
                )
            except Exception as e:
                logger.error(f"Telegram alert failed: {e}")

        # Mission Control CRITICAL
        _audit_log("escalation_critical", {
            "job_id": job_id, "gpu_id": gpu_id, "reason": reason,
            "severity": "critical",
        })
        logger.critical(msg)

    def _verify_data_integrity(self, job_id: str, checkpoint_path: str) -> bool:
        """Checksum verification of checkpoint file."""
        try:
            p = Path(checkpoint_path)
            if not p.exists():
                return False
            data = p.read_bytes()
            checksum = hashlib.sha256(data).hexdigest()
            # Verify against stored meta
            meta_path = p.parent / "meta.json"
            if meta_path.exists():
                import json
                meta = json.loads(meta_path.read_text())
                for entry in meta:
                    if entry.get("nas_path") == str(p):
                        return entry.get("checksum") == checksum
            return True  # No meta to verify against, trust the file
        except Exception as e:
            logger.error(f"Integrity check failed: {e}")
            return False
