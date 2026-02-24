"""Tests for HeartbeatAggregator and HTTP endpoints."""
from __future__ import annotations

import asyncio
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from aiohttp.test_utils import AioHTTPTestCase, TestClient, TestServer

from orchestration.nexus.config import NexusConfig
from orchestration.nexus.heartbeat import (
    AGENTS,
    AgentStatus,
    HeartbeatAggregator,
    create_app,
)

FAKE_CONFIG = NexusConfig(
    mc_api_url="http://localhost:9999",
    mc_api_token="test-token",
    telegram_bot_token="fake-tg-token",
    heartbeat_port=8086,
    heartbeat_db_path="",  # overridden per test
    agent_id="37c0fd6b",
)


@pytest.fixture
def agg(tmp_path):
    db = str(tmp_path / "test.db")
    a = HeartbeatAggregator(db)
    yield a
    a.close()


def test_record_heartbeat_stores(agg: HeartbeatAggregator):
    agg.record_heartbeat("37c0fd6b", "alive", {"cpu": 10})
    rows = agg._conn.execute("SELECT * FROM heartbeats").fetchall()
    assert len(rows) == 1
    assert rows[0][1] == "37c0fd6b"


def test_get_status_returns_all_agents(agg: HeartbeatAggregator):
    statuses = agg.get_status()
    assert len(statuses) == len(AGENTS)


def test_is_alive_true_recent(agg: HeartbeatAggregator):
    agg.record_heartbeat("37c0fd6b", "ok")
    statuses = {s.agent_name: s for s in agg.get_status()}
    assert statuses["NEXUS"].is_alive is True


def test_is_alive_false_old(agg: HeartbeatAggregator):
    agg.record_heartbeat("37c0fd6b", "ok")
    # Manually backdate
    old = (datetime.now(timezone.utc) - timedelta(minutes=200)).isoformat()
    agg._conn.execute("UPDATE heartbeats SET ts_utc=?", (old,))
    agg._conn.commit()
    statuses = {s.agent_name: s for s in agg.get_status()}
    assert statuses["NEXUS"].is_alive is False


def test_is_alive_false_never_seen(agg: HeartbeatAggregator):
    statuses = {s.agent_name: s for s in agg.get_status()}
    assert statuses["NEXUS"].is_alive is False
    assert statuses["NEXUS"].last_seen is None


def test_get_silent_agents(agg: HeartbeatAggregator):
    # Only NEXUS has heartbeat
    agg.record_heartbeat("37c0fd6b", "ok")
    silent = agg.get_silent_agents()
    silent_names = {s.agent_name for s in silent}
    assert "NEXUS" not in silent_names
    assert "ATLAS" in silent_names
    assert len(silent) == 5


def test_sqlite_wal_mode(tmp_path):
    db = str(tmp_path / "wal.db")
    a = HeartbeatAggregator(db)
    mode = a._conn.execute("PRAGMA journal_mode").fetchone()[0]
    assert mode == "wal"
    a.close()


# --- HTTP tests ---

@pytest.fixture
def config(tmp_path):
    return NexusConfig(
        mc_api_url="http://localhost:9999",
        mc_api_token="test-token",
        telegram_bot_token="fake-tg-token",
        heartbeat_port=8086,
        heartbeat_db_path=str(tmp_path / "http.db"),
        agent_id="37c0fd6b",
    )


@pytest.fixture
def mock_router():
    r = MagicMock()
    r.route = AsyncMock()
    return r


@pytest_asyncio.fixture
async def client(config, mock_router):
    agg = HeartbeatAggregator(config.heartbeat_db_path)
    app = create_app(config, aggregator=agg, alert_router=mock_router)
    # Remove background tasks for testing
    app.on_startup.clear()
    app.on_cleanup.clear()
    async with TestClient(TestServer(app)) as c:
        yield c
    agg.close()


@pytest.mark.asyncio
async def test_heartbeat_post_401_no_auth(client):
    resp = await client.post("/heartbeat", json={"agent_id": "37c0fd6b", "message": "hi"})
    assert resp.status == 401


@pytest.mark.asyncio
async def test_heartbeat_post_401_wrong_token(client):
    resp = await client.post(
        "/heartbeat",
        json={"agent_id": "37c0fd6b"},
        headers={"Authorization": "Bearer wrong"},
    )
    assert resp.status == 401


@pytest.mark.asyncio
async def test_heartbeat_post_ok(client):
    resp = await client.post(
        "/heartbeat",
        json={"agent_id": "37c0fd6b", "message": "alive"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert resp.status == 200
    data = await resp.json()
    assert data["ok"] is True
