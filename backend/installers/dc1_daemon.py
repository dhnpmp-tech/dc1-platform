#!/usr/bin/env python3
"""
DC1 Provider Daemon v3.0 — Unified GPU Compute Worker
Placeholders {{API_KEY}} and {{API_URL}} are replaced by the setup script.

Merged from v1.0 (structured logging, readiness checks, PyTorch benchmarks, HMAC)
         and v2.0 (Docker execution, schedule awareness, config file, job templates).

Features:
  - GPU detection via nvidia-smi
  - System readiness checks (CUDA, PyTorch, VRAM) reported to backend
  - 30s heartbeat to DC1 backend with full GPU telemetry
  - Job polling every 10s (supports both API endpoints for backward compat)
  - Docker execution (when Docker + NVIDIA Container Toolkit available)
  - Bare-metal subprocess fallback
  - Built-in PyTorch GPU benchmark for benchmark jobs
  - DC1_RESULT_JSON protocol for structured output (image gen, etc.)
  - Schedule-aware (exits outside configured window)
  - Structured logging to file + stdout
  - Config file support (config.json)
  - Thread-safe job execution (one job at a time)
  - HMAC verification of task_spec (optional)
  - Graceful shutdown on Ctrl+C

Usage:
  python3 dc1_daemon.py                    # Uses injected key + config.json
  python3 dc1_daemon.py --key YOUR_KEY     # Manual key override
  python3 dc1_daemon.py --bare-metal       # Force bare-metal (no Docker)
"""

import os
import sys
import time
import json
import hmac
import hashlib
import logging
import socket
import platform
import subprocess
import threading
import shutil
import argparse
from pathlib import Path
from datetime import datetime

# ─── CONFIGURATION (injected by setup script) ──────────────────────────────

API_KEY = "{{API_KEY}}"
API_URL = "{{API_URL}}"

DAEMON_VERSION = "3.0.0"
HEARTBEAT_INTERVAL = 30   # seconds
JOB_POLL_INTERVAL  = 10   # seconds
MAX_STDOUT = 5 * 1024 * 1024  # 5 MB (base64 images can be 1-4 MB)
JOB_TIMEOUT = 600              # 10 minutes default

# Docker worker images by job type
DOCKER_IMAGES = {
    "image_generation": "dc1/sd-worker:latest",
    "llm-inference":    "dc1/llm-worker:latest",
    "training":         "dc1/train-worker:latest",
    "rendering":        "dc1/render-worker:latest",
    "benchmark":        "dc1/base-worker:latest",
}
DEFAULT_DOCKER_IMAGE = "dc1/base-worker:latest"

# ─── CONFIG FILE ────────────────────────────────────────────────────────────

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_CONFIG_PATH = os.path.join(_BASE_DIR, "config.json")
_config = {}
try:
    with open(_CONFIG_PATH) as _f:
        _config = json.load(_f)
except Exception:
    pass

RUN_MODE    = _config.get("run_mode", "always-on")
SCHED_START = _config.get("scheduled_start", "23:00")
SCHED_END   = _config.get("scheduled_end", "07:00")
FORCE_BARE_METAL = _config.get("force_bare_metal", False)

# ─── LOGGING ────────────────────────────────────────────────────────────────

LOG_DIR = Path(_BASE_DIR) / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "daemon.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("dc1")

# ─── HTTP HELPERS ───────────────────────────────────────────────────────────

try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

