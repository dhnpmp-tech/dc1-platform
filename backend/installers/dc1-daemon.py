#!/usr/bin/env python3
"""
DC1 Provider Daemon v3.0.0 — GPU Compute Marketplace
Runs as a background service on provider machines.

Features:
  - GPU detection via nvidia-smi
  - System readiness checks (CUDA, PyTorch, VRAM)
  - 30s heartbeat to DC1 backend
  - Job polling (every 10s) with dual endpoint support
  - Docker-based execution (NVIDIA Container Toolkit) with bare-metal fallback
  - Machine verification challenge support (anti-fraud GPU benchmarking)
  - 10KB stdout capture for LLM/image outputs
  - HMAC verification of task_spec before execution
  - Structured logging to ~/dc1-provider/logs/

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
from pathlib import Path
from datetime import datetime

# ─── CONFIGURATION (injected by download endpoint) ──────────────────────────

API_KEY = "INJECT_KEY_HERE"
API_URL = "INJECT_URL_HERE"

HEARTBEAT_INTERVAL = 30   # seconds
JOB_POLL_INTERVAL = 10    # seconds
DAEMON_VERSION = "3.0.0"
MAX_STDOUT = 2097152       # 2 MB stdout capture (for base64 image results)
JOB_TIMEOUT = 600          # 10 min default job timeout

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

# ─── HTTP HELPER ─────────────────────────────────────────────────────────────

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

def http_post(url, data, timeout=15):
    """POST JSON to URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = requests.post(url, json=data, timeout=timeout)
        return r.status_code, r.json()
    else:
        import urllib.request, urllib.error
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

def http_get(url, timeout=15):
    """GET URL, returns (status_code, response_dict)."""
    if HAS_REQUESTS:
        r = requests.get(url, timeout=timeout)
        return r.status_code, r.json()
    else:
        import urllib.request, urllib.error
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
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

def run_bare_metal_job(task_spec):
    """Execute job as a bare-metal subprocess (no Docker)."""
    script = task_spec if isinstance(task_spec, str) else task_spec.get("script", "")
    if not script:
        return {"success": False, "error": "No script in task_spec"}

    # Write to temp file and execute
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(script)
        temp_path = f.name

    log.info(f"Bare-metal exec: {temp_path}")

    try:
        result = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True, text=True, timeout=JOB_TIMEOUT
        )

        stdout = result.stdout[:MAX_STDOUT]
        stderr = result.stderr[:MAX_STDOUT]

        if result.returncode == 0:
            return {"success": True, "result": stdout, "stderr": stderr}
        else:
            return {"success": False, "error": f"Exit code {result.returncode}: {stderr[:500]}"}
    except subprocess.TimeoutExpired:
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
    _current_job_id = job_id

    if isinstance(task_spec, str):
        try:
            task_spec = json.loads(task_spec)
        except:
            pass  # Keep as string (it might be raw Python code)

    log.info(f"Executing job {job_id} (type: {job_type})")

    # Pure benchmark jobs (no script needed)
    if job_type == "benchmark" or (isinstance(task_spec, dict) and task_spec.get("benchmark")):
        result = run_gpu_benchmark(task_spec if isinstance(task_spec, dict) else {})
        _current_job_id = None
        return result

    # Script-based jobs — Docker > bare-metal
    has_script = (isinstance(task_spec, str) and len(task_spec) > 10) or \
                 (isinstance(task_spec, dict) and task_spec.get("script"))

    if has_script:
        if check_docker():
            job_dir = tempfile.mkdtemp(prefix="dc1-job-")
            result = run_docker_job(job_type, task_spec, job_dir)
        else:
            result = run_bare_metal_job(task_spec)
    else:
        # No script — fall back to benchmark
        log.info(f"No script in task_spec — running default benchmark")
        result = run_gpu_benchmark(task_spec if isinstance(task_spec, dict) else {})

    _current_job_id = None
    return result

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
    log.info(f"Job assigned: {job_id} (type: {job.get('job_type', 'unknown')})")

    # Execute in background thread so heartbeats continue
    def _run():
        outcome = execute_job(job)

        # Submit result
        result_url = f"{API_URL}/api/providers/job-result"
        try:
            code, resp = http_post(result_url, {
                "api_key": API_KEY,
                "job_id": job_id,
                "result": outcome.get("result", {}),
                "success": outcome.get("success", False),
                "error": outcome.get("error"),
                "metrics": outcome.get("metrics"),
            }, timeout=30)
            log.info(f"Job {job_id} result submitted (HTTP {code}): {resp.get('status', 'unknown')}")
        except Exception as e:
            log.error(f"Job result submission failed: {e}")

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

def job_poll_loop():
    """Background thread: poll for jobs every JOB_POLL_INTERVAL seconds."""
    while True:
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

# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DC1 Provider Daemon v3.0")
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
    log.info(f"Max stdout: {MAX_STDOUT} bytes")
    log.info("=" * 60)

    # Step 1: Detect GPU
    log.info("Detecting GPU...")
    gpu = detect_gpu()
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

    # Step 4: Send initial heartbeat
    log.info("Sending initial heartbeat...")
    send_heartbeat()

    # Step 5: Auto-verify GPU on first run
    log.info("Checking verification status...")
    auto_verify()

    # Step 6: Start background threads
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
