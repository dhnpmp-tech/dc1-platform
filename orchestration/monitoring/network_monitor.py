#!/usr/bin/env python3
"""
DC1 Gate 0 — Network Monitor

Monitors STC ISP connectivity from the provider host (PC1) via ICMP ping,
detecting packet loss, outages, and latency trends.
"""

import os
import sys
import signal
import logging
import sqlite3
import subprocess
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from threading import Thread, Event
from collections import deque
from http.server import HTTPServer, BaseHTTPRequestHandler
import yaml


# Configuration constants
DEFAULT_CONFIG_PATH = "network_config.yaml"
MC_API_TOKEN_ENV = "DC1_MC_TOKEN"
AGENT_ID_ENV = "DC1_AGENT_ID"


class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""
    pass


def load_config(config_path: Optional[str] = None) -> Dict:
    """Load configuration from YAML file."""
    path = config_path or os.getenv("NM_CONFIG", DEFAULT_CONFIG_PATH)

    if not os.path.exists(path):
        raise FileNotFoundError(f"Configuration file not found: {path}")

    with open(path, 'r') as f:
        config = yaml.safe_load(f)

    return config


def validate_config(config: Dict) -> None:
    """Validate configuration values."""
    errors = []

    # Validate ping settings
    if config.get("ping", {}).get("interval_s", 10) <= 0:
        errors.append("ping.interval_s must be positive")

    if config.get("ping", {}).get("timeout_s", 5) <= 0:
        errors.append("ping.timeout_s must be positive")

    # Validate thresholds
    loss_pct = config.get("thresholds", {}).get("loss_pct_alert", 5.0)
    if loss_pct < 0 or loss_pct > 100:
        errors.append("thresholds.loss_pct_alert must be between 0 and 100")

    if config.get("thresholds", {}).get("outage_consecutive_s", 5) <= 0:
        errors.append("thresholds.outage_consecutive_s must be positive")

    if config.get("thresholds", {}).get("rolling_window_s", 60) <= 0:
        errors.append("thresholds.rolling_window_s must be positive")

    # Validate storage
    if config.get("storage", {}).get("retention_days", 7) <= 0:
        errors.append("storage.retention_days must be positive")

    # Validate status port
    port = config.get("status", {}).get("port", 8085)
    if port <= 0 or port > 65535:
        errors.append("status.port must be between 1 and 65535")

    if errors:
        raise ConfigValidationError("\n".join(errors))


def get_required_env_var(env_var: str, description: str) -> str:
    """Get required environment variable or raise error."""
    value = os.getenv(env_var)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {env_var} ({description}). "
            f"Please set {env_var} before starting the monitor."
        )
    return value


class DatabaseManager:
    """Manage SQLite database for metrics storage."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Initialize database schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS metrics (
                    timestamp INTEGER PRIMARY KEY,
                    latency_ms REAL,
                    packet_loss_pct REAL,
                    target TEXT,
                    status TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_timestamp
                ON metrics(timestamp)
            """)
            conn.commit()

    def insert_metric(self, latency_ms: float, packet_loss_pct: float,
                     target: str, status: str) -> None:
        """Insert metric into database."""
        timestamp = int(time.time())
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO metrics VALUES (?, ?, ?, ?, ?)",
                (timestamp, latency_ms, packet_loss_pct, target, status)
            )
            conn.commit()

    def cleanup_old_metrics(self, retention_days: int) -> None:
        """Delete metrics older than retention period."""
        cutoff_timestamp = int(time.time()) - (retention_days * 86400)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "DELETE FROM metrics WHERE timestamp < ?",
                (cutoff_timestamp,)
            )
            conn.commit()

    def get_latest_metrics(self, hours: int = 24) -> List[Tuple]:
        """Get metrics from last N hours."""
        cutoff_timestamp = int(time.time()) - (hours * 3600)
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT latency_ms, packet_loss_pct, timestamp FROM metrics "
                "WHERE timestamp > ? ORDER BY timestamp DESC",
                (cutoff_timestamp,)
            )
            return cursor.fetchall()


