#!/usr/bin/env python3
"""
DCP Provider Daemon v3.3.0 — GPU Compute Marketplace
Runs as a background service on provider machines.

Features:
  - GPU detection via nvidia-smi
  - System readiness checks (CUDA, PyTorch, VRAM)
  - 30s heartbeat to DC1 backend
  - Job polling (every 10s) with dual endpoint support
  - Docker-based execution (NVIDIA Container Toolkit) with bare-metal fallback
  - Container security hardening: read-only rootfs, cap-drop all, seccomp profile, pids/cpu limits
  - GPU VRAM leak detection (baseline compare after container exit)
  - Machine verification challenge support (anti-fraud GPU benchmarking)
  - 2MB stdout capture for LLM/image outputs
  - HMAC verification of task_spec before execution
  - Structured logging to ~/dc1-provider/logs/
  - Crash watchdog with auto-restart (max 5 restarts in 10 min)
  - Event logging to backend (crashes, job results, daemon lifecycle)
  - Self-updating: downloads new daemon from backend when update_available
  - Model pre-caching: downloads LLM weights on startup for fast first inference
  - Real-time job progress: reports execution phase (downloading/loading/generating) to backend

Usage:
  python3 dc1-daemon.py                    # Uses injected key
  python3 dc1-daemon.py --key YOUR_KEY     # Manual key override
  python3 dc1-daemon.py --url URL          # Manual URL override
"""

import os
import sys
import time
import json
import hmac
import hashlib
import logging
import platform
import subprocess
import threading
import tempfile
import argparse
import traceback
import shutil
import signal
import shlex
import uuid
from pathlib import Path
from datetime import datetime

# ─── CONFIGURATION (injected by download endpoint) ──────────────────────────

API_KEY = "{{API_KEY}}"
API_URL = "{{API_URL}}"
HMAC_SECRET = "{{HMAC_SECRET}}"

HEARTBEAT_INTERVAL = 30   # seconds
JOB_POLL_INTERVAL = 10    # seconds
DAEMON_VERSION = "3.4.0"
MAX_STDOUT = 2097152       # 2 MB stdout capture (for base64 image results)
JOB_TIMEOUT = 900          # 15 min default job timeout (model downloads can be slow)
RESULT_POST_TIMEOUT = 120  # 2 min for uploading results (large base64 images)
RESULT_POST_RETRIES = 3    # Retry result submission up to 3 times
MAX_CONTAINER_RESTARTS = 3
CONTAINER_RESTART_BACKOFFS = [10, 30, 90]
MAX_CRASH_RESTARTS = 5     # Max restarts within the crash window
CRASH_WINDOW = 600         # 10 minute window for counting crashes
AUTO_UPDATE_CHECK = 300    # Check for updates every 5 minutes
UPDATE_CRASH_THRESHOLD = 90  # If daemon crashes within 90s of update, rollback
ROLLBACK_RECHECK_INTERVAL = 600  # After rollback, re-check for updates every 10 min
CANONICAL_UPDATE_ENDPOINT = "https://api.dcp.sa/api/providers/download/daemon"
CANONICAL_INSTALLER_DOWNLOAD_URL = "https://api.dcp.sa/installers/daemon"
CANONICAL_API_BASE_URL = "https://api.dcp.sa"

# ─── CONTAINER SECURITY CONFIG ───────────────────────────────────────────────
CONTAINER_CPU_LIMIT = "4"          # Max CPU cores per job container
CONTAINER_MEMORY_LIMIT = "16g"     # Max RAM per job container (swap disabled)
CONTAINER_PIDS_LIMIT = "256"       # Max PIDs (fork-bomb protection)
CONTAINER_TMP_SIZE = "1g"          # tmpfs size for /tmp in container
VLLM_CPU_LIMIT = "8"               # vLLM serve default CPU limit
VLLM_MEMORY_LIMIT = "24g"          # vLLM serve default memory cap
VLLM_PIDS_LIMIT = "512"            # vLLM serve process limit
VLLM_TMP_SIZE = "2g"               # vLLM /tmp tmpfs size
VLLM_SHM_SIZE = "4g"               # vLLM shared memory size
_SECCOMP_PROFILE_PATH = None       # Cached seccomp profile path (written once)
BANDWIDTH_CHECK_INTERVAL = 600   # Measure bandwidth every 10 minutes
BANDWIDTH_TEST_SIZE = 102400     # 100KB test payload for speed measurement
MODEL_CACHE_PATH = "/opt/dcp/model-cache"

# VRAM requirements per job type (MiB) — jobs need at least this much free VRAM
VRAM_REQUIREMENTS = {
    "image_generation": 3500,   # SD v1.4 needs ~3.5 GB
    "llm-inference": 5000,      # 7B model needs ~5 GB
    "training": 6000,           # Fine-tuning needs ~6 GB
    "benchmark": 1000,          # Matrix multiply needs ~1 GB
    "rendering": 2000,          # General GPU rendering
    "vllm_serve": 14336,        # vLLM 7B model in FP16 needs ~14 GB
}
VRAM_DEFAULT_REQUIREMENT = 2000  # Default if job type unknown

# ─── POWER COST AWARENESS ────────────────────────────────────────────────────
# Provider can set electricity cost in config.json to skip unprofitable jobs
POWER_COST_CONFIG_FILE = Path.home() / "dc1-provider" / "power_config.json"
DEFAULT_ELECTRICITY_COST_KWH = 0.0  # 0 = disabled (accept all jobs)
DEFAULT_GPU_TDP_WATTS = 300          # Default TDP for profitability calc

# ─── MULTI-GPU CONCURRENT JOBS ───────────────────────────────────────────────
MAX_CONCURRENT_JOBS = 1  # Default: 1 job at a time (auto-raised for multi-GPU)
_gpu_job_slots = {}  # {gpu_index: job_id or None}
_gpu_slots_lock = threading.Lock()

# ─── NETWORK QUALITY ─────────────────────────────────────────────────────────
NETWORK_QUALITY_INTERVAL = 300  # Measure network quality every 5 minutes
NETWORK_QUALITY_PING_COUNT = 5  # Packets for packet loss measurement
_network_quality = {
    "latency_ms": None,
    "jitter_ms": None,
    "packet_loss_pct": None,
    "dns_resolve_ms": None,
    "last_check": None,
}
_nq_lock = threading.Lock()

# Disk space requirements (MB)
DISK_MIN_FREE_MB = 5000          # 5 GB minimum free space (models can be 4-8 GB)
DISK_MIN_TEMP_MB = 500           # 500 MB minimum for /tmp scripts

# ─── SETUP LOGGING ──────────────────────────────────────────────────────────

LOG_DIR = Path.home() / "dc1-provider" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_DIR = Path.home() / "dc1-provider"
PEER_ID_FILE = CONFIG_DIR / "peer_id"
UPDATE_SUPPRESSION_FILE = CONFIG_DIR / "update_suppression.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "daemon.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("dc1")

# ─── RUNTIME STATE ──────────────────────────────────────────────────────────

_docker_available = None  # Cached Docker + NVIDIA CT check
_current_job_id = None    # Track active job for heartbeat
_provider_peer_id = None  # Stable peer id for P2P heartbeat announcement
_job_lock = threading.Lock()  # Protects _current_job_id
_bw_lock = threading.Lock()   # Protects _bandwidth_stats
_peer_id_lock = threading.Lock()  # Protects peer id cache

def _save_update_suppression(until_ts, reason=""):
    """Persist update suppression window so rollback survives process restarts."""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "until_unix": int(until_ts),
            "reason": str(reason or ""),
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }
        UPDATE_SUPPRESSION_FILE.write_text(json.dumps(payload), encoding="utf-8")
    except Exception as e:
        log.debug(f"Failed to persist update suppression: {e}")

def _clear_update_suppression():
    """Delete suppression marker when cooldown expires."""
    try:
        if UPDATE_SUPPRESSION_FILE.exists():
            UPDATE_SUPPRESSION_FILE.unlink()
    except Exception as e:
        log.debug(f"Failed to clear update suppression marker: {e}")

def _get_update_suppression_until():
    """Get active update suppression unix timestamp from env/file, or 0."""
    now = int(time.time())
    env_value = os.environ.get("DCP_UPDATE_SUPPRESS_UNTIL", "").strip()
    if env_value.isdigit():
        suppress_until = int(env_value)
        if suppress_until > now:
            return suppress_until
        os.environ.pop("DCP_UPDATE_SUPPRESS_UNTIL", None)

    if not UPDATE_SUPPRESSION_FILE.exists():
        return 0

    try:
        payload = json.loads(UPDATE_SUPPRESSION_FILE.read_text(encoding="utf-8") or "{}")
        suppress_until = int(payload.get("until_unix") or 0)
        if suppress_until > now:
            return suppress_until
        _clear_update_suppression()
        return 0
    except Exception:
        _clear_update_suppression()
        return 0

# ─── HTTP HELPER ─────────────────────────────────────────────────────────────

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

def _safe_json(raw):
    """Safely parse JSON, returning {} on failure."""
    try:
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")
        return json.loads(raw) if raw else {}
    except (json.JSONDecodeError, ValueError, UnicodeDecodeError):
        return {}

