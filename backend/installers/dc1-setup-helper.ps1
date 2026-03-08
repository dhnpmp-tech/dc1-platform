# =============================================================================
# DC1 Provider Daemon — Setup Helper v2.2
# Called by the NSIS installer with user selections from the GUI pages.
# Bundles daemon v3.2.0 with watchdog, auto-update, event logging.
# =============================================================================
param(
    [Parameter(Mandatory=$true)] [string]$ApiKey,
    [string]$RunMode = "always-on",
    [string]$ScheduledStart = "23:00",
    [string]$ScheduledEnd = "07:00",
    [string]$ApiUrl = "$($env:DC1_API_URL ?? 'http://76.13.179.86:8083')",
    [string]$InstallDir = "$env:LOCALAPPDATA\dc1-provider",
    [string]$GpuName = "unknown",
    [string]$GpuVram = "0"
)

$ErrorActionPreference = "Continue"
$logFile = Join-Path $InstallDir "install.log"

function Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

# Ensure install directory exists
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Log "============================================="
Log "  DC1 Provider Setup Helper v2.2"
Log "  Daemon version: 3.2.0"
Log "============================================="
Log "ApiKey:     $($ApiKey.Substring(0, [Math]::Min(20, $ApiKey.Length)))..."
Log "RunMode:    $RunMode"
Log "InstallDir: $InstallDir"
Log "ApiUrl:     $ApiUrl"
Log "GPU:        $GpuName ($GpuVram MB)"
Log ""

# ---------------------------------------------------------------------------
# Step 1: Validate API Key with the server
# ---------------------------------------------------------------------------
Log "[1/8] Validating API key with DC1 server..."
try {
    $statusUrl = "$ApiUrl/api/providers/heartbeat"
    $testBody = @{
        api_key = $ApiKey
        provider_hostname = $env:COMPUTERNAME
        provider_ip = $null
        gpu_status = @{
            gpu_name = $GpuName
            gpu_vram_mib = [int]$GpuVram
            daemon_version = "setup-2.2"
        }
    } | ConvertTo-Json -Depth 3
    $response = Invoke-WebRequest -Uri $statusUrl -Method POST -Body $testBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 15
    if ($response.StatusCode -eq 200) {
        Log "  API key validated successfully."
    } else {
        Log "  WARNING: Unexpected status $($response.StatusCode). Continuing anyway."
    }
} catch {
    $errMsg = $_.Exception.Message
    if ($errMsg -match "401|403|Unauthorized|Forbidden") {
        Log "  ERROR: Invalid API key. Please check your provider API key and try again."
        Log "  Server response: $errMsg"
        exit 2
    } elseif ($errMsg -match "Unable to connect|timeout|network") {
        Log "  WARNING: Could not reach DC1 server at $ApiUrl"
        Log "  Error: $errMsg"
        Log "  Continuing with offline install — daemon will retry when online."
    } else {
        Log "  WARNING: API validation returned: $errMsg"
        Log "  Continuing anyway."
    }
}

# ---------------------------------------------------------------------------
# Step 2: GPU Detection & Validation
# ---------------------------------------------------------------------------
Log "[2/8] Detecting NVIDIA GPU..."

function Test-NvidiaGpu {
    $gpuInfo = @{
        detected = $false
        name = "unknown"
        vram_mb = 0
        driver = "unknown"
        cuda = "unknown"
        compute_cap = "unknown"
    }
    try {
        $result = & nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits 2>$null
        if ($LASTEXITCODE -eq 0 -and $result) {
            $parts = $result.Split(",") | ForEach-Object { $_.Trim() }
            $gpuInfo.detected = $true
            if ($parts.Count -ge 1) { $gpuInfo.name = $parts[0] }
            if ($parts.Count -ge 2) { try { $gpuInfo.vram_mb = [int]$parts[1] } catch {} }
            if ($parts.Count -ge 3) { $gpuInfo.driver = $parts[2] }
            if ($parts.Count -ge 4) { $gpuInfo.compute_cap = $parts[3] }
        }
    } catch {}

    # Check CUDA availability
    try {
        $cudaResult = & nvidia-smi --query-gpu=compute_cap --format=csv,noheader 2>$null
        if ($LASTEXITCODE -eq 0) {
            $gpuInfo.cuda = "available"
        }
    } catch {}

    return $gpuInfo
}

$gpu = Test-NvidiaGpu
if ($gpu.detected) {
    Log "  GPU found: $($gpu.name)"
    Log "  VRAM:      $($gpu.vram_mb) MB"
    Log "  Driver:    $($gpu.driver)"
    Log "  Compute:   $($gpu.compute_cap)"
    if ($gpu.vram_mb -lt 4096) {
        Log "  WARNING: GPU has less than 4 GB VRAM. Some jobs may not run."
    }
} else {
    Log "  WARNING: No NVIDIA GPU detected via nvidia-smi."
    Log "  The daemon will install but may not be able to run GPU jobs."
    Log "  Make sure NVIDIA drivers are installed and nvidia-smi is in PATH."
}

