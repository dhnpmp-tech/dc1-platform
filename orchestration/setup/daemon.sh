#!/usr/bin/env bash
# =============================================================================
# DC1 Provider Daemon — Self-Install & Auto-Registration
# =============================================================================
# Run on the provider's machine to auto-detect GPU specs and register with DC1.
#
# Usage:
#   bash <(curl -s "http://76.13.179.86:8083/providers/setup?key=YOUR_API_KEY")
#   -- or --
#   bash daemon.sh YOUR_API_KEY
# =============================================================================

set -euo pipefail

# --- Injected or provided API key ---
DC1_API_KEY="${1:-}"
DC1_API_BASE="${DC1_API_BASE:-http://76.13.179.86:8083}"
DC1_MC_BASE="${DC1_MC_BASE:-http://76.13.179.86:8084/api}"
DC1_MC_TOKEN="${DC1_MC_TOKEN:-dc1-mc-gate0-2026}"
AGENT_PORT="${AGENT_PORT:-8085}"

# --- Colors ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
step_pass() { echo -e "  ${GREEN}✅${NC} $1"; }
step_fail() { echo -e "  ${RED}❌${NC} $1"; exit 1; }
step_info() { echo -e "  ${BLUE}ℹ${NC}  $1"; }

echo -e "\n${YELLOW}===== DC1 Provider Setup =====${NC}"
echo -e "Started: $(date -u)\n"

# ---------------------------------------------------------------------------
# 0. Validate API key
# ---------------------------------------------------------------------------
if [ -z "$DC1_API_KEY" ]; then
  step_fail "No API key provided. Usage: bash daemon.sh YOUR_API_KEY"
fi
step_info "API key: ${DC1_API_KEY:0:8}..."

# ---------------------------------------------------------------------------
# 1. Auto-detect GPU specs via nvidia-smi
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Detecting hardware...${NC}"

if ! command -v nvidia-smi &>/dev/null; then
  step_fail "nvidia-smi not found. Install NVIDIA drivers first: https://docs.dc1.sa/providers/drivers"
fi

# Get all GPU details in one call
GPU_CSV=$(nvidia-smi \
  --query-gpu=index,name,memory.total,driver_version,compute_cap \
  --format=csv,noheader,nounits 2>/dev/null) \
  || step_fail "nvidia-smi failed — check NVIDIA driver installation"

if [ -z "$GPU_CSV" ]; then
  step_fail "No NVIDIA GPUs detected"
fi

# Parse first GPU (multi-GPU handled below)
GPU_INDEX=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $1}' | tr -d ' ')
GPU_NAME=$(echo "$GPU_CSV"  | head -1 | awk -F', ' '{print $2}' | xargs)
GPU_MEM_MIB=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $3}' | tr -d ' ')
DRIVER_VER=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $4}' | tr -d ' ')
COMPUTE_CAP=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $5}' | tr -d ' ')
GPU_COUNT=$(echo "$GPU_CSV" | wc -l | tr -d ' ')

# Validate minimum spec: 8 GB VRAM (8192 MiB)
if [ "$GPU_MEM_MIB" -lt 8192 ] 2>/dev/null; then
  step_fail "GPU has ${GPU_MEM_MIB} MiB VRAM — DC1 requires 8 GB minimum"
fi

step_pass "Detected ${GPU_COUNT} GPU(s): ${GPU_NAME} (${GPU_MEM_MIB} MiB VRAM)"
step_pass "Driver: ${DRIVER_VER} | Compute: ${COMPUTE_CAP}"

# Get public IP
PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || \
            curl -s --connect-timeout 5 api.ipify.org 2>/dev/null || \
            echo "unknown")
step_info "Public IP: ${PUBLIC_IP}"

# OS info
OS_ID=$(. /etc/os-release 2>/dev/null && echo "$ID $VERSION_ID" || echo "unknown")
step_info "OS: ${OS_ID}"

# Disk space (GB free)
DISK_FREE_GB=$(df -BG / | tail -1 | awk '{print $4}' | tr -d 'G')
step_info "Disk free: ${DISK_FREE_GB} GB"

# ---------------------------------------------------------------------------
# 2. Register with DC1
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/5] Registering with DC1...${NC}"

