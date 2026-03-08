#!/usr/bin/env python3
"""
DC1 Provider Daemon v3.3.0 — GPU Compute Marketplace
Runs as a background service on provider machines.

Features:
  - GPU detection via nvidia-smi
  - System readiness checks (CUDA, PyTorch, VRAM)
  - 30s heartbeat to DC1 backend
  - Job polling (every 10s) with dual endpoint support
  - Docker-based execution (NVIDIA Container Toolkit) with bare-metal fallback
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
from pathlib import Path
from datetime import datetime

# ─── CONFIGURATION (injected by download endpoint) ──────────────────────────

API_KEY = "{{API_KEY}}"
API_URL = "{{API_URL}}"

HEARTBEAT_INTERVAL = 30   # seconds
JOB_POLL_INTERVAL = 10    # seconds
DAEMON_VERSION = "3.3.0"
MAX_STDOUT = 2097152       # 2 MB stdout capture (for base64 image results)
JOB_TIMEOUT = 900          # 15 min default job timeout (model downloads can be slow)
RESULT_POST_TIMEOUT = 120  # 2 min for uploading results (large base64 images)
RESULT_POST_RETRIES = 3    # Retry result submission up to 3 times
MAX_CRASH_RESTARTS = 5     # Max restarts within the crash window
CRASH_WINDOW = 600         # 10 minute window for counting crashes
AUTO_UPDATE_CHECK = 300    # Check for updates every 5 minutes
UPDATE_CRASH_THRESHOLD = 90  # If daemon crashes within 90s of update, rollback
ROLLBACK_RECHECK_INTERVAL = 600  # After rollback, re-check for updates every 10 min
BANDWIDTH_CHECK_INTERVAL = 600   # Measure bandwidth every 10 minutes
BANDWIDTH_TEST_SIZE = 102400     # 100KB test payload for speed measurement

# VRAM requirements per job type (MiB) — jobs need at least this much free VRAM
VRAM_REQUIREMENTS = {
    "image_generation": 3500,   # SD v1.4 needs ~3.5 GB
    "llm-inference": 5000,      # 7B model needs ~5 GB
    "training": 6000,           # Fine-tuning needs ~6 GB
    "benchmark": 1000,          # Matrix multiply needs ~1 GB
    "rendering": 2000,          # General GPU rendering
}
VRAM_DEFAULT_REQUIREMENT = 2000  # Default if job type unknown

# Disk space requirements (MB)
DISK_MIN_FREE_MB = 5000          # 5 GB minimum free space (models can be 4-8 GB)
DISK_MIN_TEMP_MB = 500           # 500 MB minimum for /tmp scripts

# ─── SETUP LOGGING ──────────────────────────────────────────────────────────

LOG_DIR = Path.home() / "dc1-provider" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_DIR = Path.home() / "dc1-provider"

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
_job_lock = threading.Lock()  # Protects _current_job_id
_bw_lock = threading.Lock()   # Protects _bandwidth_stats

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

# ─── AUTO-UPDATE ────────────────────────────────────────────────────────────

def check_for_update():
    """Check if a newer daemon version is available and self-update."""
    try:
        # The heartbeat response already tells us if update is available
        # But we also have a dedicated download endpoint
        url = f"{API_URL}/api/providers/download/daemon?key={API_KEY}&check_only=true"
        code, resp = http_get(url)
        if code == 200 and resp.get("version"):
            remote_version = resp["version"]
            if remote_version > DAEMON_VERSION:
                log.info(f"Update available: {DAEMON_VERSION} → {remote_version}")
                return perform_update(remote_version)
    except Exception as e:
        log.debug(f"Update check failed: {e}")
    return False

def perform_update(new_version):
    """Download new daemon, replace current file, and signal restart."""
    report_event("update_start", f"Updating {DAEMON_VERSION} → {new_version}")
    log.info(f"Downloading daemon v{new_version}...")

    try:
        download_url = f"{API_URL}/api/providers/download/daemon?key={API_KEY}"

        if HAS_REQUESTS:
            import requests as req_lib
            r = req_lib.get(download_url, timeout=30)
            if r.status_code != 200:
                raise Exception(f"Download HTTP {r.status_code}")
            new_code = r.text
        else:
            import urllib.request
            with urllib.request.urlopen(download_url, timeout=30) as resp:
                new_code = resp.read().decode("utf-8")

        # Validate it's actually Python code
        if "DC1 Provider Daemon" not in new_code or "def main()" not in new_code:
            raise Exception("Downloaded file doesn't look like a valid daemon")

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

def detect_gpu():
    """Detect NVIDIA GPU via nvidia-smi. Returns dict or None."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.free,memory.used,utilization.gpu,temperature.gpu,power.draw,driver_version",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return None

        line = result.stdout.strip().split("\n")[0]
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 8:
            return None

        return {
            "gpu_name": parts[0],
            "gpu_vram_mib": int(float(parts[1])),
            "free_vram_mib": int(float(parts[2])),
            "memory_used_mb": int(float(parts[3])),
            "gpu_util_pct": int(float(parts[4])),
            "temp_c": int(float(parts[5])),
            "power_w": float(parts[6]) if parts[6] != "[N/A]" else None,
            "driver_version": parts[7],
        }
    except FileNotFoundError:
        log.warning("nvidia-smi not found — no NVIDIA GPU detected")
        return None
    except Exception as e:
        log.error(f"GPU detection error: {e}")
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

