if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Docker Desktop..."
    $url = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    $installer = "$env:TEMP\DockerInstaller.exe"
    Invoke-WebRequest -Uri $url -OutFile $installer
    Start-Process $installer -ArgumentList "install --quiet" -Wait
    Remove-Item $installer
}
