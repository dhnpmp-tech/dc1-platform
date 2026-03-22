"""Alert router â severity-based routing to Telegram, MC API, and logs."""
from __future__ import annotations

import asyncio
import enum
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import aiohttp

from .config import NexusConfig

logger = logging.getLogger("nexus.alerts")

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
GROUP_CHAT_ID = "-5275672778"
PETER_CHAT_ID = "7652446182"


class Severity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Alert:
    severity: Severity
    source_agent: str
    title: str
    message: str
    metadata: dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ts: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AlertRouter:
    def __init__(self, config: NexusConfig) -> None:
        if not config.telegram_bot_token:
            raise RuntimeError("DC1_TELEGRAM_BOT_TOKEN is required")
        if not config.mc_api_token:
            raise RuntimeError("DC1_MC_TOKEN is required")
        self._config = config
        self._rate_cache: dict[tuple[str, str], float] = {}
        self._batch: list[Alert] = []
        self._batch_task: asyncio.Task[None] | None = None

    # --- Rate limiting ---

    def _is_rate_limited(self, alert: Alert) -> bool:
        key = (alert.source_agent, alert.title)
        last = self._rate_cache.get(key, 0.0)
        now = time.time()
        if now - last < 600:  # 10 min
            return True
        self._rate_cache[key] = now
        return False

    # --- Routing ---

    async def route(self, alert: Alert) -> None:
        logger.info("Alert [%s] %s: %s â %s", alert.severity.value, alert.source_agent, alert.title, alert.message)

        if alert.severity == Severity.CRITICAL:
            # Critical: immediate, bypass rate limit
            await self._send_telegram(alert, PETER_CHAT_ID)
            await self._send_telegram(alert, GROUP_CHAT_ID)
            await self._send_mc_api(alert)
            return

        if self._is_rate_limited(alert):
            logger.info("Rate-limited: %s/%s", alert.source_agent, alert.title)
            return

        if alert.severity == Severity.LOW:
            self._batch.append(alert)
            self._ensure_batch_task()
            return

        if alert.severity == Severity.MEDIUM:
            await self._send_mc_api(alert)
            return

        if alert.severity == Severity.HIGH:
            await self._send_telegram(alert, GROUP_CHAT_ID)
            await self._send_mc_api(alert)

    # --- Batching ---

    def _ensure_batch_task(self) -> None:
        if self._batch_task is None or self._batch_task.done():
            self._batch_task = asyncio.create_task(self._flush_batch_loop())

    async def _flush_batch_loop(self) -> None:
        await asyncio.sleep(1800)  # 30 min
        await self.flush_batch()

    async def flush_batch(self) -> None:
        if not self._batch:
            return
        batch = self._batch[:]
        self._batch.clear()
        summary = f"ð Batched alerts ({len(batch)}):\n"
        for a in batch:
            summary += f"â¢ [{a.severity.value.upper()}] {a.source_agent}: {a.title}\n"
        logger.info(summary)
        # Send batch summary to MC API so the team actually sees it
        batch_alert = Alert(
            severity=Severity.MEDIUM,
            source_agent="NEXUS",
            title=f"Batch Summary ({len(batch)} alerts)",
            message=summary,
        )
        await self._send_mc_api(batch_alert)

    # --- Telegram ---

    async def _send_telegram(self, alert: Alert, chat_id: str) -> None:
        if alert.severity == Severity.CRITICAL:
            text = f"ð´ CRITICAL â [{alert.source_agent}] {alert.title}\n{alert.message}"
        else:
            text = f"â ï¸ [{alert.source_agent}] {alert.title}\n{alert.message}"
        url = TELEGRAM_API.format(token=self._config.telegram_bot_token)
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
        except Exception:
            logger.exception("Failed to send Telegram alert to %s", chat_id)

    # --- MC API ---

    async def _send_mc_api(self, alert: Alert) -> None:
        url = f"{self._config.mc_api_url}/alerts"
        payload = {
            "agent_id": self._config.agent_id,
            "level": alert.severity.value,
            "message": f"[{alert.source_agent}] {alert.title}: {alert.message}",
            "metadata": alert.metadata,
        }
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(
                    url,
                    json=payload,
                    headers={"Authorization": f"Bearer {self._config.mc_api_token}"},
                )
        except Exception:
            logger.exception("Failed to send MC API alert")
