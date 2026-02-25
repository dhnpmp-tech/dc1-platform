#!/usr/bin/env bash
#############################################################################
# DC1 Provider Setup Script — GPU Auto-Detect + Self-Registration
# Adapted from Nexus's autodetect design for our Express+SQLite backend
#############################################################################
set -euo pipefail

# --- Injected or provided API key ---
DC1_API_KEY="${1:-}"
DC1_API_URL="${2:-http://76.13.179.86:8083}"
DC1_PROVIDER_DIR="$HOME/dc1-provider"

# --- Colors ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log_header() { echo -e "\n${BLUE}════════════════════════════════════════${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}════════════════════════════════════════${NC}\n"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; exit 1; }
log_info()    { echo -e "${YELLOW}ℹ $1${NC}"; }

log_header "DC1 Provider Setup — Starting"

# ============================================================================
# STEP 1: VALIDATE API KEY
# ============================================================================
if [ -z "$DC1_API_KEY" ]; then
    log_error "API key required! Usage: bash <(curl -s \"$DC1_API_URL/api/providers/setup?key=YOUR_KEY\")"
fi
log_info "API Key: ${DC1_API_KEY:0:20}..."
log_success "Configuration valid"

# ============================================================================
# STEP 2: AUTO-DETECT GPU SPECS VIA nvidia-smi
# ============================================================================
log_header "Detecting Hardware"

GPU_NAME="unknown"
GPU_VRAM_MIB=0
GPU_DRIVER="unknown"
GPU_COMPUTE="unknown"
GPU_COUNT=0

if command -v nvidia-smi &>/dev/null; then
    GPU_CSV=$(nvidia-smi \
        --query-gpu=index,name,memory.total,driver_version,compute_cap \
        --format=csv,noheader,nounits 2>/dev/null) || true

    if [ -n "$GPU_CSV" ]; then
        GPU_NAME=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $2}' | xargs)
        GPU_VRAM_MIB=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $3}' | tr -d ' ')
        GPU_DRIVER=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $4}' | tr -d ' ')
        GPU_COMPUTE=$(echo "$GPU_CSV" | head -1 | awk -F', ' '{print $5}' | tr -d ' ')
        GPU_COUNT=$(echo "$GPU_CSV" | wc -l | tr -d ' ')

        log_success "Detected ${GPU_COUNT} GPU(s): ${GPU_NAME} (${GPU_VRAM_MIB} MiB VRAM)"
        log_success "Driver: ${GPU_DRIVER} | Compute: ${GPU_COMPUTE}"

        # Warn if below 8 GB
        if [ "$GPU_VRAM_MIB" -lt 8192 ] 2>/dev/null; then
            log_info "WARNING: GPU has ${GPU_VRAM_MIB} MiB VRAM — DC1 recommends 8 GB minimum"
        fi
    else
        log_info "nvidia-smi found but no GPUs detected"
    fi
else
    log_info "nvidia-smi not found — GPU detection skipped (install NVIDIA drivers for auto-detection)"
fi

# Get public IP
PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || \
            curl -s --connect-timeout 5 api.ipify.org 2>/dev/null || \
            echo "unknown")
log_info "Public IP: ${PUBLIC_IP}"

# OS info
OS_ID="unknown"
if [ -f /etc/os-release ]; then
    OS_ID=$(. /etc/os-release && echo "$ID $VERSION_ID")
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS_ID="macOS $(sw_vers -productVersion 2>/dev/null || echo 'unknown')"
fi
log_info "OS: ${OS_ID}"

# Disk space
DISK_FREE_GB=$(df -BG / 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "0")
log_info "Disk free: ${DISK_FREE_GB} GB"

# ============================================================================
# STEP 3: SEND GPU SPECS TO DC1 VIA HEARTBEAT
# ============================================================================
log_header "Registering GPU Specs with DC1"

HEARTBEAT_PAYLOAD=$(cat <<HEOF
{
    "api_key": "${DC1_API_KEY}",
    "provider_ip": "${PUBLIC_IP}",
    "provider_hostname": "$(hostname)",
    "gpu_status": {
        "gpu_name": "${GPU_NAME}",
        "gpu_vram_mib": ${GPU_VRAM_MIB},
        "gpu_driver": "${GPU_DRIVER}",
        "gpu_compute": "${GPU_COMPUTE}",
        "gpu_count": ${GPU_COUNT},
        "os": "${OS_ID}",
        "disk_free_gb": ${DISK_FREE_GB}
    },
    "uptime": "$(uptime -p 2>/dev/null || echo 'unknown')"
}
HEOF
)

