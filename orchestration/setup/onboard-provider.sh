#!/usr/bin/env bash
# =============================================================================
# DC1 Provider Onboarding Script
# =============================================================================
# Configures a new GPU provider machine via SSH from the DC1 server.
#
# Usage: ./onboard-provider.sh <provider_ip> <ssh_user> [gpu_name]
# Example: ./onboard-provider.sh 192.168.1.100 dc1user
#          ./onboard-provider.sh 192.168.1.100 dc1user "RTX 3090"  # override name
# GPU name is AUTO-DETECTED via nvidia-smi if not provided.
# =============================================================================

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# --- Config ---
MC_API_BASE="${MC_API_BASE:-http://76.13.179.86:8084/api}"
MC_API_TOKEN="${MC_API_TOKEN:-dc1-mc-gate0-2026}"
DC1_SERVER_IP="${DC1_SERVER_IP:-$(curl -s ifconfig.me)}"
DC1_AGENT_SECRET="${DC1_AGENT_SECRET:-$(openssl rand -hex 16)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/provider-setup.log"

# --- Args ---
if [ $# -lt 2 ]; then
    echo -e "${RED}Usage: $0 <provider_ip> <ssh_user> [gpu_name]${NC}"
    echo -e "${BLUE}       GPU name is auto-detected via nvidia-smi if not provided.${NC}"
    exit 1
fi

PROVIDER_IP="$1"
SSH_USER="$2"
GPU_NAME="${3:-}"  # Optional — auto-detected below if empty
SSH_CMD="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new ${SSH_USER}@${PROVIDER_IP}"

# --- Logging ---
exec > >(tee -a "$LOG_FILE") 2>&1
echo "=========================================="
echo "DC1 Provider Onboarding — $(date -u)"
echo "Provider: ${SSH_USER}@${PROVIDER_IP} (${GPU_NAME})"
echo "=========================================="

step_pass() { echo -e "  ${GREEN}✅ PASS${NC}: $1"; }
step_fail() { echo -e "  ${RED}❌ FAIL${NC}: $1"; }
step_info() { echo -e "  ${BLUE}ℹ️  INFO${NC}: $1"; }

# ---------------------------------------------------------------------------
# 1. Pre-flight checks
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/6] Pre-flight checks${NC}"

# SSH connectivity
if $SSH_CMD "echo ok" &>/dev/null; then
    step_pass "SSH connectivity"
else
    step_fail "Cannot SSH to ${PROVIDER_IP}"
    exit 1
fi

# GPU accessible — auto-detect name and VRAM
GPU_INFO=$($SSH_CMD "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader" 2>/dev/null || echo "")
if [ -n "$GPU_INFO" ]; then
    # Auto-detect GPU name if not provided as argument
    if [ -z "$GPU_NAME" ]; then
        GPU_NAME=$(echo "$GPU_INFO" | head -1 | awk -F',' '{print $1}' | xargs)
        step_pass "GPU auto-detected: $GPU_INFO"
        step_info "Using GPU name: '${GPU_NAME}'"
    else
        step_pass "GPU detected: $GPU_INFO (name override: '${GPU_NAME}')"
    fi
else
    step_fail "nvidia-smi not found or no GPU detected"
    exit 1
fi

# OS version
OS_VERSION=$($SSH_CMD "lsb_release -rs 2>/dev/null || cat /etc/os-release | grep VERSION_ID | cut -d= -f2 | tr -d '\"'" 2>/dev/null)
OS_MAJOR=$(echo "$OS_VERSION" | cut -d. -f1)
if [ "$OS_MAJOR" -ge 20 ] 2>/dev/null; then
    step_pass "OS version: Ubuntu $OS_VERSION"
else
    step_fail "Ubuntu 20.04+ required, got: $OS_VERSION"
    exit 1
fi

# Disk space
FREE_GB=$($SSH_CMD "df -BG / | tail -1 | awk '{print \$4}' | tr -d 'G'")
if [ "$FREE_GB" -ge 20 ] 2>/dev/null; then
    step_pass "Disk space: ${FREE_GB}GB free"
else
    step_fail "Need 20GB+ free disk, got ${FREE_GB}GB"
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Install dependencies
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/6] Installing dependencies${NC}"

$SSH_CMD "sudo apt-get update -qq && sudo apt-get install -y -qq curl wget git python3 python3-pip" &>/dev/null
step_pass "curl, wget, git, python3 installed"

# ---------------------------------------------------------------------------
# 3. Install Docker + nvidia-docker2
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/6] Installing Docker + nvidia-docker2${NC}"

