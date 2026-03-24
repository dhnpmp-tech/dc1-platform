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
readonly SERVICE_NAME="dcp-provider"
readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
readonly STATE_DIR="/opt/dcp/provider"
readonly STATE_FILE="${STATE_DIR}/provider.conf"
readonly LOG_FILE="${STATE_DIR}/provider.log"
readonly HEARTBEAT_INTERVAL=30   # seconds between heartbeats
readonly DAEMON_VERSION="1.1.0"

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

# ── GPU Detection ─────────────────────────────────────────────────────────────
detect_nvidia_gpu() {
  if ! command -v nvidia-smi >/dev/null 2>&1; then
    return 1
  fi
  if ! nvidia-smi >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

get_gpu_info() {
  # Returns: GPU_NAME GPU_VRAM_MIB GPU_COUNT DRIVER_VERSION COMPUTE_CAP
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1 | sed 's/^[[:space:]]*//')
  GPU_VRAM_MIB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | tr -d ' ')
  GPU_COUNT=$(nvidia-smi --list-gpus | wc -l)
  DRIVER_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1 | tr -d ' ')
  COMPUTE_CAP=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader | head -1 | tr -d ' ')
  CUDA_VERSION=$(nvidia-smi | grep -oP 'CUDA Version:\s*\K[\d.]+' || echo "unknown")
}

get_gpu_live_metrics() {
  # Returns: GPU_UTIL_PCT TEMP_C POWER_W FREE_VRAM_MIB
  local metrics
  metrics=$(nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,power.draw,memory.free \
    --format=csv,noheader,nounits 2>/dev/null | head -1)
  GPU_UTIL_PCT=$(echo "$metrics" | cut -d',' -f1 | tr -d ' ')
  TEMP_C=$(echo "$metrics" | cut -d',' -f2 | tr -d ' ')
  POWER_W=$(echo "$metrics" | cut -d',' -f3 | tr -d ' ')
  FREE_VRAM_MIB=$(echo "$metrics" | cut -d',' -f4 | tr -d ' ')
  # Normalise: strip trailing decimals for integer fields
  GPU_UTIL_PCT=${GPU_UTIL_PCT%%.*}
  TEMP_C=${TEMP_C%%.*}
  POWER_W=${POWER_W%%.*}
  FREE_VRAM_MIB=${FREE_VRAM_MIB%%.*}
}

# ── Earnings Estimate ─────────────────────────────────────────────────────────
estimate_earnings() {
  local gpu_name="$1"
  local gpu_count="$2"
  local rate_usd=0

  # Fuzzy-match the GPU name against our earnings table
  for model in "${!GPU_RATE_USD[@]}"; do
    if [[ "$gpu_name" == *"$model"* ]] || [[ "$gpu_name" == *"${model//RTX /}"* ]]; then
      rate_usd="${GPU_RATE_USD[$model]}"
      break
    fi
  done

  if [[ "$rate_usd" == "0" ]]; then
    # Fallback: estimate by VRAM size
    local vram_gb=$(( GPU_VRAM_MIB / 1024 ))
    if   [[ $vram_gb -ge 80 ]]; then rate_usd=2.50
    elif [[ $vram_gb -ge 40 ]]; then rate_usd=1.00
    elif [[ $vram_gb -ge 24 ]]; then rate_usd=0.267
    elif [[ $vram_gb -ge 16 ]]; then rate_usd=0.18
    elif [[ $vram_gb -ge 10 ]]; then rate_usd=0.12
    else                              rate_usd=0.06
    fi
  fi

  # Monthly = rate * 24 * 30 * utilisation * gpu_count
  local monthly_usd
  monthly_usd=$(awk "BEGIN { printf \"%.0f\", $rate_usd * 24 * 30 * $UTIL_FACTOR * $gpu_count }")
  local monthly_sar
  monthly_sar=$(awk "BEGIN { printf \"%.0f\", $monthly_usd * $SAR_PER_USD }")

  ESTIMATED_MONTHLY_USD="$monthly_usd"
  ESTIMATED_MONTHLY_SAR="$monthly_sar"
  ESTIMATED_HOURLY_USD=$(awk "BEGIN { printf \"%.3f\", $rate_usd * $gpu_count }")
}

# ── API Calls ─────────────────────────────────────────────────────────────────
api_get() {
  local path="$1"
  local key="${2:-}"
  local url="${API_BASE}${path}"
  if [[ -n "$key" ]]; then
    url="${url}?key=${key}"
  fi
  curl -sS --max-time 10 "$url"
}

