# =============================================================================
# DC1 Provider Daemon — Uninstall Helper v2.1
# Called by the NSIS uninstaller to clean up everything.
# =============================================================================

$ErrorActionPreference = "Continue"
$taskName = "DC1ProviderDaemon"
$installDir = "$env:LOCALAPPDATA\dc1-provider"

Write-Host "DC1 Provider Daemon — Uninstalling..."

# 1. Kill any running daemon Python processes
Write-Host "  Stopping daemon processes..."
try {
    # Kill by window title
    & taskkill /F /IM python.exe /FI "WINDOWTITLE eq DC1*" 2>$null
    & taskkill /F /IM python.exe /FI "WINDOWTITLE eq dc1*" 2>$null

    # Kill any Python process running dc1_daemon.py
    Get-Process python -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -match "dc1_daemon|dc1-daemon") {
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
                Write-Host "    Killed daemon process (PID $($_.Id))"
            }
        } catch {}
    }
} catch {
    Write-Host "    Note: Could not stop some processes: $_"
}

# 2. Stop and remove the scheduled task
Write-Host "  Removing scheduled task..."
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# 3. Remove desktop shortcut
Write-Host "  Removing desktop shortcut..."
Remove-Item "$env:USERPROFILE\Desktop\DC1 - My Earnings.bat" -ErrorAction SilentlyContinue

# 4. Remove start/stop scripts
Write-Host "  Removing helper scripts..."
Remove-Item "$installDir\start-dc1.bat" -ErrorAction SilentlyContinue
Remove-Item "$installDir\stop-dc1.bat" -ErrorAction SilentlyContinue

# 5. Remove config and logs
Write-Host "  Removing configuration and logs..."
Remove-Item "$installDir\config.json" -ErrorAction SilentlyContinue
Remove-Item "$installDir\install.log" -ErrorAction SilentlyContinue
Remove-Item "$installDir\daemon.log" -ErrorAction SilentlyContinue

# 6. Remove daemon files
Write-Host "  Removing daemon files..."
Remove-Item "$installDir\dc1_daemon.py" -ErrorAction SilentlyContinue
Remove-Item "$installDir\dc1-daemon.py" -ErrorAction SilentlyContinue

# 7. Clean up any Docker containers/images with dc1 prefix (if Docker installed)
try {
    $dockerAvailable = & docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Cleaning DC1 Docker resources..."
        # Stop and remove any dc1 containers
        $containers = & docker ps -a --filter "name=dc1-" --format "{{.ID}}" 2>$null
        if ($containers) {
            & docker rm -f $containers 2>$null
            Write-Host "    Removed DC1 containers."
        }
        # Note: Not removing images by default (they're shared, large, and user may want them)
    }
} catch {}

# 8. Remove temp job files (from bare-metal execution)
Write-Host "  Cleaning temporary files..."
Get-ChildItem "$installDir\_dc1_*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "DC1 Provider Daemon uninstalled successfully."
Write-Host "Thank you for being a DC1 provider!"
