#!/usr/bin/env python3
"""
DCP Provider — Linux Desktop Panel Widget v2.0
Shows daemon status, provider info, and quick actions in the system tray/panel.

Supports both AppIndicator3 (Ubuntu/GNOME) and pystray (fallback for any DE).

Requires: pip install requests
  For AppIndicator: sudo apt install gir1.2-appindicator3-0.1 python3-gi
  For fallback:     pip install pystray Pillow
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
DAEMON_PATH = INSTALL_DIR / "dc1_daemon.py"
PID_FILE = INSTALL_DIR / "dc1_daemon.pid"
SYSTEMD_SERVICE = "dcp-provider"

DASHBOARD_URL = "https://dcp.sa/provider"
POLL_INTERVAL = 30
TRAY_VERSION = "2.0.0"

# Icon paths
ICON_DIR = Path.home() / "dcp-provider" / ".icons"


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
    """Check if the DCP daemon process is alive (Linux)."""
    # Check systemd service first
    try:
        result = subprocess.run(
            ["systemctl", "--user", "is-active", SYSTEMD_SERVICE],
            capture_output=True, text=True, timeout=5,
        )
        if result.stdout.strip() == "active":
            return True
    except Exception:
        pass

    # Check PID file
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            os.kill(pid, 0)
            return True
        except (ValueError, OSError):
            pass

    # Check via pgrep
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
                job_type = "unknown"
                if "(type:" in line:
                    job_type = line.split("(type:")[1].split(")")[0].strip()
                jobs.append(f"▶ {job_type} ({line[:10]})")
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


# ─── SVG ICON GENERATION ────────────────────────────────────────────────────

def _generate_svg_icon(state="online"):
    """Generate an SVG hexagon icon for the tray."""
    colors = {
        "online": "#4CAF50",
        "warning": "#FF9800",
        "offline": "#9E9E9E",
    }
    color = colors.get(state, colors["offline"])

    if state == "offline":
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
  <polygon points="11,1 20,5.5 20,16.5 11,21 2,16.5 2,5.5"
           fill="none" stroke="{color}" stroke-width="2"/>
</svg>'''
    else:
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
  <polygon points="11,1 20,5.5 20,16.5 11,21 2,16.5 2,5.5"
           fill="{color}" stroke="{color}" stroke-width="1"/>
</svg>'''
        if state == "warning":
            svg = svg.replace('</svg>', '''
  <circle cx="18" cy="18" r="3" fill="#F44336"/>
</svg>''')

    return svg


def ensure_icons():
    """Generate SVG icons if they don't exist."""
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    for state in ["online", "offline", "warning"]:
        path = ICON_DIR / f"dcp_{state}.svg"
        if not path.exists():
            path.write_text(_generate_svg_icon(state))
    return ICON_DIR


# ─── DESKTOP NOTIFICATIONS ──────────────────────────────────────────────────

