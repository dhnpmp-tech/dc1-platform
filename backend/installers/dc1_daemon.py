"""
DC1 Provider Daemon — Standalone Template
Placeholders {{API_KEY}} and {{API_URL}} are replaced by dc1-setup-helper.ps1
"""
import requests, time, datetime, socket, subprocess, sys, platform

API_KEY = "{{API_KEY}}"
API_URL = "{{API_URL}}"
INTERVAL = 30
DAEMON_VERSION = "1.1.0"

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

if __name__ == "__main__":
    print("DC1 Provider Daemon v" + DAEMON_VERSION + " starting...")
    send_heartbeat()
    while True:
        time.sleep(INTERVAL)
        send_heartbeat()