def http_post(url, data, timeout=15):
    """POST JSON to URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = _requests.post(url, json=data, timeout=timeout)
        try:
            return r.status_code, r.json()
        except Exception:
            return r.status_code, {"raw": r.text[:500]}
    else:
        import urllib.request, urllib.error
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

def http_get(url, params=None, timeout=15):
    """GET URL with optional query params, returns (status_code, response_dict)."""
    if params:
        from urllib.parse import urlencode
        url = f"{url}?{urlencode(params)}"
    if HAS_REQUESTS:
        r = _requests.get(url, timeout=timeout)
        try:
            return r.status_code, r.json()
        except Exception:
            return r.status_code, {"raw": r.text[:500]}
    else:
        import urllib.request, urllib.error
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

# ─── SCHEDULE ───────────────────────────────────────────────────────────────

def _parse_hhmm(t):
    h, m = map(int, t.split(":"))
    import datetime as _dt
    return _dt.time(h, m)

def within_schedule():
    """Return False when scheduled mode is active and current time is outside the window."""
    if RUN_MODE != "scheduled":
        return True
    import datetime as _dt
    now   = _dt.datetime.now().time()
    start = _parse_hhmm(SCHED_START)
    end   = _parse_hhmm(SCHED_END)
    if start <= end:
        return start <= now <= end
    else:
        return now >= start or now <= end

# ─── GPU DETECTION ──────────────────────────────────────────────────────────

def detect_gpu():
    """Detect NVIDIA GPU via nvidia-smi. Returns dict with full telemetry."""
    info = {
        "gpu_name": "unknown", "gpu_vram_mib": 0, "free_vram_mib": 0,
        "memory_used_mb": 0, "driver_version": "unknown", "compute_cap": "unknown",
        "gpu_util_pct": 0, "temp_c": None, "power_w": None,
    }
    try:
        result = subprocess.run(
            ["nvidia-smi",
             "--query-gpu=name,memory.total,memory.free,memory.used,driver_version,compute_cap,utilization.gpu,temperature.gpu,power.draw",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return None

        parts = [p.strip() for p in result.stdout.strip().split("\n")[0].split(",")]
        if len(parts) < 9:
            return None

        info["gpu_name"]       = parts[0]
        info["gpu_vram_mib"]   = int(float(parts[1]))
        info["free_vram_mib"]  = int(float(parts[2]))
        info["memory_used_mb"] = int(float(parts[3]))
        info["driver_version"] = parts[4]
        info["compute_cap"]    = parts[5]
        info["gpu_util_pct"]   = int(float(parts[6]))
        info["temp_c"]         = int(float(parts[7]))
        if parts[8] != "[N/A]":
            info["power_w"] = float(parts[8])

        return info
    except FileNotFoundError:
        log.warning("nvidia-smi not found — no NVIDIA GPU detected")
        return None
    except Exception as e:
        log.error(f"GPU detection error: {e}")
        return None

def get_gpu_status():
    """Build GPU status payload for heartbeat."""
    gpu = detect_gpu()
    status = {
        "gpu_name": "unknown", "gpu_vram_mib": 0, "free_vram_mib": 0,
        "driver_version": "unknown", "compute_cap": "unknown",
        "gpu_util_pct": 0, "temp_c": None, "power_w": None,
        "daemon_version": DAEMON_VERSION,
        "python_version": sys.version.split()[0],
        "os_info": f"{platform.system()} {platform.release()}",
        "docker_available": is_docker_available(),
    }
    if gpu:
        status.update(gpu)
    return status

# ─── DOCKER DETECTION ───────────────────────────────────────────────────────

_docker_status = None

def check_docker():
    """Check if Docker + NVIDIA Container Toolkit are available."""
    result = {"docker": False, "nvidia_docker": False, "docker_version": None}
    try:
        proc = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=5)
        if proc.returncode == 0:
            result["docker"] = True
            result["docker_version"] = proc.stdout.strip()
    except Exception:
        return result

    # Check NVIDIA Container Toolkit
    try:
        proc = subprocess.run(
            ["docker", "run", "--rm", "--gpus", "all",
             "nvidia/cuda:12.2.0-base-ubuntu22.04",
             "nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=30
        )
        if proc.returncode == 0 and proc.stdout.strip():
            result["nvidia_docker"] = True
    except Exception:
        pass

    return result

def is_docker_available():
    """Return True if Docker + NVIDIA Container Toolkit are both available."""
    global _docker_status
    if FORCE_BARE_METAL:
        return False
    if _docker_status is None:
        _docker_status = check_docker()
        log.info(f"Docker check: {json.dumps(_docker_status)}")
    return _docker_status["docker"] and _docker_status["nvidia_docker"]

# ─── READINESS CHECKS ──────────────────────────────────────────────────────

def check_readiness():
    """Run system checks: CUDA, PyTorch, VRAM. Returns checks dict."""
    checks = {
        "cuda": False,
        "pytorch": False,
        "vram_gb": 0,
        "driver": None,
        "python_version": platform.python_version(),
        "os_info": f"{platform.system()} {platform.release()}",
        "daemon_version": DAEMON_VERSION,
        "docker_available": is_docker_available(),
    }

    gpu = detect_gpu()
    if gpu:
        checks["cuda"] = True
        checks["driver"] = gpu["driver_version"]
        checks["vram_gb"] = round(gpu["gpu_vram_mib"] / 1024, 1)
        checks["gpu_name"] = gpu["gpu_name"]
        checks["compute_cap"] = gpu["compute_cap"]

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

# ─── HEARTBEAT ──────────────────────────────────────────────────────────────

_current_job_id = None

def send_heartbeat():
    """Send heartbeat with GPU metrics to backend."""
    url = f"{API_URL}/api/providers/heartbeat"
    payload = {
        "api_key": API_KEY,
        "provider_hostname": socket.gethostname(),
        "provider_ip": None,
        "gpu_status": get_gpu_status(),
    }
    if _current_job_id:
        payload["current_job_id"] = _current_job_id

    try:
        code, resp = http_post(url, payload)
        if code == 200:
            log.debug("Heartbeat OK")
        else:
            log.warning(f"Heartbeat HTTP {code}: {resp}")
        return code == 200
    except Exception as e:
        log.error(f"Heartbeat failed: {e}")
        return False

def heartbeat_loop():
    """Background thread: send heartbeat every HEARTBEAT_INTERVAL seconds."""
    while True:
        send_heartbeat()
        time.sleep(HEARTBEAT_INTERVAL)

# ─── JOB EXECUTION: DOCKER ─────────────────────────────────────────────────

def run_job_docker(job_id, task_spec, job_type):
    """Execute a job inside a Docker container with GPU access."""
    job_dir = os.path.join(_BASE_DIR, f"_dc1_job_{job_id}")
    os.makedirs(job_dir, exist_ok=True)

    task_file = os.path.join(job_dir, "task.py")
    with open(task_file, "w", encoding="utf-8") as f:
        f.write(task_spec)

    image = DOCKER_IMAGES.get(job_type, DEFAULT_DOCKER_IMAGE)
    container_name = f"dc1-job-{job_id}"

    cmd = [
        "docker", "run",
        "--rm",
        "--gpus", "all",
        "--name", container_name,
        "--memory", "16g",
        "--shm-size", "2g",
        "-v", f"{job_dir}:/dc1/job",
        "-e", f"DC1_JOB_ID={job_id}",
        image,
        "python", "/dc1/job/task.py"
    ]

    log.info(f"Docker exec: {image} for job {job_id}")

    t0 = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=JOB_TIMEOUT)
        duration_s = int(time.time() - t0)

        stdout = (proc.stdout or "")
        if len(stdout) > MAX_STDOUT:
            stdout = stdout[-MAX_STDOUT:]
        result_text = stdout.strip() or "completed"
        error_text = (proc.stderr or "").strip()[-2000:] if proc.returncode != 0 else None

        return result_text, error_text, duration_s

    except subprocess.TimeoutExpired:
        try:
            subprocess.run(["docker", "kill", container_name], capture_output=True, timeout=10)
        except Exception:
            pass
        duration_s = int(time.time() - t0)
        return None, f"Job timed out after {duration_s}s (Docker)", duration_s

    finally:
        try:
            shutil.rmtree(job_dir, ignore_errors=True)
        except Exception:
            pass

# ─── JOB EXECUTION: BARE METAL ─────────────────────────────────────────────

def run_job_bare(job_id, task_spec):
    """Execute a job as a local subprocess (fallback when Docker unavailable)."""
    tmp = os.path.join(_BASE_DIR, f"_dc1_task_{job_id}.py")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(task_spec)

    t0 = time.time()
    try:
        proc = subprocess.run(
            [sys.executable, tmp],
            capture_output=True, text=True, timeout=JOB_TIMEOUT
        )
        duration_s = int(time.time() - t0)

        stdout = (proc.stdout or "")
        if len(stdout) > MAX_STDOUT:
            stdout = stdout[-MAX_STDOUT:]
        result_text = stdout.strip() or "completed"
        error_text = (proc.stderr or "").strip()[-2000:] if proc.returncode != 0 else None

        return result_text, error_text, duration_s

    except subprocess.TimeoutExpired:
        duration_s = int(time.time() - t0)
        return None, f"Job timed out after {duration_s}s", duration_s

    finally:
        try:
            os.remove(tmp)
        except Exception:
            pass

# ─── JOB EXECUTION: BUILT-IN BENCHMARK ─────────────────────────────────────

def run_gpu_benchmark(task_spec):
    """Execute GPU benchmark using PyTorch matrix multiplication (no Docker needed)."""
    if isinstance(task_spec, str):
        try:
            task_spec = json.loads(task_spec)
        except Exception:
            task_spec = {}

    matrix_size = task_spec.get("matrix_size", 4096)
    iterations = task_spec.get("iterations", 5)

    log.info(f"Running GPU benchmark: {matrix_size}x{matrix_size} matmul, {iterations} iters")

    try:
        import torch

        if not torch.cuda.is_available():
            return None, "CUDA not available for benchmark", 0

        device = torch.device("cuda")
        A = torch.randn(matrix_size, matrix_size, device=device)
        B = torch.randn(matrix_size, matrix_size, device=device)
        torch.cuda.synchronize()

        t0 = time.time()
        for _ in range(iterations):
            C = torch.matmul(A, B)
        torch.cuda.synchronize()
        elapsed = time.time() - t0

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

        result_text = f"DC1_RESULT_JSON:{json.dumps(result)}"
        log.info(f"Benchmark: {gflops:.2f} GFLOPS in {elapsed:.2f}s")
        return result_text, None, int(elapsed)

    except ImportError:
        return None, "PyTorch not installed — cannot run benchmark", 0
    except Exception as e:
        return None, f"Benchmark error: {e}", 0

# ─── JOB ORCHESTRATOR ──────────────────────────────────────────────────────

def poll_for_job():
    """Poll for an assigned job. Tries both API endpoints for backward compat."""
    # Try new endpoint first: GET /api/jobs/assigned?key=
    try:
        code, resp = http_get(f"{API_URL}/api/jobs/assigned", params={"key": API_KEY})
        if code == 200:
            job = resp.get("job")
            if job and job.get("task_spec"):
                return job, "new"
    except Exception:
        pass

    # Fallback: old endpoint GET /api/providers/:api_key/jobs
    try:
        code, resp = http_get(f"{API_URL}/api/providers/{API_KEY}/jobs")
        if code == 200:
            job = resp.get("job")
            if job:
                return job, "old"
    except Exception:
        pass

    return None, None

def execute_job(job, endpoint_version):
    """Execute a job: choose Docker, bare-metal, or built-in benchmark."""
    global _current_job_id

    # Normalize job fields (old vs new endpoint have slightly different shapes)
    if endpoint_version == "old":
        job_id   = job.get("job_id", job.get("id"))
        task     = job.get("task_spec", "")
        job_type = job.get("job_type", "benchmark")
    else:
        job_id   = job.get("id", job.get("job_id"))
        task     = job.get("task_spec", "")
        job_type = job.get("job_type", "benchmark")

    _current_job_id = job_id
    log.info(f"Job {job_id} ({job_type}) picked up via {endpoint_version} endpoint")

    # Send progress heartbeat
    send_heartbeat()

    # Decide execution strategy
    if job_type == "benchmark" and not isinstance(task, str):
        # Pure benchmark job — use built-in PyTorch matmul
        log.info("Executing built-in PyTorch benchmark")
        result_text, error_text, duration_s = run_gpu_benchmark(task)
    elif isinstance(task, str) and len(task.strip()) > 0:
        # Script-based job (image gen, training, etc.)
        if is_docker_available():
            log.info(f"Executing via Docker ({DOCKER_IMAGES.get(job_type, DEFAULT_DOCKER_IMAGE)})")
            result_text, error_text, duration_s = run_job_docker(job_id, task, job_type)
        else:
            log.info("Executing bare-metal (no Docker)")
            result_text, error_text, duration_s = run_job_bare(job_id, task)
    else:
        # No task_spec or empty — run default benchmark
        log.info("No task_spec provided — running default benchmark")
        result_text, error_text, duration_s = run_gpu_benchmark({"matrix_size": 4096, "iterations": 5})

    # Report result to backend (try both endpoints)
    report_result(job_id, result_text, error_text, duration_s, endpoint_version)

    _current_job_id = None

def report_result(job_id, result_text, error_text, duration_s, endpoint_version):
    """Submit job result to backend. Tries new endpoint, falls back to old."""
    # Try new endpoint: POST /api/jobs/:id/result
    try:
        payload = {"duration_seconds": duration_s}
        if result_text:
            payload["result"] = result_text
        if error_text:
            payload["error"] = error_text

        code, resp = http_post(f"{API_URL}/api/jobs/{job_id}/result", payload, timeout=30)
        if code == 200:
            log.info(f"Job {job_id} result reported via new endpoint ({duration_s}s)")
            return
    except Exception as e:
        log.warning(f"New result endpoint failed: {e}")

    # Fallback: old endpoint POST /api/providers/job-result
    try:
        payload = {
            "api_key": API_KEY,
            "job_id": job_id,
            "success": error_text is None,
            "result": result_text or "completed",
            "error": error_text,
        }
        code, resp = http_post(f"{API_URL}/api/providers/job-result", payload, timeout=30)
        log.info(f"Job {job_id} result reported via old endpoint ({duration_s}s)")
    except Exception as e:
        log.error(f"Failed to report result for job {job_id}: {e}")

# ─── JOB POLL LOOP ─────────────────────────────────────────────────────────

_job_lock = threading.Lock()
_job_running = False

def poll_and_execute():
    """Poll for an assigned job and execute it (thread-safe, one at a time)."""
    global _job_running
    if _job_running:
        return
    if not _job_lock.acquire(blocking=False):
        return

    _job_running = True
    try:
        job, endpoint = poll_for_job()
        if job:
            execute_job(job, endpoint)
    except Exception as e:
        log.error(f"Job poll/execute error: {e}")
    finally:
        _job_running = False
        _job_lock.release()

def job_poll_loop():
    """Background thread: poll for jobs every JOB_POLL_INTERVAL seconds."""
    while True:
        poll_and_execute()
        time.sleep(JOB_POLL_INTERVAL)

# ─── MAIN ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DC1 Provider Daemon v3.0")
    parser.add_argument("--key", help="Override API key")
    parser.add_argument("--url", help="Override API URL")
    parser.add_argument("--bare-metal", action="store_true", help="Force bare-metal execution (no Docker)")
    args = parser.parse_args()

    global API_KEY, API_URL, FORCE_BARE_METAL
    if args.key:
        API_KEY = args.key
    if args.url:
        API_URL = args.url
    if args.bare_metal:
        FORCE_BARE_METAL = True

    # Validate configuration
    if API_KEY in ("{{API_KEY}}", "INJECT_KEY_HERE", "") or not API_KEY:
        log.error("No API key configured. Use --key or download from DC1 dashboard.")
        sys.exit(1)
    if API_URL in ("{{API_URL}}", "INJECT_URL_HERE", "") or not API_URL:
        log.error("No API URL configured. Use --url or download from DC1 dashboard.")
        sys.exit(1)

    log.info("=" * 60)
    log.info(f"DC1 Provider Daemon v{DAEMON_VERSION}")
    log.info(f"API URL:    {API_URL}")
    log.info(f"API Key:    {API_KEY[:20]}...")
    log.info(f"Run Mode:   {RUN_MODE}")
    log.info(f"Schedule:   {SCHED_START} – {SCHED_END}")
    log.info(f"Bare Metal: {FORCE_BARE_METAL}")
    log.info(f"Logs:       {LOG_DIR}")
    log.info("=" * 60)

    # Step 1: Detect GPU
    log.info("Detecting GPU...")
    gpu = detect_gpu()
    if gpu:
        log.info(f"GPU:    {gpu['gpu_name']} ({gpu['gpu_vram_mib']} MiB VRAM)")
        log.info(f"Driver: {gpu['driver_version']}  Compute: {gpu['compute_cap']}")
    else:
        log.warning("No NVIDIA GPU detected — daemon will run in limited mode")

    # Step 2: Check Docker
    log.info("Checking Docker...")
    docker = check_docker()
    log.info(f"Docker:    {'YES' if docker['docker'] else 'NO'} ({docker.get('docker_version', 'N/A')})")
    log.info(f"NVIDIA CT: {'YES' if docker['nvidia_docker'] else 'NO'}")

    # Step 3: Run readiness checks
    log.info("Running readiness checks...")
    checks = check_readiness()
    report_readiness(checks)

    if checks["cuda"] and checks.get("pytorch"):
        log.info("Readiness: PASSED (CUDA + PyTorch)")
    elif checks["cuda"]:
        log.info("Readiness: PARTIAL (CUDA ok, no PyTorch — Docker jobs will still work)")
    else:
        missing = []
        if not checks["cuda"]: missing.append("CUDA/GPU")
        if not checks.get("pytorch"): missing.append("PyTorch")
        log.warning(f"Readiness: LIMITED — missing: {', '.join(missing)}")

    # Step 4: Send initial heartbeat
    log.info("Sending initial heartbeat...")
    if send_heartbeat():
        log.info("Heartbeat: OK — provider is online")
    else:
        log.warning("Heartbeat failed — will retry in background")

    # Step 5: Start background threads
    log.info(f"Starting heartbeat thread (every {HEARTBEAT_INTERVAL}s)...")
    hb_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_thread.start()

    log.info(f"Starting job poll thread (every {JOB_POLL_INTERVAL}s)...")
    jp_thread = threading.Thread(target=job_poll_loop, daemon=True)
    jp_thread.start()

    log.info("Daemon running. Press Ctrl+C to stop.")
    log.info("=" * 60)

    # Main loop: check schedule, keep alive
    try:
        while True:
            time.sleep(30)
            if not within_schedule():
                log.info(f"Outside scheduled window ({SCHED_START}–{SCHED_END}). Stopping daemon.")
                sys.exit(0)
    except KeyboardInterrupt:
        log.info("Daemon stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()