api_patch() {
  local path="$1"
  local key="$2"
  local body="$3"
  curl -sS --max-time 10 \
    -X PATCH \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${API_BASE}${path}?key=${key}"
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
  local vram_mb=$(( GPU_VRAM_MIB ))  # MiB ≈ MB for this purpose
  local body="{\"gpu_model\":\"${GPU_NAME}\",\"vram_mb\":${vram_mb},\"gpu_count\":${GPU_COUNT}}"
  local response
  response=$(api_patch "/api/providers/me/gpu-profile" "$key" "$body" 2>/dev/null || echo '{"error":"network"}')
  if echo "$response" | grep -q '"error"'; then
    # Might fail if daemon already set profile — not fatal
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
  local ip
  ip=$(curl -sS --max-time 5 "https://api.ipify.org" 2>/dev/null || echo "0.0.0.0")

  get_gpu_live_metrics

  local os_info
  os_info=$(uname -srm 2>/dev/null || echo "linux")

  local body
  body=$(cat <<JSON
{
  "api_key": "${key}",
  "provider_ip": "${ip}",
  "provider_hostname": "${hostname}",
  "gpu_status": {
    "gpu_name": "${GPU_NAME}",
    "gpu_vram_mib": ${GPU_VRAM_MIB},
    "driver_version": "${DRIVER_VERSION}",
    "gpu_util_pct": ${GPU_UTIL_PCT:-0},
    "temp_c": ${TEMP_C:-0},
    "power_w": ${POWER_W:-0},
    "free_vram_mib": ${FREE_VRAM_MIB:-0},
    "daemon_version": "${DAEMON_VERSION}",
    "python_version": "n/a",
    "os_info": "${os_info}",
    "gpu_count": ${GPU_COUNT},
    "compute_capability": "${COMPUTE_CAP:-unknown}",
    "cuda_version": "${CUDA_VERSION:-unknown}"
  }
}
JSON
)
  api_post "/api/providers/heartbeat" "$body" >/dev/null 2>&1 || true
}

# ── Heartbeat Loop (runs as background service) ────────────────────────────────
run_heartbeat_loop() {
  local key="$1"
  # Re-read GPU static info (in case script was invoked as service)
  get_gpu_info 2>/dev/null || true

  while true; do
    send_heartbeat "$key"
    sleep "$HEARTBEAT_INTERVAL"
  done
}

# ── Systemd Service Install ────────────────────────────────────────────────────
install_systemd_service() {
  local key="$1"
  local script_path
  script_path="$(realpath "$0")"

  # Save state
  mkdir -p "$STATE_DIR"
  printf 'PROVIDER_KEY=%s\n' "$key" > "$STATE_FILE"
  chmod 600 "$STATE_FILE"

  # Copy script if running from a temp path (e.g. piped from curl)
  local installed_script="${STATE_DIR}/provider-activate.sh"
  if [[ "$script_path" != "$installed_script" ]]; then
    cp "$0" "$installed_script"
    chmod +x "$installed_script"
    script_path="$installed_script"
  fi

  cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=DCP GPU Provider Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${script_path} --heartbeat-loop
EnvironmentFile=${STATE_FILE}
Restart=always
RestartSec=10
StandardOutput=append:${LOG_FILE}
StandardError=append:${LOG_FILE}

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
  systemctl restart "$SERVICE_NAME"
}

install_bg_loop() {
  # Fallback: launch a background process with nohup
  local key="$1"
  mkdir -p "$STATE_DIR"
  printf 'PROVIDER_KEY=%s\n' "$key" > "$STATE_FILE"
  chmod 600 "$STATE_FILE"

  # Kill any running loop for this key
  pkill -f "provider-activate.sh --heartbeat-loop" 2>/dev/null || true
  sleep 1

  nohup bash "$0" --heartbeat-loop >>"$LOG_FILE" 2>&1 &
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
    local saved_key
    saved_key=$(grep -oP 'PROVIDER_KEY=\K.+' "$STATE_FILE" 2>/dev/null || echo "")
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
    ok "Provider agent installed as system service"
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
  info "To check status:  curl ${API_BASE}/api/providers/me?key=${key:0:24}..."
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
    # Internal: invoked by systemd / nohup. Load key from state file.
    if [[ -z "${PROVIDER_KEY:-}" ]]; then
      if [[ -f "$STATE_FILE" ]]; then
        # shellcheck disable=SC1090
        source "$STATE_FILE"
      fi
    fi
    if [[ -z "${PROVIDER_KEY:-}" ]]; then
      die "PROVIDER_KEY not set. Run the script interactively first."
    fi
    get_gpu_info 2>/dev/null || true
    run_heartbeat_loop "$PROVIDER_KEY"
    ;;
  --status)
    # Quick status check
    if [[ -f "$STATE_FILE" ]]; then
      # shellcheck disable=SC1090
      source "$STATE_FILE"
      RESPONSE=$(api_get "/api/providers/me" "${PROVIDER_KEY:-}" 2>/dev/null || echo "{}")
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