$SSH_CMD bash <<'DOCKER_INSTALL'
set -e
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi
# nvidia-container-toolkit
if ! dpkg -l | grep -q nvidia-container-toolkit; then
    distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list > /dev/null
    sudo apt-get update -qq && sudo apt-get install -y -qq nvidia-container-toolkit
    sudo nvidia-ctk runtime configure --runtime=docker
fi
# C4 FIX: Set Docker default network to 'none' so all job containers are network-isolated
# by default. Host firewall (UFW) is NOT sufficient — Docker bypasses iptables rules.
# Any container that needs network access must explicitly pass --network=bridge.
sudo tee /etc/docker/daemon.json > /dev/null <<'DAEMON_JSON'
{
  "default-network": "none",
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
DAEMON_JSON
sudo systemctl restart docker
DOCKER_INSTALL
step_pass "Docker + nvidia-container-toolkit (default network=none enforced)"

# ---------------------------------------------------------------------------
# 4. Install DC1 monitoring agent
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/6] Installing DC1 monitoring agent${NC}"

# Copy agent script
scp -o StrictHostKeyChecking=accept-new "${SCRIPT_DIR}/dc1-monitoring-agent.py" "${SSH_USER}@${PROVIDER_IP}:/opt/dc1-monitoring-agent.py" 2>/dev/null || \
    $SSH_CMD "sudo mkdir -p /opt && cat > /opt/dc1-monitoring-agent.py" < "${SCRIPT_DIR}/dc1-monitoring-agent.py"

# Install python deps + create systemd service
$SSH_CMD bash <<AGENT_SETUP
set -e
sudo pip3 install requests 2>/dev/null || pip3 install requests
sudo tee /etc/systemd/system/dc1-agent.service > /dev/null <<EOF
[Unit]
Description=DC1 GPU Monitoring Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/dc1-monitoring-agent.py
Environment=DC1_SERVER_URL=${MC_API_BASE}
Environment=DC1_AGENT_SECRET=${DC1_AGENT_SECRET}
Environment=GPU_ID=$(echo "${GPU_NAME}" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable dc1-agent
sudo systemctl start dc1-agent
AGENT_SETUP
step_pass "DC1 monitoring agent installed and running"

# ---------------------------------------------------------------------------
# 5. Configure firewall
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/6] Configuring firewall${NC}"

$SSH_CMD bash <<FIREWALL
set -e
sudo ufw --force reset > /dev/null
sudo ufw default deny incoming
sudo ufw default deny outgoing
# Allow SSH only from DC1 server
sudo ufw allow from ${DC1_SERVER_IP} to any port 22
# Allow agent port from DC1 server
sudo ufw allow from ${DC1_SERVER_IP} to any port 8085
# Allow outbound to DC1 server only (for heartbeats)
sudo ufw allow out to ${DC1_SERVER_IP}
# Allow DNS resolution
sudo ufw allow out 53
sudo ufw --force enable
FIREWALL
step_pass "Firewall configured (SSH + agent from DC1 only)"

# ---------------------------------------------------------------------------
# 6. Register with Mission Control
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[6/6] Registering with Mission Control${NC}"

# Parse GPU specs
GPU_MEM=$($SSH_CMD "nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits" 2>/dev/null | head -1 | tr -d ' ')
GPU_DRIVER=$($SSH_CMD "nvidia-smi --query-gpu=driver_version --format=csv,noheader" 2>/dev/null | head -1 | tr -d ' ')

REGISTER_RESPONSE=$(curl -s -X POST "${MC_API_BASE}/providers" \
    -H "Authorization: Bearer ${MC_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"ip\": \"${PROVIDER_IP}\",
        \"ssh_user\": \"${SSH_USER}\",
        \"gpu_name\": \"${GPU_NAME}\",
        \"gpu_memory_mb\": ${GPU_MEM:-0},
        \"driver_version\": \"${GPU_DRIVER}\",
        \"agent_port\": 8085,
        \"agent_secret\": \"${DC1_AGENT_SECRET}\",
        \"status\": \"online\"
    }")

if echo "$REGISTER_RESPONSE" | grep -q "id\|provider_id\|success"; then
    step_pass "Registered with Mission Control"
else
    step_info "MC registration response: $REGISTER_RESPONSE"
fi

# Test healthcheck
if curl -s --connect-timeout 5 "http://${PROVIDER_IP}:8085/" | grep -q "online"; then
    step_pass "Agent healthcheck confirmed"
else
    step_info "Agent may need a moment to start — verify manually"
fi

echo -e "\n${GREEN}=========================================="
echo "✅ Provider onboarding complete!"
echo "   IP: ${PROVIDER_IP}"
echo "   GPU: ${GPU_NAME}"
echo "   Agent secret: ${DC1_AGENT_SECRET}"
echo -e "==========================================${NC}"