HEARTBEAT_RESP=$(curl -s -X POST "${DC1_API_URL}/api/providers/heartbeat" \
    -H "Content-Type: application/json" \
    -d "$HEARTBEAT_PAYLOAD" 2>/dev/null) || true

if echo "$HEARTBEAT_RESP" | grep -q "success"; then
    log_success "GPU specs registered with DC1"
else
    log_info "Heartbeat response: ${HEARTBEAT_RESP}"
    log_info "Will retry on next heartbeat cycle"
fi

# ============================================================================
# STEP 4: INSTALL DEPENDENCIES
# ============================================================================
log_header "Installing Dependencies"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    log_info "Detected Linux"
    sudo apt update -qq 2>/dev/null || true
    sudo apt install -y -qq curl 2>&1 | tail -3 || true
elif [[ "$OSTYPE" == "darwin"* ]]; then
    log_info "Detected macOS"
fi
log_success "Dependencies checked"

# ============================================================================
# STEP 5: SETUP DC1 DIRECTORIES + CONFIG
# ============================================================================
log_header "Setting Up DC1 Directories"

mkdir -p "$DC1_PROVIDER_DIR"/{jobs,logs,checkpoints,config}
log_success "Directories created at $DC1_PROVIDER_DIR"

cat > "$DC1_PROVIDER_DIR/config/.env" << EOF
DC1_API_KEY=$DC1_API_KEY
DC1_API_URL=$DC1_API_URL
PROVIDER_DIR=$DC1_PROVIDER_DIR
PROVIDER_HOSTNAME=$(hostname)
PROVIDER_IP=$PUBLIC_IP
GPU_NAME=$GPU_NAME
GPU_VRAM_MIB=$GPU_VRAM_MIB
GPU_DRIVER=$GPU_DRIVER
GPU_COUNT=$GPU_COUNT
EOF
log_success "Configuration saved"

# ============================================================================
# STEP 6: CREATE HEARTBEAT DAEMON
# ============================================================================
log_header "Starting DC1 Daemon"

cat > "$DC1_PROVIDER_DIR/heartbeat.sh" << 'DAEMON_EOF'
#!/bin/bash
source "$HOME/dc1-provider/config/.env"
LOGS="$PROVIDER_DIR/logs/daemon.log"

log_msg() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGS"; }

send_heartbeat() {
    # Auto-detect current GPU utilization
    GPU_UTIL="0"
    VRAM_USED="0"
    if command -v nvidia-smi &>/dev/null; then
        GPU_UTIL=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0")
        VRAM_USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0")
    fi

    curl -s -X POST "$DC1_API_URL/api/providers/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{
            \"api_key\": \"$DC1_API_KEY\",
            \"provider_ip\": \"$PROVIDER_IP\",
            \"provider_hostname\": \"$PROVIDER_HOSTNAME\",
            \"gpu_status\": {
                \"gpu_name\": \"$GPU_NAME\",
                \"gpu_vram_mib\": $GPU_VRAM_MIB,
                \"gpu_driver\": \"$GPU_DRIVER\",
                \"gpu_count\": $GPU_COUNT,
                \"gpu_util_pct\": $GPU_UTIL,
                \"vram_used_mib\": $VRAM_USED
            },
            \"uptime\": \"$(uptime -p 2>/dev/null || echo unknown)\"
        }" && log_msg "Heartbeat sent (GPU util: ${GPU_UTIL}%)" || log_msg "Heartbeat failed"
}

log_msg "DC1 Daemon started (PID: $$)"
while true; do
    send_heartbeat
    sleep 30
done
DAEMON_EOF

chmod +x "$DC1_PROVIDER_DIR/heartbeat.sh"

# Start daemon in background
nohup "$DC1_PROVIDER_DIR/heartbeat.sh" > /dev/null 2>&1 &
log_success "DC1 Daemon started (running in background)"

# ============================================================================
# SUMMARY
# ============================================================================
log_header "Setup Complete!"
echo -e "${GREEN}Your DC1 provider is ready!${NC}\n"
echo "  GPU:      ${GPU_NAME} × ${GPU_COUNT}"
echo "  VRAM:     ${GPU_VRAM_MIB} MiB"
echo "  Driver:   ${GPU_DRIVER}"
echo "  Public IP: ${PUBLIC_IP}"
echo "  Location: $DC1_PROVIDER_DIR"
echo "  API Key:  ${DC1_API_KEY:0:20}..."
echo "  Status:   Running in background"
echo ""
echo "Next steps:"
echo "  1. Monitor logs: tail -f $DC1_PROVIDER_DIR/logs/daemon.log"
echo "  2. View dashboard: Visit http://dc1.sa/provider/dashboard"
echo "  3. Start earning: GPU will accept jobs automatically"
echo ""