class PingMonitor:
    """Monitor network connectivity via ICMP ping."""

    def __init__(self, config: Dict):
        self.config = config
        self.primary_target = config["targets"]["primary"]
        self.fallback_target = config["targets"]["fallback"]
        self.interval_s = config["ping"]["interval_s"]
        self.timeout_s = config["ping"]["timeout_s"]
        self.loss_threshold = config["thresholds"]["loss_pct_alert"]
        self.outage_threshold_s = config["thresholds"]["outage_consecutive_s"]
        self.rolling_window_s = config["thresholds"]["rolling_window_s"]

        self.running = False
        self.shutdown_event = Event()
        self.latencies: deque = deque(maxlen=int(self.rolling_window_s / self.interval_s))
        self.last_latency_ms = 0.0
        self.consecutive_failures = 0
        self.last_alert_time = 0
        self.alert_cooldown_s = config["alerts"]["cooldown_s"]

        # Initialize database
        self.db = DatabaseManager(config["storage"]["db_path"])

        # Setup logging
        log_path = config["logging"]["log_path"]
        Path(log_path).parent.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(
            filename=log_path,
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )

    def _ping_target(self, target: str) -> Optional[float]:
        """Ping a target and return latency in ms, or None if failed."""
        try:
            result = subprocess.run(
                ["ping", "-c", "1", "-W", str(self.timeout_s), target],
                capture_output=True,
                text=True,
                timeout=self.timeout_s + 1
            )

            if result.returncode != 0:
                return None

            # Parse latency from ping output (time=X.XXms)
            for line in result.stdout.split('\n'):
                if "time=" in line:
                    time_str = line.split("time=")[1].split("ms")[0]
                    return float(time_str)

            return None
        except Exception as e:
            logging.warning(f"Ping to {target} failed: {e}")
            return None

    def _calculate_loss_pct(self) -> float:
        """Calculate packet loss percentage over rolling window."""
        if not self.latencies:
            return 100.0

        failed = sum(1 for lat in self.latencies if lat is None)
        return (failed / len(self.latencies)) * 100

    def _should_alert(self) -> bool:
        """Check if enough time has passed since last alert."""
        now = time.time()
        return (now - self.last_alert_time) >= self.alert_cooldown_s

    def _send_alert_to_mc(self, alert_type: str, details: str) -> None:
        """Send alert to Mission Control API."""
        try:
            mc_token = get_required_env_var(MC_API_TOKEN_ENV, "Mission Control API token")
            agent_id = get_required_env_var(AGENT_ID_ENV, "Agent ID")

            if not self._should_alert():
                return

            # TODO: Implement actual MC API call
            # This is a placeholder for the actual API integration
            logging.info(
                f"Alert [{alert_type}]: {details} (Token: {mc_token[:10]}..., Agent: {agent_id})"
            )
            self.last_alert_time = time.time()
        except RuntimeError as e:
            logging.error(f"Cannot send alert: {e}")

    def monitor_loop(self) -> None:
        """Main monitoring loop."""
        self.running = True
        logging.info("Network monitor started")

        while not self.shutdown_event.is_set():
            try:
                # Try primary target
                latency = self._ping_target(self.primary_target)

                # Fallback to secondary if primary fails
                if latency is None:
                    latency = self._ping_target(self.fallback_target)
                    target = self.fallback_target if latency is not None else self.primary_target
                else:
                    target = self.primary_target

                # Track latency
                self.latencies.append(latency)
                if latency is not None:
                    self.last_latency_ms = latency
                    self.consecutive_failures = 0
                else:
                    self.consecutive_failures += 1

                # Check for outage
                if self.consecutive_failures * self.interval_s >= self.outage_threshold_s:
                    self._send_alert_to_mc("OUTAGE", f"Network outage detected on {target}")

                # Check for high packet loss
                loss_pct = self._calculate_loss_pct()
                if loss_pct > self.loss_threshold:
                    self._send_alert_to_mc("HIGH_LOSS", f"Packet loss {loss_pct:.1f}%")

                # Store metrics
                status = "healthy" if latency is not None else "failed"
                self.db.insert_metric(
                    self.last_latency_ms,
                    loss_pct,
                    target,
                    status
                )

                # Cleanup old data
                self.db.cleanup_old_metrics(
                    self.config["storage"]["retention_days"]
                )

                time.sleep(self.interval_s)

            except Exception as e:
                logging.error(f"Error in monitor loop: {e}")
                time.sleep(self.interval_s)

    def start(self) -> None:
        """Start monitoring in background thread."""
        thread = Thread(target=self.monitor_loop, daemon=False)
        thread.start()

    def stop(self) -> None:
        """Stop monitoring."""
        self.shutdown_event.set()
        self.running = False
        logging.info("Network monitor stopped")