# ─── HEARTBEAT ───────────────────────────────────────────────────────────────

def send_heartbeat():
    """Send heartbeat with GPU metrics to backend."""
    gpu = detect_gpu()
    gpu_status = {}
    if gpu:
        gpu_status = {
            "gpu_name": gpu["gpu_name"],
            "gpu_vram_mib": gpu["gpu_vram_mib"],
            "free_vram_mib": gpu["free_vram_mib"],
            "memory_used_mb": gpu["memory_used_mb"],
            "gpu_util_pct": gpu["gpu_util_pct"],
            "temp_c": gpu["temp_c"],
            "power_w": gpu["power_w"],
            "driver_version": gpu["driver_version"],
            "daemon_version": DAEMON_VERSION,
            "python_version": platform.python_version(),
            "os_info": f"{platform.system()} {platform.release()}",
        }

    url = f"{API_URL}/api/providers/heartbeat"
    try:
        payload = {
            "api_key": API_KEY,
            "gpu_status": gpu_status,
            "provider_ip": None,
            "provider_hostname": platform.node(),
        }
        # Include bandwidth stats if available
        with _bw_lock:
            if _bandwidth_stats.get("download_mbps") is not None:
                payload["bandwidth"] = dict(_bandwidth_stats)  # Copy to avoid race
        code, resp = http_post(url, payload)
        if code == 200:
            log.debug("Heartbeat OK")
        else:
            log.warning(f"Heartbeat HTTP {code}: {resp}")
    except Exception as e:
        log.error(f"Heartbeat failed: {e}")

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

def run_docker_job(job_type, task_spec, job_dir):
    """Execute job inside Docker container with GPU access."""
    # GHCR registry — falls back to local images if not pulled
    GHCR = "ghcr.io/dhnpmp-tech"
    IMAGE_MAP = {
        "image_generation": f"{GHCR}/dc1-sd-worker:latest",
        "llm-inference": f"{GHCR}/dc1-llm-worker:latest",
        "training": f"{GHCR}/dc1-base-worker:latest",
        "rendering": f"{GHCR}/dc1-base-worker:latest",
        "benchmark": f"{GHCR}/dc1-base-worker:latest",
    }
    image = IMAGE_MAP.get(job_type, "dc1/base-worker:latest")

    # Write task_spec as task.py in job directory
    script = task_spec if isinstance(task_spec, str) else task_spec.get("script", "")
    if not script:
        return {"success": False, "error": "No script in task_spec"}

    task_path = os.path.join(job_dir, "task.py")
    with open(task_path, "w") as f:
        f.write(script)

    log.info(f"Docker exec: image={image}, job_dir={job_dir}")

    try:
        result = subprocess.run(
            ["docker", "run", "--gpus", "all", "--rm",
             "--memory", "16g", "--shm-size", "2g",
             "-v", f"{job_dir}:/dc1/job",
             image, "python", "/dc1/job/task.py"],
            capture_output=True, text=True, timeout=JOB_TIMEOUT
        )

        stdout = result.stdout[:MAX_STDOUT]
        stderr = result.stderr[:MAX_STDOUT]

        if result.returncode == 0:
            return {"success": True, "result": stdout, "stderr": stderr}
        else:
            return {"success": False, "error": f"Exit code {result.returncode}: {stderr[:500]}"}
    except subprocess.TimeoutExpired:
        # Kill the container
        subprocess.run(["docker", "kill", f"dc1-job-{job_type}"], capture_output=True)
        return {"success": False, "error": f"Job timed out after {JOB_TIMEOUT}s"}
    except Exception as e:
        return {"success": False, "error": str(e)}

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

