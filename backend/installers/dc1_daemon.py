"""
DC1 Provider Daemon — Standalone Template
Placeholders {{API_KEY}} and {{API_URL}} are replaced by dc1-setup-helper.ps1
"""
import requests, time, datetime, socket, subprocess, sys, platform, threading, json, os

API_KEY = "{{API_KEY}}"
API_URL = "{{API_URL}}"
INTERVAL = 30
DAEMON_VERSION = "1.1.0"

# --- Schedule-aware exit (honors run_mode=scheduled + scheduled_end from config.json) ---
_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
_config = {}
try:
    with open(_CONFIG_PATH) as _f:
        _config = json.load(_f)
except Exception:
    pass

RUN_MODE = _config.get("run_mode", "always-on")
SCHED_START = _config.get("scheduled_start", "23:00")
SCHED_END   = _config.get("scheduled_end",   "07:00")

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
    if start <= end:          # same-day window  e.g. 09:00-17:00
        return start <= now <= end
    else:                     # overnight window e.g. 23:00-07:00
        return now >= start or now <= end

def get_gpu_info():
    info = {
        "gpu_name": "unknown", "gpu_vram_mib": 0, "free_vram_mib": 0,
        "driver_version": "unknown", "compute_cap": "unknown",
        "gpu_util_pct": 0, "temp_c": None, "power_w": None,
        "daemon_version": DAEMON_VERSION,
        "python_version": sys.version.split()[0],
        "os_info": platform.system() + " " + platform.version()
    }
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.free,driver_version,compute_cap,utilization.gpu,temperature.gpu,power.draw", "--format=csv,noheader,nounits"],
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

def send_heartbeat():
    try:
        r = requests.post(f"{API_URL}/api/providers/heartbeat",
            json={"api_key": API_KEY, "provider_hostname": socket.gethostname(),
                  "provider_ip": None, "gpu_status": get_gpu_info()}, timeout=10)
        print(f"[{datetime.datetime.now()}] Heartbeat: {r.status_code}")
        return r.status_code == 200
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Error: {e}")
        return False

def check_and_run_job():
    """Poll for an assigned job; if found, execute task_spec and report result."""
    try:
        r = requests.get(f"{API_URL}/api/jobs/assigned", params={"key": API_KEY}, timeout=10)
        if r.status_code != 200:
            return
        job = r.json().get("job")
        if not job or not job.get("task_spec"):
            return

        job_id  = job["id"]
        task    = job["task_spec"]
        print(f"[{datetime.datetime.now()}] Job {job_id} picked up — executing task...")

        # Write task to temp file and run it
        tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_dc1_task.py")
        with open(tmp, "w") as f:
            f.write(task)

        t0 = datetime.datetime.now()
        proc = subprocess.run(
            [sys.executable, tmp],
            capture_output=True, text=True, timeout=300
        )
        duration_s = int((datetime.datetime.now() - t0).total_seconds())

        result_text = (proc.stdout or "").strip()[-1000:] or "completed"
        error_text  = (proc.stderr or "").strip()[-500:] if proc.returncode != 0 else None

        try:
            os.remove(tmp)
        except Exception:
            pass

        # Report result back to platform
        requests.post(
            f"{API_URL}/api/jobs/{job_id}/result",
            json={"result": result_text, "error": error_text, "duration_seconds": duration_s},
            timeout=10
        )
        print(f"[{datetime.datetime.now()}] Job {job_id} complete in {duration_s}s — result reported.")

    except subprocess.TimeoutExpired:
        print(f"[{datetime.datetime.now()}] Job {job.get('id')} timed out after 300s — reporting to API")
        try:
            requests.post(
                f"{API_URL}/api/jobs/{job.get('id')}/result",
                json={"error": "Job timed out after 300 seconds", "duration_seconds": 300},
                timeout=10
            )
        except Exception:
            pass
        try:
            os.remove(tmp)
        except Exception:
            pass
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Job execution error: {e}")


if __name__ == "__main__":
    print("DC1 Provider Daemon v" + DAEMON_VERSION + " starting...")

    # Thread-safe job lock — prevents multiple jobs running simultaneously
    _job_lock = threading.Lock()
    _job_running = False

    def run_job_in_background():
        global _job_running
        if _job_running:
            return  # Already executing a job
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
            sys.exit(0)   # Task Scheduler restarts at next SCHED_START trigger
        send_heartbeat()
        # Dispatch job check in background thread so heartbeats keep flowing
        t = threading.Thread(target=run_job_in_background, daemon=True)
        t.start()