class StatusHandler(BaseHTTPRequestHandler):
    """HTTP request handler for status endpoint."""

    # Class variables shared across instances
    monitor: Optional[PingMonitor] = None
    request_times: deque = deque(maxlen=60)  # Last 60 seconds of requests

    def do_GET(self) -> None:
        """Handle GET requests."""
        if self.path != "/status":
            self.send_response(404)
            self.end_headers()
            return

        # Simple rate limiting: track request times and reject if > 60 req/min
        now = time.time()
        self.request_times.append(now)

        # Count requests in last 60 seconds
        recent_requests = sum(1 for t in self.request_times if now - t <= 60)

        if recent_requests > 60:
            self.send_response(429)  # Too Many Requests
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = json.dumps({"error": "Rate limit exceeded (60 req/min)"})
            self.wfile.write(response.encode())
            return

        # Generate status response
        try:
            loss_pct = self.monitor._calculate_loss_pct() if self.monitor else 0.0
            recent_metrics = self.monitor.db.get_latest_metrics(24) if self.monitor else []

            # Calculate 24h uptime
            uptime_pct = 100.0
            if recent_metrics:
                failures = sum(1 for m in recent_metrics if m[1] > self.monitor.loss_threshold)
                uptime_pct = 100.0 - (failures / len(recent_metrics)) * 100

            response = {
                "status": "healthy" if self.monitor.consecutive_failures == 0 else "degraded",
                "latency_ms": self.monitor.last_latency_ms,
                "loss_pct": loss_pct,
                "uptime_pct_24h": uptime_pct,
                "last_outage": None  # TODO: Track last outage time
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            logging.error(f"Error generating status: {e}")
            self.send_response(500)
            self.end_headers()

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass


def main():
    """Main entry point."""
    try:
        # Load and validate configuration
        config = load_config()
        validate_config(config)

        # Verify required environment variables at startup
        get_required_env_var(MC_API_TOKEN_ENV, "Mission Control API token")
        get_required_env_var(AGENT_ID_ENV, "Agent ID")

        # Setup signal handlers for graceful shutdown
        monitor = PingMonitor(config)

        def signal_handler(sig, frame):
            logging.info(f"Received signal {sig}, shutting down...")
            monitor.stop()
            sys.exit(0)

        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

        # Start monitoring
        monitor.start()

        # Start status endpoint
        StatusHandler.monitor = monitor
        server = HTTPServer(
            ("0.0.0.0", config["status"]["port"]),
            StatusHandler
        )
        logging.info(f"Status endpoint listening on port {config['status']['port']}")

        # Keep server running
        server.serve_forever()

    except RuntimeError as e:
        logging.critical(f"Runtime error: {e}")
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except ConfigValidationError as e:
        logging.critical(f"Configuration validation failed: {e}")
        print(f"CONFIG ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        logging.critical(f"Fatal error: {e}")
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
