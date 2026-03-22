"""
DC1 Health Check Daemon — Configuration
Loads from environment variables with sensible defaults.
"""

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    """Immutable configuration for the health check daemon."""

    # SSH connection
    gpu_ssh_host: str = field(default_factory=lambda: os.getenv("GPU_SSH_HOST", ""))
    gpu_ssh_user: str = field(default_factory=lambda: os.getenv("GPU_SSH_USER", "dc1"))
    gpu_ssh_key_path: str = field(default_factory=lambda: os.getenv("GPU_SSH_KEY_PATH", "~/.ssh/id_rsa"))
    gpu_id: str = field(default_factory=lambda: os.getenv("GPU_ID", "pc1-rtx3090"))

    # Timing
    check_interval_seconds: int = int(os.getenv("CHECK_INTERVAL_SECONDS", "30"))
    ssh_timeout_seconds: int = int(os.getenv("SSH_TIMEOUT_SECONDS", "10"))

    # Alert thresholds
    temp_alert_threshold: int = int(os.getenv("TEMP_ALERT_THRESHOLD", "80"))
    latency_alert_ms: int = int(os.getenv("LATENCY_ALERT_MS", "2000"))

    # Mission Control API
    mc_api_base: str = os.getenv("MC_API_BASE", "http://76.13.179.86:8084/api")
    mc_api_token: str = os.getenv("MC_API_TOKEN", "dc1-mc-gate0-2026")

    # Telegram alerts
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_group_id: str = os.getenv("TELEGRAM_GROUP_ID", "-5275672778")

    # Logging
    log_retention_days: int = int(os.getenv("LOG_RETENTION_DAYS", "7"))
    log_dir: str = os.getenv("LOG_DIR", "orchestration/healthcheck/logs")

    # Backoff
    max_retries: int = 5
    initial_backoff_s: float = 1.0
