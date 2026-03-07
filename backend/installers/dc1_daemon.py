"""
DC1 Provider Daemon v2.0 — Docker-aware GPU Job Execution
Placeholders {{API_KEY}} and {{API_URL}} are replaced by the setup script.

Execution modes:
  1. Docker mode (default when Docker + NVIDIA Container Toolkit detected):
     - Mounts task script into a pre-built DC1 worker image
     - `docker run --gpus all --rm` for full GPU isolation
     - Output captured from container stdout
  2. Bare-metal fallback (when Docker unavailable):
     - Runs task_spec as subprocess (legacy behavior)
"""
import requests, time, datetime, socket, subprocess, sys, platform, threading, json, os, shutil

API_KEY = "{{API_KEY}}"
API_URL = "{{API_URL}}"
INTERVAL = 30
DAEMON_VERSION = "2.0.0"

# Max output capture: 5 MB (base64 images can be 1-4 MB)
MAX_STDOUT = 5 * 1024 * 1024
# Job timeout: 10 minutes default (image gen can take 3-5 min on consumer GPUs)
JOB_TIMEOUT = 600

# Docker worker images by job type
DOCKER_IMAGES = {
    "image_generation": "dc1/sd-worker:latest",
    "llm-inference":    "dc1/llm-worker:latest",
    "training":         "dc1/train-worker:latest",
    "rendering":        "dc1/render-worker:latest",
    "benchmark":        "dc1/base-worker:latest",
}
DEFAULT_DOCKER_IMAGE = "dc1/base-worker:latest"

# --- Config file (schedule, preferences) ---
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_CONFIG_PATH = os.path.join(_BASE_DIR, "config.json")
_config = {}
try:
    with open(_CONFIG_PATH) as _f:
        _config = json.load(_f)
except Exception:
    pass

RUN_MODE = _config.get("run_mode", "always-on")
SCHED_START = _config.get("scheduled_start", "23:00")
SCHED_END   = _config.get("scheduled_end",   "07:00")
# Force bare-metal even if Docker available (for debugging)
FORCE_BARE_METAL = _config.get("force_bare_metal", False)


def _parse_hhmm(t):
    h, m = map(int, t.split(":"))
    return datetime.time(h, m)


def within_schedule():
    """Return False when scheduled mode is active and current time is outside the window."""
    if RUN_MODE != "scheduled":
        return True
    now   = datetime.datetime.now().time()
    start = _parse_hhmm(SCHED_START)
    end   = _parse_hhmm(SCHED_END)
    if start <= end:
        return start <= now <= end
    else:
        return now >= start or now <= end


