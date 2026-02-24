#!/usr/bin/env python3
"""DC1 Gate 0 — Network Monitor.

Monitors STC ISP connectivity via ICMP ping, detects packet loss and outages,
stores latency trends in SQLite, and exposes a JSON status endpoint.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sqlite3
import statistics
import subprocess
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import aiohttp
import yaml
from aiohttp import web

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class Config:
    primary_target: str = "8.8.8.8"
    fallback_target: str = "1.1.1.1"
    ping_interval: float = 10.0
    ping_timeout: float = 5.0
    loss_pct_alert: float = 5.0
    outage_consecutive_s: float = 5.0
    rolling_window_s: float = 60.0
    db_path: str = "data/network_metrics.db"
    retention_days: int = 7
    log_path: str = "logs/network_monitor.log"
    log_level: str = "INFO"
    mc_api_url: str = "http://76.13.179.86:8084/api/alerts"
    mc_api_token: str = "dc1-mc-gate0-2026"
    agent_id: str = "3149e473-3a2f-4163-8246-b682caf2f053"
    alert_cooldown_s: float = 300.0
    status_host: str = "0.0.0.0"
    status_port: int = 8085

    @classmethod
    def from_yaml(cls, path: str) -> Config:
        with open(path, "r") as f:
            raw: dict[str, Any] = yaml.safe_load(f) or {}
        targets = raw.get("targets", {})
        ping = raw.get("ping", {})
        thresholds = raw.get("thresholds", {})
        storage = raw.get("storage", {})
        log_cfg = raw.get("logging", {})
        alerts = raw.get("alerts", {})
        status = raw.get("status", {})
        return cls(
            primary_target=targets.get("primary", cls.primary_target),
            fallback_target=targets.get("fallback", cls.fallback_target),
            ping_interval=ping.get("interval_s", cls.ping_interval),
            ping_timeout=ping.get("timeout_s", cls.ping_timeout),
            loss_pct_alert=thresholds.get("loss_pct_alert", cls.loss_pct_alert),
            outage_consecutive_s=thresholds.get("outage_consecutive_s", cls.outage_consecutive_s),
            rolling_window_s=thresholds.get("rolling_window_s", cls.rolling_window_s),
            db_path=storage.get("db_path", cls.db_path),
            retention_days=storage.get("retention_days", cls.retention_days),
            log_path=log_cfg.get("log_path", cls.log_path),
            log_level=log_cfg.get("level", cls.log_level),
            mc_api_url=alerts.get("mc_api_url", cls.mc_api_url),
            mc_api_token=alerts.get("mc_api_token", cls.mc_api_token),
            agent_id=alerts.get("agent_id", cls.agent_id),
            alert_cooldown_s=alerts.get("cooldown_s", cls.alert_cooldown_s),
            status_host=status.get("host", cls.status_host),
            status_port=status.get("port", cls.status_port),
        )


# ---------------------------------------------------------------------------
# Ping helper (uses system ping — no root required)
# ---------------------------------------------------------------------------

async def ping_host(target: str, timeout: float) -> float | None:
    """Return latency in ms or None on failure."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", str(int(timeout)), target,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout + 2)
        if proc.returncode == 0:
            for line in stdout.decode().splitlines():
                if "time=" in line:
                    part = line.split("time=")[1]
                    return float(part.split()[0])
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# SQLite storage
# ---------------------------------------------------------------------------

