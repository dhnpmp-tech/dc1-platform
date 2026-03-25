#!/usr/bin/env python3
"""
DCP Provider — macOS Menu Bar App v2.0
Shows daemon status, provider info, and quick actions at a glance.

Features:
  - Real-time status with hexagon icon (online/offline/warning)
  - Earnings ticker in menu bar title
  - Job activity feed (last 5 jobs)
  - GPU temperature & utilization display
  - macOS native notifications (job events, earnings milestones, daemon offline)
  - Auto-updater for menu bar app
  - Quick actions: start/stop/restart daemon, open dashboard, view logs

Requires: pip3 install rumps requests
"""

import os
import sys
import json
import time
import math
import struct
import zlib
import threading
import subprocess
import webbrowser
import hashlib
from pathlib import Path
from datetime import datetime, timedelta

try:
    import rumps
except ImportError:
    print("Installing rumps…")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "rumps", "-q"])
    import rumps

try:
    import requests
except ImportError:
    print("Installing requests…")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

try:
    from AppKit import NSImage, NSData
except ImportError:
    NSImage = None
    NSData = None

# ─── PATHS & CONSTANTS ──────────────────────────────────────────────────────

CONFIG_DIR = Path.home() / ".dcp"
CONFIG_FILE = CONFIG_DIR / "config"
INSTALL_DIR = Path.home() / "dcp-provider"
LOG_FILE = INSTALL_DIR / "logs" / "daemon.log"
DAEMON_PATH = INSTALL_DIR / "dc1_daemon.py"
PID_FILE = INSTALL_DIR / "dc1_daemon.pid"
LAUNCHD_LABEL = "com.dcp.provider"
MENUBAR_LAUNCHD_LABEL = "com.dcp.provider.menubar"

DASHBOARD_URL = "https://dcp.sa/provider"
POLL_INTERVAL = 30  # seconds between status checks
UI_TICK_INTERVAL = 2  # seconds between UI updates

MENUBAR_VERSION = "2.0.0"
MENUBAR_UPDATE_CHECK_INTERVAL = 3600  # check for updates every hour

# Notification tracking (prevent spamming)
_NOTIFICATION_STATE_FILE = CONFIG_DIR / "menubar_notification_state.json"
_EARNINGS_MILESTONES = [1, 10, 50, 100, 500, 1000, 5000]  # SAR


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


# ─── NOTIFICATION STATE ──────────────────────────────────────────────────────

def _load_notification_state():
    """Load notification state from disk."""
    try:
        if _NOTIFICATION_STATE_FILE.exists():
            return json.loads(_NOTIFICATION_STATE_FILE.read_text())
    except Exception:
        pass
    return {"milestones_reached": [], "last_job_id": None, "last_offline_alert": 0}


def _save_notification_state(state):
    """Save notification state to disk."""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        _NOTIFICATION_STATE_FILE.write_text(json.dumps(state))
    except Exception:
        pass


# ─── DAEMON STATUS ───────────────────────────────────────────────────────────

