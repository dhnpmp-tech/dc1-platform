#!/usr/bin/env bash
# ============================================================================
# DCP Provider Activation Script
# Connects your GPU to the DCP marketplace so you can start earning.
#
# Usage:
#   curl -sSL https://dcp.sa/install | bash
#   -- or --
#   bash provider-activate.sh
#
# Requirements:
#   - Ubuntu 20.04+ (or compatible Linux distro)
#   - NVIDIA GPU with driver installed
#   - curl
# ============================================================================

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────
readonly API_BASE="https://api.dcp.sa"
readonly INSTALL_URL="https://dcp.sa/install"
readonly SERVICE_NAME="dcp-provider"
readonly SERVICE_USER="dcp-provider"
readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
readonly STATE_DIR="/opt/dcp/provider"
readonly STATE_FILE="${STATE_DIR}/provider.conf"
readonly LOG_FILE="${STATE_DIR}/provider.log"
readonly HEARTBEAT_INTERVAL=30   # seconds between heartbeats
readonly DAEMON_VERSION="1.1.0"
readonly KEY_PATTERN='^dc1-provider-[a-zA-Z0-9]{16,}$'

# Earnings table (USD/hr at 70% utilisation) — from DCP pricing engine
declare -A GPU_RATE_USD=(
  ["H200"]=3.20  ["H100"]=2.50  ["A100"]=1.50  ["A40"]=0.90
  ["RTX 4090"]=0.267 ["RTX 4080"]=0.18 ["RTX 3090"]=0.20 ["RTX 3080"]=0.12
  ["RTX 3070"]=0.09  ["RTX 3060"]=0.06 ["RTX 2080"]=0.07 ["GTX 1080"]=0.04
)
readonly SAR_PER_USD=3.75
readonly UTIL_FACTOR=0.70  # 70% average utilisation

# ── Colors ────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
  BLUE='\033[0;34m' BOLD='\033[1m' NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { printf "${BLUE}ℹ${NC}  %s\n" "$*"; }
ok()      { printf "${GREEN}✓${NC}  %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${NC}  %s\n" "$*"; }
fail()    { printf "${RED}✗${NC}  %s\n" "$*" >&2; }
banner()  { printf "\n${BOLD}%s${NC}\n" "$*"; }
die()     { fail "$*"; exit 1; }

# Fix #5: Sanitize strings before JSON interpolation
# Strips control characters, escapes backslash and double-quote.
json_escape() {
  printf '%s' "$1" | tr -d '\000-\031' | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# Fix #8: Validate key format before any network call
validate_key_format() {
  local key="$1"
  if [[ ! "$key" =~ $KEY_PATTERN ]]; then
    die "Key format invalid. Expected: dc1-provider-<16+ alphanumeric chars>. Check your registration email."
  fi
}

# Fix #6: Detect piped install (curl|bash — $0 is /bin/bash or /dev/fd/*)
is_piped_install() {
  local real
  real=$(realpath "$0" 2>/dev/null || echo "$0")
  [[ "$real" == "/bin/bash" ]] || \
  [[ "$real" == "/proc/self/fd/"* ]] || \
  [[ "$real" == "/dev/fd/"* ]] || \
  [[ "$real" == "/dev/stdin" ]]
}

# Fix #3: Safe state-file reader — no sourcing, no code execution
read_state_key() {
  grep -oP 'PROVIDER_KEY=\K[a-zA-Z0-9_-]+' "$STATE_FILE" 2>/dev/null || true
}

# ── GPU Detection ─────────────────────────────────────────────────────────────
detect_nvidia_gpu() {
  command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1
}

get_gpu_info() {
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1 | sed 's/^[[:space:]]*//')
  GPU_VRAM_MIB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | tr -d ' ')
  GPU_COUNT=$(nvidia-smi --list-gpus | wc -l)
  DRIVER_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1 | tr -d ' ')
  COMPUTE_CAP=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader | head -1 | tr -d ' ')
  CUDA_VERSION=$(nvidia-smi | grep -oP 'CUDA Version:\s*\K[\d.]+' || echo "unknown")
}