class MetricsDB:
    def __init__(self, db_path: str, retention_days: int) -> None:
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path, isolation_level=None)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._retention_days = retention_days
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS ping_results (
                ts REAL PRIMARY KEY,
                target TEXT NOT NULL,
                latency_ms REAL,
                success INTEGER NOT NULL
            )
        """)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS latency_stats (
                bucket TEXT PRIMARY KEY,
                p50 REAL, p95 REAL, p99 REAL, sample_count INTEGER
            )
        """)

    def record_ping(self, ts: float, target: str, latency_ms: float | None) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO ping_results (ts, target, latency_ms, success) VALUES (?, ?, ?, ?)",
            (ts, target, latency_ms, 1 if latency_ms is not None else 0),
        )

    def compute_hourly_stats(self) -> None:
        """Roll up the last hour into latency_stats."""
        now = time.time()
        hour_ago = now - 3600
        rows = self._conn.execute(
            "SELECT latency_ms FROM ping_results WHERE ts > ? AND success = 1",
            (hour_ago,),
        ).fetchall()
        if not rows:
            return
        vals = sorted(r[0] for r in rows)
        n = len(vals)
        bucket = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")
        p50 = vals[int(n * 0.50)]
        p95 = vals[min(int(n * 0.95), n - 1)]
        p99 = vals[min(int(n * 0.99), n - 1)]
        self._conn.execute(
            "INSERT OR REPLACE INTO latency_stats (bucket, p50, p95, p99, sample_count) VALUES (?, ?, ?, ?, ?)",
            (bucket, p50, p95, p99, n),
        )

    def prune(self) -> None:
        cutoff = time.time() - self._retention_days * 86400
        self._conn.execute("DELETE FROM ping_results WHERE ts < ?", (cutoff,))
        cutoff_bucket = (datetime.now(timezone.utc) - timedelta(days=self._retention_days)).strftime("%Y-%m-%d-%H")
        self._conn.execute("DELETE FROM latency_stats WHERE bucket < ?", (cutoff_bucket,))

    def uptime_24h(self) -> float:
        cutoff = time.time() - 86400
        row = self._conn.execute(
            "SELECT COUNT(*), SUM(success) FROM ping_results WHERE ts > ?", (cutoff,)
        ).fetchone()
        total, ok = row[0], row[1] or 0
        return (ok / total * 100) if total else 100.0

    def close(self) -> None:
        self._conn.close()


# ---------------------------------------------------------------------------
# Alert sender
# ---------------------------------------------------------------------------

class AlertSender:
    def __init__(self, cfg: Config) -> None:
        self._cfg = cfg
        self._last_alert: float = 0.0

    async def send(self, message: str, metadata: dict[str, Any], level: str = "critical") -> None:
        now = time.time()
        if now - self._last_alert < self._cfg.alert_cooldown_s:
            return
        self._last_alert = now
        payload = {
            "agent_id": self._cfg.agent_id,
            "level": level,
            "message": message,
            "metadata": metadata,
        }
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(
                    self._cfg.mc_api_url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self._cfg.mc_api_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=aiohttp.ClientTimeout(total=10),
                )
        except Exception as exc:
            logging.getLogger("network_monitor").warning("Alert POST failed: %s", exc)


# ---------------------------------------------------------------------------
# Core monitor
# ---------------------------------------------------------------------------

@dataclass
class PingResult:
    ts: float
    latency_ms: float | None
    target: str


