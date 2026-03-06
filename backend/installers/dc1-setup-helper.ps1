# =============================================================================
# DC1 Provider Daemon — Setup Helper
# Called by the NSIS installer with user selections from the GUI pages.
# =============================================================================
param(
    [Parameter(Mandatory=$true)] [string]$ApiKey,
    [string]$RunMode = "always-on",
    [string]$ScheduledStart = "23:00",
    [string]$ScheduledEnd = "07:00",
    [string]$ApiUrl = "$($env:DC1_API_URL ?? 'http://76.13.179.86:8083')",
    [string]$InstallDir = "$env:LOCALAPPDATA\dc1-provider"
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

Log "=== DC1 Provider Setup Helper ==="
Log "ApiKey:   $($ApiKey.Substring(0, [Math]::Min(20, $ApiKey.Length)))..."
Log "RunMode:  $RunMode"
Log "InstallDir: $InstallDir"

# Ensure install directory exists
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# ---------------------------------------------------------------------------
# Step 1: Find or install Python
# ---------------------------------------------------------------------------
Log "[1/7] Checking Python..."

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
    Log "  Python not found. Installing Python 3.12..."
    $installerUrl = "https://www.python.org/ftp/python/3.12.4/python-3.12.4-amd64.exe"
    $installerPath = "$env:TEMP\python-3.12.4-amd64.exe"
    try {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
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
    Log "  Found Python: $pythonExe"
}

# ---------------------------------------------------------------------------
# Step 2: Install requests via pip
# ---------------------------------------------------------------------------
Log "[2/7] Installing Python requests..."
$pipExe = Join-Path (Split-Path $pythonExe) "Scripts\pip.exe"
if (-not (Test-Path $pipExe)) { $pipExe = $pythonExe; $pipArgs = @("-m", "pip", "install", "requests") }
else { $pipArgs = @("install", "requests") }
& $pipExe @pipArgs 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Log "  ERROR: pip install failed (exit code $LASTEXITCODE). Check your internet connection."
    exit 1
}
Log "  requests installed."

# ---------------------------------------------------------------------------
# Step 3: Deploy dc1_daemon.py with API key baked in
# ---------------------------------------------------------------------------
Log "[3/7] Deploying daemon script..."
$templatePath = Join-Path $InstallDir "dc1_daemon.py"
if (Test-Path $templatePath) {
    $daemonContent = Get-Content $templatePath -Raw
    $daemonContent = $daemonContent -replace '\{\{API_KEY\}\}', $ApiKey
    $daemonContent = $daemonContent -replace '\{\{API_URL\}\}', $ApiUrl
    Set-Content -Path $templatePath -Value $daemonContent -Encoding UTF8
    Log "  dc1_daemon.py deployed with API key."
} else {
    Log "  WARNING: dc1_daemon.py template not found at $templatePath — generating inline."
    # Fallback: generate daemon inline (same code as dc1_daemon.py template)
    $daemonPy = @"
import requests, time, datetime, socket, subprocess, sys, platform

API_KEY = "$ApiKey"
API_URL = "$ApiUrl"
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
"@
    Set-Content -Path $templatePath -Value $daemonPy -Encoding UTF8
    Log "  dc1_daemon.py generated inline."
}

# ---------------------------------------------------------------------------
# Step 4: Write config.json
# ---------------------------------------------------------------------------
Log "[4/7] Writing config.json..."
$config = @{ api_key = $ApiKey; run_mode = $RunMode; api_url = $ApiUrl } | ConvertTo-Json
Set-Content -Path (Join-Path $InstallDir "config.json") -Value $config -Encoding UTF8
Log "  config.json saved."

# ---------------------------------------------------------------------------
# Step 5: Register scheduled task (mode-dependent)
# ---------------------------------------------------------------------------
Log "[5/7] Configuring run mode: $RunMode..."
$taskName = "DC1ProviderDaemon"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $pythonExe -Argument "$InstallDir\dc1_daemon.py" -WorkingDirectory $InstallDir
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1))
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive

if ($RunMode -eq 'manual') {
    # Manual mode: no scheduled task — create start/stop scripts
    $startScript = "@echo off`r`necho Starting DC1 Provider Daemon...`r`nstart /min `"$pythonExe`" `"$InstallDir\dc1_daemon.py`"`r`necho Done. Check your dashboard.`r`ntimeout /t 3"
    Set-Content -Path "$InstallDir\start-dc1.bat" -Value $startScript -Encoding ASCII
    $stopScript = "@echo off`r`necho Stopping DC1 Provider Daemon...`r`ntaskkill /F /IM python.exe /FI `"WINDOWTITLE eq dc1_daemon*`" 2>nul`r`necho Stopped.`r`ntimeout /t 3"
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
    Log "  Scheduled mode — runs daily at $triggerTime."
    # Stop script for when user wakes up
    $stopScript = "@echo off`r`necho Stopping DC1 Provider Daemon...`r`ntaskkill /F /IM python.exe 2>nul`r`necho Stopped.`r`ntimeout /t 3"
    Set-Content -Path "$InstallDir\stop-dc1.bat" -Value $stopScript -Encoding ASCII
} else {
    # Always-on (default): start at every login
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Log "  Always-on mode — starts automatically at login."
}

# ---------------------------------------------------------------------------
# Step 6: Create dashboard shortcut on Desktop
# ---------------------------------------------------------------------------
Log "[6/7] Creating desktop shortcut..."
$dashUrl = "$ApiUrl/provider?key=$ApiKey"
$shortcutContent = "@echo off`r`nstart `"`" `"$dashUrl`""
Set-Content -Path "$env:USERPROFILE\Desktop\DC1 - My Earnings.bat" -Value $shortcutContent -Encoding ASCII
Log "  Desktop shortcut created: 'DC1 - My Earnings'"

# ---------------------------------------------------------------------------
# Step 7: Start daemon + test heartbeat
# ---------------------------------------------------------------------------
Log "[7/7] Starting daemon and testing heartbeat..."
if ($RunMode -eq 'manual') {
    Log "  Manual mode — skipping auto-start. Use start-dc1.bat when ready."
} elseif ($RunMode -eq 'scheduled') {
    Log "  Scheduled mode — daemon will start at scheduled time. Starting once now for verification..."
    Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
} else {
    Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
    Log "  Daemon started."
}

# Test heartbeat
try {
    $body = @{
        api_key = $ApiKey
        provider_hostname = $env:COMPUTERNAME
        provider_ip = $null
        gpu_status = @{ gpu_name = "test"; gpu_vram_mib = 0 }
    } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/providers/heartbeat" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Log "  Heartbeat test: SUCCESS (200)"
    } else {
        Log "  Heartbeat test: Unexpected status $($response.StatusCode)"
    }
} catch {
    Log "  Heartbeat test: FAILED — $_"
    Log "  The daemon is installed but could not reach the API. Check connectivity."
}

Log "=== Setup complete ==="