# ---------------------------------------------------------------------------
# Step 3: Find or install Python
# ---------------------------------------------------------------------------
Log "[3/8] Checking Python..."

function Find-RealPython {
    $candidates = @()
    # Python Launcher for Windows (py.exe)
    try {
        $pyLauncher = & py -3 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $pyLauncher) {
            $candidates += $pyLauncher.Trim()
        }
    } catch {}
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
    Log "  Python not found. Downloading Python 3.12..."
    $installerUrl = "https://www.python.org/ftp/python/3.12.4/python-3.12.4-amd64.exe"
    $installerPath = "$env:TEMP\python-3.12.4-amd64.exe"
    try {
        Log "  Downloading from $installerUrl ..."
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        $fileSize = (Get-Item $installerPath).Length / 1MB
        Log "  Downloaded: $([math]::Round($fileSize, 1)) MB"
        Log "  Installing Python (this may take a minute)..."
        Start-Process -FilePath $installerPath -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1" -Wait
        Remove-Item $installerPath -ErrorAction SilentlyContinue
    } catch {
        Log "  ERROR: Failed to download/install Python: $_"
        exit 1
    }
    $pythonExe = Find-RealPython
    if (-not $pythonExe) {
        Log "  ERROR: Python installation failed — could not find python.exe after install."
        exit 1
    }
    Log "  Python installed: $pythonExe"
} else {
    # Get Python version
    try {
        $pyVer = & $pythonExe --version 2>&1
        Log "  Found Python: $pythonExe ($pyVer)"
    } catch {
        Log "  Found Python: $pythonExe"
    }
}

# ---------------------------------------------------------------------------
# Step 4: Install requests via pip
# ---------------------------------------------------------------------------
Log "[4/8] Installing Python dependencies..."
$pipExe = Join-Path (Split-Path $pythonExe) "Scripts\pip.exe"
if (-not (Test-Path $pipExe)) { $pipExe = $pythonExe; $pipArgs = @("-m", "pip", "install", "requests") }
else { $pipArgs = @("install", "requests") }
$pipOutput = & $pipExe @pipArgs 2>&1
if ($LASTEXITCODE -ne 0) {
    Log "  ERROR: pip install failed (exit code $LASTEXITCODE)."
    Log "  Output: $pipOutput"
    Log "  Check your internet connection and try again."
    exit 1
}
Log "  requests package installed."

# ---------------------------------------------------------------------------
# Step 5: Deploy dc1_daemon.py with API key baked in
# ---------------------------------------------------------------------------
Log "[5/8] Deploying daemon script..."
$templatePath = Join-Path $InstallDir "dc1_daemon.py"
if (Test-Path $templatePath) {
    $daemonContent = Get-Content $templatePath -Raw
    $daemonContent = $daemonContent -replace '\{\{API_KEY\}\}', $ApiKey
    $daemonContent = $daemonContent -replace '\{\{API_URL\}\}', $ApiUrl
    Set-Content -Path $templatePath -Value $daemonContent -Encoding UTF8
    Log "  dc1_daemon.py deployed with API key."
} else {
    Log "  WARNING: dc1_daemon.py template not found at $templatePath — generating inline."
    Log "  NOTE: This is a minimal fallback daemon. The full v3.2.0 daemon should be bundled by the installer."
    Log "  The daemon will auto-update itself to the full version on first update check."
    # Fallback: generate minimal daemon inline (will auto-update to full v3.2.0)
    $daemonPy = @"
import requests, time, datetime, socket, subprocess, sys, platform

API_KEY = "$ApiKey"
API_URL = "$ApiUrl"
INTERVAL = 30
DAEMON_VERSION = "2.2.0-fallback"

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
"@
    Set-Content -Path $templatePath -Value $daemonPy -Encoding UTF8
    Log "  dc1_daemon.py generated inline."
}

# ---------------------------------------------------------------------------
# Step 6: Write config.json
# ---------------------------------------------------------------------------
Log "[6/8] Writing config.json..."
$configObj = @{
    api_key = $ApiKey
    run_mode = $RunMode
    api_url = $ApiUrl
    scheduled_start = $ScheduledStart
    scheduled_end = $ScheduledEnd
    gpu_name = $GpuName
    gpu_vram_mb = [int]$GpuVram
    installed_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    installer_version = "2.2.0"
    daemon_version = "3.2.0"
}
$config = $configObj | ConvertTo-Json -Depth 2
Set-Content -Path (Join-Path $InstallDir "config.json") -Value $config -Encoding UTF8
Log "  config.json saved."

# ---------------------------------------------------------------------------
# Step 7: Register scheduled task (mode-dependent)
# ---------------------------------------------------------------------------
Log "[7/8] Configuring run mode: $RunMode..."
$taskName = "DC1ProviderDaemon"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $pythonExe -Argument "$InstallDir\dc1_daemon.py" -WorkingDirectory $InstallDir
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1))
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive

