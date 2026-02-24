"""Tests for AlertRouter."""
from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from orchestration.nexus.alert_router import (
    GROUP_CHAT_ID,
    PETER_CHAT_ID,
    Alert,
    AlertRouter,
    Severity,
)
from orchestration.nexus.config import NexusConfig

FAKE_CONFIG = NexusConfig(
    mc_api_url="http://localhost:9999",
    mc_api_token="test-mc",
    telegram_bot_token="fake-tg",
    agent_id="37c0fd6b",
)


@pytest.fixture
def router():
    return AlertRouter(FAKE_CONFIG)


def _alert(severity: Severity = Severity.LOW, agent: str = "NEXUS", title: str = "test") -> Alert:
    return Alert(severity=severity, source_agent=agent, title=title, message="details")


# --- Routing tests ---

@pytest.mark.asyncio
async def test_low_not_sent_to_telegram(router):
    with patch.object(router, "_send_telegram", new_callable=AsyncMock) as tg, \
         patch.object(router, "_send_mc_api", new_callable=AsyncMock):
        await router.route(_alert(Severity.LOW))
        tg.assert_not_called()


@pytest.mark.asyncio
async def test_medium_sent_to_mc_not_telegram(router):
    with patch.object(router, "_send_telegram", new_callable=AsyncMock) as tg, \
         patch.object(router, "_send_mc_api", new_callable=AsyncMock) as mc:
        await router.route(_alert(Severity.MEDIUM))
        tg.assert_not_called()
        mc.assert_called_once()


@pytest.mark.asyncio
async def test_high_sent_to_telegram_group_and_mc(router):
    with patch.object(router, "_send_telegram", new_callable=AsyncMock) as tg, \
         patch.object(router, "_send_mc_api", new_callable=AsyncMock) as mc:
        await router.route(_alert(Severity.HIGH))
        tg.assert_called_once()
        assert tg.call_args[0][1] == GROUP_CHAT_ID
        mc.assert_called_once()


@pytest.mark.asyncio
async def test_critical_sent_to_peter_dm_and_group_and_mc(router):
    with patch.object(router, "_send_telegram", new_callable=AsyncMock) as tg, \
         patch.object(router, "_send_mc_api", new_callable=AsyncMock) as mc:
        await router.route(_alert(Severity.CRITICAL))
        assert tg.call_count == 2
        chat_ids = {call[0][1] for call in tg.call_args_list}
        assert PETER_CHAT_ID in chat_ids
        assert GROUP_CHAT_ID in chat_ids
        mc.assert_called_once()


@pytest.mark.asyncio
async def test_rate_limiter_suppresses_duplicate(router):
    with patch.object(router, "_send_telegram", new_callable=AsyncMock) as tg, \
         patch.object(router, "_send_mc_api", new_callable=AsyncMock) as mc:
        await router.route(_alert(Severity.HIGH, title="dup"))
        await router.route(_alert(Severity.HIGH, title="dup"))
        # Second call rate-limited
        assert tg.call_count == 1


@pytest.mark.asyncio
async def test_rate_limiter_allows_after_cooldown(router):
    with patch.object(router, "_send_telegram", new_callable=AsyncMock) as tg, \
         patch.object(router, "_send_mc_api", new_callable=AsyncMock):
        await router.route(_alert(Severity.HIGH, title="dup2"))
        # Manually expire
        router._rate_cache[("NEXUS", "dup2")] = time.time() - 700
        await router.route(_alert(Severity.HIGH, title="dup2"))
        assert tg.call_count == 2


@pytest.mark.asyncio
async def test_low_alerts_batched(router):
    with patch.object(router, "_send_telegram", new_callable=AsyncMock) as tg, \
         patch.object(router, "_send_mc_api", new_callable=AsyncMock):
        await router.route(_alert(Severity.LOW))
        assert len(router._batch) == 1
        tg.assert_not_called()


def test_alert_id_unique():
    a1 = _alert()
    a2 = _alert()
    assert a1.id != a2.id


def test_missing_telegram_token_raises():
    bad = NexusConfig(mc_api_url="x", mc_api_token="x", telegram_bot_token="")
    with pytest.raises(RuntimeError):
        AlertRouter(bad)


@pytest.mark.asyncio
async def test_telegram_format_high(router):
    alert = _alert(Severity.HIGH, agent="VOLT", title="GPU down")
    with patch("aiohttp.ClientSession") as mock_session_cls:
        mock_session = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_session.post = AsyncMock()

        await router._send_telegram(alert, GROUP_CHAT_ID)
        call_kwargs = mock_session.post.call_args[1]
        assert call_kwargs["json"]["text"].startswith("⚠️ [VOLT] GPU down")