def http_post(url, data, timeout=15):
    """POST JSON to URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = requests.post(url, json=data, timeout=timeout)
        return r.status_code, _safe_json(r.text)
    else:
        import urllib.request, urllib.error
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.getcode(), _safe_json(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, _safe_json(e.read())

def http_get(url, timeout=15):
    """GET URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = requests.get(url, timeout=timeout)
        return r.status_code, _safe_json(r.text)
    else:
        import urllib.request, urllib.error
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.getcode(), _safe_json(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, _safe_json(e.read())

def http_patch(url, data, timeout=15):
    """PATCH JSON to URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = requests.patch(url, json=data, timeout=timeout)
        return r.status_code, _safe_json(r.text)
    else:
        import urllib.request, urllib.error
        body = json.dumps(data).encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.getcode(), _safe_json(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, _safe_json(e.read())

# ─── EVENT LOGGING (send structured events to backend) ──────────────────────

def report_event(event_type, details=None, job_id=None, severity="info"):
    """
    Send a daemon event to the backend for centralized logging.
    event_type: daemon_start, daemon_stop, daemon_crash, job_success, job_failure,
                job_timeout, update_start, update_success, update_failed, watchdog_restart
    severity: info, warning, error, critical
    """
    url = f"{API_URL}/api/providers/daemon-event"
    payload = {
        "api_key": API_KEY,
        "event_type": event_type,
        "severity": severity,
        "daemon_version": DAEMON_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "hostname": platform.node(),
        "os_info": f"{platform.system()} {platform.release()}",
        "python_version": platform.python_version(),
    }
    if details:
        payload["details"] = details[:5000]  # Cap at 5KB
    if job_id:
        payload["job_id"] = str(job_id)
    try:
        code, resp = http_post(url, payload, timeout=10)
        if code != 200:
            log.warning(f"Event report HTTP {code}: {resp}")
    except Exception as e:
        log.debug(f"Event report failed (non-critical): {e}")

    # Always save to local crash journal as backup
    _save_local_event(payload)

def _save_local_event(payload):
    """Save event to local JSON-lines file (survives backend outages)."""
    try:
        journal_path = LOG_DIR / "events.jsonl"
        with open(journal_path, "a") as f:
            f.write(json.dumps(payload) + "\n")
        # Rotate: keep last 1000 events (trim when over 1200)
        try:
            lines = journal_path.read_text().splitlines()
            if len(lines) > 1200:
                journal_path.write_text("\n".join(lines[-1000:]) + "\n")
        except: pass
    except: pass

# ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────────────────

_shutdown_requested = False

def request_graceful_shutdown():
    """Signal daemon to finish current job then exit."""
    global _shutdown_requested
    _shutdown_requested = True
    log.info("Graceful shutdown requested — will exit after current job completes")

def is_shutdown_requested():
    return _shutdown_requested

# ─── VRAM GUARD ─────────────────────────────────────────────────────────────

def check_vram_available(job_type):
    """Check if enough free VRAM is available for this job type.
    Returns (ok: bool, free_mib: int, required_mib: int)."""
    required = VRAM_REQUIREMENTS.get(job_type, VRAM_DEFAULT_REQUIREMENT)
    gpu = detect_gpu()
    if not gpu:
        # No GPU detected — reject GPU-required jobs, allow CPU-only
        gpu_required = {"image_generation", "llm-inference", "training", "rendering"}
        if job_type in gpu_required:
            return False, 0, required
        return True, 0, required
    free = gpu.get("free_vram_mib", 0)
    ok = free >= required
    if not ok:
        log.warning(f"VRAM guard: {free} MiB free < {required} MiB required for {job_type}")
    return ok, free, required

# ─── DISK SPACE CHECK ───────────────────────────────────────────────────────

def check_disk_space():
    """Check if enough disk space is available for model downloads and temp files.
    Returns (ok: bool, details: str)."""
    issues = []

    # Check home directory partition (where ~/.cache/huggingface/ lives)
    try:
        home_stat = shutil.disk_usage(str(Path.home()))
        home_free_mb = home_stat.free // (1024 * 1024)
        if home_free_mb < DISK_MIN_FREE_MB:
            issues.append(f"Home partition: {home_free_mb} MB free < {DISK_MIN_FREE_MB} MB required")
    except Exception as e:
        issues.append(f"Home partition check failed: {e}")

    # Check temp directory partition (where job scripts run)
    try:
        tmp_dir = tempfile.gettempdir()
        tmp_stat = shutil.disk_usage(tmp_dir)
        tmp_free_mb = tmp_stat.free // (1024 * 1024)
        if tmp_free_mb < DISK_MIN_TEMP_MB:
            issues.append(f"Temp partition ({tmp_dir}): {tmp_free_mb} MB free < {DISK_MIN_TEMP_MB} MB required")
    except Exception as e:
        issues.append(f"Temp partition check failed: {e}")

    if issues:
        detail = "; ".join(issues)
        log.warning(f"Disk space guard: {detail}")
        return False, detail
    return True, "OK"

def _get_or_create_peer_id():
    """Return provider peer_id persisted in provider config directory.

    This is used to keep DHT keys stable across daemon restarts and heartbeat
    cycles.
    """
    global _provider_peer_id

    with _peer_id_lock:
        if _provider_peer_id:
            return _provider_peer_id

        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        except:
            pass

        if PEER_ID_FILE.exists():
            try:
                candidate = PEER_ID_FILE.read_text().strip()
            except:
                candidate = ""
            if candidate:
                _provider_peer_id = candidate
                return _provider_peer_id

        candidate = f"dcp-{uuid.uuid4().hex}"
        try:
            PEER_ID_FILE.write_text(candidate)
        except Exception:
            log.warning("Failed to persist peer_id to %s", PEER_ID_FILE)
        _provider_peer_id = candidate
        return candidate

# ─── JOB DEDUP ──────────────────────────────────────────────────────────────

_DEDUP_FILE = CONFIG_DIR / "seen_jobs.json"
_DEDUP_TTL = 3600  # 1 hour — forget jobs older than this

def _load_seen_jobs():
    """Load seen job IDs from disk. Returns dict {job_id: timestamp}."""
    try:
        if _DEDUP_FILE.exists():
            data = json.loads(_DEDUP_FILE.read_text())
            # Clean expired entries
            now = time.time()
            return {k: v for k, v in data.items() if now - v < _DEDUP_TTL}
    except:
        pass
    return {}

def _save_seen_jobs(seen):
    """Save seen job IDs to disk."""
    try:
        _DEDUP_FILE.write_text(json.dumps(seen))
    except:
        pass

def is_duplicate_job(job_id):
    """Check if we've already seen this job. Mark it as seen if not."""
    seen = _load_seen_jobs()
    if str(job_id) in seen:
        log.warning(f"Job dedup: {job_id} already seen — skipping")
        return True
    seen[str(job_id)] = time.time()
    _save_seen_jobs(seen)
    return False

# ─── BANDWIDTH MONITOR ──────────────────────────────────────────────────────

_bandwidth_stats = {
    "download_mbps": None,
    "upload_mbps": None,
    "last_check": None,
    "latency_ms": None,
}

def measure_bandwidth():
    """Measure upload/download speed and latency to the backend."""
    global _bandwidth_stats

    # Latency — time a lightweight GET
    try:
        start = time.time()
        http_get(f"{API_URL}/api/providers/download/daemon?key={API_KEY}&check_only=true", timeout=10)
        latency_ms = round((time.time() - start) * 1000)
    except:
        latency_ms = None

    # Download speed — download the daemon file (measures server→provider)
    download_mbps = None
    try:
        start = time.time()
        if HAS_REQUESTS:
            import requests as req_lib
            r = req_lib.get(f"{API_URL}/api/providers/download/daemon?key={API_KEY}", timeout=30)
            size = len(r.content)
        else:
            import urllib.request
            with urllib.request.urlopen(
                f"{API_URL}/api/providers/download/daemon?key={API_KEY}", timeout=30
            ) as resp:
                data = resp.read()
                size = len(data)
        elapsed = time.time() - start
        if elapsed > 0:
            download_mbps = round((size * 8) / (elapsed * 1_000_000), 2)
    except:
        pass

    # Upload speed — POST a test payload (measures provider→server)
    upload_mbps = None
    try:
        test_data = {"api_key": API_KEY, "event_type": "bandwidth_test",
                     "severity": "info", "daemon_version": DAEMON_VERSION,
                     "timestamp": datetime.utcnow().isoformat() + "Z",
                     "hostname": platform.node(),
                     "details": "x" * BANDWIDTH_TEST_SIZE}
        payload_size = len(json.dumps(test_data).encode())
        start = time.time()
        http_post(f"{API_URL}/api/providers/daemon-event", test_data, timeout=30)
        elapsed = time.time() - start
        if elapsed > 0:
            upload_mbps = round((payload_size * 8) / (elapsed * 1_000_000), 2)
    except:
        pass

    new_stats = {
        "download_mbps": download_mbps,
        "upload_mbps": upload_mbps,
        "latency_ms": latency_ms,
        "last_check": datetime.utcnow().isoformat() + "Z",
    }
    with _bw_lock:
        global _bandwidth_stats
        _bandwidth_stats = new_stats

    log.info(f"Bandwidth: ↓{download_mbps} Mbps ↑{upload_mbps} Mbps, latency {latency_ms}ms")

    # Report to backend as event (not bandwidth_test — that's the raw payload)
    report_event("bandwidth_report",
        f"Download: {download_mbps} Mbps, Upload: {upload_mbps} Mbps, Latency: {latency_ms}ms",
        severity="info")

    return _bandwidth_stats

def bandwidth_loop():
    """Background thread: measure bandwidth periodically."""
    # Initial measurement on startup (after a short delay)
    time.sleep(15)
    measure_bandwidth()
    while True:
        time.sleep(BANDWIDTH_CHECK_INTERVAL)
        try:
            measure_bandwidth()
        except Exception as e:
            log.debug(f"Bandwidth check error: {e}")

# ─── NETWORK QUALITY MONITOR ────────────────────────────────────────────────

def measure_network_quality():
    """Measure network quality: latency, jitter, packet loss, DNS resolve time."""
    global _network_quality
    results = {}

    # 1. Ping-based latency, jitter, and packet loss
    try:
        # Extract hostname from API_URL
        from urllib.parse import urlparse
        host = urlparse(API_URL).hostname or "api.dcp.sa"

        ping_cmd = ["ping", "-c", str(NETWORK_QUALITY_PING_COUNT), "-W", "3", host]
        if platform.system() == "Darwin":
            ping_cmd = ["ping", "-c", str(NETWORK_QUALITY_PING_COUNT), "-W", "3000", host]

        result = subprocess.run(ping_cmd, capture_output=True, text=True, timeout=20)
        output = result.stdout

        # Parse packet loss
        for line in output.splitlines():
            if "packet loss" in line:
                # "5 packets transmitted, 5 received, 0% packet loss"
                import re
                m = re.search(r'(\d+(?:\.\d+)?)%\s+packet loss', line)
                if m:
                    results["packet_loss_pct"] = float(m.group(1))

            if "min/avg/max" in line or "rtt" in line:
                # "round-trip min/avg/max/stddev = 1.2/2.5/5.1/1.3 ms"
                import re
                m = re.search(r'=\s*([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+)', line)
                if m:
                    results["latency_ms"] = round(float(m.group(2)))  # avg
                    results["jitter_ms"] = round(float(m.group(4)), 1)  # stddev
    except Exception as e:
        log.debug(f"Ping measurement failed: {e}")

    # 2. DNS resolve time
    try:
        import socket
        from urllib.parse import urlparse
        host = urlparse(API_URL).hostname or "api.dcp.sa"
        start = time.time()
        socket.getaddrinfo(host, 443)
        results["dns_resolve_ms"] = round((time.time() - start) * 1000)
    except Exception:
        pass

    results["last_check"] = datetime.utcnow().isoformat() + "Z"

    with _nq_lock:
        _network_quality.update(results)

    log.info(f"Network quality: latency={results.get('latency_ms')}ms "
             f"jitter={results.get('jitter_ms')}ms "
             f"loss={results.get('packet_loss_pct')}% "
             f"dns={results.get('dns_resolve_ms')}ms")

    return _network_quality


def network_quality_loop():
    """Background thread: measure network quality periodically."""
    time.sleep(30)  # Delay after startup
    measure_network_quality()
    while True:
        time.sleep(NETWORK_QUALITY_INTERVAL)
        try:
            measure_network_quality()
        except Exception as e:
            log.debug(f"Network quality check error: {e}")


# ─── POWER COST AWARENESS ───────────────────────────────────────────────────

def load_power_config():
    """Load power cost configuration from power_config.json.

    Example config:
    {
        "electricity_cost_kwh": 0.18,    // SAR per kWh
        "gpu_tdp_watts": 300,            // GPU TDP in watts
        "min_profit_margin_pct": 20,     // Minimum profit margin %
        "enabled": true
    }
    """
    try:
        if POWER_COST_CONFIG_FILE.exists():
            return json.loads(POWER_COST_CONFIG_FILE.read_text())
    except Exception:
        pass
    return {
        "electricity_cost_kwh": DEFAULT_ELECTRICITY_COST_KWH,
        "gpu_tdp_watts": DEFAULT_GPU_TDP_WATTS,
        "min_profit_margin_pct": 20,
        "enabled": False,
    }


def estimate_job_profitability(job, gpu=None):
    """Estimate whether a job is profitable after electricity costs.

    Returns (profitable: bool, details: dict).
    """
    power_config = load_power_config()
    if not power_config.get("enabled") or power_config.get("electricity_cost_kwh", 0) <= 0:
        return True, {"reason": "power cost tracking disabled"}

    electricity_cost_kwh = power_config["electricity_cost_kwh"]
    gpu_tdp_watts = power_config.get("gpu_tdp_watts", DEFAULT_GPU_TDP_WATTS)
    min_margin_pct = power_config.get("min_profit_margin_pct", 20)

    # Estimate GPU power from actual readings if available
    if gpu and gpu.get("power_w"):
        gpu_power_watts = gpu["power_w"]
    else:
        gpu_power_watts = gpu_tdp_watts

    # Job earnings estimate (halala per GPU-second)
    cost_per_gpu_second = job.get("cost_per_gpu_second_halala", 0.25)
    estimated_duration = job.get("estimated_duration_seconds", JOB_TIMEOUT)

    # Revenue = cost_per_gpu_second * duration (in halala)
    revenue_halala = cost_per_gpu_second * estimated_duration
    revenue_sar = revenue_halala / 100

    # Power cost = watts * hours * cost_per_kwh
    hours = estimated_duration / 3600
    power_cost_sar = (gpu_power_watts / 1000) * hours * electricity_cost_kwh

    # System overhead (CPU, RAM, cooling) — estimate 30% on top of GPU
    total_cost_sar = power_cost_sar * 1.3

    profit_sar = revenue_sar - total_cost_sar
    margin_pct = (profit_sar / revenue_sar * 100) if revenue_sar > 0 else -100

    profitable = margin_pct >= min_margin_pct

    details = {
        "revenue_sar": round(revenue_sar, 4),
        "power_cost_sar": round(total_cost_sar, 4),
        "profit_sar": round(profit_sar, 4),
        "margin_pct": round(margin_pct, 1),
        "gpu_watts": gpu_power_watts,
        "electricity_kwh": electricity_cost_kwh,
        "profitable": profitable,
    }

    if not profitable:
        log.info(f"Job profitability check: UNPROFITABLE — "
                 f"revenue={revenue_sar:.4f} SAR, cost={total_cost_sar:.4f} SAR, "
                 f"margin={margin_pct:.1f}% (min: {min_margin_pct}%)")

    return profitable, details


# ─── MULTI-GPU JOB SLOTS ────────────────────────────────────────────────────

def init_gpu_slots():
    """Initialize GPU job slots based on detected GPUs."""
    global MAX_CONCURRENT_JOBS, _gpu_job_slots
    gpu = detect_gpu()
    if not gpu:
        MAX_CONCURRENT_JOBS = 1
        _gpu_job_slots = {0: None}
        return

    all_gpus = gpu.get("all_gpus", [gpu])
    gpu_count = len(all_gpus)
    MAX_CONCURRENT_JOBS = max(1, gpu_count)

    with _gpu_slots_lock:
        _gpu_job_slots = {g["index"]: None for g in all_gpus}

    if gpu_count > 1:
        log.info(f"Multi-GPU: {gpu_count} GPUs detected, {MAX_CONCURRENT_JOBS} concurrent job slots")
    else:
        log.info(f"Single GPU detected, 1 job slot")


def acquire_gpu_slot(job_id, required_vram=0):
    """Acquire a free GPU slot for a job. Returns gpu_index or None."""
    gpu = detect_gpu()
    if not gpu:
        return 0  # CPU-only, use slot 0

    all_gpus = gpu.get("all_gpus", [gpu])

    with _gpu_slots_lock:
        for g in all_gpus:
            idx = g["index"]
            if _gpu_job_slots.get(idx) is None:
                free_vram = g.get("free_vram_mib", 0)
                if required_vram <= 0 or free_vram >= required_vram:
                    _gpu_job_slots[idx] = job_id
                    log.info(f"GPU slot {idx} acquired for job {job_id} "
                             f"(free VRAM: {free_vram} MiB)")
                    return idx
    return None


def release_gpu_slot(gpu_index, job_id=None):
    """Release a GPU slot after job completion."""
    with _gpu_slots_lock:
        if gpu_index in _gpu_job_slots:
            held_job = _gpu_job_slots[gpu_index]
            if job_id is None or held_job == job_id:
                _gpu_job_slots[gpu_index] = None
                log.info(f"GPU slot {gpu_index} released (was: {held_job})")
                return True
    return False


def get_free_gpu_slot_count():
    """Return number of free GPU slots."""
    with _gpu_slots_lock:
        return sum(1 for v in _gpu_job_slots.values() if v is None)


def get_active_job_count():
    """Return number of currently running jobs across all GPUs."""
    with _gpu_slots_lock:
        return sum(1 for v in _gpu_job_slots.values() if v is not None)


# ─── GRACEFUL JOB DRAINING ──────────────────────────────────────────────────

_draining = False
_drain_lock = threading.Lock()

def start_draining():
    """Enter draining mode: finish current jobs, accept no new ones."""
    global _draining
    with _drain_lock:
        _draining = True
    active = get_active_job_count()
    log.info(f"Entering drain mode — {active} active job(s) will complete before shutdown")
    report_event("drain_start", f"Draining: {active} active jobs will complete", severity="info")


def is_draining():
    """Check if daemon is in draining mode."""
    with _drain_lock:
        return _draining


def wait_for_drain(timeout=600):
    """Wait for all active jobs to complete. Returns True if drained within timeout."""
    start = time.time()
    while time.time() - start < timeout:
        active = get_active_job_count()
        if active == 0:
            log.info("Drain complete — all jobs finished")
            report_event("drain_complete", "All jobs drained successfully")
            return True
        log.info(f"Draining: {active} job(s) still active, waiting...")
        time.sleep(5)
    log.warning(f"Drain timeout after {timeout}s — {get_active_job_count()} jobs still active")
    return False


# ─── AUTO-UPDATE ────────────────────────────────────────────────────────────

def _parse_version(version):
    """Convert semver-like string to tuple for numeric comparison."""
    try:
        parts = [int(p) for p in str(version).strip().split(".")]
        return tuple(parts)
    except Exception:
        return None

def _is_remote_newer(remote_version, local_version):
    """Compare versions safely (numeric compare; fallback to string compare)."""
    remote = _parse_version(remote_version)
    local = _parse_version(local_version)
    if remote is not None and local is not None:
        max_len = max(len(remote), len(local))
        remote = remote + (0,) * (max_len - len(remote))
        local = local + (0,) * (max_len - len(local))
        return remote > local
    return str(remote_version).strip() != str(local_version).strip()

def _legacy_update_endpoint():
    """Legacy update endpoint derived from injected API URL."""
    return f"{API_URL.rstrip('/')}/api/providers/download/daemon"

def _candidate_update_endpoints():
    """Ordered update endpoints: canonical first, legacy fallback second."""
    return [CANONICAL_UPDATE_ENDPOINT, _legacy_update_endpoint()]

def _candidate_download_urls():
    """Ordered daemon download URLs: installer URL first, API fallbacks after."""
    return [CANONICAL_INSTALLER_DOWNLOAD_URL] + _candidate_update_endpoints()

def _resolve_download_url(download_url):
    """Normalize download_url from check_only response."""
    if not download_url:
        return None
    url = str(download_url).strip()
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/api/providers/"):
        return f"{CANONICAL_API_BASE_URL}{url}"
    if url.startswith("/"):
        return f"{CANONICAL_API_BASE_URL}{url}"
    return None

def get_gpu_info():
    """Return GPU info as a dict for the heartbeat payload.

    The backend validates that gpu_info is a plain object, so we must
    always return a dict — never a bare string.
    """
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,driver_version",
             "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        output = (result.stdout or "").strip()
        if output:
            parts = [p.strip() for p in output.split(",")]
            return {
                "gpu_name": parts[0] if len(parts) > 0 else None,
                "vram_mb": int(float(parts[1])) if len(parts) > 1 and parts[1] else None,
                "driver_version": parts[2] if len(parts) > 2 else None,
                "cuda_version": None,
            }
        # nvidia-smi present but returned nothing useful
        raw = (result.stderr or "").strip()[:2000]
        return {"gpu_name": None, "vram_mb": None, "driver_version": None,
                "cuda_version": None, "raw": raw or "nvidia-smi produced no output"}
    except FileNotFoundError:
        return {"gpu_name": "CPU only", "vram_mb": 0, "driver_version": None,
                "cuda_version": None}
    except Exception as e:
        return {"gpu_name": None, "vram_mb": None, "driver_version": None,
                "cuda_version": None, "error": str(e)[:500]}

def check_for_update():
    """Check if a newer daemon version is available and self-update."""
    suppress_until = _get_update_suppression_until()
    if suppress_until > int(time.time()):
        wait_seconds = suppress_until - int(time.time())
        log.info(f"Update checks suppressed for {wait_seconds}s after rollback")
        return False

    for endpoint in _candidate_update_endpoints():
        try:
            url = f"{endpoint}?key={API_KEY}&check_only=true"
            code, resp = http_get(url)
            if code != 200 or not isinstance(resp, dict) or not resp.get("version"):
                continue

            remote_version = str(resp["version"]).strip()
            if _is_remote_newer(remote_version, DAEMON_VERSION):
                log.info(f"Update available via {endpoint}: {DAEMON_VERSION} → {remote_version}")
                resolved = _resolve_download_url(resp.get("download_url"))
                return perform_update(remote_version, preferred_download_url=resolved)
            return False
        except Exception as e:
            log.debug(f"Update check failed via {endpoint}: {e}")
    return False

def perform_update(new_version, preferred_download_url=None):
    """Download new daemon, replace current file, and signal restart."""
    report_event("update_start", f"Updating {DAEMON_VERSION} → {new_version}")
    log.info(f"Downloading daemon v{new_version}...")

    try:
        download_candidates = []
        if preferred_download_url:
            download_candidates.append(preferred_download_url)
        for endpoint in _candidate_download_urls():
            download_candidates.append(f"{endpoint}?key={API_KEY}")

        new_code = None
        used_url = None
        last_error = None
        for download_url in download_candidates:
            try:
                if HAS_REQUESTS:
                    import requests as req_lib
                    r = req_lib.get(download_url, timeout=30)
                    if r.status_code != 200:
                        raise Exception(f"Download HTTP {r.status_code}")
                    candidate_code = r.text
                else:
                    import urllib.request
                    with urllib.request.urlopen(download_url, timeout=30) as resp:
                        candidate_code = resp.read().decode("utf-8")

                if ("DCP Provider Daemon" not in candidate_code and "DC1 Provider Daemon" not in candidate_code) or "def main()" not in candidate_code:
                    raise Exception("Downloaded file doesn't look like a valid daemon")

                new_code = candidate_code
                used_url = download_url
                break
            except Exception as e:
                last_error = e
                continue

        if not new_code:
            raise Exception(f"All update downloads failed: {last_error}")

        log.info(f"Downloaded update from: {used_url}")

        # Save current as backup
        current_path = Path(__file__).resolve()
        backup_path = current_path.with_suffix(f".v{DAEMON_VERSION}.bak")
        shutil.copy2(current_path, backup_path)
        log.info(f"Backed up current daemon to {backup_path}")

        # Write new version
        current_path.write_text(new_code, encoding="utf-8")
        log.info(f"Updated daemon file to v{new_version}")

        report_event("update_success", f"Updated {DAEMON_VERSION} → {new_version}")

        # Signal the watchdog to restart us
        log.info("Update complete — signaling restart...")
        return True  # Caller should sys.exit(42) to trigger watchdog restart

    except Exception as e:
        error_msg = f"Update failed: {e}"
        log.error(error_msg)
        report_event("update_failed", error_msg, severity="error")
        return False

def update_check_loop():
    """Background thread: check for updates periodically."""
    while True:
        time.sleep(AUTO_UPDATE_CHECK)
        try:
            if check_for_update():
                # Wait for any running job to finish before restarting
                with _job_lock:
                    active = _current_job_id
                if active:
                    log.info(f"Update ready but job {active} is running — waiting...")
                    for _ in range(180):  # Wait up to 3 min for job to finish
                        with _job_lock:
                            active = _current_job_id
                        if not active:
                            break
                        time.sleep(1)
                    if active:
                        log.warning(f"Job {active} still running after 3min — restarting anyway")

                log.info("Exiting with code 42 to trigger watchdog restart with new version")
                os._exit(42)  # Special exit code = update restart
        except Exception as e:
            log.debug(f"Update check loop error: {e}")

# ─── GPU DETECTION ───────────────────────────────────────────────────────────

def _get_cuda_version():
    """Get CUDA version from nvidia-smi header line (e.g. 'CUDA Version: 12.2')."""
    try:
        r = subprocess.run(["nvidia-smi"], capture_output=True, text=True, timeout=5)
        for line in r.stdout.splitlines():
            if "CUDA Version:" in line:
                parts = line.strip().split("CUDA Version:")
                if len(parts) == 2:
                    return parts[1].strip().split()[0]
    except Exception:
        pass
    return None

def detect_gpu():
    """Detect NVIDIA GPU(s) via nvidia-smi. Returns dict for GPU 0 (or None), plus all_gpus list."""
    try:
        # Query includes compute_cap for CUDA compute capability
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=index,name,memory.total,memory.free,memory.used,utilization.gpu,temperature.gpu,power.draw,driver_version,compute_cap",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return None

        cuda_version = _get_cuda_version()
        all_gpus = []
        for raw_line in result.stdout.strip().splitlines():
            parts = [p.strip() for p in raw_line.split(",")]
            if len(parts) < 10:
                continue
            try:
                all_gpus.append({
                    "index": int(parts[0]),
                    "gpu_name": parts[1],
                    "gpu_vram_mib": int(float(parts[2])),
                    "free_vram_mib": int(float(parts[3])),
                    "memory_used_mb": int(float(parts[4])),
                    "gpu_util_pct": int(float(parts[5])),
                    "temp_c": int(float(parts[6])),
                    "power_w": float(parts[7]) if parts[7] not in ("[N/A]", "N/A") else None,
                    "driver_version": parts[8],
                    "compute_capability": parts[9],
                    "cuda_version": cuda_version,
                })
            except (ValueError, IndexError):
                continue

        if not all_gpus:
            return None

        # Return GPU 0 data (primary) with all_gpus list attached
        primary = all_gpus[0]
        primary["all_gpus"] = all_gpus
        return primary
    except FileNotFoundError:
        log.warning("nvidia-smi not found — no NVIDIA GPU detected")
        return None
    except Exception as e:
        log.error(f"GPU detection error: {e}")
        return None

def get_detected_gpu_count():
    """Return number of visible GPUs, defaulting to 1 for metering fallback."""
    gpu = detect_gpu()
    if not gpu:
        return 1
    all_gpus = gpu.get("all_gpus", [gpu])
    return max(1, len(all_gpus))

def collect_container_gpu_metrics(container_name):
    """
    Sample per-container GPU utilization using nvidia-smi pmon.
    Returns dict with gpu_index, sm_pct (shader util), mem_pct, used_memory_mib,
    or None if the container has no GPU processes.
    """
    try:
        # Get PID of the main process inside the named container
        pid_result = subprocess.run(
            ["docker", "inspect", "--format={{.State.Pid}}", container_name],
            capture_output=True, text=True, timeout=5
        )
        if pid_result.returncode != 0 or not pid_result.stdout.strip():
            return None
        container_pid = pid_result.stdout.strip()

        # nvidia-smi pmon: one sample, list processes on all GPUs
        pmon = subprocess.run(
            ["nvidia-smi", "pmon", "-c", "1", "-s", "um"],
            capture_output=True, text=True, timeout=10
        )
        if pmon.returncode != 0:
            return None

        metrics_by_gpu = {}
        for line in pmon.stdout.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cols = line.split()
            # pmon columns: gpu, pid, type, sm, mem, enc, dec, fb, command
            if len(cols) < 8:
                continue
            pid = cols[1]
            if pid == container_pid or pid == "-":
                gpu_idx = int(cols[0]) if cols[0].isdigit() else 0
                try:
                    metrics_by_gpu[gpu_idx] = {
                        "gpu_index": gpu_idx,
                        "sm_pct": int(cols[3]) if cols[3] != "-" else 0,
                        "mem_pct": int(cols[4]) if cols[4] != "-" else 0,
                        "used_memory_mib": int(cols[7]) if cols[7] != "-" else 0,
                        "pid": pid,
                    }
                except (ValueError, IndexError):
                    continue

        if not metrics_by_gpu:
            return None

        # Return all GPU metrics (sorted by index)
        return list(metrics_by_gpu.values())

    except Exception as e:
        log.debug(f"Container GPU metrics error: {e}")
        return None

# ─── DOCKER DETECTION ───────────────────────────────────────────────────────

def check_docker():
    """Check if Docker + NVIDIA Container Toolkit are available. Cached."""
    global _docker_available
    if _docker_available is not None:
        return _docker_available

    # Check config for force_bare_metal
    config_path = CONFIG_DIR / "config.json"
    if config_path.exists():
        try:
            cfg = json.loads(config_path.read_text())
            if cfg.get("force_bare_metal"):
                log.info("Docker disabled by config.json (force_bare_metal=true)")
                _docker_available = False
                return False
        except:
            pass

    try:
        r = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            log.info("Docker not installed")
            _docker_available = False
            return False

        # Check NVIDIA Container Toolkit
        r2 = subprocess.run(
            ["docker", "run", "--rm", "--gpus", "all", "nvidia/cuda:12.2.0-base-ubuntu22.04", "nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=30
        )
        if r2.returncode == 0:
            log.info(f"Docker + NVIDIA CT available: {r2.stdout.strip()}")
            _docker_available = True
        else:
            log.info("Docker available but NVIDIA Container Toolkit not working")
            _docker_available = False
    except FileNotFoundError:
        log.info("Docker not found")
        _docker_available = False
    except Exception as e:
        log.info(f"Docker check failed: {e}")
        _docker_available = False

    return _docker_available

# ─── READINESS CHECKS ────────────────────────────────────────────────────────

def check_readiness():
    """Run system checks: CUDA, PyTorch, VRAM. Returns checks dict."""
    checks = {
        "cuda": False,
        "pytorch": False,
        "vram_gb": 0,
        "driver": None,
        "python_version": platform.python_version(),
        "os_info": f"{platform.system()} {platform.release()}",
        "docker": check_docker(),
    }

    gpu = detect_gpu()
    if gpu:
        checks["cuda"] = True
        checks["driver"] = gpu["driver_version"]
        checks["vram_gb"] = round(gpu["gpu_vram_mib"] / 1024, 1)
        checks["gpu_name"] = gpu["gpu_name"]

    try:
        import torch
        checks["pytorch"] = True
        checks["pytorch_version"] = torch.__version__
        checks["cuda_available"] = torch.cuda.is_available()
        if torch.cuda.is_available():
            checks["cuda"] = True
            checks["cuda_version"] = torch.version.cuda
    except ImportError:
        checks["pytorch"] = False

    return checks

def report_readiness(checks):
    """POST readiness check results to backend."""
    url = f"{API_URL}/api/providers/readiness"
    try:
        code, resp = http_post(url, {
            "api_key": API_KEY,
            "checks": checks,
            "daemon_version": DAEMON_VERSION
        })
        log.info(f"Readiness reported: {resp.get('readiness_status', 'unknown')} (HTTP {code})")
        return resp
    except Exception as e:
        log.error(f"Readiness report failed: {e}")
        return None

# ─── OCEAN-STYLE RESOURCE SPEC ───────────────────────────────────────────────

def build_resource_spec(gpu=None):
    """Build Ocean-style resource_spec JSON for GPU advertisement.

    Schema mirrors Ocean Protocol's DOCKER_COMPUTE_ENVIRONMENTS pattern:
      {"resources": [{id, total, min, max, type?, ...gpu fields}],
       "compute_environments": [{id, compute_types, resources, tags}]}
    """
    resources = []
    compute_environments = []
    cpu_resource = None
    ram_resource = None
    disk_resource = None

    # CPU resource
    try:
        import multiprocessing
        cpu_count = multiprocessing.cpu_count()
        cpu_resource = {
            "id": "cpu",
            "total": cpu_count,
            "min": 1,
            "max": max(1, cpu_count // 2),
        }
        resources.append(cpu_resource)
    except Exception:
        cpu_resource = {"id": "cpu", "total": 1, "min": 1, "max": 1}
        resources.append(cpu_resource)

    # RAM resource (GB)
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    ram_kb = int(line.split()[1])
                    ram_gb = round(ram_kb / 1024 / 1024, 1)
                    ram_resource = {
                        "id": "ram",
                        "total": ram_gb,
                        "min": 1,
                        "max": max(1, int(ram_gb // 2)),
                    }
                    resources.append(ram_resource)
                    break
    except Exception:
        ram_resource = {"id": "ram", "total": 8, "min": 1, "max": 4}
        resources.append(ram_resource)

    # Disk resource (GB free on home dir)
    try:
        import shutil as _shutil
        usage = _shutil.disk_usage(str(Path.home()))
        disk_total_gb = round(usage.total / 1024 / 1024 / 1024, 1)
        disk_free_gb = round(usage.free / 1024 / 1024 / 1024, 1)
        disk_resource = {
            "id": "disk",
            "total": disk_total_gb,
            "free": disk_free_gb,
            "min": 5,
            "max": max(5, int(disk_free_gb * 0.8)),
        }
        resources.append(disk_resource)
    except Exception:
        disk_resource = {"id": "disk", "total": 100, "min": 5, "max": 50}
        resources.append(disk_resource)

    # GPU resources — one entry per detected GPU
    if gpu:
        all_gpus = gpu.get("all_gpus", [gpu])
        for g in all_gpus:
            vram_gb = round(g.get("gpu_vram_mib", 0) / 1024, 1)
            # Use nvidia-smi UUID if available; fall back to index-based id
            gpu_uuid = g.get("uuid") or f"gpu-nvidia-{g.get('index', 0)}"
            gpu_resource = {
                "id": gpu_uuid,
                "type": "gpu",
                "total": 1,
                "min": 1,
                "max": 1,
                "model": g.get("gpu_name"),
                "vram_gb": vram_gb,
                "cuda_version": g.get("cuda_version"),
                "compute_capability": g.get("compute_capability"),
                "driver_version": g.get("driver_version"),
            }
            resources.append(gpu_resource)

            compute_environments.append({
                "id": f"docker-{gpu_uuid}",
                "name": f"Docker CUDA on {g.get('gpu_name') or gpu_uuid}",
                "compute_types": ["inference", "training", "rendering"],
                "tags": ["docker", "cuda", "nvidia", f"gpu_uuid:{gpu_uuid}"],
                "resources": [
                    {"id": "cpu", "min": 1, "max": (cpu_resource or {}).get("max", 1)},
                    {"id": "ram", "min": 1, "max": (ram_resource or {}).get("max", 4)},
                    {"id": "disk", "min": 5, "max": (disk_resource or {}).get("max", 50)},
                    {"id": gpu_uuid, "type": "gpu", "min": 1, "max": 1},
                ],
            })

    return {"resources": resources, "compute_environments": compute_environments}

def get_model_cache_metrics():
    """Return disk usage metrics for the shared model cache path."""
    if not os.path.isdir(MODEL_CACHE_PATH):
        return {
            "path": MODEL_CACHE_PATH,
            "exists": False,
            "total_gb": None,
            "free_gb": None,
            "used_gb": None,
            "used_percent": None,
        }
    try:
        usage = shutil.disk_usage(MODEL_CACHE_PATH)
        total_gb = round(usage.total / 1024 / 1024 / 1024, 2)
        free_gb = round(usage.free / 1024 / 1024 / 1024, 2)
        used_gb = round((usage.total - usage.free) / 1024 / 1024 / 1024, 2)
        used_percent = round(((usage.total - usage.free) / usage.total) * 100, 1) if usage.total else 0.0
        return {
            "path": MODEL_CACHE_PATH,
            "exists": True,
            "total_gb": total_gb,
            "free_gb": free_gb,
            "used_gb": used_gb,
            "used_percent": used_percent,
        }
    except Exception as e:
        log.debug(f"Model cache metric collection failed: {e}")
        return {
            "path": MODEL_CACHE_PATH,
            "exists": False,
            "total_gb": None,
            "free_gb": None,
            "used_gb": None,
            "used_percent": None,
        }

# ─── HEARTBEAT ───────────────────────────────────────────────────────────────

_heartbeat_sequence = 0  # Sequence counter for P2P heartbeats

def get_system_metrics():
    """Calculate CPU and memory utilization percentages."""
    try:
        # CPU: average over 1 second
        import psutil
        cpu_percent = psutil.cpu_percent(interval=0.5)
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        return {
            "cpu": round(cpu_percent, 1),
            "memory": round(memory_percent, 1),
        }
    except (ImportError, Exception):
        return {"cpu": 0, "memory": 0}

def detect_vllm_models():
    """
    Detect running vLLM containers and query their available models.
    Returns list of model IDs from the vLLM /v1/models endpoint.
    """
    vllm_models = []
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}:{{.Ports}}"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return vllm_models

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            container_name = parts[0]
            ports_info = parts[1] if len(parts) > 1 else ""

            if not container_name.startswith("dc1-vllm-"):
                continue

            port_match = None
            for port_range in ["8100-8199", "8000"]:
                if port_range in ports_info:
                    port_match = port_range.split("-")[0] if "-" in port_range else port_range
                    break

            if not port_match:
                continue

            try:
                import urllib.request
                req = urllib.request.Request(
                    f"http://localhost:{port_match}/v1/models",
                    headers={"Accept": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        for model in data.get("data", []):
                            model_id = model.get("id")
                            if model_id:
                                vllm_models.append(model_id)
            except Exception as e:
                log.debug(f"vLLM models query failed for {container_name}: {e}")
    except Exception as e:
        log.debug(f"vLLM container detection failed: {e}")
    return vllm_models

def emit_p2p_heartbeat(peer_id, gpu, gpu_status):
    """Emit heartbeat to P2P DHT (non-blocking, fire-and-forget)."""
    global _heartbeat_sequence

    # Skip if P2P not enabled
    if not os.environ.get("P2P_DISCOVERY_ENABLED", "").lower() == "true":
        return

    try:
        import psutil
        gpu_util = float(gpu.get("gpu_util_pct", 0)) if gpu else 0
        metrics = get_system_metrics()
        metrics["gpu"] = round(gpu_util, 1)

        # Determine status based on utilization
        status = "healthy"
        if metrics.get("cpu", 0) > 95 or metrics.get("memory", 0) > 90:
            status = "warning"
        elif metrics.get("cpu", 0) > 85 or metrics.get("memory", 0) > 80:
            status = "degraded"

        # Find provider-heartbeat.js relative to daemon location
        script_dir = Path(__file__).parent.parent.parent / "p2p"
        script_path = script_dir / "provider-heartbeat.js"

        if not script_path.exists():
            log.debug(f"P2P heartbeat script not found: {script_path}")
            return

        # Spawn Node.js process (fire-and-forget)
        cmd = [
            "node", str(script_path),
            "--peer-id", peer_id,
            "--metrics", json.dumps(metrics),
            "--status", status,
            "--sequence", str(_heartbeat_sequence),
        ]

        subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env={**os.environ},
        )

        _heartbeat_sequence += 1
        log.debug(f"P2P heartbeat emitted (seq={_heartbeat_sequence-1})")
    except Exception as e:
        log.debug(f"P2P heartbeat emit failed: {e}")

def send_heartbeat():
    """Send heartbeat with GPU metrics to backend and P2P network."""
    gpu = detect_gpu()
    gpu_info = get_gpu_info()
    cache_metrics = get_model_cache_metrics()
    vllm_models = detect_vllm_models()
    gpu_status = {}
    if gpu:
        all_gpus = gpu.get("all_gpus", [gpu])
        gpu_count = len(all_gpus) or 1
        total_vram_mb = sum(int(g.get("gpu_vram_mib", 0) or 0) for g in all_gpus)
        gpu_status = {
            "gpu_name": gpu["gpu_name"],
            "gpu_vram_mib": gpu["gpu_vram_mib"],
            "vram_mb": total_vram_mb,
            "free_vram_mib": gpu["free_vram_mib"],
            "memory_used_mb": gpu["memory_used_mb"],
            "gpu_util_pct": gpu["gpu_util_pct"],
            "temp_c": gpu["temp_c"],
            "power_w": gpu["power_w"],
            "driver_version": gpu["driver_version"],
            "daemon_version": DAEMON_VERSION,
            "python_version": platform.python_version(),
            "os_info": f"{platform.system()} {platform.release()}",
            # Multi-GPU: full list of all detected GPUs (aggregated metrics)
            "all_gpus": all_gpus,
            "gpu_count": gpu_count,
            "compute_capability": gpu.get("compute_capability"),
            "cuda_version": gpu.get("cuda_version"),
        }
    gpu_status["model_cache_path"] = cache_metrics["path"]
    gpu_status["model_cache_exists"] = cache_metrics["exists"]
    gpu_status["model_cache_total_gb"] = cache_metrics["total_gb"]
    gpu_status["model_cache_free_gb"] = cache_metrics["free_gb"]
    gpu_status["model_cache_used_gb"] = cache_metrics["used_gb"]
    gpu_status["model_cache_used_percent"] = cache_metrics["used_percent"]

    peer_id = _get_or_create_peer_id()
    url = f"{API_URL}/api/providers/heartbeat"
    try:
        payload = {
            "api_key": API_KEY,
            "peer_id": peer_id,
            "gpu_status": gpu_status,
            "gpu_info": gpu_info,
            "provider_ip": None,
            "provider_hostname": platform.node(),
            "resource_spec": build_resource_spec(gpu),
            "model_cache": cache_metrics,
            "vllm_models": vllm_models,
        }
        # Include bandwidth stats if available
        with _bw_lock:
            if _bandwidth_stats.get("download_mbps") is not None:
                payload["bandwidth"] = dict(_bandwidth_stats)  # Copy to avoid race
        # Include network quality metrics
        with _nq_lock:
            if _network_quality.get("latency_ms") is not None:
                payload["network_quality"] = dict(_network_quality)
        # Include power cost config if enabled
        power_config = load_power_config()
        if power_config.get("enabled"):
            payload["power_config"] = {
                "electricity_cost_kwh": power_config.get("electricity_cost_kwh"),
                "gpu_tdp_watts": power_config.get("gpu_tdp_watts"),
            }
        # Include multi-GPU slot status
        payload["gpu_slots"] = {
            "total": MAX_CONCURRENT_JOBS,
            "active": get_active_job_count(),
            "free": get_free_gpu_slot_count(),
        }
        payload["draining"] = is_draining()
        code, resp = http_post(url, payload)
        if code == 200:
            log.info("Heartbeat OK (200)")
        else:
            log.warning(f"Heartbeat HTTP {code}: {resp}")
    except Exception as e:
        log.error(f"Heartbeat failed: {e}")

    # Emit P2P heartbeat (non-blocking)
    emit_p2p_heartbeat(peer_id, gpu, gpu_status)

def heartbeat_loop():
    """Background thread: send heartbeat every HEARTBEAT_INTERVAL seconds."""
    while True:
        send_heartbeat()
        time.sleep(HEARTBEAT_INTERVAL)

# ─── MACHINE VERIFICATION ───────────────────────────────────────────────────

def check_pending_verification():
    """Check if backend has a pending verification challenge for us."""
    url = f"{API_URL}/api/verification/pending?key={API_KEY}"
    try:
        code, resp = http_get(url)
        if code == 200 and resp.get("pending"):
            challenge = resp["challenge"]
            log.info(f"Verification challenge received: {challenge['challenge_id']}")
            run_verification(challenge)
    except Exception as e:
        log.debug(f"Verification check: {e}")

def run_verification(challenge):
    """Run GPU verification benchmark and submit results."""
    log.info(f"Running verification benchmark (challenge {challenge['challenge_id']})...")

    matrix_size = challenge.get("matrix_size", 4096)
    iterations = challenge.get("iterations", 5)
    nonce = challenge.get("nonce", "")

    gpu = detect_gpu()
    result = {
        "nonce": nonce,
        "gpu_name": gpu["gpu_name"] if gpu else None,
        "vram_total_mib": gpu["gpu_vram_mib"] if gpu else None,
        "driver_version": gpu["driver_version"] if gpu else None,
        "temp_c": None,
        "gflops": None,
        "elapsed_seconds": None,
    }

    try:
        import torch
        if not torch.cuda.is_available():
            result["error"] = "CUDA not available"
        else:
            device = torch.device("cuda")
            # Warm up
            A = torch.randn(matrix_size, matrix_size, device=device)
            B = torch.randn(matrix_size, matrix_size, device=device)
            torch.cuda.synchronize()

            # Benchmark
            start = time.time()
            for _ in range(iterations):
                C = torch.matmul(A, B)
            torch.cuda.synchronize()
            elapsed = time.time() - start

            flops = 2 * (matrix_size ** 3) * iterations
            gflops = flops / elapsed / 1e9

            # Post-benchmark GPU state
            gpu_after = detect_gpu()
            result["gflops"] = round(gflops, 2)
            result["elapsed_seconds"] = round(elapsed, 3)
            result["temp_c"] = gpu_after["temp_c"] if gpu_after else None

            log.info(f"Verification benchmark: {gflops:.2f} GFLOPS in {elapsed:.2f}s")
    except ImportError:
        result["error"] = "PyTorch not installed"
    except Exception as e:
        result["error"] = str(e)

    # Submit result
    url = f"{API_URL}/api/verification/submit"
    try:
        code, resp = http_post(url, {
            "api_key": API_KEY,
            "challenge_id": challenge["challenge_id"],
            "result": result,
        })
        verdict = resp.get("verdict", "unknown")
        score = resp.get("score", 0)
        log.info(f"Verification result: verdict={verdict} score={score}")
        if resp.get("flags"):
            for flag in resp["flags"]:
                log.info(f"  Flag: [{flag['severity']}] {flag['type']} — {flag['detail']}")
    except Exception as e:
        log.error(f"Verification submit failed: {e}")

# ─── HMAC VERIFICATION ───────────────────────────────────────────────────────

def verify_task_spec_hmac(task_spec_str, expected_hmac):
    """Verify HMAC-SHA256 signature of task_spec before execution.

    Returns True if signature is valid, False otherwise.
    Fails CLOSED: returns False on any error except missing secret (backward compat).
    """
    if not task_spec_str:
        return True  # No task_spec to verify

    # If secret wasn't injected at download time, fall back to remote verify
    if HMAC_SECRET in ("{{HMAC_SECRET}}", "", None):
        if not expected_hmac:
            log.error("HMAC verification: no signature and no local secret — rejecting")
            return False
        try:
            code, resp = http_get(
                f"{API_URL}/api/jobs/verify-hmac-local?key={API_KEY}&hmac={expected_hmac}",
                timeout=10
            )
            if code == 200 and resp.get("valid"):
                return True
            log.error(f"HMAC remote verification returned invalid: {resp}")
            return False
        except Exception as e:
            log.error(f"HMAC remote verification failed: {e}")
            return False

    # Local verification with injected secret
    if not expected_hmac:
        log.error("HMAC verification: task_spec present but no signature — rejecting")
        return False

    try:
        spec_bytes = task_spec_str.encode("utf-8") if isinstance(task_spec_str, str) else task_spec_str
        computed = hmac.new(
            HMAC_SECRET.encode("utf-8"),
            spec_bytes,
            hashlib.sha256
        ).hexdigest()
        valid = hmac.compare_digest(computed, expected_hmac)
        if not valid:
            log.error("HMAC verification: signature mismatch — task_spec may have been tampered with")
        return valid
    except Exception as e:
        log.error(f"HMAC verification error: {e}")
        return False


# ─── JOB EXECUTION ───────────────────────────────────────────────────────────

def run_gpu_benchmark(task_spec):
    """Execute GPU benchmark using PyTorch matrix multiplication."""
    matrix_size = task_spec.get("matrix_size", 4096)
    iterations = task_spec.get("iterations", 5)

    log.info(f"Running GPU benchmark: {matrix_size}x{matrix_size} matmul, {iterations} iterations")

    try:
        import torch
        if not torch.cuda.is_available():
            return {"success": False, "error": "CUDA not available"}

        device = torch.device("cuda")
        A = torch.randn(matrix_size, matrix_size, device=device)
        B = torch.randn(matrix_size, matrix_size, device=device)
        torch.cuda.synchronize()

        start = time.time()
        for _ in range(iterations):
            C = torch.matmul(A, B)
        torch.cuda.synchronize()
        elapsed = time.time() - start

        flops = 2 * (matrix_size ** 3) * iterations
        gflops = flops / elapsed / 1e9

        gpu = detect_gpu()
        result = {
            "gflops": round(gflops, 2),
            "elapsed_seconds": round(elapsed, 3),
            "matrix_size": matrix_size,
            "iterations": iterations,
            "gpu_name": gpu["gpu_name"] if gpu else "unknown",
            "gpu_temp_c": gpu["temp_c"] if gpu else None,
            "gpu_util_pct": gpu["gpu_util_pct"] if gpu else None,
            "vram_used_mib": gpu["memory_used_mb"] if gpu else None,
        }

        log.info(f"Benchmark complete: {gflops:.2f} GFLOPS in {elapsed:.2f}s")
        return {"success": True, "result": result}

    except ImportError:
        return {"success": False, "error": "PyTorch not installed"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def _ensure_seccomp_profile():
    """Write DC1 GPU-workload seccomp profile to disk once; return its path or None on failure.

    Uses a blacklist (default ALLOW) so CUDA/Python workloads function normally while
    blocking kernel-level privilege escalation and dangerous syscalls.
    """
    global _SECCOMP_PROFILE_PATH
    if _SECCOMP_PROFILE_PATH and os.path.exists(_SECCOMP_PROFILE_PATH):
        return _SECCOMP_PROFILE_PATH

    blocked = [
        # Kernel module loading / live-patching
        "create_module", "init_module", "finit_module", "delete_module",
        "get_kernel_syms", "query_module",
        # Privilege escalation / capability manipulation
        "ptrace", "acct",
        # Clock/time manipulation (integrity)
        "settimeofday", "adjtimex", "clock_adjtime", "clock_settime",
        # Direct hardware access
        "iopl", "ioperm",
        # Namespace / root filesystem escape
        "mount", "umount2", "pivot_root", "chroot",
        # Reboot / power control
        "reboot", "kexec_load", "kexec_file_load",
        # Swap control
        "swapon", "swapoff",
        # Kernel keyring (credential theft)
        "add_key", "keyctl", "request_key",
        # Perf events (speculative-execution side channels)
        "perf_event_open",
        # Obsolete / unused syscalls that provide no legitimate use
        "nfsservctl", "getpmsg", "putpmsg", "afs_syscall", "tuxcall", "security",
        "lookup_dcookie", "vhangup", "sysfs", "_sysctl",
        # NUMA memory policy manipulation
        "mbind", "set_mempolicy", "get_mempolicy",
        # Kernel logging
        "syslog",
    ]
    profile = {
        "defaultAction": "SCMP_ACT_ALLOW",
        "syscalls": [{"names": blocked, "action": "SCMP_ACT_ERRNO"}],
    }

    profile_path = "/tmp/dc1-gpu-seccomp.json"
    try:
        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(profile, f)
        _SECCOMP_PROFILE_PATH = profile_path
        log.info(f"Seccomp profile written to {profile_path} ({len(blocked)} blocked syscalls)")
    except Exception as e:
        log.warning(f"Could not write seccomp profile: {e} — container will use Docker default")
        _SECCOMP_PROFILE_PATH = None
    return _SECCOMP_PROFILE_PATH


def _container_profile_for_job(job_type):
    """Return per-job container limits by workload class."""
    profiles = {
        "default": {
            "cpu": CONTAINER_CPU_LIMIT,
            "memory": CONTAINER_MEMORY_LIMIT,
            "pids": CONTAINER_PIDS_LIMIT,
            "tmp": CONTAINER_TMP_SIZE,
            "shm": "2g",
        },
        "benchmark": {"cpu": "2", "memory": "8g", "pids": "128", "tmp": "512m", "shm": "1g"},
        "llm-inference": {"cpu": CONTAINER_CPU_LIMIT, "memory": CONTAINER_MEMORY_LIMIT, "pids": CONTAINER_PIDS_LIMIT, "tmp": CONTAINER_TMP_SIZE, "shm": "2g"},
        "llm_inference": {"cpu": CONTAINER_CPU_LIMIT, "memory": CONTAINER_MEMORY_LIMIT, "pids": CONTAINER_PIDS_LIMIT, "tmp": CONTAINER_TMP_SIZE, "shm": "2g"},
        "image_generation": {"cpu": CONTAINER_CPU_LIMIT, "memory": CONTAINER_MEMORY_LIMIT, "pids": CONTAINER_PIDS_LIMIT, "tmp": CONTAINER_TMP_SIZE, "shm": "2g"},
        "rendering": {"cpu": CONTAINER_CPU_LIMIT, "memory": CONTAINER_MEMORY_LIMIT, "pids": CONTAINER_PIDS_LIMIT, "tmp": CONTAINER_TMP_SIZE, "shm": "2g"},
        "training": {"cpu": "8", "memory": "24g", "pids": "512", "tmp": "2g", "shm": "4g"},
        "custom_container": {"cpu": CONTAINER_CPU_LIMIT, "memory": CONTAINER_MEMORY_LIMIT, "pids": CONTAINER_PIDS_LIMIT, "tmp": CONTAINER_TMP_SIZE, "shm": "2g"},
    }
    return profiles.get(job_type, profiles["default"])


def _vllm_profile_for_model(model):
    """Return vLLM limits sized to expected model footprint."""
    small_models = {
        "google/gemma-2b-it",
        "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        "microsoft/Phi-3-mini-4k-instruct",
    }
    if model in small_models:
        return {"cpu": "6", "memory": "16g", "pids": "256", "tmp": "1g", "shm": "3g"}
    return {"cpu": VLLM_CPU_LIMIT, "memory": VLLM_MEMORY_LIMIT, "pids": VLLM_PIDS_LIMIT, "tmp": VLLM_TMP_SIZE, "shm": VLLM_SHM_SIZE}


def _resolve_run_job_script():
    """Find infra/docker/run-job.sh from common install locations."""
    candidates = []
    env_path = os.environ.get("DCP_RUN_JOB_SH", "").strip()
    if env_path:
        candidates.append(Path(env_path).expanduser())

    daemon_path = Path(__file__).resolve()
    for parent in [daemon_path.parent] + list(daemon_path.parents):
        candidates.append(parent / "infra" / "docker" / "run-job.sh")
    candidates.append(Path.cwd() / "infra" / "docker" / "run-job.sh")

    seen = set()
    for candidate in candidates:
        candidate_str = str(candidate)
        if candidate_str in seen:
            continue
        seen.add(candidate_str)
        if candidate.is_file():
            return candidate_str
    return None

def _normalize_container_spec(container_spec):
    """Return container_spec as dict or None."""
    if isinstance(container_spec, str):
        try:
            parsed = json.loads(container_spec)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return None
        return None
    if isinstance(container_spec, dict):
        return container_spec
    return None

def _docker_container_status(container_ref):
    """Return Docker container state string (running/exited/dead/...) or None."""
    if not container_ref:
        return None
    try:
        inspect = subprocess.run(
            ["docker", "inspect", "--format={{.State.Status}}", str(container_ref)],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if inspect.returncode != 0:
            return None
        status = (inspect.stdout or "").strip().lower()
        return status or None
    except Exception:
        return None

def run_docker_job(job_type, task_spec, container_spec, job_id=None):
    """Execute script jobs via infra/docker/run-job.sh with crash auto-restart."""
    # Local images built via backend/docker/build-images.sh
    IMAGE_MAP = {
        "image_generation":  "dc1/sd-worker:latest",
        "llm-inference":     "dc1/llm-worker:latest",
        "llm_inference":     "dc1/llm-worker:latest",
        "training":          "dc1/general-worker:latest",
        "rendering":         "dc1/general-worker:latest",
        "benchmark":         "dc1/general-worker:latest",
        "custom_container":  "dc1/general-worker:latest",
    }
    TEMPLATE_IMAGES = {
        "dc1/general-worker:latest",
        "dc1/llm-worker:latest",
        "dc1/sd-worker:latest",
        "dc1/base-worker:latest",
        "pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime",
        "pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime",
        "nvcr.io/nvidia/pytorch:24.01-py3",
        "nvcr.io/nvidia/tensorflow:24.01-tf2-py3",
        "tensorflow/tensorflow:2.15.0-gpu",
        "vllm/vllm-openai:latest",
        "dcp/pytorch-cuda:latest",
        "dcp/vllm-serve:latest",
        "dcp/training:latest",
        "dcp/rendering:latest",
    }

    # Parse task_spec — may be string (Python script) or dict (JSON with script)
    if isinstance(task_spec, str):
        try:
            parsed = json.loads(task_spec)
            if isinstance(parsed, dict):
                task_spec = parsed
        except Exception:
            pass

    container_spec = _normalize_container_spec(container_spec)
    if not container_spec:
        return {"success": False, "error": "Missing or invalid container_spec. Raw Python execution is disabled.", "restart_count": 0}

    image = str(container_spec.get("image") or container_spec.get("image_override") or IMAGE_MAP.get(job_type, "dc1/general-worker:latest")).strip()
    lower_image = image.lower()
    is_hub = lower_image.startswith("hub.docker.com/r/")
    hub_pinned = "@sha256:" in lower_image and len(lower_image.split("@sha256:")[-1]) == 64
    generic_ok = bool(lower_image) and "/" in lower_image and (" " not in lower_image)
    if lower_image not in TEMPLATE_IMAGES and not (is_hub and hub_pinned) and not generic_ok:
        report_event("container_image_rejected", {"job_id": job_id, "rejected_image": image}, job_id=job_id, severity="warning")
        return {"success": False, "error": f"Rejected container image '{image}'", "restart_count": 0}

    script = task_spec if isinstance(task_spec, str) else task_spec.get("script", "")
    if not script:
        return {"success": False, "error": "No script in task_spec", "restart_count": 0}

    run_job_script = _resolve_run_job_script()
    if not run_job_script:
        return {"success": False, "error": "run-job.sh not found (expected infra/docker/run-job.sh)", "restart_count": 0}

    job_dir = tempfile.mkdtemp(prefix="dc1-job-")
    task_path = os.path.join(job_dir, "task.py")
    with open(task_path, "w", encoding="utf-8") as f:
        f.write(script)

    container_profile = _container_profile_for_job(job_type)
    limits = container_spec.get("limits", {}) if isinstance(container_spec.get("limits"), dict) else {}
    network = str(container_spec.get("network", "none"))
    if not (network == "none" or network.startswith("bridge:")):
        network = "none"
    cpus = str(container_spec.get("cpus", limits.get("cpus", container_profile["cpu"])))
    memory = str(container_spec.get("memory", limits.get("memory", container_profile["memory"])))
    tmpfs_size = str(container_spec.get("tmpfs_size", limits.get("tmpfs_size", container_profile["tmp"])))
    gpus = str(container_spec.get("gpus", "all"))
    pids_limit = str(container_spec.get("pids_limit", limits.get("pids_limit", container_profile["pids"])))
    stream_logs = bool(container_spec.get("stream_logs", True))
    raw_job_cmd = container_spec.get("job_cmd") or container_spec.get("command") or container_spec.get("cmd") or "python /dc1/job/task.py"
    if isinstance(raw_job_cmd, list):
        job_cmd = " ".join(shlex.quote(str(part)) for part in raw_job_cmd)
    else:
        job_cmd = str(raw_job_cmd)

    safe_job_id = "".join(ch if (ch.isalnum() or ch in "._-") else "-" for ch in str(job_id or int(time.time())))
    workspace_volume = f"dcp-job-{safe_job_id}"
    checkpoint_enabled = bool(container_spec.get("enable_checkpoint", False))
    checkpoint_name = f"cp-{safe_job_id[:64]}"

    run_job_cmd = [
        "bash", run_job_script,
        "--job-id", str(job_id or int(time.time())),
        "--image", image,
        "--host-job-dir", job_dir,
        "--job-cmd", job_cmd,
        "--network", network,
        "--cpus", cpus,
        "--memory", memory,
        "--tmpfs-size", tmpfs_size,
        "--gpus", gpus,
        "--pids-limit", pids_limit,
        "--workspace-volume", workspace_volume,
        "--checkpoint-name", checkpoint_name,
    ]
    if checkpoint_enabled:
        run_job_cmd.append("--enable-checkpoint")
    if not stream_logs:
        run_job_cmd.append("--no-stream-logs")

    restart_count = 0
    last_error = None
    try:
        while True:
            report_event(
                "container_start",
                f"Launching container for job {job_id}: image={image} cpu={cpus} mem={memory} pids={pids_limit} volume={workspace_volume} checkpoint={checkpoint_enabled} restart_count={restart_count}",
                job_id=job_id,
            )

            start_ts = time.time()
            container_id = None
            try:
                proc = subprocess.Popen(
                    run_job_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    bufsize=1
                )

                output_chunks = []
                live_batch = []
                last_flush = time.time()
                last_health_check = 0.0

                while True:
                    if time.time() - start_ts > JOB_TIMEOUT:
                        try:
                            proc.kill()
                        except Exception:
                            pass
                        raise subprocess.TimeoutExpired(run_job_cmd, JOB_TIMEOUT)

                    line = proc.stdout.readline() if proc.stdout else ""
                    if line:
                        output_chunks.append(line)
                        if len(output_chunks) > 10000:
                            output_chunks = output_chunks[-10000:]

                        clean = line.rstrip("\r\n")
                        if clean:
                            live_batch.append({"level": "info", "message": clean[:2000]})
                            if "container_id=" in clean:
                                container_id = clean.split("container_id=", 1)[1].split()[0].strip()

                        if job_id and clean.startswith("[dc1-phase]"):
                            phase = clean.split("]", 1)[1].strip()
                            threading.Thread(target=report_job_progress, args=(job_id, phase), daemon=True).start()

                        if clean.startswith("[dc1]"):
                            log.info(f"  {clean}")

                        if job_id and len(live_batch) >= 10:
                            post_job_log_lines(job_id, live_batch)
                            live_batch = []
                            last_flush = time.time()
                    else:
                        if proc.poll() is not None:
                            break
                        if job_id and live_batch and (time.time() - last_flush >= 1.0):
                            post_job_log_lines(job_id, live_batch)
                            live_batch = []
                            last_flush = time.time()

                        if container_id and (time.time() - last_health_check >= 5.0):
                            status = _docker_container_status(container_id)
                            if status:
                                log.debug(f"[container-health] job={job_id} container={container_id[:12]} status={status}")
                                if status in ("exited", "dead"):
                                    report_event(
                                        "container_crash_detected",
                                        f"Container crashed for job {job_id}: status={status}",
                                        job_id=job_id,
                                        severity="warning",
                                    )
                            last_health_check = time.time()
                        time.sleep(0.05)

                if job_id and live_batch:
                    post_job_log_lines(job_id, live_batch)

                returncode = proc.wait(timeout=10)
                duration = round(time.time() - start_ts, 1)
                stdout = "".join(output_chunks)[:MAX_STDOUT]
                stderr = ""

                if returncode == 0:
                    report_event("container_complete", f"Container job {job_id} succeeded in {duration}s, exit=0", job_id=job_id)
                    return {
                        "success": True,
                        "result": stdout,
                        "stderr": stderr,
                        "logs_streamed": True,
                        "restart_count": restart_count,
                        "last_error": None,
                    }

                status = _docker_container_status(container_id) or "exited"
                err_tail = "\n".join(stdout.splitlines()[-20:])[:500]
                last_error = f"Exit code {returncode} (status={status}): {err_tail}"
                report_event(
                    "container_complete",
                    f"Container job {job_id} failed in {duration}s, exit={returncode}, status={status}",
                    job_id=job_id,
                    severity="warning",
                )
            except subprocess.TimeoutExpired:
                if container_id:
                    try:
                        subprocess.run(["docker", "rm", "-f", container_id], capture_output=True, timeout=10)
                    except Exception:
                        pass
                timeout_msg = f"Job timed out after {JOB_TIMEOUT}s"
                report_event("container_timeout", f"Container job {job_id} killed after {JOB_TIMEOUT}s timeout", job_id=job_id, severity="error")
                return {"success": False, "error": timeout_msg, "restart_count": restart_count, "last_error": timeout_msg}
            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
                report_event("container_error", f"Container job {job_id} error: {last_error}", job_id=job_id, severity="error")

            if restart_count >= MAX_CONTAINER_RESTARTS:
                return {
                    "success": False,
                    "error": last_error or "Container crashed repeatedly",
                    "logs_streamed": True,
                    "restart_count": restart_count,
                    "last_error": last_error,
                }

            backoff = CONTAINER_RESTART_BACKOFFS[min(restart_count, len(CONTAINER_RESTART_BACKOFFS) - 1)]
            next_restart_num = restart_count + 1
            report_event(
                "container_restart",
                f"Restarting crashed container for job {job_id}: attempt {next_restart_num}/{MAX_CONTAINER_RESTARTS}, backoff={backoff}s",
                job_id=job_id,
                severity="warning",
            )
            time.sleep(backoff)
            restart_count = next_restart_num
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

def report_job_progress(job_id, phase):
    """Report job execution phase to backend for live UI updates."""
    url = f"{API_URL}/api/jobs/{job_id}/progress"
    payload = {"api_key": API_KEY, "phase": phase}
    try:
        code, resp = http_post(url, payload, timeout=5)
        if code == 200:
            log.info(f"Progress reported: job={job_id} phase={phase}")
        else:
            log.debug(f"Progress report HTTP {code}: {resp}")
    except Exception as e:
        log.debug(f"Progress report failed (non-critical): {e}")

def post_job_log_lines(job_id, lines):
    """Send structured log lines to provider log-ingest endpoint."""
    if not job_id or not lines:
        return 0
    url = f"{API_URL}/api/providers/jobs/{job_id}/logs"
    payload = {"api_key": API_KEY, "lines": lines[:500]}
    try:
        code, _ = http_patch(url, payload, timeout=8)
        if code == 200:
            return len(payload["lines"])
        log.debug(f"Job log upload HTTP {code} for {job_id}")
        return 0
    except Exception as e:
        log.debug(f"Job log upload failed (non-critical): {e}")
        return 0

def post_job_logs(job_id, stdout, stderr=""):
    """Send collected stdout/stderr lines to backend after execution completes."""
    lines = []
    for line in (stdout or "").splitlines():
        if line:
            lines.append({"level": "info", "message": line[:2000]})
    for line in (stderr or "").splitlines():
        if line:
            lines.append({"level": "error", "message": line[:2000]})
    if not lines:
        return
    for i in range(0, len(lines), 500):
        post_job_log_lines(job_id, lines[i:i + 500])

def run_bare_metal_job(task_spec, job_id=None):
    """Bare-metal execution is disabled for security and isolation."""
    return {"success": False, "error": "Bare-metal execution disabled. container_spec is required."}

def _find_free_port(start=8100, end=8199):
    """Find a free TCP port in [start, end] for vLLM container binding."""
    import socket
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    return None


def _get_public_ip():
    """Return best-guess public IP for this host (used in endpoint URL reporting)."""
    import socket
    try:
        # Connect to an external address (no traffic sent) to determine outbound interface IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return None


def run_vllm_serve_job(task_spec, job_id=None):
    """
    Start a vLLM OpenAI-compatible serving container on a free port.
    The container stays running until duration_minutes expires or the job is cancelled.
    Reports endpoint_url to backend once /health responds 200.
    """
    import socket

    # Parse task_spec JSON
    if isinstance(task_spec, str):
        try:
            task_spec = json.loads(task_spec)
        except Exception:
            pass
    if not isinstance(task_spec, dict):
        return {"success": False, "error": "Invalid task_spec for vllm_serve — expected JSON"}

    model = task_spec.get("model", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
    max_model_len = int(task_spec.get("max_model_len", 4096))
    dtype = task_spec.get("dtype", "float16")

    # Allowed models (mirrors backend whitelist)
    ALLOWED_VLLM_MODELS = {
        "mistralai/Mistral-7B-Instruct-v0.2",
        "meta-llama/Meta-Llama-3-8B-Instruct",
        "microsoft/Phi-3-mini-4k-instruct",
        "google/gemma-2b-it",
        "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
    }
    if model not in ALLOWED_VLLM_MODELS:
        log.warning(f"Rejected vllm model '{model}' — not in whitelist. Using TinyLlama.")
        model = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

    image = "vllm/vllm-openai:latest"
    container_name = f"dc1-vllm-{job_id or int(time.time())}"
    seccomp_path = _ensure_seccomp_profile()
    container_profile = _vllm_profile_for_model(model)

    # Allocate a free host port
    port = _find_free_port()
    if not port:
        return {"success": False, "error": "No free port available in range 8100-8199"}

    log.info(f"vLLM serve: model={model} port={port} container={container_name}")
    report_job_progress(job_id, "pulling")

    # Pull image
    try:
        pull = subprocess.run(
            ["docker", "pull", image],
            capture_output=True, text=True, timeout=600
        )
        if pull.returncode != 0:
            return {"success": False, "error": f"vLLM image pull failed: {pull.stderr[:200]}", "transient": True}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "vLLM image pull timed out (600s)", "transient": True}
    except Exception as e:
        return {"success": False, "error": f"vLLM pull error: {e}", "transient": True}

    report_job_progress(job_id, "loading_model")
    report_event(
        "container_start",
        f"Starting vLLM serve: {container_name} model={model} port={port} "
        f"cpu={container_profile['cpu']} mem={container_profile['memory']} pids={container_profile['pids']}",
        job_id=job_id
    )

    # Start container detached — bridge network so the port is accessible from outside
    docker_cmd = [
        "docker", "run", "-d",
        "--gpus", "all",
        "--name", container_name,
        "--network", "bridge",
        "-p", f"{port}:8000",
        "--memory", container_profile["memory"],
        "--memory-swap", container_profile["memory"],
        "--cpus", container_profile["cpu"],
        "--pids-limit", container_profile["pids"],
        "--shm-size", container_profile["shm"],
        "--tmpfs", f"/tmp:rw,noexec,nosuid,size={container_profile['tmp']}",
        "--tmpfs", "/var/tmp:rw,noexec,nosuid,size=256m",
        "--cap-drop", "all",
        "--security-opt", "no-new-privileges:true",
        "-e", f"HUGGING_FACE_HUB_TOKEN={os.environ.get('HF_TOKEN', '')}",
    ]
    if seccomp_path:
        docker_cmd.extend(["--security-opt", f"seccomp={seccomp_path}"])
    docker_cmd += [
        image,
        "--model", model,
        "--dtype", dtype,
        "--max-model-len", str(max_model_len),
        "--host", "0.0.0.0",
        "--port", "8000",
    ]

    try:
        start_result = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=30)
        if start_result.returncode != 0:
            return {"success": False, "error": f"Failed to start vLLM container: {start_result.stderr[:300]}"}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Docker start timed out"}
    except Exception as e:
        return {"success": False, "error": f"Docker start error: {e}"}

    # Poll /health until ready (up to 5 minutes for model load)
    health_url = f"http://127.0.0.1:{port}/health"
    ready = False
    for attempt in range(60):  # 60 × 5s = 5 minutes
        time.sleep(5)
        try:
            import urllib.request as _urllib
            with _urllib.urlopen(health_url, timeout=3) as r:
                if r.status == 200:
                    ready = True
                    break
        except Exception:
            pass
        # Check container is still alive
        check = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}", container_name],
            capture_output=True, text=True
        )
        if check.stdout.strip() != "true":
            log.error(f"vLLM container {container_name} exited during startup")
            return {"success": False, "error": "vLLM container exited before becoming healthy"}

    if not ready:
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
        return {"success": False, "error": "vLLM endpoint did not become healthy within 5 minutes"}

    # Report endpoint ready to backend
    public_ip = _get_public_ip()
    try:
        http_post(f"{API_URL}/api/jobs/{job_id}/endpoint-ready", {
            "api_key": API_KEY,
            "port": port,
            "provider_ip": public_ip,
        }, timeout=15)
    except Exception as e:
        log.warning(f"Failed to report endpoint-ready: {e}")

    report_job_progress(job_id, "generating")  # "generating" = actively serving requests
    log.info(f"vLLM endpoint ready: http://{public_ip}:{port}/v1")

    # Hold the serving loop — monitor container until backend says job is done or duration expires
    # The backend enforces timeout via enforceJobTimeouts(); daemon monitors container health
    poll_interval = 30  # seconds between container health checks
    while True:
        time.sleep(poll_interval)
        # Check if container is still running
        check = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}", container_name],
            capture_output=True, text=True
        )
        if check.stdout.strip() != "true":
            log.info(f"vLLM container {container_name} stopped externally")
            break
        # Check if the backend job is still running
        try:
            code, job_status_resp = http_get(f"{API_URL}/api/jobs/{job_id}?key={API_KEY}")
            if code == 200:
                current_status = job_status_resp.get("job", {}).get("status", "running")
                if current_status not in ("running", "pulling", "assigned"):
                    log.info(f"Job {job_id} status={current_status} — stopping vLLM container")
                    break
        except Exception:
            pass  # Network hiccup — keep serving

    # Cleanup: stop and remove container
    subprocess.run(["docker", "stop", "--time", "10", container_name], capture_output=True)
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
    report_event("container_complete", f"vLLM serve job {job_id} completed — container stopped", job_id=job_id)
    log.info(f"vLLM container {container_name} stopped and removed")

    endpoint_url = f"http://{public_ip}:{port}/v1"
    return {
        "success": True,
        "result": {
            "endpoint_url": endpoint_url,
            "model": model,
            "port": port,
        },
        # Backward-compatible top-level keys for any consumers that read outcome directly.
        "endpoint_url": endpoint_url,
        "model": model,
        "port": port,
    }


def execute_job(job):
    """Execute a job with Docker-only script execution."""
    global _current_job_id
    job_id = job["job_id"]
    job_type = job.get("job_type", "benchmark")
    task_spec = job.get("task_spec", {})
    container_spec = job.get("container_spec")
    with _job_lock:
        _current_job_id = job_id

    if isinstance(task_spec, str):
        try:
            task_spec = json.loads(task_spec)
        except:
            pass  # Keep as string (it might be raw Python code)
    if isinstance(task_spec, dict) and not container_spec:
        container_spec = task_spec.get("container_spec")

    log.info(f"Executing job {job_id} (type: {job_type})")

    try:
        # vLLM serverless serve — long-running detached container with health polling.
        # This must run before benchmark fallback in case task_spec contains benchmark metadata.
        if job_type == "vllm_serve":
            if not check_docker():
                return {"success": False, "error": "Docker not available — vllm_serve requires Docker with NVIDIA Container Toolkit"}
            return run_vllm_serve_job(task_spec, job_id=job_id)

        # Pure benchmark jobs (no script needed)
        if job_type == "benchmark" or (isinstance(task_spec, dict) and task_spec.get("benchmark")):
            return run_gpu_benchmark(task_spec if isinstance(task_spec, dict) else {})

        # Script-based jobs — Docker only
        has_script = (isinstance(task_spec, str) and len(task_spec) > 10) or \
                     (isinstance(task_spec, dict) and task_spec.get("script"))

        if has_script:
            if not container_spec:
                return {"success": False, "error": "Job rejected: missing container_spec. Raw Python execution is disabled."}
            if not check_docker():
                return {"success": False, "error": "Docker not available. container_spec jobs require Docker execution."}
            return run_docker_job(job_type, task_spec, container_spec, job_id=job_id)
        else:
            # No script — fall back to benchmark
            log.info(f"No script in task_spec — running default benchmark")
            return run_gpu_benchmark(task_spec if isinstance(task_spec, dict) else {})
    finally:
        with _job_lock:
            _current_job_id = None

def poll_and_execute():
    """Poll for assigned jobs and execute them."""
    # Skip polling if draining (finishing current jobs, no new ones)
    if is_draining():
        log.debug("Draining mode — skipping job poll")
        return

    # Skip if all GPU slots are occupied
    if get_free_gpu_slot_count() <= 0:
        log.debug(f"All {MAX_CONCURRENT_JOBS} GPU slot(s) occupied — skipping job poll")
        return

    # Dual endpoint support: try new endpoint first, fall back to legacy
    urls = [
        f"{API_URL}/api/providers/{API_KEY}/jobs",
        f"{API_URL}/api/jobs/assigned?key={API_KEY}",
    ]

    job = None
    for url in urls:
        try:
            code, resp = http_get(url)
            if code == 200:
                job = resp.get("job")
                if job:
                    break
        except Exception as e:
            log.debug(f"Job poll failed on {url}: {e}")
            continue

    if not job:
        return  # No jobs assigned

    job_id = job["job_id"]
    job_type = job.get("job_type", "unknown")
    log.info(f"Job assigned: {job_id} (type: {job_type})")

    # ── Guard: Job dedup ──
    if is_duplicate_job(job_id):
        return  # Already processed this job

    # ── Guard: VRAM check ──
    vram_ok, free_vram, required_vram = check_vram_available(job_type)
    if not vram_ok:
        log.warning(f"Job {job_id} rejected: insufficient VRAM ({free_vram}/{required_vram} MiB)")
        report_event("job_failure",
            f"Job rejected pre-execution: {free_vram} MiB free VRAM < {required_vram} MiB required for {job_type}. "
            f"GPU may be in use by another application.",
            job_id=job_id, severity="warning")
        # Submit failure so backend can reassign
        try:
            http_post(f"{API_URL}/api/providers/job-result", {
                "api_key": API_KEY, "job_id": job_id, "success": False,
                "error": f"Insufficient VRAM: {free_vram} MiB free, {required_vram} MiB required",
                "gpu_seconds_used": 0,
            }, timeout=15)
        except: pass
        return

    # ── Guard: Disk space check ──
    disk_ok, disk_detail = check_disk_space()
    if not disk_ok:
        log.warning(f"Job {job_id} rejected: insufficient disk space — {disk_detail}")
        report_event("job_failure",
            f"Job rejected pre-execution: {disk_detail}",
            job_id=job_id, severity="warning")
        try:
            http_post(f"{API_URL}/api/providers/job-result", {
                "api_key": API_KEY, "job_id": job_id, "success": False,
                "error": f"Insufficient disk space: {disk_detail}",
                "gpu_seconds_used": 0,
            }, timeout=15)
        except: pass
        return

    # ── Guard: Power cost profitability ──
    gpu = detect_gpu()
    profitable, profit_details = estimate_job_profitability(job, gpu)
    if not profitable:
        log.warning(f"Job {job_id} rejected: unprofitable — "
                    f"revenue={profit_details['revenue_sar']} SAR, "
                    f"cost={profit_details['power_cost_sar']} SAR, "
                    f"margin={profit_details['margin_pct']}%")
        report_event("job_rejected",
            f"Unprofitable job: margin={profit_details['margin_pct']}% "
            f"(min: {load_power_config().get('min_profit_margin_pct', 20)}%)",
            job_id=job_id, severity="info")
        try:
            http_post(f"{API_URL}/api/providers/job-result", {
                "api_key": API_KEY, "job_id": job_id, "success": False,
                "error": f"Job rejected: below minimum profit margin ({profit_details['margin_pct']}%)",
                "gpu_seconds_used": 0,
            }, timeout=15)
        except: pass
        return

    # ── Guard: HMAC signature verification (prevents RCE via tampered task_spec) ──
    task_spec_raw = job.get("task_spec")
    task_spec_hmac = job.get("task_spec_hmac")
    if task_spec_raw:
        if not verify_task_spec_hmac(task_spec_raw, task_spec_hmac):
            log.error(f"Job {job_id} REJECTED: task_spec HMAC verification failed — possible tampering or unauthorized injection")
            report_event("job_failure",
                f"Job rejected: HMAC verification failed. task_spec may have been tampered with.",
                job_id=job_id, severity="critical")
            try:
                http_post(f"{API_URL}/api/providers/job-result", {
                    "api_key": API_KEY, "job_id": job_id, "success": False,
                    "error": "HMAC verification failed — task_spec rejected for security",
                    "gpu_seconds_used": 0,
                }, timeout=15)
            except: pass
            return

    # ── Acquire GPU slot for multi-GPU support ──
    required_vram = VRAM_REQUIREMENTS.get(job_type, VRAM_DEFAULT_REQUIREMENT)
    gpu_slot = acquire_gpu_slot(job_id, required_vram)
    if gpu_slot is None:
        log.warning(f"Job {job_id} deferred: no free GPU slot with enough VRAM")
        return  # Will be picked up on next poll when a slot frees

    # Execute in background thread so heartbeats continue
    def _run():
        start_time = time.time()
        try:
            # Set CUDA_VISIBLE_DEVICES for multi-GPU isolation
            job_env = os.environ.copy()
            if MAX_CONCURRENT_JOBS > 1:
                job_env["CUDA_VISIBLE_DEVICES"] = str(gpu_slot)
                log.info(f"Job {job_id} pinned to GPU {gpu_slot}")
            outcome = execute_job(job)
        except Exception as e:
            elapsed = round(time.time() - start_time, 1)
            error_detail = f"Unhandled exception in execute_job: {e}\n{traceback.format_exc()}"
            log.error(f"Job {job_id} CRASHED after {elapsed}s: {error_detail[:500]}")
            report_event("job_failure", error_detail, job_id=job_id, severity="critical")
            outcome = {"success": False, "error": error_detail[:1000]}
        finally:
            # Release GPU slot regardless of outcome
            release_gpu_slot(gpu_slot, job_id)

        elapsed = round(time.time() - start_time, 1)
        gpu_count = get_detected_gpu_count()
        gpu_seconds_used = round(max(0.0, elapsed) * max(1, gpu_count), 3)

        # Report event based on outcome
        if outcome.get("success"):
            result_size = len(str(outcome.get("result", "")))
            report_event("job_success",
                f"Job completed in {elapsed}s, result size: {result_size} bytes",
                job_id=job_id)
        else:
            error_msg = outcome.get("error", "Unknown error")
            severity = "critical" if "timed out" in str(error_msg).lower() else "error"
            report_event("job_failure",
                f"Job failed after {elapsed}s: {error_msg[:1000]}",
                job_id=job_id, severity=severity)

        # Stream collected logs to backend (non-blocking, best-effort)
        stdout_output = outcome.get("result", "") if isinstance(outcome.get("result"), str) else ""
        stderr_output = outcome.get("stderr", "")
        if (stdout_output or stderr_output) and not outcome.get("logs_streamed"):
            threading.Thread(
                target=post_job_logs,
                args=(job_id, stdout_output, stderr_output),
                daemon=True
            ).start()

        # Submit result with retry logic
        result_url = f"{API_URL}/api/providers/job-result"
        payload = {
            "api_key": API_KEY,
            "job_id": job_id,
            "attempt_number": job.get("attempt_number"),
            "result": outcome.get("result", {}),
            "success": outcome.get("success", False),
            "error": outcome.get("error"),
            "gpu_seconds_used": gpu_seconds_used,
            "metrics": outcome.get("metrics"),
            "transient": outcome.get("transient", False),
            "restart_count": int(outcome.get("restart_count", 0) or 0),
            "last_error": outcome.get("last_error") or outcome.get("error"),
        }
        if isinstance(payload["metrics"], dict):
            payload["metrics"].setdefault("gpu_count", gpu_count)
        else:
            payload["metrics"] = {"gpu_count": gpu_count}
        result_size = len(str(payload.get("result", "")))
        log.info(f"Job {job_id} submitting result ({result_size} bytes)...")

        submitted = False
        for attempt in range(1, RESULT_POST_RETRIES + 1):
            try:
                code, resp = http_post(result_url, payload, timeout=RESULT_POST_TIMEOUT)
                log.info(f"Job {job_id} result submitted (HTTP {code}, attempt {attempt})")
                submitted = True
                break
            except Exception as e:
                log.error(f"Job result submission attempt {attempt}/{RESULT_POST_RETRIES} failed: {e}")
                if attempt < RESULT_POST_RETRIES:
                    time.sleep(5 * attempt)  # Backoff: 5s, 10s
                else:
                    log.error(f"Job {job_id} result LOST after {RESULT_POST_RETRIES} attempts")
                    report_event("job_failure",
                        f"Result submission LOST after {RESULT_POST_RETRIES} attempts: {e}",
                        job_id=job_id, severity="critical")

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

def job_poll_loop():
    """Background thread: poll for jobs every JOB_POLL_INTERVAL seconds."""
    while True:
        if is_shutdown_requested():
            log.info("Shutdown requested — stopping job poll loop")
            return
        poll_and_execute()
        # Also check for verification challenges every cycle
        check_pending_verification()
        time.sleep(JOB_POLL_INTERVAL)

# ─── AUTO VERIFICATION ON STARTUP ───────────────────────────────────────────

def auto_verify():
    """Request automatic verification on first startup."""
    url = f"{API_URL}/api/verification/auto"
    try:
        code, resp = http_post(url, {"api_key": API_KEY})
        if code == 200 and resp.get("challenge"):
            challenge = resp["challenge"]
            log.info(f"Auto-verification triggered: {challenge['challenge_id']}")
            run_verification(challenge)
        elif code == 200:
            log.info(f"Verification status: {resp.get('status', resp.get('message', 'ok'))}")
    except Exception as e:
        log.debug(f"Auto-verify request: {e}")

# ─── MODEL PRE-CACHE ──────────────────────────────────────────────────────────

# Default models to pre-cache (small ones that fit on most GPUs)
PRECACHE_MODELS = [
    "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
]

def precache_models():
    """
    Pre-download LLM model weights on daemon startup so first inference is fast.
    Only downloads if transformers is available and CUDA is present.
    """
    try:
        import importlib
        transformers_spec = importlib.util.find_spec("transformers")
        if transformers_spec is None:
            log.info("[precache] transformers not installed — skipping model pre-cache")
            return

        import torch
        if not torch.cuda.is_available():
            log.info("[precache] No CUDA device — skipping model pre-cache")
            return

        from transformers import AutoTokenizer, AutoModelForCausalLM

        for model_id in PRECACHE_MODELS:
            try:
                log.info(f"[precache] Checking model: {model_id}")
                report_event("model_precache_start", f"Pre-caching model: {model_id}")

                # Download tokenizer (small, fast)
                log.info(f"[precache] Downloading tokenizer: {model_id}")
                AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)

                # Download model weights (the big download)
                log.info(f"[precache] Downloading model weights: {model_id}")
                AutoModelForCausalLM.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16,
                    device_map="auto",
                    trust_remote_code=True
                )

                log.info(f"[precache] Model ready: {model_id}")
                report_event("model_precache_done", f"Model cached: {model_id}")

                # Free GPU memory after caching (the model files are on disk now)
                del AutoModelForCausalLM  # force GC
                import gc
                gc.collect()
                torch.cuda.empty_cache()
                # Re-import for next iteration
                from transformers import AutoModelForCausalLM

            except Exception as e:
                log.warning(f"[precache] Failed to cache {model_id}: {e}")
                report_event("model_precache_failed", f"Failed: {model_id} — {e}", severity="warning")

    except Exception as e:
        log.warning(f"[precache] Pre-cache setup failed: {e}")

# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DCP Provider Daemon v3.3")
    parser.add_argument("--key", help="Override API key")
    parser.add_argument("--url", help="Override API URL")
    parser.add_argument("--no-watchdog", action="store_true", help="Run without crash watchdog")
    args = parser.parse_args()

    global API_KEY, API_URL
    if args.key:
        API_KEY = args.key
    if args.url:
        API_URL = args.url

    # Validate configuration
    if API_KEY == "INJECT_KEY_HERE" or not API_KEY:
        log.error("No API key configured. Use --key or download from DCP dashboard.")
        sys.exit(1)
    if API_URL == "INJECT_URL_HERE" or not API_URL:
        log.error("No API URL configured. Use --url or download from DCP dashboard.")
        sys.exit(1)

    # Register signal handlers for graceful shutdown with job draining
    def _handle_signal(sig, frame):
        signame = signal.Signals(sig).name if hasattr(signal, 'Signals') else str(sig)
        active = get_active_job_count()
        if active > 0:
            log.info(f"Signal {signame} received — draining {active} active job(s) before shutdown")
            start_draining()
            drained = wait_for_drain(timeout=600)  # 10 min max
            if drained:
                report_event("daemon_stop", f"Stopped by signal {signame} (drained cleanly)")
            else:
                report_event("daemon_stop", f"Stopped by signal {signame} (drain timeout, {get_active_job_count()} jobs orphaned)")
        else:
            log.info(f"Signal {signame} received — no active jobs, shutting down immediately")
            report_event("daemon_stop", f"Stopped by signal {signame}")
        sys.exit(0)
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Initialize job dedup file
    if not _DEDUP_FILE.exists():
        try:
            _DEDUP_FILE.write_text(json.dumps({}))
        except: pass

    log.info("=" * 60)
    log.info(f"DCP Provider Daemon v{DAEMON_VERSION}")
    log.info(f"API URL: {API_URL}")
    log.info(f"API Key: {API_KEY[:20]}...")
    log.info(f"Logs: {LOG_DIR}")
    log.info(f"Max stdout: {MAX_STDOUT} bytes")
    log.info("=" * 60)

    # Report daemon start
    gpu = detect_gpu()
    gpu_desc = f"{gpu['gpu_name']} ({gpu['gpu_vram_mib']} MiB)" if gpu else "No GPU"
    report_event("daemon_start", f"v{DAEMON_VERSION} started on {platform.node()} — {gpu_desc}")

    # Step 1: Detect GPU
    log.info("Detecting GPU...")
    if gpu:
        log.info(f"GPU: {gpu['gpu_name']} ({gpu['gpu_vram_mib']} MiB VRAM)")
        log.info(f"Driver: {gpu['driver_version']}")
    else:
        log.warning("No NVIDIA GPU detected — daemon will run in limited mode")

    # Step 2: Check Docker
    log.info("Checking Docker + NVIDIA Container Toolkit...")
    docker_ok = check_docker()
    log.info(f"Docker execution: {'ENABLED' if docker_ok else 'DISABLED (bare-metal fallback)'}")

    # Step 3: Run readiness checks
    log.info("Running readiness checks...")
    checks = check_readiness()
    report_readiness(checks)

    if checks["cuda"] and checks["pytorch"]:
        log.info("Readiness: PASSED (CUDA + PyTorch available)")
    else:
        missing = []
        if not checks["cuda"]: missing.append("CUDA")
        if not checks["pytorch"]: missing.append("PyTorch")
        log.warning(f"Readiness: PARTIAL — missing: {', '.join(missing)}")

    # Step 4: Pre-cache LLM models (so first inference is fast)
    log.info("Pre-caching LLM models...")
    precache_models()

    # Step 5: Send initial heartbeat
    log.info("Sending initial heartbeat...")
    send_heartbeat()

    # Step 6: Auto-verify GPU on first run
    log.info("Checking verification status...")
    auto_verify()

    # Step 7: Start background threads
    log.info("Starting heartbeat thread (every %ds)...", HEARTBEAT_INTERVAL)
    hb_thread = threading.Thread(target=heartbeat_loop, daemon=True, name="DC1-Heartbeat")
    hb_thread.start()

    log.info("Starting job poll thread (every %ds)...", JOB_POLL_INTERVAL)
    job_thread = threading.Thread(target=job_poll_loop, daemon=True, name="DC1-JobPoll")
    job_thread.start()

    log.info("Starting update check thread (every %ds)...", AUTO_UPDATE_CHECK)
    update_thread = threading.Thread(target=update_check_loop, daemon=True, name="DC1-AutoUpdate")
    update_thread.start()

    log.info("Starting bandwidth monitor (every %ds)...", BANDWIDTH_CHECK_INTERVAL)
    bw_thread = threading.Thread(target=bandwidth_loop, daemon=True, name="DC1-Bandwidth")
    bw_thread.start()

    log.info("Starting network quality monitor (every %ds)...", NETWORK_QUALITY_INTERVAL)
    nq_thread = threading.Thread(target=network_quality_loop, daemon=True, name="DC1-NetQuality")
    nq_thread.start()

    # Step 8: Initialize multi-GPU job slots
    log.info("Initializing GPU job slots...")
    init_gpu_slots()
    log.info(f"Job slots: {MAX_CONCURRENT_JOBS} concurrent (free: {get_free_gpu_slot_count()})")

    # Step 9: Log power cost config
    power_cfg = load_power_config()
    if power_cfg.get("enabled"):
        log.info(f"Power cost tracking: ENABLED — {power_cfg.get('electricity_cost_kwh')} SAR/kWh, "
                 f"TDP={power_cfg.get('gpu_tdp_watts')}W, min margin={power_cfg.get('min_profit_margin_pct')}%")
    else:
        log.info("Power cost tracking: disabled (set ~/dc1-provider/power_config.json to enable)")

    log.info("Daemon running. Press Ctrl+C to stop.")

    # Keep main thread alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        log.info("Daemon stopped by user.")
        report_event("daemon_stop", "Stopped by user (KeyboardInterrupt)")
        sys.exit(0)
    except Exception as e:
        error_detail = f"Main loop crash: {e}\n{traceback.format_exc()}"
        log.critical(error_detail)
        report_event("daemon_crash", error_detail, severity="critical")
        sys.exit(1)  # Watchdog will restart