# ── Docker Detection ─────────────────────────────────────────────────────

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

    # Check NVIDIA Container Toolkit by trying to list GPU devices in Docker
    try:
        proc = subprocess.run(
            ["docker", "run", "--rm", "--gpus", "all", "nvidia/cuda:12.2.0-base-ubuntu22.04", "nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=30
        )
        if proc.returncode == 0 and proc.stdout.strip():
            result["nvidia_docker"] = True
    except Exception:
        pass

    return result


_docker_status = None  # Cached on first check

def is_docker_available():
    """Return True if Docker + NVIDIA Container Toolkit are both available."""
    global _docker_status
    if FORCE_BARE_METAL:
        return False
    if _docker_status is None:
        _docker_status = check_docker()
        print(f"[dc1] Docker check: {json.dumps(_docker_status)}")
    return _docker_status["docker"] and _docker_status["nvidia_docker"]


# ── GPU Info ────────────────────────────────────────────────────────────

def get_gpu_info():
    info = {
        "gpu_name": "unknown", "gpu_vram_mib": 0, "free_vram_mib": 0,
        "driver_version": "unknown", "compute_cap": "unknown",
        "gpu_util_pct": 0, "temp_c": None, "power_w": None,
        "daemon_version": DAEMON_VERSION,
        "python_version": sys.version.split()[0],
        "os_info": platform.system() + " " + platform.version(),
        "docker_available": is_docker_available(),
    }
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.free,driver_version,compute_cap,utilization.gpu,temperature.gpu,power.draw",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            p = [x.strip() for x in result.stdout.strip().split(",")]
            if len(p) > 0: info["gpu_name"] = p[0]
            if len(p) > 1:
                try: info["gpu_vram_mib"] = int(p[1])
                except: pass
            if len(p) > 2:
                try: info["free_vram_mib"] = int(p[2])
                except: pass
            if len(p) > 3: info["driver_version"] = p[3]
            if len(p) > 4: info["compute_cap"] = p[4]
            if len(p) > 5:
                try: info["gpu_util_pct"] = float(p[5])
                except: pass
            if len(p) > 6:
                try: info["temp_c"] = float(p[6])
                except: pass
            if len(p) > 7:
                try: info["power_w"] = float(p[7].replace(" W","").strip())
                except: pass
    except Exception:
        pass
    return info


# ── Heartbeat ───────────────────────────────────────────────────────────

def send_heartbeat(extra=None):
    try:
        payload = {
            "api_key": API_KEY,
            "provider_hostname": socket.gethostname(),
            "provider_ip": None,
            "gpu_status": get_gpu_info()
        }
        if extra:
            payload.update(extra)
        r = requests.post(f"{API_URL}/api/providers/heartbeat", json=payload, timeout=10)
        print(f"[{datetime.datetime.now()}] Heartbeat: {r.status_code}")
        return r.status_code == 200
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Heartbeat error: {e}")
        return False


# ── Job Execution (Docker) ──────────────────────────────────────────────

def run_job_docker(job_id, task_spec, job_type):
    """Execute a job inside a Docker container with GPU access."""
    # Create temp dir for this job
    job_dir = os.path.join(_BASE_DIR, f"_dc1_job_{job_id}")
    os.makedirs(job_dir, exist_ok=True)

    task_file = os.path.join(job_dir, "task.py")
    with open(task_file, "w") as f:
        f.write(task_spec)

    image = DOCKER_IMAGES.get(job_type, DEFAULT_DOCKER_IMAGE)
    container_name = f"dc1-job-{job_id}"

    cmd = [
        "docker", "run",
        "--rm",
        "--gpus", "all",
        "--name", container_name,
        "--memory", "16g",
        "--shm-size", "2g",           # Shared memory for PyTorch DataLoader
        "-v", f"{job_dir}:/dc1/job",  # Mount job dir
        "-e", "DC1_JOB_ID=" + str(job_id),
        image,
        "python", "/dc1/job/task.py"
    ]

    print(f"[{datetime.datetime.now()}] Docker exec: {' '.join(cmd[:8])}...")

    t0 = datetime.datetime.now()
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=JOB_TIMEOUT
        )
        duration_s = int((datetime.datetime.now() - t0).total_seconds())

        # Capture up to 5 MB of stdout (for base64 image data)
        stdout = (proc.stdout or "")
        if len(stdout) > MAX_STDOUT:
            stdout = stdout[-MAX_STDOUT:]
        result_text = stdout.strip() or "completed"
        error_text = (proc.stderr or "").strip()[-2000:] if proc.returncode != 0 else None

        return result_text, error_text, duration_s

    except subprocess.TimeoutExpired:
        # Kill the container
        try:
            subprocess.run(["docker", "kill", container_name], capture_output=True, timeout=10)
        except:
            pass
        duration_s = int((datetime.datetime.now() - t0).total_seconds())
        return None, f"Job timed out after {duration_s}s (Docker)", duration_s

    finally:
        # Cleanup job dir
        try:
            shutil.rmtree(job_dir, ignore_errors=True)
        except:
            pass


# ── Job Execution (Bare Metal) ──────────────────────────────────────────