class NetworkMonitor:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.log = logging.getLogger("network_monitor")
        self._results: deque[PingResult] = deque()
        self._db = MetricsDB(cfg.db_path, cfg.retention_days)
        self._alerter = AlertSender(cfg)
        self._running = True
        self._last_success_ts: float = time.time()
        self._last_outage: str | None = None
        self._last_latency: float | None = None
        self._hourly_tick: float = time.time()

    # --- status ---
    @property
    def current_loss_pct(self) -> float:
        cutoff = time.time() - self.cfg.rolling_window_s
        window = [r for r in self._results if r.ts > cutoff]
        if not window:
            return 0.0
        failed = sum(1 for r in window if r.latency_ms is None)
        return failed / len(window) * 100

    def status_json(self) -> dict[str, Any]:
        loss = self.current_loss_pct
        return {
            "status": "degraded" if loss > self.cfg.loss_pct_alert else "healthy",
            "latency_ms": round(self._last_latency, 2) if self._last_latency else None,
            "loss_pct": round(loss, 2),
            "uptime_pct_24h": round(self._db.uptime_24h(), 2),
            "last_outage": self._last_outage,
        }

    # --- main loop ---
    async def run(self) -> None:
        self.log.info("Network monitor started — targets: %s / %s",
                       self.cfg.primary_target, self.cfg.fallback_target)
        while self._running:
            await self._ping_cycle()
            await asyncio.sleep(self.cfg.ping_interval)

    async def _ping_cycle(self) -> None:
        now = time.time()
        latency = await ping_host(self.cfg.primary_target, self.cfg.ping_timeout)
        target_used = self.cfg.primary_target
        if latency is None:
            latency = await ping_host(self.cfg.fallback_target, self.cfg.ping_timeout)
            target_used = self.cfg.fallback_target

        result = PingResult(ts=now, latency_ms=latency, target=target_used)
        self._results.append(result)
        # trim deque to rolling window * 2
        cutoff = now - self.cfg.rolling_window_s * 2
        while self._results and self._results[0].ts < cutoff:
            self._results.popleft()

        self._db.record_ping(now, target_used, latency)

        if latency is not None:
            self._last_latency = latency
            self._last_success_ts = now
        else:
            gap = now - self._last_success_ts
            if gap >= self.cfg.outage_consecutive_s:
                ts_str = datetime.now(timezone.utc).isoformat()
                self._last_outage = ts_str
                self.log.critical("Outage detected — %.0fs no response", gap)
                await self._alerter.send(
                    f"Network outage detected — {int(gap)}s no response from STC gateway",
                    {"loss_pct": 100, "duration_s": round(gap, 1), "target": target_used},
                )

        loss = self.current_loss_pct
        if loss > self.cfg.loss_pct_alert and latency is not None:
            self.log.warning("Packet loss %.1f%% exceeds threshold", loss)
            await self._alerter.send(
                f"High packet loss detected — {loss:.1f}% over last {int(self.cfg.rolling_window_s)}s",
                {"loss_pct": round(loss, 1), "duration_s": int(self.cfg.rolling_window_s), "target": target_used},
                level="warning",
            )

        # hourly stats + prune
        if now - self._hourly_tick > 3600:
            self._db.compute_hourly_stats()
            self._db.prune()
            self._hourly_tick = now

    def stop(self) -> None:
        self._running = False
        self._db.close()
        self.log.info("Network monitor stopped")


# ---------------------------------------------------------------------------
# HTTP status endpoint
# ---------------------------------------------------------------------------

async def create_status_app(monitor: NetworkMonitor, cfg: Config) -> web.AppRunner:
    app = web.Application()

    async def handle_status(request: web.Request) -> web.Response:
        return web.json_response(monitor.status_json())

    app.router.add_get("/status", handle_status)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, cfg.status_host, cfg.status_port)
    await site.start()
    logging.getLogger("network_monitor").info(
        "Status endpoint listening on %s:%d", cfg.status_host, cfg.status_port
    )
    return runner


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def setup_logging(cfg: Config) -> None:
    Path(cfg.log_path).parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=getattr(logging, cfg.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(cfg.log_path),
            logging.StreamHandler(),
        ],
    )


async def main() -> None:
    config_path = os.environ.get("NM_CONFIG", str(
        Path(__file__).parent / "network_config.yaml"
    ))
    cfg = Config.from_yaml(config_path) if Path(config_path).exists() else Config()
    setup_logging(cfg)

    monitor = NetworkMonitor(cfg)
    runner = await create_status_app(monitor, cfg)

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _shutdown(sig: int) -> None:
        logging.getLogger("network_monitor").info("Received signal %d, shutting down…", sig)
        stop_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _shutdown, sig)

    monitor_task = asyncio.create_task(monitor.run())
    await stop_event.wait()

    monitor.stop()
    monitor_task.cancel()
    await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