# ─── CRASH WATCHDOG ─────────────────────────────────────────────────────────

def _find_backup_files(daemon_path=None):
    """Find all .bak files from previous daemon versions."""
    daemon_path = daemon_path or Path(__file__).resolve()
    current_pattern = f"{daemon_path.stem}.v*.bak"
    legacy_pattern = "dc1-daemon.v*.bak"
    backups = list(daemon_path.parent.glob(current_pattern))
    backups.extend(daemon_path.parent.glob(legacy_pattern))
    return sorted(backups, reverse=True)

def _rollback_daemon(daemon_path):
    """Rollback to the most recent backup file. Returns True if successful."""
    backups = _find_backup_files(daemon_path)
    if not backups:
        log.error("[WATCHDOG] No backup files found — cannot rollback")
        return False

    backup = backups[0]
    log.warning(f"[WATCHDOG] Rolling back: {daemon_path} ← {backup}")
    try:
        shutil.copy2(backup, daemon_path)
        log.info(f"[WATCHDOG] Rollback successful from {backup.name}")
        return True
    except Exception as e:
        log.error(f"[WATCHDOG] Rollback failed: {e}")
        return False

def watchdog():
    """
    Outer process that monitors the daemon and restarts on crash.

    Behavior:
      Exit code 0  = clean shutdown → stop watchdog
      Exit code 42 = update restart → restart immediately
      Other codes  = crash → restart with backoff

    Safety features:
      - Max 5 crashes per 10 min window (prevents infinite loops)
      - Auto-rollback if daemon crashes within 90s of an update restart
      - After rollback, suppresses updates for 10 min then re-checks
        (so a newer fixed version can still be picked up)
    """
    crash_times = []
    restart_count = 0
    last_update_restart_time = 0   # Track when we last did an update restart
    rollback_until = 0             # Suppress updates until this timestamp
    daemon_script = Path(__file__).resolve()

    log.info(f"[WATCHDOG] Starting crash watchdog for {daemon_script}")
    log.info(f"[WATCHDOG] Max {MAX_CRASH_RESTARTS} restarts per {CRASH_WINDOW}s window")

    while True:
        # Build command — pass through original args, add --no-watchdog to prevent recursion
        cmd = [sys.executable, str(daemon_script), "--no-watchdog"]
        # Pass through key/url if they were injected (not INJECT_*_HERE)
        if API_KEY != "INJECT_KEY_HERE":
            cmd.extend(["--key", API_KEY])
        if API_URL != "INJECT_URL_HERE":
            cmd.extend(["--url", API_URL])

        log.info(f"[WATCHDOG] Starting daemon (restart #{restart_count})...")
        start_time = time.time()

        try:
            proc = subprocess.run(cmd)
            exit_code = proc.returncode
        except Exception as e:
            log.error(f"[WATCHDOG] Failed to start daemon: {e}")
            exit_code = 1

        elapsed = round(time.time() - start_time, 1)

        # ── Clean shutdown ──
        if exit_code == 0:
            log.info(f"[WATCHDOG] Daemon exited cleanly (code 0) after {elapsed}s. Stopping watchdog.")
            break

        # ── Update restart (code 42) ──
        if exit_code == 42:
            log.info(f"[WATCHDOG] Daemon requested update restart (code 42) after {elapsed}s.")
            last_update_restart_time = time.time()
            restart_count += 1
            continue

        # ── Crash detection ──
        now = time.time()
        crash_times.append(now)
        crash_times = [t for t in crash_times if now - t < CRASH_WINDOW]

        log.error(f"[WATCHDOG] Daemon crashed (code {exit_code}) after {elapsed}s. "
                   f"Crashes in window: {len(crash_times)}/{MAX_CRASH_RESTARTS}")

        # ── Auto-rollback after bad update ──
        time_since_update = now - last_update_restart_time if last_update_restart_time else float("inf")
        if time_since_update < UPDATE_CRASH_THRESHOLD:
            log.warning(f"[WATCHDOG] Crash {elapsed}s after update restart — likely bad update!")
            if _rollback_daemon(daemon_script):
                rollback_until = now + ROLLBACK_RECHECK_INTERVAL
                log.info(f"[WATCHDOG] Updates suppressed for {ROLLBACK_RECHECK_INTERVAL}s. "
                          f"Will re-check for newer fixed version after that.")
                os.environ["DCP_UPDATE_SUPPRESS_UNTIL"] = str(int(rollback_until))
                _save_update_suppression(
                    rollback_until,
                    reason=f"rollback_after_update_crash_exit_{exit_code}",
                )
                try:
                    report_event("update_rollback",
                        f"Auto-rollback triggered: daemon crashed {elapsed}s after update. "
                        f"Rolled back to previous version. Updates suppressed until "
                        f"{datetime.utcfromtimestamp(rollback_until).isoformat()}Z",
                        severity="critical")
                except: pass
                last_update_restart_time = 0  # Reset so we don't double-rollback
                # Reset crash counter — the rollback gives us a clean slate
                crash_times = []
                restart_count += 1
                time.sleep(5)
                continue

        # ── Too many crashes — give up ──
        if len(crash_times) >= MAX_CRASH_RESTARTS:
            log.critical(f"[WATCHDOG] Too many crashes ({len(crash_times)}) in {CRASH_WINDOW}s. "
                          f"Giving up. Check logs at {LOG_DIR}/daemon.log")
            try:
                report_event("watchdog_givingup",
                    f"GIVING UP after {len(crash_times)} crashes in {CRASH_WINDOW}s. "
                    f"Last exit code: {exit_code}. Manual intervention needed.",
                    severity="critical")
            except: pass
            sys.exit(1)

        # ── Backoff: 5s, 10s, 20s, 40s, 60s max ──
        backoff = min(5 * (2 ** (len(crash_times) - 1)), 60)
        log.info(f"[WATCHDOG] Restarting in {backoff}s...")

        try:
            report_event("watchdog_restart",
                f"Daemon crashed (exit code {exit_code}) after {elapsed}s. "
                f"Restart #{restart_count + 1}, backoff {backoff}s. "
                f"Crashes in window: {len(crash_times)}/{MAX_CRASH_RESTARTS}",
                severity="warning")
        except: pass

        time.sleep(backoff)
        restart_count += 1


if __name__ == "__main__":
    # Parse args early to check --no-watchdog
    if "--no-watchdog" in sys.argv:
        main()
    else:
        watchdog()
