"""NEXUS configuration — all secrets from env vars."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class NexusConfig:
    mc_api_url: str
    mc_api_token: str
    telegram_bot_token: str
    heartbeat_port: int = 8086
    heartbeat_db_path: str = "data/heartbeats.db"
    agent_id: str = "37c0fd6b"

    @classmethod
    def from_env(cls) -> NexusConfig:
        mc_token = os.environ.get("DC1_MC_TOKEN", "")
        tg_token = os.environ.get("DC1_TELEGRAM_BOT_TOKEN", "")
        if not mc_token:
            raise RuntimeError("DC1_MC_TOKEN env var is required")
        if not tg_token:
            raise RuntimeError("DC1_TELEGRAM_BOT_TOKEN env var is required")
        return cls(
            mc_api_url=os.environ.get("DC1_MC_API_URL", "http://localhost:8080"),
            mc_api_token=mc_token,
            telegram_bot_token=tg_token,
            heartbeat_port=int(os.environ.get("DC1_HEARTBEAT_PORT", "8086")),
            heartbeat_db_path=os.environ.get("DC1_HEARTBEAT_DB", "data/heartbeats.db"),
            agent_id=os.environ.get("DC1_AGENT_ID", "37c0fd6b"),
        )