def run_bare_metal_job(task_spec, job_id=None):
    """Execute job as a bare-metal subprocess with real-time phase reporting."""
    script = task_spec if isinstance(task_spec, str) else task_spec.get("script", "")
    if not script:
        return {"success": False, "error": "No script in task_spec"}

    # Write to temp file and execute
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(script)
        temp_path = f.name

    log.info(f"Bare-metal exec: {temp_path}")

    # Stream stdout line-by-line to detect [dc1-phase] markers and report progress
    stderr_path = temp_path + ".stderr"
    stdout_chunks = []
    try:
        with open(stderr_path, "w") as stderr_file:
            proc = subprocess.Popen(
                [sys.executable, "-u", temp_path],  # -u: unbuffered stdout
                stdout=subprocess.PIPE, stderr=stderr_file,
                text=True
            )

            # Read stdout line by line with timeout
            start_time = time.time()
            while True:
                # Check timeout
                if time.time() - start_time > JOB_TIMEOUT:
                    proc.kill()
                    return {"success": False, "error": f"Job timed out after {JOB_TIMEOUT}s"}

                line = proc.stdout.readline()
                if not line and proc.poll() is not None:
                    break
                if line:
                    stdout_chunks.append(line)
                    # Detect phase markers and report to backend
                    if job_id and line.startswith("[dc1-phase]"):
                        phase = line.strip().split("]", 1)[1].strip()
                        # Report async to not block the job
                        threading.Thread(
                            target=report_job_progress,
                            args=(job_id, phase),
                            daemon=True
                        ).start()
                    # Log dc1 markers
                    if line.startswith("[dc1]"):
                        log.info(f"  {line.strip()}")

            returncode = proc.wait(timeout=10)

        stdout = "".join(stdout_chunks)[:MAX_STDOUT]
        stderr = ""
        try:
            with open(stderr_path, "r") as f:
                stderr = f.read()[:2000]
        except: pass

        if returncode == 0:
            return {"success": True, "result": stdout, "stderr": stderr}
        else:
            return {"success": False, "error": f"Exit code {returncode}: {stderr[:500]}"}
    except subprocess.TimeoutExpired:
        try: proc.kill()
        except: pass
        return {"success": False, "error": f"Job timed out after {JOB_TIMEOUT}s"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass

def execute_job(job):
    """Execute a job — Docker preferred, bare-metal fallback, benchmark special case."""
    global _current_job_id
    job_id = job["job_id"]
    job_type = job.get("job_type", "benchmark")
    task_spec = job.get("task_spec", {})
    with _job_lock:
        _current_job_id = job_id

    if isinstance(task_spec, str):
        try:
            task_spec = json.loads(task_spec)
        except:
            pass  # Keep as string (it might be raw Python code)

    log.info(f"Executing job {job_id} (type: {job_type})")

    try:
        # Pure benchmark jobs (no script needed)
        if job_type == "benchmark" or (isinstance(task_spec, dict) and task_spec.get("benchmark")):
            return run_gpu_benchmark(task_spec if isinstance(task_spec, dict) else {})

        # Script-based jobs — Docker > bare-metal
        has_script = (isinstance(task_spec, str) and len(task_spec) > 10) or \
                     (isinstance(task_spec, dict) and task_spec.get("script"))

        if has_script:
            if check_docker():
                job_dir = tempfile.mkdtemp(prefix="dc1-job-")
                return run_docker_job(job_type, task_spec, job_dir)
            else:
                return run_bare_metal_job(task_spec, job_id=job_id)
        else:
            # No script — fall back to benchmark
            log.info(f"No script in task_spec — running default benchmark")
            return run_gpu_benchmark(task_spec if isinstance(task_spec, dict) else {})
    finally:
        with _job_lock:
            _current_job_id = None

def poll_and_execute():
    """Poll for assigned jobs and execute them."""
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
            }, timeout=15)
        except: pass
        return

    # Execute in background thread so heartbeats continue
    def _run():
        start_time = time.time()
        try:
            outcome = execute_job(job)
        except Exception as e:
            elapsed = round(time.time() - start_time, 1)
            error_detail = f"Unhandled exception in execute_job: {e}\n{traceback.format_exc()}"
            log.error(f"Job {job_id} CRASHED after {elapsed}s: {error_detail[:500]}")
            report_event("job_failure", error_detail, job_id=job_id, severity="critical")
            outcome = {"success": False, "error": error_detail[:1000]}

        elapsed = round(time.time() - start_time, 1)

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

        # Submit result with retry logic
        result_url = f"{API_URL}/api/providers/job-result"
        payload = {
            "api_key": API_KEY,
            "job_id": job_id,
            "result": outcome.get("result", {}),
            "success": outcome.get("success", False),
            "error": outcome.get("error"),
            "metrics": outcome.get("metrics"),
        }
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
    parser = argparse.ArgumentParser(description="DC1 Provider Daemon v3.2")
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
        log.error("No API key configured. Use --key or download from DC1 dashboard.")
        sys.exit(1)
    if API_URL == "INJECT_URL_HERE" or not API_URL:
        log.error("No API URL configured. Use --url or download from DC1 dashboard.")
        sys.exit(1)

    # Register signal handlers for graceful shutdown
    def _handle_signal(sig, frame):
        signame = signal.Signals(sig).name if hasattr(signal, 'Signals') else str(sig)
        log.info(f"Signal {signame} received — shutting down gracefully")
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
    log.info(f"DC1 Provider Daemon v{DAEMON_VERSION}")
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

def _find_backup_files():
    """Find all .bak files from previous daemon versions."""
    daemon_path = Path(__file__).resolve()
    return sorted(daemon_path.parent.glob("dc1-daemon.v*.bak"), reverse=True)

def _rollback_daemon(daemon_path):
    """Rollback to the most recent backup file. Returns True if successful."""
    backups = _find_backup_files()
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