def send_notification(title, message):
    """Send a desktop notification via notify-send."""
    try:
        subprocess.Popen(
            ["notify-send", "-i", str(ICON_DIR / "dcp_online.svg"),
             "--app-name=DCP Provider", title, message],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


# ─── GTK/APPINDICATOR TRAY ──────────────────────────────────────────────────

def try_appindicator():
    """Try to use AppIndicator3 (GNOME/Ubuntu)."""
    try:
        import gi
        gi.require_version('Gtk', '3.0')
        gi.require_version('AppIndicator3', '0.1')
        from gi.repository import Gtk, AppIndicator3, GLib
        return Gtk, AppIndicator3, GLib
    except (ImportError, ValueError):
        return None, None, None


def run_appindicator_tray():
    """Run the tray using AppIndicator3."""
    Gtk, AppIndicator3, GLib = try_appindicator()

    ensure_icons()

    indicator = AppIndicator3.Indicator.new(
        "dcp-provider",
        str(ICON_DIR / "dcp_offline.svg"),
        AppIndicator3.IndicatorCategory.APPLICATION_STATUS,
    )
    indicator.set_status(AppIndicator3.IndicatorStatus.ACTIVE)

    # State
    state = {
        "daemon_running": False,
        "info": None,
        "config": {},
        "prev_running": None,
        "prev_jobs": None,
    }

    def build_menu():
        menu = Gtk.Menu()

        # Status
        status = Gtk.MenuItem(label="Status: Checking…")
        status.set_sensitive(False)
        menu.append(status)

        menu.append(Gtk.SeparatorMenuItem())

        provider = Gtk.MenuItem(label="Provider: —")
        provider.set_sensitive(False)
        menu.append(provider)

        gpu = Gtk.MenuItem(label="GPU: —")
        gpu.set_sensitive(False)
        menu.append(gpu)

        temp = Gtk.MenuItem(label="Temp: —")
        temp.set_sensitive(False)
        menu.append(temp)

        util = Gtk.MenuItem(label="Util: —")
        util.set_sensitive(False)
        menu.append(util)

        version = Gtk.MenuItem(label="Daemon: —")
        version.set_sensitive(False)
        menu.append(version)

        heartbeat = Gtk.MenuItem(label="Heartbeat: —")
        heartbeat.set_sensitive(False)
        menu.append(heartbeat)

        earnings = Gtk.MenuItem(label="Earnings: —")
        earnings.set_sensitive(False)
        menu.append(earnings)

        network = Gtk.MenuItem(label="Network: —")
        network.set_sensitive(False)
        menu.append(network)

        menu.append(Gtk.SeparatorMenuItem())

        # Jobs submenu
        jobs_item = Gtk.MenuItem(label="Recent Jobs")
        jobs_sub = Gtk.Menu()
        job_items = []
        for i in range(5):
            ji = Gtk.MenuItem(label="  —")
            ji.set_sensitive(False)
            jobs_sub.append(ji)
            job_items.append(ji)
        jobs_item.set_submenu(jobs_sub)
        menu.append(jobs_item)

        menu.append(Gtk.SeparatorMenuItem())

        # Actions
        dashboard = Gtk.MenuItem(label="Open Dashboard")
        dashboard.connect("activate", lambda _: webbrowser.open(DASHBOARD_URL))
        menu.append(dashboard)

        logs = Gtk.MenuItem(label="View Logs")
        logs.connect("activate", lambda _: subprocess.Popen(["xdg-open", str(LOG_FILE)]))
        menu.append(logs)

        menu.append(Gtk.SeparatorMenuItem())

        restart = Gtk.MenuItem(label="Restart Daemon")
        restart.connect("activate", lambda _: restart_daemon())
        menu.append(restart)

        stop = Gtk.MenuItem(label="Stop Daemon")
        stop.connect("activate", lambda _: stop_daemon())
        menu.append(stop)

        start = Gtk.MenuItem(label="Start Daemon")
        start.connect("activate", lambda _: start_daemon(state["config"]))
        menu.append(start)

        menu.append(Gtk.SeparatorMenuItem())

        quit_item = Gtk.MenuItem(label="Quit")
        quit_item.connect("activate", lambda _: Gtk.main_quit())
        menu.append(quit_item)

        menu.show_all()

        return {
            "menu": menu,
            "status": status,
            "provider": provider,
            "gpu": gpu,
            "temp": temp,
            "util": util,
            "version": version,
            "heartbeat": heartbeat,
            "earnings": earnings,
            "network": network,
            "job_items": job_items,
            "stop": stop,
            "start": start,
        }

    items = build_menu()
    indicator.set_menu(items["menu"])

    def update():
        """Periodic update (runs in GLib main loop)."""
        config = load_config()
        state["config"] = config
        daemon_running = is_daemon_running()
        state["daemon_running"] = daemon_running

        ver = get_daemon_version()
        items["version"].set_label(f"Daemon: v{ver}" if ver else "Daemon: not installed")

        hb = get_last_heartbeat_from_log()
        if hb:
            ago = datetime.now() - hb
            if ago < timedelta(minutes=1):
                items["heartbeat"].set_label(f"Heartbeat: {int(ago.total_seconds())}s ago")
            else:
                items["heartbeat"].set_label(f"Heartbeat: {int(ago.total_seconds()/60)}m ago")
        else:
            items["heartbeat"].set_label("Heartbeat: —")

        # Jobs
        jobs = parse_recent_jobs_from_log(5)
        for i in range(5):
            items["job_items"][i].set_label(f"  {jobs[i]}" if i < len(jobs) else "  —")

        api_key = config.get("DCP_PROVIDER_KEY", "")
        api_base = config.get("DCP_API_BASE", "https://api.dcp.sa")
        info = None
        if api_key:
            info = fetch_provider_status(api_base, api_key)
        state["info"] = info

        if info:
            items["provider"].set_label(f"Provider: {info.get('name', 'Unknown')}")
            gpu_name = info.get("gpu_model") or info.get("gpu_name_detected") or "CPU only"
            items["gpu"].set_label(f"GPU: {gpu_name}")

            gpu_status = info.get("gpu_status") or {}
            t = gpu_status.get("temp_c")
            u = gpu_status.get("gpu_util_pct")
            items["temp"].set_label(f"Temp: {t}°C" if t is not None else "Temp: —")
            items["util"].set_label(f"Util: {u}%" if u is not None else "Util: —")

            earnings = info.get("total_earnings_halala", 0) or 0
            sar = earnings / 100 if earnings > 100 else earnings
            items["earnings"].set_label(f"Earnings: {sar:.2f} SAR")

            bw = info.get("bandwidth") or gpu_status.get("bandwidth") or {}
            if bw:
                parts = []
                if bw.get("download_mbps"): parts.append(f"↓{bw['download_mbps']}")
                if bw.get("upload_mbps"): parts.append(f"↑{bw['upload_mbps']}")
                if bw.get("latency_ms"): parts.append(f"{bw['latency_ms']}ms")
                items["network"].set_label(f"Network: {' | '.join(parts)}" if parts else "Network: —")

            s = info.get("status", "unknown")
            a = info.get("approval_status", "unknown")
            if daemon_running:
                if a == "pending":
                    items["status"].set_label("⦿ Daemon Running — Awaiting Approval")
                    indicator.set_icon_full(str(ICON_DIR / "dcp_warning.svg"), "warning")
                elif s == "online":
                    items["status"].set_label("⦿ Online — Active")
                    indicator.set_icon_full(str(ICON_DIR / "dcp_online.svg"), "online")
                else:
                    items["status"].set_label(f"⦿ Daemon Running — {s}")
                    indicator.set_icon_full(str(ICON_DIR / "dcp_online.svg"), "online")
            else:
                items["status"].set_label("○ Offline — Daemon Stopped")
                indicator.set_icon_full(str(ICON_DIR / "dcp_offline.svg"), "offline")

            # Job count notification
            current_jobs = info.get("total_jobs", 0)
            if state["prev_jobs"] is not None and current_jobs > state["prev_jobs"]:
                send_notification("DCP Provider", f"{current_jobs - state['prev_jobs']} new job(s) completed!")
            state["prev_jobs"] = current_jobs
        else:
            if daemon_running:
                items["status"].set_label("⦿ Online — Daemon Running")
                indicator.set_icon_full(str(ICON_DIR / "dcp_online.svg"), "online")
            else:
                items["status"].set_label("○ Offline — Daemon Stopped")
                indicator.set_icon_full(str(ICON_DIR / "dcp_offline.svg"), "offline")

        # Daemon state notifications
        if state["prev_running"] is True and not daemon_running:
            send_notification("DCP Provider", "Daemon has stopped running.")
        elif state["prev_running"] is False and daemon_running:
            send_notification("DCP Provider", "Daemon is now running.")
        state["prev_running"] = daemon_running

        # Toggle start/stop visibility
        items["stop"].set_visible(daemon_running)
        items["start"].set_visible(not daemon_running)

        return True  # Keep the timer running

    # Update immediately, then every POLL_INTERVAL seconds
    GLib.timeout_add_seconds(0, update)
    GLib.timeout_add_seconds(POLL_INTERVAL, update)

    Gtk.main()


# ─── DAEMON CONTROL ──────────────────────────────────────────────────────────

def restart_daemon():
    """Restart the daemon via systemd or direct kill."""
    try:
        subprocess.run(["systemctl", "--user", "restart", SYSTEMD_SERVICE],
                       capture_output=True, timeout=10)
        send_notification("DCP Provider", "Daemon restarted.")
    except Exception:
        try:
            if PID_FILE.exists():
                pid = int(PID_FILE.read_text().strip())
                os.kill(pid, 15)  # SIGTERM
                time.sleep(1)
        except Exception:
            pass
        start_daemon(load_config())


def stop_daemon():
    """Stop the daemon."""
    try:
        subprocess.run(["systemctl", "--user", "stop", SYSTEMD_SERVICE],
                       capture_output=True, timeout=10)
        send_notification("DCP Provider", "Daemon stopped.")
    except Exception:
        try:
            if PID_FILE.exists():
                pid = int(PID_FILE.read_text().strip())
                os.kill(pid, 15)
            send_notification("DCP Provider", "Daemon stopped.")
        except Exception as e:
            send_notification("DCP Provider", f"Stop failed: {e}")


def start_daemon(config):
    """Start the daemon."""
    try:
        subprocess.run(["systemctl", "--user", "start", SYSTEMD_SERVICE],
                       capture_output=True, timeout=10)
        send_notification("DCP Provider", "Daemon starting…")
    except Exception:
        try:
            key = config.get("DCP_PROVIDER_KEY", "")
            subprocess.Popen([sys.executable, str(DAEMON_PATH), "--key", key],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            send_notification("DCP Provider", "Daemon starting…")
        except Exception as e:
            send_notification("DCP Provider", f"Start failed: {e}")


# ─── PYSTRAY FALLBACK ───────────────────────────────────────────────────────

def run_pystray_fallback():
    """Fallback: use pystray (cross-platform) if AppIndicator not available."""
    try:
        import pystray
        from PIL import Image, ImageDraw
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pystray", "Pillow", "-q"])
        import pystray
        from PIL import Image, ImageDraw

    from pystray import MenuItem as item

    def make_icon(state="offline"):
        img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        colors = {"online": (76, 175, 80), "warning": (255, 152, 0), "offline": (158, 158, 158)}
        color = colors.get(state, colors["offline"])
        cx, cy, r = 32, 32, 26
        points = [(cx + r * math.cos(math.pi/3*i - math.pi/6),
                    cy + r * math.sin(math.pi/3*i - math.pi/6)) for i in range(6)]
        if state == "offline":
            draw.polygon(points, outline=color + (255,), width=3)
        else:
            draw.polygon(points, fill=color + (255,))
        return img

    app_state = {
        "running": False, "status": "Checking…", "provider": "—",
        "gpu": "—", "earnings": "—", "prev_running": None,
    }

    def poll():
        while True:
            try:
                config = load_config()
                running = is_daemon_running()
                app_state["running"] = running
                api_key = config.get("DCP_PROVIDER_KEY", "")
                api_base = config.get("DCP_API_BASE", "https://api.dcp.sa")
                info = fetch_provider_status(api_base, api_key) if api_key else None
                if info:
                    app_state["provider"] = info.get("name", "Unknown")
                    app_state["gpu"] = info.get("gpu_model") or "CPU only"
                    e = info.get("total_earnings_halala", 0) or 0
                    app_state["earnings"] = f"{e/100:.2f} SAR"
                if running:
                    app_state["status"] = "Online"
                    icon.icon = make_icon("online")
                else:
                    app_state["status"] = "Offline"
                    icon.icon = make_icon("offline")
                app_state["prev_running"] = running
            except Exception:
                pass
            time.sleep(POLL_INTERVAL)

    icon = pystray.Icon("DCP Provider", make_icon("offline"), "DCP Provider",
        menu=pystray.Menu(
            item(lambda t: f"Status: {app_state['status']}", None, enabled=False),
            item(lambda t: f"Provider: {app_state['provider']}", None, enabled=False),
            item(lambda t: f"GPU: {app_state['gpu']}", None, enabled=False),
            item(lambda t: f"Earnings: {app_state['earnings']}", None, enabled=False),
            pystray.Menu.SEPARATOR,
            item("Open Dashboard", lambda i, it: webbrowser.open(DASHBOARD_URL)),
            item("Refresh", lambda i, it: None),
            pystray.Menu.SEPARATOR,
            item("Quit", lambda i, it: i.stop()),
        )
    )

    threading.Thread(target=poll, daemon=True).start()
    icon.run()


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    Gtk, AppIndicator3, GLib = try_appindicator()
    if Gtk and AppIndicator3:
        print("Using AppIndicator3 (GNOME/Ubuntu)")
        run_appindicator_tray()
    else:
        print("AppIndicator3 not available, falling back to pystray")
        run_pystray_fallback()
