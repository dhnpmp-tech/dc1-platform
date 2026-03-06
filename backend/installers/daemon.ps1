# DC1 Provider Daemon Installer for Windows
# Usage: iwr http://76.13.179.86:8083/api/providers/setup-windows?key=YOUR_KEY -UseBasicParsing | iex
$ErrorActionPreference = "Continue"
$API_KEY = "{{API_KEY}}"
$RUN_MODE = "{{RUN_MODE}}"
$SCHEDULED_START = "{{SCHEDULED_START}}"
$SCHEDULED_END = "{{SCHEDULED_END}}"
$API_URL = "http://76.13.179.86:8083"
$INSTALL_DIR = "$env:LOCALAPPDATA\dc1-provider"

Write-Host "`n=== DC1 Provider Daemon Installer ===" -ForegroundColor Cyan
Write-Host "API Key: $($API_KEY.Substring(0,20))..." -ForegroundColor Gray
Write-Host "Mode:    $RUN_MODE" -ForegroundColor Gray

# --- Step 1: Find or install Python ---
Write-Host "`n[1/6] Checking Python..." -ForegroundColor Yellow

function Find-RealPython {
    $candidates = @()
    # User-installed Python
    $userPaths = Get-ChildItem "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\*\python.exe" -ErrorAction SilentlyContinue
    if ($userPaths) { $candidates += $userPaths.FullName }
    # System-installed Python
    $sysPaths = Get-ChildItem "C:\Program Files\Python*\python.exe" -ErrorAction SilentlyContinue
    if ($sysPaths) { $candidates += $sysPaths.FullName }
    # PATH python (filter out WindowsApps stub)
    $pathPython = Get-Command python -ErrorAction SilentlyContinue
    if ($pathPython -and $pathPython.Source -notmatch "WindowsApps") {
        $candidates += $pathPython.Source
    }
    foreach ($p in $candidates) {
        if ($p -notmatch "WindowsApps") { return $p }
    }
    return $null
}

$pythonExe = Find-RealPython

if (-not $pythonExe) {
    Write-Host "  Python not found. Installing Python 3.12..." -ForegroundColor Yellow
    $installerUrl = "https://www.python.org/ftp/python/3.12.4/python-3.12.4-amd64.exe"
    $installerPath = "$env:TEMP\python-3.12.4-amd64.exe"
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Start-Process -FilePath $installerPath -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1" -Wait
    Remove-Item $installerPath -ErrorAction SilentlyContinue
    # Re-detect after install
    $pythonExe = Find-RealPython
    if (-not $pythonExe) {
        Write-Host "  ERROR: Python installation failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Python installed: $pythonExe" -ForegroundColor Green
} else {
    Write-Host "  Found Python: $pythonExe" -ForegroundColor Green
}

# --- Step 2: Create install directory and daemon script ---
Write-Host "[2/6] Creating daemon script..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

$daemonPy = @"
import requests, time, datetime, socket, subprocess, sys, platform, threading

API_KEY = "$API_KEY"
API_URL = "$API_URL"
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

def check_and_run_job():
    import os
    try:
        r = requests.get(f"{API_URL}/api/jobs/assigned", params={"key": API_KEY}, timeout=10)
        if r.status_code != 200:
            return
        job = r.json().get("job")
        if not job or not job.get("task_spec"):
            return
        job_id = job["id"]
        task = job["task_spec"]
        print(f"[{datetime.datetime.now()}] Job {job_id} picked up — executing...")
        tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_dc1_task.py")
        with open(tmp, "w") as f:
            f.write(task)
        t0 = datetime.datetime.now()
        proc = subprocess.run([sys.executable, tmp], capture_output=True, text=True, timeout=300)
        duration_s = int((datetime.datetime.now() - t0).total_seconds())
        result_text = (proc.stdout or "").strip()[-1000:] or "completed"
        error_text = (proc.stderr or "").strip()[-500:] if proc.returncode != 0 else None
        try:
            os.remove(tmp)
        except Exception:
            pass
        requests.post(f"{API_URL}/api/jobs/{job_id}/result",
            json={"result": result_text, "error": error_text, "duration_seconds": duration_s}, timeout=10)
        print(f"[{datetime.datetime.now()}] Job {job_id} done in {duration_s}s")
    except subprocess.TimeoutExpired:
        print(f"[{datetime.datetime.now()}] Job {job.get('id')} timed out after 300s — reporting")
        try:
            requests.post(f"{API_URL}/api/jobs/{job.get('id')}/result",
                json={"error": "Job timed out after 300 seconds", "duration_seconds": 300}, timeout=10)
        except Exception:
            pass
        try:
            os.remove(tmp)
        except Exception:
            pass
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Job error: {e}")

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
    send_heartbeat()
    # Dispatch job check in background thread so heartbeats keep flowing
    t = threading.Thread(target=run_job_in_background, daemon=True)
    t.start()
"@

Set-Content -Path "$INSTALL_DIR\dc1_daemon.py" -Value $daemonPy -Encoding UTF8

# Write config.json so daemon can read preferences
$config = @{ api_key = $API_KEY; run_mode = $RUN_MODE; api_url = $API_URL } | ConvertTo-Json
Set-Content -Path "$INSTALL_DIR\config.json" -Value $config -Encoding UTF8

Write-Host "  Created $INSTALL_DIR\dc1_daemon.py" -ForegroundColor Green

# --- Step 3: Install requests ---
Write-Host "[3/6] Installing Python requests..." -ForegroundColor Yellow
$pipExe = Join-Path (Split-Path $pythonExe) "Scripts\pip.exe"
if (-not (Test-Path $pipExe)) { $pipExe = $pythonExe; $pipArgs = @("-m", "pip", "install", "requests") }
else { $pipArgs = @("install", "requests") }
& $pipExe @pipArgs 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pip install failed (exit code $LASTEXITCODE). Check your internet connection." -ForegroundColor Red
    exit 1
}
Write-Host "  requests installed." -ForegroundColor Green

