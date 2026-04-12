#!/usr/bin/env python3
"""
DCP Provider — Windows System Tray App v2.0
Shows daemon status, provider info, and quick actions in the Windows notification area.

Requires: pip install pystray Pillow requests
"""

import os
import sys
import json
import time
import math
import threading
import subprocess
import webbrowser
from pathlib import Path
from datetime import datetime, timedelta

try:
    import pystray
    from pystray import MenuItem as item
except ImportError:
    print("Installing pystray…")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pystray", "-q"])
    import pystray
    from pystray import MenuItem as item

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Installing Pillow…")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
    from PIL import Image, ImageDraw

try:
    import requests
except ImportError:
    print("Installing requests…")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

# ─── PATHS & CONSTANTS ──────────────────────────────────────────────────────

CONFIG_DIR = Path.home() / ".dcp"
CONFIG_FILE = CONFIG_DIR / "config"
INSTALL_DIR = Path.home() / "dcp-provider"
LOG_FILE = INSTALL_DIR / "logs" / "daemon.log"
DAEMON_PATH = INSTALL_DIR / "dcp_daemon.py"
PID_FILE = INSTALL_DIR / "dcp_daemon.pid"

DASHBOARD_URL = "https://dcp.sa/provider"
POLL_INTERVAL = 30
TRAY_VERSION = "2.0.0"
SERVICE_NAME = "DCPProvider"

# Notification state
_notification_state = {"last_job_count": None, "last_offline_alert": 0}
_MILESTONES = [1, 10, 50, 100, 500, 1000, 5000]


# ─── CONFIG LOADING ──────────────────────────────────────────────────────────

def load_config():
    """Read the shell-style config file (~/.dcp/config) into a dict."""
    cfg = {}
    if not CONFIG_FILE.exists():
        return cfg
    for line in CONFIG_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            val = val.strip().strip("'\"")
            cfg[key.strip()] = val
    return cfg


# ─── DAEMON STATUS ───────────────────────────────────────────────────────────

def is_daemon_running():
    """Check if the DCP daemon process is alive (Windows)."""
    # Check via tasklist
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"IMAGENAME eq python*", "/FO", "CSV"],
            capture_output=True, text=True, timeout=5,
        )
        if "dcp_daemon" in result.stdout.lower() or "dc1_daemon" in result.stdout.lower():
            return True
    except Exception:
        pass

    # Check via PID file
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            # Check if PID exists on Windows
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV"],
                capture_output=True, text=True, timeout=5,
            )
            if str(pid) in result.stdout:
                return True
        except (ValueError, OSError):
            pass

    # Check via Windows service
    try:
        result = subprocess.run(
            ["sc", "query", SERVICE_NAME],
            capture_output=True, text=True, timeout=5,
        )
        if "RUNNING" in result.stdout:
            return True
    except Exception:
        pass

    return False


def get_daemon_version():
    """Read DAEMON_VERSION from the installed daemon script."""
    if not DAEMON_PATH.exists():
        return None
    try:
        for line in DAEMON_PATH.read_text().splitlines()[:100]:
            if line.strip().startswith("DAEMON_VERSION"):
                return line.split("=", 1)[1].strip().strip('"\'')
    except Exception:
        pass
    return None


def get_last_heartbeat_from_log():
    """Parse the last successful heartbeat timestamp from the log."""
    if not LOG_FILE.exists():
        return None
    try:
        lines = LOG_FILE.read_text().splitlines()
        for line in reversed(lines[-200:]):
            if "Heartbeat HTTP" in line and "200" in line:
                ts_str = line[:23]
                return datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S,%f")
            if "Heartbeat" in line and "WARNING" not in line and "ERROR" not in line:
                ts_str = line[:23]
                try:
                    return datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S,%f")
                except ValueError:
                    continue
    except Exception:
        pass
    return None


def parse_recent_jobs_from_log(n=5):
    """Parse recent job activity from the daemon log."""
    jobs = []
    if not LOG_FILE.exists():
        return jobs
    try:
        lines = LOG_FILE.read_text().splitlines()
        for line in reversed(lines[-500:]):
            if len(jobs) >= n:
                break
            if "Job assigned:" in line:
                ts_str = line[:19]
                job_type = "unknown"
                if "(type:" in line:
                    job_type = line.split("(type:")[1].split(")")[0].strip()
                jobs.append(f"▶ {job_type} ({ts_str[:10]})")
            elif "job_success" in line.lower():
                jobs.append(f"✓ completed ({line[:10]})")
            elif "job_failure" in line.lower():
                jobs.append(f"✗ failed ({line[:10]})")
    except Exception:
        pass
    return jobs[:n]


# ─── BACKEND API ─────────────────────────────────────────────────────────────

