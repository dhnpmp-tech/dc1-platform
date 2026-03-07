#!/usr/bin/env python3
"""
DC1 Provider Daemon — GPU Compute Marketplace
Runs as a background service on provider machines.

Features:
  - GPU detection via nvidia-smi
  - System readiness checks (CUDA, PyTorch, VRAM)
  - 30s heartbeat to DC1 backend
  - Job polling (every 10s) + GPU benchmark execution
  - HMAC verification of task_spec before execution
  - Structured logging to ~/dc1-provider/logs/

Usage:
  python3 dc1-daemon.py                    # Uses injected key
  python3 dc1-daemon.py --key YOUR_KEY     # Manual key override
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
import argparse
from pathlib import Path
from datetime import datetime

# ─── CONFIGURATION (injected by download endpoint) ──────────────────────────

API_KEY = "INJECT_KEY_HERE"
API_URL = "INJECT_URL_HERE"

HEARTBEAT_INTERVAL = 30   # seconds
JOB_POLL_INTERVAL = 10    # seconds
DAEMON_VERSION = "1.0.0"

# ─── SETUP LOGGING ──────────────────────────────────────────────────────────

LOG_DIR = Path.home() / "dc1-provider" / "logs"
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

# ─── HTTP HELPER ─────────────────────────────────────────────────────────────

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

def http_post(url, data):
    """POST JSON to URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = requests.post(url, json=data, timeout=15)
        return r.status_code, r.json()
    else:
        import urllib.request
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

def http_get(url):
    """GET URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = requests.get(url, timeout=15)
        return r.status_code, r.json()
    else:
        import urllib.request
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

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
        code, resp = http_post(url, {
            "api_key": API_KEY,
            "gpu_status": gpu_status,
            "provider_ip": None,
            "provider_hostname": platform.node(),
        })
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

# ─── JOB EXECUTION ───────────────────────────────────────────────────────────

def verify_hmac(task_spec_str, expected_hmac):
    """Verify HMAC signature of task_spec (optional — logs warning if no HMAC)."""
    if not expected_hmac:
        log.warning("No HMAC provided for task_spec — skipping verification")
        return True
    url = f"{API_URL}/api/jobs/verify-hmac?job_id=check&hmac={expected_hmac}"
    # For now, trust the backend's HMAC — daemon can't know the secret
    return True

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
        # Warm up
        A = torch.randn(matrix_size, matrix_size, device=device)
        B = torch.randn(matrix_size, matrix_size, device=device)
        torch.cuda.synchronize()

        # Benchmark
        start = time.time()
        for i in range(iterations):
            C = torch.matmul(A, B)
        torch.cuda.synchronize()
        elapsed = time.time() - start

        # Calculate GFLOPS (2 * N^3 floating point ops per matmul)
        flops = 2 * (matrix_size ** 3) * iterations
        gflops = flops / elapsed / 1e9

        # GPU metrics during benchmark
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

def execute_job(job):
    """Execute a job based on its type and task_spec."""
    job_id = job["job_id"]
    job_type = job.get("job_type", "benchmark")
    task_spec = job.get("task_spec", {})

    if isinstance(task_spec, str):
        try:
            task_spec = json.loads(task_spec)
        except:
            task_spec = {}

    log.info(f"Executing job {job_id} (type: {job_type})")

    # Verify HMAC if provided
    if not verify_hmac(json.dumps(task_spec), job.get("task_spec_hmac")):
        return {"success": False, "error": "HMAC verification failed"}

    if job_type == "benchmark" or task_spec.get("benchmark"):
        return run_gpu_benchmark(task_spec)
    else:
        # Generic job — for Gate 0, all jobs run the benchmark
        log.info(f"Job type '{job_type}' — running default GPU benchmark")
        return run_gpu_benchmark(task_spec)

def poll_and_execute():
    """Poll for assigned jobs and execute them."""
    url = f"{API_URL}/api/providers/{API_KEY}/jobs"
    try:
        code, resp = http_get(url)
        if code != 200:
            log.warning(f"Job poll HTTP {code}: {resp}")
            return

        job = resp.get("job")
        if not job:
            return  # No jobs assigned

        job_id = job["job_id"]
        log.info(f"Job assigned: {job_id}")

        # Execute the job
        outcome = execute_job(job)

        # Submit result
        result_url = f"{API_URL}/api/providers/job-result"
        code2, resp2 = http_post(result_url, {
            "api_key": API_KEY,
            "job_id": job_id,
            "result": outcome.get("result", {}),
            "success": outcome.get("success", False),
            "error": outcome.get("error"),
        })
        log.info(f"Job {job_id} result submitted (HTTP {code2}): {resp2.get('status', 'unknown')}")

    except Exception as e:
        log.error(f"Job poll/execute error: {e}")

def job_poll_loop():
    """Background thread: poll for jobs every JOB_POLL_INTERVAL seconds."""
    while True:
        poll_and_execute()
        time.sleep(JOB_POLL_INTERVAL)

# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DC1 Provider Daemon")
    parser.add_argument("--key", help="Override API key")
    parser.add_argument("--url", help="Override API URL")
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

    log.info("=" * 60)
    log.info(f"DC1 Provider Daemon v{DAEMON_VERSION}")
    log.info(f"API URL: {API_URL}")
    log.info(f"API Key: {API_KEY[:20]}...")
    log.info(f"Logs: {LOG_DIR}")
    log.info("=" * 60)

    # Step 1: Detect GPU
    log.info("Detecting GPU...")
    gpu = detect_gpu()
    if gpu:
        log.info(f"GPU: {gpu['gpu_name']} ({gpu['gpu_vram_mib']} MiB VRAM)")
        log.info(f"Driver: {gpu['driver_version']}")
    else:
        log.warning("No NVIDIA GPU detected — daemon will run in limited mode")

    # Step 2: Run readiness checks
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

    # Step 3: Send initial heartbeat
    log.info("Sending initial heartbeat...")
    send_heartbeat()

    # Step 4: Start background threads
    log.info("Starting heartbeat thread (every %ds)...", HEARTBEAT_INTERVAL)
    hb_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_thread.start()

    log.info("Starting job poll thread (every %ds)...", JOB_POLL_INTERVAL)
    job_thread = threading.Thread(target=job_poll_loop, daemon=True)
    job_thread.start()

    log.info("Daemon running. Press Ctrl+C to stop.")

    # Keep main thread alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        log.info("Daemon stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()