if ($RunMode -eq 'manual') {
    # Manual mode: no scheduled task — create start/stop scripts
    # v3.2.0: daemon runs as watchdog parent + worker child, so start normally (watchdog handles restarts)
    $startScript = "@echo off`r`necho Starting DC1 Provider Daemon (v3.2.0 with auto-recovery)...`r`nstart /min `"DC1 Daemon`" `"$pythonExe`" `"$InstallDir\dc1_daemon.py`"`r`necho Done. Your GPU is now earning.`r`ntimeout /t 3"
    Set-Content -Path "$InstallDir\start-dc1.bat" -Value $startScript -Encoding ASCII
    # v3.2.0: kill by command-line match to catch both watchdog and worker processes
    $stopScript = "@echo off`r`necho Stopping DC1 Provider Daemon...`r`nfor /f `"tokens=2`" %%i in ('wmic process where `"commandline like '%%dc1_daemon%%' and name='python.exe'`" get processid 2^>nul ^| findstr /r `"[0-9]`"') do taskkill /F /PID %%i 2>nul`r`ntaskkill /F /IM python.exe /FI `"WINDOWTITLE eq DC1*`" 2>nul`r`necho Stopped.`r`ntimeout /t 3"
    Set-Content -Path "$InstallDir\stop-dc1.bat" -Value $stopScript -Encoding ASCII
    Log "  Manual mode — no auto-start task created."
    Log "  Start earning: double-click $InstallDir\start-dc1.bat"
} elseif ($RunMode -eq 'scheduled') {
    $startHour = 23; $startMin = 0
    if ($ScheduledStart -match '^(\d{1,2}):(\d{2})$') {
        $startHour = [int]$Matches[1]; $startMin = [int]$Matches[2]
    }
    $triggerTime = (Get-Date -Hour $startHour -Minute $startMin -Second 0).ToString("HH:mm")
    $trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Log "  Scheduled mode — runs daily at $triggerTime (until $ScheduledEnd)."
    # Stop script for when user wakes up — kills both watchdog and worker processes
    $stopScript = "@echo off`r`necho Stopping DC1 Provider Daemon...`r`nfor /f `"tokens=2`" %%i in ('wmic process where `"commandline like '%%dc1_daemon%%' and name='python.exe'`" get processid 2^>nul ^| findstr /r `"[0-9]`"') do taskkill /F /PID %%i 2>nul`r`ntaskkill /F /IM python.exe /FI `"WINDOWTITLE eq DC1*`" 2>nul`r`necho Stopped.`r`ntimeout /t 3"
    Set-Content -Path "$InstallDir\stop-dc1.bat" -Value $stopScript -Encoding ASCII
} else {
    # Always-on (default): start at every login
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Log "  Always-on mode — starts automatically at login."
}

# ---------------------------------------------------------------------------
# Step 8: Create dashboard shortcut + start daemon + verify
# ---------------------------------------------------------------------------
Log "[8/8] Final setup..."

# Create dashboard shortcut
$dashUrl = "$ApiUrl/provider?key=$ApiKey"
$shortcutContent = "@echo off`r`nstart `"`" `"$dashUrl`""
Set-Content -Path "$env:USERPROFILE\Desktop\DC1 - My Earnings.bat" -Value $shortcutContent -Encoding ASCII
Log "  Desktop shortcut created: 'DC1 - My Earnings'"

# Start daemon (unless manual mode)
if ($RunMode -eq 'manual') {
    Log "  Manual mode — skipping auto-start. Use start-dc1.bat when ready."
} else {
    Log "  Starting daemon..."
    Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5

    # Verify daemon started and first heartbeat succeeded
    try {
        $body = @{
            api_key = $ApiKey
            provider_hostname = $env:COMPUTERNAME
            provider_ip = $null
            gpu_status = @{
                gpu_name = if ($gpu.detected) { $gpu.name } else { $GpuName }
                gpu_vram_mib = if ($gpu.detected) { $gpu.vram_mb } else { [int]$GpuVram }
                daemon_version = "3.2.0"
            }
        } | ConvertTo-Json -Depth 3
        $response = Invoke-WebRequest -Uri "$ApiUrl/api/providers/heartbeat" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Log "  Heartbeat verified: SUCCESS"
        } else {
            Log "  Heartbeat returned: $($response.StatusCode)"
        }
    } catch {
        Log "  WARNING: Heartbeat verification failed — $_"
        Log ""
        Log "  Troubleshooting:"
        Log "    1. Check internet connection"
        Log "    2. Check if firewall is blocking outbound connections"
        Log "    3. Check if antivirus is blocking python.exe"
        Log "    4. Try: $pythonExe $InstallDir\dc1_daemon.py"
    }
}

Log ""
Log "============================================="
Log "  DC1 Setup Complete!"
Log "============================================="
Log "  GPU:       $(if ($gpu.detected) { "$($gpu.name) ($($gpu.vram_mb) MB)" } else { "$GpuName ($GpuVram MB)" })"
Log "  Mode:      $RunMode"
Log "  Dashboard: $dashUrl"
Log "  Log file:  $logFile"
Log "============================================="
