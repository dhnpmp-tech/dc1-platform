#!/bin/bash

#############################################################################
#         DC1 Provider Setup Script - Universal (Linux/Mac/Windows+WSL)   #
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DC1_API_KEY="${1:-}"
DC1_API_URL="${2:-http://76.13.179.86:8083}"
DC1_PROVIDER_DIR="$HOME/dc1-provider"

# ============================================================================
# FUNCTIONS
# ============================================================================

log_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

log_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# ============================================================================
# STEP 1: VALIDATE API KEY
# ============================================================================

log_header "DC1 Provider Setup - Starting"

if [ -z "$DC1_API_KEY" ]; then
    log_error "API key required! Usage: $0 <API_KEY>"
fi

log_info "API Key: ${DC1_API_KEY:0:20}..."
log_success "Configuration valid"

# ============================================================================
# STEP 2: INSTALL DEPENDENCIES
# ============================================================================

log_header "Installing Dependencies"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    log_info "Detected Linux"
    sudo apt update -qq
    sudo apt install -y -qq curl docker.io nvidia-docker2 2>&1 | tail -3
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    log_info "Detected macOS"
    
    if ! command -v brew &> /dev/null; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    brew install docker
    
else
    log_error "Unsupported OS: $OSTYPE"
fi

log_success "Dependencies installed"

# ============================================================================
# STEP 3: SETUP DC1 DIRECTORIES
# ============================================================================

log_header "Setting Up DC1 Directories"

mkdir -p "$DC1_PROVIDER_DIR"/{jobs,logs,checkpoints,config}

log_success "Directories created at $DC1_PROVIDER_DIR"

# ============================================================================
# STEP 4: CREATE DC1 CONFIG
# ============================================================================

log_header "Creating Configuration"

cat > "$DC1_PROVIDER_DIR/config/.env" << EOF
DC1_API_KEY=$DC1_API_KEY
DC1_API_URL=$DC1_API_URL
PROVIDER_DIR=$DC1_PROVIDER_DIR
PROVIDER_HOSTNAME=$(hostname)
PROVIDER_IP=$(hostname -I | awk '{print $1}')
EOF

log_success "Configuration saved"

# ============================================================================
# STEP 5: START DC1 DAEMON
# ============================================================================

log_header "Starting DC1 Daemon"

# Create daemon script
cat > "$DC1_PROVIDER_DIR/daemon.sh" << 'DAEMON_EOF'
#!/bin/bash

source "$HOME/dc1-provider/config/.env"

LOGS="$PROVIDER_DIR/logs/daemon.log"

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGS"
}

send_heartbeat() {
    GPU_INFO=$(nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,memory.used,memory.total \
               --format=csv,noheader 2>/dev/null || echo "offline")
    
    curl -s -X POST "$DC1_API_URL/api/providers/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{
            \"api_key\": \"$DC1_API_KEY\",
            \"provider_ip\": \"$PROVIDER_IP\",
            \"provider_hostname\": \"$PROVIDER_HOSTNAME\",
            \"gpu_status\": \"$GPU_INFO\",
            \"uptime\": \"$(uptime -p)\"
        }" && log_msg "Heartbeat sent" || log_msg "Heartbeat failed"
}

log_msg "DC1 Daemon started (PID: $$)"

while true; do
    send_heartbeat
    sleep 30
done
DAEMON_EOF

chmod +x "$DC1_PROVIDER_DIR/daemon.sh"

# Start daemon in background
nohup "$DC1_PROVIDER_DIR/daemon.sh" > /dev/null 2>&1 &

log_success "DC1 Daemon started (running in background)"

# ============================================================================
# VERIFICATION
# ============================================================================

log_header "Verification"

if nvidia-smi > /dev/null 2>&1; then
    GPU=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    log_success "GPU detected: $GPU"
else
    log_info "GPU not detected (may need reboot after driver installation)"
fi

if docker ps > /dev/null 2>&1; then
    log_success "Docker is running"
else
    log_info "Docker may need to be started manually"
fi

# ============================================================================
# SUMMARY
# ============================================================================

log_header "Setup Complete! 🎉"

echo -e "${GREEN}Your DC1 provider is ready!${NC}\n"
echo "Configuration:"
echo "  Location: $DC1_PROVIDER_DIR"
echo "  API Key: ${DC1_API_KEY:0:20}..."
echo "  Status: Running in background"
echo ""
echo "Next steps:"
echo "  1. Monitor logs: tail -f $DC1_PROVIDER_DIR/logs/daemon.log"
echo "  2. View dashboard: Visit http://dc1.sa/provider/dashboard"
echo "  3. Start earning: GPU will accept jobs automatically"
echo ""