get_gpu_live_metrics() {
  local metrics
  metrics=$(nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,power.draw,memory.free \
    --format=csv,noheader,nounits 2>/dev/null | head -1)
  GPU_UTIL_PCT=$(echo "$metrics" | cut -d',' -f1 | tr -d ' '); GPU_UTIL_PCT=${GPU_UTIL_PCT%%.*}
  TEMP_C=$(echo "$metrics"       | cut -d',' -f2 | tr -d ' '); TEMP_C=${TEMP_C%%.*}
  POWER_W=$(echo "$metrics"      | cut -d',' -f3 | tr -d ' '); POWER_W=${POWER_W%%.*}
  FREE_VRAM_MIB=$(echo "$metrics"| cut -d',' -f4 | tr -d ' '); FREE_VRAM_MIB=${FREE_VRAM_MIB%%.*}
}

# ── Earnings Estimate ─────────────────────────────────────────────────────────
estimate_earnings() {
  local gpu_name="$1"
  local gpu_count="$2"
  local rate_usd=0

  for model in "${!GPU_RATE_USD[@]}"; do
    if [[ "$gpu_name" == *"$model"* ]] || [[ "$gpu_name" == *"${model//RTX /}"* ]]; then
      rate_usd="${GPU_RATE_USD[$model]}"
      break
    fi
  done

  if [[ "$rate_usd" == "0" ]]; then
    local vram_gb=$(( GPU_VRAM_MIB / 1024 ))
    if   [[ $vram_gb -ge 80 ]]; then rate_usd=2.50
    elif [[ $vram_gb -ge 40 ]]; then rate_usd=1.00
    elif [[ $vram_gb -ge 24 ]]; then rate_usd=0.267
    elif [[ $vram_gb -ge 16 ]]; then rate_usd=0.18
    elif [[ $vram_gb -ge 10 ]]; then rate_usd=0.12
    else                              rate_usd=0.06
    fi
  fi

  ESTIMATED_MONTHLY_USD=$(awk "BEGIN { printf \"%.0f\", $rate_usd * 24 * 30 * $UTIL_FACTOR * $gpu_count }")
  ESTIMATED_MONTHLY_SAR=$(awk "BEGIN { printf \"%.0f\", $ESTIMATED_MONTHLY_USD * $SAR_PER_USD }")
  ESTIMATED_HOURLY_USD=$(awk "BEGIN { printf \"%.3f\", $rate_usd * $gpu_count }")
}

# ── API Calls — Fix #2: key in Authorization header, not URL query string ─────
api_get() {
  local path="$1"
  local key="${2:-}"
  if [[ -n "$key" ]]; then
    curl -sS --max-time 10 -H "X-Provider-Key: ${key}" "${API_BASE}${path}"
  else
    curl -sS --max-time 10 "${API_BASE}${path}"
  fi
}

api_patch() {
  local path="$1"
  local key="$2"
  local body="$3"
  curl -sS --max-time 10 \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "X-Provider-Key: ${key}" \
    -d "$body" \
    "${API_BASE}${path}"
}

api_post() {
  local path="$1"
  local body="$2"
  curl -sS --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${API_BASE}${path}"
}

# ── Validate Provider Key ──────────────────────────────────────────────────────
validate_key() {
  local key="$1"
  local response
  response=$(api_get "/api/providers/me" "$key" 2>/dev/null || echo '{"error":"network"}')
  if echo "$response" | grep -q '"error"'; then
    return 1
  fi
  PROVIDER_NAME=$(echo "$response" | grep -oP '"name"\s*:\s*"\K[^"]+' || echo "Provider")
  return 0
}

# ── Update GPU Profile ─────────────────────────────────────────────────────────
update_gpu_profile() {
  local key="$1"
  local safe_gpu_name
  safe_gpu_name=$(json_escape "$GPU_NAME")
  local body="{\"gpu_model\":\"${safe_gpu_name}\",\"vram_mb\":${GPU_VRAM_MIB},\"gpu_count\":${GPU_COUNT}}"
  local response
  response=$(api_patch "/api/providers/me/gpu-profile" "$key" "$body" 2>/dev/null || echo '{"error":"network"}')
  if echo "$response" | grep -q '"error"'; then
    warn "GPU profile update skipped (daemon may already own it — OK)"
    return 0
  fi
  ok "GPU profile registered: ${GPU_NAME} × ${GPU_COUNT} (${GPU_VRAM_MIB} MiB VRAM)"
}