def is_daemon_running():
    """Check if the DCP daemon process is alive."""
    try:
        uid = os.getuid()
        result = subprocess.run(
            ["launchctl", "print", f"gui/{uid}/{LAUNCHD_LABEL}"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and "state = running" in result.stdout.lower():
            return True
    except Exception:
        pass

    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            os.kill(pid, 0)
            return True
        except (ValueError, OSError):
            pass

    try:
        result = subprocess.run(
            ["pgrep", "-f", str(DAEMON_PATH)],
            capture_output=True, text=True, timeout=5,
        )
        return result.returncode == 0
    except Exception:
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


def get_last_log_lines(n=20):
    """Read the last n lines from the daemon log."""
    if not LOG_FILE.exists():
        return "No log file found."
    try:
        lines = LOG_FILE.read_text().splitlines()
        return "\n".join(lines[-n:])
    except Exception as e:
        return f"Error reading log: {e}"


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


def get_last_heartbeat_error():
    """Get the most recent heartbeat error from the log."""
    if not LOG_FILE.exists():
        return None
    try:
        lines = LOG_FILE.read_text().splitlines()
        for line in reversed(lines[-100:]):
            if "Heartbeat HTTP" in line and ("WARNING" in line or "ERROR" in line):
                if "{'error':" in line:
                    start = line.index("{'error':")
                    return line[start:]
                return line.split("]", 1)[-1].strip() if "]" in line else line
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
            # Match job completion/failure/start lines
            if "Job assigned:" in line:
                ts_str = line[:19]
                job_id_part = line.split("Job assigned:")[1].strip().split()[0]
                job_type = "unknown"
                if "(type:" in line:
                    job_type = line.split("(type:")[1].split(")")[0].strip()
                jobs.append({
                    "timestamp": ts_str,
                    "job_id": job_id_part[:12],
                    "type": job_type,
                    "status": "started",
                    "icon": "▶",
                })
            elif "job_success" in line.lower() or "Job result submitted successfully" in line:
                ts_str = line[:19]
                jobs.append({
                    "timestamp": ts_str,
                    "job_id": "—",
                    "type": "job",
                    "status": "completed",
                    "icon": "✓",
                })
            elif "job_failure" in line.lower() or "Job CRASHED" in line:
                ts_str = line[:19]
                jobs.append({
                    "timestamp": ts_str,
                    "job_id": "—",
                    "type": "job",
                    "status": "failed",
                    "icon": "✗",
                })
    except Exception:
        pass
    return jobs[:n]


# ─── BACKEND API ─────────────────────────────────────────────────────────────

def fetch_provider_status(api_base, api_key):
    """Fetch provider status from the backend /me endpoint."""
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


def fetch_recent_jobs_from_api(api_base, api_key, limit=5):
    """Fetch recent jobs from the backend."""
    try:
        resp = requests.get(
            f"{api_base}/api/providers/me",
            params={"key": api_key},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("recent_jobs", [])[:limit]
    except Exception:
        pass
    return []


def check_menubar_update(api_base, api_key):
    """Check if a newer version of the menu bar app is available."""
    try:
        resp = requests.get(
            f"{api_base}/api/providers/download/menubar",
            params={"key": api_key, "check_only": "true"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            remote_version = data.get("version", "")
            if remote_version and remote_version != MENUBAR_VERSION:
                return remote_version
    except Exception:
        pass
    return None


# ─── ICON GENERATION ─────────────────────────────────────────────────────────

def _make_png(width, height, pixels):
    """Create a minimal RGBA PNG from raw pixel bytes (no PIL needed)."""
    def chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'
        row_start = y * width * 4
        raw += pixels[row_start:row_start + width * 4]

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend


def _draw_hexagon(size, filled=True, alert=False):
    """Draw a hexagon icon as RGBA pixel data."""
    pixels = bytearray(size * size * 4)
    cx, cy = size / 2, size / 2
    r = size * 0.40
    r_inner = r - max(2, size * 0.12)

    def in_hexagon(x, y, radius):
        dx, dy = x - cx, y - cy
        for i in range(6):
            angle = math.pi / 3 * i + math.pi / 6
            nx = math.cos(angle)
            ny = math.sin(angle)
            if dx * nx + dy * ny > radius:
                return False
        return True

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            px, py = x + 0.5, y + 0.5

            if filled:
                if in_hexagon(px, py, r):
                    pixels[idx:idx+4] = b'\x00\x00\x00\xff'
                else:
                    pixels[idx:idx+4] = b'\x00\x00\x00\x00'
            else:
                in_outer = in_hexagon(px, py, r)
                in_inner = in_hexagon(px, py, r_inner)
                if in_outer and not in_inner:
                    pixels[idx:idx+4] = b'\x00\x00\x00\xff'
                else:
                    pixels[idx:idx+4] = b'\x00\x00\x00\x00'

            if alert:
                dot_cx, dot_cy = size * 0.78, size * 0.78
                dot_r = size * 0.15
                dist = math.sqrt((px - dot_cx)**2 + (py - dot_cy)**2)
                if dist <= dot_r:
                    pixels[idx:idx+4] = b'\x00\x00\x00\xff'

    return bytes(pixels)


def make_icon(state="online"):
    """Generate a menu bar icon PNG and return the file path."""
    size = 32
    if state == "online":
        px = _draw_hexagon(size, filled=True)
    elif state == "warning":
        px = _draw_hexagon(size, filled=True, alert=True)
    else:
        px = _draw_hexagon(size, filled=False)

    png_data = _make_png(size, size, px)

    icon_dir = Path.home() / "dcp-provider" / ".icons"
    icon_dir.mkdir(parents=True, exist_ok=True)
    icon_path = icon_dir / f"dcp_{state}.png"
    icon_path.write_bytes(png_data)
    return str(icon_path)


def _apply_icon_on_main_thread(app, icon_path):
    """Apply the icon image — must be called from the main thread."""
    try:
        nsapp = getattr(app, '_nsapp', None)
        if nsapp and NSImage and NSData:
            status_item = getattr(nsapp, 'nsstatusitem', None)
            if status_item:
                data = NSData.dataWithContentsOfFile_(icon_path)
                if data:
                    img = NSImage.alloc().initWithData_(data)
                    img.setSize_((16, 16))
                    img.setTemplate_(True)
                    status_item.setImage_(img)
                    return True
    except Exception:
        pass
    return False


def set_menu_bar_icon(app, state="online"):
    """Set the menu bar icon, dispatching to main thread for safety."""
    icon_path = make_icon(state)
    app._pending_icon_path = icon_path


# ─── NOTIFICATION HELPERS ────────────────────────────────────────────────────

def _send_notification(title, subtitle, message, sound=True):
    """Send a macOS notification via rumps."""
    try:
        rumps.notification(title, subtitle, message, sound=sound)
    except Exception:
        pass


def _format_time_ago(dt):
    """Format a datetime as a human-readable 'X ago' string."""
    if not dt:
        return "—"
    ago = datetime.now() - dt
    if ago < timedelta(minutes=1):
        return f"{int(ago.total_seconds())}s ago"
    elif ago < timedelta(hours=1):
        return f"{int(ago.total_seconds() / 60)}m ago"
    elif ago < timedelta(hours=24):
        return f"{int(ago.total_seconds() / 3600)}h ago"
    else:
        return dt.strftime("%b %d %H:%M")


# ─── MENU BAR APP ────────────────────────────────────────────────────────────

class DCPMenuBarApp(rumps.App):
    def __init__(self):
        super().__init__(
            "DCP",
            title="DCP",
            quit_button=None,
        )

        # State
        self.daemon_running = False
        self.provider_info = None
        self.config = {}
        self.last_error = None
        self._prev_daemon_running = None
        self._prev_job_count = None
        self._notification_state = _load_notification_state()
        self._last_update_check = 0
        self._recent_api_jobs = []

        # ─── Menu items ─────────────────────────────────────────────────
        self.status_item = rumps.MenuItem("Status: Checking…")
        self.status_item.set_callback(None)

        self.provider_item = rumps.MenuItem("Provider: —")
        self.provider_item.set_callback(None)

        self.version_item = rumps.MenuItem("Daemon: —")
        self.version_item.set_callback(None)

        self.heartbeat_item = rumps.MenuItem("Last heartbeat: —")
        self.heartbeat_item.set_callback(None)

        self.earnings_item = rumps.MenuItem("Earnings: —")
        self.earnings_item.set_callback(None)

        # GPU metrics
        self.gpu_item = rumps.MenuItem("GPU: —")
        self.gpu_item.set_callback(None)

        self.gpu_temp_item = rumps.MenuItem("  Temp: —")
        self.gpu_temp_item.set_callback(None)

        self.gpu_util_item = rumps.MenuItem("  Utilization: —")
        self.gpu_util_item.set_callback(None)

        self.gpu_vram_item = rumps.MenuItem("  VRAM: —")
        self.gpu_vram_item.set_callback(None)

        self.gpu_power_item = rumps.MenuItem("  Power: —")
        self.gpu_power_item.set_callback(None)

        # Job activity feed
        self.jobs_header = rumps.MenuItem("Recent Jobs")
        self.jobs_header.set_callback(None)
        self.job_items = []
        for i in range(5):
            item = rumps.MenuItem(f"  —")
            item.set_callback(None)
            self.job_items.append(item)

        # Network info
        self.network_item = rumps.MenuItem("Network: —")
        self.network_item.set_callback(None)

        # Action buttons
        self.dashboard_btn = rumps.MenuItem("Open Dashboard", callback=self.open_dashboard)
        self.logs_btn = rumps.MenuItem("View Logs", callback=self.view_logs)
        self.restart_btn = rumps.MenuItem("Restart Daemon", callback=self.restart_daemon)
        self.stop_btn = rumps.MenuItem("Stop Daemon", callback=self.stop_daemon)
        self.start_btn = rumps.MenuItem("Start Daemon", callback=self.start_daemon)
        self.refresh_btn = rumps.MenuItem("Refresh Now", callback=self.manual_refresh)
        self.quit_btn = rumps.MenuItem("Quit DCP Monitor", callback=self.quit_app)

        self.menu = [
            self.status_item,
            None,
            self.provider_item,
            self.gpu_item,
            self.gpu_temp_item,
            self.gpu_util_item,
            self.gpu_vram_item,
            self.gpu_power_item,
            self.version_item,
            self.heartbeat_item,
            self.earnings_item,
            self.network_item,
            None,
            self.jobs_header,
            *self.job_items,
            None,
            self.dashboard_btn,
            self.logs_btn,
            None,
            self.restart_btn,
            self.stop_btn,
            self.start_btn,
            self.refresh_btn,
            None,
            self.quit_btn,
        ]

        # Pending state (set by background thread, applied by timer on main thread)
        self._pending_icon_path = None
        self._pending_status_data = None

        # Main-thread UI timer
        self._ui_timer = rumps.Timer(self._apply_pending_ui, UI_TICK_INTERVAL)
        self._ui_timer.start()

        # Background thread
        self.poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self.poll_thread.start()

    # ─── Background polling ──────────────────────────────────────────────

    def _poll_loop(self):
        """Background thread that periodically fetches status data."""
        self._fetch_status_data()
        while True:
            time.sleep(POLL_INTERVAL)
            try:
                self._fetch_status_data()
            except Exception:
                pass

    def _apply_pending_ui(self, _timer):
        """Main-thread timer callback: apply any pending icon/UI changes."""
        icon_path = self._pending_icon_path
        if icon_path:
            self._pending_icon_path = None
            _apply_icon_on_main_thread(self, icon_path)

        data = self._pending_status_data
        if data:
            self._pending_status_data = None
            self._apply_status_to_ui(data)

    def _fetch_status_data(self):
        """Background-thread safe: gather all status data into a dict."""
        config = load_config()
        daemon_running = is_daemon_running()
        api_key = config.get("DCP_PROVIDER_KEY", "")
        api_base = config.get("DCP_API_BASE", "https://api.dcp.sa")

        version = get_daemon_version()
        last_hb = get_last_heartbeat_from_log()
        last_error = get_last_heartbeat_error()
        log_jobs = parse_recent_jobs_from_log(5)

        info = None
        api_jobs = []
        if api_key:
            info = fetch_provider_status(api_base, api_key)
            api_jobs = fetch_recent_jobs_from_api(api_base, api_key, 5)

        # Auto-update check (once per hour)
        menubar_update = None
        now = time.time()
        if api_key and now - self._last_update_check > MENUBAR_UPDATE_CHECK_INTERVAL:
            self._last_update_check = now
            menubar_update = check_menubar_update(api_base, api_key)

        self._pending_status_data = {
            "config": config,
            "daemon_running": daemon_running,
            "version": version,
            "last_hb": last_hb,
            "last_error": last_error,
            "info": info,
            "api_jobs": api_jobs,
            "log_jobs": log_jobs,
            "menubar_update": menubar_update,
        }

        # Set pending icon
        if daemon_running:
            if info and info.get("approval_status") == "pending":
                set_menu_bar_icon(self, "warning")
            else:
                set_menu_bar_icon(self, "online")
        else:
            set_menu_bar_icon(self, "offline")

    def _apply_status_to_ui(self, data):
        """Main-thread only: apply gathered status data to menu items."""
        config = data["config"]
        daemon_running = data["daemon_running"]
        version = data["version"]
        last_hb = data["last_hb"]
        last_error = data["last_error"]
        info = data["info"]
        api_jobs = data.get("api_jobs", [])
        log_jobs = data.get("log_jobs", [])
        menubar_update = data.get("menubar_update")

        self.config = config
        self.daemon_running = daemon_running

        # ── Notifications ────────────────────────────────────────────────

        # Daemon went offline
        if self._prev_daemon_running is True and not daemon_running:
            _send_notification("DCP Provider", "Daemon Offline",
                               "Your provider daemon has stopped running.")
            self._notification_state["last_offline_alert"] = time.time()
            _save_notification_state(self._notification_state)

        # Daemon came online
        if self._prev_daemon_running is False and daemon_running:
            _send_notification("DCP Provider", "Daemon Online",
                               "Your provider daemon is now running.")

        self._prev_daemon_running = daemon_running

        # New job completed (check via API total_jobs count)
        if info:
            current_jobs = info.get("total_jobs", 0)
            if self._prev_job_count is not None and current_jobs > self._prev_job_count:
                new_count = current_jobs - self._prev_job_count
                _send_notification("DCP Provider", "Job Completed",
                                   f"{new_count} new job{'s' if new_count > 1 else ''} completed!")
            self._prev_job_count = current_jobs

            # Earnings milestones
            earnings_halala = info.get("total_earnings_halala") or info.get("total_earnings") or 0
            if isinstance(earnings_halala, (int, float)) and earnings_halala > 0:
                sar = earnings_halala / 100 if earnings_halala > 100 else earnings_halala
                reached = self._notification_state.get("milestones_reached", [])
                for milestone in _EARNINGS_MILESTONES:
                    if sar >= milestone and milestone not in reached:
                        _send_notification("DCP Provider", f"Earnings Milestone!",
                                           f"You've earned {milestone} SAR!")
                        reached.append(milestone)
                        self._notification_state["milestones_reached"] = reached
                        _save_notification_state(self._notification_state)

        # Menubar update available
        if menubar_update:
            _send_notification("DCP Provider", "Update Available",
                               f"Menu bar app v{menubar_update} is available. Restart to update.")

        # ── Status line ──────────────────────────────────────────────────
        if daemon_running:
            self.status_item.title = "⦿  Online — Daemon Running"
        else:
            self.status_item.title = "○  Offline — Daemon Stopped"

        # ── Daemon version ───────────────────────────────────────────────
        self.version_item.title = f"Daemon: v{version}" if version else "Daemon: not installed"

        # ── Last heartbeat ───────────────────────────────────────────────
        if last_hb:
            hb_str = _format_time_ago(last_hb)
            self.heartbeat_item.title = f"Last heartbeat: {hb_str}"
        elif last_error:
            short = last_error[:60] + "…" if len(last_error) > 60 else last_error
            self.heartbeat_item.title = f"Heartbeat: ⚠ {short}"
        else:
            self.heartbeat_item.title = "Last heartbeat: —"

        # ── Backend info ─────────────────────────────────────────────────
        earnings_sar = 0.0
        today_earnings_sar = 0.0

        if info:
            self.provider_info = info
            self.provider_item.title = f"Provider: {info.get('name', 'Unknown')}"

            gpu = info.get("gpu_model") or info.get("gpu_name_detected") or "CPU only"
            self.gpu_item.title = f"GPU: {gpu}"

            # GPU metrics from heartbeat data stored on provider
            gpu_status = info.get("gpu_status") or {}
            temp_c = gpu_status.get("temp_c")
            gpu_util = gpu_status.get("gpu_util_pct")
            vram_total = gpu_status.get("gpu_vram_mib") or gpu_status.get("vram_mb")
            vram_used = gpu_status.get("memory_used_mb")
            power_w = gpu_status.get("power_w")
            gpu_count = gpu_status.get("gpu_count", 1)

            # GPU temperature
            if temp_c is not None:
                temp_icon = "🟢" if temp_c < 70 else ("🟡" if temp_c < 85 else "🔴")
                self.gpu_temp_item.title = f"  {temp_icon} Temp: {temp_c}°C"
            else:
                self.gpu_temp_item.title = "  Temp: —"

            # GPU utilization
            if gpu_util is not None:
                bar = _make_bar(gpu_util, 100)
                self.gpu_util_item.title = f"  Util: {bar} {gpu_util}%"
            else:
                self.gpu_util_item.title = "  Utilization: —"

            # VRAM usage
            if vram_total and vram_used:
                vram_pct = round(vram_used / vram_total * 100) if vram_total > 0 else 0
                bar = _make_bar(vram_pct, 100)
                self.gpu_vram_item.title = f"  VRAM: {bar} {vram_used}/{vram_total} MiB"
            else:
                self.gpu_vram_item.title = "  VRAM: —"

            # Power draw
            if power_w is not None:
                self.gpu_power_item.title = f"  Power: {power_w:.0f}W"
                if gpu_count > 1:
                    self.gpu_power_item.title += f" ({gpu_count} GPUs)"
            else:
                self.gpu_power_item.title = "  Power: —"

            # Earnings
            earnings_halala = info.get("total_earnings_halala") or info.get("total_earnings") or 0
            if isinstance(earnings_halala, (int, float)) and earnings_halala > 0:
                earnings_sar = earnings_halala / 100 if earnings_halala > 100 else earnings_halala
            self.earnings_item.title = f"Earnings: {earnings_sar:.2f} SAR (total)"

            # Today's earnings if available
            today_halala = info.get("today_earnings_halala", 0)
            if isinstance(today_halala, (int, float)) and today_halala > 0:
                today_earnings_sar = today_halala / 100 if today_halala > 100 else today_halala

            # Network info
            bandwidth = info.get("bandwidth") or gpu_status.get("bandwidth") or {}
            if bandwidth:
                dl = bandwidth.get("download_mbps")
                ul = bandwidth.get("upload_mbps")
                lat = bandwidth.get("latency_ms")
                parts = []
                if dl is not None:
                    parts.append(f"↓{dl} Mbps")
                if ul is not None:
                    parts.append(f"↑{ul} Mbps")
                if lat is not None:
                    parts.append(f"{lat}ms")
                self.network_item.title = f"Network: {' | '.join(parts)}" if parts else "Network: —"
            else:
                self.network_item.title = "Network: —"

            backend_status = info.get("status", "unknown")
            approval = info.get("approval_status", "unknown")
            if daemon_running:
                if approval == "pending":
                    self.status_item.title = "⦿  Daemon Running — Awaiting Approval"
                elif backend_status == "online":
                    self.status_item.title = "⦿  Online — Active"
                else:
                    self.status_item.title = f"⦿  Daemon Running — {backend_status}"
        elif config.get("DCP_PROVIDER_KEY"):
            self.provider_item.title = f"Provider: {config.get('DCP_PROVIDER_NAME', '—')}"
        else:
            self.provider_item.title = "Provider: Not configured"
            self.status_item.title = "○  Not configured — Run installer"

        # ── Earnings ticker in menu bar title ────────────────────────────
        if daemon_running and earnings_sar > 0:
            if today_earnings_sar > 0:
                self.title = f" {today_earnings_sar:.2f}"
            else:
                self.title = f" {earnings_sar:.2f}"
        elif daemon_running:
            self.title = None  # Icon only
        else:
            self.title = None

        # ── Job activity feed ────────────────────────────────────────────
        # Prefer API jobs, fall back to log-parsed jobs
        jobs_to_show = api_jobs if api_jobs else log_jobs
        for i, item in enumerate(self.job_items):
            if i < len(jobs_to_show):
                job = jobs_to_show[i]
                if isinstance(job, dict):
                    # API job format
                    if "job_type" in job:
                        status = job.get("status", "unknown")
                        icon = {"completed": "✓", "failed": "✗", "running": "▶"}.get(status, "•")
                        jtype = job.get("job_type", "—")
                        earned = ""
                        cost = job.get("cost_halala", 0)
                        if cost:
                            earned = f" +{cost/100:.2f}"
                        created = job.get("created_at", "")[:16]
                        item.title = f"  {icon} {jtype} — {status}{earned}  ({created})"
                    # Log-parsed format
                    elif "icon" in job:
                        item.title = f"  {job['icon']} {job['type']} — {job['status']}  ({job.get('timestamp', '')[:16]})"
                    else:
                        item.title = f"  • {json.dumps(job)[:50]}"
                else:
                    item.title = f"  • {str(job)[:50]}"
            else:
                item.title = "  —"

        # ── Toggle start/stop buttons ────────────────────────────────────
        self.start_btn.set_callback(self.start_daemon if not daemon_running else None)
        self.stop_btn.set_callback(self.stop_daemon if daemon_running else None)

    # ─── Actions ─────────────────────────────────────────────────────────

    def open_dashboard(self, _):
        webbrowser.open(DASHBOARD_URL)

    def view_logs(self, _):
        if LOG_FILE.exists():
            subprocess.Popen(["open", str(LOG_FILE)])
        else:
            rumps.notification("DCP Provider", "No logs found", f"Expected at: {LOG_FILE}")

    def restart_daemon(self, _):
        try:
            uid = os.getuid()
            subprocess.run(
                ["launchctl", "kickstart", "-k", f"gui/{uid}/{LAUNCHD_LABEL}"],
                capture_output=True, timeout=10,
            )
            rumps.notification("DCP Provider", "Daemon Restarted", "The daemon has been restarted.")
            time.sleep(2)
            self._fetch_status_data()
        except Exception as e:
            rumps.notification("DCP Provider", "Restart Failed", str(e))

    def stop_daemon(self, _):
        try:
            uid = os.getuid()
            subprocess.run(
                ["launchctl", "bootout", f"gui/{uid}/{LAUNCHD_LABEL}"],
                capture_output=True, timeout=10,
            )
            rumps.notification("DCP Provider", "Daemon Stopped", "The daemon has been stopped.")
            time.sleep(2)
            self._fetch_status_data()
        except Exception as e:
            rumps.notification("DCP Provider", "Stop Failed", str(e))

    def start_daemon(self, _):
        plist = Path.home() / "Library" / "LaunchAgents" / f"{LAUNCHD_LABEL}.plist"
        if not plist.exists():
            rumps.notification("DCP Provider", "Not Installed",
                               "LaunchAgent not found. Run the installer first.")
            return
        try:
            uid = os.getuid()
            subprocess.run(
                ["launchctl", "bootstrap", f"gui/{uid}", str(plist)],
                capture_output=True, timeout=10,
            )
            subprocess.run(
                ["launchctl", "kickstart", f"gui/{uid}/{LAUNCHD_LABEL}"],
                capture_output=True, timeout=10,
            )
            rumps.notification("DCP Provider", "Daemon Started", "The daemon is starting up.")
            time.sleep(3)
            self._fetch_status_data()
        except Exception as e:
            rumps.notification("DCP Provider", "Start Failed", str(e))

    def manual_refresh(self, _):
        self._fetch_status_data()
        rumps.notification("DCP Provider", "Refreshing…", "Status will update shortly.")

    def quit_app(self, _):
        rumps.quit_application()


# ─── UTILITY ─────────────────────────────────────────────────────────────────

def _make_bar(value, max_val, width=8):
    """Create a text progress bar like [████░░░░]."""
    if max_val <= 0:
        return "[" + "░" * width + "]"
    filled = round(value / max_val * width)
    filled = max(0, min(width, filled))
    return "[" + "█" * filled + "░" * (width - filled) + "]"


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    DCPMenuBarApp().run()
