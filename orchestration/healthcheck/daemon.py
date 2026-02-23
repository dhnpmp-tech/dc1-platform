#!/usr/bin/env python3
"""
DC1 GPU Health Check Daemon
============================
Continuously monitors GPU providers via SSH every 30 seconds.
Reports metrics to Mission Control and sends Telegram alerts for anomalies.

Usage:
    python daemon.py              # Run with .env or environment variables
    GPU_SSH_HOST=x python daemon.py  # Inline config

Signals:
    SIGTERM / SIGINT → graceful shutdown
"""

import json
import logging
import os
import signal
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from typing import Optional

import paramiko
import requests

from config import Config


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class GPUMetrics:
    """Parsed GPU metrics from nvidia-smi."""
    temperature_c: Optional[int] = None
    utilization_pct: Optional[int] = None
    memory_used_mb: Optional[int] = None
    memory_total_mb: Optional[int] = None
    power_draw_w: Optional[float] = None
    ssh_latency_ms: Optional[int] = None
    online: bool = False
    error: Optional[str] = None
    timestamp: str = ""


@dataclass
class Alert:
    level: str  # "HIGH" or "CRITICAL"
    message: str
    gpu_id: str
    timestamp: str


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

def setup_logging(cfg: Config) -> logging.Logger:
    """Configure rotating file + console logger."""
    log_dir = Path(cfg.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("dc1-healthcheck")
    logger.setLevel(logging.DEBUG)

    # Rotating file handler — one file per day, keep N days
    fh = TimedRotatingFileHandler(
        log_dir / "daemon.log",
        when="midnight",
        backupCount=cfg.log_retention_days,
        utc=True,
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

    # Console handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger


# ---------------------------------------------------------------------------
# SSH metrics collection
# ---------------------------------------------------------------------------

def collect_metrics(cfg: Config, logger: logging.Logger) -> GPUMetrics:
    """Connect to the GPU provider via SSH and collect nvidia-smi metrics."""
    metrics = GPUMetrics(timestamp=datetime.now(timezone.utc).isoformat())

    client = paramiko.SSHClient()
    # C1 FIX: Use known_hosts validation — never blindly accept host keys (MITM risk).
    # On first connection, run: ssh-keyscan <GPU_SSH_HOST> >> ~/.ssh/known_hosts
    # Set GPU_SSH_KNOWN_HOSTS env var to point to the known_hosts file if non-default.
    known_hosts_path = os.path.expanduser(os.getenv("GPU_SSH_KNOWN_HOSTS", "~/.ssh/known_hosts"))
    if os.path.exists(known_hosts_path):
        client.load_host_keys(known_hosts_path)
    client.set_missing_host_key_policy(paramiko.RejectPolicy())

    t0 = time.monotonic()
    try:
        client.connect(
            hostname=cfg.gpu_ssh_host,
            username=cfg.gpu_ssh_user,
            key_filename=os.path.expanduser(cfg.gpu_ssh_key_path),
            timeout=cfg.ssh_timeout_seconds,
        )
        latency_ms = int((time.monotonic() - t0) * 1000)
        metrics.ssh_latency_ms = latency_ms
        metrics.online = True

        # Single nvidia-smi call for all metrics
        cmd = (
            "nvidia-smi --query-gpu=temperature.gpu,utilization.gpu,"
            "memory.used,memory.total,power.draw --format=csv,noheader,nounits"
        )
        _, stdout, stderr = client.exec_command(cmd, timeout=cfg.ssh_timeout_seconds)
        output = stdout.read().decode().strip()
        err = stderr.read().decode().strip()

        if err:
            logger.warning("nvidia-smi stderr: %s", err)

        if output:
            # Parse: "45, 12, 1024, 24576, 120.50"
            parts = [p.strip() for p in output.split(",")]
            if len(parts) >= 5:
                metrics.temperature_c = int(parts[0])
                metrics.utilization_pct = int(parts[1])
                metrics.memory_used_mb = int(parts[2])
                metrics.memory_total_mb = int(parts[3])
                metrics.power_draw_w = float(parts[4])
        else:
            metrics.error = "nvidia-smi returned empty output"

        # Check for memory errors
        _, stdout2, _ = client.exec_command(
            "nvidia-smi --query-gpu=ecc.errors.corrected.volatile.total "
            "--format=csv,noheader,nounits 2>/dev/null || echo N/A",
            timeout=cfg.ssh_timeout_seconds,
        )
        ecc_out = stdout2.read().decode().strip()
        if ecc_out not in ("0", "N/A", ""):
            metrics.error = f"Memory ECC errors detected: {ecc_out}"

    except Exception as e:
        metrics.online = False
        metrics.ssh_latency_ms = int((time.monotonic() - t0) * 1000)
        metrics.error = str(e)
    finally:
        client.close()

    return metrics


# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------

def evaluate_alerts(metrics: GPUMetrics, cfg: Config) -> list[Alert]:
    """Check metrics against thresholds and return any alerts."""
    alerts: list[Alert] = []
    ts = metrics.timestamp

    if not metrics.online:
        alerts.append(Alert("CRITICAL", f"GPU {cfg.gpu_id} OFFLINE: {metrics.error}", cfg.gpu_id, ts))
        return alerts

    if metrics.temperature_c is not None and metrics.temperature_c > cfg.temp_alert_threshold:
        alerts.append(Alert("HIGH", f"GPU temp {metrics.temperature_c}°C > {cfg.temp_alert_threshold}°C", cfg.gpu_id, ts))

    if metrics.ssh_latency_ms is not None and metrics.ssh_latency_ms > cfg.latency_alert_ms:
        alerts.append(Alert("HIGH", f"SSH latency {metrics.ssh_latency_ms}ms > {cfg.latency_alert_ms}ms", cfg.gpu_id, ts))

    if metrics.error and "ECC" in metrics.error:
        alerts.append(Alert("HIGH", f"Memory errors: {metrics.error}", cfg.gpu_id, ts))

    return alerts


def send_telegram_alert(alert: Alert, cfg: Config, logger: logging.Logger) -> None:
    """Send alert to Telegram group via Bot API."""
    if not cfg.telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — skipping Telegram alert")
        return

    emoji = "🔴" if alert.level == "CRITICAL" else "🟠"
    text = f"{emoji} *DC1 GPU Alert [{alert.level}]*\n`{alert.gpu_id}`: {alert.message}"

    try:
        requests.post(
            f"https://api.telegram.org/bot{cfg.telegram_bot_token}/sendMessage",
            json={"chat_id": cfg.telegram_group_id, "text": text, "parse_mode": "Markdown"},
            timeout=10,
        )
    except Exception as e:
        logger.error("Telegram send failed: %s", e)


def report_to_mc(metrics: GPUMetrics, alerts: list[Alert], cfg: Config, logger: logging.Logger) -> None:
    """POST metrics + alerts to Mission Control API."""
    headers = {"Authorization": f"Bearer {cfg.mc_api_token}", "Content-Type": "application/json"}

    # Report healthcheck
    try:
        payload = {
            "gpu_id": cfg.gpu_id,
            "online": metrics.online,
            "temperature_c": metrics.temperature_c,
            "utilization_pct": metrics.utilization_pct,
            "memory_used_mb": metrics.memory_used_mb,
            "memory_total_mb": metrics.memory_total_mb,
            "power_draw_w": metrics.power_draw_w,
            "ssh_latency_ms": metrics.ssh_latency_ms,
            "error": metrics.error,
            "checked_at": metrics.timestamp,
        }
        requests.post(
            f"{cfg.mc_api_base}/gpu/{cfg.gpu_id}/healthcheck",
            json=payload, headers=headers, timeout=10,
        )
    except Exception as e:
        logger.error("MC healthcheck report failed: %s", e)

    # Report alerts to security/audit endpoint
    for alert in alerts:
        try:
            requests.post(
                f"{cfg.mc_api_base}/security/audit",
                json={"level": alert.level, "source": "healthcheck-daemon",
                      "message": alert.message, "gpu_id": alert.gpu_id,
                      "timestamp": alert.timestamp},
                headers=headers, timeout=10,
            )
        except Exception as e:
            logger.error("MC audit report failed: %s", e)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

class Daemon:
    """Health check daemon with graceful shutdown and exponential backoff."""

    def __init__(self, cfg: Config, logger: logging.Logger) -> None:
        self.cfg = cfg
        self.logger = logger
        self._running = True
        self._consecutive_failures = 0

        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)

    def _handle_signal(self, signum: int, frame) -> None:  # type: ignore[override]
        self.logger.info("Received signal %d — shutting down gracefully", signum)
        self._running = False

    def run(self) -> None:
        """Main daemon loop."""
        self.logger.info("DC1 Health Check Daemon starting — GPU: %s, host: %s, interval: %ds",
                         self.cfg.gpu_id, self.cfg.gpu_ssh_host, self.cfg.check_interval_seconds)

        if not self.cfg.gpu_ssh_host:
            self.logger.error("GPU_SSH_HOST not set — exiting")
            sys.exit(1)

        while self._running:
            cycle_start = time.monotonic()

            metrics = collect_metrics(self.cfg, self.logger)

            if metrics.online:
                self._consecutive_failures = 0
                self.logger.info(
                    "✅ %s | temp=%s°C util=%s%% mem=%s/%sMB power=%sW latency=%sms",
                    self.cfg.gpu_id, metrics.temperature_c, metrics.utilization_pct,
                    metrics.memory_used_mb, metrics.memory_total_mb,
                    metrics.power_draw_w, metrics.ssh_latency_ms,
                )
            else:
                self._consecutive_failures += 1
                self.logger.warning("❌ %s OFFLINE (attempt %d/%d): %s",
                                    self.cfg.gpu_id, self._consecutive_failures,
                                    self.cfg.max_retries, metrics.error)

                # Exponential backoff retry
                if self._consecutive_failures < self.cfg.max_retries:
                    backoff = self.cfg.initial_backoff_s * (2 ** (self._consecutive_failures - 1))
                    self.logger.info("Retrying in %.1fs...", backoff)
                    time.sleep(backoff)
                    continue  # Skip normal interval, retry immediately after backoff

            # Evaluate alerts (CRITICAL only after max retries exhausted)
            alerts = evaluate_alerts(metrics, self.cfg)
            if not metrics.online and self._consecutive_failures < self.cfg.max_retries:
                alerts = []  # Suppress alerts during backoff retries

            # Report and alert
            report_to_mc(metrics, alerts, self.cfg, self.logger)
            for alert in alerts:
                self.logger.warning("🚨 ALERT [%s]: %s", alert.level, alert.message)
                send_telegram_alert(alert, self.cfg, self.logger)

            # Sleep remainder of interval
            elapsed = time.monotonic() - cycle_start
            sleep_time = max(0, self.cfg.check_interval_seconds - elapsed)
            if self._running and sleep_time > 0:
                time.sleep(sleep_time)

        self.logger.info("Daemon stopped.")


def main() -> None:
    cfg = Config()
    logger = setup_logging(cfg)
    daemon = Daemon(cfg, logger)
    daemon.run()


if __name__ == "__main__":
    main()