def fetch_provider_status(api_base, api_key):
    """Fetch provider status from the backend."""
    try:
        resp = requests.get(
            f"{api_base}/api/providers/me",
            params={"key": api_key},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("provider", data)
    except Exception:
        pass
    return None


# ─── ICON GENERATION ─────────────────────────────────────────────────────────

def make_hexagon_icon(state="online", size=64):
    """Generate a hexagon icon using Pillow."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2
    r = size * 0.42

    # Calculate hexagon vertices
    points = []
    for i in range(6):
        angle = math.pi / 3 * i - math.pi / 6
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        points.append((x, y))

    if state == "online":
        # Filled green hexagon
        draw.polygon(points, fill=(76, 175, 80, 255))
    elif state == "warning":
        # Filled orange hexagon
        draw.polygon(points, fill=(255, 152, 0, 255))
        # Small alert dot
        dot_r = size * 0.12
        draw.ellipse([size*0.72-dot_r, size*0.72-dot_r, size*0.72+dot_r, size*0.72+dot_r],
                      fill=(244, 67, 54, 255))
    else:
        # Hollow gray hexagon
        draw.polygon(points, outline=(158, 158, 158, 255), width=max(2, size // 16))

    return img


# ─── NOTIFICATION ────────────────────────────────────────────────────────────

def send_notification(icon, title, message):
    """Send a Windows notification via pystray."""
    try:
        icon.notify(message, title)
    except Exception:
        pass


# ─── TRAY APP ────────────────────────────────────────────────────────────────

class DCPTrayApp:
    def __init__(self):
        self.daemon_running = False
        self.provider_info = None
        self.config = {}
        self.status_text = "Checking…"
        self.provider_name = "—"
        self.gpu_text = "GPU: —"
        self.heartbeat_text = "Heartbeat: —"
        self.earnings_text = "Earnings: —"
        self.gpu_temp_text = "Temp: —"
        self.gpu_util_text = "Util: —"
        self.network_text = "Network: —"
        self.version_text = "Daemon: —"
        self.job_texts = ["—"] * 5
        self._prev_running = None
        self._prev_job_count = None

        self.icon = pystray.Icon(
            "DCP Provider",
            make_hexagon_icon("offline"),
            "DCP Provider — Checking…",
            menu=self._build_menu()
        )

    def _build_menu(self):
        return pystray.Menu(
            item(lambda t: self.status_text, None, enabled=False),
            pystray.Menu.SEPARATOR,
            item(lambda t: self.provider_name, None, enabled=False),
            item(lambda t: self.gpu_text, None, enabled=False),
            item(lambda t: self.gpu_temp_text, None, enabled=False),
            item(lambda t: self.gpu_util_text, None, enabled=False),
            item(lambda t: self.version_text, None, enabled=False),
            item(lambda t: self.heartbeat_text, None, enabled=False),
            item(lambda t: self.earnings_text, None, enabled=False),
            item(lambda t: self.network_text, None, enabled=False),
            pystray.Menu.SEPARATOR,
            item("Recent Jobs", pystray.Menu(
                item(lambda t: self.job_texts[0], None, enabled=False),
                item(lambda t: self.job_texts[1], None, enabled=False),
                item(lambda t: self.job_texts[2], None, enabled=False),
                item(lambda t: self.job_texts[3], None, enabled=False),
                item(lambda t: self.job_texts[4], None, enabled=False),
            )),
            pystray.Menu.SEPARATOR,
            item("Open Dashboard", self._open_dashboard),
            item("View Logs", self._view_logs),
            pystray.Menu.SEPARATOR,
            item("Restart Daemon", self._restart_daemon),
            item("Stop Daemon", self._stop_daemon, visible=lambda i: self.daemon_running),
            item("Start Daemon", self._start_daemon, visible=lambda i: not self.daemon_running),
            item("Refresh", self._refresh),
            pystray.Menu.SEPARATOR,
            item("Quit", self._quit),
        )

    def _poll_loop(self):
        """Background polling thread."""
        while True:
            try:
                self._update_status()
            except Exception:
                pass
            time.sleep(POLL_INTERVAL)

    def _update_status(self):
        """Fetch status and update tray icon/menu."""
        config = load_config()
        self.config = config
        daemon_running = is_daemon_running()
        self.daemon_running = daemon_running

        version = get_daemon_version()
        self.version_text = f"Daemon: v{version}" if version else "Daemon: not installed"

        last_hb = get_last_heartbeat_from_log()
        if last_hb:
            ago = datetime.now() - last_hb
            if ago < timedelta(minutes=1):
                self.heartbeat_text = f"Heartbeat: {int(ago.total_seconds())}s ago"
            else:
                self.heartbeat_text = f"Heartbeat: {int(ago.total_seconds() / 60)}m ago"
        else:
            self.heartbeat_text = "Heartbeat: —"

        # Job feed
        jobs = parse_recent_jobs_from_log(5)
        for i in range(5):
            self.job_texts[i] = jobs[i] if i < len(jobs) else "—"

        api_key = config.get("DCP_PROVIDER_KEY", "")
        api_base = config.get("DCP_API_BASE", "https://api.dcp.sa")
        info = None
        if api_key:
            info = fetch_provider_status(api_base, api_key)

        if info:
            self.provider_info = info
            self.provider_name = f"Provider: {info.get('name', 'Unknown')}"
            gpu = info.get("gpu_model") or info.get("gpu_name_detected") or "CPU only"
            self.gpu_text = f"GPU: {gpu}"

            gpu_status = info.get("gpu_status") or {}
            temp = gpu_status.get("temp_c")
            util = gpu_status.get("gpu_util_pct")
            self.gpu_temp_text = f"Temp: {temp}°C" if temp is not None else "Temp: —"
            self.gpu_util_text = f"Util: {util}%" if util is not None else "Util: —"

            earnings = info.get("total_earnings_halala", 0) or 0
            sar = earnings / 100 if earnings > 100 else earnings
            self.earnings_text = f"Earnings: {sar:.2f} SAR"

            bandwidth = info.get("bandwidth") or gpu_status.get("bandwidth") or {}
            if bandwidth:
                parts = []
                if bandwidth.get("download_mbps"): parts.append(f"↓{bandwidth['download_mbps']} Mbps")
                if bandwidth.get("upload_mbps"): parts.append(f"↑{bandwidth['upload_mbps']} Mbps")
                if bandwidth.get("latency_ms"): parts.append(f"{bandwidth['latency_ms']}ms")
                self.network_text = f"Network: {' | '.join(parts)}" if parts else "Network: —"

            status = info.get("status", "unknown")
            approval = info.get("approval_status", "unknown")
            if daemon_running:
                if approval == "pending":
                    self.status_text = "⦿ Daemon Running — Awaiting Approval"
                    self.icon.icon = make_hexagon_icon("warning")
                elif status == "online":
                    self.status_text = "⦿ Online — Active"
                    self.icon.icon = make_hexagon_icon("online")
                else:
                    self.status_text = f"⦿ Daemon Running — {status}"
                    self.icon.icon = make_hexagon_icon("online")
            else:
                self.status_text = "○ Offline — Daemon Stopped"
                self.icon.icon = make_hexagon_icon("offline")

            # Notifications
            current_jobs = info.get("total_jobs", 0)
            if self._prev_job_count is not None and current_jobs > self._prev_job_count:
                send_notification(self.icon, "DCP Provider",
                    f"{current_jobs - self._prev_job_count} new job(s) completed!")
            self._prev_job_count = current_jobs
        else:
            if daemon_running:
                self.status_text = "⦿ Online — Daemon Running"
                self.icon.icon = make_hexagon_icon("online")
            else:
                self.status_text = "○ Offline — Daemon Stopped"
                self.icon.icon = make_hexagon_icon("offline")

        # Daemon state change notifications
        if self._prev_running is True and not daemon_running:
            send_notification(self.icon, "DCP Provider", "Daemon has stopped running.")
        elif self._prev_running is False and daemon_running:
            send_notification(self.icon, "DCP Provider", "Daemon is now running.")
        self._prev_running = daemon_running

        # Update tooltip
        self.icon.title = f"DCP Provider — {self.status_text}"
        self.icon.update_menu()

    # ─── Actions ─────────────────────────────────────────────────────────

    def _open_dashboard(self, icon, item):
        webbrowser.open(DASHBOARD_URL)

    def _view_logs(self, icon, item):
        if LOG_FILE.exists():
            os.startfile(str(LOG_FILE))
        else:
            send_notification(icon, "DCP Provider", f"No log file at {LOG_FILE}")

    def _restart_daemon(self, icon, item):
        try:
            subprocess.run([sys.executable, str(DAEMON_PATH), "--key",
                          self.config.get("DCP_PROVIDER_KEY", "")], timeout=2)
        except Exception:
            pass
        send_notification(icon, "DCP Provider", "Daemon restart requested.")

    def _stop_daemon(self, icon, item):
        try:
            if PID_FILE.exists():
                pid = int(PID_FILE.read_text().strip())
                subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, timeout=5)
                send_notification(icon, "DCP Provider", "Daemon stopped.")
        except Exception as e:
            send_notification(icon, "DCP Provider", f"Stop failed: {e}")

    def _start_daemon(self, icon, item):
        try:
            key = self.config.get("DCP_PROVIDER_KEY", "")
            subprocess.Popen([sys.executable, str(DAEMON_PATH), "--key", key],
                           creationflags=subprocess.CREATE_NO_WINDOW)
            send_notification(icon, "DCP Provider", "Daemon starting…")
        except Exception as e:
            send_notification(icon, "DCP Provider", f"Start failed: {e}")

    def _refresh(self, icon, item):
        self._update_status()
        send_notification(icon, "DCP Provider", "Status refreshed.")

    def _quit(self, icon, item):
        icon.stop()

    def run(self):
        """Start the tray app."""
        poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        poll_thread.start()
        self._update_status()
        self.icon.run()


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    DCPTrayApp().run()
