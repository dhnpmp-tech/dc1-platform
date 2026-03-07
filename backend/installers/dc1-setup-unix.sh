#!/bin/bash
# DC1 Provider Setup — Linux/Mac
# Downloads and installs the DC1 daemon as a background service.
#
# Usage:
#   curl -sL http://HOST/api/providers/download/setup?key=YOUR_KEY&os=linux | bash

set -e

DC1_API_KEY="INJECT_KEY_HERE"
DC1_API_URL="INJECT_URL_HERE"
INSTALL_DIR="/opt/dc1-provider"
LOG_DIR="$HOME/dc1-provider/logs"

echo "============================================"
echo "  DC1 Provider Daemon Installer"
echo "  GPU Compute Marketplace — Saudi Arabia"
echo "============================================"
echo ""

# Check for root/sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "[!] This script needs sudo for service installation."
    echo "    Re-running with sudo..."
    exec sudo bash "$0" "$@"
fi

# Check Python 3
echo "[1/6] Checking Python 3..."
if command -v python3 &>/dev/null; then
    PY=$(python3 --version 2>&1)
    echo "  Found: $PY"
else
    echo "  Python 3 not found. Installing..."
    if command -v apt-get &>/dev/null; then
        apt-get update -qq && apt-get install -y -qq python3 python3-pip
    elif command -v yum &>/dev/null; then
        yum install -y python3 python3-pip
    elif command -v brew &>/dev/null; then
        brew install python3
    else
        echo "  [ERROR] Cannot install Python 3. Please install manually."
        exit 1
    fi
fi

# Install pip dependencies
echo "[2/6] Installing Python packages..."
pip3 install --quiet requests psutil 2>/dev/null || python3 -m pip install --quiet requests psutil 2>/dev/null || true

# Check for PyTorch (optional — needed for GPU benchmarks)
echo "[3/6] Checking PyTorch..."
if python3 -c "import torch" 2>/dev/null; then
    echo "  PyTorch found."
else
    echo "  PyTorch not found. Installing (this may take a few minutes)..."
    pip3 install --quiet torch --index-url https://download.pytorch.org/whl/cu121 2>/dev/null || \
    pip3 install --quiet torch 2>/dev/null || \
    echo "  [WARN] PyTorch install failed — GPU benchmarks won't work. Install manually: pip3 install torch"
fi

# Download daemon
echo "[4/6] Downloading DC1 daemon..."
mkdir -p "$INSTALL_DIR" "$LOG_DIR"
curl -sL "${DC1_API_URL}/api/providers/download/daemon?key=${DC1_API_KEY}" -o "${INSTALL_DIR}/dc1-daemon.py"
chmod +x "${INSTALL_DIR}/dc1-daemon.py"
echo "  Installed to ${INSTALL_DIR}/dc1-daemon.py"

# Create config
cat > "${INSTALL_DIR}/config.json" << CONF
{
  "api_key": "${DC1_API_KEY}",
  "api_url": "${DC1_API_URL}",
  "daemon_version": "1.0.0"
}
CONF

# Create systemd service (Linux) or launchd plist (Mac)
echo "[5/6] Creating background service..."

if [ "$(uname)" = "Linux" ] && command -v systemctl &>/dev/null; then
    cat > /etc/systemd/system/dc1-provider.service << SVC
[Unit]
Description=DC1 Provider Daemon
After=network.target

[Service]
Type=simple
User=$(logname 2>/dev/null || echo root)
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/dc1-daemon.py --key ${DC1_API_KEY} --url ${DC1_API_URL}
Restart=always
RestartSec=10
Environment=HOME=$(eval echo ~$(logname 2>/dev/null || echo root))

[Install]
WantedBy=multi-user.target
SVC

    systemctl daemon-reload
    systemctl enable dc1-provider
    systemctl start dc1-provider
    echo "  systemd service created and started."

elif [ "$(uname)" = "Darwin" ]; then
    PLIST_PATH="$HOME/Library/LaunchAgents/com.dc1.provider.plist"
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.dc1.provider</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>${INSTALL_DIR}/dc1-daemon.py</string>
        <string>--key</string><string>${DC1_API_KEY}</string>
        <string>--url</string><string>${DC1_API_URL}</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>${LOG_DIR}/daemon.log</string>
    <key>StandardErrorPath</key><string>${LOG_DIR}/daemon-error.log</string>
</dict>
</plist>
PLIST
    launchctl load "$PLIST_PATH" 2>/dev/null || true
    echo "  launchd agent created and loaded."
else
    echo "  [WARN] No service manager found. Run manually:"
    echo "    python3 ${INSTALL_DIR}/dc1-daemon.py --key ${DC1_API_KEY} --url ${DC1_API_URL}"
fi

# Status check
echo "[6/6] Verifying..."
sleep 3
echo ""
echo "============================================"
echo "  DC1 Provider Daemon — INSTALLED"
echo "============================================"
echo "  Daemon: ${INSTALL_DIR}/dc1-daemon.py"
echo "  Logs:   ${LOG_DIR}/daemon.log"
echo "  Key:    ${DC1_API_KEY:0:20}..."
echo ""
echo "  Check status:"
echo "    Linux:  systemctl status dc1-provider"
echo "    Mac:    launchctl list | grep dc1"
echo "    Logs:   tail -f ${LOG_DIR}/daemon.log"
echo ""
echo "  Dashboard: ${DC1_API_URL}/api/providers/status/${DC1_API_KEY}"
echo "============================================"