def run_job_bare(job_id, task_spec):
    """Execute a job as a local subprocess (fallback when Docker unavailable)."""
    tmp = os.path.join(_BASE_DIR, f"_dc1_task_{job_id}.py")
    with open(tmp, "w") as f:
        f.write(task_spec)

    t0 = datetime.datetime.now()
    try:
        proc = subprocess.run(
            [sys.executable, tmp],
            capture_output=True, text=True, timeout=JOB_TIMEOUT
        )
        duration_s = int((datetime.datetime.now() - t0).total_seconds())

        stdout = (proc.stdout or "")
        if len(stdout) > MAX_STDOUT:
            stdout = stdout[-MAX_STDOUT:]
        result_text = stdout.strip() or "completed"
        error_text = (proc.stderr or "").strip()[-2000:] if proc.returncode != 0 else None

        return result_text, error_text, duration_s

    except subprocess.TimeoutExpired:
        duration_s = int((datetime.datetime.now() - t0).total_seconds())
        return None, f"Job timed out after {duration_s}s", duration_s

    finally:
        try:
            os.remove(tmp)
        except:
            pass


# ── Job Orchestrator ────────────────────────────────────────────────────

def check_and_run_job():
    """Poll for an assigned job; execute via Docker or bare metal; report result."""
    try:
        r = requests.get(f"{API_URL}/api/jobs/assigned", params={"key": API_KEY}, timeout=10)
        if r.status_code != 200:
            return
        job = r.json().get("job")
        if not job or not job.get("task_spec"):
            return

        job_id   = job["id"]
        task     = job["task_spec"]
        job_type = job.get("job_type", "benchmark")
        print(f"[{datetime.datetime.now()}] Job {job_id} ({job_type}) picked up")

        # Send progress heartbeat
        send_heartbeat({"current_job_id": job_id})

        # Choose execution mode
        if is_docker_available():
            print(f"[{datetime.datetime.now()}] Executing via Docker ({DOCKER_IMAGES.get(job_type, DEFAULT_DOCKER_IMAGE)})")
            result_text, error_text, duration_s = run_job_docker(job_id, task, job_type)
        else:
            print(f"[{datetime.datetime.now()}] Executing bare-metal (no Docker)")
            result_text, error_text, duration_s = run_job_bare(job_id, task)

        # Report result to platform
        payload = {"duration_seconds": duration_s}
        if result_text:
            payload["result"] = result_text
        if error_text:
            payload["error"] = error_text

        try:
            requests.post(
                f"{API_URL}/api/jobs/{job_id}/result",
                json=payload,
                timeout=30  # Larger timeout for big payloads (base64 images)
            )
            print(f"[{datetime.datetime.now()}] Job {job_id} complete in {duration_s}s — result reported.")
        except Exception as e:
            print(f"[{datetime.datetime.now()}] Failed to report result for job {job_id}: {e}")

    except Exception as e:
        print(f"[{datetime.datetime.now()}] Job execution error: {e}")


# ── Main Loop ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"DC1 Provider Daemon v{DAEMON_VERSION} starting...")
    print(f"  API URL:   {API_URL}")
    print(f"  Run mode:  {RUN_MODE}")
    print(f"  Interval:  {INTERVAL}s")
    print(f"  Bare metal forced: {FORCE_BARE_METAL}")

    # Check Docker on startup
    docker_info = check_docker()
    print(f"  Docker:    {'YES' if docker_info['docker'] else 'NO'} ({docker_info.get('docker_version', 'N/A')})")
    print(f"  NVIDIA CT: {'YES' if docker_info['nvidia_docker'] else 'NO'}")

    # Thread-safe job lock — prevents multiple jobs running simultaneously
    _job_lock = threading.Lock()
    _job_running = False

    def run_job_in_background():
        global _job_running
        if _job_running:
            return
        if not _job_lock.acquire(blocking=False):
            return
        _job_running = True
        try:
            check_and_run_job()
        finally:
            _job_running = False
            _job_lock.release()

    send_heartbeat()
    while True:
        time.sleep(INTERVAL)
        if not within_schedule():
            print(f"[{datetime.datetime.now()}] Outside scheduled window ({SCHED_START}–{SCHED_END}). Exiting.")
            sys.exit(0)
        send_heartbeat()
        t = threading.Thread(target=run_job_in_background, daemon=True)
        t.start()
