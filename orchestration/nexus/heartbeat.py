"""Heartbeat aggregator — tracks agent liveness via SQLite + aiohttp server."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from aiohttp import web

from .alert_router import Alert, AlertRouter, Severity
from .config import NexusConfig

logger = logging.getLogger("nexus.heartbeat")

AGENTS: dict[str, str] = {
    "NEXUS":    "37c0fd6b",
    "ATLAS":    "3149e473",
    "VOLT":     "1293aef8",
    "GUARDIAN": "3bad1840",
    "SPARK":    "4aa8d644",
    "SYNC":     "cb6a5cc5",
}

AGENT_ID_TO_NAME: dict[str, str] = {v: k for k, v in AGENTS.items()}

SILENT_THRESHOLD_MIN = 130  # 2h + 10min grace


@dataclass
class AgentStatus:
    agent_name: str
    agent_id: str
    last_seen: str | None
    silent_minutes: float | None
    is_alive: bool
    message: str | None


class HeartbeatAggregator:
    def __init__(self, db_path: str = "data/heartbeats.db") -> None:
        self._db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(
            """CREATE TABLE IF NOT EXISTS heartbeats (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                message TEXT,
                metadata_json TEXT,
                ts_utc TEXT NOT NULL
            )"""
        )
        self._conn.commit()

    def record_heartbeat(
        self, agent_id: str, message: str = "", metadata: dict[str, Any] | None = None
    ) -> None:
        agent_name = AGENT_ID_TO_NAME.get(agent_id, agent_id)
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            "INSERT INTO heartbeats (id, agent_id, agent_name, message, metadata_json, ts_utc) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), agent_id, agent_name, message, json.dumps(metadata or {}), now),
        )
        self._conn.commit()

    def get_status(self) -> list[AgentStatus]:
        now = datetime.now(timezone.utc)
        results: list[AgentStatus] = []
        for name, aid in AGENTS.items():
            row = self._conn.execute(
                "SELECT ts_utc, message FROM heartbeats WHERE agent_id=? ORDER BY ts_utc DESC LIMIT 1",
                (aid,),
            ).fetchone()
            if row:
                last_ts = datetime.fromisoformat(row[0])
                if last_ts.tzinfo is None:
                    last_ts = last_ts.replace(tzinfo=timezone.utc)
                silent = (now - last_ts).total_seconds() / 60.0
                results.append(AgentStatus(name, aid, row[0], silent, silent < SILENT_THRESHOLD_MIN, row[1]))
            else:
                results.append(AgentStatus(name, aid, None, None, False, None))
        return results

    def get_silent_agents(self) -> list[AgentStatus]:
        return [s for s in self.get_status() if not s.is_alive]

    def close(self) -> None:
        self._conn.close()


# --- HTTP Server ---

def _check_auth(request: web.Request, config: NexusConfig) -> bool:
    auth = request.headers.get("Authorization", "")
    return auth == f"Bearer {config.mc_api_token}"


async def handle_heartbeat_post(request: web.Request) -> web.Response:
    config: NexusConfig = request.app["config"]
    if not _check_auth(request, config):
        return web.json_response({"error": "unauthorized"}, status=401)
    body = await request.json()
    agg: HeartbeatAggregator = request.app["aggregator"]
    agg.record_heartbeat(body.get("agent_id", ""), body.get("message", ""), body.get("metadata"))
    return web.json_response({"ok": True})


async def handle_status(request: web.Request) -> web.Response:
    agg: HeartbeatAggregator = request.app["aggregator"]
    statuses = agg.get_status()
    return web.json_response([s.__dict__ for s in statuses])


async def handle_status_agent(request: web.Request) -> web.Response:
    name = request.match_info["agent_name"].upper()
    agg: HeartbeatAggregator = request.app["aggregator"]
    for s in agg.get_status():
        if s.agent_name == name:
            return web.json_response(s.__dict__)
    return web.json_response({"error": "unknown agent"}, status=404)


async def silent_check_loop(app: web.Application) -> None:
    """Every 10 minutes, check for silent agents and fire alerts."""
    agg: HeartbeatAggregator = app["aggregator"]
    router: AlertRouter = app["alert_router"]
    while True:
        await asyncio.sleep(600)
        try:
            silent = agg.get_silent_agents()
            if silent:
                names = ", ".join(s.agent_name for s in silent)
                logger.warning("Silent agents detected: %s", names)
                await router.route(Alert(
                    severity=Severity.HIGH,
                    source_agent="NEXUS",
                    title="Silent Agents Detected",
                    message=f"The following agents have not checked in: {names}",
                ))
        except Exception:
            logger.exception("Error in silent check loop")


async def start_background_tasks(app: web.Application) -> None:
    app["silent_checker"] = asyncio.create_task(silent_check_loop(app))


async def cleanup_background_tasks(app: web.Application) -> None:
    app["silent_checker"].cancel()
    try:
        await app["silent_checker"]
    except asyncio.CancelledError:
        pass


def create_app(config: NexusConfig, aggregator: HeartbeatAggregator | None = None, alert_router: AlertRouter | None = None) -> web.Application:
    app = web.Application()
    app["config"] = config
    app["aggregator"] = aggregator or HeartbeatAggregator(config.heartbeat_db_path)
    app["alert_router"] = alert_router or AlertRouter(config)
    app.router.add_post("/heartbeat", handle_heartbeat_post)
    app.router.add_get("/heartbeat/status", handle_status)
    app.router.add_get("/heartbeat/status/{agent_name}", handle_status_agent)
    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)
    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO, handlers=[
        logging.FileHandler("logs/heartbeat.log"),
        logging.StreamHandler(),
    ])
    config = NexusConfig.from_env()
    app = create_app(config)
    web.run_app(app, port=config.heartbeat_port)


if __name__ == "__main__":
    main()
