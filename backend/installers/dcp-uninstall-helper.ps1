# =============================================================================
# DCP Provider Daemon — Uninstall Helper v2.2
# Called by the NSIS uninstaller to clean up everything.
# Handles v3.2.0 watchdog (parent + child) process model.
# =============================================================================

$ErrorActionPreference = "Continue"
$taskName = "DCPProviderDaemon"
$installDir = "$env:LOCALAPPDATA\dcp-provider"

Write-Host "DCP Provider Daemon — Uninstalling..."

# 1. Kill any running daemon Python processes (v3.2.0: watchdog parent + worker child)
Write-Host "  Stopping daemon processes (watchdog + worker)..."
try {
    # First: kill by command-line match (catches both watchdog and --no-watchdog worker)
    Get-Process python*, python3* -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -match "dcp_daemon|dcp_daemon|dc1-daemon") {
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
                Write-Host "    Killed daemon process (PID $($_.Id)): $cmdLine"
            }
        } catch {}
    }

    # Fallback: kill by window title (for older daemon versions)
    & taskkill /F /IM python.exe /FI "WINDOWTITLE eq DCP*" 2>$null
    & taskkill /F /IM python.exe /FI "WINDOWTITLE eq dcp*" 2>$null
} catch {
    Write-Host "    Note: Could not stop some processes: $_"
}

# 2. Stop and remove the scheduled task
Write-Host "  Removing scheduled task..."
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# 3. Remove desktop shortcut
Write-Host "  Removing desktop shortcut..."
Remove-Item "$env:USERPROFILE\Desktop\DCP - My Earnings.bat" -ErrorAction SilentlyContinue

# 4. Remove start/stop scripts
Write-Host "  Removing helper scripts..."
Remove-Item "$installDir\start-dcp.bat" -ErrorAction SilentlyContinue
Remove-Item "$installDir\stop-dcp.bat" -ErrorAction SilentlyContinue

# 5. Remove config and logs
Write-Host "  Removing configuration and logs..."
Remove-Item "$installDir\config.json" -ErrorAction SilentlyContinue
Remove-Item "$installDir\install.log" -ErrorAction SilentlyContinue
Remove-Item "$installDir\daemon.log" -ErrorAction SilentlyContinue

# 5b. Remove v3.2.0 artifacts (logs dir, dedup file, event journal, backups)
Write-Host "  Removing v3.2.0 daemon artifacts..."
$dcpHome = "$env:USERPROFILE\dcp-provider"
if (Test-Path $dcpHome) {
    Remove-Item "$dcpHome\logs" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$dcpHome\seen_jobs.json" -Force -ErrorAction SilentlyContinue
    # Remove daemon backups (e.g. dcp_daemon.py.v4.0.0.bak, dcp_daemon.py.v3.5.0.bak)
    Get-ChildItem "$dcpHome\dcp_daemon.py.*.bak" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem "$dcpHome\dcp_daemon.py.*.bak" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    # Remove dcp-provider home dir if empty
    $remaining = Get-ChildItem $dcpHome -ErrorAction SilentlyContinue
    if (-not $remaining) { Remove-Item $dcpHome -Force -ErrorAction SilentlyContinue }
}

# 6. Remove daemon files
Write-Host "  Removing daemon files..."
Remove-Item "$installDir\dcp_daemon.py" -ErrorAction SilentlyContinue
Remove-Item "$installDir\dcp_daemon.py" -ErrorAction SilentlyContinue
Remove-Item "$installDir\dc1-daemon.py" -ErrorAction SilentlyContinue

# 7. Clean up any Docker containers/images with dc1 prefix (if Docker installed)
try {
    $dockerAvailable = & docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Cleaning DCP Docker resources..."
        # Stop and remove any dc1 containers
        $containers = & docker ps -a --filter "name=dcp-" --format "{{.ID}}" 2>$null
        if ($containers) {
            & docker rm -f $containers 2>$null
            Write-Host "    Removed DCP containers."
        }
        # Note: Not removing images by default (they're shared, large, and user may want them)
    }
} catch {}

# 8. Remove temp job files (from bare-metal execution)
Write-Host "  Cleaning temporary files..."
Get-ChildItem "$installDir\_dcp_*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "DCP Provider Daemon uninstalled successfully."
Write-Host "Thank you for being a DCP provider!"
