# DC1 Provider Setup — Windows
# Downloads and installs the DC1 daemon as a scheduled task.
#
# Usage:
#   powershell -c "irm http://HOST/api/providers/download/setup?key=KEY&os=windows | iex"

$ErrorActionPreference = "Stop"

$DC1_API_KEY = "INJECT_KEY_HERE"
$DC1_API_URL = "INJECT_URL_HERE"
$INSTALL_DIR = "$env:LOCALAPPDATA\DC1Provider"
$LOG_DIR = "$env:USERPROFILE\dc1-provider\logs"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DC1 Provider Daemon Installer (Windows)" -ForegroundColor Cyan
Write-Host "  GPU Compute Marketplace — Saudi Arabia" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Python
Write-Host "[1/6] Checking Python 3..." -ForegroundColor Yellow
$python = $null
foreach ($cmd in @("python3", "python", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3") {
            $python = $cmd
            Write-Host "  Found: $ver"
            break
        }
    } catch {}
}

if (-not $python) {
    Write-Host "  Python 3 not found. Attempting install via winget..." -ForegroundColor Yellow
    try {
        winget install Python.Python.3.11 --accept-source-agreements --accept-package-agreements -s winget
        $python = "python"
        Write-Host "  Python installed. You may need to restart your terminal." -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Cannot install Python. Download from https://python.org" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Install pip packages
Write-Host "[2/6] Installing Python packages..." -ForegroundColor Yellow
& $python -m pip install --quiet requests psutil 2>$null

# Step 3: Check PyTorch
Write-Host "[3/6] Checking PyTorch..." -ForegroundColor Yellow
$hasTorch = & $python -c "import torch; print('ok')" 2>$null
if ($hasTorch -eq "ok") {
    Write-Host "  PyTorch found."
} else {
    Write-Host "  Installing PyTorch (this may take a few minutes)..." -ForegroundColor Yellow
    & $python -m pip install --quiet torch --index-url https://download.pytorch.org/whl/cu121 2>$null
    if ($LASTEXITCODE -ne 0) {
        & $python -m pip install --quiet torch 2>$null
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [WARN] PyTorch install failed. GPU benchmarks won't work." -ForegroundColor Yellow
        Write-Host "  Install manually: pip install torch" -ForegroundColor Yellow
    }
}

# Step 4: Download daemon
Write-Host "[4/6] Downloading DC1 daemon..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null

$daemonUrl = "$DC1_API_URL/api/providers/download/daemon?key=$DC1_API_KEY"
Invoke-WebRequest -Uri $daemonUrl -OutFile "$INSTALL_DIR\dc1-daemon.py" -UseBasicParsing
Write-Host "  Installed to $INSTALL_DIR\dc1-daemon.py"

# Save config
$config = @{
    api_key = $DC1_API_KEY
    api_url = $DC1_API_URL
    daemon_version = "1.0.0"
} | ConvertTo-Json
$config | Out-File "$INSTALL_DIR\config.json" -Encoding UTF8

# Step 5: Create scheduled task
Write-Host "[5/6] Creating Windows scheduled task..." -ForegroundColor Yellow

$taskName = "DC1 Provider Daemon"
$taskAction = New-ScheduledTaskAction `
    -Execute $python `
    -Argument "$INSTALL_DIR\dc1-daemon.py --key $DC1_API_KEY --url $DC1_API_URL" `
    -WorkingDirectory $INSTALL_DIR

$taskTrigger = New-ScheduledTaskTrigger -AtLogon
$taskSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $taskAction `
    -Trigger $taskTrigger `
    -Settings $taskSettings `
    -Description "DC1 GPU compute provider daemon" `
    -RunLevel Limited

Write-Host "  Scheduled task '$taskName' created."

# Step 6: Start daemon now
Write-Host "[6/6] Starting daemon..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DC1 Provider Daemon — INSTALLED" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Daemon: $INSTALL_DIR\dc1-daemon.py"
Write-Host "  Logs:   $LOG_DIR\daemon.log"
Write-Host "  Key:    $($DC1_API_KEY.Substring(0,20))..."
Write-Host ""
Write-Host "  Check status:"
Write-Host "    Get-ScheduledTask -TaskName '$taskName'"
Write-Host "    Get-Content $LOG_DIR\daemon.log -Tail 20"
Write-Host ""
Write-Host "  Dashboard: $DC1_API_URL/api/providers/status/$DC1_API_KEY"
Write-Host "============================================" -ForegroundColor Green