# Build JSON payload for all detected GPUs
GPU_JSON="[]"
while IFS=', ' read -r idx name mem_mib drv_ver cmp_cap; do
  name=$(echo "$name" | xargs)
  entry="{\"index\":${idx},\"name\":\"${name}\",\"vram_mib\":${mem_mib},\"driver\":\"${drv_ver}\",\"compute\":\"${cmp_cap}\"}"
  GPU_JSON=$(echo "$GPU_JSON" | python3 -c "
import sys,json
arr=json.load(sys.stdin)
arr.append(json.loads('${entry}'))
print(json.dumps(arr))
" 2>/dev/null || echo "[${entry}]")
done <<< "$GPU_CSV"

PAYLOAD=$(cat <<EOF
{
  "api_key": "${DC1_API_KEY}",
  "public_ip": "${PUBLIC_IP}",
  "agent_port": ${AGENT_PORT},
  "os": "${OS_ID}",
  "disk_free_gb": ${DISK_FREE_GB},
  "gpus": ${GPU_JSON},
  "primary_gpu": {
    "name": "${GPU_NAME}",
    "vram_mib": ${GPU_MEM_MIB},
    "driver": "${DRIVER_VER}",
    "compute": "${COMPUTE_CAP}",
    "count": ${GPU_COUNT}
  }
}
EOF
)

REGISTER_RESP=$(curl -s -X POST "${DC1_API_BASE}/providers/register" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>/dev/null)

if echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
  PROVIDER_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('provider_id',''))" 2>/dev/null)
  step_pass "Registered — provider ID: ${PROVIDER_ID}"
else
  step_info "Registration response: ${REGISTER_RESP}"
  step_fail "Registration failed — check API key or contact support"
fi

# ---------------------------------------------------------------------------
# 3. Install DC1 monitoring agent
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Installing monitoring agent...${NC}"

AGENT_DIR="/opt/dc1-agent"
sudo mkdir -p "$AGENT_DIR"

# Download monitoring agent
curl -s "${DC1_API_BASE}/providers/agent.py" | sudo tee "${AGENT_DIR}/agent.py" > /dev/null \
  || step_fail "Failed to download monitoring agent"

# Install dependencies
pip3 install requests 2>/dev/null || sudo pip3 install requests 2>/dev/null
step_pass "Dependencies installed"

# Write config
sudo tee "${AGENT_DIR}/config.env" > /dev/null <<AGENT_CONF
DC1_API_BASE=${DC1_API_BASE}
DC1_API_KEY=${DC1_API_KEY}
PROVIDER_ID=${PROVIDER_ID:-unknown}
GPU_NAME=${GPU_NAME}
GPU_COUNT=${GPU_COUNT}
AGENT_PORT=${AGENT_PORT}
AGENT_CONF

step_pass "Agent config written to ${AGENT_DIR}/config.env"

# ---------------------------------------------------------------------------
# 4. Create systemd service
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Creating systemd service...${NC}"

sudo tee /etc/systemd/system/dc1-agent.service > /dev/null <<SERVICE
[Unit]
Description=DC1 GPU Monitoring Agent
After=network.target

[Service]
Type=simple
EnvironmentFile=${AGENT_DIR}/config.env
ExecStart=/usr/bin/python3 ${AGENT_DIR}/agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable dc1-agent
sudo systemctl start dc1-agent
sleep 2

if systemctl is-active --quiet dc1-agent; then
  step_pass "dc1-agent service running"
else
  step_info "Service may still be starting — check: sudo journalctl -u dc1-agent -n 20"
fi

# ---------------------------------------------------------------------------
# 5. Send online heartbeat
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Sending initial heartbeat...${NC}"

HEARTBEAT_RESP=$(curl -s -X POST "${DC1_API_BASE}/providers/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-DC1-Key: ${DC1_API_KEY}" \
  -d "{\"provider_id\":\"${PROVIDER_ID}\",\"status\":\"online\",\"gpu_name\":\"${GPU_NAME}\"}" 2>/dev/null)

if echo "$HEARTBEAT_RESP" | grep -q "ok\|success\|received"; then
  step_pass "Heartbeat acknowledged by DC1"
else
  step_info "Heartbeat response: ${HEARTBEAT_RESP}"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo -e "\n${GREEN}================================================"
echo "✅ DC1 Provider Setup Complete!"
echo ""
echo "  GPU:         ${GPU_NAME} × ${GPU_COUNT}"
echo "  VRAM:        ${GPU_MEM_MIB} MiB"
echo "  Provider ID: ${PROVIDER_ID}"
echo "  Status:      ONLINE"
echo ""
echo "  Dashboard:   http://76.13.179.86:8084/kanban.html"
echo "  Support:     support@dc1st.com"
echo -e "================================================${NC}\n"