# ── Send Single Heartbeat ──────────────────────────────────────────────────────
send_heartbeat() {
  local key="$1"
  local hostname
  hostname=$(hostname 2>/dev/null || echo "unknown")
  local os_info
  os_info=$(uname -srm 2>/dev/null || echo "linux")

  get_gpu_live_metrics

  # Fix #5: escape all user-controlled strings before JSON interpolation
  local safe_gpu_name safe_driver safe_hostname safe_os safe_compute safe_cuda
  safe_gpu_name=$(json_escape "$GPU_NAME")
  safe_driver=$(json_escape "$DRIVER_VERSION")
  safe_hostname=$(json_escape "$hostname")
  safe_os=$(json_escape "$os_info")
  safe_compute=$(json_escape "${COMPUTE_CAP:-unknown}")
  safe_cuda=$(json_escape "${CUDA_VERSION:-unknown}")

  # Fix #4: removed api.ipify.org call — backend records IP from TCP connection
  local body
  body=$(cat <<JSON
{
  "api_key": "${key}",
  "provider_hostname": "${safe_hostname}",
  "gpu_status": {
    "gpu_name": "${safe_gpu_name}",
    "gpu_vram_mib": ${GPU_VRAM_MIB},
    "driver_version": "${safe_driver}",
    "gpu_util_pct": ${GPU_UTIL_PCT:-0},
    "temp_c": ${TEMP_C:-0},
    "power_w": ${POWER_W:-0},
    "free_vram_mib": ${FREE_VRAM_MIB:-0},
    "daemon_version": "${DAEMON_VERSION}",
    "python_version": "n/a",
    "os_info": "${safe_os}",
    "gpu_count": ${GPU_COUNT},
    "compute_capability": "${safe_compute}",
    "cuda_version": "${safe_cuda}"
  }
}
JSON
)
  api_post "/api/providers/heartbeat" "$body" >/dev/null 2>&1 || true
}

# ── Heartbeat Loop (runs as background service) ────────────────────────────────
run_heartbeat_loop() {
  local key="$1"
  get_gpu_info 2>/dev/null || true
  while true; do
    send_heartbeat "$key"
    sleep "$HEARTBEAT_INTERVAL"
  done
}

# ── Fix #1: Create dedicated system user for the service ──────────────────────
ensure_service_user() {
  if ! id "$SERVICE_USER" >/dev/null 2>&1; then
    useradd -r -s /bin/false -d "$STATE_DIR" -c "DCP Provider Agent" "$SERVICE_USER"
    # Add to video/render groups so nvidia-smi works without root
    usermod -aG video "$SERVICE_USER" 2>/dev/null || true
    usermod -aG render "$SERVICE_USER" 2>/dev/null || true
  fi
}

# ── Systemd Service Install ────────────────────────────────────────────────────
install_systemd_service() {
  local key="$1"

  ensure_service_user

  # Fix #7: restrict state directory permissions
  mkdir -p "$STATE_DIR"
  chmod 750 "$STATE_DIR"
  printf 'PROVIDER_KEY=%s\n' "$key" > "$STATE_FILE"
  chmod 600 "$STATE_FILE"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$STATE_DIR"

  # Fix #6: detect piped install and re-download instead of copying bash binary
  local installed_script="${STATE_DIR}/provider-activate.sh"
  local script_path
  if is_piped_install; then
    info "Piped install detected — downloading script to ${installed_script} ..."
    curl -sSL "$INSTALL_URL" -o "$installed_script"
    chmod +x "$installed_script"
    chown "${SERVICE_USER}:${SERVICE_USER}" "$installed_script"
    script_path="$installed_script"
  else
    script_path="$(realpath "$0")"
    if [[ "$script_path" != "$installed_script" ]]; then
      cp "$script_path" "$installed_script"
      chmod +x "$installed_script"
      chown "${SERVICE_USER}:${SERVICE_USER}" "$installed_script"
      script_path="$installed_script"
    fi
  fi

  # Fix #1: run as dedicated user, not root; add security hardening
  cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=DCP GPU Provider Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
ExecStart=${script_path} --heartbeat-loop
EnvironmentFile=${STATE_FILE}
Restart=always
RestartSec=10
StandardOutput=append:${LOG_FILE}
StandardError=append:${LOG_FILE}
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
  systemctl restart "$SERVICE_NAME"
}

