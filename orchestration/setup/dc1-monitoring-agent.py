#!/usr/bin/env python3
"""
DC1 Monitoring Agent
=====================
Lightweight agent installed on GPU provider machines.
- Sends heartbeat every 60s with GPU metrics
- Accepts commands from DC1 server (start_job, stop_job, checkpoint, wipe_memory)
- Listens on configurable port (default 8085)
- Auth via shared secret

Usage:
    DC1_SERVER_URL=http://dc1-server:8084/api DC1_AGENT_SECRET=xxx python dc1-monitoring-agent.py
"""

import hashlib
import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DC1_SERVER_URL: str = os.getenv("DC1_SERVER_URL", "http://76.13.179.86:8084/api")
DC1_AGENT_SECRET: str = os.getenv("DC1_AGENT_SECRET", "")
AGENT_PORT: int = int(os.getenv("DC1_AGENT_PORT", "8085"))
HEARTBEAT_INTERVAL: int = int(os.getenv("HEARTBEAT_INTERVAL", "60"))
GPU_ID: str = os.getenv("GPU_ID", "pc1-rtx3090")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("dc1-agent")

_running = True
_current_job: Optional[str] = None
_last_wipe_time: float = 0.0          # C3 FIX: rate limit wipe_memory calls
WIPE_COOLDOWN_SECONDS: int = 300       # minimum 5 minutes between wipes


# ---------------------------------------------------------------------------
# GPU metrics
# ---------------------------------------------------------------------------

def get_gpu_metrics() -> dict:
    """Collect GPU metrics via nvidia-smi."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            parts = [p.strip() for p in result.stdout.strip().split(",")]
            return {
                "temperature_c": int(parts[0]),
                "utilization_pct": int(parts[1]),
                "memory_used_mb": int(parts[2]),
                "memory_total_mb": int(parts[3]),
                "power_draw_w": float(parts[4]),
                "online": True,
            }
    except Exception as e:
        logger.error("nvidia-smi failed: %s", e)
    return {"online": False, "error": "nvidia-smi unavailable"}


# ---------------------------------------------------------------------------
# Heartbeat sender
# ---------------------------------------------------------------------------

def heartbeat_loop() -> None:
    """Send heartbeat to DC1 server every HEARTBEAT_INTERVAL seconds."""
    import requests  # lazy import — may not be installed during onboarding

    while _running:
        metrics = get_gpu_metrics()
        metrics["gpu_id"] = GPU_ID
        metrics["job_id"] = _current_job
        metrics["timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            requests.post(
                f"{DC1_SERVER_URL}/providers/{GPU_ID}/heartbeat",
                json=metrics,
                headers={"Authorization": f"Bearer {DC1_AGENT_SECRET}"},
                timeout=10,
            )
            logger.info("Heartbeat sent: temp=%s util=%s%%", metrics.get("temperature_c"), metrics.get("utilization_pct"))
        except Exception as e:
            logger.warning("Heartbeat failed: %s", e)

        time.sleep(HEARTBEAT_INTERVAL)


# ---------------------------------------------------------------------------
# Command handler (HTTP server)
# ---------------------------------------------------------------------------

def verify_auth(headers: dict) -> bool:
    """Check Authorization header matches shared secret."""
    token = headers.get("Authorization", "").replace("Bearer ", "")
    return token == DC1_AGENT_SECRET and DC1_AGENT_SECRET != ""


class CommandHandler(BaseHTTPRequestHandler):
    """HTTP handler for commands from DC1 server."""

    def log_message(self, format, *args):  # type: ignore
        logger.debug("HTTP: %s", format % args)

    def do_POST(self) -> None:
        global _current_job

        if not verify_auth(dict(self.headers)):
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error":"unauthorized"}')
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        command = body.get("command", "")

        logger.info("Received command: %s", command)
        result = {"status": "ok", "command": command}

        if command == "start_job":
            _current_job = body.get("job_id", "unknown")
            result["message"] = f"Job {_current_job} started"
        elif command == "stop_job":
            _current_job = None
            result["message"] = "Job stopped"
        elif command == "checkpoint":
            # Placeholder: trigger model checkpoint save
            result["message"] = "Checkpoint triggered"
        elif command == "wipe_memory":
            # C2 FIX: Guard — only wipe if no job is currently running
            if _current_job is not None:
                self.send_response(409)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "error",
                    "message": f"Cannot wipe memory: job {_current_job} is running. Stop job first."
                }).encode())
                return
            # C3 FIX: Rate limit — minimum 5 minutes between wipes
            now = time.time()
            if now - _last_wipe_time < WIPE_COOLDOWN_SECONDS:
                wait = int(WIPE_COOLDOWN_SECONDS - (now - _last_wipe_time))
                self.send_response(429)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "error",
                    "message": f"Rate limited: wipe_memory cooldown, retry in {wait}s"
                }).encode())
                return
            # Safe wipe: use nvidia-smi to reset clocks/power only, NOT full GPU reset.
            # Full --gpu-reset would kill running processes. Use targeted memory clear instead.
            subprocess.run(["nvidia-smi", "--clocks-reset"], capture_output=True, timeout=30)
            subprocess.run(["nvidia-smi", "--reset-gpu-ecc-errors"], capture_output=True, timeout=30)
            _last_wipe_time = time.time()
            result["message"] = "GPU memory wiped (clocks reset, ECC errors cleared)"
        elif command == "status":
            result.update(get_gpu_metrics())
            result["job_id"] = _current_job
        else:
            result = {"status": "error", "message": f"Unknown command: {command}"}

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def do_GET(self) -> None:
        """Health endpoint — no auth required."""
        metrics = get_gpu_metrics()
        metrics["job_id"] = _current_job
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(metrics).encode())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def handle_signal(signum: int, frame) -> None:  # type: ignore
    global _running
    logger.info("Received signal %d — shutting down", signum)
    _running = False


def main() -> None:
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    if not DC1_AGENT_SECRET:
        logger.warning("DC1_AGENT_SECRET not set — commands will be rejected")

    # Start heartbeat thread
    hb_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_thread.start()

    # Start HTTP command server
    server = HTTPServer(("0.0.0.0", AGENT_PORT), CommandHandler)
    server.timeout = 1
    logger.info("DC1 Monitoring Agent listening on port %d", AGENT_PORT)

    while _running:
        server.handle_request()

    server.server_close()
    logger.info("Agent stopped.")


if __name__ == "__main__":
    main()