# --- Step 4: Register scheduled task (mode-dependent) ---
Write-Host "[4/6] Configuring run mode: $RUN_MODE..." -ForegroundColor Yellow
$taskName = "DC1ProviderDaemon"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $pythonExe -Argument "$INSTALL_DIR\dc1_daemon.py" -WorkingDirectory $INSTALL_DIR
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1))
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive

if ($RUN_MODE -eq 'manual') {
    # Manual mode: no scheduled task — provider controls when daemon runs
    # Create a desktop shortcut (Start DC1.bat) for manual launch
    $startScript = "@echo off`necho Starting DC1 Provider Daemon...`nstart /min $pythonExe $INSTALL_DIR\dc1_daemon.py`necho Done. Check your dashboard.`ntimeout /t 3"
    Set-Content -Path "$INSTALL_DIR\start-dc1.bat" -Value $startScript -Encoding ASCII
    $stopScript = "@echo off`necho Stopping DC1 Provider Daemon...`ntaskkill /F /IM python.exe /FI `"WINDOWTITLE eq dc1_daemon*`" 2>nul`npython -c `"import requests; requests.post('$API_URL/api/providers/pause', json={'key':'$API_KEY'})`" 2>nul`necho Stopped.`ntimeout /t 3"
    Set-Content -Path "$INSTALL_DIR\stop-dc1.bat" -Value $stopScript -Encoding ASCII
    Write-Host "  Manual mode — no auto-start task created." -ForegroundColor Yellow
    Write-Host "  Start earning: double-click $INSTALL_DIR\start-dc1.bat" -ForegroundColor Cyan
} elseif ($RUN_MODE -eq 'scheduled') {
    # Scheduled mode: run daily at configured start time
    $startHour = 23; $startMin = 0
    if ($SCHEDULED_START -match '^(\d{1,2}):(\d{2})$') {
        $startHour = [int]$Matches[1]; $startMin = [int]$Matches[2]
    }
    $triggerTime = (Get-Date -Hour $startHour -Minute $startMin -Second 0).ToString("HH:mm")
    $trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Write-Host "  Scheduled mode — runs daily at $triggerTime." -ForegroundColor Green
    # Also create a stop shortcut for when the user wakes up
    $stopScript = "@echo off`necho Stopping DC1 Provider Daemon...`ntaskkill /F /IM python.exe 2>nul`necho Stopped.`ntimeout /t 3"
    Set-Content -Path "$INSTALL_DIR\stop-dc1.bat" -Value $stopScript -Encoding ASCII
} else {
    # Always-on (default): start at every login
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Write-Host "  Always-on mode — starts automatically at login." -ForegroundColor Green
}

# Create dashboard shortcut on Desktop for all modes
$dashUrl = "$API_URL/provider?key=$API_KEY"
# Use a .bat that opens the browser (works without .lnk COM object in restricted envs)
$shortcutContent = "@echo off`nstart `"`" `"$dashUrl`""
Set-Content -Path "$env:USERPROFILE\Desktop\DC1 - My Earnings.bat" -Value $shortcutContent -Encoding ASCII
Write-Host "  Desktop shortcut created: 'DC1 - My Earnings'" -ForegroundColor Green

# --- Step 5: Start daemon (not for manual mode — user controls that) ---
Write-Host "[5/6] Starting daemon..." -ForegroundColor Yellow
if ($RUN_MODE -eq 'manual') {
    Write-Host "  Manual mode — skipping auto-start. Use start-dc1.bat when ready." -ForegroundColor Yellow
} elseif ($RUN_MODE -eq 'scheduled') {
    Write-Host "  Scheduled mode — daemon will start at $triggerTime. Starting once now for verification..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
} else {
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 5
    Write-Host "  Daemon started." -ForegroundColor Green
}

# --- Step 6: Test connection ---
Write-Host "[6/6] Testing connection..." -ForegroundColor Yellow
try {
    $body = @{
        api_key = $API_KEY
        provider_hostname = $env:COMPUTERNAME
        provider_ip = $null
        gpu_status = @{ gpu_name = "test"; gpu_vram_mib = 0 }
    } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$API_URL/api/providers/heartbeat" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "`n==============================================" -ForegroundColor Green
        Write-Host "  DC1 Provider Daemon installed successfully!" -ForegroundColor Green
        Write-Host "==============================================" -ForegroundColor Green
        Write-Host "  Mode:        $RUN_MODE"
        Write-Host "  Install dir: $INSTALL_DIR"
        if ($RUN_MODE -ne 'manual') { Write-Host "  Task name:   $taskName" }
        Write-Host "  Python:      $pythonExe"
        Write-Host "  Dashboard:   $dashUrl"
        if ($RUN_MODE -eq 'manual') {
            Write-Host "`n  To start earning: double-click 'DC1 - My Earnings' on your Desktop" -ForegroundColor Cyan
            Write-Host "  Or run: $INSTALL_DIR\start-dc1.bat`n"
        } else {
            Write-Host "`n  The daemon runs automatically. Check your dashboard anytime:`n  $dashUrl`n"
        }
    } else {
        throw "Unexpected status: $($response.StatusCode)"
    }
} catch {
    Write-Host "`n==============================================" -ForegroundColor Red
    Write-Host "  Installation complete but connection failed!" -ForegroundColor Red
    Write-Host "==============================================" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host "  Next steps:"
    Write-Host "    1. Check internet connectivity"
    Write-Host "    2. Verify API key is correct"
    Write-Host "    3. Try: Invoke-WebRequest $API_URL/health`n"
}