install_bg_loop() {
  local key="$1"

  # Fix #7: restrict state directory permissions
  mkdir -p "$STATE_DIR"
  chmod 750 "$STATE_DIR"
  printf 'PROVIDER_KEY=%s\n' "$key" > "$STATE_FILE"
  chmod 600 "$STATE_FILE"

  # Fix #6: detect piped install
  local script_to_run
  if is_piped_install; then
    local installed_script="${STATE_DIR}/provider-activate.sh"
    info "Piped install detected — downloading script to ${installed_script} ..."
    curl -sSL "$INSTALL_URL" -o "$installed_script"
    chmod +x "$installed_script"
    script_to_run="$installed_script"
  else
    script_to_run="$(realpath "$0")"
  fi

  pkill -f "provider-activate.sh --heartbeat-loop" 2>/dev/null || true
  sleep 1

  nohup bash "$script_to_run" --heartbeat-loop >>"$LOG_FILE" 2>&1 &
  disown
  ok "Provider agent started (background process, PID $!)"
  info "Logs: ${LOG_FILE}"
}

# ── Check if service is already running ───────────────────────────────────────
service_is_running() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null && return 0
  fi
  pgrep -f "provider-activate.sh --heartbeat-loop" >/dev/null 2>&1 && return 0
  return 1
}

# ── Main Interactive Setup ─────────────────────────────────────────────────────
main_setup() {
  clear
  printf "${BOLD}╔══════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}║   DCP — Decentralized Compute Platform            ║${NC}\n"
  printf "${BOLD}║   GPU Provider Activation                         ║${NC}\n"
  printf "${BOLD}╚══════════════════════════════════════════════════╝${NC}\n\n"

  # ── Step 1: Check dependencies ────────────────────────────────────────────
  banner "Step 1 of 4 — Checking your system"

  if ! command -v curl >/dev/null 2>&1; then
    die "curl is required. Install with: sudo apt-get install -y curl"
  fi
  ok "curl found"

  if ! detect_nvidia_gpu; then
    die "No NVIDIA GPU detected. Make sure your driver is installed:\n       sudo apt-get install -y nvidia-driver-535"
  fi

  get_gpu_info
  ok "GPU detected: ${GPU_NAME} (${GPU_VRAM_MIB} MiB VRAM × ${GPU_COUNT})"
  ok "Driver: ${DRIVER_VERSION} | CUDA: ${CUDA_VERSION} | Compute: ${COMPUTE_CAP}"

  # ── Step 2: Provider key ──────────────────────────────────────────────────
  banner "Step 2 of 4 — Your provider key"
  printf "Your provider key was emailed to you when you registered.\n"
  printf "It looks like: ${BOLD}dc1-provider-xxxxxxxxxxxxxxxxxxxx${NC}\n\n"

  local key=""
  if [[ -f "$STATE_FILE" ]]; then
    # Fix #3: use grep, not source
    local saved_key
    saved_key=$(read_state_key)
    if [[ -n "$saved_key" ]]; then
      printf "Found saved key: ${BOLD}${saved_key:0:20}…${NC}\n"
      printf "Press ENTER to use it, or type a new key: "
      read -r input_key
      key="${input_key:-$saved_key}"
    fi
  fi

  if [[ -z "$key" ]]; then
    printf "Paste your provider key and press ENTER: "
    read -r key
  fi

  key=$(echo "$key" | tr -d '[:space:]')
  if [[ -z "$key" ]]; then
    die "No key provided. Cannot continue."
  fi

  # Fix #8: validate key format before any network call
  validate_key_format "$key"

  # ── Step 3: Validate key with API ─────────────────────────────────────────
  banner "Step 3 of 4 — Connecting to DCP"
  info "Checking connectivity to ${API_BASE} ..."

  if ! curl -sS --max-time 5 "${API_BASE}/api/health" >/dev/null 2>&1; then
    die "Cannot reach ${API_BASE}. Check your internet connection."
  fi
  ok "Connected to DCP API"

  info "Validating your provider key ..."
  if ! validate_key "$key"; then
    die "Invalid provider key. Double-check the key from your registration email."
  fi
  ok "Key validated — Welcome back, ${PROVIDER_NAME}!"

  # ── Register GPU specs ─────────────────────────────────────────────────────
  info "Registering GPU with DCP marketplace ..."
  update_gpu_profile "$key"

  # ── Step 4: Earnings estimate + start service ──────────────────────────────
  banner "Step 4 of 4 — Starting your provider agent"

  estimate_earnings "$GPU_NAME" "$GPU_COUNT"
  printf "\n${BOLD}💰 Estimated Monthly Earnings (70%% utilisation)${NC}\n"
  printf "   USD: \$%s/month  (SAR %s/month)\n" "$ESTIMATED_MONTHLY_USD" "$ESTIMATED_MONTHLY_SAR"
  printf "   Hourly rate: \$%s/hr per GPU\n\n" "$ESTIMATED_HOURLY_USD"

  # Start the heartbeat service
  if command -v systemctl >/dev/null 2>&1 && [[ "$(id -u)" -eq 0 ]]; then
    info "Installing systemd service (${SERVICE_NAME}) ..."
    install_systemd_service "$key"
    ok "Provider agent installed as system service (runs as ${SERVICE_USER})"
    ok "Will restart automatically on reboot"
    info "Logs: journalctl -u ${SERVICE_NAME} -f"
  else
    if command -v systemctl >/dev/null 2>&1; then
      warn "Run with sudo to install as a system service (recommended):"
      warn "  sudo bash $(realpath "$0" 2>/dev/null || echo provider-activate.sh)"
      warn "Starting as background process for now ..."
    fi
    install_bg_loop "$key"
  fi

  # Send the first heartbeat immediately so we appear online
  info "Sending first heartbeat ..."
  send_heartbeat "$key"

  printf "\n"
  printf "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗${NC}\n"
  printf "${GREEN}${BOLD}║  ✓  Your GPU is now LIVE on the DCP marketplace! ║${NC}\n"
  printf "${GREEN}${BOLD}╚══════════════════════════════════════════════════╝${NC}\n\n"
  info "Your GPU will appear online within 1 minute at https://dcp.sa/dashboard"
  info "DCP will route jobs to your GPU automatically. Earnings accumulate in real time."
  printf "\n"
  info "To check status:  curl -H 'X-Provider-Key: <your-key>' ${API_BASE}/api/providers/me"
  if command -v systemctl >/dev/null 2>&1 && [[ -f "$SERVICE_FILE" ]]; then
    info "To view logs:     journalctl -u ${SERVICE_NAME} -f"
    info "To stop:          sudo systemctl stop ${SERVICE_NAME}"
  else
    info "To view logs:     tail -f ${LOG_FILE}"
    info "To stop:          pkill -f 'provider-activate.sh --heartbeat-loop'"
  fi
  printf "\n"
}

