"""Checkpoint configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CheckpointConfig:
    """Immutable checkpoint configuration."""

    s3_bucket: str = field(default_factory=lambda: os.environ.get("DC1_S3_BUCKET", ""))
    s3_region: str = field(default_factory=lambda: os.environ.get("DC1_S3_REGION", "me-south-1"))
    s3_access_key: str = field(default_factory=lambda: os.environ.get("DC1_S3_ACCESS_KEY", ""))
    s3_secret_key: str = field(default_factory=lambda: os.environ.get("DC1_S3_SECRET_KEY", ""))
    s3_endpoint_url: str = field(default_factory=lambda: os.environ.get("DC1_S3_ENDPOINT_URL", ""))
    local_base_path: str = field(default_factory=lambda: os.environ.get("DC1_CHECKPOINT_LOCAL_PATH", "/var/dc1/checkpoints"))
    save_interval_s: int = 3600
    retention_days: int = 60
    mc_api_url: str = field(default_factory=lambda: os.environ.get("DC1_MC_API_URL", ""))
    mc_api_token: str = field(default_factory=lambda: os.environ.get("DC1_MC_TOKEN", ""))
    agent_id: str = field(default_factory=lambda: os.environ.get("DC1_AGENT_ID", "atlas"))

    @classmethod
    def from_env(cls) -> CheckpointConfig:
        """Create config from environment, raising on missing required vars."""
        cfg = cls()
        if not cfg.s3_bucket:
            raise RuntimeError("DC1_S3_BUCKET env var is required")
        if not cfg.s3_access_key or not cfg.s3_secret_key:
            raise RuntimeError("DC1_S3_ACCESS_KEY and DC1_S3_SECRET_KEY env vars are required")
        return cfg
