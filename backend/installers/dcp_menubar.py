#!/usr/bin/env python3
"""
DCP Provider — macOS Menu Bar App
Shows daemon status, provider info, and quick actions at a glance.

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

DASHBOARD_URL = "https://dcp.sa/provider"
POLL_INTERVAL = 30  # seconds between status checks


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
            # Strip surrounding quotes
            val = val.strip().strip("'\"")
            cfg[key.strip()] = val
    return cfg


# ─── DAEMON STATUS ───────────────────────────────────────────────────────────

def is_daemon_running():
    """Check if the DCP daemon process is alive."""
    # Check LaunchAgent first
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

    # Fallback: check PID file
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            os.kill(pid, 0)  # Signal 0 = check if alive
            return True
        except (ValueError, OSError):
            pass

    # Fallback: pgrep
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
                # DAEMON_VERSION = "3.3.2"
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
        # Walk backwards to find the last heartbeat line
        for line in reversed(lines[-200:]):
            if "Heartbeat HTTP" in line and "200" in line:
                # Parse timestamp: "2026-03-26 02:52:00,123"
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
                # Extract just the error part
                if "{'error':" in line:
                    start = line.index("{'error':")
                    return line[start:]
                return line.split("]", 1)[-1].strip() if "]" in line else line
    except Exception:
        pass
    return None


# ─── BACKEND API ─────────────────────────────────────────────────────────────

def fetch_provider_status(api_base, api_key):
    """Fetch provider status from the backend /me endpoint.

    The endpoint returns {"provider": {...}, "recent_jobs": [...]}.
    We unwrap and return the inner provider dict.
    """
    try:
        resp = requests.get(
            f"{api_base}/api/providers/me",
            params={"key": api_key},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Unwrap: endpoint returns {provider: {...}}
            return data.get("provider", data)
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
        raw += b'\x00'  # filter: none
        row_start = y * width * 4
        raw += pixels[row_start:row_start + width * 4]

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend


def _draw_hexagon(size, filled=True, alert=False):
    """Draw a hexagon icon as RGBA pixel data.

    - filled=True: solid hexagon (online)
    - filled=False: hollow hexagon outline (offline)
    - alert=True: adds a small dot in corner (warning)
    """
    pixels = bytearray(size * size * 4)
    cx, cy = size / 2, size / 2
    r = size * 0.40  # outer radius
    r_inner = r - max(2, size * 0.12)  # inner radius for outline

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
                    # Template image: use black pixels, alpha determines shape
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

            # Alert dot in bottom-right
            if alert:
                dot_cx, dot_cy = size * 0.78, size * 0.78
                dot_r = size * 0.15
                dist = math.sqrt((px - dot_cx)**2 + (py - dot_cy)**2)
                if dist <= dot_r:
                    pixels[idx:idx+4] = b'\x00\x00\x00\xff'

    return bytes(pixels)


def make_icon(state="online"):
    """Generate a menu bar icon PNG and return the file path.

    States: 'online' (filled), 'offline' (hollow), 'warning' (hollow+dot)
    """
    size = 32  # @2x for Retina
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
                    img.setSize_((16, 16))  # logical size (Retina uses 32px)
                    img.setTemplate_(True)  # adapts to dark/light menu bar
                    status_item.setImage_(img)
                    app.title = None
                    return True
    except Exception:
        pass
    return False


def set_menu_bar_icon(app, state="online"):
    """Set the menu bar icon, dispatching to main thread for safety."""
    icon_path = make_icon(state)
    # Store desired state so the timer callback can apply it
    app._pending_icon_path = icon_path


# ─── MENU BAR APP ────────────────────────────────────────────────────────────

class DCPMenuBarApp(rumps.App):
    def __init__(self):
        super().__init__(
            "DCP",
            title="DCP",  # Temporary text until icon loads
            quit_button=None,  # We'll add our own
        )

        # State
        self.daemon_running = False
        self.provider_info = None
        self.config = {}
        self.last_error = None

        # Menu items
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

        self.gpu_item = rumps.MenuItem("GPU: —")
        self.gpu_item.set_callback(None)

        self.separator1 = None

        self.dashboard_btn = rumps.MenuItem("Open Dashboard", callback=self.open_dashboard)
        self.logs_btn = rumps.MenuItem("View Logs", callback=self.view_logs)
        self.restart_btn = rumps.MenuItem("Restart Daemon", callback=self.restart_daemon)
        self.stop_btn = rumps.MenuItem("Stop Daemon", callback=self.stop_daemon)
        self.start_btn = rumps.MenuItem("Start Daemon", callback=self.start_daemon)
        self.refresh_btn = rumps.MenuItem("Refresh Now", callback=self.manual_refresh)
        self.quit_btn = rumps.MenuItem("Quit DCP Monitor", callback=self.quit_app)

        self.menu = [
            self.status_item,
            None,  # separator
            self.provider_item,
            self.gpu_item,
            self.version_item,
            self.heartbeat_item,
            self.earnings_item,
            None,  # separator
            self.dashboard_btn,
            self.logs_btn,
            None,  # separator
            self.restart_btn,
            self.stop_btn,
            self.start_btn,
            self.refresh_btn,
            None,  # separator
            self.quit_btn,
        ]

        # Pending icon path (set by background thread, applied by timer on main thread)
        self._pending_icon_path = None
        self._pending_status_data = None

        # Use a rumps Timer for main-thread UI updates (every 2s check for pending changes)
        self._ui_timer = rumps.Timer(self._apply_pending_ui, 2)
        self._ui_timer.start()

        # Background thread fetches data without touching UI directly
        self.poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self.poll_thread.start()

    def _poll_loop(self):
        """Background thread that periodically fetches status data."""
        # Initial fetch
        self._fetch_status_data()
        while True:
            time.sleep(POLL_INTERVAL)
            try:
                self._fetch_status_data()
            except Exception:
                pass

    def _apply_pending_ui(self, _timer):
        """Main-thread timer callback: apply any pending icon/UI changes."""
        # Apply pending icon
        icon_path = self._pending_icon_path
        if icon_path:
            self._pending_icon_path = None
            _apply_icon_on_main_thread(self, icon_path)

        # Apply pending status data
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

        info = None
        if api_key:
            info = fetch_provider_status(api_base, api_key)

        # Package everything — no UI touches here
        self._pending_status_data = {
            "config": config,
            "daemon_running": daemon_running,
            "version": version,
            "last_hb": last_hb,
            "last_error": last_error,
            "info": info,
        }

        # Set pending icon (file I/O only, no AppKit)
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

        self.config = config
        self.daemon_running = daemon_running

        # Status line
        if daemon_running:
            self.status_item.title = "⦿  Online — Daemon Running"
        else:
            self.status_item.title = "○  Offline — Daemon Stopped"

        # Daemon version
        self.version_item.title = f"Daemon: v{version}" if version else "Daemon: not installed"

        # Last heartbeat
        if last_hb:
            ago = datetime.now() - last_hb
            if ago < timedelta(minutes=1):
                hb_str = f"{int(ago.total_seconds())}s ago"
            elif ago < timedelta(hours=1):
                hb_str = f"{int(ago.total_seconds() / 60)}m ago"
            else:
                hb_str = last_hb.strftime("%H:%M:%S")
            self.heartbeat_item.title = f"Last heartbeat: {hb_str}"
        elif last_error:
            short = last_error[:60] + "…" if len(last_error) > 60 else last_error
            self.heartbeat_item.title = f"Heartbeat: ⚠ {short}"
        else:
            self.heartbeat_item.title = "Last heartbeat: —"

        # Backend info
        if info:
            self.provider_info = info
            self.provider_item.title = f"Provider: {info.get('name', 'Unknown')}"
            gpu = info.get("gpu_model") or info.get("gpu_name_detected") or "CPU only"
            self.gpu_item.title = f"GPU: {gpu}"

            earnings_halala = info.get("total_earnings_halala") or info.get("total_earnings") or 0
            if isinstance(earnings_halala, (int, float)) and earnings_halala > 0:
                sar = earnings_halala / 100 if earnings_halala > 100 else earnings_halala
                self.earnings_item.title = f"Earnings: {sar:.2f} SAR"
            else:
                self.earnings_item.title = "Earnings: 0.00 SAR"

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

        # Toggle start/stop
        self.start_btn.set_callback(self.start_daemon if not daemon_running else None)
        self.stop_btn.set_callback(self.stop_daemon if daemon_running else None)

    def open_dashboard(self, _):
        provider_id = self.config.get("DCP_PROVIDER_ID", "")
        webbrowser.open(DASHBOARD_URL)

    def view_logs(self, _):
        """Open the daemon log in Console.app or default text viewer."""
        if LOG_FILE.exists():
            subprocess.Popen(["open", str(LOG_FILE)])
        else:
            rumps.notification(
                "DCP Provider",
                "No logs found",
                f"Expected at: {LOG_FILE}",
            )

    def restart_daemon(self, _):
        """Restart the daemon via launchctl."""
        try:
            uid = os.getuid()
            subprocess.run(
                ["launchctl", "kickstart", "-k", f"gui/{uid}/{LAUNCHD_LABEL}"],
                capture_output=True, timeout=10,
            )
            rumps.notification("DCP Provider", "Daemon Restarted", "The daemon has been restarted.")
            time.sleep(2)
            self._update_status()
        except Exception as e:
            rumps.notification("DCP Provider", "Restart Failed", str(e))

    def stop_daemon(self, _):
        """Stop the daemon via launchctl."""
        try:
            uid = os.getuid()
            subprocess.run(
                ["launchctl", "bootout", f"gui/{uid}/{LAUNCHD_LABEL}"],
                capture_output=True, timeout=10,
            )
            rumps.notification("DCP Provider", "Daemon Stopped", "The daemon has been stopped.")
            time.sleep(2)
            self._update_status()
        except Exception as e:
            rumps.notification("DCP Provider", "Stop Failed", str(e))

    def start_daemon(self, _):
        """Start the daemon via launchctl."""
        plist = Path.home() / "Library" / "LaunchAgents" / f"{LAUNCHD_LABEL}.plist"
        if not plist.exists():
            rumps.notification(
                "DCP Provider",
                "Not Installed",
                "LaunchAgent not found. Run the installer first.",
            )
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
            self._update_status()
        except Exception as e:
            rumps.notification("DCP Provider", "Start Failed", str(e))

    def manual_refresh(self, _):
        self._fetch_status_data()
        # Data will be applied by _apply_pending_ui timer on next tick
        rumps.notification("DCP Provider", "Refreshing…", "Status will update shortly.")

    def quit_app(self, _):
        rumps.quit_application()


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    DCPMenuBarApp().run()
