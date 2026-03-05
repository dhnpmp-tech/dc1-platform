# DC1 Provider Daemon Installer for Windows
# Usage: iwr http://76.13.179.86:8083/api/providers/setup-windows?key=YOUR_KEY -UseBasicParsing | iex
$ErrorActionPreference = "Continue"
$API_KEY = "INJECTED_API_KEY"
$API_URL = "http://76.13.179.86:8083"
$INSTALL_DIR = "$env:LOCALAPPDATA\dc1-provider"

Write-Host "`n=== DC1 Provider Daemon Installer ===" -ForegroundColor Cyan
Write-Host "API Key: $($API_KEY.Substring(0,20))..." -ForegroundColor Gray

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
import requests, time, datetime, socket, subprocess, sys

API_KEY = "$API_KEY"
API_URL = "$API_URL"
INTERVAL = 30

def get_gpu_info():
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(", ")
            return {"gpu_name": parts[0], "gpu_vram_mib": int(parts[1]) if len(parts) > 1 else 0, "driver_version": parts[2] if len(parts) > 2 else "unknown"}
    except Exception:
        pass
    return {"gpu_name": "unknown", "gpu_vram_mib": 0}

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

print("DC1 Provider Daemon starting...")
send_heartbeat()
while True:
    time.sleep(INTERVAL)
    send_heartbeat()
"@

Set-Content -Path "$INSTALL_DIR\dc1_daemon.py" -Value $daemonPy -Encoding UTF8
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

# --- Step 4: Create scheduled task ---
Write-Host "[4/6] Creating scheduled task..." -ForegroundColor Yellow
$taskName = "DC1ProviderDaemon"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $pythonExe -Argument "$INSTALL_DIR\dc1_daemon.py" -WorkingDirectory $INSTALL_DIR
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1))
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
Write-Host "  Scheduled task '$taskName' created." -ForegroundColor Green

# --- Step 5: Start the task ---
Write-Host "[5/6] Starting daemon..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 5
Write-Host "  Daemon started." -ForegroundColor Green

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
        Write-Host "  DC1 Provider Daemon installed and online!" -ForegroundColor Green
        Write-Host "==============================================" -ForegroundColor Green
        Write-Host "  Install dir: $INSTALL_DIR"
        Write-Host "  Task name:   $taskName"
        Write-Host "  Python:      $pythonExe"
        Write-Host "  The daemon sends heartbeats every 30 seconds.`n"
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
