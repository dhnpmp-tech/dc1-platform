# DC1 Provider Daemon — Uninstall Helper
# Called by the NSIS uninstaller to clean up scheduled tasks and shortcuts.

$taskName = "DC1ProviderDaemon"

# Stop the daemon if running
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

# Remove the scheduled task
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Remove desktop shortcut
Remove-Item "$env:USERPROFILE\Desktop\DC1 - My Earnings.bat" -ErrorAction SilentlyContinue

# Remove start/stop scripts if they exist
$installDir = "$env:LOCALAPPDATA\dc1-provider"
Remove-Item "$installDir\start-dc1.bat" -ErrorAction SilentlyContinue
Remove-Item "$installDir\stop-dc1.bat" -ErrorAction SilentlyContinue

Write-Host "DC1 Provider Daemon uninstalled."