# ── Entry point ────────────────────────────────────────────────────────────────
case "${1:-}" in
  --heartbeat-loop)
    # Internal: invoked by systemd or nohup. Load key from state file.
    # Fix #3: grep instead of source to prevent arbitrary code execution
    if [[ -z "${PROVIDER_KEY:-}" ]]; then
      if [[ -f "$STATE_FILE" ]]; then
        PROVIDER_KEY=$(read_state_key)
      fi
    fi
    if [[ -z "${PROVIDER_KEY:-}" ]]; then
      die "PROVIDER_KEY not set. Run the script interactively first."
    fi
    # Fix #8: validate key format even in daemon mode
    validate_key_format "$PROVIDER_KEY"
    get_gpu_info 2>/dev/null || true
    run_heartbeat_loop "$PROVIDER_KEY"
    ;;
  --status)
    # Fix #3: grep instead of source
    PROVIDER_KEY=$(read_state_key 2>/dev/null || true)
    if [[ -n "${PROVIDER_KEY:-}" ]]; then
      validate_key_format "$PROVIDER_KEY"
      RESPONSE=$(api_get "/api/providers/me" "$PROVIDER_KEY" 2>/dev/null || echo "{}")
      printf "Provider status: %s\n" "$RESPONSE"
    else
      printf "Not configured. Run the script to activate.\n"
    fi
    ;;
  --stop)
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
      systemctl stop "$SERVICE_NAME"
      ok "Provider agent stopped"
    else
      pkill -f "provider-activate.sh --heartbeat-loop" 2>/dev/null && ok "Provider agent stopped" || warn "Agent not running"
    fi
    ;;
  "")
    main_setup
    ;;
  *)
    printf "Usage: %s [--heartbeat-loop | --status | --stop]\n" "$0"
    exit 1
    ;;
esac
